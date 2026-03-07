# WEATHER FINDER — Prompt técnico de reconstrucción

> Este documento describe técnica y detalladamente cómo está construida la aplicación **WEATHER FINDER**, para que pueda ser recreada íntegramente en un repositorio nuevo a partir de estas especificaciones.

---

## 1. Descripción general

**WEATHER FINDER** es una Single Page Application (SPA) que muestra en tiempo real las condiciones meteorológicas de las mejores ubicaciones mundiales para jugar Pokémon GO. Clasifica el clima según el sistema oficial de 7 tipos del juego y permite visualizar los datos en una vista de mapa interactivo o en una vista de tarjetas. La interfaz es completamente en español, con tema oscuro tipo cyberpunk.

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework UI | React | ^19.2.0 |
| Build tool | Vite | ^7.3.1 |
| Mapa interactivo | Leaflet | ^1.9.4 |
| API meteorológica | Open-Meteo (gratuita, sin autenticación) | — |
| Lenguaje | JavaScript (JSX), sin TypeScript | — |
| Linter | ESLint 9 (flat config) | ^9.39.1 |
| Tipografías | Google Fonts (Bebas Neue, Space Mono, Inter) | — |
| Iconos clima | PNGs locales (iconos oficiales Pokémon GO) | — |

No se usa ningún sistema de rutas (sin React Router), sin gestión de estado global (sin Redux/Zustand), sin backend propio ni base de datos.

---

## 3. Estructura de ficheros

```
weatherfinder/
├── index.html                       # Punto de entrada HTML (lang="es")
├── vite.config.js                   # Config Vite con plugin-react
├── eslint.config.js                 # ESLint flat config
├── package.json
├── public/
│   └── vite.svg                     # Favicon por defecto
├── resources/
│   └── data/
│       └── pokedensity-cities.json  # 94 ciudades con coordenadas y metadatos
└── src/
    ├── main.jsx                     # Entry point React (StrictMode)
    ├── index.css                    # Reset mínimo: box-sizing + bg body
    ├── App.jsx                      # Componente raíz + toda la lógica de datos
    ├── App.css                      # Todos los estilos de la aplicación
    ├── cities.js                    # Importa JSON y normaliza campo lng→lon
    ├── weatherUtils.js              # Sistema de clasificación PGO + iconos
    ├── assets/
    │   └── images/
    │       ├── Sunny_icon_GO.png
    │       ├── Clear_icon_GO.png
    │       ├── Partly_cloudy_day_icon_GO.png
    │       ├── Partly_cloudy_night_icon_GO.png
    │       ├── Rain_icon_GO.png
    │       ├── Cloudy_icon_GO.png
    │       ├── Windy_icon_GO.png
    │       ├── Snow_icon_GO.png
    │       └── Fog_icon_GO.png
    └── components/
        ├── StatsBar.jsx             # Barra de estadísticas global
        ├── Filters.jsx              # Panel de filtros
        ├── MapView.jsx              # Vista de mapa con Leaflet
        └── ListView.jsx             # Vista de tarjetas
```

---

## 4. Datos de ciudades (`resources/data/pokedensity-cities.json`)

Array JSON de **94 objetos**, cada uno con los campos:

```json
{
  "name": "Shibuya / Harajuku",
  "country": "Japón",
  "flag": "🇯🇵",
  "region": "asia",
  "lat": 35.6595,
  "lng": 139.7004,
  "density": 142,
  "stops": 890,
  "gyms": 54,
  "rating": 5,
  "tags": ["evento", "turistico", "raid"],
  "tips": "La zona más densa de Tokio...",
  "best": "Parque Yoyogi, Cruce Shibuya, Harajuku",
  "evento": "Safari Zone frecuente, Community Days masivos",
  "transporte": "Metro Yamanote Line"
}
```

**Distribución por región:**
- `asia`: 28 ciudades
- `europa`: 25 ciudades
- `america`: 24 ciudades
- `oceania`: 11 ciudades
- `africa`: 6 ciudades

El campo `region` es uno de: `"asia"`, `"europa"`, `"america"`, `"oceania"`, `"africa"`.

**`src/cities.js`** importa este JSON y lo transforma: añade un campo numérico `id` (índice+1) y renombra `lng` → `lon` para uniformidad:

