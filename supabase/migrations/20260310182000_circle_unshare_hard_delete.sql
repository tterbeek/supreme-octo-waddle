-- Make Circle share action reversible for testing:
-- unsharing removes the share row and cascades recipients/photos.

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

  delete from public.activity_shares
  where activity_id = p_activity_id
    and author_user_id = p_user_id;

  return found;
end;
$$;
