export interface LatLon {
  lat: number;
  lon: number;
}

/** Opposite point on Earth (Feature 16). */
export function antipode(lat: number, lon: number): LatLon {
  let oppositeLon = lon + 180;
  if (oppositeLon > 180) oppositeLon -= 360;
  if (oppositeLon <= -180) oppositeLon += 360;
  return { lat: -lat, lon: oppositeLon };
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres (Feature 15). */
export function haversineKm(a: LatLon, b: LatLon): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Human-readable distance for UI. */
export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

/** VPN/proxy heuristic threshold from requirements. */
export const GPS_IP_MISMATCH_KM = 50;
