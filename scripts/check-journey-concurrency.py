#!/usr/bin/env python3
"""Real concurrent transactions, restricted to the disposable schema-check stack."""
import argparse
import concurrent.futures
import json
import subprocess
parser = argparse.ArgumentParser()
parser.add_argument("--container", default="supabase_db_movenotes-schema-check")
args = parser.parse_args()
if args.container != "supabase_db_movenotes-schema-check":
    raise SystemExit("Only the disposable schema-check database is supported")
def sql(text):
    result = subprocess.run(
        ["docker", "exec", "-i", args.container, "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"],
        input=text, text=True, capture_output=True, check=True, timeout=40,
    )
    return result.stdout.strip()
owner = "a6000000-0000-4000-8000-000000000001"
community = "a6100000-0000-4000-8000-000000000001"
audience = "a6200000-0000-4000-8000-000000000001"
challenge = "a6400000-0000-4000-8000-000000000001"
ids = ["a6500000-0000-4000-8000-000000000001", "a6500000-0000-4000-8000-000000000002"]
def summary():
    sql(f"select reconcile_journey('{challenge}');")
    value = sql(f"""select jsonb_build_object(
      'total',(select coalesce(sum(journey_km),0) from journey_contributions where challenge_id='{challenge}' and active),
      'buckets',(select count(*) from journey_participation_days where challenge_id='{challenge}'),
      'activities',(select count(*) from journey_contributions where challenge_id='{challenge}' and active),
      'winner',(select activity_id from journey_participation_days where challenge_id='{challenge}' order by day_key limit 1));""")
    return json.loads(value.splitlines()[-1])
try:
    sql(f"""begin;
      update social_config set enabled=true;
      insert into auth.users(id,email) values('{owner}','concurrent-journey@example.test');
      insert into communities(id,owner_id,name) values('{community}','{owner}','Concurrent fixture');
      insert into community_members(community_id,user_id,role,status,joined_at) values('{community}','{owner}','owner','active','2019-01-01T00:00Z');
      insert into social_audiences(id,kind,community_id) values('{audience}','community','{community}');
      insert into community_challenges(id,community_id,creator_id,title,metric,target,scope,starts_on,time_zone,journey_policy_version)
       values('{challenge}','{community}','{owner}','Concurrency','virtual_distance',10,'collective','2020-01-01','Europe/Brussels','journey-distance-v1');
      commit;""")
    def insert(index):
        sql(f"""begin;
          insert into activities(id,user_id,type,date,started_at,effort)
           values('{ids[index]}','{owner}','walk','2020-10-25','2020-10-25T00:30Z',null);
          select pg_sleep(0.1);
          insert into social_contexts(activity_id,audience_id) values('{ids[index]}','{audience}');
          commit;""")
    def reconcile(_):
        sql(f"select reconcile_journey('{challenge}');")
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(insert, 1), pool.submit(insert, 0),pool.submit(reconcile, 0), pool.submit(reconcile, 1)]
        for future in futures:
            future.result()
    value = summary()
    assert value["total"] == 1 and value["buckets"] == 1 and value["activities"] == 2, value
    assert value["winner"] == ids[0], value
    sql(f"update activities set date='2020-10-26',started_at='2020-10-26T12:00Z' where id='{ids[0]}';")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(reconcile, range(2)))
    value = summary()
    assert value["total"] == 2 and value["buckets"] == 2, value
    sql(f"update social_contexts set revoked_at=now() where audience_id='{audience}';")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(reconcile, range(2)))
    value = summary()
    assert value["total"] == 0 and value["buckets"] == 0 and value["activities"] == 0, value
    print("Journey concurrency passed: imports/jobs, deterministic daily credit, date changes and withdrawal.")
finally:
    sql(f"delete from communities where id='{community}';delete from auth.users where id='{owner}';")
