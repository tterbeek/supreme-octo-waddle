-- Prefer photos within the relevant date pool, before note/detail rotation.
-- Keep existing daily assignments, privacy, dismissal and cooldown behavior.
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
 order by case when has_photo then 0 else 1 end,
  case when mod(p_today-date '2000-01-01',3)=0 then
   case material when 'basic' then 0 when 'details' then 1 else 2 end
  else case material when 'personal' then 0 when 'details' then 1 else 2 end end,
  case when type=(select type from last_type) then 1 else 0 end,
  md5(auth.uid()::text||p_today::text||id::text),id limit 1;
$$;
