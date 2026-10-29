begin;
insert into auth.users(id,email) values('fc000000-0000-4000-8000-000000000001','original-email@example.test');
insert into public.user_preferences(user_id,login_email,social_display_name) values
 ('fc000000-0000-4000-8000-000000000001','original-email@example.test','Keep this name')
 on conflict(user_id) do update set login_email=excluded.login_email,social_display_name=excluded.social_display_name;
insert into public.activities(id,user_id,type,date,title) values
 ('fc000000-0000-4000-8000-000000000002','fc000000-0000-4000-8000-000000000001','walk',current_date,'Keep this activity');
-- Supabase stores a requested address separately until confirmation is complete.
update auth.users set email_change='pending-email@example.test' where id='fc000000-0000-4000-8000-000000000001';
do $$ begin
 assert (select login_email from public.user_preferences where user_id='fc000000-0000-4000-8000-000000000001')='original-email@example.test','pending email must not replace the login email';
end $$;
-- Simulate the Auth service applying a confirmed change.
update auth.users set email='pending-email@example.test',email_change='' where id='fc000000-0000-4000-8000-000000000001';
do $$ begin
 assert (select login_email from public.user_preferences where user_id='fc000000-0000-4000-8000-000000000001')='pending-email@example.test','confirmed Auth email updates the app copy';
 assert (select social_display_name from public.user_preferences where user_id='fc000000-0000-4000-8000-000000000001')='Keep this name','friendly name survives';
 assert (select user_id from public.activities where id='fc000000-0000-4000-8000-000000000002')='fc000000-0000-4000-8000-000000000001','activity ownership survives';
end $$;
rollback;
