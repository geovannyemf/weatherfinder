// Sistema de clasificación de clima Pokémon GO
// Basado en los 7 climas oficiales del juego

// Importar iconos locales desde assets/images
import SunnyIcon from './assets/images/Sunny_icon_GO.png';
import ClearIcon from './assets/images/Clear_icon_GO.png';
import PartlyCloudyDayIcon from './assets/images/Partly_cloudy_day_icon_GO.png';
import PartlyCloudyNightIcon from './assets/images/Partly_cloudy_night_icon_GO.png';
import RainIcon from './assets/images/Rain_icon_GO.png';
import CloudyIcon from './assets/images/Cloudy_icon_GO.png';
import WindyIcon from './assets/images/Windy_icon_GO.png';
import SnowIcon from './assets/images/Snow_icon_GO.png';
import FogIcon from './assets/images/Fog_icon_GO.png';

// Iconos oficiales de Pokémon GO (locales)
export const PGO_ICON_URLS = {
  SUNNY_DAY:           SunnyIcon,
  SUNNY_NIGHT:         ClearIcon,
  PARTLY_CLOUDY_DAY:   PartlyCloudyDayIcon,
  PARTLY_CLOUDY_NIGHT: PartlyCloudyNightIcon,
  RAIN:                RainIcon,
  CLOUDY:              CloudyIcon,
  WINDY:               WindyIcon,
  SNOW:                SnowIcon,
  FOG:                 FogIcon,
};

/**
 * Returns the Pokémon GO icon URL for a given weather type and day/night state.
 * @param {string} type - Weather type (e.g. 'SUNNY', 'RAIN')
 * @param {boolean} isDay - Whether it is currently daytime
 * @returns {string} Icon URL
 */
export function getWeatherIconUrl(type, isDay = true) {
  switch (type) {
    case 'SUNNY':
      return isDay ? PGO_ICON_URLS.SUNNY_DAY : PGO_ICON_URLS.SUNNY_NIGHT;
    case 'PARTLY_CLOUDY':
      return isDay ? PGO_ICON_URLS.PARTLY_CLOUDY_DAY : PGO_ICON_URLS.PARTLY_CLOUDY_NIGHT;
    case 'RAIN':
      return PGO_ICON_URLS.RAIN;
    case 'CLOUDY':
      return PGO_ICON_URLS.CLOUDY;
    case 'WINDY':
      return PGO_ICON_URLS.WINDY;
    case 'SNOW':
      return PGO_ICON_URLS.SNOW;
    case 'FOG':
      return PGO_ICON_URLS.FOG;
    default:
      return PGO_ICON_URLS.CLOUDY;
  }
}

export const PGO_WEATHERS = {
  SUNNY: {
    id: 'SUNNY',
    type: 'SUNNY',
    label: 'Soleado',
    icon: '☀️',
    color: '#FFD700',
    boostedTypes: ['Fuego', 'Planta', 'Tierra'],
    isActive: false,
  },
  PARTLY_CLOUDY: {
    id: 'PARTLY_CLOUDY',
    type: 'PARTLY_CLOUDY',
    label: 'Parcialmente Nublado',
    icon: '⛅',
    color: '#A0AEC0',
    boostedTypes: ['Normal', 'Roca'],
    isActive: false,
  },
  CLOUDY: {
    id: 'CLOUDY',
    type: 'CLOUDY',
    label: 'Nublado',
    icon: '☁️',
    color: '#718096',
    boostedTypes: ['Lucha', 'Veneno', 'Hada'],
    isActive: false,
  },
  RAIN: {
    id: 'RAIN',
    type: 'RAIN',
    label: 'Lluvia',
    icon: '🌧️',
    color: '#4299E1',
    boostedTypes: ['Agua', 'Eléctrico', 'Insecto'],
    isActive: true,
  },
  SNOW: {
    id: 'SNOW',
    type: 'SNOW',
    label: 'Nieve',
    icon: '❄️',
    color: '#63B3ED',
    boostedTypes: ['Hielo', 'Acero'],
    isActive: true,
  },
  FOG: {
    id: 'FOG',
    type: 'FOG',
    label: 'Niebla',
    icon: '🌫️',
    color: '#9F7AEA',
    boostedTypes: ['Fantasma', 'Siniestro'],
    isActive: true,
  },
  WINDY: {
    id: 'WINDY',
    type: 'WINDY',
    label: 'Ventoso',
    icon: '💨',
    color: '#48BB78',
    boostedTypes: ['Dragón', 'Volador', 'Psíquico'],
    isActive: true,
  },
};