```js
import rawCities from '../resources/data/pokedensity-cities.json';
const cities = rawCities.map(({ lng, ...rest }, index) => ({
  ...rest,
  id: index + 1,
  lon: lng,
}));
export default cities;
```

---

## 5. Sistema de clasificación meteorológica PGO (`src/weatherUtils.js`)

### 5.1 Los 7 tipos de clima

| Tipo | Label (ES) | Emoji | Color hex | Tipos Pokémon potenciados | `isActive` |
|---|---|---|---|---|---|
| `SUNNY` | Soleado | ☀️ | `#FFD700` | Fuego, Planta, Tierra | false |
| `PARTLY_CLOUDY` | Parcialmente Nublado | ⛅ | `#A0AEC0` | Normal, Roca | false |
| `CLOUDY` | Nublado | ☁️ | `#718096` | Lucha, Veneno, Hada | false |
| `RAIN` | Lluvia | 🌧️ | `#4299E1` | Agua, Eléctrico, Insecto | true |
| `SNOW` | Nieve | ❄️ | `#63B3ED` | Hielo, Acero | true |
| `FOG` | Niebla | 🌫️ | `#9F7AEA` | Fantasma, Siniestro | true |
| `WINDY` | Ventoso | 💨 | `#48BB78` | Dragón, Volador, Psíquico | true |

El campo `isActive` indica si ese clima está actualmente activo en PGO (afecta al badge "EN VIVO" en las tarjetas).

### 5.2 Función de clasificación `classifyPGOWeather(params)`

Recibe un objeto con:
- `weathercode` — código WMO de Open-Meteo
- `windspeed` — velocidad del viento en km/h
- `windgust` — ráfagas en km/h
- `temperature` — temperatura en °C
- `precipitation` — precipitación en mm
- `cloudcover` — cobertura nubosa (0-100)
- `visibility` — visibilidad en km

**Algoritmo (dos pasos):**

1. **Paso 1 — Clima base desde `weathercode` WMO:**
   - `0` → `SUNNY`
   - `1`, `2` → `PARTLY_CLOUDY`
   - `3` → `CLOUDY`
   - `45`, `48` → `FOG`
   - `51–67`, `80–82` → `RAIN`
   - `71–77`, `85`, `86` → `SNOW`
   - `95–99` (tormentas) → `RAIN`
   - Si `weathercode` es null, fallback por parámetros brutos (visibilidad < 1 km → FOG, temp ≤ 0 + precipitación → SNOW, etc.)

2. **Paso 2 — Override de viento (siempre se evalúa):**
   Si `windspeed >= 24 km/h` **O** `windgust >= 35 km/h` → resultado final es `WINDY` (sin importar el paso 1).

### 5.3 Iconos locales

`getWeatherIconUrl(type, isDay)` retorna el PNG local correspondiente:
- `SUNNY` + day → `Sunny_icon_GO.png`
- `SUNNY` + night → `Clear_icon_GO.png`
- `PARTLY_CLOUDY` + day → `Partly_cloudy_day_icon_GO.png`
- `PARTLY_CLOUDY` + night → `Partly_cloudy_night_icon_GO.png`
- El resto (RAIN, CLOUDY, WINDY, SNOW, FOG) tienen un único PNG día/noche.

### 5.4 Exports del módulo

- `PGO_WEATHERS` — objeto con los 7 definiciones
- `ALL_CONDITIONS` — array de todos los valores de `PGO_WEATHERS`
- `CONDITION_COLORS` — objeto `{ SUNNY: '#FFD700', ... }`
- `classifyPGOWeather(params)` — función principal
- `getCondition(weathercode, windspeed, extraParams)` — alias de compatibilidad
- `getWeatherIconUrl(type, isDay)` — resuelve PNG local

---

## 6. API de clima: Open-Meteo

**Endpoint:** `https://api.open-meteo.com/v1/forecast`

**Parámetros fijos (constante `OPEN_METEO_PARAMS`):**
```
current=temperature_2m,precipitation,weathercode,relative_humidity_2m,
        windspeed_10m,windgusts_10m,apparent_temperature,cloudcover,
        visibility,is_day
```

