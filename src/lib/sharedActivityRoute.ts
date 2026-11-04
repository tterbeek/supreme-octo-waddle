import { encodeRoute, validRoutePoint, type RoutePoint } from '../../supabase/functions/_shared/activityRoute';
import { sharedRouteSegments } from '../../supabase/functions/_shared/sharedActivityRoute';
export { sharedRouteSegments, SHARE_ROUTE_HIDE_METRES } from '../../supabase/functions/_shared/sharedActivityRoute';
import { mapboxStyle, mapboxToken } from './mapbox';

/** Only visible geometry reaches Mapbox. Disjoint pieces stay disjoint. */
export function sharedRouteMapUrl(polyline: string, hideEndpoints = true, token = mapboxToken, style = mapboxStyle): string | null {
  return sharedSegmentsMapUrl(sharedRouteSegments(polyline, hideEndpoints), token, style);
}

/** Takes already-protected geometry; never rejoins pieces across hidden areas. */
export function sharedSegmentsMapUrl(segments: RoutePoint[][], token = mapboxToken, style = mapboxStyle): string | null {
  if (!Array.isArray(segments) || segments.some(part => !Array.isArray(part) || part.some(point => !validRoutePoint(point)))) return null;
  if (!token.startsWith('pk.') || !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(style)) return null;
  const paths = segments.flatMap(part => {
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
