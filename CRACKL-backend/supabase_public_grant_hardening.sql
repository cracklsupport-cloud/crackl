-- Public grant hardening
-- Applied to Supabase project pblyedoyxcxuqdhgnljv on 2026-05-20.
-- Purpose: keep CRACKL backend-only tables/functions inaccessible to direct anon/authenticated Data API/RPC clients.

revoke all privileges on table public.bounty_attempts from anon, authenticated;
grant select, insert, update, delete on table public.bounty_attempts to service_role;

revoke execute on function public.cleanup_orphan_session_queues() from public, anon, authenticated;
revoke execute on function public.cleanup_stale_rooms() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

grant execute on function public.cleanup_orphan_session_queues() to service_role;
grant execute on function public.cleanup_stale_rooms() to service_role;
grant execute on function public.set_updated_at() to service_role;
