create table if not exists public.activity_share_tags (
  id uuid primary key default gen_random_uuid(),
  activity_share_id uuid not null references public.activity_shares(id) on delete cascade,
  type text not null,
  value text not null,
  metadata jsonb not null default '{}'::jsonb,
  source text null,
  created_at timestamptz not null default now(),
  constraint activity_share_tags_unique unique (activity_share_id, type)
);

create index if not exists activity_share_tags_share_idx
  on public.activity_share_tags (activity_share_id, created_at, id);

alter table public.activity_share_tags enable row level security;

drop policy if exists "Authors and recipients can read share tags" on public.activity_share_tags;
create policy "Authors and recipients can read share tags"
on public.activity_share_tags
for select
using (
  exists (
    select 1
    from public.activity_shares s
    where s.id = activity_share_tags.activity_share_id
      and s.author_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.activity_share_recipients r
    join public.activity_shares s
      on s.id = r.activity_share_id
    where r.activity_share_id = activity_share_tags.activity_share_id
      and r.recipient_user_id = auth.uid()
      and r.hidden_at is null
      and s.deleted_at is null
      and s.expires_at > now()
  )
);

insert into public.activity_share_tags (
  activity_share_id,
  type,
  value,
  metadata,
  source
)
select
  s.id,
  t.type,
  t.value,
  coalesce(t.metadata, '{}'::jsonb),
  t.source
from public.activity_shares s
join public.activity_tags t
  on t.activity_id = s.activity_id
on conflict (activity_share_id, type) do update
set
  value = excluded.value,
  metadata = excluded.metadata,
  source = excluded.source;

