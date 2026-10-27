begin;
insert into auth.users(id,email) values
 ('cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaaa','photo-priority@example.test');
insert into activities(id,user_id,type,date,notes,note_image_url) values
 ('cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaa1','cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaaa','walk','2024-01-10','A personal note',null),
 ('cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaa2','cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaaa','walk','2024-01-10',null,'fictional/photo.jpg'),
 ('cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaa3','cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaaa','walk','2024-01-10',null,null);
set local request.jwt.claim.sub='cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ begin
 for offset_day in 0..2 loop
  assert memory_pick_candidate(date '2026-10-27'+offset_day)='cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaa2'::uuid,
   'Photo outranks notes and sparse activities on every rotation day';
 end loop;
end $$;
insert into memory_dismissals(user_id,activity_id) values
 ('cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaaa','cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaa2');
do $$ begin
 assert memory_pick_candidate('2026-10-27')<>'cccccccc-aaaa-4aaa-aaaa-aaaaaaaaaaa2'::uuid,
  'Photo priority must not bypass dismissal';
end $$;
rollback;
