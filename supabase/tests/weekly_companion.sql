-- Runs only in the isolated local schema verifier; no fixture survives rollback.
begin;
insert into auth.users(id, email, email_confirmed_at) values
  ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'me@thijsterbeek.com', now()),
  ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'other@example.test', now());
insert into public.companion_preferences(user_id, enabled, allow_activity_notes) values
  ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', true, true),
  ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', true, false);

do $$
declare token uuid; other_token uuid; ok boolean;
begin
  token := public.claim_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', true);
  assert token is not null, 'first request must claim the week';
  other_token := public.claim_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', true);
  assert other_token is null, 'another tab must not generate the same week';
  ok := public.finish_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', token, true, 'A thought using a private note.', '[{"label":"private note"}]', 'test');
  assert ok, 'claimed generation must complete';
  assert public.claim_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', true) is null, 'completed week must not regenerate';
  assert not has_column_privilege('authenticated', 'public.companion_posts', 'thought', 'UPDATE'), 'client cannot forge generated thought';
  assert not has_function_privilege('authenticated', 'public.claim_weekly_companion(uuid,date,text,boolean)', 'EXECUTE'), 'client cannot reserve arbitrary user/week';
end $$;

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
  assert (select count(*) from public.companion_posts) = 0, 'other users cannot read private posts';
  update public.companion_posts set user_reflection = 'Not mine';
  assert not found, 'other users cannot respond to private posts';
end $$;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
update public.companion_posts set user_reflection = 'My own words';
update public.companion_preferences set allow_activity_notes = false;
do $$ begin
  assert (select thought is null and sources = '[]'::jsonb and status = 'redacted' from public.companion_posts), 'note revocation must clear generated content and provenance';
  assert (select user_reflection = 'My own words' from public.companion_posts), 'note revocation preserves the user response';
end $$;
reset role;

do $$
declare token uuid; ok boolean;
begin
  token := public.claim_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', false);
  assert token is not null, 'redacted current week can be written without activity notes';
  update public.companion_preferences set enabled = false where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  ok := public.finish_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', token, false, 'Late result', '[]', 'test');
  assert not ok, 'generation must not publish after Companion is disabled';
  update public.companion_preferences set enabled = true, allow_activity_notes = true where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  update public.companion_posts set retry_after = null where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  token := public.claim_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', true);
  update public.companion_preferences set allow_activity_notes = false where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  ok := public.finish_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', token, true, 'Stale private context', '[]', 'test');
  assert not ok, 'generation must not publish after note use is revoked';
  token := public.claim_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-12', 'UTC', false);
  update public.companion_preferences set allow_activity_notes = true where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  ok := public.finish_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-12', token, false, 'Old consent result', '[]', 'test');
  assert not ok, 'changing note permission in either direction cancels in-flight work';
  assert (select count(*) from public.companion_posts where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' and week_start = '2026-10-05') = 1, 'retries must keep one post per week';
end $$;
rollback;
