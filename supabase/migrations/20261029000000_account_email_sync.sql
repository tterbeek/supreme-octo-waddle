-- Supabase Auth owns the login identity. Only an applied Auth email change
-- updates the app's display/cache copy; pending email_change is not mirrored.
create trigger sync_profile_login_email_after_change
 after update of email on auth.users
 for each row when (old.email is distinct from new.email)
 execute function public.sync_user_preferences_from_auth();

update public.user_preferences p set login_email=u.email,updated_at=now()
 from auth.users u where p.user_id=u.id and p.login_email is distinct from u.email;
