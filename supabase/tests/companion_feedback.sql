-- Isolated verifier only. Fictional records are rolled back.
begin;
insert into auth.users(id, email, email_confirmed_at) values
  ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'me@thijsterbeek.com', now()),
  ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'other@example.test', now());
insert into public.companion_preferences(user_id, enabled) values
  ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', true),
  ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', true);
insert into public.companion_posts(id, user_id, week_start, week_end, time_zone, status, thought, generated_at, user_reflection)
select md5('feedback-post-' || n)::uuid, 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  date '2026-08-03' + n * 7, date '2026-08-09' + n * 7, 'UTC', 'ready', 'Original thought',
  '2026-10-18 10:00:00.123456+00', 'My journal reflection'
from generate_series(1, 8) n;
insert into public.companion_posts(id, user_id, week_start, week_end, time_zone, status, thought, generated_at)
values ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  '2026-10-05', '2026-10-11', 'UTC', 'ready', 'Other person private thought', '2026-10-18 10:00:00.123456+00');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$
declare post_id uuid := md5('feedback-post-1')::uuid; version timestamptz := '2026-10-18 10:00:00.123456+00'; f public.companion_feedback;
begin
  f := public.save_companion_feedback(post_id, version, 'yes');
  assert f.comment is null and f.rating = 'yes', 'rating saves without a comment';
  f := public.save_companion_feedback(post_id, version, 'not_really', '  Shorter please  ', true);
  assert f.comment = 'Shorter please', 'explicit comment is saved and trimmed';
  f := public.save_companion_feedback(post_id, version, 'yes', 'UNSAVED DRAFT', false);
  assert f.comment = 'Shorter please', 'rating-only changes preserve the saved comment and ignore draft';
  assert (select count(*) from public.companion_feedback) = 1, 'upserts do not duplicate output feedback';
  assert (select user_reflection = 'My journal reflection' and thought = 'Original thought' from public.companion_posts where id = post_id), 'feedback never edits original output or journal';
  begin
    perform public.save_companion_feedback(post_id, version, 'yes', repeat('x', 301), true);
    raise exception 'oversized comment was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_companion_feedback('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', version, 'yes');
    raise exception 'cross-owner feedback was accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_companion_feedback(post_id, version + interval '1 second', 'yes');
    raise exception 'wrong output version was accepted';
  exception when insufficient_privilege then null; end;
  f := public.save_companion_feedback(post_id, version, 'yes', '', true);
  assert f.comment is null, 'explicit clearing removes guidance';
  assert (select count(*) from public.recent_companion_feedback()) = 0, 'rating alone never personalizes';
end $$;
reset role;

insert into public.companion_feedback(user_id, post_id, output_generated_at, rating, comment, updated_at)
select 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', md5('feedback-post-' || n)::uuid,
  '2026-10-18 10:00:00.123456+00', 'yes',
  case when n = 6 then null else 'Guidance ' || n end,
  case when n = 7 then now() - interval '91 days' else now() - n * interval '1 minute' end
from generate_series(2, 8) n;
-- A replaced generated output must not inherit feedback or supply guidance.
update public.companion_posts set generated_at = generated_at + interval '1 second' where id = md5('feedback-post-8')::uuid;
insert into public.companion_feedback(user_id, post_id, output_generated_at, rating, comment)
values ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  '2026-10-18 10:00:00.123456+00', 'yes', 'OTHER USER PRIVATE GUIDANCE');
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ begin
  assert (select array_agg(comment) from public.recent_companion_feedback()) = array['Guidance 2', 'Guidance 3', 'Guidance 4'], 'latest three eligible comments only';
  assert (select count(*) from public.recent_companion_feedback('other_type')) = 0, 'content types do not bleed';
  assert not exists (select 1 from public.companion_feedback where user_id <> auth.uid()), 'even Premium cannot read another owner feedback';
end $$;
delete from public.companion_feedback where post_id = md5('feedback-post-2')::uuid;
do $$ begin
  assert (select array_agg(comment) from public.recent_companion_feedback()) = array['Guidance 3', 'Guidance 4', 'Guidance 5'], 'removal affects the next request';
end $$;
savepoint eligible_comments;
delete from public.companion_feedback where post_id in (
  md5('feedback-post-3')::uuid, md5('feedback-post-4')::uuid, md5('feedback-post-5')::uuid
);
do $$ begin
  assert (select count(*) from public.recent_companion_feedback()) = 0, 'expired, rating-only and replaced-output comments all excluded';
end $$;
rollback to savepoint eligible_comments;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
  assert (select count(*) from public.companion_feedback) = 0, 'cross-user reads rejected';
  delete from public.companion_feedback;
  assert not found, 'cross-user removal rejected';
  assert (select count(*) from public.recent_companion_feedback()) = 0, 'cross-user generation context rejected';
  begin
    perform public.save_companion_feedback(md5('feedback-post-1')::uuid, '2026-10-18 10:00:00.123456+00', 'yes');
    raise exception 'non-premium write accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert not has_table_privilege('authenticated', 'public.companion_feedback', 'INSERT'), 'only validated auth-derived writes allowed';
  assert not has_function_privilege('anon', 'public.save_companion_feedback(uuid,timestamptz,text,text,boolean)', 'EXECUTE'), 'anonymous writes rejected';
  delete from public.companion_posts where id = md5('feedback-post-3')::uuid;
  assert not exists (select 1 from public.companion_feedback where post_id = md5('feedback-post-3')::uuid), 'content deletion cascades';
  delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  assert not exists (select 1 from public.companion_feedback where user_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'), 'account deletion cascades';
end $$;
rollback;
