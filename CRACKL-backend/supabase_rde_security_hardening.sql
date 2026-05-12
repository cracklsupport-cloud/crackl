-- CRACKL RDE SECURITY HARDENING
-- Keep riddle delivery behind the Express backend, not public PostgREST RPC calls.

ALTER VIEW public.riddles_safe SET (security_invoker = true);
ALTER VIEW public.bounty_board_safe SET (security_invoker = true);
ALTER VIEW public.user_unseen_riddles SET (security_invoker = true);

ALTER FUNCTION public.get_next_riddle(UUID, INT, TEXT, TEXT, TEXT[]) SET search_path = public;
ALTER FUNCTION public.get_oldest_solved_riddle(UUID, INT) SET search_path = public;
ALTER FUNCTION public.serve_riddle(UUID, INT, TEXT, TEXT, TEXT[], INT) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_next_riddle(UUID, INT, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_oldest_solved_riddle(UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.serve_riddle(UUID, INT, TEXT, TEXT, TEXT[], INT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_next_riddle(UUID, INT, TEXT, TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_oldest_solved_riddle(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.serve_riddle(UUID, INT, TEXT, TEXT, TEXT[], INT) TO service_role;
