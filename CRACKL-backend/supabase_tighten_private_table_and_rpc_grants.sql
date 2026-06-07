-- CRACKL private table/RPC grant hardening.
-- Applied to Supabase project pblyedoyxcxuqdhgnljv as tighten_private_table_and_rpc_grants.
-- Defense in depth: private service-role tables should not have anon/auth grants,
-- even when RLS deny policies already block access.

revoke all privileges on table public.admin_audit_logs from anon, authenticated;
revoke all privileges on table public.admin_image_assets from anon, authenticated;
revoke all privileges on table public.answer_judgments from anon, authenticated;
revoke all privileges on table public.semantic_answer_cache from anon, authenticated;

revoke execute on function public.upsert_leaderboard(uuid, text, text, integer) from anon, authenticated, public;
