import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import cities from './cities';
import { getCondition } from './weatherUtils';
import StatsBar from './components/StatsBar';
import Filters from './components/Filters';
import MapView from './components/MapView';
import ListView from './components/ListView';

const REFRESH_INTERVAL = 600; // seconds (10 minutes)
const CACHE_DURATION = 3600000; // 1 hour in milliseconds
const MAX_BATCH_SIZE = 20; // Reduced from 100 to avoid 429 rate-limiting
const BATCH_DELAY_MS = 1000; // 1 second delay between batches
const OPEN_METEO_PARAMS = 'current=temperature_2m,precipitation,weathercode,relative_humidity_2m,windspeed_10m,windgusts_10m,apparent_temperature,cloudcover,visibility,is_day';

const DEFAULT_FILTERS = {
  region: '',
  conditions: [],
  minHour: 0,
  maxHour: 23,
  minTemp: -60,
  maxTemp: 60,
  search: '',
  sortBy: 'condicion',
};

function getLocalHour(timezone) {
  try {
    const str = new Date().toLocaleString('es-ES', { timeZone: timezone, hour: '2-digit', hour12: false });
    return parseInt(str, 10);
  } catch {
    return new Date().getHours();
  }
}

// Sistema de caché con expiración
class WeatherCache {
  constructor(duration = CACHE_DURATION) {
    this.duration = duration;
    this.data = this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('weatherCache');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem('weatherCache', JSON.stringify(this.data));
    } catch (err) {
      console.warn('Cache storage failed:', err);
    }
  }

  isExpired(timestamp) {
    return Date.now() - timestamp > this.duration;
  }

  get(cityIds) {
    const cached = {};
    const needsFetch = [];

    cityIds.forEach((id) => {
      const entry = this.data[id];
      if (entry && !this.isExpired(entry.timestamp)) {
        cached[id] = entry.data;
      } else {
        needsFetch.push(id);
      }
    });

    return { cached, needsFetch };
  }

  set(cityId, data) {
    this.data[cityId] = {
      data,
      timestamp: Date.now(),
    };
    this.saveToStorage();
  }

  setBatch(results) {
    results.forEach((result) => {
      this.set(result.id, result.weather);
    });
  }
}

const cache = new WeatherCache();

/**
 * Construye URL batch para Open-Meteo
 * https://open-meteo.com/en/docs#latitude=&longitude=
 */
function buildBatchUrl(citiesToFetch) {
  const lats = citiesToFetch.map((c) => c.lat).join(',');
  const lons = citiesToFetch.map((c) => c.lon).join(',');
  // Use /forecast endpoint which properly supports batch requests with multiple locations
  return `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&${OPEN_METEO_PARAMS}&timezone=auto`;
}

/**
 * Mapea respuesta de batch a formato de ciudad
 * La API devuelve array en mismo orden que las coordenadas
 */
function parseCurrentData(current) {
  const weatherParams = {
    weathercode: current.weathercode,
    windspeed: current.windspeed_10m,
    windgust: current.windgusts_10m ?? 0,
    temperature: current.temperature_2m,
    precipitation: current.precipitation,
    cloudcover: current.cloudcover ?? 0,
    visibility: (current.visibility ?? 10000) / 1000,
  };

  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    precipitation: current.precipitation,
    windspeed: weatherParams.windspeed,
    windgust: weatherParams.windgust,
    weathercode: weatherParams.weathercode,
    isDay: current.is_day === 1,
    condition: getCondition(weatherParams.weathercode, weatherParams.windspeed, weatherParams),
  };
}

/**
 * Retry con exponential backoff AGRESIVO para 429 Too Many Requests
 * Delays: 5s, 10s, 20s, 40s, 60s
 */
async function fetchWithRetry(url, maxRetries = 5, initialDelay = 5000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url);

      // 429 = Too Many Requests - aplicar backoff agresivo
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : initialDelay * Math.pow(2, attempt);
        console.warn(
          `⚠️ Rate limited (429). Waiting ${Math.round(delay / 1000)}s before retry ${attempt + 1}/${maxRetries}...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        const errMsg = err?.message || String(err);
        console.warn(
          `❌ Request failed (attempt ${attempt + 1}/${maxRetries}). ` +
          `Waiting ${Math.round(delay / 1000)}s before retry...\n` +
          `Error: ${errMsg}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  const errMsg = lastError?.message || String(lastError);
  throw new Error(`Failed after ${maxRetries} attempts: ${errMsg}`);
}

/**
 * Realiza llamada batch a Open-Meteo
 * IMPORTANTE: Open-Meteo /forecast con múltiples coords retorna UN OBJETO POR COORDENADA
 * NO retorna arrays agrupados, sino objetos con {current, timezone, latitude, longitude}
 */
