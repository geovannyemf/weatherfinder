export function getConditionFromCode(code) {
  if (code === 0) return 'soleado';
  if (code === 1 || code === 2) return 'parcial';
  if (code === 3) return 'nublado';
  if (code === 45 || code === 48) return 'niebla';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'lluvia';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'nieve';
  if (code >= 95 && code <= 99) return 'tormenta';
  return 'nublado';
}

const CONDITIONS = {
  soleado: { label: 'Soleado', icon: '☀️', type: 'soleado', color: '#FFD700', isActive: false },
  parcial: { label: 'Parcial', icon: '⛅', type: 'parcial', color: '#A0AEC0', isActive: false },
  nublado: { label: 'Nublado', icon: '☁️', type: 'nublado', color: '#718096', isActive: false },
  niebla: { label: 'Niebla', icon: '🌫️', type: 'niebla', color: '#9F7AEA', isActive: true },
  lluvia: { label: 'Lluvia', icon: '🌧️', type: 'lluvia', color: '#4299E1', isActive: true },
  nieve: { label: 'Nieve', icon: '🌨️', type: 'nieve', color: '#63B3ED', isActive: true },
  tormenta: { label: 'Tormenta', icon: '⛈️', type: 'tormenta', color: '#ED8936', isActive: true },
  viento: { label: 'Viento fuerte', icon: '💨', type: 'viento', color: '#48BB78', isActive: true },
};

export function getCondition(weathercode, windspeed) {
  if (windspeed > 40) return CONDITIONS.viento;
  const type = getConditionFromCode(weathercode);
  return CONDITIONS[type];
}

export const CONDITION_COLORS = {
  lluvia: '#4299E1',
  nieve: '#63B3ED',
  soleado: '#FFD700',
  nublado: '#718096',
  parcial: '#718096',
  tormenta: '#ED8936',
  niebla: '#9F7AEA',
  viento: '#48BB78',
};

export const ALL_CONDITIONS = Object.values(CONDITIONS);
