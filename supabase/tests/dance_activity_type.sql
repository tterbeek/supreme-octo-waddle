begin;
insert into auth.users(id,email) values('fa220000-0000-4000-8000-000000000001','dance-test@example.test');
set local request.jwt.claim.sub='fa220000-0000-4000-8000-000000000001';
select public.ensure_user_activity_types_seeded();
do $$ begin
 assert exists(select 1 from public.user_activity_types where user_id=auth.uid() and activity_type='dance' and is_enabled),'New accounts get Dance';
 assert exists(select 1 from public.user_activity_types where user_id=auth.uid() and activity_type='run'),'Other defaults retained';
end $$;
update public.user_activity_types set is_enabled=false where user_id=auth.uid() and activity_type='run';
select public.ensure_user_activity_types_seeded();
do $$ begin
 assert (select count(*)=1 from public.user_activity_types where user_id=auth.uid() and activity_type='dance'),'Seeding is idempotent';
 assert exists(select 1 from public.user_activity_types where user_id=auth.uid() and activity_type='run' and not is_enabled),'Disabled choices retained';
end $$;
insert into public.activities(user_id,type,date,duration_min,effort,feeling_during,feeling_after)
values(auth.uid(),'dance',current_date,45,3,'smile','happy');
insert into public.activity_preferences(user_id,activity_type,default_metric) values(auth.uid(),'dance','duration');
insert into public.equipment(user_id,name,activity_types) values(auth.uid(),'Dance shoes',array['dance']);
do $$ declare fname text; definition text;begin
 foreach fname in array array['social_set_rule(uuid,text,text[],text)','social_challenges(uuid,text,jsonb)','social_challenges_legacy(uuid,text,jsonb)'] loop
  definition:=pg_get_functiondef(('public.'||fname)::regprocedure);
  assert position('dance' in definition)>0,'Sharing/challenge allowlist includes Dance';
 end loop;
end $$;
rollback;
