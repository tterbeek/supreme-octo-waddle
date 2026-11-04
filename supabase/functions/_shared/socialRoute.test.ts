import { describe, expect, it, vi } from 'vitest';
import { createSocialRouteHandler } from './socialRoute';
import { encodeRoute, type RoutePoint } from './activityRoute';
import { sharedRouteSegments } from './sharedActivityRoute';
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const points:RoutePoint[]=[[50,4],[50.02,4],[50.04,4]];
const route=encodeRoute(points)!;
const request=(body:unknown={activity:id},authorization='Bearer fictional')=>new Request('https://fixture.test/social-route',{
 method:'POST',headers:authorization?{Authorization:authorization}:{},body:JSON.stringify(body),
});
describe('protected social route boundary',()=>{
 it('only returns clipped segments and never the raw route or endpoints',async()=>{
  const deps={viewer:vi.fn().mockResolvedValue('verified-viewer'),route:vi.fn().mockResolvedValue(route)};
  const response=await createSocialRouteHandler(deps)(request({activity:id,viewer:'forged-viewer'}));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const data=await response.json();
  expect(data).toEqual({segments:sharedRouteSegments(route,true)});
  expect(data).not.toHaveProperty('polyline');
  expect(data.segments.flat()).not.toContainEqual(points[0]);
  expect(data.segments.flat()).not.toContainEqual(points.at(-1));
  expect(deps.route).toHaveBeenCalledWith(id,'verified-viewer');
 });
 it('requires valid authentication and activity IDs before accessing geometry',async()=>{
  const deps={viewer:vi.fn().mockResolvedValue(null),route:vi.fn()};
  const handler=createSocialRouteHandler(deps);
  expect((await handler(request({},''))).status).toBe(401);
  expect((await handler(request())).status).toBe(401);
  deps.viewer.mockResolvedValue('verified');
  expect((await handler(request({activity:'invalid'}))).status).toBe(400);
  expect(deps.route).not.toHaveBeenCalled();
 });
 it('denies unshared, blocked or unconsented data and never falls back to the full route',async()=>{
  const deps={viewer:vi.fn().mockResolvedValue('viewer'),route:vi.fn().mockResolvedValue(null)};
  const handler=createSocialRouteHandler(deps);
  expect((await handler(request())).status).toBe(404);
  deps.route.mockResolvedValue(encodeRoute([[50,4],[50.001,4]]));
  const response=await handler(request());
  expect(response.status).toBe(404);
  expect(await response.text()).not.toContain('segments');
 });
 it('uses the same clipping for loops and sparse crossings as Share other',async()=>{
  const loop:RoutePoint[]=[[50,4],[50.03,4],[50,4],[50.03,4.02],[50,4]];
  const encoded=encodeRoute(loop)!;
  const handler=createSocialRouteHandler({viewer:async()=> 'viewer',route:async()=>encoded});
  const result=await (await handler(request())).json();
  expect(result.segments).toEqual(sharedRouteSegments(encoded,true));
  expect(result.segments.length).toBeGreaterThan(1);
 });
});
