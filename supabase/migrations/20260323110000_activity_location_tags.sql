alter table public.activity_photos
  add column if not exists lat numeric,
  add column if not exists lng numeric;

create table if not exists public.location_cache (
  key text primary key,
  lat numeric,
  lng numeric,
  name text,
  type text,
  created_at timestamptz default now()
);

alter table public.location_cache enable row level security;

create table if not exists public.activity_tags (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  type text not null,
  value text not null,
  metadata jsonb not null default '{}'::jsonb,
  source text,
  created_at timestamptz default now()
);

create unique index if not exists activity_tags_activity_type_key
  on public.activity_tags (activity_id, type);

create index if not exists idx_activity_tags_activity_id
  on public.activity_tags (activity_id);

create index if not exists idx_activity_tags_type
  on public.activity_tags (type);

alter table public.activity_tags enable row level security;

drop policy if exists "Users can view tags for their own activities" on public.activity_tags;
create policy "Users can view tags for their own activities"
on public.activity_tags
for select
using (
  exists (
    select 1
    from public.activities a
    where a.id = activity_tags.activity_id
      and a.user_id = auth.uid()
  )
);
