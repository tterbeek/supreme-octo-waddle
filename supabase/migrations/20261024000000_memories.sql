-- Private metadata only: the original activity remains authoritative.
create table public.memory_days (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  activity_id uuid references public.activities on delete set null,
  exposed_at timestamptz,
  hidden boolean not null default false,
  primary key (user_id, day)
);
create table public.memory_dismissals (
  user_id uuid not null references auth.users on delete cascade,
  activity_id uuid not null references public.activities on delete cascade,
  primary key (user_id, activity_id)
);
alter table public.memory_days enable row level security;
alter table public.memory_dismissals enable row level security;
create policy memory_days_owner on public.memory_days for select to authenticated using (user_id = auth.uid());
create policy memory_dismissals_owner on public.memory_dismissals for select to authenticated using (user_id = auth.uid());
revoke all on public.memory_days, public.memory_dismissals from public, anon, authenticated;
grant select on public.memory_days, public.memory_dismissals to authenticated;
create index memory_exposures on public.memory_days(user_id, exposed_at, activity_id);
create index memory_activity_order on public.activities(user_id, date desc, created_at desc, id desc);

-- All new entry points explicitly constrain ownership, including SECURITY DEFINER
-- metadata writes. No caller can supply another user's ID.
create function public.memory_archive() returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('month', month_key, 'count', n,
    'thumbs',(select coalesce(jsonb_agg(path),'[]'::jsonb) from (
      select coalesce((select coalesce(p.thumb_path,p.image_path) from activity_photos p
       where p.activity_id=a.id and p.user_id=auth.uid() order by p.sort_order nulls last,p.created_at,p.id limit 1),
       a.note_thumb_image_url,a.note_image_url) path from activities a
       where a.user_id=auth.uid() and to_char(a.date,'YYYY-MM')=month_key
       and (a.note_image_url is not null or exists(select 1 from activity_photos p where p.activity_id=a.id and p.user_id=auth.uid()))
       order by a.date desc,a.created_at desc,a.id desc limit 3) thumbs)) order by month_key desc), '[]'::jsonb)
  from (select to_char(date, 'YYYY-MM') as month_key, count(*) n from activities
    where user_id = auth.uid() group by 1) months;
$$;

create function public.memory_page(p_start date, p_end date, p_before jsonb default null)
returns jsonb language sql stable security invoker set search_path = public as $$
 select coalesce(jsonb_agg(payload order by date desc, created_at desc nulls last, id desc), '[]'::jsonb)
 from (
  select a.date, a.created_at, a.id, jsonb_build_object(
   'id',a.id,'date',a.date,'created_at',a.created_at,'title',a.title,'type',a.type,
   'notes',left(a.notes,180),'note_image_url',a.note_image_url,'note_thumb_image_url',a.note_thumb_image_url,
   'photos',coalesce((select jsonb_agg(p) from (select id,image_path,thumb_path,sort_order,created_at
     from activity_photos where activity_id=a.id and user_id=auth.uid()
     order by sort_order nulls last,created_at,id limit 3) p),'[]'::jsonb)) as payload
  from activities a where a.user_id=auth.uid() and a.date>=p_start and a.date<p_end
   and (p_before is null or (a.date,coalesce(a.created_at,'-infinity'::timestamp),a.id) <
     ((p_before->>'date')::date,coalesce((p_before->>'created_at')::timestamp,'-infinity'::timestamp),(p_before->>'id')::uuid))
  order by a.date desc,a.created_at desc nulls last,a.id desc limit 40
 ) page;
$$;

create function public.memory_neighbors(p_id uuid,p_start date,p_end date) returns jsonb
language sql stable security invoker set search_path=public as $$
 select coalesce((select jsonb_build_object('later',later,'earlier',earlier,'position',pos,'total',total)
 from (select id,lag(id) over w later,lead(id) over w earlier,row_number() over w pos,count(*) over() total
 from activities where user_id=auth.uid() and date>=p_start and date<p_end
 window w as (order by date desc,created_at desc nulls last,id desc)) ordered where id=p_id),'{}'::jsonb);
