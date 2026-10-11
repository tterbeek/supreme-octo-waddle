create table if not exists public.circle_invite_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default (gen_random_uuid()::text),
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by_user_id uuid null references auth.users(id) on delete set null,
  accepted_at timestamptz null,
  revoked_at timestamptz null
);

create index if not exists circle_invite_links_inviter_idx
  on public.circle_invite_links (inviter_user_id, created_at desc);

create index if not exists circle_invite_links_token_idx
  on public.circle_invite_links (token);

alter table public.circle_invite_links enable row level security;

drop policy if exists "Users can read own invite links" on public.circle_invite_links;
create policy "Users can read own invite links"
on public.circle_invite_links
for select
using (auth.uid() = inviter_user_id);

drop policy if exists "Users can create own invite links" on public.circle_invite_links;
create policy "Users can create own invite links"
on public.circle_invite_links
for insert
with check (auth.uid() = inviter_user_id);

drop policy if exists "Users can update own invite links" on public.circle_invite_links;
create policy "Users can update own invite links"
on public.circle_invite_links
for update
using (auth.uid() = inviter_user_id)
with check (auth.uid() = inviter_user_id);

drop function if exists public.create_circle_invite_link(uuid);
create function public.create_circle_invite_link(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user uuid;
  v_token text;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  insert into public.circle_invite_links (inviter_user_id)
  values (p_user_id)
  returning token into v_token;

  return v_token;
end;
$$;

drop function if exists public.get_circle_invite_preview(text);
create function public.get_circle_invite_preview(p_token text)
returns table (
  invite_status text,
  inviter_user_id uuid,
  friendly_name text,
  account_email text,
  profile_image_path text,
  profile_thumb_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_email text;
begin
  select l.*
  into v_invite
  from public.circle_invite_links l
  where l.token = p_token
  limit 1;

  if not found then
    return query select
      'invalid'::text,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  if v_invite.revoked_at is not null then
    return query select
      'revoked'::text,
      v_invite.inviter_user_id,
      null::text,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  if v_invite.expires_at <= now() then
    return query select
      'expired'::text,
      v_invite.inviter_user_id,
      null::text,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  if v_invite.accepted_by_user_id is not null then
    return query select
      'used'::text,
      v_invite.inviter_user_id,
      null::text,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  select up.login_email
  into v_email
  from public.user_preferences up
  where up.user_id = v_invite.inviter_user_id;

  return query
  select
    'active'::text as invite_status,
    v_invite.inviter_user_id,
    coalesce(
      nullif(up.social_display_name, ''),
      split_part(coalesce(up.login_email, ''), '@', 1),
      'Mover'
    ) as friendly_name,
    up.login_email as account_email,
    up.social_profile_image_path as profile_image_path,
    up.social_profile_thumb_path as profile_thumb_path
  from public.user_preferences up
  where up.user_id = v_invite.inviter_user_id
  union all
  select
    'active'::text,
    v_invite.inviter_user_id,
    coalesce(split_part(coalesce(v_email, ''), '@', 1), 'Mover'),
    v_email,
    null::text,
    null::text
  where not exists (
    select 1
    from public.user_preferences up2
    where up2.user_id = v_invite.inviter_user_id
  )
  limit 1;
end;
$$;

drop function if exists public.accept_circle_invite(text, uuid);
create function public.accept_circle_invite(
  p_token text,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user uuid;
  v_invite record;
  v_connection record;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select *
  into v_invite
  from public.circle_invite_links l
  where l.token = p_token
  limit 1
  for update;

  if not found then
    return 'invalid';
  end if;

  if v_invite.revoked_at is not null then
    return 'revoked';
  end if;

  if v_invite.expires_at <= now() then
    return 'expired';
  end if;

  if v_invite.accepted_by_user_id is not null and v_invite.accepted_by_user_id <> p_user_id then
    return 'used';
  end if;

  if v_invite.inviter_user_id = p_user_id then
    return 'cannot_accept_own';
  end if;

  select c.*
  into v_connection
  from public.user_connections c
  where
    (c.requester_user_id = v_invite.inviter_user_id and c.addressee_user_id = p_user_id)
    or
    (c.requester_user_id = p_user_id and c.addressee_user_id = v_invite.inviter_user_id)
  order by c.created_at desc
  limit 1
  for update;

  if found then
    if v_connection.status = 'blocked' then
      return 'blocked';
    end if;

    if v_connection.status = 'accepted' then
      update public.circle_invite_links
      set accepted_by_user_id = coalesce(accepted_by_user_id, p_user_id),
          accepted_at = coalesce(accepted_at, now())
      where id = v_invite.id;
      return 'already_connected';
    end if;

    update public.user_connections
    set
      status = 'accepted',
      responded_at = now()
    where id = v_connection.id;
  else
    insert into public.user_connections (
      requester_user_id,
      addressee_user_id,
      status,
      responded_at
    )
    values (
      v_invite.inviter_user_id,
      p_user_id,
      'accepted',
      now()
    );
  end if;

  update public.circle_invite_links
  set accepted_by_user_id = coalesce(accepted_by_user_id, p_user_id),
      accepted_at = coalesce(accepted_at, now())
  where id = v_invite.id;

  return 'connected';
end;
$$;
