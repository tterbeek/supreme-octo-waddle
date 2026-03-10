-- Allow Circle recipients to read shared activity image objects.
-- This is limited to images explicitly referenced on active, non-expired shares
-- delivered to the current recipient.

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
    join public.activity_share_recipients r
      on r.activity_share_id = s.id
    where r.recipient_user_id = auth.uid()
      and r.hidden_at is null
      and s.deleted_at is null
      and s.expires_at > now()
      and (
        s.shared_photo_url = storage.objects.name
        or s.shared_thumb_photo_url = storage.objects.name
        or split_part(
          replace(
            replace(
              regexp_replace(
                coalesce(s.shared_photo_url, ''),
                '^https?://[^/]+/storage/v1/object/(?:sign|public)/actvity-notes/',
                ''
              ),
              '%2F',
              '/'
            ),
            '%2f',
            '/'
          ),
          '?',
          1
        ) = storage.objects.name
        or split_part(
          replace(
            replace(
              regexp_replace(
                coalesce(s.shared_thumb_photo_url, ''),
                '^https?://[^/]+/storage/v1/object/(?:sign|public)/actvity-notes/',
                ''
              ),
              '%2F',
              '/'
            ),
            '%2f',
            '/'
          ),
          '?',
          1
        ) = storage.objects.name
      )
  )
);
