import { CONDITION_COLORS } from '../weatherUtils';

function getLocalHour(timezone) {
  try {
    const str = new Date().toLocaleString('es-ES', { timeZone: timezone, hour: '2-digit', hour12: false });
    return parseInt(str, 10);
  } catch {
    return new Date().getHours();
  }
}

export default function ListView({ cities, weatherData, sortBy, selectedCity, onSelectCity }) {
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
    <div className="city-sidebar">
      <div className="list-view">
        {sorted.map(city => {
          const w = weatherData.get(city.id);
          const condition = w?.condition;
          const color = condition ? CONDITION_COLORS[condition.type] : '#718096';
          const isSelected = selectedCity?.id === city.id;

          return (
            <div
              key={city.id}
              className={[
                'city-list-item',
                condition?.isActive ? 'city-list-item-active' : '',
                isSelected ? 'city-list-item-selected' : '',
              ].filter(Boolean).join(' ')}
              style={{ '--item-color': color }}
              onClick={() => onSelectCity(city)}
            >
              <span className="item-icon">{condition?.icon || '❓'}</span>
              <div className="item-info">
                <div className="item-name">{city.flag} {city.name}</div>
                <div className="item-sub">{city.country} · {condition?.label || '--'}</div>
              </div>
              <div className="item-temp" style={{ color }}>
                {w?.temperature != null ? `${w.temperature.toFixed(1)}°C` : '--'}
              </div>
              {condition?.isActive && <span className="badge-live">EN VIVO</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
