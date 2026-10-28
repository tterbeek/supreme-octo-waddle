import { describe, expect, it } from 'vitest';
import { routeMapUrl } from './mapbox';
const route = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
describe('Mapbox route images', () => {
  it('uses stable Outdoors URLs, encoded routes, coral styling and attribution', () => {
    const url = routeMapUrl(route, 'pk.fictional');
    expect(url).toBe(routeMapUrl(route, 'pk.fictional'));
    expect(url).toContain('mapbox/outdoors-v12/static/path-4+E48A6C');
    expect(decodeURIComponent(new URL(url!).pathname)).toContain(`path-4+E48A6C-0.98(${route})`);
    expect(url).toContain('/auto/640x360@2x');
    expect(new URL(url!).searchParams.get('attribution')).not.toBe('false');
    expect(new URL(url!).searchParams.get('logo')).not.toBe('false');
    expect(url!.length).toBeLessThan(8192);
  });
  it('supports custom styles and larger maps without trusting arbitrary hosts', () => {
    expect(routeMapUrl(route, 'pk.fictional', 'movenotes/cream', true)).toContain('movenotes/cream/static/');
    expect(routeMapUrl(route, 'pk.fictional', 'movenotes/cream', true)).toContain('1024x640');
    expect(routeMapUrl(route, 'pk.fictional', 'https://other.example')).toBeNull();
  });
  it('requires a public token and a valid route', () => {
    expect(routeMapUrl(route, '')).toBeNull();
    expect(routeMapUrl(route, 'sk.private')).toBeNull();
    expect(routeMapUrl('broken', 'pk.fictional')).toBeNull();
  });
});
