-- CRACKL POST SERVICE-ROLE HARDENING
-- Apply this only after CRACKL-backend/.env contains SUPABASE_SERVICE_ROLE_KEY
-- and the backend has been restarted successfully.

-- Remove temporary anon access used while the local backend lacked a service key.
revoke execute on function public.increment_coins(uuid, integer) from anon, authenticated;
revoke execute on function public.increment_user_stats(uuid, integer, integer, integer, integer, integer) from anon, authenticated;

-- Keep protected RDE functions backend-only.
revoke execute on function public.get_next_riddle(uuid, integer, text, text, text[]) from public, anon, authenticated;
revoke execute on function public.get_oldest_solved_riddle(uuid, integer) from public, anon, authenticated;
revoke execute on function public.serve_riddle(uuid, integer, text, text, text[], integer) from public, anon, authenticated;

grant execute on function public.increment_coins(uuid, integer) to service_role;
grant execute on function public.increment_user_stats(uuid, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.get_next_riddle(uuid, integer, text, text, text[]) to service_role;
grant execute on function public.get_oldest_solved_riddle(uuid, integer) to service_role;
grant execute on function public.serve_riddle(uuid, integer, text, text, text[], integer) to service_role;

-- Storage note:
-- riddle-media is public for public URLs, but object listing should be blocked
-- before launch by replacing broad SELECT policies with path-scoped read access
-- or signed URLs. Review current storage policies in Supabase Dashboard before
-- applying a destructive drop-policy statement.
