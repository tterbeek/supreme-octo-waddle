import { expect,it } from 'vitest';
import { monthRange,dayRange,collectionNeighbors,memoryTitle } from './memories';
it('uses calendar boundaries including December and leap days',()=>{
 expect(monthRange('2024-12')).toEqual({start:'2024-12-01',end:'2025-01-01'});
 expect(dayRange('2024-02-29')).toEqual({start:'2024-02-29',end:'2024-03-01'});
});
it('browses distinct photo activities without wrapping or duplicate photos',()=>{
 expect(collectionNeighbors(['a','a','b','c'],'b')).toEqual({later:'a',earlier:'c',position:2,total:3});
 expect(collectionNeighbors(['a'],'a')).toEqual({later:null,earlier:null,position:1,total:1});
 expect(collectionNeighbors(['a'],'deleted').earlier).toBeNull();
});
it('preserves original titles with factual type fallback',()=>{
 expect(memoryTitle({title:' My words ',type:'walk'},'Walking')).toBe('My words');
 expect(memoryTitle({title:null,type:'walk'},'Walking')).toBe('Walking');
});
