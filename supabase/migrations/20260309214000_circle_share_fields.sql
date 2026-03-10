alter table public.activity_shares
  add column if not exists distance_km numeric null,
  add column if not exists duration_min numeric null;

-- Remove previously-copied private notes from existing share snapshots
update public.activity_shares s
set
  summary_text = null,
  distance_km = coalesce(s.distance_km, a.distance_km),
  duration_min = coalesce(s.duration_min, a.duration_min)
from public.activities a
where a.id = s.activity_id
  and (
    s.summary_text is not null
    or s.distance_km is null
    or s.duration_min is null
  );

drop function if exists public.get_circle_feed(uuid, integer, timestamptz, uuid);
create function public.get_circle_feed(
  p_user_id uuid,
  p_limit integer default 30,
  p_before_shared_at timestamptz default null,
  p_before_recipient_id uuid default null
)
returns table (
  recipient_id uuid,
  activity_share_id uuid,
  shared_at timestamptz,
  occurred_on date,
  author_user_id uuid,
  title text,
  activity_type text,
  distance_km numeric,
  duration_min numeric,
  shared_photo_url text,
  shared_thumb_photo_url text,
  seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id as recipient_id,
    r.activity_share_id,
    r.shared_at,
    s.occurred_on,
    s.author_user_id,
    s.title,
    s.activity_type,
    s.distance_km,
    s.duration_min,
    s.shared_photo_url,
    s.shared_thumb_photo_url,
    r.seen_at
  from public.activity_share_recipients r
  join public.activity_shares s
    on s.id = r.activity_share_id
  where auth.uid() = p_user_id
    and r.recipient_user_id = p_user_id
    and r.hidden_at is null
    and s.deleted_at is null
    and s.expires_at > now()
    and (
      p_before_shared_at is null
      or p_before_recipient_id is null
      or (r.shared_at, r.id) < (p_before_shared_at, p_before_recipient_id)
    )
  order by r.shared_at desc, r.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

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
    a.note_image_url,
    a.note_thumb_image_url,
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
    v_activity.note_image_url,
    v_activity.note_thumb_image_url,
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
