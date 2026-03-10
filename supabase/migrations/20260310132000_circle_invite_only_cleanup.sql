-- Circle cleanup after moving to invite-link only connections.
-- Removes legacy email/request flow DB pieces.

drop function if exists public.request_circle_connection_by_email(uuid, text);

drop policy if exists "Users can create connection requests they send"
on public.user_connections;

-- token is already UNIQUE on circle_invite_links, so this extra index is redundant
drop index if exists public.circle_invite_links_token_idx;
