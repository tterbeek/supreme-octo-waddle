-- Ensure recipients can read share rows used by storage policy checks.

alter table public.activity_shares enable row level security;

-- Recipients need select access for storage.objects policy EXISTS subqueries
-- (otherwise signed URL requests return "Object not found").
drop policy if exists "Recipients can view active shares addressed to them" on public.activity_shares;
create policy "Recipients can view active shares addressed to them"
on public.activity_shares
for select
to authenticated
using (
  deleted_at is null
  and expires_at > now()
  and exists (
    select 1
    from public.activity_share_recipients r
    where r.activity_share_id = activity_shares.id
      and r.recipient_user_id = auth.uid()
      and r.hidden_at is null
  )
);
