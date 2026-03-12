-- Auto-clean old Circle invite links.
-- Strategy:
-- 1) Keep runtime checks for active/expired in invite RPCs (already implemented)
-- 2) Run a daily cleanup to remove old expired/used/revoked rows

create index if not exists circle_invite_links_expires_at_idx
  on public.circle_invite_links (expires_at);

create index if not exists circle_invite_links_accepted_at_idx
  on public.circle_invite_links (accepted_at)
  where accepted_at is not null;

create index if not exists circle_invite_links_revoked_at_idx
  on public.circle_invite_links (revoked_at)
  where revoked_at is not null;

create or replace function public.cleanup_circle_invite_links(
  p_expired_retention interval default interval '30 days',
  p_used_retention interval default interval '90 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.circle_invite_links l
  where
    (l.expires_at < now() - p_expired_retention)
    or (l.accepted_at is not null and l.accepted_at < now() - p_used_retention)
    or (l.revoked_at is not null and l.revoked_at < now() - p_used_retention);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

do $$
begin
  -- Prevent direct client-side RPC use of cleanup function.
  revoke all on function public.cleanup_circle_invite_links(interval, interval) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.cleanup_circle_invite_links(interval, interval) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.cleanup_circle_invite_links(interval, interval) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.cleanup_circle_invite_links(interval, interval) to service_role;
  end if;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron not available; skipping invite cleanup scheduling.';
    return;
  end if;

  -- Ensure idempotency: remove existing jobs with same name.
  for v_job_id in
    select j.jobid
    from cron.job j
    where j.jobname = 'cleanup-circle-invites-daily'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  -- Run once a day at 03:15 UTC.
  perform cron.schedule(
    'cleanup-circle-invites-daily',
    '15 3 * * *',
    'select public.cleanup_circle_invite_links();'
  );
end;
$$;

-- Run once immediately so old rows are cleaned without waiting for next schedule.
select public.cleanup_circle_invite_links();
