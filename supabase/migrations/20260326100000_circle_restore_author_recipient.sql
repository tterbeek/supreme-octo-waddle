-- Restore author self-recipient rows in Circle feed.
-- Regression: the 2026-03-25 share function rewrite dropped the author's
-- activity_share_recipients insert, so new shares were visible to friends
-- but not to the author in their own Circle feed.

insert into public.activity_share_recipients (
  activity_share_id,
  recipient_user_id,
  shared_at,
  seen_at
)
select
  s.id,
  s.author_user_id,
  s.shared_at,
  now()
from public.activity_shares s
where s.deleted_at is null
  and s.expires_at > now()
  and not exists (
    select 1
    from public.activity_share_recipients r
    where r.activity_share_id = s.id
      and r.recipient_user_id = s.author_user_id
  );

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
    shared_at,
    seen_at
  )
  values (
    v_share_id,
    p_user_id,
    v_shared_at,
    now()
  )
  on conflict (activity_share_id, recipient_user_id) do nothing;

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

  select s.id, s.shared_at
  into v_share_id, v_shared_at
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

  insert into public.activity_share_recipients (
    activity_share_id,
    recipient_user_id,
    shared_at,
    seen_at
  )
  values (
    v_share_id,
    p_user_id,
    v_shared_at,
    now()
  )
  on conflict (activity_share_id, recipient_user_id) do nothing;

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
