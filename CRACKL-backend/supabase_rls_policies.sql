-- CRACKL RESTRICTIVE ROW LEVEL SECURITY (RLS) POLICIES
-- Execute this script in your Supabase SQL Editor.

-- Protect users table (Users can only read and update their own data)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for users based on id" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Enable update for users based on id" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Public read for leaderboards
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read leaderboard" ON leaderboard
  FOR SELECT USING (true);
CREATE POLICY "Service role only insert leaderboard" ON leaderboard
  FOR INSERT WITH CHECK (false); -- Blocked for anon, allowed for service_role
CREATE POLICY "Service role only update leaderboard" ON leaderboard
  FOR UPDATE USING (false); -- Blocked for anon, allowed for service_role

-- Protect riddles (Backend service_role fetches them, client should not fetch directly unless needed)
-- We set it so clients can read active riddles but not add/delete them.
ALTER TABLE riddles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active riddles" ON riddles
  FOR SELECT USING (is_active = true);

-- Protect multiplayer_rooms (Clients can read specific rooms, backend creates them)
ALTER TABLE multiplayer_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read rooms" ON multiplayer_rooms
  FOR SELECT USING (true);
CREATE POLICY "Backend insert rooms" ON multiplayer_rooms
  FOR INSERT WITH CHECK (false); -- Backend (service_role) only

-- Protect app_settings (Global settings, read-only to public)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read app_settings" ON app_settings
  FOR SELECT USING (true);
CREATE POLICY "No public updates to app_settings" ON app_settings
  FOR UPDATE USING (false);

-- Note: The Express.js backend MUST use the SUPABASE_SERVICE_ROLE_KEY to bypass RLS
-- and perform authoritative writes (like granting coins, inserting leaderboards, etc).

-- RPC for atomic coin deduction/addition to prevent race conditions
CREATE OR REPLACE FUNCTION adjust_user_coins(p_user_id UUID, p_coins_delta INT)
RETURNS TABLE (new_coins INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE users
    SET coins = GREATEST(0, coins + p_coins_delta)
    WHERE id = p_user_id
    RETURNING coins INTO new_coins;

    RETURN QUERY SELECT new_coins;
END;
$$;
