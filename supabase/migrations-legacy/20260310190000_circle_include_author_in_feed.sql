-- Show own shared activities in own Circle feed.
-- We do this by materializing a recipient row for the author too.

-- Backfill existing active shares: add self-recipient rows when missing.
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

-- Ensure new shares always include an author-recipient row.
drop function if exists public.share_activity_with_connections(uuid, uuid);
create function public.share_activity_with_connections(
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

  -- Author sees their own shared item in Circle feed.
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
  on conflict (activity_share_id, recipient_user_id) do nothing;

  return v_share_id;
end;
$$;
