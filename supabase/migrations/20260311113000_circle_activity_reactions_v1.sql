-- Circle activity reactions v1 (identities visible)

alter table public.user_preferences
  add column if not exists circle_last_seen_at timestamptz null;

create table if not exists public.activity_share_reactions (
  id uuid primary key default gen_random_uuid(),
  activity_share_id uuid not null references public.activity_shares(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('CHEER', 'INSPIRED', 'ENERGY', 'BEAUTIFUL', 'MOVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_share_reactions_unique unique (activity_share_id, user_id)
);

create index if not exists activity_share_reactions_share_idx
  on public.activity_share_reactions (activity_share_id, reaction_type);

create index if not exists activity_share_reactions_user_updated_idx
  on public.activity_share_reactions (user_id, updated_at desc);

alter table public.activity_share_reactions enable row level security;

drop function if exists public.can_access_circle_share(uuid, uuid);
create function public.can_access_circle_share(
  p_activity_share_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.activity_shares s
    left join public.activity_share_recipients r
      on r.activity_share_id = s.id
     and r.recipient_user_id = p_user_id
     and r.hidden_at is null
    where s.id = p_activity_share_id
      and s.deleted_at is null
      and s.expires_at > now()
      and (s.author_user_id = p_user_id or r.id is not null)
  );
$$;

drop policy if exists "Circle users can read reactions on visible shares" on public.activity_share_reactions;
create policy "Circle users can read reactions on visible shares"
on public.activity_share_reactions
for select
using (public.can_access_circle_share(activity_share_id, auth.uid()));

drop policy if exists "Circle users can insert their own reactions" on public.activity_share_reactions;
create policy "Circle users can insert their own reactions"
on public.activity_share_reactions
for insert
with check (
  auth.uid() = user_id
  and public.can_access_circle_share(activity_share_id, auth.uid())
);

drop policy if exists "Circle users can update their own reactions" on public.activity_share_reactions;
create policy "Circle users can update their own reactions"
on public.activity_share_reactions
for update
using (
  auth.uid() = user_id
  and public.can_access_circle_share(activity_share_id, auth.uid())
)
with check (
  auth.uid() = user_id
  and public.can_access_circle_share(activity_share_id, auth.uid())
);

drop policy if exists "Circle users can delete their own reactions" on public.activity_share_reactions;
create policy "Circle users can delete their own reactions"
on public.activity_share_reactions
for delete
using (
  auth.uid() = user_id
  and public.can_access_circle_share(activity_share_id, auth.uid())
);

drop function if exists public.upsert_circle_activity_reaction(uuid, uuid, text);
create function public.upsert_circle_activity_reaction(
  p_activity_share_id uuid,
  p_user_id uuid,
  p_reaction_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user uuid;
  v_reaction text;
  v_saved text;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  v_reaction := upper(trim(coalesce(p_reaction_type, '')));
  if v_reaction not in ('CHEER', 'INSPIRED', 'ENERGY', 'BEAUTIFUL', 'MOVED') then
    raise exception 'Unsupported reaction type';
  end if;

  if not public.can_access_circle_share(p_activity_share_id, p_user_id) then
    raise exception 'Share not accessible';
  end if;

  insert into public.activity_share_reactions (
    activity_share_id,
    user_id,
    reaction_type
  )
  values (
    p_activity_share_id,
    p_user_id,
    v_reaction
  )
  on conflict (activity_share_id, user_id)
  do update set
    reaction_type = excluded.reaction_type,
    updated_at = now()
  returning reaction_type
  into v_saved;

  return v_saved;
end;
$$;

drop function if exists public.remove_circle_activity_reaction(uuid, uuid);
create function public.remove_circle_activity_reaction(
  p_activity_share_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  if not public.can_access_circle_share(p_activity_share_id, p_user_id) then
    raise exception 'Share not accessible';
  end if;

  delete from public.activity_share_reactions ar
  where ar.activity_share_id = p_activity_share_id
    and ar.user_id = p_user_id;

  return found;
end;
$$;

drop function if exists public.has_circle_new_reactions(uuid);
create function public.has_circle_new_reactions(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user uuid;
  v_last_seen timestamptz;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select up.circle_last_seen_at
  into v_last_seen
  from public.user_preferences up
  where up.user_id = p_user_id;

  return exists (
    select 1
    from public.activity_share_reactions ar
    join public.activity_shares s
      on s.id = ar.activity_share_id
    where s.author_user_id = p_user_id
      and s.deleted_at is null
      and s.expires_at > now()
      and ar.user_id <> p_user_id
      and ar.updated_at > coalesce(v_last_seen, to_timestamp(0))
  );
end;
$$;

drop function if exists public.mark_circle_feed_visited(uuid);
create function public.mark_circle_feed_visited(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user uuid;
  v_now timestamptz;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  v_now := now();

  insert into public.user_preferences (
    user_id,
    circle_last_seen_at,
    updated_at
  )
  values (
    p_user_id,
    v_now,
    v_now
  )
  on conflict (user_id)
  do update set
    circle_last_seen_at = excluded.circle_last_seen_at,
    updated_at = v_now;

  return true;
end;
$$;

-- Feed now returns reaction groups, current viewer reaction, and new-reaction marker.
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
            'profile_thumb_path', upr.social_profile_thumb_path
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
