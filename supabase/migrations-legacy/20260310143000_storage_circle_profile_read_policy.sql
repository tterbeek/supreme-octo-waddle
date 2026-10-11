-- Allow authenticated users to read Circle profile images from the notes bucket.
-- This is limited to files uploaded via uploadCircleProfileImage():
--   {user_id}/circle-profile-*.jpg
--   {user_id}/thumb/circle-profile-*.jpg

drop policy if exists "Authenticated can read circle profile images" on storage.objects;
create policy "Authenticated can read circle profile images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'actvity-notes'
  and (
    name like '%/circle-profile-%'
    or name like '%/thumb/circle-profile-%'
  )
);
