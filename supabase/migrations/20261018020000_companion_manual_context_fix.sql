-- Some development databases applied the manual/delete migration before these
-- two function updates were added. Reapply just their final definitions under
-- a new migration version. No records, migration history, or grants are reset.
-- CREATE OR REPLACE also makes this harmless on databases already up to date.

-- Keep old visible provenance intact during a manual run and write the new
-- output's activity-note flag only when the new output successfully publishes.
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

-- Cancel manual claims as well as normal claims on consent changes, without
-- hiding an old ready no-note thought or resurrecting a dismissed thought.
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
