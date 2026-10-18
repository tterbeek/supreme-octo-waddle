-- Keep only a week tombstone after deletion so ordinary Journal visits cannot
-- silently regenerate a deleted thought (or spend another model call).
alter table public.companion_posts drop constraint companion_posts_status_check;
alter table public.companion_posts add constraint companion_posts_status_check
  check (status in ('pending', 'generating', 'ready', 'failed', 'redacted', 'dismissed'));

create function public.delete_companion_post(p_post_id uuid, p_generated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null or not public.has_companion_access() then
    raise exception 'Companion access required' using errcode = '42501';
  end if;
  perform 1 from public.companion_preferences where user_id = owner_id and enabled for share;
  if not found then raise exception 'Companion is disabled' using errcode = '42501'; end if;
  perform 1 from public.companion_posts
    where id = p_post_id and user_id = owner_id and generated_at is not distinct from p_generated_at
      and status in ('ready', 'redacted') for update;
  if not found then raise exception 'This thought is no longer available' using errcode = '42501'; end if;
  delete from public.companion_feedback where post_id = p_post_id and user_id = owner_id;
  update public.companion_posts set status = 'dismissed', thought = null, sources = '[]'::jsonb,
    user_reflection = null, generated_at = null, generation_token = null, model = null,
    generation_started_at = null, retry_after = null, includes_activity_notes = false
    where id = p_post_id and user_id = owner_id;
end;
$$;
revoke all on function public.delete_companion_post(uuid, timestamptz) from public, anon;
grant execute on function public.delete_companion_post(uuid, timestamptz) to authenticated;

-- Same normal claim behavior, with dismissed weeks excluded atomically under
-- the row lock. Premium entitlement stays in the existing public wrapper.
create or replace function public.claim_weekly_companion_internal(
  p_user_id uuid, p_week_start date, p_time_zone text, p_notes boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  prefs public.companion_preferences%rowtype;
  post public.companion_posts%rowtype;
  token uuid;
begin
  select * into prefs from public.companion_preferences where user_id = p_user_id for share;
  if not found or not prefs.enabled or prefs.allow_activity_notes <> p_notes then return null; end if;
  insert into public.companion_posts(user_id, week_start, week_end, time_zone)
    values(p_user_id, p_week_start, p_week_start + 6, p_time_zone)
    on conflict (user_id, week_start) do nothing;
  select * into post from public.companion_posts
    where user_id = p_user_id and week_start = p_week_start for update;
  if post.status in ('ready', 'dismissed') or post.attempts >= 3 or post.retry_after > now()
    or (post.status = 'generating' and post.generation_started_at > now() - interval '2 minutes') then
    return null;
  end if;
  token := gen_random_uuid();
  update public.companion_posts set status = 'generating', generation_token = token,
    generation_started_at = now(), includes_activity_notes = p_notes,
    attempts = attempts + 1, retry_after = now() + interval '5 minutes' where id = post.id;
  return token;
end;
$$;

-- Service-only: the handler checks the verified account before selecting this
-- explicit paid rerun path. No client-supplied user ID or date reaches it.
create function public.claim_manual_weekly_companion(
  p_user_id uuid, p_week_start date, p_time_zone text, p_notes boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  prefs public.companion_preferences%rowtype;
  post public.companion_posts%rowtype;
  token uuid;
begin
  if not public.companion_account_allowed(p_user_id) then return null; end if;
  select * into prefs from public.companion_preferences where user_id = p_user_id for share;
  if not found or not prefs.enabled or prefs.allow_activity_notes <> p_notes then return null; end if;
  insert into public.companion_posts(user_id, week_start, week_end, time_zone)
    values(p_user_id, p_week_start, p_week_start + 6, p_time_zone)
    on conflict (user_id, week_start) do nothing;
  select * into post from public.companion_posts
    where user_id = p_user_id and week_start = p_week_start for update;
  if post.generation_token is not null and post.generation_started_at > now() - interval '2 minutes' then
    return null;
  end if;
  token := gen_random_uuid();
  -- Keep a ready thought and its feedback visible until replacement succeeds.
  update public.companion_posts set status = case when post.status = 'ready' then 'ready' else 'generating' end,
    generation_token = token, generation_started_at = now(), attempts = attempts + 1,
    includes_activity_notes = case when post.status = 'ready' then includes_activity_notes else p_notes end,
    retry_after = now() + interval '5 minutes' where id = post.id;
  return token;
end;
$$;
revoke all on function public.claim_manual_weekly_companion(uuid, date, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_manual_weekly_companion(uuid, date, text, boolean) to service_role;

-- Manual claims leave the previous ready output intact. Set the new context's
-- note provenance only on successful publish, never on the old visible output.
create or replace function public.finish_weekly_companion_internal(
  p_user_id uuid, p_week_start date, p_token uuid, p_notes boolean,
  p_thought text, p_sources jsonb, p_model text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare prefs public.companion_preferences%rowtype;
begin
  select * into prefs from public.companion_preferences where user_id = p_user_id for share;
  if not found or not prefs.enabled or prefs.allow_activity_notes <> p_notes then return false; end if;
  update public.companion_posts set status = 'ready', thought = p_thought, sources = p_sources,
    generated_at = now(), model = p_model, generation_token = null, retry_after = null,
    includes_activity_notes = p_notes
    where user_id = p_user_id and week_start = p_week_start and generation_token = p_token;
  return found;
end;
$$;

create or replace function public.invalidate_companion_context() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.allow_activity_notes and not new.allow_activity_notes then
    update public.companion_posts set status = 'redacted', thought = null,
      sources = '[]'::jsonb, includes_activity_notes = false, generation_token = null,
      attempts = 0, retry_after = null
      where user_id = new.user_id and includes_activity_notes;
  end if;
  if (old.enabled and not new.enabled) or old.allow_activity_notes <> new.allow_activity_notes then
    update public.companion_posts set
      status = case when status = 'generating' then 'pending' else status end,
      generation_token = null, retry_after = null
      where user_id = new.user_id and generation_token is not null;
  end if;
  return new;
end;
$$;
