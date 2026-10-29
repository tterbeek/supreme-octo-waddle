begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('589c83df-8ee7-4319-9203-5b5c9aae0d07','me@thijsterbeek.com',now(),'{}'),
 ('7725b4a2-16df-47dd-bae0-c7695717a342','dev-owner@example.test',now(),'{}'),
 ('fd000000-0000-4000-8000-000000000001','outsider@example.test',now(),'{"admin":true,"premium":true,"id":"589c83df-8ee7-4319-9203-5b5c9aae0d07"}');
update auth.users set email='changed-owner@example.test' where id='589c83df-8ee7-4319-9203-5b5c9aae0d07';
update auth.users set email='changed-dev@example.test' where id='7725b4a2-16df-47dd-bae0-c7695717a342';
update auth.users set email='me@thijsterbeek.com' where id='fd000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub='589c83df-8ee7-4319-9203-5b5c9aae0d07';
do $$ begin
 assert public.has_companion_access(),'production account keeps Companion after email change';
 assert public.admin_total_users()>=3,'production account keeps admin reporting';
end $$;
set local request.jwt.claim.sub='7725b4a2-16df-47dd-bae0-c7695717a342';
do $$ begin
 assert public.has_companion_access(),'dev account keeps Companion after email change';
 assert public.admin_total_users()>=3,'dev account has admin reporting';
end $$;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000001';
do $$ begin
 assert not public.has_companion_access(),'old email and profile metadata cannot grant Companion access';
 begin
  perform public.admin_total_users();raise exception 'outsider read admin report';
 exception when raise_exception then
  if SQLERRM<>'not allowed' then raise;end if;
 end;
end $$;
reset role;
rollback;
