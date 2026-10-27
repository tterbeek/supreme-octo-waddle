begin;
update social_config set enabled=true;
insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','invite-owner@example.test'),
 ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','invite-member@example.test');
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ declare c uuid;first jsonb;second jsonb;begin
 c:=(social_community('create',null,'{"name":"Invite persistence"}')->>'id')::uuid;
 perform set_config('test.invite_community',c::text,true);
 assert social_invite('get',c)->>'status'='missing','no automatic invite creation';
 first:=social_invite('rotate',c);
 assert social_invite('get',c)=first,'reopening returns same token and expiry';
 assert social_invite('get',c)=first,'reads do not rotate invite';
 second:=social_invite('rotate',c);
 assert second->>'token'<>first->>'token','rotation changes token';
 assert social_invite('preview',null,first->>'token')->>'status'='invalid','rotation revokes old link';
 assert social_invite('get',c)=second,'new invite is retained';
 perform set_config('test.invite_token',second->>'token',true);
end $$;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
 perform social_invite('join',null,current_setting('test.invite_token'));
 begin
  perform social_invite('get',current_setting('test.invite_community')::uuid);
  raise exception 'Member retrieved invite';
 exception when raise_exception then if SQLERRM<>'Not authorized' then raise;end if;end;
 begin
  perform invite_token from community_invites;
  raise exception 'Direct token read permitted';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
update community_invites set expires_at=now()-interval '1 second'
 where community_id=current_setting('test.invite_community')::uuid;
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ begin
 assert social_invite('get',current_setting('test.invite_community')::uuid)->>'status'='missing',
  'expired invitations are not redisplayed';
end $$;
rollback;