**Construcción de URL batch:**
```
GET /v1/forecast?latitude=LAT1,LAT2,...&longitude=LON1,LON2,...&{PARAMS}&timezone=auto
```
Las latitudes y longitudes se pasan como strings separados por comas. La API retorna los resultados **en el mismo orden** que las coordenadas enviadas.

**Constantes de la lógica de fetching:**
```js
const REFRESH_INTERVAL = 600;      // segundos (10 min)
const CACHE_DURATION = 3600000;    // 1 hora en ms
const MAX_BATCH_SIZE = 20;         // ciudades por batch
const BATCH_DELAY_MS = 1000;       // ms entre batches
```

### 6.1 Formatos de respuesta manejados

La función `fetchBatchWeather` detecta y procesa **4 formatos posibles** del response JSON:

1. **Array de objetos** `[{current:{...}, timezone:"...", latitude:x, longitude:y}, ...]`
2. **Objeto con `results`** `{results: [{current:{...}, timezone:"..."}, ...]}`
3. **Arrays agrupados** `{current: [...], timezone: [...]}` (mismo índice)
4. **Objeto único** `{current:{...}, timezone:"...", latitude:x}` — batch limitado a 1 ubicación

### 6.2 Parsing del response

`parseCurrentData(current)` extrae los campos del objeto `current` de la API:
```js
{
  temperature: current.temperature_2m,
  feelsLike: current.apparent_temperature,
  humidity: current.relative_humidity_2m,
  precipitation: current.precipitation,
  windspeed: current.windspeed_10m,
  windgust: current.windgusts_10m ?? 0,
  weathercode: current.weathercode,
  isDay: current.is_day === 1,
  condition: getCondition(weathercode, windspeed, { windgust, temperature, precipitation, cloudcover, visibility }),
}
```
Además se añade `timezone` proveniente del nivel raíz de cada item de respuesta.

### 6.3 Sistema de caché (`WeatherCache`)

Clase instanciada como singleton `cache` antes del componente App:
- Persistencia: `localStorage` con clave `weatherCache`
- Estructura en memoria: `{ [cityId]: { data: {...}, timestamp: number } }`
- `cache.get(cityIds)` → `{ cached: {...}, needsFetch: [...] }` — separa ciudades con caché válida de las que hay que refrescar
- `cache.set(cityId, data)` — guarda individual
- `cache.setBatch(results)` — guarda array de `{id, weather}`
- Expiración: 1 hora desde `timestamp`

### 6.4 Sistema de reintentos y fallbacks

`fetchWithRetry(url, maxRetries=5, initialDelay=5000)`:
- En error 429: respeta el header `Retry-After` o aplica backoff exponencial: 5s, 10s, 20s, 40s, 60s
- Otros errores: backoff exponencial, hasta 5 reintentos

**Estructura de fallbacks por batch:**
1. Batch principal de `MAX_BATCH_SIZE=20` ciudades
2. Si falla: sub-batches de 10 ciudades
3. Si falla: sub-batches de 3 ciudades ("tiny")

---

## 7. Componente raíz `App.jsx`

### 7.1 Estado

```js
const [weatherData, setWeatherData]       // Map<cityId, weatherObject>
const [loading, setLoading]               // boolean
const [loadingProgress, setLoadingProgress] // 0-100
const [currentCity, setCurrentCity]       // string (nombre ciudad en fetch)
const [error, setError]                   // string | null
const [view, setView]                     // 'map' | 'list'
const [filters, setFilters]               // objeto DEFAULT_FILTERS
const [countdown, setCountdown]           // segundos restantes para próxima actualización
const [lastUpdate, setLastUpdate]         // Date | null
```

### 7.2 Filtros por defecto (`DEFAULT_FILTERS`)

```js
{
  region: '',           // '' = todas las regiones
  conditions: [],       // [] = todas las condiciones
  minHour: 0,
  maxHour: 23,
  minTemp: -60,
  maxTemp: 60,
  search: '',           // búsqueda por nombre de ciudad
  sortBy: 'condicion',  // 'condicion' | 'temperatura' | 'hora' | 'nombre'
}
```

### 7.3 Efectos

