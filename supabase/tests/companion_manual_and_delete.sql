begin;
insert into auth.users(id, email, email_confirmed_at) values
  ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'me@thijsterbeek.com', now()),
  ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'other@example.test', now());
insert into public.companion_preferences(user_id, enabled, allow_activity_notes) values
  ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', true, true),
  ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', true, true);
insert into public.companion_posts(id, user_id, week_start, week_end, time_zone, status, thought, generated_at, user_reflection)
values ('cccccccc-cccc-4ccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  '2026-10-05', '2026-10-11', 'UTC', 'ready', 'Keep until success', now() - interval '1 hour', 'My own words');

do $$
declare token uuid; ok boolean;
begin
  assert not has_function_privilege('authenticated', 'public.claim_manual_weekly_companion(uuid,date,text,boolean)', 'EXECUTE'), 'browser cannot bypass handler with a manual claim';
  assert not has_function_privilege('authenticated', 'public.finish_weekly_companion_internal(uuid,date,uuid,boolean,text,jsonb,text)', 'EXECUTE'), 'corrective replacement must preserve internal publish restrictions';
  assert not has_function_privilege('authenticated', 'public.invalidate_companion_context()', 'EXECUTE'), 'corrective replacement must preserve trigger-only access';
  assert public.claim_manual_weekly_companion('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', '2026-10-05', 'UTC', true) is null, 'manual generation limited to confirmed owner';
  token := public.claim_manual_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', true);
  assert token is not null, 'explicit manual run can replace ready output';
  assert (select status = 'ready' and thought = 'Keep until success' and not includes_activity_notes from public.companion_posts where id = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'), 'keep old output/provenance while preparing';
  assert public.claim_manual_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', true) is null, 'double click/concurrent tab cannot claim twice';
  -- Simulate a failed provider call: clearing only the claim keeps the old thought.
  update public.companion_posts set generation_token = null where generation_token = token;
  assert (select thought = 'Keep until success' and status = 'ready' from public.companion_posts where id = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'), 'failed manual generation preserves output';
end $$;

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
select public.save_companion_feedback('cccccccc-cccc-4ccc-cccc-cccccccccccc',
  (select generated_at from public.companion_posts where id = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'), 'yes', 'Be briefer', true);
reset role;
do $$
declare token uuid; ok boolean;
begin
  token := public.claim_manual_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', true);
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', true);
  assert (select count(*) from public.recent_companion_feedback()) = 1, 'prior feedback remains eligible during manual generation';
  ok := public.finish_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', token, true, 'Replacement', '[]', 'test');
  assert ok, 'manual run can finish using existing publish function';
  assert (select thought = 'Replacement' and includes_activity_notes and user_reflection = 'My own words' from public.companion_posts where id = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'), 'success replaces only generated content and updates note provenance';
  assert (select count(*) from public.recent_companion_feedback()) = 0, 'feedback never silently moves to replacement version';
  token := public.claim_manual_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', true);
  update public.companion_preferences set enabled = false where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  update public.companion_preferences set enabled = true where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  assert not public.finish_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', token, true, 'Cancelled late output', '[]', 'test'), 'disable/re-enable invalidates ready manual claims';
  -- Start with an old no-note output, then revoke/restore note consent in-flight.
  update public.companion_posts set status = 'ready', includes_activity_notes = false, thought = 'No-note original' where id = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
  token := public.claim_manual_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', true);
  update public.companion_preferences set allow_activity_notes = false where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  update public.companion_preferences set allow_activity_notes = true where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  assert not public.finish_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', token, true, 'Stale private context', '[]', 'test'), 'note revoke/restore cancels a ready manual claim';
  assert (select thought = 'No-note original' and status = 'ready' from public.companion_posts where id = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'), 'unrelated old no-note thought remains intact';
end $$;

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
  begin
    perform public.delete_companion_post('cccccccc-cccc-4ccc-cccc-cccccccccccc', now());
    raise exception 'other owner deletion accepted';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ begin
  begin
    perform public.delete_companion_post('cccccccc-cccc-4ccc-cccc-cccccccccccc', now() - interval '5 hours');
    raise exception 'stale delete accepted';
  exception when insufficient_privilege then null; end;
  perform public.delete_companion_post('cccccccc-cccc-4ccc-cccc-cccccccccccc',
    (select generated_at from public.companion_posts where id = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'));
  assert (select status = 'dismissed' and thought is null and user_reflection is null and sources = '[]'::jsonb from public.companion_posts where id = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'), 'delete clears generated content and personal response';
  assert not exists (select 1 from public.companion_feedback), 'delete clears all version-specific feedback';
end $$;
reset role;
do $$
declare token uuid;
begin
  assert (select generation_token is null from public.companion_posts where id = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'), 'delete invalidates in-flight results';
  assert public.claim_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', true) is null, 'ordinary refresh never regenerates dismissed week';
  update public.companion_preferences set allow_activity_notes = false where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  assert (select status = 'dismissed' from public.companion_posts where id = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'), 'consent change cannot resurrect dismissed week';
  token := public.claim_manual_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', 'UTC', false);
  assert token is not null, 'only explicit admin action can recreate dismissed week';
  assert public.finish_weekly_companion('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '2026-10-05', token, false, 'Explicitly requested', '[]', 'test'), 'explicit regeneration succeeds';
end $$;
rollback;
