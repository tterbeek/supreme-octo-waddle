-- Addendum: one conversation per canonical activity. Dev-only restricted history
-- is retired in place, not copied into the broader audience. No Journal or
-- connection/share decisions are rewritten.
revoke execute on function public.social_conversation(uuid,text,jsonb) from public,anon,authenticated;

create table public.social_activity_comments(
 id uuid primary key default gen_random_uuid(),activity_id uuid not null references public.activities on delete cascade,
 author_id uuid not null references auth.users on delete cascade,body text not null check(length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index social_activity_comments_page on public.social_activity_comments(activity_id,created_at,id);
create index social_activity_comments_author on public.social_activity_comments(author_id,created_at,id);
create table public.social_activity_reactions(
 activity_id uuid references public.activities on delete cascade,author_id uuid references auth.users on delete cascade,
 reaction text not null check(reaction in('CHEER','INSPIRED','ENERGY','BEAUTIFUL','MOVED')),primary key(activity_id,author_id)
);
create table public.social_activity_reports(
 id uuid primary key default gen_random_uuid(),activity_id uuid not null references public.activities on delete cascade,
 reporter_id uuid not null references auth.users on delete cascade,comment_id uuid references public.social_activity_comments on delete set null,
 reason text not null check(length(btrim(reason)) between 1 and 1000),created_at timestamptz not null default now(),resolved_at timestamptz
);
alter table public.social_activity_comments enable row level security;
alter table public.social_activity_reactions enable row level security;
alter table public.social_activity_reports enable row level security;
revoke all on public.social_activity_comments,public.social_activity_reactions,public.social_activity_reports from public,anon,authenticated;

create function public.social_can_view_activity(p_activity uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select social_enabled() and auth.uid() is not null and exists(select 1 from activities a where a.id=p_activity
  and (a.user_id=auth.uid() or exists(select 1 from social_contexts s where s.activity_id=a.id and social_can_read(s.id))));
$$;
create function public.social_discussion_counts(p_activity uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select case when social_can_view_activity(p_activity) then jsonb_build_object(
 'comment_count',(select count(*) from social_activity_comments where activity_id=p_activity and not social_blocked(author_id,auth.uid())),
 'reaction_counts',(select coalesce(jsonb_agg(jsonb_build_object('reaction',r.reaction,'count',r.n)),'[]') from (
  select reaction,count(*) n from social_activity_reactions where activity_id=p_activity and not social_blocked(author_id,auth.uid()) group by reaction) r)) else null end;
$$;

-- Reuse the safe placement projection and its deduplication/keyset pagination.
alter function public.social_feed(uuid,jsonb,uuid) rename to social_feed_placements;
revoke execute on function public.social_feed_placements(uuid,jsonb,uuid) from public,anon,authenticated;
create function public.social_feed(p_audience uuid default null,p_before jsonb default null,p_activity uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare rows jsonb;owner_row jsonb;begin
 rows:=social_feed_placements(p_audience,p_before,p_activity);
 -- An owner may open/manage their thread by activity ID even with zero shares.
 -- Private activities are never added to the ordinary feed.
 if p_activity is not null and rows='[]' and social_can_view_activity(p_activity) then
  select jsonb_build_object('id',a.id,'date',a.date,'shared_at',null,'author_id',a.user_id,
   'author',coalesce(nullif(up.social_display_name,''),'MoveNotes member'),'title',a.title,'type',a.type,
   'distance_km',a.distance_km,'duration_min',a.duration_min,'public_note',a.public_note,'photos','[]'::jsonb,'contexts','[]'::jsonb)
   into owner_row from activities a left join user_preferences up on up.user_id=a.user_id where a.id=p_activity and a.user_id=auth.uid();
  if owner_row is not null then rows:=jsonb_build_array(owner_row);end if;
 end if;
 return (select coalesce(jsonb_agg(r.value||social_discussion_counts((r.value->>'id')::uuid) order by r.ordinality),'[]')
  from jsonb_array_elements(rows) with ordinality r(value,ordinality));
end; $$;

create function public.social_discussion(p_activity uuid,p_action text default 'read',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();owner_id uuid;moderator boolean;comment_page jsonb;target uuid;begin
 if not social_can_view_activity(p_activity) then raise exception 'Conversation unavailable';end if;
 select user_id into owner_id from activities where id=p_activity;moderator:=owner_id=uid;
 if p_action<>'read' and not social_rate('conversation:'||uid,30) then raise exception 'Please try again shortly';end if;
 if p_action='comment' then
  insert into social_activity_comments(activity_id,author_id,body) values(p_activity,uid,btrim(p_data->>'body'));
 elsif p_action='delete_comment' then
  delete from social_activity_comments where id=(p_data->>'id')::uuid and activity_id=p_activity and (author_id=uid or moderator);
  if not found then raise exception 'Comment unavailable';end if;
 elsif p_action='reaction' then
  if p_data->>'reaction' is null then delete from social_activity_reactions where activity_id=p_activity and author_id=uid;
  else insert into social_activity_reactions values(p_activity,uid,p_data->>'reaction')
   on conflict(activity_id,author_id) do update set reaction=excluded.reaction;end if;
 elsif p_action='report' then
  if p_data->>'comment' is not null and not exists(select 1 from social_activity_comments where id=(p_data->>'comment')::uuid
    and activity_id=p_activity and not social_blocked(author_id,uid)) then raise exception 'Comment unavailable';end if;
  insert into social_activity_reports(activity_id,reporter_id,comment_id,reason)
   values(p_activity,uid,(p_data->>'comment')::uuid,btrim(p_data->>'reason'));
 elsif p_action='resolve_report' then
  if not moderator then raise exception 'Only the activity owner can review reports';end if;
  update social_activity_reports set resolved_at=now() where id=(p_data->>'id')::uuid and activity_id=p_activity;
 elsif p_action='block' then
  target:=coalesce((p_data->>'author')::uuid,owner_id);
  if target=uid or (target<>owner_id and not exists(select 1 from social_activity_comments
   where activity_id=p_activity and author_id=target and not social_blocked(target,uid))) then raise exception 'Member unavailable';end if;
  insert into social_blocks values(uid,target) on conflict do nothing;
  return jsonb_build_object('blocked',true);
 elsif p_action<>'read' then raise exception 'Unknown conversation action';end if;
 with page as materialized(
  select c.*,coalesce(nullif(up.social_display_name,''),'MoveNotes member') author,
   coalesce(nullif(up.social_profile_thumb_path,''),nullif(up.social_profile_image_path,'')) is not null has_avatar
  from social_activity_comments c left join user_preferences up on up.user_id=c.author_id
  where c.activity_id=p_activity and not social_blocked(c.author_id,uid)
   and (p_action<>'read' or p_data->'before' is null or (c.created_at,c.id)<
    ((p_data->'before'->>'created_at')::timestamptz,(p_data->'before'->>'id')::uuid))
  order by c.created_at desc,c.id desc limit 101
 ), shown as(select * from page order by created_at desc,id desc limit 100)
 select jsonb_build_object('comments',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'author_id',author_id,'author',author,
  'has_avatar',has_avatar,'body',body,'created_at',created_at,'can_delete',author_id=uid or moderator) order by created_at,id),'[]') from shown),
  'has_more',(select count(*)>100 from page),'before',(select jsonb_build_object('created_at',created_at,'id',id) from shown order by created_at,id limit 1)) into comment_page;
 return comment_page||jsonb_build_object('can_moderate',moderator,
  'reactions',social_discussion_counts(p_activity)->'reaction_counts','comment_count',social_discussion_counts(p_activity)->'comment_count',
  'my_reaction',(select reaction from social_activity_reactions where activity_id=p_activity and author_id=uid),
  'reports',case when moderator then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'reason',reason,'comment_id',comment_id) order by created_at),'[]')
   from social_activity_reports where activity_id=p_activity and resolved_at is null) else '[]'::jsonb end);