1. **Fetch inicial + refresco automático:** `useEffect` lanza `fetchAllWeather()` al montar y programa `setInterval(fetchAllWeather, 600_000)`.
2. **Countdown:** `setInterval` de 1 segundo decrementa `countdown`; se resetea a 600 en cada fetch completado.

### 7.4 Cálculo de `filteredCities` (useMemo)

Filtra el array `cities` según:
- `filters.region` — coincidencia exacta con `city.region`
- `filters.search` — `city.name.toLowerCase().includes(...)`
- `filters.conditions` — si hay condiciones seleccionadas, el tipo de la ciudad debe estar en la lista
- `filters.minTemp / maxTemp` — rango de temperatura
- `filters.minHour / maxHour` — rango de hora local (usando `getLocalHour(timezone)`)

### 7.5 Fondo dinámico (`dominantCondition`)

`useMemo` que cuenta cuántas ciudades filtradas tienen cada tipo de clima y retorna el mayoritario. El `<div class="app">` recibe la clase `bg-{dominantCondition}` (o `bg-default`). Si el dominante es `RAIN`, `SNOW` o `SUNNY`, se renderiza la animación de fondo correspondiente.

### 7.6 Animaciones de fondo (componentes internos)

- **`RainAnimation`**: 40 `<div class="raindrop">` con posición y timing escalonados (animación CSS `fall-rain`)
- **`SnowAnimation`**: 40 `<div class="snowflake">` con `::before { content: '❄' }` (animación CSS `fall-snow`)
- **`SunAnimation`**: 8 `<div class="sun-ray">` rotados a 45° entre sí, girados por `spin-sun` a 20s, opacidad 0.08

---

## 8. Componentes

### 8.1 `StatsBar`

**Props:** `{ weatherData, filteredCities, lastUpdate, countdown }`

Muestra en una barra horizontal (`display: flex; flex-wrap: wrap`):
1. **CIUDADES** — `weatherData.size` (ciudades con datos cargados)
2. **Emojis de condición** con conteo: itera `ALL_CONDITIONS` y cuenta cuántas ciudades filtradas tienen ese tipo
3. **MÁS CALIENTE** — ciudad con temperatura máxima en `filteredCities`
4. **MÁS FRÍO** — ciudad con temperatura mínima
5. **TEMP MEDIA** — promedio de todas las temperaturas de `filteredCities`
6. **ACTUALIZADO** — `lastUpdate.toLocaleTimeString('es-ES')`
7. **PRÓX. ACT.** — `MM:SS` calculado de `countdown`

### 8.2 `Filters`

**Props:** `{ filters, onChange }` — `onChange` recibe un objeto parcial con las claves a modificar.

Tiene dos filas:

**Fila 1:**
- **REGIÓN**: botones tipo tab (`region-tab`) para `['', 'america', 'europa', 'asia', 'africa', 'oceania']`
- **BUSCAR**: `<input type="text">` para búsqueda por nombre
- **ORDENAR POR**: `<select>` con opciones `condicion`, `temperatura`, `hora`, `nombre`

**Fila 2:**
- **CONDICIÓN**: botones toggle para cada tipo PGO. Activos: `border-color` y `color` del color del tipo
- **HORA LOCAL**: dos `<input type="number" min=0 max=23>` para rango `minHour`/`maxHour`
- **TEMPERATURA (°C)**: dos `<input type="number">` para rango `minTemp`/`maxTemp`

### 8.3 `MapView`

**Props:** `{ cities, weatherData }`

**Inicialización (primer `useEffect`):**
- Importación dinámica de Leaflet: `const L = (await import('leaflet')).default`
- Mapa centrado en `[20, 0]`, zoom 2
- TileLayer CARTO Dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Subdomains: `'abcd'`
- La referencia al mapa se guarda en `mapInstanceRef.current`
- Cleanup: `map.remove()` al desmontar

**Actualización de markers (segundo `useEffect`, deps: `[cities, weatherData]`):**
- Elimina todos los markers previos del ref
- Para cada ciudad: `L.circleMarker([lat, lon])` con:
  - `radius`: 9 si `isActive`, 7 si no
  - `fillColor`: color según `CONDITION_COLORS[condition.type]`
  - `color` (borde): `#fff` si activo, igual que `fillColor` si no
  - `weight`: 2 si activo, 1 si no
  - `className`: `'pulse-marker'` si activo (animación CSS pulso)
