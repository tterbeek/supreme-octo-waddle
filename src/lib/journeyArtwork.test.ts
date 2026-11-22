import {describe,it,expect} from 'vitest';
import {curatedJourneys} from './curatedJourneys';
import {journeyArtworkUrl} from './journeyArtwork';
import {decodeRoute} from '../../supabase/functions/_shared/activityRoute';
describe('static curated map artwork',()=>{
 it.each(curatedJourneys.map(t=>[t.slug,t] as const))('%s has a valid bounded URL for its entire route',(_slug,t)=>{
  const value=journeyArtworkUrl(t,'pk.fixture','mapbox/light-v11');expect(value).not.toBeNull();
  const url=new URL(value!);expect(url.hostname).toBe('api.mapbox.com');expect(value!.length).toBeLessThanOrEqual(8192);
  expect(value).toContain('/720x330@2x');expect(value).toContain('E48A6C');
  expect(url.searchParams.has('logo')).toBe(false);expect(url.searchParams.has('attribution')).toBe(false);
  expect(url.searchParams.has('timestamp')).toBe(false);expect(value).toBe(journeyArtworkUrl({...t},'pk.fixture','mapbox/light-v11'));
 });
 it('splits Pacific geometry rather than drawing a chord through Europe',()=>{
  const t=curatedJourneys.find(t=>t.slug==='around-the-world')!;
  const path=new URL(journeyArtworkUrl(t,'pk.fixture')!).pathname;
  const segments=[...path.matchAll(/path-3\+E48A6C-0.95\(([^)]+)\)/g)].map(m=>decodeRoute(decodeURIComponent(m[1])));
  expect(segments.length).toBeGreaterThan(1);
  for(const line of segments)for(let i=1;i<line.length;i++)expect(Math.abs(line[i][1]-line[i-1][1])).toBeLessThanOrEqual(180);
  expect(path).toContain('[-180,');
 });
 it('preserves every destination and uses the same image independently of progress and units',()=>{
  const t=curatedJourneys[0];const url=journeyArtworkUrl(t,'pk.fixture')!;
  for(const w of t.waypoints)expect(url).toContain(`(${w.coordinate[0]},${w.coordinate[1]})`);
  expect(url).not.toMatch(/total|progress|mine|units|user_id/);
 });
 it('fails safely for missing/private tokens and unsupported or arbitrary style URLs',()=>{
  const t=curatedJourneys[0];expect(journeyArtworkUrl(t,'')).toBeNull();expect(journeyArtworkUrl(t,'sk.private')).toBeNull();
  expect(journeyArtworkUrl(t,'pk.fixture','https://elsewhere.invalid')).toBeNull();
  expect(journeyArtworkUrl(t,'pk.fixture','mapbox/standard')).toBeNull();
  expect(journeyArtworkUrl(t,'pk.fixture','movenotes/calm')).toContain('/movenotes/calm/static/');
 });
});
