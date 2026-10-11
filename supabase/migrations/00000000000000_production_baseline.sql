


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."accept_circle_invite"("p_token" "text", "p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
  v_invite record;
  v_connection record;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select *
  into v_invite
  from public.circle_invite_links l
  where l.token = p_token
  limit 1
  for update;

  if not found then
    return 'invalid';
  end if;

  if v_invite.revoked_at is not null then
    return 'revoked';
  end if;

  if v_invite.expires_at <= now() then
    return 'expired';
  end if;

  if v_invite.accepted_by_user_id is not null and v_invite.accepted_by_user_id <> p_user_id then
    return 'used';
  end if;

  if v_invite.inviter_user_id = p_user_id then
    return 'cannot_accept_own';
  end if;

  select c.*
  into v_connection
  from public.user_connections c
  where
    (c.requester_user_id = v_invite.inviter_user_id and c.addressee_user_id = p_user_id)
    or
    (c.requester_user_id = p_user_id and c.addressee_user_id = v_invite.inviter_user_id)
  order by c.created_at desc
  limit 1
  for update;

  if found then
    if v_connection.status = 'blocked' then
      return 'blocked';
    end if;

    if v_connection.status = 'accepted' then
      update public.circle_invite_links
      set accepted_by_user_id = coalesce(accepted_by_user_id, p_user_id),
          accepted_at = coalesce(accepted_at, now())
      where id = v_invite.id;
      return 'already_connected';
    end if;

    update public.user_connections
    set
      status = 'accepted',
      responded_at = now()
    where id = v_connection.id;
  else
    insert into public.user_connections (
      requester_user_id,
      addressee_user_id,
      status,
      responded_at
    )
    values (
      v_invite.inviter_user_id,
      p_user_id,
      'accepted',
      now()
    );
  end if;

  update public.circle_invite_links
  set accepted_by_user_id = coalesce(accepted_by_user_id, p_user_id),
      accepted_at = coalesce(accepted_at, now())
  where id = v_invite.id;

  return 'connected';
end;
$$;


ALTER FUNCTION "public"."accept_circle_invite"("p_token" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_activities_by_type"() RETURNS TABLE("type" "text", "total" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform admin_assert_owner();
  return query
  select a.type, count(*)::int as total
  from activities a
  group by a.type
  order by count(*) desc;
end;
$$;


ALTER FUNCTION "public"."admin_activities_by_type"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_activities_per_week"() RETURNS TABLE("week" "date", "activities" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$begin
  perform admin_assert_owner();
  return query
  select date_trunc('week', created_at)::date as week,
         count(*)::int as activities
  from activities
  group by 1
  order by 1;
end;$$;


ALTER FUNCTION "public"."admin_activities_per_week"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_activities_this_week"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare result integer;
begin
  perform admin_assert_owner();
  select count(*)::int
  into result
  from activities
  where created_at >= date_trunc('week', now());
  return result;
end;
$$;


ALTER FUNCTION "public"."admin_activities_this_week"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_assert_owner"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  if auth.uid() is null
     or auth.uid() <> '589c83df-8ee7-4319-9203-5b5c9aae0d07'::uuid then
    raise exception 'not allowed';
  end if;
end;
$$;


ALTER FUNCTION "public"."admin_assert_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_new_users_this_week"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare result integer;
begin
  perform admin_assert_owner();
  select count(*)::int
  into result
  from auth.users
  where created_at >= date_trunc('week', now());
  return result;
end;
$$;


ALTER FUNCTION "public"."admin_new_users_this_week"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_top_photo_users"() RETURNS TABLE("email" "text", "photos" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform admin_assert_owner();
  return query
  select u.email::text as email, count(a.note_image_url)::int as photos
  from activities a
  join auth.users u on u.id = a.user_id
  where a.note_image_url is not null
  group by u.email
  order by photos desc
  limit 20;
end;
$$;


ALTER FUNCTION "public"."admin_top_photo_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_total_activities"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare result integer;
begin
  perform admin_assert_owner();
  select count(*)::int into result from activities;
  return result;
end;
$$;


ALTER FUNCTION "public"."admin_total_activities"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_total_users"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare result integer;
begin
  perform admin_assert_owner();
  select count(*)::int into result from auth.users;
  return result;
end;
$$;


ALTER FUNCTION "public"."admin_total_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_users_over_50_photos"() RETURNS TABLE("email" "text", "photos" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform admin_assert_owner();
  return query
  select u.email::text as email, count(a.note_image_url)::int as photos
  from activities a
  join auth.users u on u.id = a.user_id
  where a.note_image_url is not null
  group by u.email
  having count(a.note_image_url) > 50
  order by photos desc;
end;
$$;


ALTER FUNCTION "public"."admin_users_over_50_photos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_users_per_week"() RETURNS TABLE("week" "date", "new_users" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform admin_assert_owner();
  return query
  select date_trunc('week', created_at)::date as week,
         count(*)::int as new_users
  from auth.users
  group by 1
  order by 1;
end;
$$;


ALTER FUNCTION "public"."admin_users_per_week"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_circle_share"("p_activity_share_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.activity_shares s
    left join public.activity_share_recipients r
      on r.activity_share_id = s.id
     and r.recipient_user_id = p_user_id
     and r.hidden_at is null
    where s.id = p_activity_share_id
      and s.deleted_at is null
      and s.expires_at > now()
      and (s.author_user_id = p_user_id or r.id is not null)
  );
$$;


ALTER FUNCTION "public"."can_access_circle_share"("p_activity_share_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_circle_invite_links"("p_expired_retention" interval DEFAULT '30 days'::interval, "p_used_retention" interval DEFAULT '90 days'::interval) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_deleted integer := 0;
begin
  delete from public.circle_invite_links l
  where
    (l.expires_at < now() - p_expired_retention)
    or (l.accepted_at is not null and l.accepted_at < now() - p_used_retention)
    or (l.revoked_at is not null and l.revoked_at < now() - p_used_retention);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;


ALTER FUNCTION "public"."cleanup_circle_invite_links"("p_expired_retention" interval, "p_used_retention" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_circle_invite_link"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
  v_token text;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  insert into public.circle_invite_links (inviter_user_id)
  values (p_user_id)
  returning token into v_token;

  return v_token;
end;
$$;


ALTER FUNCTION "public"."create_circle_invite_link"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_user_activity_types_seeded"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1
    from public.user_activity_types
    where user_id = auth.uid()
    limit 1
  ) then
    return;
  end if;

  insert into public.user_activity_types (user_id, activity_type, sort_order, is_enabled)
  values
    (auth.uid(),'run',10,true),
    (auth.uid(),'ride',20,true),
    (auth.uid(),'walk',30,true),
    (auth.uid(),'hike',40,true),
    (auth.uid(),'swim',50,true),
    (auth.uid(),'strength',60,true),
    (auth.uid(),'yoga',70,true),
    (auth.uid(),'restore',80,true),
    (auth.uid(),'other',90,true);
end;
$$;


ALTER FUNCTION "public"."ensure_user_activity_types_seeded"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_circle_connected_friends"("p_user_id" "uuid") RETURNS TABLE("friend_user_id" "uuid", "label" "text", "profile_image_path" "text", "profile_thumb_path" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  return query
  with connected as (
    select distinct
      case
        when c.requester_user_id = p_user_id then c.addressee_user_id
        else c.requester_user_id
      end as friend_id
    from public.user_connections c
    where c.status = 'accepted'
      and (c.requester_user_id = p_user_id or c.addressee_user_id = p_user_id)
  )
  select
    c.friend_id as friend_user_id,
    coalesce(
      nullif(up.social_display_name, ''),
      nullif(up.login_email, ''),
      au.email::text
    ) as label,
    up.social_profile_image_path as profile_image_path,
    up.social_profile_thumb_path as profile_thumb_path
  from connected c
  left join public.user_preferences up
    on up.user_id = c.friend_id
  left join auth.users au
    on au.id = c.friend_id;
end;
$$;


ALTER FUNCTION "public"."get_circle_connected_friends"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_circle_feed"("p_user_id" "uuid", "p_limit" integer DEFAULT 30, "p_before_occurred_on" "date" DEFAULT NULL::"date", "p_before_shared_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_before_recipient_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("recipient_id" "uuid", "activity_share_id" "uuid", "shared_at" timestamp with time zone, "occurred_on" "date", "author_user_id" "uuid", "author_display_name" "text", "author_profile_image_path" "text", "author_profile_thumb_path" "text", "title" "text", "activity_type" "text", "distance_km" numeric, "duration_min" numeric, "shared_photo_url" "text", "shared_thumb_photo_url" "text", "photos" "jsonb", "tags" "jsonb", "reaction_groups" "jsonb", "current_user_reaction" "text", "has_new_reactions" boolean, "seen_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with viewer as (
    select up.circle_last_seen_at
    from public.user_preferences up
    where up.user_id = p_user_id
  )
  select
    r.id as recipient_id,
    r.activity_share_id,
    r.shared_at,
    s.occurred_on,
    s.author_user_id,
    coalesce(
      nullif(up.social_display_name, ''),
      split_part(coalesce(up.login_email, ''), '@', 1),
      'Mover'
    ) as author_display_name,
    up.social_profile_image_path as author_profile_image_path,
    up.social_profile_thumb_path as author_profile_thumb_path,
    s.title,
    s.activity_type,
    s.distance_km,
    s.duration_min,
    s.shared_photo_url,
    s.shared_thumb_photo_url,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'image_path', sp.image_path,
            'thumb_path', sp.thumb_path,
            'sort_order', sp.sort_order
          )
          order by sp.sort_order asc, sp.created_at asc, sp.id asc
        )
        from public.activity_share_photos sp
        where sp.activity_share_id = s.id
      ),
      case
        when s.shared_photo_url is not null then jsonb_build_array(
          jsonb_build_object(
            'image_path', s.shared_photo_url,
            'thumb_path', s.shared_thumb_photo_url,
            'sort_order', 0
          )
        )
        else '[]'::jsonb
      end
    ) as photos,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'type', st.type,
            'value', st.value,
            'metadata', st.metadata,
            'source', st.source
          )
          order by st.created_at asc, st.id asc
        )
        from public.activity_share_tags st
        where st.activity_share_id = s.id
      ),
      '[]'::jsonb
    ) as tags,
    coalesce(rg.reaction_groups, '{}'::jsonb) as reaction_groups,
    cur.current_user_reaction,
    case
      when s.author_user_id = p_user_id then coalesce(nr.has_new_reactions, false)
      else false
    end as has_new_reactions,
    r.seen_at
  from public.activity_share_recipients r
  join public.activity_shares s
    on s.id = r.activity_share_id
  left join public.user_preferences up
    on up.user_id = s.author_user_id
  left join viewer v
    on true
  left join lateral (
    select jsonb_object_agg(grouped.reaction_type, grouped.reactors) as reaction_groups
    from (
      select
        ar.reaction_type,
        jsonb_agg(
          jsonb_build_object(
            'user_id', ar.user_id,
            'name', coalesce(
              nullif(upr.social_display_name, ''),
              split_part(coalesce(upr.login_email, ''), '@', 1),
              'Mover'
            ),
            'profile_thumb_path', upr.social_profile_thumb_path,
            'reacted_at', ar.updated_at
          )
          order by ar.updated_at desc, ar.user_id
        ) as reactors
      from public.activity_share_reactions ar
      left join public.user_preferences upr
        on upr.user_id = ar.user_id
      where ar.activity_share_id = s.id
      group by ar.reaction_type
    ) grouped
  ) rg
    on true
  left join lateral (
    select ar.reaction_type as current_user_reaction
    from public.activity_share_reactions ar
    where ar.activity_share_id = s.id
      and ar.user_id = p_user_id
    limit 1
  ) cur
    on true
  left join lateral (
    select exists (
      select 1
      from public.activity_share_reactions ar
      where ar.activity_share_id = s.id
        and ar.user_id <> p_user_id
        and ar.updated_at > coalesce(v.circle_last_seen_at, to_timestamp(0))
    ) as has_new_reactions
  ) nr
    on true
  where auth.uid() = p_user_id
    and r.recipient_user_id = p_user_id
    and r.hidden_at is null
    and s.deleted_at is null
    and s.expires_at > now()
    and (
      p_before_occurred_on is null
      or p_before_shared_at is null
      or p_before_recipient_id is null
      or (s.occurred_on, r.shared_at, r.id) < (p_before_occurred_on, p_before_shared_at, p_before_recipient_id)
    )
  order by s.occurred_on desc, r.shared_at desc, r.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;


