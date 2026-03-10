-- Ensure Circle share snapshots use activity_photos cover first, then legacy note image fields.
-- Also backfill existing shares that currently have missing photo paths.

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

update public.activity_shares s
set
  shared_photo_url = coalesce(
    s.shared_photo_url,
    cover.image_path,
    a.note_image_url
  ),
  shared_thumb_photo_url = coalesce(
    s.shared_thumb_photo_url,
    cover.thumb_path,
    a.note_thumb_image_url
  )
from public.activities a
left join lateral (
  select p.image_path, p.thumb_path
  from public.activity_photos p
  where p.activity_id = a.id
  order by p.sort_order asc, p.created_at asc, p.id asc
  limit 1
) cover on true
where s.activity_id = a.id
  and (s.shared_photo_url is null or s.shared_thumb_photo_url is null);
