drop function if exists public.get_journal_feed_page_v2(integer, integer);

create function public.get_journal_feed_page_v2(
  p_limit integer,
  p_offset integer
)
returns table (
  entry_kind text,
  day date,
  within_day_ts timestamptz,
  id uuid,

  user_id uuid,
  type text,
  date date,
  distance_km numeric,
  feeling integer,
  created_at timestamp without time zone,
  title text,
  effort integer,
  notes text,
  note_updated_at timestamptz,
  note_image_url text,
  duration_min numeric,
  note_thumb_image_url text,

  entry_type text,
  entry_text text,
  journal_created_at timestamptz,

  metadata jsonb,
  equipment jsonb,

  photos jsonb,

  source text,
  raw_sport_type text,
  raw_type text,
  external_source text,
  external_id text,
  started_at timestamptz
)
language sql
stable
security invoker
as $$
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
