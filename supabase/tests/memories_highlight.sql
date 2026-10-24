-- Deterministic fictional selection-policy scenarios, rolled back by verifier.
begin;
insert into auth.users(id,email) values('cccccccc-cccc-4ccc-cccc-cccccccccccc','highlight@example.test');
set local request.jwt.claim.sub='cccccccc-cccc-4ccc-cccc-cccccccccccc';
do $$
declare photo_day date:=date '2026-10-24'; near_id uuid:='11111111-1111-4111-8111-111111111111';
 far_id uuid:='22222222-2222-4222-8222-222222222222'; sparse_id uuid:='33333333-3333-4333-8333-333333333333';
 exact_id uuid:='44444444-4444-4444-8444-444444444444'; uid uuid:=auth.uid();
begin
 photo_day:=photo_day+mod(1-mod(photo_day-date '2000-01-01',3)+3,3);
 insert into activities(id,user_id,type,date,title,notes,note_image_url) values
  (near_id,uid,'walk',(photo_day-interval '1 year')::date+20,'Nearby words','Original note',null),
  (sparse_id,uid,'run',(photo_day-interval '1 year')::date+21,'Sparse import',null,null),
  (far_id,uid,'ride','2023-04-15','An older photo',null,'owner/photo.jpg');
 assert memory_pick_candidate(photo_day)=far_id,'occasional older-photo fallback outside seasonal window';
 assert memory_date_tier((select date from activities where id=far_id),photo_day)=2,'older photo gets general reason, not seasonal claim';
 assert memory_pick_candidate(photo_day+1)=near_id,'other days keep nearby context';
 assert memory_pick_candidate(photo_day+2)=sparse_id,'photo-free sparse activity keeps reserved turn';
 insert into activities(id,user_id,type,date,title) values(exact_id,uid,'walk',(photo_day-interval '1 year')::date,'An exact anniversary');
 assert memory_pick_candidate(photo_day)=exact_id,'exact anniversary always beats broader photos';
 delete from activities where id=exact_id;
 update activities set note_image_url='owner/nearby.jpg' where id=near_id;
 assert memory_pick_candidate(photo_day)=near_id,'nearby photo wins over broader archive';
 assert memory_pick_candidate(photo_day+2)=sparse_id,'photo-free entries still get their turn when nearby photos exist';
 update activities set note_image_url=null where id=near_id;
 insert into memory_dismissals values(uid,far_id);
 assert memory_pick_candidate(photo_day)<>far_id,'broader fallback still excludes hidden photos';
 delete from memory_dismissals where user_id=uid;
 insert into memory_days(user_id,day,activity_id,exposed_at) values(uid,photo_day-1,far_id,now());
 assert memory_pick_candidate(photo_day)<>far_id,'broader fallback respects actual-exposure cooldown';
 delete from memory_days where user_id=uid;
 -- Existing daily assignment remains authoritative, even after widening policy.
 insert into memory_days(user_id,day,activity_id) values(uid,(now() at time zone 'UTC')::date,near_id);
 assert memory_feature('UTC')->>'id'=near_id::text,'existing daily assignment is not replaced';
end $$;
set local role authenticated;
do $$ begin
 begin
  perform memory_pick_candidate(current_date);
  raise exception 'internal policy is callable by a client';
 exception when insufficient_privilege then null;end;
end $$;
rollback;