ALTER FUNCTION "public"."get_circle_feed"("p_user_id" "uuid", "p_limit" integer, "p_before_occurred_on" "date", "p_before_shared_at" timestamp with time zone, "p_before_recipient_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_circle_invite_preview"("p_token" "text") RETURNS TABLE("invite_status" "text", "inviter_user_id" "uuid", "friendly_name" "text", "account_email" "text", "profile_image_path" "text", "profile_thumb_path" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invite record;
  v_email text;
begin
  select l.*
  into v_invite
  from public.circle_invite_links l
  where l.token = p_token
  limit 1;

  if not found then
    return query select
      'invalid'::text,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  if v_invite.revoked_at is not null then
    return query select
      'revoked'::text,
      v_invite.inviter_user_id,
      null::text,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  if v_invite.expires_at <= now() then
    return query select
      'expired'::text,
      v_invite.inviter_user_id,
      null::text,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  if v_invite.accepted_by_user_id is not null then
    return query select
      'used'::text,
      v_invite.inviter_user_id,
      null::text,
      null::text,
      null::text,
      null::text;
    return;
  end if;

  select up.login_email
  into v_email
  from public.user_preferences up
  where up.user_id = v_invite.inviter_user_id;

  return query
  select
    'active'::text as invite_status,
    v_invite.inviter_user_id,
    coalesce(
      nullif(up.social_display_name, ''),
      split_part(coalesce(up.login_email, ''), '@', 1),
      'Mover'
    ) as friendly_name,
    up.login_email as account_email,
    up.social_profile_image_path as profile_image_path,
    up.social_profile_thumb_path as profile_thumb_path
  from public.user_preferences up
  where up.user_id = v_invite.inviter_user_id
  union all
  select
    'active'::text,
    v_invite.inviter_user_id,
    coalesce(split_part(coalesce(v_email, ''), '@', 1), 'Mover'),
    v_email,
    null::text,
    null::text
  where not exists (
    select 1
    from public.user_preferences up2
    where up2.user_id = v_invite.inviter_user_id
  )
  limit 1;
end;
$$;


ALTER FUNCTION "public"."get_circle_invite_preview"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_goal_history_dots"("user_id" "uuid", "max_periods" integer DEFAULT 5) RETURNS TABLE("goal_id" "uuid", "period_start" "date", "period_end" "date", "period_value" numeric, "dot_state" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  caller uuid := auth.uid();
  target_user uuid := user_id;
  k int := greatest(1, least(coalesce(max_periods, 5), 12)); -- safety clamp
begin
  if caller is null or caller <> target_user then
    raise exception 'unauthorized';
  end if;

  return query
  with goals_scoped as (
    select
      g.id as goal_id,
      g.activity_type,
      g.metric,
      g.period,
      g.target,
      g.effective_from,
      case g.period
        when 'week'  then date_trunc('week',  current_date)::date
        when 'month' then date_trunc('month', current_date)::date
        else              date_trunc('year',  current_date)::date
      end as current_start
    from public.goals g
    where g.user_id = target_user
  ),
  periods as (
    select
      gs.goal_id,
      gs.activity_type,
      gs.metric,
      gs.period,
      gs.target,
      gs.effective_from,
      p_start::date as period_start,
      case gs.period
        when 'week'  then (p_start + interval '1 week')::date
        when 'month' then (p_start + interval '1 month')::date
        else              (p_start + interval '1 year')::date
      end as period_end,
      gs.current_start
    from goals_scoped gs
    join lateral generate_series(
      (gs.current_start::timestamptz
        - case gs.period
            when 'week'  then interval '1 week'  * (k + 6)
            when 'month' then interval '1 month' * (k + 6)
            else              interval '1 year'  * (k + 6)
          end
      ),
      (gs.current_start::timestamptz
        - case gs.period
            when 'week'  then interval '1 week'
            when 'month' then interval '1 month'
            else              interval '1 year'
          end
      ),
      case gs.period
        when 'week'  then interval '1 week'
        when 'month' then interval '1 month'
        else              interval '1 year'
      end
    ) as p_start on true
  ),
  eligible_periods as (
    select p.*
    from periods p
    where p.period_end >= p.effective_from
      and p.period_end <= p.current_start
  ),
  totals as (
    select
      ep.goal_id,
      ep.period_start,
      ep.period_end,
      ep.metric,
      ep.target,
      sum(a.distance_km) as dist,
      sum(a.duration_min) as dur,
      count(a.id)         as cnt
    from eligible_periods ep
    left join public.activities a
      on a.user_id = target_user
     and a.date >= ep.period_start
     and a.date <  ep.period_end
     and (ep.activity_type = 'any' or a.type = ep.activity_type)
    group by ep.goal_id, ep.period_start, ep.period_end, ep.metric, ep.target
  ),
  shaped as (
    select
      t.goal_id,
      t.period_start,
      t.period_end,
      case t.metric
        when 'distance' then coalesce(t.dist, 0)::numeric
        when 'duration' then coalesce(t.dur, 0)::numeric
        else                 coalesce(t.cnt, 0)::numeric
      end as period_value,
      t.target
    from totals t
  ),
  ranked as (
    select
      s.*,
      row_number() over (partition by s.goal_id order by s.period_start desc) as rn
    from shaped s
  )
  select
    r.goal_id,
    r.period_start,
    r.period_end,
    r.period_value,
    case
      when r.target <= 0 then null
      when r.period_value >= (r.target * 0.9) then 2
      when r.period_value >= (r.target * 0.5) then 1
      else 0
    end as dot_state
  from ranked r
  where r.rn <= k
  order by r.goal_id, r.period_start asc;

end;
$$;


ALTER FUNCTION "public"."get_goal_history_dots"("user_id" "uuid", "max_periods" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_journal_feed_page"("p_limit" integer, "p_offset" integer DEFAULT 0) RETURNS TABLE("entry_kind" "text", "day" "date", "within_day_ts" timestamp with time zone, "id" "uuid", "user_id" "uuid", "type" "text", "date" "date", "distance_km" numeric, "feeling" integer, "created_at" timestamp without time zone, "title" "text", "effort" integer, "notes" "text", "note_updated_at" timestamp with time zone, "note_image_url" "text", "duration_min" numeric, "note_thumb_image_url" "text", "entry_type" "text", "entry_text" "text", "journal_created_at" timestamp with time zone, "metadata" "jsonb", "equipment" "jsonb")
    LANGUAGE "sql"
    AS $$
with activity_rows as (
  select
    'activity'::text as entry_kind,
    a.date as day,
    timezone('UTC', a.created_at) as within_day_ts,
    a.id,

    a.user_id,
    a.type,
    a.date,
    a.distance_km,
    a.feeling,
    a.created_at,
    a.title,
    a.effort,
    a.notes,
    a.note_updated_at,
    a.note_image_url,
    a.duration_min,
    a.note_thumb_image_url,

    null::text as entry_type,
    null::text as entry_text,
    null::timestamptz as journal_created_at,

    '{}'::jsonb as metadata,

    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'name', e.name,
          'notes', e.notes,
          'is_active', e.is_active
        )
      ) filter (where e.id is not null),
      '[]'::jsonb
    ) as equipment
  from public.activities a
  left join public.activity_equipment ae
    on ae.activity_id = a.id
  left join public.equipment e
    on e.id = ae.equipment_id
  where a.user_id = auth.uid()
  group by a.id
),
journal_rows as (
  select
    'journal_entry'::text as entry_kind,
    (je.created_at)::date as day,
    je.created_at as within_day_ts,
    je.id,

    je.user_id,
    null::text as type,
    null::date as date,
    null::numeric as distance_km,
    null::integer as feeling,
    null::timestamp without time zone as created_at,
    null::text as title,
    null::integer as effort,
    null::text as notes,
    null::timestamptz as note_updated_at,
    null::text as note_image_url,
    null::numeric as duration_min,
    null::text as note_thumb_image_url,

    je.entry_type,
    je.text as entry_text,
    je.created_at as journal_created_at,

    coalesce(je.metadata, '{}'::jsonb) as metadata,

    '[]'::jsonb as equipment
  from public.journal_entries je
  where je.user_id = auth.uid()
)
select *
from (
  select * from activity_rows
  union all
  select * from journal_rows
) x
order by x.day desc, x.within_day_ts desc, x.id desc
limit p_limit
offset p_offset;
$$;


ALTER FUNCTION "public"."get_journal_feed_page"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_journal_feed_page_v2"("p_limit" integer, "p_offset" integer) RETURNS TABLE("entry_kind" "text", "day" "date", "within_day_ts" timestamp with time zone, "id" "uuid", "user_id" "uuid", "type" "text", "date" "date", "distance_km" numeric, "feeling" integer, "feeling_during" "text", "feeling_after" "text", "created_at" timestamp without time zone, "title" "text", "effort" integer, "notes" "text", "note_updated_at" timestamp with time zone, "note_image_url" "text", "duration_min" numeric, "note_thumb_image_url" "text", "entry_type" "text", "entry_text" "text", "journal_created_at" timestamp with time zone, "metadata" "jsonb", "equipment" "jsonb", "photos" "jsonb", "source" "text", "raw_sport_type" "text", "raw_type" "text", "external_source" "text", "external_id" "text", "started_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
with activity_rows as (
  select
    'activity'::text as entry_kind,
    a.date as day,
    coalesce(a.started_at, timezone('UTC', a.created_at)) as within_day_ts,
    a.id,

    a.user_id,
    a.type,
    a.date,
    a.distance_km,
    a.feeling,
    coalesce(
      a.feeling_during,
      case a.feeling
        when 1 then 'sad'
        when 2 then 'neutral'
        when 3 then 'smile'
        when 4 then 'happy'
        else null
      end
    ) as feeling_during,
    a.feeling_after,
    a.created_at,
    a.title,
    a.effort,
    a.notes,
    a.note_updated_at,

    coalesce(
      (
        select p.image_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_image_url
    ) as note_image_url,

    a.duration_min,

    coalesce(
      (
        select p.thumb_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_thumb_image_url
    ) as note_thumb_image_url,

    null::text as entry_type,
    null::text as entry_text,
    null::timestamptz as journal_created_at,

    '{}'::jsonb as metadata,

    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'name', e.name,
          'notes', e.notes,
          'is_active', e.is_active
        )
      ) filter (where e.id is not null),
      '[]'::jsonb
    ) as equipment,

    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'image_path', p.image_path,
            'thumb_path', p.thumb_path,
            'sort_order', p.sort_order,
            'created_at', p.created_at
          )
          order by p.sort_order asc, p.created_at asc, p.id asc
        )
        from public.activity_photos p
        where p.activity_id = a.id
      ),
      '[]'::jsonb
    ) as photos,

    a.source,
    a.raw_sport_type,
    a.raw_type,
    a.external_source,
    a.external_id,
    a.started_at

  from public.activities a
  left join public.activity_equipment ae
    on ae.activity_id = a.id
  left join public.equipment e
    on e.id = ae.equipment_id
  where a.user_id = auth.uid()
  group by a.id
),
journal_rows as (
  select
    'journal_entry'::text as entry_kind,
    (je.created_at)::date as day,
    je.created_at as within_day_ts,
    je.id,

    je.user_id,
    null::text as type,
    null::date as date,
    null::numeric as distance_km,
    null::integer as feeling,
    null::text as feeling_during,
    null::text as feeling_after,
    null::timestamp without time zone as created_at,
    null::text as title,
    null::integer as effort,
    null::text as notes,
    null::timestamptz as note_updated_at,
    null::text as note_image_url,
    null::numeric as duration_min,
    null::text as note_thumb_image_url,

    je.entry_type,
    je.text as entry_text,
    je.created_at as journal_created_at,

    coalesce(je.metadata, '{}'::jsonb) as metadata,
    '[]'::jsonb as equipment,
    '[]'::jsonb as photos,

    null::text as source,
    null::text as raw_sport_type,
    null::text as raw_type,
    null::text as external_source,
    null::text as external_id,
    null::timestamptz as started_at
  from public.journal_entries je
  where je.user_id = auth.uid()
)
select *
from (
  select * from activity_rows
  union all
  select * from journal_rows
) x
order by x.day desc, x.within_day_ts desc, x.id desc
limit p_limit
offset p_offset;
$$;


