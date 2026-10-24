-- Broader photo discovery without changing already assigned daily suggestions.
create or replace function public.memory_date_tier(p_date date,p_today date) returns integer
language sql immutable set search_path=public as $$
 select case when extract(year from p_date)>=extract(year from p_today) then 2
  when to_char(p_date,'MM-DD')=to_char(p_today,'MM-DD') then 0
  when exists(select 1 from generate_series(-1,1) y
   cross join lateral (select make_date(extract(year from p_today)::int+y,extract(month from p_date)::int,1)
     +extract(day from p_date)::int-1 anniversary) x
   where abs(anniversary-p_today)<=30) then 1 else 2 end;
$$;

-- Internal policy helper: auth.uid() always determines the owner. Explicit date
-- keeps the deterministic rotation testable without exposing a client override.
create function public.memory_pick_candidate(p_today date) returns uuid
language sql stable security invoker set search_path=public,pg_temp as $$
 with candidates as (
  select a.id, memory_date_tier(a.date,p_today) tier,
   nullif(btrim(a.notes),'') is not null has_note,
   (a.note_image_url is not null or a.note_thumb_image_url is not null or
    exists(select 1 from activity_photos p where p.activity_id=a.id and p.user_id=auth.uid()
     and (p.image_path is not null or p.thumb_path is not null))) has_photo
  from activities a where a.user_id=auth.uid() and a.date<=p_today-90
   and not exists(select 1 from memory_dismissals d where d.user_id=auth.uid() and d.activity_id=a.id)
   and not exists(select 1 from memory_days d where d.user_id=auth.uid() and d.activity_id=a.id
     and d.day<>p_today and d.exposed_at>now()-interval '30 days')
 ), best as (select min(tier) tier from candidates), pool as (
  select case when best.tier=1 and mod(p_today-date '2000-01-01',3)=1
   and not exists(select 1 from candidates where tier=1 and has_photo)
   and exists(select 1 from candidates where has_photo)
   then 2 else best.tier end tier from best
 )
 select id from candidates where tier=(select tier from pool)
 order by case when mod(p_today-date '2000-01-01',3)=0 then
   case when not has_photo and not has_note then 0 when not has_photo then 1 else 2 end
  else case when has_photo then 0 when has_note then 1 else 2 end end,
  md5(auth.uid()::text||p_today::text||id::text),id limit 1;
$$;
revoke all on function public.memory_pick_candidate(date) from public,anon,authenticated;

create or replace function public.memory_feature(p_timezone text default 'UTC') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); today date; chosen uuid; record_day memory_days;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then p_timezone:='UTC'; end if;
 today:=(now() at time zone p_timezone)::date;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||today::text,0));
 select * into record_day from memory_days where user_id=uid and day=today;
 if not found then
  chosen:=public.memory_pick_candidate(today);
  insert into memory_days(user_id,day,activity_id) values(uid,today,chosen);
  select * into record_day from memory_days where user_id=uid and day=today;
 end if;
 if record_day.hidden then return jsonb_build_object('day',today); end if;
 select id into chosen from activities a where a.id=record_day.activity_id and a.user_id=uid
  and a.date<=today-90 and not exists(select 1 from memory_dismissals d where d.user_id=uid and d.activity_id=a.id);
 return jsonb_build_object('day',today,'id',chosen,'tier',(select memory_date_tier(date,today) from activities where id=chosen and user_id=uid));
end; $$;
