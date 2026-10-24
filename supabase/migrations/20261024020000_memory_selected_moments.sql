-- Read-time selection only. No activity content is copied, scored or removed.
-- Notes are the existing user-authored field; current importers never fill it
-- with descriptions. Titles, effort defaults and workout metrics are not signals.
create function public.memory_material(p_start date,p_end date)
returns table(id uuid,date date,created_at timestamp,type text,material text,selected boolean)
language sql stable security invoker set search_path=public,pg_temp as $$
 with classified as (
  select a.id,a.date,a.created_at,a.type,
   case when nullif(btrim(a.notes),'') is not null or a.note_image_url is not null or a.note_thumb_image_url is not null
    or exists(select 1 from activity_photos p where p.activity_id=a.id and p.user_id=auth.uid()
     and (p.image_path is not null or p.thumb_path is not null)) then 'personal'
   when a.feeling_during is not null or a.feeling_after is not null or a.feeling is not null
    or exists(select 1 from activity_equipment e where e.activity_id=a.id) then 'details'
   else 'basic' end material
  from activities a where a.user_id=auth.uid() and a.date>=p_start and a.date<p_end
 ), samples as (
  select *,row_number() over(partition by date_trunc('month',date),material
    order by md5(auth.uid()::text||to_char(date,'YYYY-MM')||id::text),id) sample
  from classified
 ) select id,date,created_at,type,material,(material='personal' or sample=1) selected from samples;
$$;

create function public.memory_summary(p_id uuid) returns jsonb
language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('id',a.id,'date',a.date,'created_at',a.created_at,'title',a.title,'type',a.type,
  'notes',left(a.notes,180),'note_image_url',a.note_image_url,'note_thumb_image_url',a.note_thumb_image_url,
  'photos',coalesce((select jsonb_agg(p) from (select id,image_path,thumb_path,sort_order,created_at
   from activity_photos where activity_id=a.id and user_id=auth.uid()
   order by sort_order nulls last,created_at,id limit 3) p),'[]'::jsonb))
 from activities a where a.id=p_id and a.user_id=auth.uid();
$$;

create function public.memory_archive_v2() returns jsonb
language sql stable security invoker set search_path=public,pg_temp as $$
 with material as materialized (select * from memory_material('-infinity','infinity')),
 counts as (select to_char(date,'YYYY-MM') month_key,count(*) filter(where selected) selected_count,
   count(*) filter(where material='personal') personal_count from material group by 1)
 select coalesce(jsonb_agg(a.value||jsonb_build_object('selected_count',c.selected_count,'personal_count',c.personal_count,
   'moments',(select coalesce(jsonb_agg(memory_summary(m.id) order by m.date desc,m.created_at desc nulls last,m.id desc),'[]'::jsonb)
    from (select id,date,created_at from material where to_char(date,'YYYY-MM')=c.month_key and selected
      order by date desc,created_at desc nulls last,id desc limit 3) m)) order by c.month_key desc),'[]'::jsonb)
 from jsonb_array_elements(memory_archive()) a join counts c on c.month_key=a.value->>'month';
$$;

create function public.memory_page_v2(p_start date,p_end date,p_before jsonb default null,p_selected boolean default true)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(memory_summary(m.id) order by m.date desc,m.created_at desc nulls last,m.id desc),'[]'::jsonb)
 from (select * from memory_material(p_start,p_end) where (not p_selected or selected)
  and (p_before is null or (date,coalesce(created_at,'-infinity'::timestamp),id)<
    ((p_before->>'date')::date,coalesce((p_before->>'created_at')::timestamp,'-infinity'::timestamp),(p_before->>'id')::uuid))
  order by date desc,created_at desc nulls last,id desc limit 40) m;
$$;

create function public.memory_neighbors_v2(p_id uuid,p_start date,p_end date,p_selected boolean default true,p_include uuid default null)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select coalesce((select jsonb_build_object('later',later,'earlier',earlier,'position',pos,'total',total)
 from (select id,lag(id) over w later,lead(id) over w earlier,row_number() over w pos,count(*) over() total
  from memory_material(p_start,p_end) where not p_selected or selected or id=p_include
  window w as(order by date desc,created_at desc nulls last,id desc)) ordered where id=p_id),'{}'::jsonb);
$$;

-- Featured selection stays independent of the monthly samples and retains the
-- existing age/date/cooldown rules and broader-photo day. Photos and notes have
-- equal preference, regardless of word count or number of photos.
create or replace function public.memory_pick_candidate(p_today date) returns uuid
language sql stable security invoker set search_path=public,pg_temp as $$
 with candidates as (
  select m.id,m.type,m.material,memory_date_tier(m.date,p_today) tier,
   (a.note_image_url is not null or a.note_thumb_image_url is not null or exists(
     select 1 from activity_photos p where p.activity_id=m.id and p.user_id=auth.uid()
      and (p.image_path is not null or p.thumb_path is not null))) has_photo
  from memory_material('-infinity',p_today-89) m join activities a on a.id=m.id and a.user_id=auth.uid()
  where not exists(select 1 from memory_dismissals d where d.user_id=auth.uid() and d.activity_id=m.id)
   and not exists(select 1 from memory_days d where d.user_id=auth.uid() and d.activity_id=m.id
     and d.day<>p_today and d.exposed_at>now()-interval '30 days')
 ), best as(select min(tier) tier from candidates), pool as(
  select case when best.tier=1 and mod(p_today-date '2000-01-01',3)=1
    and not exists(select 1 from candidates where tier=1 and has_photo)
    and exists(select 1 from candidates where has_photo) then 2 else best.tier end tier from best
 ), last_type as (
  select a.type from memory_days d join activities a on a.id=d.activity_id and a.user_id=auth.uid()
   where d.user_id=auth.uid() and d.day<>p_today and d.exposed_at>now()-interval '30 days'
   order by d.exposed_at desc,d.day desc limit 1
 ) select id from candidates where tier=(select tier from pool)
   and (not ((select tier from best)=1 and (select tier from pool)=2) or has_photo)
 order by case when mod(p_today-date '2000-01-01',3)=0 then
   case material when 'basic' then 0 when 'details' then 1 else 2 end
  else case material when 'personal' then 0 when 'details' then 1 else 2 end end,
  case when type=(select type from last_type) then 1 else 0 end,
  md5(auth.uid()::text||p_today::text||id::text),id limit 1;
$$;

revoke all on function public.memory_material(date,date),public.memory_summary(uuid),public.memory_archive_v2(),
 public.memory_page_v2(date,date,jsonb,boolean),public.memory_neighbors_v2(uuid,date,date,boolean,uuid) from public,anon;
grant execute on function public.memory_material(date,date),public.memory_summary(uuid),public.memory_archive_v2(),
 public.memory_page_v2(date,date,jsonb,boolean),public.memory_neighbors_v2(uuid,date,date,boolean,uuid) to authenticated;