async function fetchBatchWeather(citiesToFetch) {
  if (citiesToFetch.length === 0) return [];

  const url = buildBatchUrl(citiesToFetch);

  try {
    const response = await fetchWithRetry(url);
    
    // DEBUG: Inspeccionar estructura de respuesta
    console.log('📡 API Response received:', {
      topKeys: Object.keys(response).slice(0, 10),
      isArray: Array.isArray(response),
      hasResults: 'results' in response,
      hasLatitude: 'latitude' in response,
      currentType: typeof response.current,
      currentIsArray: Array.isArray(response.current),
      requestedCities: citiesToFetch.length,
    });

    const results = [];

    // ✅ FORMATO 1: Response es un ARRAY de objetos de ubicación
    // [{current: {...}, timezone: "...", latitude: 35.6595, longitude: 139.7004}, ...]
    if (Array.isArray(response)) {
      console.log('✓ Array format detected');
      
      response.forEach((item, index) => {
        if (item.current && item.timezone && citiesToFetch[index]) {
          results.push({
            id: citiesToFetch[index].id,
            weather: {
              ...parseCurrentData(item.current),
              timezone: item.timezone,
            },
          });
        } else {
          console.warn(`⚠️ Index ${index}: Missing data for`, citiesToFetch[index]?.name);
        }
      });
    }
    // ✅ FORMATO 2: Response tiene "results" array (estructura anidada)
    // {results: [{current: {...}, timezone: "..."}, ...]}
    else if (response.results && Array.isArray(response.results)) {
      console.log('✓ Results array format detected');
      
      response.results.forEach((item, index) => {
        if (item.current && item.timezone && citiesToFetch[index]) {
          results.push({
            id: citiesToFetch[index].id,
            weather: {
              ...parseCurrentData(item.current),
              timezone: item.timezone,
            },
          });
        } else {
          console.warn(`⚠️ Results[${index}]: Missing data for`, citiesToFetch[index]?.name);
        }
      });
    }
    // ✅ FORMATO 3: Arrays groupados {current: [...], timezone: [...]}
    else if (Array.isArray(response.current) && Array.isArray(response.timezone)) {
      console.log('✓ Grouped arrays format detected');
      
      response.current.forEach((current, index) => {
        if (current && response.timezone[index] && citiesToFetch[index]) {
          results.push({
            id: citiesToFetch[index].id,
            weather: {
              ...parseCurrentData(current),
              timezone: response.timezone[index],
            },
          });
        } else {
          console.warn(`⚠️ Index ${index}: Missing data for`, citiesToFetch[index]?.name);
        }
      });
    }
    // ✅ FORMATO 4: Single object (batch limitado a 1 ubicación)
    else if (response.current && !Array.isArray(response.current) && response.latitude !== undefined) {
      console.warn('⚠️ Single object format - batch returned only 1 location');
      
      if (citiesToFetch[0]) {
        results.push({
          id: citiesToFetch[0].id,
          weather: {
            ...parseCurrentData(response.current),
            timezone: response.timezone,
          },
        });
      }
      
      if (citiesToFetch.length > 1) {
        console.warn(
          `⚠️ BATCH INCOMPLETE: Requested ${citiesToFetch.length} cities, ` +
          `got 1. Open-Meteo may limit batch size. Will retry smaller batches.`
        );
      }
    }
    // ❌ ERROR: Estructura desconocida
    else {
      console.error('❌ Unknown response format');
      console.log('Full response:', response);
      throw new Error(
        `Unknown API response format. Expected array or results. ` +
        `Got keys: ${Object.keys(response).join(', ')}`
      );
    }

    // Validar resultados
    if (results.length === 0) {
      throw new Error(
        `Failed to extract any data from API response. ` +
        `Requested ${citiesToFetch.length} cities, got ${results.length}.`
      );
    }

    if (results.length < citiesToFetch.length) {
      console.warn(
        `⚠️ Partial batch: ${results.length}/${citiesToFetch.length} cities. ` +
        `Missing: ${citiesToFetch.slice(results.length).map(c => c.name).join(', ')}`
      );
    } else {
      console.log(`✓ Batch complete: ${results.length}/${citiesToFetch.length} cities`);
    }

    return results;
  } catch (err) {
    const errMsg = err?.message || String(err);
    console.error('❌ Batch fetch failed:', errMsg);
    throw err;
  }
}

