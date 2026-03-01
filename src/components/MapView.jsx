import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { CONDITION_COLORS } from '../weatherUtils';

export default function MapView({ cities, weatherData }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    let L;
    let map;

    async function initMap() {
      L = (await import('leaflet')).default;

      if (mapInstanceRef.current) return;

      map = L.map(mapRef.current, {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    async function updateMarkers() {
      if (!mapInstanceRef.current) return;
      const L = (await import('leaflet')).default;

      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      cities.forEach(city => {
        const w = weatherData.get(city.id);
        const condition = w?.condition;
        const color = condition ? CONDITION_COLORS[condition.type] : '#718096';
        const isActive = condition?.isActive;

        const marker = L.circleMarker([city.lat, city.lon], {
          radius: isActive ? 9 : 7,
          fillColor: color,
          color: isActive ? '#fff' : color,
          weight: isActive ? 2 : 1,
          opacity: 1,
          fillOpacity: 0.9,
          className: isActive ? 'pulse-marker' : '',
        });

        let localTime = '--';
        try {
          localTime = new Date().toLocaleString('es-ES', {
            timeZone: city.timezone,
            weekday: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch { /* use fallback */ }

        const coords = `${city.lat.toFixed(6)},${city.lon.toFixed(6)}`;
        const popupId = `copy-btn-${city.id}`;

        marker.bindPopup(`
          <div class="map-popup">
            <div class="popup-city">${condition?.icon || ''} ${city.name}, ${city.country}</div>
            <div class="popup-temp">${w?.temperature != null ? w.temperature.toFixed(1) + '°C' : '--'}</div>
            <div class="popup-row">Sensación: ${w?.feelsLike != null ? w.feelsLike.toFixed(1) + '°C' : '--'}</div>
            <div class="popup-row">Humedad: ${w?.humidity != null ? w.humidity + '%' : '--'}</div>
            <div class="popup-row">Viento: ${w?.windspeed != null ? w.windspeed.toFixed(1) + ' km/h' : '--'}</div>
            <div class="popup-row">Precipitación: ${w?.precipitation != null ? w.precipitation + ' mm' : '--'}</div>
            <div class="popup-row popup-condition" style="color:${color}">${condition?.label || '--'}</div>
            <div class="popup-row popup-time">🕐 ${localTime}</div>
            <div class="popup-row popup-coords">
              <span>📍 ${coords}</span>
              <button class="popup-copy-btn" id="${popupId}" title="Copiar coordenadas">📋</button>
            </div>
          </div>
        `);

        marker.on('popupopen', () => {
          const btn = document.getElementById(popupId);
          if (btn) {
            btn.onclick = () => navigator.clipboard.writeText(coords);
          }
        });

        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
      });
    }

    updateMarkers();
  }, [cities, weatherData]);

  return (
    <div className="map-wrapper">
      <div ref={mapRef} className="map-container" />
    </div>
  );
}