// Mapeo de weathercode de Open-Meteo a clima base PGO
// Open-Meteo WMO codes: https://open-meteo.com/en/docs
function getBaseWeatherFromCode(code) {
  // Despejado
  if (code === 0) return 'SUNNY';
  // Parcialmente nublado
  if (code === 1 || code === 2) return 'PARTLY_CLOUDY';
  // Nublado
  if (code === 3) return 'CLOUDY';
  // Niebla
  if (code === 45 || code === 48) return 'FOG';
  // Lluvia (llovizna, lluvia, chubascos)
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'RAIN';
  // Nieve (nevada, aguanieve, granizo)
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'SNOW';
  // Tormenta → se clasifica como RAIN en PGO
  if (code >= 95 && code <= 99) return 'RAIN';
  return 'CLOUDY';
}

/**
 * Clasifica el clima según el sistema de Pokémon GO
 * 
 * @param {Object} params - Parámetros meteorológicos
 * @param {number} params.weathercode - Código WMO de Open-Meteo
 * @param {number} params.windspeed - Velocidad del viento en km/h
 * @param {number} params.windgust - Ráfaga de viento en km/h (opcional)
 * @param {number} params.temperature - Temperatura en °C
 * @param {number} params.precipitation - Precipitación en mm
 * @param {number} params.cloudcover - Cobertura de nubes en % (0-100)
 * @param {number} params.visibility - Visibilidad en km (opcional)
 * @returns {Object} Objeto con la condición PGO
 */
export function classifyPGOWeather({
  weathercode,
  windspeed = 0,
  windgust = 0,
  temperature = 20,
  precipitation = 0,
  cloudcover = 0,
  visibility = 10,
}) {
  let weatherId;
  let classificationSource = 'weathercode';
  let windOverride = false;

  // PASO 1: Determinar clima base
  if (weathercode != null) {
    weatherId = getBaseWeatherFromCode(weathercode);
  } else {
    // Fallback por parámetros brutos (orden de prioridad)
    classificationSource = 'raw_params';
    
    if (visibility < 1) {
      weatherId = 'FOG';
    } else if (temperature <= 0 && precipitation > 0) {
      weatherId = 'SNOW';
    } else if (precipitation >= 0.5) {
      weatherId = 'RAIN';
    } else if (cloudcover >= 85) {
      weatherId = 'CLOUDY';
    } else if (cloudcover >= 40) {
      weatherId = 'PARTLY_CLOUDY';
    } else {
      weatherId = 'SUNNY';
    }
  }

  // PASO 2: Override de viento (siempre se evalúa)
  // Si wind_speed_kmh >= 24 O wind_gust_kmh >= 35 → WINDY
  if (windspeed >= 24 || windgust >= 35) {
    weatherId = 'WINDY';
    windOverride = true;
  }

  const weather = PGO_WEATHERS[weatherId];

  return {
    ...weather,
    type: weatherId,
    classificationSource,
    windOverride,
  };
}

// Función de compatibilidad con el código existente
export function getCondition(weathercode, windspeed, extraParams = {}) {
  return classifyPGOWeather({
    weathercode,
    windspeed,
    ...extraParams,
  });
}

// Colores por tipo de clima (para MapView y otros componentes)
export const CONDITION_COLORS = {
  SUNNY: '#FFD700',
  PARTLY_CLOUDY: '#A0AEC0',
  CLOUDY: '#718096',
  RAIN: '#4299E1',
  SNOW: '#63B3ED',
  FOG: '#9F7AEA',
  WINDY: '#48BB78',
};

// Lista de todas las condiciones para filtros
export const ALL_CONDITIONS = Object.values(PGO_WEATHERS);
