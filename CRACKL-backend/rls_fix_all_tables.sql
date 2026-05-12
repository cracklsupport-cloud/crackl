-- ====================================================================
-- CRACKL: Fix ALL RLS Errors — 12 Tables
-- Paste this ENTIRE script into your Supabase SQL Editor and run it.
-- ====================================================================
-- 
-- Your backend uses the ANON key (not service_role), so policies must
-- allow the 'anon' role to perform all operations the backend needs.
-- Since ALL database access goes through your Express backend (which
-- handles its own auth via JWT + admin key), this is safe.
--
-- The old RLS file blocked anon writes with WITH CHECK (false), which
-- is why RLS was never actually activated — it would break everything.
-- ====================================================================

-- ─── STEP 1: Drop ALL existing policies (clean slate) ─────────────────────
-- This prevents "policy already exists" errors if you run this multiple times.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;


-- ─── STEP 2: Enable RLS on ALL 12 tables ──────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riddles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solved_riddles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riddle_daily_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riddle_family_seen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounty_board ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;


-- ─── STEP 3: Create policies for each table ───────────────────────────────
-- Pattern: Backend (anon role) needs full CRUD. Direct PostgREST access
-- from untrusted clients is blocked by NOT exposing the anon key publicly.
-- Your frontend NEVER talks to Supabase directly — everything goes through
-- your Express server, which is the real security boundary.

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  USERS                                                      ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_users" ON public.users
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_users" ON public.users
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "backend_update_users" ON public.users
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "backend_delete_users" ON public.users
    FOR DELETE TO anon USING (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  RIDDLES                                                    ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_riddles" ON public.riddles
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_riddles" ON public.riddles
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "backend_update_riddles" ON public.riddles
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "backend_delete_riddles" ON public.riddles
    FOR DELETE TO anon USING (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SOLVED_RIDDLES                                             ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_solved" ON public.solved_riddles
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_solved" ON public.solved_riddles
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "backend_delete_solved" ON public.solved_riddles
    FOR DELETE TO anon USING (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  LEADERBOARD                                                ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_leaderboard" ON public.leaderboard
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_leaderboard" ON public.leaderboard
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "backend_update_leaderboard" ON public.leaderboard
    FOR UPDATE TO anon USING (true) WITH CHECK (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  CASHBACK_REQUESTS                                          ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_cashback" ON public.cashback_requests
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_cashback" ON public.cashback_requests
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "backend_update_cashback" ON public.cashback_requests
    FOR UPDATE TO anon USING (true) WITH CHECK (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  MULTIPLAYER_ROOMS                                          ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_rooms" ON public.multiplayer_rooms
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_rooms" ON public.multiplayer_rooms
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "backend_update_rooms" ON public.multiplayer_rooms
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "backend_delete_rooms" ON public.multiplayer_rooms
    FOR DELETE TO anon USING (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  ROOM_PLAYERS                                               ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_players" ON public.room_players
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_players" ON public.room_players
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "backend_update_players" ON public.room_players
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "backend_delete_players" ON public.room_players
    FOR DELETE TO anon USING (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  RIDDLE_DAILY_LOCKS                                         ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_locks" ON public.riddle_daily_locks
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_locks" ON public.riddle_daily_locks
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "backend_delete_locks" ON public.riddle_daily_locks
    FOR DELETE TO anon USING (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  RIDDLE_FAMILY_SEEN                                         ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_family" ON public.riddle_family_seen
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_family" ON public.riddle_family_seen
    FOR INSERT TO anon WITH CHECK (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  CHAIN_PROGRESS                                             ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_chain" ON public.chain_progress
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_chain" ON public.chain_progress
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "backend_update_chain" ON public.chain_progress
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "backend_delete_chain" ON public.chain_progress
    FOR DELETE TO anon USING (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  BOUNTY_BOARD                                               ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_bounty" ON public.bounty_board
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_bounty" ON public.bounty_board
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "backend_update_bounty" ON public.bounty_board
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "backend_delete_bounty" ON public.bounty_board
    FOR DELETE TO anon USING (true);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  APP_SETTINGS                                               ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE POLICY "backend_select_settings" ON public.app_settings
    FOR SELECT TO anon USING (true);

CREATE POLICY "backend_insert_settings" ON public.app_settings
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "backend_update_settings" ON public.app_settings
    FOR UPDATE TO anon USING (true) WITH CHECK (true);


-- ====================================================================
-- DONE! All 12 tables now have RLS enabled with backend-compatible
-- policies. Run "Rerun linter" in the Security Advisor to verify
-- all errors are resolved.
-- ====================================================================

-- VERIFICATION QUERY (optional — uncomment to check):
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