- Popup HTML inline con: ciudad+bandera, temperatura, sensación, humedad, viento, precipitación, condición PGO, hora local, coordenadas con botón "📋" para copiar al portapapeles
- El botón de copia del popup se enlaza en el evento `popupopen` via `document.getElementById(popupId)`

**Función de hora local:** `new Date().toLocaleString('es-ES', { weekday:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone: timezone })`

### 8.4 `ListView`

**Props:** `{ cities, weatherData, sortBy }`

Ordena las ciudades con `.sort()` en dos niveles:
1. **Primero**: ciudades con condición activa (`isActive: true`) antes que las no activas
2. **Segundo** (según `sortBy`):
   - `'temperatura'`: descendente por `w.temperature`
   - `'hora'`: ascendente por hora local (`getLocalHour`)
   - `'condicion'`: `localeCompare` del tipo
   - `'nombre'` (default): `localeCompare` del nombre

Renderiza `city-card` para cada ciudad con:
- Nombre + flag + badge "EN VIVO" (si `isActive`)
- Icono PGO + label de condición
- Temperatura grande
- Tabla: sensación, humedad, viento, precipitación
- Hora local (`getLocalTime`)
- Coordenadas con botón copiar (`navigator.clipboard.writeText`)

La tarjeta recibe `style={{ '--card-color': color }}` para el borde izquierdo coloreado.

---

## 9. Diseño visual (`src/App.css`)

### 9.1 Variables CSS

```css
:root {
  --bg-primary:   #050a0f;  /* fondo general */
  --bg-secondary: #0a1520;  /* barra stats, filtros */
  --bg-card:      #0d1f2d;  /* tarjetas, inputs */
  --border:       #1a2d3f;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --accent:       #4299E1;  /* azul principal */
}
```

### 9.2 Tipografías (Google Fonts, preloaded en `index.html`)

- **Bebas Neue** — títulos (h1, nombres de ciudad, popup-city)
- **Space Mono** — datos numéricos (temperatura, stats, coords)
- **Inter** (300/400/500/600) — texto general

### 9.3 Fondos dinámicos por condición dominante

```css
.bg-SUNNY        { background: linear-gradient(180deg, #0a0805 0%, #1a1205 100%); }
.bg-PARTLY_CLOUDY{ background: linear-gradient(180deg, #050a0f 0%, #0f1520 100%); }
.bg-CLOUDY       { background: linear-gradient(180deg, #050a0f 0%, #101520 100%); }
.bg-RAIN         { background: linear-gradient(180deg, #050a0f 0%, #081525 100%); }
.bg-SNOW         { background: linear-gradient(180deg, #050a0f 0%, #0a1020 100%); }
.bg-FOG          { background: linear-gradient(180deg, #0a0510 0%, #150a20 100%); }
.bg-WINDY        { background: linear-gradient(180deg, #050f0a 0%, #0a2015 100%); }
.bg-default      { background: var(--bg-primary); }
```

### 9.4 Layout general

- `.app`: `display:flex; flex-direction:column; min-height:100vh`
- `.app-header`: sticky top 0, `backdrop-filter:blur(8px)`, z-index 100; flex entre título y controles
- Stats bar + Filters: fondos `--bg-secondary`, `border-bottom: 1px solid var(--border)`
- `.app-main`: flex:1 para ocupar el espacio restante

### 9.5 Vista de mapa

- `.map-wrapper`: flex:1, `min-height:500px`
- `.map-container`: `position:absolute; inset:0` (ocupa todo el wrapper)
- Override de Leaflet popup: `background: var(--bg-card)`, `color: var(--text-primary)`

### 9.6 Vista de lista

Grid responsivo:
```css
.list-view {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 20px 24px;
  overflow-y: auto;
}
@media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
@media (max-width: 600px) { grid-template-columns: 1fr; }
```

### 9.7 Animaciones CSS

