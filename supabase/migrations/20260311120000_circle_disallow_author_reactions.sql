-- Disallow reacting to your own Circle activities.

-- Clean up any existing self-reactions to keep data consistent.
delete from public.activity_share_reactions ar
using public.activity_shares s
where s.id = ar.activity_share_id
  and s.author_user_id = ar.user_id;

drop policy if exists "Circle users can insert their own reactions" on public.activity_share_reactions;
create policy "Circle users can insert their own reactions"
on public.activity_share_reactions
for insert
with check (
  auth.uid() = user_id
  and public.can_access_circle_share(activity_share_id, auth.uid())
  and exists (
    select 1
    from public.activity_shares s
    where s.id = activity_share_id
      and s.author_user_id <> auth.uid()
      and s.deleted_at is null
      and s.expires_at > now()
  )
);

drop policy if exists "Circle users can update their own reactions" on public.activity_share_reactions;
create policy "Circle users can update their own reactions"
on public.activity_share_reactions
for update
using (
  auth.uid() = user_id
  and public.can_access_circle_share(activity_share_id, auth.uid())
  and exists (
    select 1
    from public.activity_shares s
    where s.id = activity_share_id
      and s.author_user_id <> auth.uid()
      and s.deleted_at is null
      and s.expires_at > now()
  )
)
with check (
  auth.uid() = user_id
  and public.can_access_circle_share(activity_share_id, auth.uid())
  and exists (
    select 1
    from public.activity_shares s
    where s.id = activity_share_id
      and s.author_user_id <> auth.uid()
      and s.deleted_at is null
      and s.expires_at > now()
  )
);

drop policy if exists "Circle users can delete their own reactions" on public.activity_share_reactions;
create policy "Circle users can delete their own reactions"
on public.activity_share_reactions
for delete
using (
  auth.uid() = user_id
  and public.can_access_circle_share(activity_share_id, auth.uid())
  and exists (
    select 1
    from public.activity_shares s
    where s.id = activity_share_id
      and s.author_user_id <> auth.uid()
      and s.deleted_at is null
      and s.expires_at > now()
  )
);

drop function if exists public.upsert_circle_activity_reaction(uuid, uuid, text);
create function public.upsert_circle_activity_reaction(
  p_activity_share_id uuid,
  p_user_id uuid,
  p_reaction_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user uuid;
  v_reaction text;
  v_saved text;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  v_reaction := upper(trim(coalesce(p_reaction_type, '')));
  if v_reaction not in ('CHEER', 'INSPIRED', 'ENERGY', 'BEAUTIFUL', 'MOVED') then
    raise exception 'Unsupported reaction type';
  end if;

  if exists (
    select 1
    from public.activity_shares s
    where s.id = p_activity_share_id
      and s.author_user_id = p_user_id
      and s.deleted_at is null
      and s.expires_at > now()
  ) then
    raise exception 'You cannot react to your own activity';
  end if;

  if not public.can_access_circle_share(p_activity_share_id, p_user_id) then
    raise exception 'Share not accessible';
  end if;

  insert into public.activity_share_reactions (
    activity_share_id,
    user_id,
    reaction_type
  )
  values (
    p_activity_share_id,
    p_user_id,
    v_reaction
  )
  on conflict (activity_share_id, user_id)
  do update set
    reaction_type = excluded.reaction_type,
    updated_at = now()
  returning reaction_type
  into v_saved;

  return v_saved;
end;
$$;

drop function if exists public.remove_circle_activity_reaction(uuid, uuid);
create function public.remove_circle_activity_reaction(
  p_activity_share_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  if exists (
    select 1
    from public.activity_shares s
    where s.id = p_activity_share_id
      and s.author_user_id = p_user_id
      and s.deleted_at is null
      and s.expires_at > now()
  ) then
    raise exception 'You cannot react to your own activity';
  end if;

  if not public.can_access_circle_share(p_activity_share_id, p_user_id) then
    raise exception 'Share not accessible';
  end if;

  delete from public.activity_share_reactions ar
  where ar.activity_share_id = p_activity_share_id
    and ar.user_id = p_user_id;

  return found;
end;
$$;