$$;

-- Date tier is recalculated from the current original date, never a stored label.
create function public.memory_date_tier(p_date date,p_today date) returns integer
language sql immutable set search_path=public as $$
 select case when extract(year from p_date)>=extract(year from p_today) then 2
  when to_char(p_date,'MM-DD')=to_char(p_today,'MM-DD') then 0
  when exists(select 1 from generate_series(-1,1) y
   cross join lateral (select make_date(extract(year from p_today)::int+y,extract(month from p_date)::int,1)
     +extract(day from p_date)::int-1 anniversary) x
   -- In non-leap years Feb 29 rolls to March 1 for nearby matching only.
   -- The exact tier above always requires the original month/day.
   where abs(anniversary-p_today)<=14) then 1 else 2 end;
$$;

create function public.memory_feature(p_timezone text default 'UTC') returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); today date; chosen uuid; record_day memory_days;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then p_timezone:='UTC'; end if;
 today:=(now() at time zone p_timezone)::date;
 -- Serialize assignment across tabs/devices, including an empty day's selection.
 perform pg_advisory_xact_lock(hashtextextended(uid::text||today::text,0));
 select * into record_day from memory_days where user_id=uid and day=today;
 if not found then
  with candidates as (
   select a.id,memory_date_tier(a.date,today) tier,
    (nullif(btrim(a.notes),'') is not null or a.note_image_url is not null or
     exists(select 1 from activity_photos p where p.activity_id=a.id and p.user_id=uid)) rich
   from activities a where a.user_id=uid and a.date<=today-90
    and not exists(select 1 from memory_dismissals d where d.user_id=uid and d.activity_id=a.id)
    and not exists(select 1 from memory_days d where d.user_id=uid and d.activity_id=a.id
      and d.day<>today and d.exposed_at>now()-interval '30 days')
  ) select id into chosen from candidates where tier=(select min(tier) from candidates)
    order by case when rich=(mod(today-date '2000-01-01',3)<>0) then 0 else 1 end,
      md5(uid::text||today::text||id::text),id limit 1;
  insert into memory_days(user_id,day,activity_id) values(uid,today,chosen);
  select * into record_day from memory_days where user_id=uid and day=today;
 end if;
 if record_day.hidden then return jsonb_build_object('day',today); end if;
 select id into chosen from activities a where a.id=record_day.activity_id and a.user_id=uid
  and a.date<=today-90 and not exists(select 1 from memory_dismissals d where d.user_id=uid and d.activity_id=a.id);
 return jsonb_build_object('day',today,'id',chosen,'tier',(select memory_date_tier(date,today) from activities where id=chosen and user_id=uid));
end; $$;

create function public.memory_feature_action(p_day date,p_id uuid,p_hide boolean default false) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from memory_days d join activities a on a.id=d.activity_id
  where d.user_id=auth.uid() and d.day=p_day and d.activity_id=p_id and a.user_id=auth.uid()) then return; end if;
 if p_hide then
  insert into memory_dismissals values(auth.uid(),p_id) on conflict do nothing;
  update memory_days set hidden=true where user_id=auth.uid() and day=p_day;
 else
  update memory_days set exposed_at=coalesce(exposed_at,now()) where user_id=auth.uid() and day=p_day and not hidden;
 end if;
end; $$;
revoke all on function public.memory_archive(),public.memory_page(date,date,jsonb),public.memory_neighbors(uuid,date,date),public.memory_date_tier(date,date),public.memory_feature(text),public.memory_feature_action(date,uuid,boolean) from public,anon;
grant execute on function public.memory_archive(),public.memory_page(date,date,jsonb),public.memory_neighbors(uuid,date,date),public.memory_date_tier(date,date),public.memory_feature(text),public.memory_feature_action(date,uuid,boolean) to authenticated;
