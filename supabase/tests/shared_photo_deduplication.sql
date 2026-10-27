begin;
update social_config set enabled=true;
insert into auth.users(id,email) values('f8000000-0000-4000-8000-000000000001','photo-gallery@example.test');
set local role authenticated;
set local request.jwt.claim.sub='f8000000-0000-4000-8000-000000000001';
insert into activities(id,user_id,type,date,note_image_url) values
 ('f8000000-0000-4000-8000-000000000002',auth.uid(),'walk',current_date,auth.uid()||'/first.jpg'),
 ('f8000000-0000-4000-8000-000000000004',auth.uid(),'walk',current_date,auth.uid()||'/legacy.jpg');
insert into activity_photos(id,activity_id,user_id,image_path,thumb_path) values
 ('f8000000-0000-4000-8000-000000000003','f8000000-0000-4000-8000-000000000002',auth.uid(),auth.uid()||'/first.jpg',auth.uid()||'/thumb.jpg');
do $$ declare c uuid;destination uuid;a uuid:='f8000000-0000-4000-8000-000000000002';f jsonb;s jsonb;context uuid;begin
 c:=(social_community('create',null,'{"name":"Photo gallery"}')->>'id')::uuid;
 select (value->>'id')::uuid into destination from jsonb_array_elements(social_home()->'audiences') where value->>'community_id'=c::text;
 perform social_activity(a,jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',destination,'share',true))));
 f:=social_feed(null,null,a);
 assert jsonb_array_length(f->0->'photos')=1,'mirrored original photo not duplicated';
 assert jsonb_array_length(social_activity(a)->'photos')=1,'one checkbox per photo';
 context:=(f->0->'contexts'->0->>'id')::uuid;
 perform social_activity(a,'{"photos":[]}');
 assert social_feed(null,null,a)->0->'photos'='[]'::jsonb,'unchecking photo cannot be bypassed by legacy copy';
 begin
  perform social_media_path(context,'legacy');raise exception 'Legacy copy still accessible';
 exception when raise_exception then if SQLERRM<>'Photo unavailable' then raise;end if;end;
 s:=social_activity('f8000000-0000-4000-8000-000000000004');
 assert jsonb_array_length(s->'photos')=1 and s->'photos'->0->>'id'='legacy','legacy-only image appears as an individual photo';
 perform social_activity('f8000000-0000-4000-8000-000000000004','{"photos":[]}');
 assert not(social_activity('f8000000-0000-4000-8000-000000000004')->'photos'->0->>'shared')::boolean,'legacy-only photo can be unchecked';
 perform social_activity('f8000000-0000-4000-8000-000000000004','{"photos":["legacy"]}');
 assert (social_activity('f8000000-0000-4000-8000-000000000004')->'photos'->0->>'shared')::boolean,'legacy-only photo can be selected again';
end $$;
rollback;
