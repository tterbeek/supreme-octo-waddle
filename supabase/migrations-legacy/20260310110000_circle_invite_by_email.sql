drop function if exists public.request_circle_connection_by_email(uuid, text);
create function public.request_circle_connection_by_email(
  p_user_id uuid,
  p_target_email text
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  auth_user uuid;
  v_target_user_id uuid;
  v_normalized_email text;
  v_same_direction_id uuid;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  v_normalized_email := lower(trim(coalesce(p_target_email, '')));
  if v_normalized_email = '' then
    raise exception 'Enter an email address.';
  end if;

  select u.id
  into v_target_user_id
  from auth.users u
  where lower(u.email) = v_normalized_email
  limit 1;

  if v_target_user_id is null then
    return 'user_not_found';
  end if;

  if v_target_user_id = p_user_id then
    return 'cannot_connect_self';
  end if;

  if exists (
    select 1
    from public.user_connections c
    where (
      (c.requester_user_id = p_user_id and c.addressee_user_id = v_target_user_id)
      or
      (c.requester_user_id = v_target_user_id and c.addressee_user_id = p_user_id)
    )
      and c.status = 'accepted'
  ) then
    return 'already_connected';
  end if;

  update public.user_connections c
  set
    status = 'accepted',
    responded_at = now()
  where c.requester_user_id = v_target_user_id
    and c.addressee_user_id = p_user_id
    and c.status = 'pending';

  if found then
    return 'accepted_pending_request';
  end if;

  if exists (
    select 1
    from public.user_connections c
    where c.requester_user_id = p_user_id
      and c.addressee_user_id = v_target_user_id
      and c.status = 'pending'
  ) then
    return 'already_pending';
  end if;

  select c.id
  into v_same_direction_id
  from public.user_connections c
  where c.requester_user_id = p_user_id
    and c.addressee_user_id = v_target_user_id
    and c.status not in ('accepted', 'pending')
  limit 1;

  if v_same_direction_id is not null then
    update public.user_connections
    set
      status = 'pending',
      responded_at = null
    where id = v_same_direction_id;
    return 'requested';
  end if;

  insert into public.user_connections (
    requester_user_id,
    addressee_user_id,
    status
  )
  values (
    p_user_id,
    v_target_user_id,
    'pending'
  );

  return 'requested';
end;
$$;
