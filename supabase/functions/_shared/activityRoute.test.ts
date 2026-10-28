import { describe, expect, it } from 'vitest';
import { decodeRoute, encodeRoute, polarRoutePolyline } from './activityRoute';

describe('route previews', () => {
  it('round-trips standard encoded polylines', () => {
    const points: [number, number][] = [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]];
    expect(encodeRoute(points)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodeRoute(encodeRoute(points))).toEqual(points);
  });
  it('rejects malformed coordinates, incomplete strings and single-point routes', () => {
    expect(encodeRoute([[NaN, 4], [91, 4], [50, 200], [50, 4]])).toBeNull();
    expect(decodeRoute('_')).toEqual([]);
    expect(decodeRoute('bad route')).toEqual([]);
    expect(decodeRoute('x'.repeat(5001))).toEqual([]);
    expect(encodeRoute([[50, 4], [50, 4]])).toBeNull();
    expect(encodeRoute([[50, 4], [50.00000001, 4.00000001]])).toBeNull();
  });
  it('bounds large previews while retaining their endpoints', () => {
    const points = Array.from({ length: 20000 }, (_, i) => [50 + i / 1e6, 4 + i / 1e6]);
    const route = decodeRoute(encodeRoute(points));
    expect(route).toHaveLength(250);
    expect(route[0]).toEqual([50, 4]);
    expect(route.at(-1)).toEqual([50.02, 4.02]);
  });
  it('extracts the recorded Polar track rather than a planned route or single location', () => {
    expect(decodeRoute(polarRoutePolyline({ routes: { route: { wayPoints: [{ latitude: 50, longitude: 4 }, { latitude: 50.01, longitude: 4.01 }] } } }))).toEqual([[50, 4], [50.01, 4.01]]);
    expect(polarRoutePolyline({})).toBeNull();
    expect(decodeRoute(polarRoutePolyline({ exercises: [{ routes: { route: { wayPoints: [{ latitude: 50, longitude: 4 }, { latitude: 50.02, longitude: 4.02 }] } } }] }))).toEqual([[50, 4], [50.02, 4.02]]);
  });
});
