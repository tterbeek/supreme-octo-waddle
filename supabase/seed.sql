-- Local development storage policies.
-- These are deliberately seed data, not production migrations.

drop policy if exists "local users can upload activity images" on storage.objects;
create policy "local users can upload activity images"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'actvity-notes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "local users can read activity images" on storage.objects;
create policy "local users can read activity images"
on storage.objects
for select to authenticated
using (
  bucket_id = 'actvity-notes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "local users can update activity images" on storage.objects;
create policy "local users can update activity images"
on storage.objects
for update to authenticated
using (
  bucket_id = 'actvity-notes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'actvity-notes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "local users can delete activity images" on storage.objects;
create policy "local users can delete activity images"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'actvity-notes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
