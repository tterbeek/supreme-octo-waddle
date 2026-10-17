-- Private, opt-in weekly Companion posts. AI content is server-written;
-- clients may change only their own response to a post.
create table public.companion_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  allow_activity_notes boolean not null default false,
  time_zone text not null default 'UTC' check (length(time_zone) between 1 and 100)
);

create table public.companion_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null check (week_end = week_start + 6),
  time_zone text not null,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed', 'redacted')),
  thought text check (length(thought) between 1 and 2000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  includes_activity_notes boolean not null default false,
  user_reflection text check (length(user_reflection) between 1 and 4000),
  created_at timestamptz not null default now(),
  generated_at timestamptz,
  generation_token uuid,
  generation_started_at timestamptz,
  attempts integer not null default 0,
  retry_after timestamptz,
  model text,
  unique(user_id, week_start)
);
create index companion_posts_user_created on public.companion_posts(user_id, created_at desc);

alter table public.companion_preferences enable row level security;
alter table public.companion_posts enable row level security;
revoke all on public.companion_preferences, public.companion_posts from anon, authenticated;
grant select, insert, update on public.companion_preferences to authenticated;
grant select (id, user_id, week_start, week_end, time_zone, status, thought, sources,
  includes_activity_notes, user_reflection, created_at, generated_at) on public.companion_posts to authenticated;
grant update (user_reflection) on public.companion_posts to authenticated;
grant all on public.companion_preferences, public.companion_posts to service_role;

create policy "Own Companion preferences" on public.companion_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Read own enabled Companion posts" on public.companion_posts
  for select to authenticated using (user_id = auth.uid() and exists (
    select 1 from public.companion_preferences p where p.user_id = auth.uid() and p.enabled
      and (not includes_activity_notes or p.allow_activity_notes)
  ));
create policy "Respond to own Companion post" on public.companion_posts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Revoking note use removes note-derived content and cancels in-flight work.
-- The person's own response is retained. Older redacted posts remain readable.
create function public.invalidate_companion_context() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.allow_activity_notes and not new.allow_activity_notes then
    update public.companion_posts set status = 'redacted', thought = null,
      sources = '[]'::jsonb, includes_activity_notes = false, generation_token = null,
      attempts = 0, retry_after = null
      where user_id = new.user_id and (includes_activity_notes or status = 'generating');
  end if;
  if old.enabled and not new.enabled then
    update public.companion_posts set status = 'pending', generation_token = null
      where user_id = new.user_id and status = 'generating';
  end if;
  if old.allow_activity_notes <> new.allow_activity_notes then
    update public.companion_posts set status = 'pending', generation_token = null,
      retry_after = null where user_id = new.user_id and status = 'generating';
  end if;
  return new;
end;
$$;
revoke all on function public.invalidate_companion_context() from public, anon, authenticated;
create trigger companion_consent_changed after update on public.companion_preferences
  for each row execute function public.invalidate_companion_context();

-- A database claim prevents multiple tabs/requests charging for the same week.
-- Failed attempts back off for 5 minutes and are capped at three per week.
create function public.claim_weekly_companion(
  p_user_id uuid, p_week_start date, p_time_zone text, p_notes boolean
) returns uuid language plpgsql security definer set search_path = public as $$
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
  if post.status = 'ready' or post.attempts >= 3 or post.retry_after > now()
    or (post.status = 'generating' and post.generation_started_at > now() - interval '2 minutes') then
    return null;
  end if;
  token := gen_random_uuid();
  update public.companion_posts set status = 'generating', generation_token = token,
    generation_started_at = now(), includes_activity_notes = p_notes,
    attempts = attempts + 1, retry_after = now() + interval '5 minutes'
    where id = post.id;
  return token;
end;
$$;

create function public.finish_weekly_companion(
  p_user_id uuid, p_week_start date, p_token uuid, p_notes boolean,
  p_thought text, p_sources jsonb, p_model text
) returns boolean language plpgsql security definer set search_path = public as $$
declare prefs public.companion_preferences%rowtype;
begin
  select * into prefs from public.companion_preferences where user_id = p_user_id for share;
  if not found or not prefs.enabled or prefs.allow_activity_notes <> p_notes then return false; end if;
  update public.companion_posts set status = 'ready', thought = p_thought, sources = p_sources,
    generated_at = now(), model = p_model, generation_token = null, retry_after = null
    where user_id = p_user_id and week_start = p_week_start and generation_token = p_token;
  return found;
end;
$$;
revoke all on function public.claim_weekly_companion(uuid, date, text, boolean) from public, anon, authenticated;
revoke all on function public.finish_weekly_companion(uuid, date, uuid, boolean, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_weekly_companion(uuid, date, text, boolean) to service_role;
grant execute on function public.finish_weekly_companion(uuid, date, uuid, boolean, text, jsonb, text) to service_role;
