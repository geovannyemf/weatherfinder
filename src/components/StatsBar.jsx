import { ALL_CONDITIONS } from '../weatherUtils';

export default function StatsBar({ weatherData, filteredCities, lastUpdate, countdown }) {
  const loaded = weatherData.size;

  const conditionCounts = {};
  ALL_CONDITIONS.forEach(c => { conditionCounts[c.type] = 0; });
  let hottest = null, coldest = null, tempSum = 0, tempCount = 0;

  filteredCities.forEach(city => {
    const w = weatherData.get(city.id);
    if (!w) return;
    const type = w.condition?.type;
    if (type && conditionCounts[type] !== undefined) conditionCounts[type]++;
    const temp = w.temperature;
    if (temp !== undefined && temp !== null) {
      tempSum += temp;
      tempCount++;
      if (!hottest || temp > weatherData.get(hottest.id)?.temperature) hottest = city;
      if (!coldest || temp < weatherData.get(coldest.id)?.temperature) coldest = city;
    }
  });

  const avgTemp = tempCount > 0 ? (tempSum / tempCount).toFixed(1) : '--';
  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div className="stats-bar">
      <div className="stats-section">
        <span className="stats-label">CIUDADES</span>
        <span className="stats-value">{loaded}</span>
      </div>
      <div className="stats-conditions">
        {ALL_CONDITIONS.map(c => (
          <span key={c.type} className="stats-cond" title={c.label}>
            {c.icon} <span className="stats-cond-count">{conditionCounts[c.type] || 0}</span>
          </span>
        ))}
      </div>
      <div className="stats-section">
        <span className="stats-label">MÁS CALIENTE</span>
        <span className="stats-value">
          {hottest ? `${hottest.name} ${weatherData.get(hottest.id)?.temperature?.toFixed(1)}°C` : '--'}
        </span>
      </div>
      <div className="stats-section">
        <span className="stats-label">MÁS FRÍO</span>
        <span className="stats-value">
          {coldest ? `${coldest.name} ${weatherData.get(coldest.id)?.temperature?.toFixed(1)}°C` : '--'}
        </span>
      </div>
      <div className="stats-section">
        <span className="stats-label">TEMP MEDIA</span>
        <span className="stats-value">{avgTemp}°C</span>
      </div>
      <div className="stats-section">
        <span className="stats-label">ACTUALIZADO</span>
        <span className="stats-value stats-small">
          {lastUpdate ? lastUpdate.toLocaleTimeString('es-ES') : '--'}
        </span>
      </div>
      <div className="stats-section">
        <span className="stats-label">PRÓX. ACT.</span>
        <span className="stats-value stats-small">{mins}:{String(secs).padStart(2, '0')}</span>
      </div>
    </div>
  );
}
