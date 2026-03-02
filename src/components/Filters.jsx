import { ALL_CONDITIONS, getWeatherIconUrl } from '../weatherUtils';

const REGIONS = [
  { value: '', label: 'Todas' },
  { value: 'america', label: 'América' },
  { value: 'europa', label: 'Europa' },
  { value: 'asia', label: 'Asia' },
  { value: 'africa', label: 'África' },
  { value: 'oceania', label: 'Oceanía' },
];

const SORT_OPTIONS = [
  { value: 'condicion', label: 'Condición' },
  { value: 'temperatura', label: 'Temperatura' },
  { value: 'hora', label: 'Hora local' },
  { value: 'nombre', label: 'Nombre' },
];

export default function Filters({ filters, onChange }) {
  const { region, conditions, minHour, maxHour, minTemp, maxTemp, search, sortBy } = filters;

  const toggleCondition = (type) => {
    const next = conditions.includes(type)
      ? conditions.filter(c => c !== type)
      : [...conditions, type];
    onChange({ conditions: next });
  };

  return (
    <div className="filters">
      <div className="filters-row">
        <div className="filter-group">
          <label className="filter-label">REGIÓN</label>
          <div className="region-tabs">
            {REGIONS.map(r => (
              <button
                key={r.value}
                className={`region-tab ${region === r.value ? 'active' : ''}`}
                onClick={() => onChange({ region: r.value })}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label">BUSCAR</label>
          <input
            className="filter-input"
            type="text"
            placeholder="Ciudad..."
            value={search}
            onChange={e => onChange({ search: e.target.value })}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">ORDENAR POR</label>
          <select
            className="filter-select"
            value={sortBy}
            onChange={e => onChange({ sortBy: e.target.value })}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="filters-row">
        <div className="filter-group">
          <label className="filter-label">CONDICIÓN</label>
          <div className="condition-toggles">
            {ALL_CONDITIONS.map(c => (
              <button
                key={c.type}
                className={`cond-toggle ${conditions.includes(c.type) ? 'active' : ''}`}
                onClick={() => toggleCondition(c.type)}
                title={c.label}
                style={conditions.includes(c.type) ? { borderColor: c.color, color: c.color } : {}}
              >
                <img src={getWeatherIconUrl(c.type, true)} alt={c.label} className="weather-icon-img" style={{ width: '20px', height: '20px', verticalAlign: 'middle' }} /> {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group filter-group-inline">
          <label className="filter-label">HORA LOCAL</label>
          <div className="range-inputs">
            <input
              type="number" min="0" max="23" className="filter-input-sm"
              value={minHour} onChange={e => onChange({ minHour: Number(e.target.value) })}
            />
            <span>—</span>
            <input
              type="number" min="0" max="23" className="filter-input-sm"
              value={maxHour} onChange={e => onChange({ maxHour: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="filter-group filter-group-inline">
          <label className="filter-label">TEMPERATURA (°C)</label>
          <div className="range-inputs">
            <input
              type="number" className="filter-input-sm"
              value={minTemp} onChange={e => onChange({ minTemp: Number(e.target.value) })}
            />
            <span>—</span>
            <input
              type="number" className="filter-input-sm"
              value={maxTemp} onChange={e => onChange({ maxTemp: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
