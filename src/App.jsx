import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import cities from './cities';
import { getCondition } from './weatherUtils';
import StatsBar from './components/StatsBar';
import Filters from './components/Filters';
import MapView from './components/MapView';
import ListView from './components/ListView';

const REFRESH_INTERVAL = 600; // seconds (10 minutes)
const BATCH_SIZE = 10;

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

const OPEN_METEO_PARAMS = 'current=temperature_2m,precipitation,weathercode,relative_humidity_2m,windspeed_10m,windgusts_10m,apparent_temperature,cloudcover,visibility&forecast_days=1';

function buildWeatherUrl(city) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&${OPEN_METEO_PARAMS}&timezone=${city.timezone}`;
}

async function fetchCityWeather(city) {
  const url = buildWeatherUrl(city);
  const res = await fetch(url);
  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  const current = data.current;
  
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
    condition: getCondition(weatherParams.weathercode, weatherParams.windspeed, weatherParams),
  };
}

export default function App() {
  const [weatherData, setWeatherData] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [view, setView] = useState('map');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchAllWeather = useCallback(async () => {
    setLoading(true);
    setLoadingProgress(0);
    const newData = new Map();
    let loaded = 0;

    for (let i = 0; i < cities.length; i += BATCH_SIZE) {
      const batch = cities.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (city) => {
          try {
            const data = await fetchCityWeather(city);
            newData.set(city.id, data);
          } catch (err) {
            console.warn(`Failed to fetch weather for ${city.name}:`, err);
          }
          loaded++;
          setLoadingProgress(Math.round((loaded / cities.length) * 100));
        })
      );
    }

    setWeatherData(new Map(newData));
    setLastUpdate(new Date());
    setLoading(false);
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

      const hour = getLocalHour(city.timezone);
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
          <div className="loading-bar-wrap">
            <div className="loading-bar" style={{ width: `${loadingProgress}%` }} />
          </div>
          <div className="loading-text">Cargando datos meteorológicos... {loadingProgress}%</div>
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
