-- Aggregate on the server, including complete history for the yearly view.
-- Existing weekly RPCs are retained for older clients.
create function public.stats_activity_trends(p_period text default 'week',p_timezone text default 'UTC')
returns table(activity_type text,period_start date,distance_value numeric,duration_value numeric)
language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare today date;first_day date;begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if p_period is null or p_period not in('week','month','year') then raise exception 'Invalid trend period';end if;
 if p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then p_timezone:='UTC';end if;
 today:=(now() at time zone p_timezone)::date;
 first_day:=case p_period
  when 'week' then date_trunc('week',today)::date-63
  when 'month' then (date_trunc('month',today)-interval '11 months')::date
  else '-infinity'::date end;
 return query select a.type,date_trunc(p_period,a.date)::date,sum(a.distance_km),sum(a.duration_min)
 from activities a where a.user_id=auth.uid() and a.date>=first_day and a.date<=today
  and (a.distance_km is not null or a.duration_min is not null)
 group by a.type,date_trunc(p_period,a.date)::date order by a.type,date_trunc(p_period,a.date)::date;
end;$$;
revoke all on function public.stats_activity_trends(text,text) from public,anon;
grant execute on function public.stats_activity_trends(text,text) to authenticated;