ALTER FUNCTION "public"."get_journal_feed_page_v2"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_micro_adjustment_suggestions_rotating"("user_id" "uuid", "n" integer DEFAULT 4, "exclude_shown_days" integer DEFAULT 7, "exclude_selected_days" integer DEFAULT 30) RETURNS TABLE("id" "uuid", "text" "text", "short_text" "text", "category" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  caller uuid := auth.uid();
  target_user uuid := user_id;
  take_n int := greatest(1, least(coalesce(n, 4), 6));
begin
  if caller is null or caller <> target_user then
    raise exception 'unauthorized';
  end if;

  return query
  with params as (
    select
      now() - make_interval(days => greatest(0, coalesce(exclude_shown_days, 7))) as shown_cutoff,
      now() - make_interval(days => greatest(0, coalesce(exclude_selected_days, 30))) as selected_cutoff
  ),

  base as (
    select
      s.id as suggestion_id,
      s.text as suggestion_text,
      s.short_text as suggestion_short_text,
      s.category as suggestion_category
    from public.micro_adjustment_suggestions s
    where s.is_active = true
  ),

  last_events as (
    select
      e.suggestion_id,
      max(e.event_at) filter (where e.event_type = 'shown')    as last_shown_at,
      max(e.event_at) filter (where e.event_type = 'selected') as last_selected_at
    from public.micro_adjustment_suggestion_events e
    where e.user_id = target_user
    group by e.suggestion_id
  ),

  scored as (
    select
      b.suggestion_id,
      b.suggestion_text,
      b.suggestion_short_text,
      b.suggestion_category,
      greatest(le.last_shown_at, le.last_selected_at) as last_used_at,
      le.last_shown_at,
      le.last_selected_at
    from base b
    left join last_events le on le.suggestion_id = b.suggestion_id
  ),

  eligible_strict as (
    select s.*
    from scored s, params p
    where coalesce(s.last_shown_at,    '-infinity'::timestamptz) < p.shown_cutoff
      and coalesce(s.last_selected_at, '-infinity'::timestamptz) < p.selected_cutoff
  ),

  eligible_relaxed as (
    select s.*
    from scored s, params p
    where coalesce(s.last_selected_at, '-infinity'::timestamptz) < p.selected_cutoff
  ),

  eligible_any as (
    select s.* from scored s
  ),

  -- PICK from STRICT (diverse categories first)
  strict_per_cat as (
    select
      es.suggestion_id,
      es.suggestion_text,
      es.suggestion_short_text,
      es.suggestion_category,
      es.last_used_at,
      row_number() over (
        partition by es.suggestion_category
        order by es.last_used_at asc nulls first, random()
      ) as rn
    from eligible_strict es
  ),
  strict_first_wave as (
    select
      pc.suggestion_id,
      pc.suggestion_text,
      pc.suggestion_short_text,
      pc.suggestion_category,
      pc.last_used_at
    from strict_per_cat pc
    where pc.rn = 1
    order by pc.last_used_at asc nulls first, random()
    limit take_n
  ),
  strict_fill as (
    select
      es.suggestion_id,
      es.suggestion_text,
      es.suggestion_short_text,
      es.suggestion_category,
      es.last_used_at
    from eligible_strict es
    where not exists (select 1 from strict_first_wave fw where fw.suggestion_id = es.suggestion_id)
    order by es.last_used_at asc nulls first, random()
    limit greatest(0, take_n - (select count(*)::int from strict_first_wave))
  ),
  pick_strict as (
    select * from strict_first_wave
    union all
    select * from strict_fill
  ),

  -- PICK from RELAXED (diverse categories first)
  relaxed_per_cat as (
    select
      er.suggestion_id,
      er.suggestion_text,
      er.suggestion_short_text,
      er.suggestion_category,
      er.last_used_at,
      row_number() over (
        partition by er.suggestion_category
        order by er.last_used_at asc nulls first, random()
      ) as rn
    from eligible_relaxed er
  ),
  relaxed_first_wave as (
    select
      pc.suggestion_id,
      pc.suggestion_text,
      pc.suggestion_short_text,
      pc.suggestion_category,
      pc.last_used_at
    from relaxed_per_cat pc
    where pc.rn = 1
    order by pc.last_used_at asc nulls first, random()
    limit take_n
  ),
  relaxed_fill as (
    select
      er.suggestion_id,
      er.suggestion_text,
      er.suggestion_short_text,
      er.suggestion_category,
      er.last_used_at
    from eligible_relaxed er
    where not exists (select 1 from relaxed_first_wave fw where fw.suggestion_id = er.suggestion_id)
    order by er.last_used_at asc nulls first, random()
    limit greatest(0, take_n - (select count(*)::int from relaxed_first_wave))
  ),
  pick_relaxed as (
    select * from relaxed_first_wave
    union all
    select * from relaxed_fill
  ),

  -- PICK from ANY (diverse categories first)
  any_per_cat as (
    select
      ea.suggestion_id,
      ea.suggestion_text,
      ea.suggestion_short_text,
      ea.suggestion_category,
      ea.last_used_at,
      row_number() over (
        partition by ea.suggestion_category
        order by ea.last_used_at asc nulls first, random()
      ) as rn
    from eligible_any ea
  ),
  any_first_wave as (
    select
      pc.suggestion_id,
      pc.suggestion_text,
      pc.suggestion_short_text,
      pc.suggestion_category,
      pc.last_used_at
    from any_per_cat pc
    where pc.rn = 1
    order by pc.last_used_at asc nulls first, random()
    limit take_n
  ),
  any_fill as (
    select
      ea.suggestion_id,
      ea.suggestion_text,
      ea.suggestion_short_text,
      ea.suggestion_category,
      ea.last_used_at
    from eligible_any ea
    where not exists (select 1 from any_first_wave fw where fw.suggestion_id = ea.suggestion_id)
    order by ea.last_used_at asc nulls first, random()
    limit greatest(0, take_n - (select count(*)::int from any_first_wave))
  ),
  pick_any as (
    select * from any_first_wave
    union all
    select * from any_fill
  ),

  -- Combine with fallback: strict first, then top-up from relaxed, then any
  chosen as (
    select
      ps.suggestion_id,
      ps.suggestion_text,
      ps.suggestion_short_text,
      ps.suggestion_category
    from pick_strict ps

    union all

    select
      pr.suggestion_id,
      pr.suggestion_text,
      pr.suggestion_short_text,
      pr.suggestion_category
    from pick_relaxed pr
    where (select count(*) from pick_strict) < take_n
      and not exists (select 1 from pick_strict ps where ps.suggestion_id = pr.suggestion_id)

    union all

    select
      pa.suggestion_id,
      pa.suggestion_text,
      pa.suggestion_short_text,
      pa.suggestion_category
    from pick_any pa
    where (select count(*) from pick_strict) < take_n
      and (select count(*) from pick_relaxed) < take_n
      and not exists (select 1 from pick_strict ps where ps.suggestion_id = pa.suggestion_id)
      and not exists (select 1 from pick_relaxed pr where pr.suggestion_id = pa.suggestion_id)
  )

  select
    c.suggestion_id as id,
    c.suggestion_text as text,
    c.suggestion_short_text as short_text,
    c.suggestion_category as category
  from chosen c
  limit take_n;

end;
$$;