| Nombre | Clase | Descripción |
|---|---|---|
| `spin` | `.loading-spinner` | Rotación continua del spinner de carga |
| `pulse-badge` | `.badge-live` | Parpadeo del badge "EN VIVO" (1.5s, 50% opacidad) |
| `fall-rain` | `.raindrop` | Caída vertical de gotas (translateY 0→105vh) |
| `fall-snow` | `.snowflake` | Caída con rotación 360° (0→105vh) |
| `spin-sun` | `.sun-rays` | Rotación lenta 0→360° en 20s |
| `pulse-marker-anim` | `.pulse-marker` | Pulso de opacidad en markers activos del mapa |

### 9.8 Loading overlay

Pantalla de carga semi-transparente (`z-index:9999`, `backdrop-filter:blur(4px)`) con:
- Spinner circular (borde CSS con `border-top-color: var(--accent)`)
- Texto "Obteniendo datos meteorológicos"
- Nombre de la ciudad/batch en proceso
- Porcentaje de progreso (formato `XX%` a 2rem, `Space Mono`)
- Barra de progreso gradiente (accent → púrpura)
- Mensaje de error inline (fondo rojo translúcido)

---

## 10. Función auxiliar `getLocalHour(timezone)`

Usada tanto en `App.jsx` como en `ListView.jsx`:

```js
function getLocalHour(timezone) {
  try {
    const str = new Date().toLocaleString('es-ES', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    });
    return parseInt(str, 10);
  } catch {
    return new Date().getHours();
  }
}
```

---

## 11. Configuración de herramientas

### `vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })
```

### `eslint.config.js` (flat config, ESLint 9)

- Extiende `@eslint/js` recommended + `react-hooks` + `react-refresh`
- `ecmaVersion: 2020`, `globals.browser`
- Regla personalizada: `no-unused-vars` ignora variables que empiezan con mayúscula (`^[A-Z_]`)

### `index.html`

- `lang="es"`
- Preconnect a `fonts.googleapis.com` y `fonts.gstatic.com`
- Google Fonts: Bebas Neue + Space Mono (400, 700) + Inter (300, 400, 500, 600)
- Título: `WEATHER FINDER`
- Único div: `<div id="root">`
- Script: `<script type="module" src="/src/main.jsx">`

---

## 12. Scripts npm

```json
"dev":     "vite",
"build":   "vite build",
"lint":    "eslint .",
"preview": "vite preview"
```

---

## 13. Flujo de ejecución completo

1. Carga `main.jsx` → monta `<App>` en `#root`
2. `App` inicializa `useState`, `DEFAULT_FILTERS`, el singleton `WeatherCache` (carga de `localStorage`)
3. `useEffect` → llama `fetchAllWeather()`:
   a. Consulta caché: separa ciudades con datos válidos de las que necesitan fetch
   b. Para cada batch de 20 ciudades: construye URL con lat/lon concatenados → `fetchWithRetry` → parsea respuesta → guarda en caché y en el `Map` de estado
   c. Si hay rate-limiting (429): espera exponencial
   d. Si hay error de batch: intenta sub-batches de 10, luego de 3
   e. Al terminar: `setWeatherData(newMap)`, `setLastUpdate(new Date())`, `setLoading(false)`
4. `useMemo` recalcula `filteredCities` y `dominantCondition` cuando cambian filtros o weatherData
5. Render: aplica clase `bg-{dominantCondition}` al wrapper, muestra animación de fondo correspondiente
6. Vista activa (`map` o `list`) recibe `filteredCities` + `weatherData`
7. `setInterval(600s)` repite el ciclo de fetch automáticamente

---

## 14. Notas para la recreación

- Los iconos PNG de Pokémon GO (archivos en `src/assets/images/`) deben incluirse tal cual; son los iconos oficiales del juego y son necesarios para el funcionamiento visual.
- La API Open-Meteo es gratuita y no requiere API key ni registro.
- El JSON de ciudades (`pokedensity-cities.json`) tiene 94 ubicaciones manualmente seleccionadas por densidad de PokéStops/Gyms; se puede ampliar o modificar manteniendo el esquema de campos.
- No hay tests unitarios en el proyecto original.
- No hay variables de entorno (`.env`); todas las constantes están en `App.jsx`.
- El proyecto no tiene `src/assets/react.svg` ni otros assets de la plantilla Vite predeterminada; solo los PNGs de clima.
