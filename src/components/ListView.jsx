import { CONDITION_COLORS } from '../weatherUtils';

function formatCoords(lat, lon) {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

function getLocalHour(timezone) {
  try {
    const str = new Date().toLocaleString('es-ES', { timeZone: timezone, hour: '2-digit', hour12: false });
    return parseInt(str, 10);
  } catch {
    return new Date().getHours();
  }
}

function getLocalTime(timezone) {
  const options = {
    weekday: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  try {
    if (timezone) {
      return new Date().toLocaleString('es-ES', { ...options, timeZone: timezone });
    }
    return new Date().toLocaleString('es-ES', options);
  } catch {
    return new Date().toLocaleString('es-ES', options);
  }
}

export default function ListView({ cities, weatherData, sortBy }) {
  const sorted = [...cities].sort((a, b) => {
    const wa = weatherData.get(a.id);
    const wb = weatherData.get(b.id);

    // Active conditions first
    const aActive = wa?.condition?.isActive ? 0 : 1;
    const bActive = wb?.condition?.isActive ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;

    if (sortBy === 'temperatura') {
      return (wb?.temperature ?? -999) - (wa?.temperature ?? -999);
    }
    if (sortBy === 'hora') {
      return getLocalHour(wa?.timezone) - getLocalHour(wb?.timezone);
    }
    if (sortBy === 'condicion') {
      return (wa?.condition?.type ?? '').localeCompare(wb?.condition?.type ?? '');
    }
    // nombre
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="list-view">
      {sorted.map(city => {
        const w = weatherData.get(city.id);
        const condition = w?.condition;
        const color = condition ? CONDITION_COLORS[condition.type] : '#718096';
        const localTime = getLocalTime(w?.timezone);

        return (
          <div
            key={city.id}
            className={`city-card ${condition?.isActive ? 'city-card-active' : ''}`}
            style={{ '--card-color': color }}
          >
            <div className="card-header">
              <div className="card-city-name">{city.flag} {city.name}</div>
              <div className="card-country">{city.country}</div>
              {condition?.isActive && (
                <span className="badge-live">EN VIVO</span>
              )}
            </div>
            <div className="card-condition" style={{ color }}>
              <span className="card-icon">{condition?.icon || '❓'}</span>
              <span className="card-condition-label">{condition?.label || '--'}</span>
            </div>
            <div className="card-temp">
              {w?.temperature != null ? `${w.temperature.toFixed(1)}°C` : '--'}
            </div>
            <div className="card-data">
              <div className="card-data-row">
                <span className="card-data-label">Sensación</span>
                <span className="card-data-value">{w?.feelsLike != null ? `${w.feelsLike.toFixed(1)}°C` : '--'}</span>
              </div>
              <div className="card-data-row">
                <span className="card-data-label">Humedad</span>
                <span className="card-data-value">{w?.humidity != null ? `${w.humidity}%` : '--'}</span>
              </div>
              <div className="card-data-row">
                <span className="card-data-label">Viento</span>
                <span className="card-data-value">{w?.windspeed != null ? `${w.windspeed.toFixed(1)} km/h` : '--'}</span>
              </div>
              <div className="card-data-row">
                <span className="card-data-label">Precip.</span>
                <span className="card-data-value">{w?.precipitation != null ? `${w.precipitation} mm` : '--'}</span>
              </div>
            </div>
            <div className="card-time">🕐 {localTime}</div>
            <div className="card-coords">
              <span className="coords-text">📍 {formatCoords(city.lat, city.lon)}</span>
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(formatCoords(city.lat, city.lon))}
                title="Copiar coordenadas"
              >
                📋
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
