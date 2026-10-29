-- Pin privileges to the existing production/dev account IDs. Changing an email
-- never transfers privileges to the new holder of an old address.
create or replace function public.companion_account_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users where id=p_user_id
  and id in ('589c83df-8ee7-4319-9203-5b5c9aae0d07'::uuid,'7725b4a2-16df-47dd-bae0-c7695717a342'::uuid)
  and email_confirmed_at is not null);
$$;

create or replace function public.admin_assert_owner() returns void
language plpgsql set search_path = 'public','auth' as $$
begin
 if auth.uid() is null or auth.uid() not in
  ('589c83df-8ee7-4319-9203-5b5c9aae0d07'::uuid,'7725b4a2-16df-47dd-bae0-c7695717a342'::uuid) then
  raise exception 'not allowed';
 end if;
end;
$$;
