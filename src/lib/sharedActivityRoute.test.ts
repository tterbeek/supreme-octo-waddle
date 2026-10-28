import { describe, expect, it } from 'vitest';
import { decodeRoute, encodeRoute, type RoutePoint } from '../../supabase/functions/_shared/activityRoute';
import { sharedRouteMapUrl, sharedRouteSegments } from './sharedActivityRoute';

function distance(a: RoutePoint, b: RoutePoint) {
  const r = Math.PI / 180;
  const h = Math.sin((a[0] - b[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((a[1] - b[1]) * r / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}
function expectHidden(parts: RoutePoint[][], original: RoutePoint[]) {
  expect(parts.length).toBeGreaterThan(0);
  for (const part of parts) for (let i = 1; i < part.length; i++) {
    for (let j = 0; j <= 50; j++) {
      const point: RoutePoint = [part[i - 1][0] + (part[i][0] - part[i - 1][0]) * j / 50, part[i - 1][1] + (part[i][1] - part[i - 1][1]) * j / 50];
      expect(distance(point, original[0])).toBeGreaterThanOrEqual(500);
      expect(distance(point, original.at(-1)!)).toBeGreaterThanOrEqual(500);
    }
  }
}
describe('map sharing privacy', () => {
  it('hides both ends by default before the map URL is constructed', () => {
    const points: RoutePoint[] = [[50, 4], [50.02, 4], [50.04, 4]];
    const route = encodeRoute(points)!;
    expectHidden(sharedRouteSegments(route), points);
    const url = sharedRouteMapUrl(route, true, 'pk.fixture')!;
    const encodedPaths = [...decodeURIComponent(new URL(url).pathname).matchAll(/path-4\+E48A6C-0\.98\(([^)]+)\)/g)].map(match => decodeRoute(match[1]));
    expectHidden(encodedPaths, points);
    expect(url).not.toContain(encodeURIComponent(route));
    expect(new URL(url).searchParams.get('attribution')).not.toBe('false');
    expect(new URL(url).searchParams.get('logo')).not.toBe('false');
  });
  it('preserves the full route only when hiding is explicitly off', () => {
    const points: RoutePoint[] = [[50, 4], [50.02, 4], [50.04, 4]];
    const route = encodeRoute(points)!;
    expect(sharedRouteSegments(route, false)).toEqual([points]);
    expect(sharedRouteMapUrl(route, false, 'pk.fixture')).toContain(encodeURIComponent(route));
    expect(decodeRoute(route)).toEqual(points);
  });
  it('removes return visits and sparse segments crossing either hidden area without reconnecting them', () => {
    for (const points of [
      [[50, 4], [50.02, 4], [50.02, 4.02], [50, 4], [50.02, 4], [50.04, 4]],
      [[50, 4], [50.02, 4.02], [49.98, 3.98], [50.04, 4]],
      [[85, 4], [85.02, 4.02], [84.98, 3.98], [85.04, 4]],
    ] as RoutePoint[][]) {
      const parts = sharedRouteSegments(encodeRoute(points)!);
      expect(parts.length).toBeGreaterThan(1);
      expectHidden(parts, points);
    }
  });
  it('does not silently reveal a short route or guess at an invalid/dateline route', () => {
    const short = encodeRoute([[50, 4], [50.001, 4]])!;
    expect(sharedRouteSegments(short)).toEqual([]);
    expect(sharedRouteMapUrl(short, true, 'pk.fixture')).toBeNull();
    expect(sharedRouteMapUrl(short, false, 'pk.fixture')).toBeTruthy();
    expect(sharedRouteSegments('broken')).toEqual([]);
    expect(sharedRouteSegments(encodeRoute([[50, 179.99], [50, -179.99]])!)).toEqual([]);
    expect(sharedRouteMapUrl(short, false, 'sk.secret')).toBeNull();
  });
});
