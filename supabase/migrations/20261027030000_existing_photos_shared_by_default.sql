-- One-time adoption of the requested all-photos default for existing records.
-- This resets previous photo exclusions, but does not create any social audience,
-- alter private activity flags, or copy private notes. Later opt-outs persist.
update public.activity_photos set is_shared=true where not is_shared;
update public.activities set share_legacy_photo=true where not share_legacy_photo;
