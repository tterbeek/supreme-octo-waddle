import { decodeRoute, encodeRoute } from '../../supabase/functions/_shared/activityRoute';

export const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
export const mapboxStyle = import.meta.env.VITE_MAPBOX_STYLE || 'mapbox/outdoors-v12';

export function routeMapUrl(polyline: unknown, token = mapboxToken, style = mapboxStyle, large = false): string | null {
  if (!token.startsWith('pk.') || !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(style)) return null;
  const points = decodeRoute(polyline);
  if (points.length < 2) return null;
  const route = encodeRoute(points);
  const url = new URL(`https://api.mapbox.com/styles/v1/${style}/static/path-4+E48A6C-0.98(${encodeURIComponent(route!)})/auto/${large ? '1024x640' : '640x360@2x'}`);
  url.searchParams.set('padding', '35');
  url.searchParams.set('access_token', token);
  // Keep Mapbox's logo/attribution and a stable URL for browser HTTP caching.
  return url.toString().length <= 8192 ? url.toString() : null;
}
