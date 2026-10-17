-- Initial Premium access is limited to the same confirmed account in every environment.
create function public.companion_account_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
    where id = p_user_id and lower(email) = 'me@thijsterbeek.com'
      and email_confirmed_at is not null
  );
$$;
revoke all on function public.companion_account_allowed(uuid) from public, anon, authenticated, service_role;

create function public.has_companion_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.companion_account_allowed(auth.uid());
$$;
revoke all on function public.has_companion_access() from public, anon;
grant execute on function public.has_companion_access() to authenticated;

-- Restrictive policies also protect direct REST requests, regardless of the UI.
create policy "Companion Premium account only" on public.companion_preferences
  as restrictive for all to authenticated
  using (public.has_companion_access()) with check (public.has_companion_access());
create policy "Companion Premium posts only" on public.companion_posts
  as restrictive for all to authenticated
  using (public.has_companion_access()) with check (public.has_companion_access());

-- Keep generation reservation/consent logic, adding entitlement checks before it.
alter function public.claim_weekly_companion(uuid, date, text, boolean) rename to claim_weekly_companion_internal;
revoke all on function public.claim_weekly_companion_internal(uuid, date, text, boolean) from public, anon, authenticated, service_role;
create function public.claim_weekly_companion(p_user_id uuid, p_week_start date, p_time_zone text, p_notes boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not public.companion_account_allowed(p_user_id) then return null; end if;
  return public.claim_weekly_companion_internal(p_user_id, p_week_start, p_time_zone, p_notes);
end;
$$;
revoke all on function public.claim_weekly_companion(uuid, date, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_weekly_companion(uuid, date, text, boolean) to service_role;

alter function public.finish_weekly_companion(uuid, date, uuid, boolean, text, jsonb, text) rename to finish_weekly_companion_internal;
revoke all on function public.finish_weekly_companion_internal(uuid, date, uuid, boolean, text, jsonb, text) from public, anon, authenticated, service_role;
create function public.finish_weekly_companion(
  p_user_id uuid, p_week_start date, p_token uuid, p_notes boolean,
  p_thought text, p_sources jsonb, p_model text
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.companion_account_allowed(p_user_id) then return false; end if;
  return public.finish_weekly_companion_internal(p_user_id, p_week_start, p_token, p_notes, p_thought, p_sources, p_model);
end;
$$;
revoke all on function public.finish_weekly_companion(uuid, date, uuid, boolean, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.finish_weekly_companion(uuid, date, uuid, boolean, text, jsonb, text) to service_role;
