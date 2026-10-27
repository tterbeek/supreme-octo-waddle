-- Resolve a shared activity author's current profile photo through the same
-- context authorization and bounded media delivery used for activity photos.
create or replace function public.social_media_path(p_context uuid,p_photo text,p_thumb boolean default false) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a activities;path text;begin
 if not social_can_read(p_context) then raise exception 'Photo unavailable';end if;
 select x.* into a from activities x join social_contexts s on s.activity_id=x.id where s.id=p_context;
 if p_photo='profile' then
  select coalesce(nullif(social_profile_thumb_path,''),nullif(social_profile_image_path,'')) into path
   from user_preferences where user_id=a.user_id;
 elsif p_photo='legacy' and a.share_legacy_photo then
  path:=case when p_thumb then coalesce(a.note_thumb_image_url,a.note_image_url) else a.note_image_url end;
 elsif p_photo ~ '^[a-fA-F0-9-]{36}$' then
  select case when p_thumb then coalesce(thumb_path,image_path) else image_path end into path
   from activity_photos where id=p_photo::uuid and activity_id=a.id and user_id=a.user_id and is_shared;
 end if;
 if path is null then raise exception 'Photo unavailable';end if;
 return jsonb_build_object('path',path,'owner',a.user_id);
end; $$;
