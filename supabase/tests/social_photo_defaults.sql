begin;
update social_config set enabled=true;
insert into auth.users(id,email) values
 ('f7000000-0000-4000-8000-000000000001','photo-default@example.test');
set local role authenticated;
set local request.jwt.claim.sub='f7000000-0000-4000-8000-000000000001';
insert into activities(id,user_id,type,date,note_image_url) values
 ('f7000000-0000-4000-8000-000000000002',auth.uid(),'walk',current_date,auth.uid()||'/old.jpg');
insert into activity_photos(id,activity_id,user_id,image_path,thumb_path) values
 ('f7000000-0000-4000-8000-000000000003','f7000000-0000-4000-8000-000000000002',auth.uid(),auth.uid()||'/new.jpg',auth.uid()||'/thumb.jpg');
do $$ declare a uuid:='f7000000-0000-4000-8000-000000000002';s jsonb;begin
 s:=social_activity(a);
 assert (s->'photos'->0->>'shared')::boolean and (s->>'legacy_photo')::boolean,'photos selected by default';
 assert social_feed() = '[]'::jsonb,'photo defaults do not publish private activity';
 perform social_activity(a,'{"photos":[],"legacy_photo":false}');
 update activity_photos set image_path=auth.uid()||'/replacement.jpg' where activity_id=a;
 update activities set note_image_url=auth.uid()||'/replacement-legacy.jpg' where id=a;
 s:=social_activity(a);
 assert not(s->'photos'->0->>'shared')::boolean and not(s->>'legacy_photo')::boolean,'explicit exclusions survive replacement and reopening';
 insert into activity_photos(activity_id,user_id,image_path,thumb_path,sort_order) values(a,auth.uid(),auth.uid()||'/another.jpg',auth.uid()||'/another-thumb.jpg',1);
 assert (select count(*) from activity_photos where activity_id=a and is_shared)=1,'new photo selected without reselecting excluded photos';
end $$;
rollback;
