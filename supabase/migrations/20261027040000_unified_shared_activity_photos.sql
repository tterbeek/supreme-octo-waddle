-- Match Journal: attachment rows are authoritative; legacy is a fallback only.
-- One checkbox per photo, including legacy-only activities. Do not change saved choices.
create or replace function public.social_activity(p_activity uuid,p_change jsonb default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a activities;photo_ids uuid[];choice jsonb;dest uuid;begin
 if auth.uid() is null or not social_enabled() then raise exception 'Sharing unavailable';end if;
 perform social_circle(auth.uid());
 select * into a from activities where id=p_activity and user_id=auth.uid() for update;
 if not found then raise exception 'Activity unavailable';end if;
 if p_change is not null then
  if not social_rate('activity:'||auth.uid(),60) then raise exception 'Please try again shortly';end if;
  if p_change ? 'public_note' then
   if length(p_change->>'public_note')>1000 then raise exception 'Shared note is too long';end if;
   update activities set public_note=nullif(btrim(p_change->>'public_note'),'') where id=a.id;
  end if;
  if p_change ? 'photos' then
   select coalesce(array_agg(value::uuid),'{}') into photo_ids from jsonb_array_elements_text(p_change->'photos') where value<>'legacy';
   if exists(select 1 from unnest(photo_ids) x where not exists(select 1 from activity_photos p where p.id=x and p.activity_id=a.id and p.user_id=auth.uid())) then raise exception 'Photo unavailable';end if;
   update activity_photos set is_shared=id=any(photo_ids) where activity_id=a.id and user_id=auth.uid();
   update activities set share_legacy_photo=(p_change->'photos') ? 'legacy' where id=a.id
    and not exists(select 1 from activity_photos where activity_id=a.id and user_id=auth.uid());
  end if;
  if p_change ? 'legacy_photo' then
   update activities set share_legacy_photo=coalesce((p_change->>'legacy_photo')::boolean,false) where id=a.id;
  end if;
  if p_change ? 'private' then
   update activities set social_private=(p_change->>'private')::boolean where id=a.id;
   if (p_change->>'private')::boolean then
    update social_contexts set revoked_at=now() where activity_id=a.id and revoked_at is null;
    update social_activity_state set decision='exclude',updated_at=now() where activity_id=a.id;
   end if;
  end if;
  for choice in select value from jsonb_array_elements(coalesce(p_change->'audiences','[]')) loop
   dest:=(choice->>'id')::uuid;
   if not social_destination(dest,auth.uid()) then raise exception 'Audience unavailable';end if;
   if (choice->>'share')::boolean and (select social_private from activities where id=a.id) then raise exception 'Turn off Keep private before sharing';end if;
   perform social_decide(a.id,dest,case when (choice->>'share')::boolean then 'include' else 'exclude' end,(choice->>'share')::boolean);
  end loop;
 end if;
 select * into a from activities where id=p_activity;
 return jsonb_build_object('private',a.social_private,'public_note',a.public_note,'legacy_photo',a.share_legacy_photo,
  'has_legacy_photo',a.note_image_url is not null,'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'shared',is_shared,'thumb',thumb_path) order by sort_order,created_at,id),'[]') from activity_photos where activity_id=a.id and user_id=auth.uid())
   ||case when a.note_image_url is not null and not exists(select 1 from activity_photos where activity_id=a.id and user_id=auth.uid())
    then jsonb_build_array(jsonb_build_object('id','legacy','shared',a.share_legacy_photo,'thumb',coalesce(a.note_thumb_image_url,a.note_image_url))) else '[]'::jsonb end,
  'audiences',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',coalesce(c.name,'Circle'),
   'shared',exists(select 1 from social_contexts s where s.activity_id=a.id and s.audience_id=d.id and s.revoked_at is null and not a.social_private)) order by d.kind,c.name),'[]')
   from social_audiences d left join communities c on c.id=d.community_id where social_destination(d.id,auth.uid())));
end; $$;

create or replace function public.social_feed_placements(p_audience uuid default null,p_before jsonb default null,p_activity uuid default null)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with visible as materialized (
  select s.id,s.activity_id,s.audience_id,s.created_at,d.kind,d.community_id,
   case when d.kind='circle' then 'Circle' else c.name end label
  from social_contexts s join social_audiences d on d.id=s.audience_id left join communities c on c.id=d.community_id
  where social_can_read(s.id) and (p_audience is null or s.audience_id=p_audience or
    (p_audience='00000000-0000-0000-0000-000000000001'::uuid and d.kind='circle'))
 ), unique_activities as (
  select a.id,a.date,max(v.created_at) shared_at from activities a join visible v on v.activity_id=a.id
   where p_activity is null or a.id=p_activity group by a.id,a.date
 ), page as (
  select * from unique_activities where p_before is null or (date,shared_at,id)<
   ((p_before->>'date')::date,(p_before->>'shared_at')::timestamptz,(p_before->>'id')::uuid)
  order by date desc,shared_at desc,id desc limit 30
 ) select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'date',a.date,'shared_at',p.shared_at,
  'author_id',a.user_id,'author',coalesce(nullif(up.social_display_name,''),'MoveNotes member'),
  'title',a.title,'type',a.type,'distance_km',a.distance_km,'duration_min',a.duration_min,'public_note',a.public_note,
  'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'order',sort_order) order by sort_order,created_at,id),'[]')
   from activity_photos where activity_id=a.id and user_id=a.user_id and is_shared)
   ||case when a.share_legacy_photo and a.note_image_url is not null and not exists(select 1 from activity_photos where activity_id=a.id and user_id=a.user_id) then '[{"id":"legacy","order":999}]'::jsonb else '[]'::jsonb end,
  'contexts',(select jsonb_agg(jsonb_build_object('id',v.id,'audience',v.audience_id,'kind',v.kind,'community',v.community_id,'name',v.label) order by v.kind,v.id)
   from visible v where v.activity_id=a.id)) order by p.date desc,p.shared_at desc,p.id desc),'[]'::jsonb)
 from page p join activities a on a.id=p.id left join user_preferences up on up.user_id=a.user_id;
$$;

create or replace function public.social_media_path(p_context uuid,p_photo text,p_thumb boolean default false) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a activities;path text;begin
 if not social_can_read(p_context) then raise exception 'Photo unavailable';end if;
 select x.* into a from activities x join social_contexts s on s.activity_id=x.id where s.id=p_context;
 if p_photo='profile' then
  select coalesce(nullif(social_profile_thumb_path,''),nullif(social_profile_image_path,'')) into path
   from user_preferences where user_id=a.user_id;
 elsif p_photo='legacy' and a.share_legacy_photo and not exists(select 1 from activity_photos where activity_id=a.id and user_id=a.user_id) then
  path:=case when p_thumb then coalesce(a.note_thumb_image_url,a.note_image_url) else a.note_image_url end;
 elsif p_photo ~ '^[a-fA-F0-9-]{36}$' then
  select case when p_thumb then coalesce(thumb_path,image_path) else image_path end into path
   from activity_photos where id=p_photo::uuid and activity_id=a.id and user_id=a.user_id and is_shared;
 end if;
 if path is null then raise exception 'Photo unavailable';end if;
 return jsonb_build_object('path',path,'owner',a.user_id);
end; $$;
