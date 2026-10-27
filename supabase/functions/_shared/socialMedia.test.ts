import {expect,it,vi} from 'vitest';
import {createSocialMediaHandler} from './socialMedia';
const request=(body:unknown)=>new Request('https://local.test/social-media',{method:'POST',headers:{Authorization:'Bearer fictional-token','Content-Type':'application/json'},body:JSON.stringify(body)});
it('rejects unauthenticated callers before resolving or signing media',async()=>{
 const sign=vi.fn();const handler=createSocialMediaHandler({viewer:async()=>null,sign});
 expect((await handler(request({context:'c',photo:'p'}))).status).toBe(401);expect(sign).not.toHaveBeenCalled();
});
it('requires current per-context photo authorization and never signs denied media',async()=>{
 const photo=vi.fn(async()=>null);const sign=vi.fn();const handler=createSocialMediaHandler({viewer:async()=>({photo}),sign});
 expect((await handler(request({context:'revoked',photo:'private'}))).status).toBe(403);expect(photo).toHaveBeenCalledWith('revoked','private',false);expect(sign).not.toHaveBeenCalled();
});
it('ignores requested TTL and returns only a fixed 60-second URL without source paths',async()=>{
 const sign=vi.fn(async()=>'https://storage.test/signed');const handler=createSocialMediaHandler({viewer:async()=>({photo:async()=>({path:'owner/private.jpg',owner:'owner'})}),sign});
 const response=await handler(request({context:'c',photo:'p',expires_in:999999}));
 expect(sign).toHaveBeenCalledExactlyOnceWith('actvity-notes','owner/private.jpg',60);
 expect(await response.json()).toEqual({url:'https://storage.test/signed',expires_in:60});expect(response.headers.get('Cache-Control')).toBe('no-store');
});
it('refuses cross-owner, traversal, and arbitrary remote paths even after a forged stored photo reference',async()=>{
 for(const path of ['someone-else/private.jpg','owner/../someone-else.jpg','https://evil.test/private.jpg']){
  const sign=vi.fn();const handler=createSocialMediaHandler({viewer:async()=>({photo:async()=>({path,owner:'owner'})}),sign});
  expect((await handler(request({context:'c',photo:'p'}))).status).toBe(403);expect(sign).not.toHaveBeenCalled();
 }
});
it('supports legacy bucket paths while retaining the same authorization and TTL',async()=>{
 const sign=vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('signed-legacy');
 const handler=createSocialMediaHandler({viewer:async()=>({photo:async()=>({path:'https://local.test/storage/v1/object/sign/activity-notes/owner/photo.jpg?token=old',owner:'owner'})}),sign});
 expect((await handler(request({context:'c',photo:'p'}))).status).toBe(200);expect(sign.mock.calls).toEqual([['actvity-notes','owner/photo.jpg',60],['activity-notes','owner/photo.jpg',60]]);
});
it('authorizes commenter avatars against the activity thread and preserves the fixed TTL',async()=>{
 const profile=vi.fn(async()=>({path:'commenter/thumb/avatar.jpg',owner:'commenter'}));const sign=vi.fn(async()=>'signed-avatar');
 const handler=createSocialMediaHandler({viewer:async()=>({photo:async()=>null,profile}),sign});
 const response=await handler(request({activity:'activity',author:'commenter'}));
 expect(response.status).toBe(200);expect(profile).toHaveBeenCalledExactlyOnceWith('activity','commenter');
 expect(sign).toHaveBeenCalledExactlyOnceWith('actvity-notes','commenter/thumb/avatar.jpg',60);
});
it('does not sign a commenter avatar when activity access has been revoked',async()=>{
 const sign=vi.fn();const handler=createSocialMediaHandler({viewer:async()=>({photo:async()=>null,profile:async()=>null}),sign});
 expect((await handler(request({activity:'revoked',author:'commenter'}))).status).toBe(403);expect(sign).not.toHaveBeenCalled();
});
it('signs challenge covers only after Community authorization with a fixed lifetime',async()=>{
 const challenge=vi.fn(async()=>({path:'owner/challenge-cover-first.jpg',owner:'owner'}));const sign=vi.fn(async()=>'signed-cover');
 const handler=createSocialMediaHandler({viewer:async()=>({photo:async()=>null,challenge}),sign});
 expect((await handler(request({challenge:'challenge-id'}))).status).toBe(200);
 expect(challenge).toHaveBeenCalledExactlyOnceWith('challenge-id');expect(sign).toHaveBeenCalledExactlyOnceWith('actvity-notes','owner/challenge-cover-first.jpg',60);
});
it('never signs a cover for an outsider or removed member',async()=>{
 const sign=vi.fn();const handler=createSocialMediaHandler({viewer:async()=>({photo:async()=>null,challenge:async()=>null}),sign});
 expect((await handler(request({challenge:'unavailable'}))).status).toBe(403);expect(sign).not.toHaveBeenCalled();
});
