export interface GeographicCoordinates {
  latitude: number | null;
  longitude: number | null;
}

/** Leaflet uses Web Mercator; missing/invalid coordinates must not become fake pins. */
export function hasMapCoordinates<T extends GeographicCoordinates>(site: T): site is T & { latitude: number; longitude: number } {
  return typeof site.latitude === 'number' && Number.isFinite(site.latitude)
    && typeof site.longitude === 'number' && Number.isFinite(site.longitude)
    && Math.abs(site.latitude) <= 85.0511287798
    && Math.abs(site.longitude) <= 180;
}

/** The existing floor-plan renderer expects percentages, not geographic coordinates. */
export function hasFloorPlanCoordinates<T extends { position_x: number | null; position_y: number | null }>(device: T): device is T & { position_x: number; position_y: number } {
  return typeof device.position_x === 'number' && Number.isFinite(device.position_x)
    && typeof device.position_y === 'number' && Number.isFinite(device.position_y)
    && device.position_x >= 0 && device.position_x <= 100
    && device.position_y >= 0 && device.position_y <= 100;
}
