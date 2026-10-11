create table if not exists public.user_connections (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  addressee_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'removed', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint user_connections_not_self check (requester_user_id <> addressee_user_id),
  constraint user_connections_unique_pair unique (requester_user_id, addressee_user_id)
);

create index if not exists user_connections_requester_status_idx
  on public.user_connections (requester_user_id, status);

create index if not exists user_connections_addressee_status_idx
  on public.user_connections (addressee_user_id, status);

alter table public.user_connections enable row level security;

drop policy if exists "Users can view their own connections" on public.user_connections;
create policy "Users can view their own connections"
on public.user_connections
for select
using (auth.uid() = requester_user_id or auth.uid() = addressee_user_id);

drop policy if exists "Users can create connection requests they send" on public.user_connections;
create policy "Users can create connection requests they send"
on public.user_connections
for insert
with check (
  auth.uid() = requester_user_id
  and requester_user_id <> addressee_user_id
  and status = 'pending'
);

drop policy if exists "Users can update their own connection rows" on public.user_connections;
create policy "Users can update their own connection rows"
on public.user_connections
for update
using (auth.uid() = requester_user_id or auth.uid() = addressee_user_id)
with check (auth.uid() = requester_user_id or auth.uid() = addressee_user_id);

drop policy if exists "Users can delete their own connection rows" on public.user_connections;
create policy "Users can delete their own connection rows"
on public.user_connections
for delete
using (auth.uid() = requester_user_id or auth.uid() = addressee_user_id);


create table if not exists public.activity_shares (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'connections' check (visibility in ('connections')),
  title text null,
  activity_type text not null,
  summary_text text null,
  shared_photo_url text null,
  shared_thumb_photo_url text null,
  occurred_on date not null,
  shared_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  deleted_at timestamptz null,
  constraint activity_shares_unique_activity unique (activity_id)
);

create index if not exists activity_shares_author_shared_at_idx
  on public.activity_shares (author_user_id, shared_at desc)
  where deleted_at is null;

create index if not exists activity_shares_expires_at_idx
  on public.activity_shares (expires_at)
  where deleted_at is null;

alter table public.activity_shares enable row level security;

drop policy if exists "Authors can view their own shares" on public.activity_shares;
create policy "Authors can view their own shares"
on public.activity_shares
for select
using (auth.uid() = author_user_id);

drop policy if exists "Users can insert their own shares" on public.activity_shares;
create policy "Users can insert their own shares"
on public.activity_shares
for insert
with check (auth.uid() = author_user_id);

drop policy if exists "Users can update their own shares" on public.activity_shares;
create policy "Users can update their own shares"
on public.activity_shares
for update
using (auth.uid() = author_user_id)
with check (auth.uid() = author_user_id);

drop policy if exists "Users can delete their own shares" on public.activity_shares;
create policy "Users can delete their own shares"
on public.activity_shares
for delete
using (auth.uid() = author_user_id);


create table if not exists public.activity_share_recipients (
  id uuid primary key default gen_random_uuid(),
  activity_share_id uuid not null references public.activity_shares(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  shared_at timestamptz not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz null,
  hidden_at timestamptz null,
  constraint activity_share_recipients_unique unique (activity_share_id, recipient_user_id)
);

create index if not exists activity_share_recipients_feed_idx
  on public.activity_share_recipients (recipient_user_id, shared_at desc, id desc)
  where hidden_at is null;

alter table public.activity_share_recipients enable row level security;

drop policy if exists "Recipients can read their own recipient rows" on public.activity_share_recipients;
create policy "Recipients can read their own recipient rows"
on public.activity_share_recipients
for select
using (auth.uid() = recipient_user_id);

drop policy if exists "Recipients can update their own recipient rows" on public.activity_share_recipients;
create policy "Recipients can update their own recipient rows"
on public.activity_share_recipients
for update
using (auth.uid() = recipient_user_id)
with check (auth.uid() = recipient_user_id);


drop function if exists public.has_circle_access(uuid);
create function public.has_circle_access(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null then
    return false;
  end if;
  if auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  return exists (
    select 1
    from public.user_connections c
    where (c.requester_user_id = p_user_id or c.addressee_user_id = p_user_id)
      and c.status in ('pending', 'accepted')
  );
end;
$$;


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
  summary_text text,
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
    s.summary_text,
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
    a.notes,
    a.note_image_url,
    a.note_thumb_image_url,
    a.date
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
    v_activity.notes,
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


drop function if exists public.unshare_activity(uuid, uuid);
create function public.unshare_activity(
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
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.activity_shares
  set deleted_at = now()
  where activity_id = p_activity_id
    and author_user_id = p_user_id
    and deleted_at is null;

  return found;
end;
$$;


drop function if exists public.mark_circle_feed_item_seen(uuid, uuid);
create function public.mark_circle_feed_item_seen(
  p_recipient_id uuid,
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

  update public.activity_share_recipients r
  set seen_at = now()
  where r.id = p_recipient_id
    and r.recipient_user_id = p_user_id
    and r.seen_at is null;

  return found;
end;
$$;


drop function if exists public.hide_circle_feed_item(uuid, uuid);
create function public.hide_circle_feed_item(
  p_recipient_id uuid,
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

  update public.activity_share_recipients r
  set hidden_at = now()
  where r.id = p_recipient_id
    and r.recipient_user_id = p_user_id
    and r.hidden_at is null;

  return found;
end;
$$;
