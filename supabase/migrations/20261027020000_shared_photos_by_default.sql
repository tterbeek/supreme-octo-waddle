-- New photos are included when an activity has an authorized social audience.
-- Existing photo exclusions remain authoritative; no historical visibility changes.
alter table public.activity_photos alter column is_shared set default true;
alter table public.activities alter column share_legacy_photo set default true;

-- Replacing a photo retains its selected/unselected state.
drop trigger social_photo_consent on public.activity_photos;

create or replace function public.social_activity_lifecycle() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_OP='DELETE' then
  -- Account cascades have already removed auth.users; no undo tombstone is needed.
  if exists(select 1 from auth.users where id=old.user_id) then
   insert into social_deleted_activities values(old.id,old.user_id) on conflict do nothing;
  end if;return old;
 elsif TG_OP='INSERT' then
  if exists(select 1 from social_deleted_activities where activity_id=new.id) then new.social_private:=true;end if;
 else
  -- Preserve the owner's photo choice when replacing an existing image.
  if old.note_image_url is null and new.note_image_url is not null then new.share_legacy_photo:=true;end if;
  if new.social_private and not old.social_private then
   update social_contexts set revoked_at=now() where activity_id=new.id and revoked_at is null;
   update social_activity_state set decision='exclude',updated_at=now() where activity_id=new.id;
  end if;
 end if;return new;
end; $$;
