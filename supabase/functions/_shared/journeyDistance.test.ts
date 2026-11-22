import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { calculateJourneyContribution as calculate,resolveJourneyBike,JOURNEY_POLICY,targetToKm } from './journeyDistance';
describe('cycling-baseline virtual-distance policy',()=>{
 it.each(['ride','run','swim','strength','walk','yoga','hike','meditation','restore','other','custom'])('%s: an hour without distance adds eighteen virtual km',activityType=>{
  expect(calculate({activityType,durationMinutes:60,effort:3}).rawJourneyKm).toBe('18.000000000000');
 });
 it.each([['ride',18,'conventional',18],['ride',22,'electric',11],['run',8,'not_applicable',18],['swim',2,'not_applicable',18],['walk',4.5,'not_applicable',18]] as const)
 ('distance-first %s %s km resolves %s', (activityType,distanceKm,mode,expected)=>{
  const result=calculate({activityType,distanceKm,bike:{mode,source:'import'}});
  expect(result.basis).toBe('recorded_distance');expect(Number(result.rawJourneyKm)).toBe(expected);
 });
 it('does not reduce a run for finishing sooner, adding time or choosing easier effort',()=>{
  for(const durationMinutes of [null,20,42,60,90])for(const effort of [null,1,2,3,4,5,0,'hard',NaN]){
   const c=calculate({activityType:'run',distanceKm:5,durationMinutes,effort});
   expect(c.rawJourneyKm).toBe('11.250000000000');expect(c.recordedDistanceKm).toBe('5.000000000000');
   expect(c.distanceMultiplier).toBe('2.25');expect(c.effortSource).toBe('not_used');
  }
 });
 it('keeps normal cycling at baseline and discounts electric cycling independently of effort',()=>{
  for(const mode of ['conventional','electric','unknown'] as const)for(const effort of [null,1,5]){
   expect(calculate({activityType:'ride',distanceKm:30,durationMinutes:60,effort,bike:{mode,source:'equipment'}}).rawJourneyKm).toBe(mode==='electric'?'15.000000000000':'30.000000000000');
   expect(calculate({activityType:'ride',durationMinutes:60,effort,bike:{mode,source:'equipment'}}).rawJourneyKm).toBe(mode==='electric'?'9.000000000000':'18.000000000000');
  }
 });
 it.each(['strength','custom','yoga'])('uses time or participation without inventing distance for %s',activityType=>{
  expect(calculate({activityType,distanceKm:100}).basis).toBe('participation');
  expect(calculate({activityType,distanceKm:100,durationMinutes:24}).rawJourneyKm).toBe('7.200000000000');
 });
 it.each([-1,Infinity,NaN,'NaN','bad','',1e100])('invalid measurement %s cannot earn participation',durationMinutes=>{
  const c=calculate({activityType:'run',durationMinutes});expect(c.basis).toBe('invalid');expect(Number(c.rawJourneyKm)).toBe(0);
 });
 it('handles zero measurements as missing and retains the daily participation allocation',()=>{
  expect(calculate({activityType:'run',distanceKm:0,durationMinutes:10}).rawJourneyKm).toBe('3.000000000000');
  expect(calculate({activityType:'run',distanceKm:0,durationMinutes:0}).basis).toBe('participation');
  expect(JOURNEY_POLICY.participationKmPerDay).toBe('1');
 });
 it('keeps fixed precision and canonical target conversion',()=>{
  expect(calculate({activityType:'run',durationMinutes:1}).rawJourneyKm).toBe('0.300000000000');
  expect(targetToKm('1',true)).toBe('1.609344000000');
  expect(targetToKm('1.25',true)).toBe('2.011680000000');
  expect(targetToKm('bad',true)).toBeNull();
 });
});
describe('bike resolution without guessing from names or performance',()=>{
 it('uses equipment before explicit integration subtype',()=>{
  expect(resolveJourneyBike({type:'ride',bikes:[{category:'bike',electric_assist:'electric'}],sportSubtype:'Ride'})).toEqual({mode:'electric',source:'equipment'});
  expect(resolveJourneyBike({type:'ride',sportSubtype:'EBikeRide'})).toEqual({mode:'electric',source:'import'});
  expect(resolveJourneyBike({type:'ride',sportSubtype:'Ride'})).toEqual({mode:'conventional',source:'import'});
 });
 it('preserves unknown and conflicting bikes instead of inferring assistance',()=>{
  expect(resolveJourneyBike({type:'ride',bikes:[{category:'bike',electric_assist:'electric'},{category:'bike',electric_assist:'none'}],sportSubtype:'EBikeRide'})).toEqual({mode:'unknown',source:'conflicting_bikes'});
  expect(resolveJourneyBike({type:'ride',bikes:[{category:'shoes',electric_assist:null}]})).toEqual({mode:'unknown',source:'unspecified'});
  expect(resolveJourneyBike({type:'swim'})).toEqual({mode:'not_applicable',source:null});
 });
});

it('seeds the immutable SQL policy from the canonical versioned configuration',()=>{
 const migration=readFileSync(new URL('../../migrations/20261105000000_virtual_distance.sql',import.meta.url),'utf8');
 const seed=migration.match(/'journey-distance-v1',\s*'([^']+)'::jsonb/);
 expect(seed).not.toBeNull();expect(JSON.parse(seed![1])).toEqual(JOURNEY_POLICY);
});
