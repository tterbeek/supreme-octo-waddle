-- Return connected friend labels (friendly name -> preferences email -> auth email)
-- via SECURITY DEFINER so clients don't need direct read access to other users' preferences.

drop function if exists public.get_circle_connected_friends(uuid);
create function public.get_circle_connected_friends(p_user_id uuid)
returns table (
  friend_user_id uuid,
  label text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  return query
  with connected as (
    select distinct
      case
        when c.requester_user_id = p_user_id then c.addressee_user_id
        else c.requester_user_id
      end as friend_id
    from public.user_connections c
    where c.status = 'accepted'
      and (c.requester_user_id = p_user_id or c.addressee_user_id = p_user_id)
  )
  select
    c.friend_id as friend_user_id,
    coalesce(
      nullif(up.social_display_name, ''),
      nullif(up.login_email, ''),
      au.email::text
    ) as label
  from connected c
  left join public.user_preferences up
    on up.user_id = c.friend_id
  left join auth.users au
    on au.id = c.friend_id;
end;
$$;
