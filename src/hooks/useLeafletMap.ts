import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { createMapTileLayer, hasCartoApiKey } from '../lib/mapTiles';

/** Reference-project viewport and tiles, with safe resize/unmount/error handling. */
export function useLeafletMap(isLight: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.TileLayer | null>(null);
  const frameRef = useRef<number | null>(null);
  const [tileError, setTileError] = useState(false);
  const missingKey = !hasCartoApiKey();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, {
      center: [22.3193, 114.1694],
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    });
    mapRef.current = map;
    const refreshViewport = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        if (container.clientWidth && container.clientHeight) map.invalidateSize();
      });
    };
    const observer = new ResizeObserver(refreshViewport);
    observer.observe(container);
    refreshViewport();
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = createMapTileLayer(map, isLight);
    layerRef.current = layer;
    setTileError(false);
    if (!layer) return;
    let batchFailed = false;
    const onLoading = () => { batchFailed = false; setTileError(false); };
    const onError = () => { batchFailed = true; setTileError(true); };
    const onLoad = () => {
      const tiles = layer.getContainer()?.querySelectorAll<HTMLImageElement>('img.leaflet-tile');
      const hasFailedTiles = tiles && Array.from(tiles).some(tile => tile.complete && tile.naturalWidth === 0);
      setTileError(batchFailed || Boolean(hasFailedTiles));
    };
    layer.on('loading', onLoading).on('tileerror', onError).on('load', onLoad);
    return () => {
      layer.off('loading', onLoading).off('tileerror', onError).off('load', onLoad);
      layer.remove();
      layerRef.current = null;
    };
  }, [isLight]);

  const retryTiles = useCallback(() => {
    setTileError(false);
    layerRef.current?.redraw();
  }, []);

  return { containerRef, mapRef, tileError, retryTiles, missingKey };
}
