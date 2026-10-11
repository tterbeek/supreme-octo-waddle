create table if not exists public.user_preferences (
  user_id uuid not null,
  unit_system text not null default 'metric'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_preferences_pkey primary key (user_id),
  constraint user_preferences_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint user_preferences_unit_system_check check (
    unit_system = any (array['metric'::text, 'imperial'::text])
  )
);

alter table public.user_preferences
  add column if not exists social_display_name text null,
  add column if not exists social_profile_image_path text null,
  add column if not exists social_profile_thumb_path text null,
  add column if not exists login_email text null;

create or replace function public.sync_user_preferences_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.user_preferences (user_id, login_email, updated_at)
  values (new.id, new.email, now())
  on conflict (user_id)
  do update set
    login_email = excluded.login_email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_insert_sync_user_preferences on auth.users;
create trigger on_auth_user_insert_sync_user_preferences
after insert on auth.users
for each row
execute function public.sync_user_preferences_from_auth();

drop trigger if exists on_auth_user_update_sync_user_preferences on auth.users;
create trigger on_auth_user_update_sync_user_preferences
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_user_preferences_from_auth();

insert into public.user_preferences (user_id, login_email, updated_at)
select u.id, u.email, now()
from auth.users u
on conflict (user_id)
do update set
  login_email = excluded.login_email,
  updated_at = now();

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
  author_display_name text,
  author_profile_image_path text,
  author_profile_thumb_path text,
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
    coalesce(nullif(up.social_display_name, ''), split_part(coalesce(up.login_email, ''), '@', 1), 'Mover') as author_display_name,
    up.social_profile_image_path as author_profile_image_path,
    up.social_profile_thumb_path as author_profile_thumb_path,
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
  left join public.user_preferences up
    on up.user_id = s.author_user_id
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
