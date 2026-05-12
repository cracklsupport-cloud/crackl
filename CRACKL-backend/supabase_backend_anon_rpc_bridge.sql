-- Temporary local-backend bridge.
-- The backend currently runs with SUPABASE_KEY because SUPABASE_SERVICE_ROLE_KEY is not configured.
-- These grants keep stat/economy writes atomic until the service-role key is added.
-- Revoke anon/authenticated execute in the production hardening migration.
grant execute on function public.increment_coins(uuid, integer) to anon;
grant execute on function public.increment_user_stats(uuid, integer, integer, integer, integer, integer) to anon;
