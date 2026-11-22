import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {curatedJourneys} from '../../../src/lib/curatedJourneys';
import {buildJourney,journeyGeometry,journeyPosition,interpolateGeodesic,greatCircleKm} from './journeyGeometry';
describe('curated route catalog',()=>{
 it('contains ten valid reproducible routes with derived, not rounded, targets',()=>{
  expect(curatedJourneys).toHaveLength(10);expect(new Set(curatedJourneys.map(t=>t.slug)).size).toBe(10);
  for(const t of curatedJourneys){const fresh=buildJourney(t);expect(fresh.targetKm).toBe(t.targetKm);expect(fresh.waypoints).toEqual(t.waypoints);expect(t.waypoints[0].cumulativeKm).toBe(0);for(let i=1;i<t.waypoints.length;i++)expect(t.waypoints[i].cumulativeKm).toBeGreaterThan(t.waypoints[i-1].cumulativeKm);}
 });
 it('agrees with the handover distance checks',()=>{
  expect(curatedJourneys.map(t=>Number(t.targetKm.toFixed(1)))).toEqual([436.9,582.3,682.6,899.3,1409.9,1638.5,1904.4,2554.1,4266.3,39099.9]);
 });
 it('pins exactly the bundled catalog into idempotent SQL seeds',()=>{
  const seed=readFileSync(new URL('../../journey-catalog-seed.sql',import.meta.url),'utf8');
  const migration=readFileSync(new URL('../../migrations/20261105030000_curated_map_challenges.sql',import.meta.url),'utf8');
  expect(migration).toContain(seed);expect(seed.match(/on conflict\(slug,version\) do nothing/g)).toHaveLength(10);
  for(const t of curatedJourneys)expect(seed).toContain(JSON.stringify(t).replaceAll("'","''"));
 });
});
describe('geodesic progress, never vertex-count progress',()=>{
 for(const t of curatedJourneys)it(t.slug+' splits line and marker at the same location',()=>{
  const firstLeg=t.waypoints[1].cumulativeKm;
  for(const km of [0,firstLeg/2,firstLeg,t.targetKm/2,t.targetKm,t.targetKm+50]){
   const g=journeyGeometry(t,km),p=g.position.coordinate;
   if(km>0){const end=g.completed.at(-1)!.at(-1)!;expect(greatCircleKm(end,p)).toBeLessThan(1e-7);}
   if(km<t.targetKm)expect(greatCircleKm(g.remaining[0][0],p)).toBeLessThan(1e-7);
   if(km===0)expect(g.completed).toEqual([]);if(km>=t.targetKm)expect(g.remaining).toEqual([]);
  }
  expect(journeyPosition(t,firstLeg/2).coordinate).toEqual(interpolateGeodesic(t.waypoints[0].coordinate,t.waypoints[1].coordinate,.5));
 });
 it('handles loops with distinct start and finish occurrences',()=>{
  const t=curatedJourneys.find(t=>t.slug==='around-the-world')!;
  expect(t.waypoints[0].placeId).toBe(t.waypoints.at(-1)!.placeId);
  expect(t.waypoints[0].occurrenceId).not.toBe(t.waypoints.at(-1)!.occurrenceId);
  expect(journeyPosition(t,0).reached.at(-1)).toBe(false);expect(journeyPosition(t,t.targetKm).reached.at(-1)).toBe(true);
 });
 it('crosses the Pacific on the short geodesic and splits the antimeridian',()=>{
  const t=curatedJourneys.find(t=>t.slug==='around-the-world')!,g=journeyGeometry(t,0);
  expect(g.whole.length).toBeGreaterThan(1);
  for(const line of g.whole)for(let i=1;i<line.length;i++)expect(Math.abs(line[i][0]-line[i-1][0])).toBeLessThanOrEqual(180);
  expect(g.whole.some(line=>line.some(p=>Math.abs(p[0])===180))).toBe(true);
  const midpoint=interpolateGeodesic([151.2093,-33.8688],[-122.4194,37.7749],.5);expect(Math.abs(midpoint[0])).toBeGreaterThan(160);
  expect(journeyGeometry(curatedJourneys[0],0).bounds[1][0]-journeyGeometry(curatedJourneys[0],0).bounds[0][0]).toBeLessThan(5);
 });
 it('rejects duplicate occurrences, consecutive duplicate points and invalid coordinates',()=>{
  const t=curatedJourneys[0];expect(()=>buildJourney({...t,waypoints:[t.waypoints[0],t.waypoints[0]]})).toThrow();
  expect(()=>buildJourney({...t,waypoints:[t.waypoints[0],{...t.waypoints[1],coordinate:[181,20]}]})).toThrow();
 });
 it('moves backwards on withdrawal and clamps overshoot without looping',()=>{
  const t=curatedJourneys[0];expect(journeyPosition(t,t.targetKm+20).extraKm).toBe(20);
  expect(journeyPosition(t,t.targetKm).reached.every(Boolean)).toBe(true);
  expect(journeyPosition(t,0).reached.filter(Boolean)).toHaveLength(1);
 });
});
