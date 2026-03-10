-- Hotfix: simplify and harden Circle shared-image read access for recipients/authors.
-- This addresses createSignedUrl 400/not_found when object exists in storage.

drop policy if exists "Circle recipients can read shared images" on storage.objects;
create policy "Circle recipients can read shared images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'actvity-notes'
  and exists (
    select 1
    from public.activity_shares s
    left join public.activity_share_recipients r
      on r.activity_share_id = s.id
    left join public.activity_share_photos sp
      on sp.activity_share_id = s.id
    where s.deleted_at is null
      and s.expires_at > now()
      and (
        s.author_user_id = auth.uid()
        or (
          r.recipient_user_id = auth.uid()
          and r.hidden_at is null
        )
      )
      and (
        storage.objects.name = coalesce(sp.image_path, '')
        or storage.objects.name = coalesce(sp.thumb_path, '')
        or storage.objects.name = coalesce(s.shared_photo_url, '')
        or storage.objects.name = coalesce(s.shared_thumb_photo_url, '')
      )
  )
);
