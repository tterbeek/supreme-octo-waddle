-- Extend Circle image read policy to support paths stored in activity_share_photos.

drop policy if exists "Circle recipients can read shared images" on storage.objects;
create policy "Circle recipients can read shared images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'actvity-notes'
  and exists (
    select 1
    from public.activity_share_recipients r
    join public.activity_shares s
      on s.id = r.activity_share_id
    left join public.activity_share_photos sp
      on sp.activity_share_id = s.id
    where r.recipient_user_id = auth.uid()
      and r.hidden_at is null
      and s.deleted_at is null
      and s.expires_at > now()
      and (
        sp.image_path = storage.objects.name
        or sp.thumb_path = storage.objects.name
        or s.shared_photo_url = storage.objects.name
        or s.shared_thumb_photo_url = storage.objects.name
        or split_part(
          replace(
            replace(
              regexp_replace(
                coalesce(sp.image_path, ''),
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
                coalesce(sp.thumb_path, ''),
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
