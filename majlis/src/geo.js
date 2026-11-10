const EARTH_RADIUS_M = 6_371_000;
const rad = (deg) => (deg * Math.PI) / 180;

export function distanceMeters(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Straight-line distance understates real streets; 1.3 is a common detour factor for city grids.
export const WALK = { speedMps: 1.25, detour: 1.3, maxMeters: 800 };

export function walkSeconds(a, b, walk = WALK) {
  return Math.round((distanceMeters(a, b) * walk.detour) / walk.speedMps);
}

export function nearbyStops(point, stops, walk = WALK) {
  const out = [];
  stops.forEach((stop, index) => {
    const meters = distanceMeters(point, stop);
    if (meters <= walk.maxMeters) out.push({ stop: index, seconds: Math.round((meters * walk.detour) / walk.speedMps) });
  });
  return out;
}