end; $$;

-- Past participants retain deletion of their own words, not access to the activity.
create function public.social_own_comments(p_before jsonb default null) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 return (with page as(select id,body,created_at from social_activity_comments where author_id=auth.uid()
  and (p_before is null or (created_at,id)<((p_before->>'created_at')::timestamptz,(p_before->>'id')::uuid))
  order by created_at desc,id desc limit 31),shown as(select * from page order by created_at desc,id desc limit 30)
  select jsonb_build_object('comments',(select coalesce(jsonb_agg(to_jsonb(shown) order by created_at desc,id desc),'[]') from shown),
   'has_more',(select count(*)>30 from page),'before',(select jsonb_build_object('created_at',created_at,'id',id) from shown order by created_at,id limit 1)));
end; $$;
create function public.social_delete_own_comment(p_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 delete from social_activity_comments where id=p_id and author_id=auth.uid();return found;
end; $$;

create function public.social_remove_community_activity(p_activity uuid,p_community uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare audience uuid;begin
 perform 1 from activities where id=p_activity for update;
 perform 1 from communities where id=p_community for update;
 select id into audience from social_audiences where community_id=p_community;
 if not social_enabled() or not social_admin(p_community,auth.uid()) or not exists(select 1 from social_contexts
   where activity_id=p_activity and audience_id=audience and social_can_read(id)) then raise exception 'Placement unavailable';end if;
 perform social_decide(p_activity,audience,'exclude',false);
end; $$;

-- A commenter's avatar is shareable identity only within a currently authorized
-- thread. No private profile or membership data is exposed.
create function public.social_discussion_media_path(p_activity uuid,p_author uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare path text;begin
 if not social_can_view_activity(p_activity) or social_blocked(p_author,auth.uid()) or not exists(
  select 1 from social_activity_comments where activity_id=p_activity and author_id=p_author) then raise exception 'Photo unavailable';end if;
 select coalesce(nullif(social_profile_thumb_path,''),nullif(social_profile_image_path,'')) into path from user_preferences where user_id=p_author;
 if path is null then raise exception 'Photo unavailable';end if;
 return jsonb_build_object('path',path,'owner',p_author);
end; $$;

revoke all on function public.social_can_view_activity(uuid),public.social_discussion_counts(uuid),public.social_feed(uuid,jsonb,uuid),
 public.social_discussion(uuid,text,jsonb),public.social_own_comments(jsonb),public.social_delete_own_comment(uuid),
 public.social_remove_community_activity(uuid,uuid),public.social_discussion_media_path(uuid,uuid) from public,anon,authenticated;
grant execute on function public.social_feed(uuid,jsonb,uuid),public.social_discussion(uuid,text,jsonb),public.social_own_comments(jsonb),
 public.social_delete_own_comment(uuid),public.social_remove_community_activity(uuid,uuid),public.social_discussion_media_path(uuid,uuid) to authenticated;