export default function App() {
  const [weatherData, setWeatherData] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentCity, setCurrentCity] = useState('');
  const [error, setError] = useState(null);
  const [view, setView] = useState('map');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchAllWeather = useCallback(async () => {
    setLoading(true);
    setLoadingProgress(0);
    setCurrentCity('');
    setError(null);
    const newData = new Map();

    // Obtener datos en caché y determinar qué ciudades necesitan fetch
    const { cached, needsFetch } = cache.get(cities.map((c) => c.id));

    // Agregar datos en caché a los resultados
    Object.entries(cached).forEach(([cityId, weather]) => {
      newData.set(parseInt(cityId), weather);
    });

    setLoadingProgress(Math.round(((cities.length - needsFetch.length) / cities.length) * 100));

    // Procesar ciudades que necesitan fetch en lotes de MAX_BATCH_SIZE
    const citiesToFetch = cities.filter((c) => needsFetch.includes(c.id));

    if (citiesToFetch.length === 0) {
      setWeatherData(new Map(newData));
      setLastUpdate(new Date());
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
      return;
    }

    let allBatchesFailed = false;

    for (let i = 0; i < citiesToFetch.length; i += MAX_BATCH_SIZE) {
      const batch = citiesToFetch.slice(i, i + MAX_BATCH_SIZE);
      const batchNumber = Math.floor(i / MAX_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(citiesToFetch.length / MAX_BATCH_SIZE);

      try {
        setCurrentCity(`${batch[0].name} (Batch ${batchNumber}/${totalBatches})`);
        
        const results = await fetchBatchWeather(batch);

        // Guardar en caché y en mapa de datos
        cache.setBatch(results);
        results.forEach((result) => {
          newData.set(result.id, result.weather);
        });

        // ✅ Add delay between batches to avoid 429 rate-limiting
        // Skip delay on last batch
        if (i + MAX_BATCH_SIZE < citiesToFetch.length) {
          console.log(`⏳ Waiting ${BATCH_DELAY_MS}ms before next batch...`);
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      } catch (err) {
        const errMsg = err?.message || String(err);
        console.error(`❌ Batch ${batchNumber} (${batch.length} cities) failed:`, errMsg);
        
        // ⚠️ FALLBACK 1: Si el batch falla, intenta con grupos más pequeños
        if (batch.length > 10) {
          console.log(`📊 Fallback: reduciendo tamaño de batch de ${batch.length} a 10...`);
          
          for (let j = 0; j < batch.length; j += 10) {
            const smallerBatch = batch.slice(j, j + 10);
            try {
              setCurrentCity(`${smallerBatch[0].name} (Fallback 1)`);
              
              const subResults = await fetchBatchWeather(smallerBatch);
              cache.setBatch(subResults);
              subResults.forEach((result) => {
                newData.set(result.id, result.weather);
              });
              
              console.log(`  ✓ Fallback batch succeeded (${subResults.length}/${smallerBatch.length})`);
              
              // Add delay between fallback batches too
              await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS * 2));
            } catch (subErr) {
              const subErrMsg = subErr?.message || String(subErr);
              console.error(`  ❌ Fallback batch failed:`, subErrMsg);
              
              // ⚠️ FALLBACK 2: Try even smaller batches
              if (smallerBatch.length > 3) {
                console.log(`  📊 Fallback 2: reduciendo a 3 ciudades...`);
                
                for (let k = 0; k < smallerBatch.length; k += 3) {
                  const tinyBatch = smallerBatch.slice(k, k + 3);
                  try {
                    setCurrentCity(`${tinyBatch[0].name} (Fallback 2)`);
                    
                    const tinyResults = await fetchBatchWeather(tinyBatch);
                    cache.setBatch(tinyResults);
                    tinyResults.forEach((result) => {
                      newData.set(result.id, result.weather);
                    });
                    
                    console.log(`    ✓ Tiny batch succeeded (${tinyResults.length}/${tinyBatch.length})`);
                    
                    // Delay between tiny batches
                    await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS * 2));
                  } catch (tinyErr) {
                    const tinyErrMsg = tinyErr?.message || String(tinyErr);
                    console.error(
                      `    ❌ Tiny batch FAILED for:`,
                      tinyBatch.map(c => c.name).join(', '),
                      `Error: ${tinyErrMsg}`
                    );
                    
                    allBatchesFailed = true;
                    setError(`⚠️ Failed to fetch: ${tinyBatch.map(c => c.name).join(', ')}`);
                  }
                }
              } else {
                // Already tiny batch, can't reduce further
                allBatchesFailed = true;
                setError(`❌ Failed to fetch ${smallerBatch.length} cities: ${smallerBatch.map(c => c.name).join(', ')}`);
              }
            }
          }
        } else {
          // Batch already small
          allBatchesFailed = true;
          
          if (errMsg.includes('429')) {
            setError('⚠️ API rate-limited. Waiting and retrying...');
          } else {
            setError(`❌ Error: ${errMsg.substring(0, 60)}`);
          }
        }
      }

      setLoadingProgress(
        Math.round(
          (((cities.length - needsFetch.length) + Math.min(i + MAX_BATCH_SIZE, citiesToFetch.length)) /
            cities.length) *
            100
        )
      );
    }

    setWeatherData(new Map(newData));
    setLastUpdate(new Date());
    setLoading(false);
    setCurrentCity('');
    setCountdown(REFRESH_INTERVAL);
  }, []);

  useEffect(() => {
    fetchAllWeather();
    const interval = setInterval(fetchAllWeather, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchAllWeather]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : REFRESH_INTERVAL));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFilterChange = useCallback((updates) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const filteredCities = useMemo(() => {
    return cities.filter((city) => {
      if (filters.region && city.region !== filters.region) return false;
      if (filters.search && !city.name.toLowerCase().includes(filters.search.toLowerCase())) return false;

      const w = weatherData.get(city.id);
      if (!w) return true;

      if (filters.conditions.length > 0 && !filters.conditions.includes(w.condition?.type)) return false;

      const temp = w.temperature;
      if (temp != null && (temp < filters.minTemp || temp > filters.maxTemp)) return false;

      const hour = getLocalHour(w.timezone);
      if (hour < filters.minHour || hour > filters.maxHour) return false;

      return true;
    });
  }, [filters, weatherData]);

  const dominantCondition = useMemo(() => {
    const counts = {};
    filteredCities.forEach((city) => {
      const w = weatherData.get(city.id);
      const type = w?.condition?.type;
      if (type) counts[type] = (counts[type] || 0) + 1;
    });
    if (!Object.keys(counts).length) return 'default';
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }, [filteredCities, weatherData]);

  return (
    <div className={`app bg-${dominantCondition}`}>
      {dominantCondition === 'RAIN' && <RainAnimation />}
      {dominantCondition === 'SNOW' && <SnowAnimation />}
      {dominantCondition === 'SUNNY' && <SunAnimation />}

      <header className="app-header">
        <div className="header-title">
          <span className="header-globe">🌍</span>
          <h1>WEATHER FINDER</h1>
        </div>
        <div className="header-controls">
          <button
            className={`view-btn ${view === 'map' ? 'active' : ''}`}
            onClick={() => setView('map')}
          >
            🗺️ MAPA
          </button>
          <button
            className={`view-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
          >
            ☰ LISTA
          </button>
        </div>
      </header>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <div className="loading-text">
              Obteniendo datos meteorológicos
            </div>
            {currentCity && (
              <div className="loading-city">
                {currentCity}...
              </div>
            )}
            <div className="loading-progress-text">
              {loadingProgress}%
            </div>
            <div className="loading-bar-wrap">
              <div className="loading-bar" style={{ width: `${loadingProgress}%` }} />
            </div>
            {error && (
              <div className="loading-error">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      <StatsBar
        weatherData={weatherData}
        filteredCities={filteredCities}
        lastUpdate={lastUpdate}
        countdown={countdown}
      />

      <Filters filters={filters} onChange={handleFilterChange} />

      <main className="app-main">
        {view === 'map' ? (
          <MapView cities={filteredCities} weatherData={weatherData} />
        ) : (
          <ListView cities={filteredCities} weatherData={weatherData} sortBy={filters.sortBy} />
        )}
      </main>
    </div>
  );
}

function RainAnimation() {
  const drops = Array.from({ length: 40 }, (_, i) => i);
  return (
    <div className="bg-animation rain-animation" aria-hidden="true">
      {drops.map((i) => (
        <div
          key={i}
          className="raindrop"
          style={{
            left: `${(i * 2.5) % 100}%`,
            animationDelay: `${(i * 0.05) % 2}s`,
            animationDuration: `${0.6 + (i % 5) * 0.16}s`,
          }}
        />
      ))}
    </div>
  );
}

function SnowAnimation() {
  const flakes = Array.from({ length: 40 }, (_, i) => i);
  return (
    <div className="bg-animation snow-animation" aria-hidden="true">
      {flakes.map((i) => (
        <div
          key={i}
          className="snowflake"
          style={{
            left: `${(i * 2.5) % 100}%`,
            animationDelay: `${(i * 0.125) % 5}s`,
            animationDuration: `${3 + (i % 7) * 0.57}s`,
            fontSize: `${8 + (i % 4) * 4}px`,
          }}
        />
      ))}
    </div>
  );
}

function SunAnimation() {
  return (
    <div className="bg-animation sun-animation" aria-hidden="true">
      <div className="sun-rays">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="sun-ray" style={{ transform: `rotate(${i * 45}deg)` }} />
        ))}
      </div>
    </div>
  );
}
