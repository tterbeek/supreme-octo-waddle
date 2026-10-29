begin;
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
  ('589c83df-8ee7-4319-9203-5b5c9aae0d07', 'ME@THIJSTERBEEK.COM', now(), '{}'),
  ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'other@example.test', now(), '{"premium":true,"email":"me@thijsterbeek.com"}');
-- Seed pre-existing enabled preferences to prove UI hiding is not the restriction.
insert into public.companion_preferences(user_id, enabled) values
  ('589c83df-8ee7-4319-9203-5b5c9aae0d07', true), ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', true);
insert into public.companion_posts(user_id, week_start, week_end, time_zone, status, thought) values
  ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', '2026-10-05', '2026-10-11', 'UTC', 'ready', 'Hidden from an ineligible account');

set local role authenticated;
set local request.jwt.claim.sub = '589c83df-8ee7-4319-9203-5b5c9aae0d07';
do $$ begin
  assert public.has_companion_access(), 'confirmed owner user ID has Premium access';
end $$;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
  assert not public.has_companion_access(), 'self-editable metadata must not grant Premium access';
  assert (select count(*) from public.companion_posts) = 0, 'ineligible users cannot read even their own old posts';
  update public.companion_preferences set enabled = true;
  assert not found, 'ineligible users cannot change Companion preferences';
end $$;
reset role;

do $$
declare token uuid;
begin
  assert public.claim_weekly_companion('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', '2026-10-12', 'UTC', false) is null,
    'server-side generation must deny other accounts even with enabled preferences';
  assert not has_function_privilege('service_role', 'public.claim_weekly_companion_internal(uuid,date,text,boolean)', 'EXECUTE'),
    'service callers cannot bypass entitlement through the internal reservation function';
  assert not has_function_privilege('service_role', 'public.finish_weekly_companion_internal(uuid,date,uuid,boolean,text,jsonb,text)', 'EXECUTE'),
    'service callers cannot bypass entitlement through the internal publish function';
  token := public.claim_weekly_companion('589c83df-8ee7-4319-9203-5b5c9aae0d07', '2026-10-12', 'UTC', false);
  assert token is not null, 'owner can reserve a weekly thought';
  update auth.users set email = 'changed@example.test' where id = '589c83df-8ee7-4319-9203-5b5c9aae0d07';
  assert public.finish_weekly_companion('589c83df-8ee7-4319-9203-5b5c9aae0d07', '2026-10-12', token, false, 'Late result', '[]', 'test'),
    'email changes do not revoke access or invalidate an authorized generation';
  update auth.users set email = 'me@thijsterbeek.com', email_confirmed_at = null where id = '589c83df-8ee7-4319-9203-5b5c9aae0d07';
  assert not public.companion_account_allowed('589c83df-8ee7-4319-9203-5b5c9aae0d07'), 'an unconfirmed email must not grant Premium access';
end $$;
rollback;
