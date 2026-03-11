-- Include reacted_at in reaction_groups payload so UI can order latest reactors first.

create or replace function public.get_circle_feed(
  p_user_id uuid,
  p_limit integer default 30,
  p_before_occurred_on date default null,
  p_before_shared_at timestamptz default null,
  p_before_recipient_id uuid default null
)
returns table (
  recipient_id uuid,
  activity_share_id uuid,
  shared_at timestamptz,
  occurred_on date,
  author_user_id uuid,
  author_display_name text,
  author_profile_image_path text,
  author_profile_thumb_path text,
  title text,
  activity_type text,
  distance_km numeric,
  duration_min numeric,
  shared_photo_url text,
  shared_thumb_photo_url text,
  photos jsonb,
  reaction_groups jsonb,
  current_user_reaction text,
  has_new_reactions boolean,
  seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
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