create or replace function public.share_activity_with_connections(
  p_activity_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user uuid;
  v_activity record;
  v_share_id uuid;
  v_shared_at timestamptz;
  v_photo_rows integer;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select
    a.id,
    a.user_id,
    a.type,
    a.title,
    coalesce(
      (
        select p.image_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_image_url
    ) as cover_image_path,
    coalesce(
      (
        select p.thumb_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_thumb_image_url
    ) as cover_thumb_path,
    a.date,
    a.distance_km,
    a.duration_min
  into v_activity
  from public.activities a
  where a.id = p_activity_id
    and a.user_id = p_user_id;

  if not found then
    raise exception 'Activity not found or not owned by user.';
  end if;

  if exists (
    select 1
    from public.activity_shares s
    where s.activity_id = p_activity_id
  ) then
    raise exception 'Activity already shared with Circle.';
  end if;

  insert into public.activity_shares (
    activity_id,
    author_user_id,
    visibility,
    title,
    activity_type,
    summary_text,
    distance_km,
    duration_min,
    shared_photo_url,
    shared_thumb_photo_url,
    occurred_on
  )
  values (
    v_activity.id,
    p_user_id,
    'connections',
    v_activity.title,
    v_activity.type,
    null,
    v_activity.distance_km,
    v_activity.duration_min,
    v_activity.cover_image_path,
    v_activity.cover_thumb_path,
    v_activity.date
  )
  returning id, shared_at
  into v_share_id, v_shared_at;

  insert into public.activity_share_photos (
    activity_share_id,
    image_path,
    thumb_path,
    sort_order
  )
  select
    v_share_id,
    p.image_path,
    p.thumb_path,
    coalesce(p.sort_order, 0)
  from public.activity_photos p
  where p.activity_id = v_activity.id
  order by p.sort_order asc, p.created_at asc, p.id asc
  on conflict (activity_share_id, sort_order, image_path) do nothing;

  get diagnostics v_photo_rows = row_count;

  if v_photo_rows = 0 and v_activity.cover_image_path is not null then
    insert into public.activity_share_photos (
      activity_share_id,
      image_path,
      thumb_path,
      sort_order
    )
    values (
      v_share_id,
      v_activity.cover_image_path,
      v_activity.cover_thumb_path,
      0
    )
    on conflict (activity_share_id, sort_order, image_path) do nothing;
  end if;

  insert into public.activity_share_tags (
    activity_share_id,
    type,
    value,
    metadata,
    source
  )
  select
    v_share_id,
    t.type,
    t.value,
    coalesce(t.metadata, '{}'::jsonb),
    t.source
  from public.activity_tags t
  where t.activity_id = v_activity.id
  on conflict (activity_share_id, type) do update
  set
    value = excluded.value,
    metadata = excluded.metadata,
    source = excluded.source;

  insert into public.activity_share_recipients (
    activity_share_id,
    recipient_user_id,
    shared_at
  )
  select distinct
    v_share_id,
    case
      when c.requester_user_id = p_user_id then c.addressee_user_id
      else c.requester_user_id
    end as recipient_user_id,
    v_shared_at
  from public.user_connections c
  where c.status = 'accepted'
    and (c.requester_user_id = p_user_id or c.addressee_user_id = p_user_id)
    and (
      case
        when c.requester_user_id = p_user_id then c.addressee_user_id
        else c.requester_user_id
      end
    ) <> p_user_id
  on conflict (activity_share_id, recipient_user_id) do nothing;

  return v_share_id;
end;
$$;

create or replace function public.refresh_shared_activity(
  p_activity_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user uuid;
  v_activity record;
  v_share_id uuid;
  v_photo_rows integer;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select
    a.id,
    a.user_id,
    a.type,
    a.title,
    coalesce(
      (
        select p.image_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_image_url
    ) as cover_image_path,
    coalesce(
      (
        select p.thumb_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_thumb_image_url
    ) as cover_thumb_path,
    a.date,
    a.distance_km,
    a.duration_min
  into v_activity
  from public.activities a
  where a.id = p_activity_id
    and a.user_id = p_user_id;

  if not found then
    raise exception 'Activity not found or not owned by user.';
  end if;

  select s.id
  into v_share_id
  from public.activity_shares s
  where s.activity_id = p_activity_id
    and s.author_user_id = p_user_id
    and s.deleted_at is null
  limit 1;

  if v_share_id is null then
    return false;
  end if;

  update public.activity_shares
  set
    title = v_activity.title,
    activity_type = v_activity.type,
    distance_km = v_activity.distance_km,
    duration_min = v_activity.duration_min,
    shared_photo_url = v_activity.cover_image_path,
    shared_thumb_photo_url = v_activity.cover_thumb_path,
    occurred_on = v_activity.date
  where id = v_share_id;

  delete from public.activity_share_photos
  where activity_share_id = v_share_id;

  insert into public.activity_share_photos (
    activity_share_id,
    image_path,
    thumb_path,
    sort_order
  )
  select
    v_share_id,
    p.image_path,
    p.thumb_path,
    coalesce(p.sort_order, 0)
  from public.activity_photos p
  where p.activity_id = v_activity.id
  order by p.sort_order asc, p.created_at asc, p.id asc;

  get diagnostics v_photo_rows = row_count;

  if v_photo_rows = 0 and v_activity.cover_image_path is not null then
    insert into public.activity_share_photos (
      activity_share_id,
      image_path,
      thumb_path,
      sort_order
    )
    values (
      v_share_id,
      v_activity.cover_image_path,
      v_activity.cover_thumb_path,
      0
    )
    on conflict (activity_share_id, sort_order, image_path) do nothing;
  end if;

  delete from public.activity_share_tags
  where activity_share_id = v_share_id;

  insert into public.activity_share_tags (
    activity_share_id,
    type,
    value,
    metadata,
    source
  )
  select
    v_share_id,
    t.type,
    t.value,
    coalesce(t.metadata, '{}'::jsonb),
    t.source
  from public.activity_tags t
  where t.activity_id = v_activity.id;

  return true;
end;
$$;

drop function if exists public.get_circle_feed(uuid, integer, date, timestamptz, uuid);
create function public.get_circle_feed(
  p_user_id uuid,
  p_limit integer default 30,
  p_before_occurred_on date default null,
  p_before_shared_at timestamptz default null,
  p_before_recipient_id uuid default null
)
returns table (
  recipient_id uuid,
  activity_share_id uuid,
  shared_at timestamptz,
  occurred_on date,
  author_user_id uuid,
  author_display_name text,
  author_profile_image_path text,
  author_profile_thumb_path text,
  title text,
  activity_type text,
  distance_km numeric,
  duration_min numeric,
  shared_photo_url text,
  shared_thumb_photo_url text,
  photos jsonb,
  tags jsonb,
  reaction_groups jsonb,
  current_user_reaction text,
  has_new_reactions boolean,
  seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select up.circle_last_seen_at
    from public.user_preferences up
    where up.user_id = p_user_id
  )
  select
    r.id as recipient_id,
    r.activity_share_id,
    r.shared_at,
    s.occurred_on,
    s.author_user_id,
    coalesce(
      nullif(up.social_display_name, ''),
      split_part(coalesce(up.login_email, ''), '@', 1),
      'Mover'
    ) as author_display_name,
    up.social_profile_image_path as author_profile_image_path,
    up.social_profile_thumb_path as author_profile_thumb_path,
    s.title,
    s.activity_type,
    s.distance_km,
    s.duration_min,
    s.shared_photo_url,
    s.shared_thumb_photo_url,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'image_path', sp.image_path,
            'thumb_path', sp.thumb_path,
            'sort_order', sp.sort_order
          )
          order by sp.sort_order asc, sp.created_at asc, sp.id asc
        )
        from public.activity_share_photos sp
        where sp.activity_share_id = s.id
      ),
      case
        when s.shared_photo_url is not null then jsonb_build_array(
          jsonb_build_object(
            'image_path', s.shared_photo_url,
            'thumb_path', s.shared_thumb_photo_url,
            'sort_order', 0
          )
        )
        else '[]'::jsonb
      end
    ) as photos,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'type', st.type,
            'value', st.value,
            'metadata', st.metadata,
            'source', st.source
          )
          order by st.created_at asc, st.id asc
        )
        from public.activity_share_tags st
        where st.activity_share_id = s.id
      ),
      '[]'::jsonb
    ) as tags,
    coalesce(rg.reaction_groups, '{}'::jsonb) as reaction_groups,
    cur.current_user_reaction,
    case
      when s.author_user_id = p_user_id then coalesce(nr.has_new_reactions, false)
      else false
    end as has_new_reactions,
    r.seen_at
  from public.activity_share_recipients r
  join public.activity_shares s
    on s.id = r.activity_share_id
  left join public.user_preferences up
    on up.user_id = s.author_user_id
  left join viewer v
    on true
  left join lateral (
    select jsonb_object_agg(grouped.reaction_type, grouped.reactors) as reaction_groups
    from (
      select
        ar.reaction_type,
        jsonb_agg(
          jsonb_build_object(
            'user_id', ar.user_id,
            'name', coalesce(
              nullif(upr.social_display_name, ''),
              split_part(coalesce(upr.login_email, ''), '@', 1),
              'Mover'
            ),
            'profile_thumb_path', upr.social_profile_thumb_path,
            'reacted_at', ar.updated_at
          )
          order by ar.updated_at desc, ar.user_id
        ) as reactors
      from public.activity_share_reactions ar
      left join public.user_preferences upr
        on upr.user_id = ar.user_id
      where ar.activity_share_id = s.id
      group by ar.reaction_type
    ) grouped
  ) rg
    on true
  left join lateral (
    select ar.reaction_type as current_user_reaction
    from public.activity_share_reactions ar
    where ar.activity_share_id = s.id
      and ar.user_id = p_user_id
    limit 1
  ) cur
    on true
  left join lateral (
    select exists (
      select 1
      from public.activity_share_reactions ar
      where ar.activity_share_id = s.id
        and ar.user_id <> p_user_id
        and ar.updated_at > coalesce(v.circle_last_seen_at, to_timestamp(0))
    ) as has_new_reactions
  ) nr
    on true
  where auth.uid() = p_user_id
    and r.recipient_user_id = p_user_id
    and r.hidden_at is null
    and s.deleted_at is null
    and s.expires_at > now()
    and (
      p_before_occurred_on is null
      or p_before_shared_at is null
      or p_before_recipient_id is null
      or (s.occurred_on, r.shared_at, r.id) < (p_before_occurred_on, p_before_shared_at, p_before_recipient_id)
    )
  order by s.occurred_on desc, r.shared_at desc, r.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;
