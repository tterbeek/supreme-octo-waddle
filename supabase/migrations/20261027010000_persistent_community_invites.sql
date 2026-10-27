-- Retain newly generated invite tokens for authorized owner/admin retrieval.
-- community_invites remains private: no direct client table access.
alter table public.community_invites add column invite_token text;

create or replace function public.social_invite(p_action text,p_community uuid default null,p_token text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();c communities;i community_invites;m community_members;token text;generation bigint;
begin
 if not social_enabled() then return jsonb_build_object('status','unavailable');end if;
 if not social_rate('invite:'||coalesce(uid::text,'anonymous'),case when uid is null then 100 else 30 end) then return jsonb_build_object('status','try_later');end if;
 if p_action='get' then
  if uid is null or not social_admin(p_community,uid) then raise exception 'Not authorized';end if;
  select ci.* into i from community_invites ci join communities co on co.id=ci.community_id
   where ci.community_id=p_community and ci.revoked_at is null and ci.expires_at>now()
    and ci.generation=co.invite_generation
   order by ci.created_at desc limit 1;
  if not found then return jsonb_build_object('status','missing');end if;
  if i.invite_token is null then return jsonb_build_object('status','unrecoverable');end if;
  return jsonb_build_object('token',i.invite_token,'expires_at',i.expires_at);
 end if;
 if p_action='rotate' then
  if uid is null or not social_admin(p_community,uid) then raise exception 'Not authorized';end if;
  update communities set invite_generation=invite_generation+1 where id=p_community returning invite_generation into generation;
  update community_invites set revoked_at=now() where community_id=p_community and revoked_at is null;
  token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into community_invites(community_id,token_hash,generation,issuer_id,invite_token)
   values(p_community,encode(sha256(convert_to(token,'UTF8')),'hex'),generation,uid,token);
  return jsonb_build_object('token',token,'expires_at',now()+interval '30 days');
 end if;
 if p_action not in('preview','join') or p_token is null or p_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('status','invalid');end if;
 select * into i from community_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null and expires_at>now() for update;
 if not found then return jsonb_build_object('status','invalid');end if;
 select * into c from communities where id=i.community_id and invite_generation=i.generation;
 if not found then return jsonb_build_object('status','invalid');end if;
 if p_action='preview' then return jsonb_build_object('status','valid','name',c.name,'description',c.description);end if;
 if uid is null then return jsonb_build_object('status','sign_in');end if;
 select * into m from community_members where community_id=c.id and user_id=uid for update;
 if found and m.status='removed' and i.generation<=m.removed_generation then return jsonb_build_object('status','removed');end if;
 if m.status='active' then return jsonb_build_object('status','joined','id',c.id);end if;
 insert into community_members(community_id,user_id,role,status) values(c.id,uid,'member','active')
  on conflict(community_id,user_id) do update set status='active',role='member',joined_at=now();
 -- New/rejoining members have no automatic consent and no resurrected shares.
 return jsonb_build_object('status','joined','id',c.id);
end; $$;
