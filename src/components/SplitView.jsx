import { useState } from 'react';
import { CONDITION_COLORS, getWeatherIconUrl } from '../weatherUtils';
import MapView from './MapView';

function getLocalHour(timezone) {
  try {
    const str = new Date().toLocaleString('es-ES', { timeZone: timezone, hour: '2-digit', hour12: false });
    return parseInt(str, 10);
  } catch {
    return new Date().getHours();
  }
}

export default function SplitView({ cities, weatherData, sortBy }) {
  const [selectedCityId, setSelectedCityId] = useState(null);

  const localHours = cities.reduce((acc, city) => {
    const w = weatherData.get(city.id);
    acc[city.id] = getLocalHour(w?.timezone);
    return acc;
  }, {});

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
      return localHours[a.id] - localHours[b.id];
    }
    if (sortBy === 'condicion') {
      return (wa?.condition?.type ?? '').localeCompare(wb?.condition?.type ?? '');
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="split-view">
      <div className="split-panel-left">
        {sorted.map(city => {
          const w = weatherData.get(city.id);
          const condition = w?.condition;
          const color = condition ? CONDITION_COLORS[condition.type] : '#718096';
          const isSelected = selectedCityId === city.id;

          return (
            <div
              key={city.id}
              className={`split-city-item${isSelected ? ' selected' : ''}${condition?.isActive ? ' live' : ''}`}
              style={{ '--item-color': color }}
              onClick={() => setSelectedCityId(city.id)}
            >
              <div className="split-city-icon">
                {condition?.type
                  ? <img src={getWeatherIconUrl(condition.type, w?.isDay !== false)} alt={condition.label || ''} className="weather-icon-img" />
                  : <span>❓</span>}
              </div>
              <div className="split-city-info">
                <div className="split-city-name-row">
                  <span className="split-city-name">{city.flag} {city.name}</span>
                  {condition?.isActive && <span className="badge-live">EN VIVO</span>}
                </div>
                <div className="split-city-meta">
                  <span className="split-city-country">{city.country}</span>
                  <span className="split-city-condition" style={{ color }}>{condition?.label || '--'}</span>
                </div>
              </div>
              <div className="split-city-temp">
                {w?.temperature != null ? `${w.temperature.toFixed(1)}°` : '--'}
              </div>
            </div>
          );
        })}
      </div>
      <div className="split-panel-right">
        <MapView cities={cities} weatherData={weatherData} selectedCityId={selectedCityId} />
      </div>
    </div>
  );
}
