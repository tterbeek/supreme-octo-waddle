import { decodeRoute, encodeRoute, type RoutePoint } from '../../supabase/functions/_shared/activityRoute';
import { mapboxStyle, mapboxToken } from './mapbox';

export const SHARE_ROUTE_HIDE_METRES = 500;
const EARTH_METRES = 6371000;
const radians = Math.PI / 180;

/** Subtract a start/finish privacy circle from a segment. A small buffer covers
 * projection/encoding rounding. Also removes later passes through those areas. */
function hiddenInterval(a: RoutePoint, b: RoutePoint, centre: RoutePoint): [number, number] | null {
  const scaleX = EARTH_METRES * radians * Math.cos(centre[0] * radians);
  const scaleY = EARTH_METRES * radians;
  const x = (a[1] - centre[1]) * scaleX, y = (a[0] - centre[0]) * scaleY;
  const dx = (b[1] - a[1]) * scaleX, dy = (b[0] - a[0]) * scaleY;
  const radius = SHARE_ROUTE_HIDE_METRES + 10;
  const A = dx * dx + dy * dy;
  const C = x * x + y * y - radius * radius;
  if (A === 0) return C <= 0 ? [0, 1] : null;
  const B = 2 * (x * dx + y * dy);
  const discriminant = B * B - 4 * A * C;
  if (discriminant < 0) return null;
  const start = Math.max(0, (-B - Math.sqrt(discriminant)) / (2 * A));
  const end = Math.min(1, (-B + Math.sqrt(discriminant)) / (2 * A));
  return end >= start ? [start, end] : null;
}

export function sharedRouteSegments(polyline: string, hideEndpoints = true): RoutePoint[][] {
  const points = decodeRoute(polyline);
  if (points.length < 2) return [];
  if (!hideEndpoints) return [points];
  // Do not guess across the antimeridian in this local projection.
  if (points.some((point, i) => i > 0 && Math.abs(point[1] - points[i - 1][1]) > 180)) return [];
  const centres = [points[0], points.at(-1)!];
  const parts: RoutePoint[][] = [];
  let current: RoutePoint[] = [];
  const flush = () => { if (current.length > 1) parts.push(current); current = []; };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    let visible: [number, number][] = [[0, 1]];
    for (const centre of centres) {
      const hidden = hiddenInterval(a, b, centre);
      if (!hidden) continue;
      visible = visible.flatMap(([start, end]) => {
        if (hidden[1] <= start || hidden[0] >= end) return [[start, end]];
        const remaining: [number, number][] = [];
        if (start < hidden[0]) remaining.push([start, hidden[0]]);
        if (end > hidden[1]) remaining.push([hidden[1], end]);
        return remaining;
      });
    }
    const interpolate = (t: number): RoutePoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (!visible.length) { flush(); continue; }
    for (const [start, end] of visible) {
      if (end - start < 1e-9) continue;
      if (start > 0) flush();
      const first = interpolate(start), last = interpolate(end);
      if (!current.length) current.push(first);
      current.push(last);
      if (end < 1) flush();
    }
  }
  flush();
  return parts;
}

/** Only visible geometry reaches Mapbox. Disjoint pieces stay disjoint. */
export function sharedRouteMapUrl(polyline: string, hideEndpoints = true, token = mapboxToken, style = mapboxStyle): string | null {
  if (!token.startsWith('pk.') || !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(style)) return null;
  const paths = sharedRouteSegments(polyline, hideEndpoints).flatMap(part => {
    // Do not let encodeRoute simplify a clipped piece and reconnect across a
    // hidden area. Split long pieces with one shared endpoint instead.
    const chunks: RoutePoint[][] = [];
    for (let i = 0; i < part.length - 1; i += 249) chunks.push(part.slice(i, i + 250));
    return chunks;
  }).map(part => encodeRoute(part)).filter(Boolean)
    .map(route => `path-4+E48A6C-0.98(${encodeURIComponent(route!)})`);
  if (!paths.length) return null;
  const url = new URL(`https://api.mapbox.com/styles/v1/${style}/static/${paths.join(',')}/auto/1080x720@2x`);
  url.searchParams.set('padding', '60'); url.searchParams.set('access_token', token);
  // Keep Mapbox's baked-in logo and attribution in the exported image.
  return url.toString().length <= 8192 ? url.toString() : null;
}
