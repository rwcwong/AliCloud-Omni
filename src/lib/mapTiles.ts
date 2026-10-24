import L from 'leaflet';

export function hasCartoApiKey(): boolean {
  return Boolean(import.meta.env.VITE_CARTO_API_KEY?.trim());
}

/** Same basemaps as OmniOS-main-1008; never request watermarked, keyless tiles. */
export function createMapTileLayer(map: L.Map, isLight: boolean): L.TileLayer | null {
  const cartoKey = import.meta.env.VITE_CARTO_API_KEY?.trim();
  if (!cartoKey) return null;
  const cartoPath = isLight ? 'rastertiles/voyager' : 'dark_all';
  const cartoUrl = `https://{s}.basemaps.cartocdn.com/${cartoPath}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`;

  return L.tileLayer(cartoUrl, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    crossOrigin: true,
  }).addTo(map);
}
