-- Circle share image access v3:
-- - support both historical bucket names
-- - support raw paths and fully-qualified storage URLs in share snapshot fields

drop policy if exists "Circle recipients can read shared images" on storage.objects;

create policy "Circle recipients can read shared images"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('actvity-notes', 'activity-notes')
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
        or split_part(
          regexp_replace(
            coalesce(sp.image_path, ''),
            '^https?://[^/]+/storage/v1/object/(?:sign|public)/(?:actvity-notes|activity-notes)/',
            ''
          ),
          '?',
          1
        ) = storage.objects.name
        or split_part(
          regexp_replace(
            coalesce(sp.thumb_path, ''),
            '^https?://[^/]+/storage/v1/object/(?:sign|public)/(?:actvity-notes|activity-notes)/',
            ''
          ),
          '?',
          1
        ) = storage.objects.name
        or split_part(
          regexp_replace(
            coalesce(s.shared_photo_url, ''),
            '^https?://[^/]+/storage/v1/object/(?:sign|public)/(?:actvity-notes|activity-notes)/',
            ''
          ),
          '?',
          1
        ) = storage.objects.name
        or split_part(
          regexp_replace(
            coalesce(s.shared_thumb_photo_url, ''),
            '^https?://[^/]+/storage/v1/object/(?:sign|public)/(?:actvity-notes|activity-notes)/',
            ''
          ),
          '?',
          1
        ) = storage.objects.name
      )
  )
);