ALTER FUNCTION "public"."get_micro_adjustment_suggestions_rotating"("user_id" "uuid", "n" integer, "exclude_shown_days" integer, "exclude_selected_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_circle_access"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null then
    return false;
  end if;
  if auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  return exists (
    select 1
    from public.user_connections c
    where (c.requester_user_id = p_user_id or c.addressee_user_id = p_user_id)
      and c.status in ('pending', 'accepted')
  );
end;
$$;


ALTER FUNCTION "public"."has_circle_access"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_circle_new_reactions"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
  v_last_seen timestamptz;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select up.circle_last_seen_at
  into v_last_seen
  from public.user_preferences up
  where up.user_id = p_user_id;

  return exists (
    select 1
    from public.activity_share_reactions ar
    join public.activity_shares s
      on s.id = ar.activity_share_id
    where s.author_user_id = p_user_id
      and s.deleted_at is null
      and s.expires_at > now()
      and ar.user_id <> p_user_id
      and ar.updated_at > coalesce(v_last_seen, to_timestamp(0))
  );
end;
$$;


ALTER FUNCTION "public"."has_circle_new_reactions"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hide_circle_feed_item"("p_recipient_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.activity_share_recipients r
  set hidden_at = now()
  where r.id = p_recipient_id
    and r.recipient_user_id = p_user_id
    and r.hidden_at is null;

  return found;
end;
$$;


ALTER FUNCTION "public"."hide_circle_feed_item"("p_recipient_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_circle_feed_item_seen"("p_recipient_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.activity_share_recipients r
  set seen_at = now()
  where r.id = p_recipient_id
    and r.recipient_user_id = p_user_id
    and r.seen_at is null;

  return found;
end;
$$;


ALTER FUNCTION "public"."mark_circle_feed_item_seen"("p_recipient_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_circle_feed_visited"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
  v_now timestamptz;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  v_now := now();

  insert into public.user_preferences (
    user_id,
    circle_last_seen_at,
    updated_at
  )
  values (
    p_user_id,
    v_now,
    v_now
  )
  on conflict (user_id)
  do update set
    circle_last_seen_at = excluded.circle_last_seen_at,
    updated_at = v_now;

  return true;
end;
$$;


ALTER FUNCTION "public"."mark_circle_feed_visited"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_shared_activity"("p_activity_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
  v_activity record;
  v_share_id uuid;
  v_shared_at timestamptz;
  v_photo_rows integer;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select
    a.id,
    a.user_id,
    a.type,
    a.title,
    coalesce(
      (
        select p.image_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_image_url
    ) as cover_image_path,
    coalesce(
      (
        select p.thumb_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_thumb_image_url
    ) as cover_thumb_path,
    a.date,
    a.distance_km,
    a.duration_min
  into v_activity
  from public.activities a
  where a.id = p_activity_id
    and a.user_id = p_user_id;

  if not found then
    raise exception 'Activity not found or not owned by user.';
  end if;

  select s.id, s.shared_at
  into v_share_id, v_shared_at
  from public.activity_shares s
  where s.activity_id = p_activity_id
    and s.author_user_id = p_user_id
    and s.deleted_at is null
  limit 1;

  if v_share_id is null then
    return false;
  end if;

  update public.activity_shares
  set
    title = v_activity.title,
    activity_type = v_activity.type,
    distance_km = v_activity.distance_km,
    duration_min = v_activity.duration_min,
    shared_photo_url = v_activity.cover_image_path,
    shared_thumb_photo_url = v_activity.cover_thumb_path,
    occurred_on = v_activity.date
  where id = v_share_id;

  insert into public.activity_share_recipients (
    activity_share_id,
    recipient_user_id,
    shared_at,
    seen_at
  )
  values (
    v_share_id,
    p_user_id,
    v_shared_at,
    now()
  )
  on conflict (activity_share_id, recipient_user_id) do nothing;

  delete from public.activity_share_photos
  where activity_share_id = v_share_id;

  insert into public.activity_share_photos (
    activity_share_id,
    image_path,
    thumb_path,
    sort_order
  )
  select
    v_share_id,
    p.image_path,
    p.thumb_path,
    coalesce(p.sort_order, 0)
  from public.activity_photos p
  where p.activity_id = v_activity.id
  order by p.sort_order asc, p.created_at asc, p.id asc;

  get diagnostics v_photo_rows = row_count;

  if v_photo_rows = 0 and v_activity.cover_image_path is not null then
    insert into public.activity_share_photos (
      activity_share_id,
      image_path,
      thumb_path,
      sort_order
    )
    values (
      v_share_id,
      v_activity.cover_image_path,
      v_activity.cover_thumb_path,
      0
    )
    on conflict (activity_share_id, sort_order, image_path) do nothing;
  end if;

  delete from public.activity_share_tags
  where activity_share_id = v_share_id;

  insert into public.activity_share_tags (
    activity_share_id,
    type,
    value,
    metadata,
    source
  )
  select
    v_share_id,
    t.type,
    t.value,
    coalesce(t.metadata, '{}'::jsonb),
    t.source
  from public.activity_tags t
  where t.activity_id = v_activity.id;

  return true;
end;
$$;


ALTER FUNCTION "public"."refresh_shared_activity"("p_activity_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_circle_activity_reaction"("p_activity_share_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  if exists (
    select 1
    from public.activity_shares s
    where s.id = p_activity_share_id
      and s.author_user_id = p_user_id
      and s.deleted_at is null
      and s.expires_at > now()
  ) then
    raise exception 'You cannot react to your own activity';
  end if;

  if not public.can_access_circle_share(p_activity_share_id, p_user_id) then
    raise exception 'Share not accessible';
  end if;

  delete from public.activity_share_reactions ar
  where ar.activity_share_id = p_activity_share_id
    and ar.user_id = p_user_id;

  return found;
end;
$$;


ALTER FUNCTION "public"."remove_circle_activity_reaction"("p_activity_share_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_user_activity_types"("new_order" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  temp_base int;
  enabled_all text[];
  remaining text[];
  final_order text[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_user_activity_types_seeded();

  -- Guard: reject duplicates in new_order
  if (select count(*) from unnest(new_order)) <>
     (select count(distinct x) from unnest(new_order) as x)
  then
    raise exception 'new_order contains duplicates';
  end if;

  -- Get all enabled activity types in current order
  select array_agg(activity_type order by sort_order)
    into enabled_all
  from public.user_activity_types
  where user_id = auth.uid()
    and is_enabled = true;

  enabled_all := coalesce(enabled_all, array[]::text[]);

  -- Keep any enabled types not present in new_order (preserve their relative order)
  select array_agg(t)
    into remaining
  from (
    select unnest(enabled_all) as t
    except
    select unnest(new_order) as t
  ) s;

  remaining := coalesce(remaining, array[]::text[]);

  -- Final order = requested order + whatever was missing
  final_order := array_cat(new_order, remaining);

  -- Safe temp base above any existing value (enabled + hidden)
  select coalesce(max(sort_order), 0) + 1000
    into temp_base
  from public.user_activity_types
  where user_id = auth.uid();

  -- Phase 1: move all enabled rows involved into safe temp values
  update public.user_activity_types u
  set sort_order = temp_base + (x.ord * 10)
  from unnest(final_order) with ordinality as x(activity_type, ord)
  where u.user_id = auth.uid()
    and u.activity_type = x.activity_type
    and u.is_enabled = true;

  -- Phase 2: write final canonical values for all enabled rows
  update public.user_activity_types u
  set sort_order = (x.ord * 10)
  from unnest(final_order) with ordinality as x(activity_type, ord)
  where u.user_id = auth.uid()
    and u.activity_type = x.activity_type
    and u.is_enabled = true;
end;
$$;


ALTER FUNCTION "public"."reorder_user_activity_types"("new_order" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_activity_type_enabled"("p_activity_type" "text", "p_is_enabled" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_user_activity_types_seeded();

  update public.user_activity_types
  set is_enabled = p_is_enabled
  where user_id = auth.uid()
    and activity_type = p_activity_type;
end;
$$;


ALTER FUNCTION "public"."set_user_activity_type_enabled"("p_activity_type" "text", "p_is_enabled" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."share_activity_with_connections"("p_activity_id" "uuid", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
  v_activity record;
  v_share_id uuid;
  v_shared_at timestamptz;
  v_photo_rows integer;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select
    a.id,
    a.user_id,
    a.type,
    a.title,
    coalesce(
      (
        select p.image_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_image_url
    ) as cover_image_path,
    coalesce(
      (
        select p.thumb_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_thumb_image_url
    ) as cover_thumb_path,
    a.date,
    a.distance_km,
    a.duration_min
  into v_activity
  from public.activities a
  where a.id = p_activity_id
    and a.user_id = p_user_id;

  if not found then
    raise exception 'Activity not found or not owned by user.';
  end if;

  if exists (
    select 1
    from public.activity_shares s
    where s.activity_id = p_activity_id
  ) then
    raise exception 'Activity already shared with Circle.';
  end if;

  insert into public.activity_shares (
    activity_id,
    author_user_id,
    visibility,
    title,
    activity_type,
    summary_text,
    distance_km,
    duration_min,
    shared_photo_url,
    shared_thumb_photo_url,
    occurred_on
  )
  values (
    v_activity.id,
    p_user_id,
    'connections',
    v_activity.title,
    v_activity.type,
    null,
    v_activity.distance_km,
    v_activity.duration_min,
    v_activity.cover_image_path,
    v_activity.cover_thumb_path,
    v_activity.date
  )
  returning id, shared_at
  into v_share_id, v_shared_at;

  insert into public.activity_share_photos (
    activity_share_id,
    image_path,
    thumb_path,
    sort_order
  )
  select
    v_share_id,
    p.image_path,
    p.thumb_path,
    coalesce(p.sort_order, 0)
  from public.activity_photos p
  where p.activity_id = v_activity.id
  order by p.sort_order asc, p.created_at asc, p.id asc
  on conflict (activity_share_id, sort_order, image_path) do nothing;

  get diagnostics v_photo_rows = row_count;

  if v_photo_rows = 0 and v_activity.cover_image_path is not null then
    insert into public.activity_share_photos (
      activity_share_id,
      image_path,
      thumb_path,
      sort_order
    )
    values (
      v_share_id,
      v_activity.cover_image_path,
      v_activity.cover_thumb_path,
      0
    )
    on conflict (activity_share_id, sort_order, image_path) do nothing;
  end if;

  insert into public.activity_share_tags (
    activity_share_id,
    type,
    value,
    metadata,
    source
  )
  select
    v_share_id,
    t.type,
    t.value,
    coalesce(t.metadata, '{}'::jsonb),
    t.source
  from public.activity_tags t
  where t.activity_id = v_activity.id
  on conflict (activity_share_id, type) do update
  set
    value = excluded.value,
    metadata = excluded.metadata,
    source = excluded.source;

  insert into public.activity_share_recipients (
    activity_share_id,
    recipient_user_id,
    shared_at,
    seen_at
  )
  values (
    v_share_id,
    p_user_id,
    v_shared_at,
    now()
  )
  on conflict (activity_share_id, recipient_user_id) do nothing;

  insert into public.activity_share_recipients (
    activity_share_id,
    recipient_user_id,
    shared_at
  )
  select distinct
    v_share_id,
    case
      when c.requester_user_id = p_user_id then c.addressee_user_id
      else c.requester_user_id
    end as recipient_user_id,
    v_shared_at
  from public.user_connections c
  where c.status = 'accepted'
    and (c.requester_user_id = p_user_id or c.addressee_user_id = p_user_id)
    and (
      case
        when c.requester_user_id = p_user_id then c.addressee_user_id
        else c.requester_user_id
      end
    ) <> p_user_id
  on conflict (activity_share_id, recipient_user_id) do nothing;

  return v_share_id;
end;
$$;


ALTER FUNCTION "public"."share_activity_with_connections"("p_activity_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stats_activity_trend_meta"("target_user" "uuid", "weeks_back" integer DEFAULT 9) RETURNS TABLE("activity_type" "text", "has_distance" boolean, "has_duration" boolean, "default_metric" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  caller uuid := auth.uid();
  start_date date := date_trunc('week', current_date)::date
                     - (weeks_back * interval '1 week');
begin
  if caller is null or caller <> target_user then
    raise exception 'unauthorized';
  end if;

  return query
  select
    a.type as activity_type,
    bool_or(a.distance_km is not null) as has_distance,
    bool_or(a.duration_min is not null) as has_duration,
    coalesce(
      p.default_metric,
      case
        when bool_or(a.distance_km is not null) then 'distance'
        when bool_or(a.duration_min is not null) then 'duration'
        else null
      end
    ) as default_metric
  from public.activities a
  left join public.activity_preferences p
    on p.user_id = target_user
   and p.activity_type = a.type
  where a.user_id = target_user
    and a.date >= start_date
  group by a.type, p.default_metric;
end;
$$;


ALTER FUNCTION "public"."stats_activity_trend_meta"("target_user" "uuid", "weeks_back" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stats_activity_trend_series"("target_user" "uuid", "activity_type" "text", "metric" "text", "weeks_back" integer DEFAULT 9) RETURNS TABLE("week_start" "date", "value" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  caller uuid := auth.uid();
  start_date date := date_trunc('week', current_date)::date
                     - (weeks_back * interval '1 week');
begin
  if caller is null or caller <> target_user then
    raise exception 'unauthorized';
  end if;

  return query
  select
    date_trunc('week', a.date)::date as week_start,
    sum(
      case
        when metric = 'distance' then a.distance_km
        when metric = 'duration' then a.duration_min
        else null
      end
    ) as value
  from public.activities a
  where a.user_id = target_user
    and a.type = activity_type
    and a.date >= start_date
    and (
      (metric = 'distance' and a.distance_km is not null)
      or
      (metric = 'duration' and a.duration_min is not null)
    )
  group by 1
  order by 1;
end;
$$;


ALTER FUNCTION "public"."stats_activity_trend_series"("target_user" "uuid", "activity_type" "text", "metric" "text", "weeks_back" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stats_goal_progress"("user_id" "uuid") RETURNS TABLE("goal_id" "uuid", "name" "text", "activity_type" "text", "metric" "text", "period" "text", "target" numeric, "current_value" numeric, "unit" "text", "progress_ratio" numeric, "comparison_pct" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  caller uuid := auth.uid();
  target_user uuid := user_id;
begin
  if caller is null or caller <> target_user then
    raise exception 'unauthorized';
  end if;

  return query
  with goal_data as (
    select g.*,
           case g.period when 'week' then date_trunc('week', current_date)::date
                         when 'month' then date_trunc('month', current_date)::date
                         else date_trunc('year', current_date)::date end as start_current
    from public.goals g
    where g.user_id = target_user
  ),
  periods as (
    select gd.*,
           case gd.period when 'week' then gd.start_current + interval '1 week'
                          when 'month' then gd.start_current + interval '1 month'
                          else gd.start_current + interval '1 year' end as end_current,
           case gd.period when 'week' then gd.start_current - interval '1 week'
                          when 'month' then gd.start_current - interval '1 month'
                          else gd.start_current - interval '1 year' end as start_last
    from goal_data gd
  ),
  spans as (
    select p.*,
           case p.period when 'week' then p.start_last + interval '1 week'
                          when 'month' then p.start_last + interval '1 month'
                          else p.start_last + interval '1 year' end as end_last,
           case p.period when 'week' then p.start_last - interval '1 week'
                          when 'month' then p.start_last - interval '1 month'
                          else p.start_last - interval '1 year' end as start_prev
    from periods p
  ),
  current_period as (
    select s.id as goal_id,
           sum(a.distance_km) as dist,
           sum(a.duration_min) as dur,
           count(a.id) as cnt
    from spans s
    left join public.activities a
      on a.user_id = target_user
     and a.date >= s.start_current and a.date < s.end_current
     and (s.activity_type = 'any' or a.type = s.activity_type)
    group by s.id
  ),
  last_period as (
    select s.id as goal_id,
           sum(a.distance_km) as dist,
           sum(a.duration_min) as dur,
           count(a.id) as cnt
    from spans s
    left join public.activities a
      on a.user_id = target_user
     and a.date >= s.start_last and a.date < s.end_last
     and (s.activity_type = 'any' or a.type = s.activity_type)
    group by s.id
  ),
  prev_period as (
    select s.id as goal_id,
           sum(a.distance_km) as dist,
           sum(a.duration_min) as dur,
           count(a.id) as cnt
    from spans s
    left join public.activities a
      on a.user_id = target_user
     and a.date >= s.start_prev and a.date < s.start_last
     and (s.activity_type = 'any' or a.type = s.activity_type)
    group by s.id
  )
  select
    s.id as goal_id,
    s.name,
    s.activity_type,
    s.metric,
    s.period,
    s.target,
    case s.metric when 'distance' then coalesce(c.dist, 0)
                  when 'duration' then coalesce(c.dur, 0)
                  else coalesce(c.cnt, 0) end as current_value,
    case s.metric when 'distance' then 'km'
                  when 'duration' then 'min'
                  else 'activities' end as unit,
    case when s.target > 0
         then least(1, (case s.metric when 'distance' then coalesce(c.dist, 0)
                                      when 'duration' then coalesce(c.dur, 0)
                                      else coalesce(c.cnt, 0) end) / s.target)
         else 0 end as progress_ratio,
    case
      when (case s.metric when 'distance' then coalesce(pv.dist, 0)
                          when 'duration' then coalesce(pv.dur, 0)
                          else coalesce(pv.cnt, 0) end) > 0
        then ((case s.metric when 'distance' then coalesce(ls.dist, 0)
                             when 'duration' then coalesce(ls.dur, 0)
                             else coalesce(ls.cnt, 0) end) /
              (case s.metric when 'distance' then coalesce(pv.dist, 0)
                             when 'duration' then coalesce(pv.dur, 0)
                             else coalesce(pv.cnt, 0) end) - 1) * 100
      else null
    end as comparison_pct
  from spans s
  left join current_period c on c.goal_id = s.id
  left join last_period    ls on ls.goal_id = s.id
  left join prev_period    pv on pv.goal_id = s.id
  order by s.period, s.updated_at desc nulls last, s.id;
end;
$$;


ALTER FUNCTION "public"."stats_goal_progress"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stats_trends_90_days"("user_id" "uuid") RETURNS TABLE("activity_type" "text", "total_distance" numeric, "weekly_avg_distance" numeric, "trend_pct" numeric, "avg_feeling" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  caller uuid := auth.uid();
  target_user uuid := user_id;
begin
  if caller is null or caller <> target_user then
    raise exception 'unauthorized';
  end if;

  return query
  with bounds as (
    select current_date - interval '90 days'  as start_current,
           current_date                       as end_current,
           current_date - interval '180 days' as start_prev
  ),
  agg as (
    select
      a.type,
      sum(a.distance_km) filter (where a.date >= b.start_current and a.date < b.end_current) as curr_dist,
      avg(a.feeling)    filter (where a.date >= b.start_current and a.date < b.end_current) as curr_feeling,
      sum(a.distance_km) filter (where a.date >= b.start_prev    and a.date < b.start_current) as prev_dist
    from public.activities a
    cross join bounds b
    where a.user_id = target_user
      and a.type in ('run','ride')
    group by a.type
  )
  select
    t.activity_type,
    coalesce(a.curr_dist, 0) as total_distance,
    case when coalesce(a.curr_dist, 0) > 0 then coalesce(a.curr_dist, 0) / (90.0/7.0) else 0 end as weekly_avg_distance,
    case when coalesce(a.prev_dist, 0) > 0
         then (coalesce(a.curr_dist, 0) / a.prev_dist - 1) * 100
         else null end as trend_pct,
    a.curr_feeling as avg_feeling
  from unnest(array['run','ride']) as t(activity_type)
  left join agg a on a.type = t.activity_type
  order by t.activity_type;
end;
$$;


ALTER FUNCTION "public"."stats_trends_90_days"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_preferences_from_auth"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  insert into public.user_preferences (user_id, login_email, updated_at)
  values (new.id, new.email, now())
  on conflict (user_id)
  do update set
    login_email = excluded.login_email,
    updated_at = now();

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_user_preferences_from_auth"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unshare_activity"("p_activity_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  delete from public.activity_shares
  where activity_id = p_activity_id
    and author_user_id = p_user_id;

  return found;
end;
$$;


ALTER FUNCTION "public"."unshare_activity"("p_activity_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_circle_activity_reaction"("p_activity_share_id" "uuid", "p_user_id" "uuid", "p_reaction_type" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
  v_reaction text;
  v_saved text;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  v_reaction := upper(trim(coalesce(p_reaction_type, '')));
  if v_reaction not in ('CHEER', 'INSPIRED', 'ENERGY', 'BEAUTIFUL', 'MOVED') then
    raise exception 'Unsupported reaction type';
  end if;

  if exists (
    select 1
    from public.activity_shares s
    where s.id = p_activity_share_id
      and s.author_user_id = p_user_id
      and s.deleted_at is null
      and s.expires_at > now()
  ) then
    raise exception 'You cannot react to your own activity';
  end if;

  if not public.can_access_circle_share(p_activity_share_id, p_user_id) then
    raise exception 'Share not accessible';
  end if;

  insert into public.activity_share_reactions (
    activity_share_id,
    user_id,
    reaction_type
  )
  values (
    p_activity_share_id,
    p_user_id,
    v_reaction
  )
  on conflict (activity_share_id, user_id)
  do update set
    reaction_type = excluded.reaction_type,
    updated_at = now()
  returning reaction_type
  into v_saved;

  return v_saved;
end;
$$;


ALTER FUNCTION "public"."upsert_circle_activity_reaction"("p_activity_share_id" "uuid", "p_user_id" "uuid", "p_reaction_type" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "date" "date" NOT NULL,
    "distance_km" numeric,
    "feeling" integer,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "title" "text",
    "effort" integer DEFAULT 3,
    "notes" "text",
    "note_updated_at" timestamp with time zone DEFAULT "now"(),
    "note_image_url" "text",
    "duration_min" numeric,
    "note_thumb_image_url" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "external_source" "text",
    "external_id" "text",
    "raw_sport_type" "text",
    "raw_type" "text",
    "started_at" timestamp with time zone,
    "imported_at" timestamp with time zone,
    "last_synced_at" timestamp with time zone,
    "feeling_during" "text",
    "feeling_after" "text",
    CONSTRAINT "activities_effort_check" CHECK ((("effort" >= 1) AND ("effort" <= 5))),
    CONSTRAINT "activities_feeling_check" CHECK ((("feeling" >= 1) AND ("feeling" <= 5))),
    CONSTRAINT "activities_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'strava'::"text"]))),
    CONSTRAINT "activities_type_check" CHECK (("type" = ANY (ARRAY['run'::"text", 'ride'::"text", 'walk'::"text", 'strength'::"text", 'yoga'::"text", 'hike'::"text", 'swim'::"text", 'meditation'::"text", 'restore'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_equipment" (
    "activity_id" "uuid" NOT NULL,
    "equipment_id" "uuid" NOT NULL
);


ALTER TABLE "public"."activity_equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "image_path" "text" NOT NULL,
    "thumb_path" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lat" numeric,
    "lng" numeric
);


ALTER TABLE "public"."activity_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "default_metric" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_preferences_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['run'::"text", 'ride'::"text", 'walk'::"text", 'strength'::"text", 'yoga'::"text", 'hike'::"text", 'swim'::"text", 'meditation'::"text", 'restore'::"text", 'other'::"text"]))),
    CONSTRAINT "activity_preferences_metric_check" CHECK (("default_metric" = ANY (ARRAY['duration'::"text", 'distance'::"text"])))
);


ALTER TABLE "public"."activity_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_share_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_share_id" "uuid" NOT NULL,
    "image_path" "text" NOT NULL,
    "thumb_path" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_share_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_share_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_share_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_share_reactions_reaction_type_check" CHECK (("reaction_type" = ANY (ARRAY['CHEER'::"text", 'INSPIRED'::"text", 'ENERGY'::"text", 'BEAUTIFUL'::"text", 'MOVED'::"text"])))
);


ALTER TABLE "public"."activity_share_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_share_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_share_id" "uuid" NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "shared_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "seen_at" timestamp with time zone,
    "hidden_at" timestamp with time zone
);


ALTER TABLE "public"."activity_share_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_share_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_share_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "value" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_share_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "author_user_id" "uuid" NOT NULL,
    "visibility" "text" DEFAULT 'connections'::"text" NOT NULL,
    "title" "text",
    "activity_type" "text" NOT NULL,
    "summary_text" "text",
    "shared_photo_url" "text",
    "shared_thumb_photo_url" "text",
    "occurred_on" "date" NOT NULL,
    "shared_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "deleted_at" timestamp with time zone,
    "distance_km" numeric,
    "duration_min" numeric,
    CONSTRAINT "activity_shares_visibility_check" CHECK (("visibility" = 'connections'::"text"))
);


ALTER TABLE "public"."activity_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "value" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."circle_invite_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "inviter_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "accepted_by_user_id" "uuid",
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone
);


ALTER TABLE "public"."circle_invite_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "goal_id" "uuid"
);


ALTER TABLE "public"."goal_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "activity_type" "text" NOT NULL,
    "period" "text" NOT NULL,
    "target" numeric DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metric" "text" DEFAULT 'distance'::"text" NOT NULL,
    "name" "text",
    "effective_from" timestamp with time zone NOT NULL,
    CONSTRAINT "goals_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['run'::"text", 'ride'::"text", 'walk'::"text", 'strength'::"text", 'yoga'::"text", 'hike'::"text", 'swim'::"text", 'meditation'::"text", 'restore'::"text", 'other'::"text", 'any'::"text"]))),
    CONSTRAINT "goals_metric_check" CHECK (("metric" = ANY (ARRAY['distance'::"text", 'duration'::"text", 'count'::"text"]))),
    CONSTRAINT "goals_period_check" CHECK (("period" = ANY (ARRAY['week'::"text", 'month'::"text", 'year'::"text"]))),
    CONSTRAINT "goals_target_check" CHECK (("target" >= (0)::numeric))
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_type" "text" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "related_activity_id" "uuid",
    "related_tiny_tweak_id" "uuid",
    "metadata" "jsonb"
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."location_cache" (
    "key" "text" NOT NULL,
    "lat" numeric,
    "lng" numeric,
    "name" "text",
    "type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."location_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."micro_adjustment_suggestion_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "suggestion_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "surface" "text",
    "session_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "micro_adj_suggestion_events_type_check" CHECK (("event_type" = ANY (ARRAY['shown'::"text", 'selected'::"text"])))
);


ALTER TABLE "public"."micro_adjustment_suggestion_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."micro_adjustment_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "text" "text" NOT NULL,
    "short_text" "text",
    "category" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "weight" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "micro_adjustment_suggestions_category_check" CHECK (("category" = ANY (ARRAY['body_awareness'::"text", 'presence'::"text", 'reduce_pressure'::"text", 'gentle_consistency'::"text", 'reflection'::"text", 'reframe'::"text"]))),
    CONSTRAINT "micro_adjustment_suggestions_weight_check" CHECK (("weight" >= 1))
);


ALTER TABLE "public"."micro_adjustment_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."micro_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "source" "text" DEFAULT 'custom'::"text" NOT NULL,
    "suggestion_id" "uuid",
    "category" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_flow_state" "text" DEFAULT 'none'::"text" NOT NULL,
    CONSTRAINT "micro_adjustments_end_flow_state_check" CHECK (("end_flow_state" = ANY (ARRAY['none'::"text", 'prompt_reflection'::"text", 'reflected'::"text", 'skipped'::"text", 'prompt_renew'::"text", 'renew_dismissed'::"text"]))),
    CONSTRAINT "micro_adjustments_source_check" CHECK (("source" = ANY (ARRAY['custom'::"text", 'suggestion'::"text"]))),
    CONSTRAINT "micro_adjustments_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'ended'::"text", 'archived'::"text"]))),
    CONSTRAINT "micro_adjustments_suggestion_consistency" CHECK (((("source" = 'suggestion'::"text") AND ("suggestion_id" IS NOT NULL)) OR (("source" = 'custom'::"text") AND ("suggestion_id" IS NULL))))
);


ALTER TABLE "public"."micro_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preset_equipment" (
    "preset_id" "uuid" NOT NULL,
    "equipment_id" "uuid" NOT NULL
);


ALTER TABLE "public"."preset_equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "distance_km" numeric,
    "duration_min" numeric,
    "last_used_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "effort" integer DEFAULT 3,
    CONSTRAINT "presets_type_check" CHECK (("type" = ANY (ARRAY['run'::"text", 'ride'::"text", 'walk'::"text", 'strength'::"text", 'yoga'::"text", 'hike'::"text", 'swim'::"text", 'meditation'::"text", 'restore'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_activity_types" (
    "user_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "sort_order" integer DEFAULT 1000 NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_activity_types_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['run'::"text", 'ride'::"text", 'walk'::"text", 'strength'::"text", 'yoga'::"text", 'hike'::"text", 'swim'::"text", 'meditation'::"text", 'restore'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."user_activity_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_user_id" "uuid" NOT NULL,
    "addressee_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "user_connections_not_self" CHECK (("requester_user_id" <> "addressee_user_id")),
    CONSTRAINT "user_connections_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'removed'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."user_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "accepted_privacy_policy" boolean DEFAULT false NOT NULL,
    "accepted_terms" boolean DEFAULT false NOT NULL,
    "privacy_policy_version" "text" DEFAULT 'v1.0'::"text" NOT NULL,
    "terms_version" "text" DEFAULT 'v1.0'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "newsletter_opt_in" boolean DEFAULT false
);


ALTER TABLE "public"."user_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "user_id" "uuid" NOT NULL,
    "unit_system" "text" DEFAULT 'metric'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "social_display_name" "text",
    "social_profile_image_path" "text",
    "social_profile_thumb_path" "text",
    "login_email" "text",
    "circle_last_seen_at" timestamp with time zone,
    CONSTRAINT "user_preferences_unit_system_check" CHECK (("unit_system" = ANY (ARRAY['metric'::"text", 'imperial'::"text"])))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_strava_connections" (
    "user_id" "uuid" NOT NULL,
    "strava_athlete_id" bigint NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "token_expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_synced_at" timestamp with time zone
);


ALTER TABLE "public"."user_strava_connections" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_equipment"
    ADD CONSTRAINT "activity_equipment_pkey" PRIMARY KEY ("activity_id", "equipment_id");



ALTER TABLE ONLY "public"."activity_photos"
    ADD CONSTRAINT "activity_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_preferences"
    ADD CONSTRAINT "activity_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_preferences"
    ADD CONSTRAINT "activity_preferences_unique" UNIQUE ("user_id", "activity_type");



ALTER TABLE ONLY "public"."activity_share_photos"
    ADD CONSTRAINT "activity_share_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_share_photos"
    ADD CONSTRAINT "activity_share_photos_unique" UNIQUE ("activity_share_id", "sort_order", "image_path");



ALTER TABLE ONLY "public"."activity_share_reactions"
    ADD CONSTRAINT "activity_share_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_share_reactions"
    ADD CONSTRAINT "activity_share_reactions_unique" UNIQUE ("activity_share_id", "user_id");



ALTER TABLE ONLY "public"."activity_share_recipients"
    ADD CONSTRAINT "activity_share_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_share_recipients"
    ADD CONSTRAINT "activity_share_recipients_unique" UNIQUE ("activity_share_id", "recipient_user_id");



ALTER TABLE ONLY "public"."activity_share_tags"
    ADD CONSTRAINT "activity_share_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_share_tags"
    ADD CONSTRAINT "activity_share_tags_unique" UNIQUE ("activity_share_id", "type");



ALTER TABLE ONLY "public"."activity_shares"
    ADD CONSTRAINT "activity_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_shares"
    ADD CONSTRAINT "activity_shares_unique_activity" UNIQUE ("activity_id");



ALTER TABLE ONLY "public"."activity_tags"
    ADD CONSTRAINT "activity_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."circle_invite_links"
    ADD CONSTRAINT "circle_invite_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."circle_invite_links"
    ADD CONSTRAINT "circle_invite_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_preferences"
    ADD CONSTRAINT "goal_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_preferences"
    ADD CONSTRAINT "goal_preferences_user_id_goal_id_key" UNIQUE ("user_id", "goal_id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_unique_combo" UNIQUE ("user_id", "activity_type", "metric", "period");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_cache"
    ADD CONSTRAINT "location_cache_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."micro_adjustment_suggestion_events"
    ADD CONSTRAINT "micro_adjustment_suggestion_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."micro_adjustment_suggestions"
    ADD CONSTRAINT "micro_adjustment_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."micro_adjustments"
    ADD CONSTRAINT "micro_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preset_equipment"
    ADD CONSTRAINT "preset_equipment_pkey" PRIMARY KEY ("preset_id", "equipment_id");



ALTER TABLE ONLY "public"."presets"
    ADD CONSTRAINT "presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_activity_types"
    ADD CONSTRAINT "user_activity_types_pkey" PRIMARY KEY ("user_id", "activity_type");



ALTER TABLE ONLY "public"."user_connections"
    ADD CONSTRAINT "user_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_connections"
    ADD CONSTRAINT "user_connections_unique_pair" UNIQUE ("requester_user_id", "addressee_user_id");



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_strava_connections"
    ADD CONSTRAINT "user_strava_connections_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_strava_connections"
    ADD CONSTRAINT "user_strava_connections_strava_athlete_id_key" UNIQUE ("strava_athlete_id");



CREATE UNIQUE INDEX "activities_external_source_external_id_idx" ON "public"."activities" USING "btree" ("external_source", "external_id") WHERE (("external_source" IS NOT NULL) AND ("external_id" IS NOT NULL));



CREATE INDEX "activities_source_idx" ON "public"."activities" USING "btree" ("source");



CREATE INDEX "activities_user_date_idx" ON "public"."activities" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "activities_user_started_at_idx" ON "public"."activities" USING "btree" ("user_id", "started_at" DESC);



CREATE INDEX "activity_photos_activity_id_idx" ON "public"."activity_photos" USING "btree" ("activity_id");



CREATE INDEX "activity_photos_activity_order_idx" ON "public"."activity_photos" USING "btree" ("activity_id", "sort_order", "created_at", "id");



CREATE UNIQUE INDEX "activity_photos_unique_order" ON "public"."activity_photos" USING "btree" ("activity_id", "sort_order");



CREATE INDEX "activity_photos_user_id_idx" ON "public"."activity_photos" USING "btree" ("user_id");



CREATE INDEX "activity_share_photos_share_order_idx" ON "public"."activity_share_photos" USING "btree" ("activity_share_id", "sort_order", "created_at", "id");



CREATE INDEX "activity_share_reactions_share_idx" ON "public"."activity_share_reactions" USING "btree" ("activity_share_id", "reaction_type");



CREATE INDEX "activity_share_reactions_user_updated_idx" ON "public"."activity_share_reactions" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "activity_share_recipients_feed_idx" ON "public"."activity_share_recipients" USING "btree" ("recipient_user_id", "shared_at" DESC, "id" DESC) WHERE ("hidden_at" IS NULL);



CREATE INDEX "activity_share_tags_share_idx" ON "public"."activity_share_tags" USING "btree" ("activity_share_id", "created_at", "id");



CREATE INDEX "activity_shares_author_shared_at_idx" ON "public"."activity_shares" USING "btree" ("author_user_id", "shared_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "activity_shares_expires_at_idx" ON "public"."activity_shares" USING "btree" ("expires_at") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "activity_tags_activity_type_key" ON "public"."activity_tags" USING "btree" ("activity_id", "type");



CREATE INDEX "circle_invite_links_accepted_at_idx" ON "public"."circle_invite_links" USING "btree" ("accepted_at") WHERE ("accepted_at" IS NOT NULL);



CREATE INDEX "circle_invite_links_expires_at_idx" ON "public"."circle_invite_links" USING "btree" ("expires_at");



CREATE INDEX "circle_invite_links_inviter_idx" ON "public"."circle_invite_links" USING "btree" ("inviter_user_id", "created_at" DESC);



CREATE INDEX "circle_invite_links_revoked_at_idx" ON "public"."circle_invite_links" USING "btree" ("revoked_at") WHERE ("revoked_at" IS NOT NULL);



CREATE INDEX "idx_activities_user_id_date" ON "public"."activities" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_activity_tags_activity_id" ON "public"."activity_tags" USING "btree" ("activity_id");



CREATE INDEX "idx_activity_tags_type" ON "public"."activity_tags" USING "btree" ("type");



CREATE INDEX "idx_goal_preferences_goal_id" ON "public"."goal_preferences" USING "btree" ("goal_id");



CREATE INDEX "idx_goal_preferences_user_id" ON "public"."goal_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_goals_user_id" ON "public"."goals" USING "btree" ("user_id");



CREATE INDEX "idx_journal_entries_user_id_created_at" ON "public"."journal_entries" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_micro_adj_events_suggestion" ON "public"."micro_adjustment_suggestion_events" USING "btree" ("suggestion_id", "event_at" DESC);



CREATE INDEX "idx_micro_adj_events_type" ON "public"."micro_adjustment_suggestion_events" USING "btree" ("event_type");



CREATE INDEX "idx_micro_adj_events_user_time" ON "public"."micro_adjustment_suggestion_events" USING "btree" ("user_id", "event_at" DESC);



CREATE INDEX "idx_micro_adj_suggestions_active" ON "public"."micro_adjustment_suggestions" USING "btree" ("is_active");



CREATE INDEX "idx_micro_adj_suggestions_category" ON "public"."micro_adjustment_suggestions" USING "btree" ("category");



CREATE INDEX "idx_micro_adjustments_user_end_flow_state" ON "public"."micro_adjustments" USING "btree" ("user_id", "end_flow_state");



CREATE INDEX "idx_micro_adjustments_user_started" ON "public"."micro_adjustments" USING "btree" ("user_id", "started_at" DESC);



CREATE INDEX "idx_micro_adjustments_user_status" ON "public"."micro_adjustments" USING "btree" ("user_id", "status");



CREATE UNIQUE INDEX "micro_adjustments_one_active_per_user" ON "public"."micro_adjustments" USING "btree" ("user_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "user_activity_types_user_enabled_idx" ON "public"."user_activity_types" USING "btree" ("user_id", "is_enabled");



CREATE INDEX "user_activity_types_user_sort_idx" ON "public"."user_activity_types" USING "btree" ("user_id", "sort_order");



CREATE UNIQUE INDEX "user_activity_types_user_sort_unique_enabled" ON "public"."user_activity_types" USING "btree" ("user_id", "sort_order") WHERE ("is_enabled" = true);



CREATE INDEX "user_connections_addressee_status_idx" ON "public"."user_connections" USING "btree" ("addressee_user_id", "status");



CREATE INDEX "user_connections_requester_status_idx" ON "public"."user_connections" USING "btree" ("requester_user_id", "status");



CREATE UNIQUE INDEX "user_consents_user_id_key" ON "public"."user_consents" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trg_user_activity_types_set_updated_at" BEFORE UPDATE ON "public"."user_activity_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_equipment"
    ADD CONSTRAINT "activity_equipment_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_equipment"
    ADD CONSTRAINT "activity_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_photos"
    ADD CONSTRAINT "activity_photos_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_photos"
    ADD CONSTRAINT "activity_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_preferences"
    ADD CONSTRAINT "activity_preferences_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_share_photos"
    ADD CONSTRAINT "activity_share_photos_activity_share_id_fkey" FOREIGN KEY ("activity_share_id") REFERENCES "public"."activity_shares"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_share_reactions"
    ADD CONSTRAINT "activity_share_reactions_activity_share_id_fkey" FOREIGN KEY ("activity_share_id") REFERENCES "public"."activity_shares"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_share_reactions"
    ADD CONSTRAINT "activity_share_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_share_recipients"
    ADD CONSTRAINT "activity_share_recipients_activity_share_id_fkey" FOREIGN KEY ("activity_share_id") REFERENCES "public"."activity_shares"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_share_recipients"
    ADD CONSTRAINT "activity_share_recipients_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_share_tags"
    ADD CONSTRAINT "activity_share_tags_activity_share_id_fkey" FOREIGN KEY ("activity_share_id") REFERENCES "public"."activity_shares"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_shares"
    ADD CONSTRAINT "activity_shares_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_shares"
    ADD CONSTRAINT "activity_shares_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_tags"
    ADD CONSTRAINT "activity_tags_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."circle_invite_links"
    ADD CONSTRAINT "circle_invite_links_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."circle_invite_links"
    ADD CONSTRAINT "circle_invite_links_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_preferences"
    ADD CONSTRAINT "goal_preferences_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_preferences"
    ADD CONSTRAINT "goal_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."micro_adjustment_suggestion_events"
    ADD CONSTRAINT "micro_adjustment_suggestion_events_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "public"."micro_adjustment_suggestions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."micro_adjustment_suggestion_events"
    ADD CONSTRAINT "micro_adjustment_suggestion_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."micro_adjustments"
    ADD CONSTRAINT "micro_adjustments_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "public"."micro_adjustment_suggestions"("id");



ALTER TABLE ONLY "public"."micro_adjustments"
    ADD CONSTRAINT "micro_adjustments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."preset_equipment"
    ADD CONSTRAINT "preset_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."preset_equipment"
    ADD CONSTRAINT "preset_equipment_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presets"
    ADD CONSTRAINT "presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_activity_types"
    ADD CONSTRAINT "user_activity_types_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_connections"
    ADD CONSTRAINT "user_connections_addressee_user_id_fkey" FOREIGN KEY ("addressee_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_connections"
    ADD CONSTRAINT "user_connections_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_strava_connections"
    ADD CONSTRAINT "user_strava_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authors and recipients can read share photos" ON "public"."activity_share_photos" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."activity_shares" "s"
  WHERE (("s"."id" = "activity_share_photos"."activity_share_id") AND ("s"."author_user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."activity_share_recipients" "r"
     JOIN "public"."activity_shares" "s" ON (("s"."id" = "r"."activity_share_id")))
  WHERE (("r"."activity_share_id" = "activity_share_photos"."activity_share_id") AND ("r"."recipient_user_id" = "auth"."uid"()) AND ("r"."hidden_at" IS NULL) AND ("s"."deleted_at" IS NULL) AND ("s"."expires_at" > "now"()))))));



CREATE POLICY "Authors and recipients can read share tags" ON "public"."activity_share_tags" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."activity_shares" "s"
  WHERE (("s"."id" = "activity_share_tags"."activity_share_id") AND ("s"."author_user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."activity_share_recipients" "r"
     JOIN "public"."activity_shares" "s" ON (("s"."id" = "r"."activity_share_id")))
  WHERE (("r"."activity_share_id" = "activity_share_tags"."activity_share_id") AND ("r"."recipient_user_id" = "auth"."uid"()) AND ("r"."hidden_at" IS NULL) AND ("s"."deleted_at" IS NULL) AND ("s"."expires_at" > "now"()))))));



CREATE POLICY "Authors can view their own shares" ON "public"."activity_shares" FOR SELECT USING (("auth"."uid"() = "author_user_id"));



CREATE POLICY "Circle users can delete their own reactions" ON "public"."activity_share_reactions" FOR DELETE USING ((("auth"."uid"() = "user_id") AND "public"."can_access_circle_share"("activity_share_id", "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."activity_shares" "s"
  WHERE (("s"."id" = "activity_share_reactions"."activity_share_id") AND ("s"."author_user_id" <> "auth"."uid"()) AND ("s"."deleted_at" IS NULL) AND ("s"."expires_at" > "now"()))))));



CREATE POLICY "Circle users can insert their own reactions" ON "public"."activity_share_reactions" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."can_access_circle_share"("activity_share_id", "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."activity_shares" "s"
  WHERE (("s"."id" = "activity_share_reactions"."activity_share_id") AND ("s"."author_user_id" <> "auth"."uid"()) AND ("s"."deleted_at" IS NULL) AND ("s"."expires_at" > "now"()))))));



CREATE POLICY "Circle users can read reactions on visible shares" ON "public"."activity_share_reactions" FOR SELECT USING ("public"."can_access_circle_share"("activity_share_id", "auth"."uid"()));



CREATE POLICY "Circle users can update their own reactions" ON "public"."activity_share_reactions" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND "public"."can_access_circle_share"("activity_share_id", "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."activity_shares" "s"
  WHERE (("s"."id" = "activity_share_reactions"."activity_share_id") AND ("s"."author_user_id" <> "auth"."uid"()) AND ("s"."deleted_at" IS NULL) AND ("s"."expires_at" > "now"())))))) WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."can_access_circle_share"("activity_share_id", "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."activity_shares" "s"
  WHERE (("s"."id" = "activity_share_reactions"."activity_share_id") AND ("s"."author_user_id" <> "auth"."uid"()) AND ("s"."deleted_at" IS NULL) AND ("s"."expires_at" > "now"()))))));



CREATE POLICY "Recipients can read their own recipient rows" ON "public"."activity_share_recipients" FOR SELECT USING (("auth"."uid"() = "recipient_user_id"));



CREATE POLICY "Recipients can update their own recipient rows" ON "public"."activity_share_recipients" FOR UPDATE USING (("auth"."uid"() = "recipient_user_id")) WITH CHECK (("auth"."uid"() = "recipient_user_id"));



CREATE POLICY "Recipients can view active shares addressed to them" ON "public"."activity_shares" FOR SELECT TO "authenticated" USING ((("deleted_at" IS NULL) AND ("expires_at" > "now"()) AND (EXISTS ( SELECT 1
   FROM "public"."activity_share_recipients" "r"
  WHERE (("r"."activity_share_id" = "activity_shares"."id") AND ("r"."recipient_user_id" = "auth"."uid"()) AND ("r"."hidden_at" IS NULL))))));



CREATE POLICY "Users can create own invite links" ON "public"."circle_invite_links" FOR INSERT WITH CHECK (("auth"."uid"() = "inviter_user_id"));



CREATE POLICY "Users can delete their own Strava connection" ON "public"."user_strava_connections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own activities" ON "public"."activities" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own connection rows" ON "public"."user_connections" FOR DELETE USING ((("auth"."uid"() = "requester_user_id") OR ("auth"."uid"() = "addressee_user_id")));



CREATE POLICY "Users can delete their own goal preferences" ON "public"."goal_preferences" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own goals" ON "public"."goals" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own journal entries" ON "public"."journal_entries" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own presets" ON "public"."presets" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own shares" ON "public"."activity_shares" FOR DELETE USING (("auth"."uid"() = "author_user_id"));



CREATE POLICY "Users can insert their own Strava connection" ON "public"."user_strava_connections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own activities" ON "public"."activities" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own consent" ON "public"."user_consents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own goals" ON "public"."goals" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own journal entries" ON "public"."journal_entries" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own presets" ON "public"."presets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own shares" ON "public"."activity_shares" FOR INSERT WITH CHECK (("auth"."uid"() = "author_user_id"));



CREATE POLICY "Users can link equipment to their activities" ON "public"."activity_equipment" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_equipment"."activity_id") AND ("a"."user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."equipment" "e"
  WHERE (("e"."id" = "activity_equipment"."equipment_id") AND ("e"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage equipment for their presets" ON "public"."preset_equipment" USING ((EXISTS ( SELECT 1
   FROM "public"."presets" "p"
  WHERE (("p"."id" = "preset_equipment"."preset_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."presets" "p"
  WHERE (("p"."id" = "preset_equipment"."preset_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their equipment" ON "public"."equipment" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read activity equipment links for their activities" ON "public"."activity_equipment" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_equipment"."activity_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can read own invite links" ON "public"."circle_invite_links" FOR SELECT USING (("auth"."uid"() = "inviter_user_id"));



CREATE POLICY "Users can read their own activities" ON "public"."activities" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own journal entries" ON "public"."journal_entries" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own presets" ON "public"."presets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can see their own goal preferences" ON "public"."goal_preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlink equipment from their activities" ON "public"."activity_equipment" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_equipment"."activity_id") AND ("a"."user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."equipment" "e"
  WHERE (("e"."id" = "activity_equipment"."equipment_id") AND ("e"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own invite links" ON "public"."circle_invite_links" FOR UPDATE USING (("auth"."uid"() = "inviter_user_id")) WITH CHECK (("auth"."uid"() = "inviter_user_id"));



CREATE POLICY "Users can update their own Strava connection" ON "public"."user_strava_connections" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own activities" ON "public"."activities" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own connection rows" ON "public"."user_connections" FOR UPDATE USING ((("auth"."uid"() = "requester_user_id") OR ("auth"."uid"() = "addressee_user_id"))) WITH CHECK ((("auth"."uid"() = "requester_user_id") OR ("auth"."uid"() = "addressee_user_id")));



CREATE POLICY "Users can update their own goal preferences" ON "public"."goal_preferences" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own goals" ON "public"."goals" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own journal entries" ON "public"."journal_entries" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own presets" ON "public"."presets" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own shares" ON "public"."activity_shares" FOR UPDATE USING (("auth"."uid"() = "author_user_id")) WITH CHECK (("auth"."uid"() = "author_user_id"));



CREATE POLICY "Users can view tags for their own activities" ON "public"."activity_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_tags"."activity_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own Strava connection" ON "public"."user_strava_connections" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own connections" ON "public"."user_connections" FOR SELECT USING ((("auth"."uid"() = "requester_user_id") OR ("auth"."uid"() = "addressee_user_id")));



CREATE POLICY "Users can view their own consent" ON "public"."user_consents" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own goals" ON "public"."goals" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own preferences" ON "public"."user_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_share_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_share_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_share_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_share_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."circle_invite_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete own activity photos" ON "public"."activity_photos" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "delete own user_activity_types" ON "public"."user_activity_types" FOR DELETE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goal_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_prefs_insert_own" ON "public"."goal_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert own activity photos" ON "public"."activity_photos" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_photos"."activity_id") AND ("a"."user_id" = "auth"."uid"()))))));



CREATE POLICY "insert own user_activity_types" ON "public"."user_activity_types" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."location_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "micro_adj_events_insert_own" ON "public"."micro_adjustment_suggestion_events" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "micro_adj_events_select_own" ON "public"."micro_adjustment_suggestion_events" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "micro_adj_suggestions_select_active_authed" ON "public"."micro_adjustment_suggestions" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."micro_adjustment_suggestion_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."micro_adjustment_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."micro_adjustments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "micro_adjustments_delete_own" ON "public"."micro_adjustments" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "micro_adjustments_insert_own" ON "public"."micro_adjustments" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "micro_adjustments_select_own" ON "public"."micro_adjustments" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "micro_adjustments_update_own" ON "public"."micro_adjustments" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."preset_equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read own user_activity_types" ON "public"."user_activity_types" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "select own activity photos" ON "public"."activity_photos" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "update own activity photos" ON "public"."activity_photos" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "update own user_activity_types" ON "public"."user_activity_types" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_activity_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_strava_connections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users manage their own activity preferences" ON "public"."activity_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_circle_invite"("p_token" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_circle_invite"("p_token" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_circle_invite"("p_token" "text", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_activities_by_type"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_activities_by_type"() TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_activities_by_type"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_activities_per_week"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_activities_per_week"() TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_activities_per_week"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_activities_this_week"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_activities_this_week"() TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_activities_this_week"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_assert_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_assert_owner"() TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_assert_owner"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_new_users_this_week"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_new_users_this_week"() TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_new_users_this_week"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_top_photo_users"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_top_photo_users"() TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_top_photo_users"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_total_activities"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_total_activities"() TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_total_activities"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_total_users"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_total_users"() TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_total_users"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_users_over_50_photos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_users_over_50_photos"() TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_users_over_50_photos"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_users_per_week"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_users_per_week"() TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_users_per_week"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."can_access_circle_share"("p_activity_share_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_circle_share"("p_activity_share_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_circle_share"("p_activity_share_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_circle_invite_links"("p_expired_retention" interval, "p_used_retention" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_circle_invite_links"("p_expired_retention" interval, "p_used_retention" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_circle_invite_link"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_circle_invite_link"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_circle_invite_link"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_user_activity_types_seeded"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_user_activity_types_seeded"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_user_activity_types_seeded"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_user_activity_types_seeded"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_circle_connected_friends"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_circle_connected_friends"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_circle_connected_friends"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_circle_feed"("p_user_id" "uuid", "p_limit" integer, "p_before_occurred_on" "date", "p_before_shared_at" timestamp with time zone, "p_before_recipient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_circle_feed"("p_user_id" "uuid", "p_limit" integer, "p_before_occurred_on" "date", "p_before_shared_at" timestamp with time zone, "p_before_recipient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_circle_feed"("p_user_id" "uuid", "p_limit" integer, "p_before_occurred_on" "date", "p_before_shared_at" timestamp with time zone, "p_before_recipient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_circle_invite_preview"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_circle_invite_preview"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_circle_invite_preview"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_goal_history_dots"("user_id" "uuid", "max_periods" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_goal_history_dots"("user_id" "uuid", "max_periods" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_goal_history_dots"("user_id" "uuid", "max_periods" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_journal_feed_page"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_journal_feed_page"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_journal_feed_page"("p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_journal_feed_page_v2"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_journal_feed_page_v2"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_journal_feed_page_v2"("p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_micro_adjustment_suggestions_rotating"("user_id" "uuid", "n" integer, "exclude_shown_days" integer, "exclude_selected_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_micro_adjustment_suggestions_rotating"("user_id" "uuid", "n" integer, "exclude_shown_days" integer, "exclude_selected_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_micro_adjustment_suggestions_rotating"("user_id" "uuid", "n" integer, "exclude_shown_days" integer, "exclude_selected_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_circle_access"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_circle_access"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_circle_access"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_circle_new_reactions"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_circle_new_reactions"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_circle_new_reactions"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."hide_circle_feed_item"("p_recipient_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."hide_circle_feed_item"("p_recipient_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hide_circle_feed_item"("p_recipient_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_circle_feed_item_seen"("p_recipient_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_circle_feed_item_seen"("p_recipient_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_circle_feed_item_seen"("p_recipient_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_circle_feed_visited"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_circle_feed_visited"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_circle_feed_visited"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_shared_activity"("p_activity_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_shared_activity"("p_activity_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_shared_activity"("p_activity_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_circle_activity_reaction"("p_activity_share_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_circle_activity_reaction"("p_activity_share_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_circle_activity_reaction"("p_activity_share_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reorder_user_activity_types"("new_order" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_user_activity_types"("new_order" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_user_activity_types"("new_order" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_user_activity_types"("new_order" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_user_activity_type_enabled"("p_activity_type" "text", "p_is_enabled" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_user_activity_type_enabled"("p_activity_type" "text", "p_is_enabled" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."set_user_activity_type_enabled"("p_activity_type" "text", "p_is_enabled" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_activity_type_enabled"("p_activity_type" "text", "p_is_enabled" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."share_activity_with_connections"("p_activity_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."share_activity_with_connections"("p_activity_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."share_activity_with_connections"("p_activity_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."stats_activity_trend_meta"("target_user" "uuid", "weeks_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."stats_activity_trend_meta"("target_user" "uuid", "weeks_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."stats_activity_trend_meta"("target_user" "uuid", "weeks_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."stats_activity_trend_series"("target_user" "uuid", "activity_type" "text", "metric" "text", "weeks_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."stats_activity_trend_series"("target_user" "uuid", "activity_type" "text", "metric" "text", "weeks_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."stats_activity_trend_series"("target_user" "uuid", "activity_type" "text", "metric" "text", "weeks_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."stats_goal_progress"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."stats_goal_progress"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."stats_goal_progress"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."stats_trends_90_days"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."stats_trends_90_days"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."stats_trends_90_days"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_preferences_from_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_preferences_from_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_preferences_from_auth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unshare_activity"("p_activity_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unshare_activity"("p_activity_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unshare_activity"("p_activity_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_circle_activity_reaction"("p_activity_share_id" "uuid", "p_user_id" "uuid", "p_reaction_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_circle_activity_reaction"("p_activity_share_id" "uuid", "p_user_id" "uuid", "p_reaction_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_circle_activity_reaction"("p_activity_share_id" "uuid", "p_user_id" "uuid", "p_reaction_type" "text") TO "service_role";



GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."activity_equipment" TO "anon";
GRANT ALL ON TABLE "public"."activity_equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_equipment" TO "service_role";



GRANT ALL ON TABLE "public"."activity_photos" TO "anon";
GRANT ALL ON TABLE "public"."activity_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_photos" TO "service_role";



GRANT ALL ON TABLE "public"."activity_preferences" TO "anon";
GRANT ALL ON TABLE "public"."activity_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."activity_share_photos" TO "anon";
GRANT ALL ON TABLE "public"."activity_share_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_share_photos" TO "service_role";



GRANT ALL ON TABLE "public"."activity_share_reactions" TO "anon";
GRANT ALL ON TABLE "public"."activity_share_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_share_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."activity_share_recipients" TO "anon";
GRANT ALL ON TABLE "public"."activity_share_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_share_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."activity_share_tags" TO "anon";
GRANT ALL ON TABLE "public"."activity_share_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_share_tags" TO "service_role";



GRANT ALL ON TABLE "public"."activity_shares" TO "anon";
GRANT ALL ON TABLE "public"."activity_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_shares" TO "service_role";



GRANT ALL ON TABLE "public"."activity_tags" TO "anon";
GRANT ALL ON TABLE "public"."activity_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_tags" TO "service_role";



GRANT ALL ON TABLE "public"."circle_invite_links" TO "anon";
GRANT ALL ON TABLE "public"."circle_invite_links" TO "authenticated";
GRANT ALL ON TABLE "public"."circle_invite_links" TO "service_role";



GRANT ALL ON TABLE "public"."equipment" TO "anon";
GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";



GRANT ALL ON TABLE "public"."goal_preferences" TO "anon";
GRANT ALL ON TABLE "public"."goal_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."location_cache" TO "anon";
GRANT ALL ON TABLE "public"."location_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."location_cache" TO "service_role";



GRANT ALL ON TABLE "public"."micro_adjustment_suggestion_events" TO "anon";
GRANT ALL ON TABLE "public"."micro_adjustment_suggestion_events" TO "authenticated";
GRANT ALL ON TABLE "public"."micro_adjustment_suggestion_events" TO "service_role";



GRANT ALL ON TABLE "public"."micro_adjustment_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."micro_adjustment_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."micro_adjustment_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."micro_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."micro_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."micro_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."preset_equipment" TO "anon";
GRANT ALL ON TABLE "public"."preset_equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."preset_equipment" TO "service_role";



GRANT ALL ON TABLE "public"."presets" TO "anon";
GRANT ALL ON TABLE "public"."presets" TO "authenticated";
GRANT ALL ON TABLE "public"."presets" TO "service_role";



GRANT ALL ON TABLE "public"."user_activity_types" TO "anon";
GRANT ALL ON TABLE "public"."user_activity_types" TO "authenticated";
GRANT ALL ON TABLE "public"."user_activity_types" TO "service_role";



GRANT ALL ON TABLE "public"."user_connections" TO "anon";
GRANT ALL ON TABLE "public"."user_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."user_connections" TO "service_role";



GRANT ALL ON TABLE "public"."user_consents" TO "anon";
GRANT ALL ON TABLE "public"."user_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."user_consents" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_strava_connections" TO "anon";
GRANT ALL ON TABLE "public"."user_strava_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."user_strava_connections" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
