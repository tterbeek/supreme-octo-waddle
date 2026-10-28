-- Existing/manual activities remain ready; enrichment is a separate user choice.
alter table public.activities
 add column import_status text not null default 'ready' check(import_status in ('processing','ready','failed')),
 add column import_updated_at timestamptz,
 add column import_token uuid;
create index activities_pending_imports on public.activities(user_id,imported_at desc)
 where import_status<>'ready';

create function public.guard_activity_import() returns trigger language plpgsql as $$
begin
 if current_user='authenticated' or coalesce(auth.role(),'')='authenticated' then
  if old.import_status<>'ready' then
   raise exception 'This activity is still being imported. Please wait or retry the import.' using errcode='42501';
  end if;
  if (new.import_status,new.import_token,new.import_updated_at) is distinct from
     (old.import_status,old.import_token,old.import_updated_at) then
   raise exception 'Import state is managed by the importer.' using errcode='42501';
  end if;
 end if;
 return new;
end; $$;
create trigger guard_activity_import before update on public.activities
 for each row execute function public.guard_activity_import();

create or replace function public.social_auto(activity uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a activities;r social_rules;state text;eligible boolean;
begin
 if not social_enabled() then return;end if;
 select * into a from activities where id=activity;if not found then return;end if;
 if a.import_status<>'ready' or a.social_private then return;end if;
 for r in select * from social_rules where user_id=a.user_id order by audience_id loop
  select decision into state from social_activity_state where activity_id=a.id and audience_id=r.audience_id;
  if state in('include','exclude') then continue;end if;
  eligible:=social_destination(r.audience_id,a.user_id) and r.mode<>'manual'
   and (r.mode='all' or a.type=any(r.types)) and a.created_at is not null
   and (a.created_at at time zone 'UTC')>=r.effective_at
   and case when a.started_at is not null then a.started_at>=r.effective_at
      when a.source='manual' then a.date>=(r.effective_at at time zone r.time_zone)::date
      else a.date>(r.effective_at at time zone r.time_zone)::date end;
  if eligible or state='automatic' then perform social_decide(a.id,r.audience_id,'automatic',coalesce(eligible,false));end if;
 end loop;
end; $$;
create or replace function public.social_activity_trigger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_OP='INSERT' then perform social_auto(new.id);
 elsif (new.type,new.date,new.started_at,new.import_status) is distinct from (old.type,old.date,old.started_at,old.import_status) then perform social_auto(new.id);
 end if;return new;
end; $$;
drop trigger social_activity_engine on public.activities;
create trigger social_activity_engine after insert or update of type,date,started_at,import_status on public.activities
 for each row execute function public.social_activity_trigger();


-- Owner RLS also applies to realtime; no social route exposes these rows.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='activities') then
  alter publication supabase_realtime add table public.activities;
 end if;
end $$;
