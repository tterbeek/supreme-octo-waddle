export type RoutePoint = [number, number]; // latitude, longitude

export function validRoutePoint(value: unknown): value is RoutePoint {
  return Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number' && Number.isFinite(n))
    && Math.abs(value[0]) <= 85.0511 && Math.abs(value[1]) <= 180;
}

/** Bounded previews only; raw GPS samples and timestamps are not retained. */
export function encodeRoute(points: unknown[]): string | null {
  const valid = points.filter(validRoutePoint).map(([lat, lng]): RoutePoint => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5])
    .filter((point, i, all) => !i || point[0] !== all[i - 1][0] || point[1] !== all[i - 1][1]);
  if (valid.length < 2) return null;
  const selected = valid.length > 250 ? Array.from({ length: 250 }, (_, i) => valid[Math.round(i * (valid.length - 1) / 249)]) : valid;
  let lastLat = 0, lastLng = 0, result = '';
  const encode = (delta: number) => {
    let value = delta < 0 ? ~(delta << 1) : delta << 1;
    let text = '';
    while (value >= 32) { text += String.fromCharCode((32 | (value & 31)) + 63); value >>>= 5; }
    return text + String.fromCharCode(value + 63);
  };
  for (const [lat, lng] of selected) {
    const nextLat = Math.round(lat * 1e5), nextLng = Math.round(lng * 1e5);
    result += encode(nextLat - lastLat) + encode(nextLng - lastLng);
    lastLat = nextLat; lastLng = nextLng;
  }
  return result;
}

export function decodeRoute(value: unknown): RoutePoint[] {
  if (typeof value !== 'string' || value.length > 5000) return [];
  const points: RoutePoint[] = []; let index = 0, lat = 0, lng = 0;
  const read = () => {
    let result = 0, shift = 0, digit: number;
    do {
      if (index >= value.length || shift > 30) throw new Error('Invalid polyline');
      digit = value.charCodeAt(index++) - 63;
      if (digit < 0 || digit > 63) throw new Error('Invalid polyline');
      result |= (digit & 31) << shift; shift += 5;
    } while (digit >= 32);
    return result & 1 ? ~(result >>> 1) : result >>> 1;
  };
  try {
    while (index < value.length) {
      lat += read(); lng += read();
      const point: RoutePoint = [lat / 1e5, lng / 1e5];
      if (!validRoutePoint(point)) return [];
      points.push(point);
      if (points.length > 10000) return [];
    }
  } catch { return []; }
  return points.length > 1 ? points : [];
}

type PolarRecordedRoute = { route?: { wayPoints?: { latitude?: number; longitude?: number }[] } };
export function polarRoutePolyline(session: { routes?: PolarRecordedRoute; exercises?: { routes?: PolarRecordedRoute }[] }): string | null {
  const points = session.routes?.route?.wayPoints?.length
    ? session.routes.route.wayPoints
    : (session.exercises || []).flatMap(exercise => exercise.routes?.route?.wayPoints || []);
  return encodeRoute(points.map(p => [p.latitude, p.longitude]));
}
