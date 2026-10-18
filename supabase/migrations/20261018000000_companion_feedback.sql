-- Feedback is private guidance, not a journal entry or a copy of generated text.
-- generated_at is the existing server-written output version (a post can regenerate
-- after consent changes). Old feedback must never attach to a replacement thought.
create table public.companion_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.companion_posts(id) on delete cascade,
  output_generated_at timestamptz not null,
  content_type text not null default 'weekly_thought' check (content_type = 'weekly_thought'),
  rating text not null check (rating in ('yes', 'not_really')),
  comment text check (length(comment) between 1 and 300 and comment = btrim(comment)),
  updated_at timestamptz not null default now(),
  primary key (user_id, post_id, output_generated_at)
);
create index companion_feedback_recent on public.companion_feedback(user_id, content_type, updated_at desc);
alter table public.companion_feedback enable row level security;
revoke all on public.companion_feedback from anon, authenticated;
grant select, delete on public.companion_feedback to authenticated;
grant all on public.companion_feedback to service_role;
create policy "Read own Companion feedback" on public.companion_feedback
  for select to authenticated using (user_id = auth.uid() and public.has_companion_access());
create policy "Remove own Companion feedback" on public.companion_feedback
  for delete to authenticated using (user_id = auth.uid() and public.has_companion_access());

-- Derive ownership from auth, validate the exact still-readable output, and
-- distinguish a rating tap (preserve comment) from explicitly saving a comment.
create function public.save_companion_feedback(
  p_post_id uuid, p_output_generated_at timestamptz, p_rating text,
  p_comment text default null, p_save_comment boolean default false
) returns public.companion_feedback
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  result public.companion_feedback;
begin
  if owner_id is null or not public.has_companion_access() then
    raise exception 'Companion access required' using errcode = '42501';
  end if;
  perform 1 from public.companion_posts post
    join public.companion_preferences prefs on prefs.user_id = post.user_id
    where post.id = p_post_id and post.user_id = owner_id
      and post.generated_at = p_output_generated_at and post.status = 'ready'
      and prefs.enabled and (not post.includes_activity_notes or prefs.allow_activity_notes)
    for share of post, prefs;
  if not found then
    raise exception 'This generated output is no longer available' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not in ('yes', 'not_really')
    or (p_save_comment and length(btrim(p_comment)) > 300) then
    raise exception 'Invalid feedback' using errcode = '22023';
  end if;
  insert into public.companion_feedback(user_id, post_id, output_generated_at, rating, comment)
    values(owner_id, p_post_id, p_output_generated_at, p_rating,
      case when p_save_comment then nullif(btrim(p_comment), '') else null end)
    on conflict (user_id, post_id, output_generated_at) do update
      set rating = excluded.rating,
          comment = case when p_save_comment then excluded.comment else companion_feedback.comment end,
          updated_at = clock_timestamp()
    returning * into result;
  return result;
end;
$$;
revoke all on function public.save_companion_feedback(uuid, timestamptz, text, text, boolean) from public, anon;
grant execute on function public.save_companion_feedback(uuid, timestamptz, text, text, boolean) to authenticated;

-- Called with the requesting user's JWT, not the service role. RLS on both
-- tables stays authoritative; revoked/redacted/replaced outputs are excluded.
create function public.recent_companion_feedback(p_content_type text default 'weekly_thought')
returns table(comment text) language sql stable security invoker set search_path = '' as $$
  select f.comment from public.companion_feedback f
    join public.companion_posts post on post.id = f.post_id
      and post.user_id = f.user_id and post.generated_at = f.output_generated_at
    where f.user_id = auth.uid() and f.content_type = p_content_type
      and f.updated_at >= now() - interval '90 days' and f.updated_at <= now()
      and nullif(btrim(f.comment), '') is not null and post.status = 'ready'
    order by f.updated_at desc, f.post_id desc limit 3;
$$;
revoke all on function public.recent_companion_feedback(text) from public, anon;
grant execute on function public.recent_companion_feedback(text) to authenticated;
