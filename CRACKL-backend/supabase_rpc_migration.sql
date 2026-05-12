-- CRACKL: Atomic economy + stats RPCs
-- Applied via Supabase migration. Keep signatures aligned with server.js.

CREATE OR REPLACE FUNCTION increment_user_stats(
  p_user_id UUID,
  p_coins_delta INT DEFAULT 0,
  p_xp_delta INT DEFAULT 0,
  p_streak INT DEFAULT NULL,
  p_played_delta INT DEFAULT 1,
  p_correct_delta INT DEFAULT 0
)
RETURNS TABLE(new_coins INT, new_xp INT, new_level TEXT, new_streak INT, new_total_played INT, new_total_correct INT) AS $$
DECLARE
  v_next_xp INT;
BEGIN
  SELECT GREATEST(0, COALESCE(u.xp, 0) + COALESCE(p_xp_delta, 0))
  INTO v_next_xp
  FROM users u
  WHERE u.id = p_user_id
  FOR UPDATE;

  RETURN QUERY
  UPDATE users u
  SET
    coins = GREATEST(0, COALESCE(u.coins, 0) + COALESCE(p_coins_delta, 0)),
    xp = v_next_xp,
    level = CASE
      WHEN v_next_xp < 100 THEN 'Novice'
      WHEN v_next_xp < 300 THEN 'Thinker'
      WHEN v_next_xp < 600 THEN 'Riddler'
      WHEN v_next_xp < 1000 THEN 'Mastermind'
      WHEN v_next_xp < 2000 THEN 'Genius'
      ELSE 'Legend'
    END,
    streak = GREATEST(0, COALESCE(p_streak, u.streak, 0)),
    total_played = GREATEST(0, COALESCE(u.total_played, 0) + GREATEST(0, COALESCE(p_played_delta, 0))),
    total_correct = LEAST(
      GREATEST(0, COALESCE(u.total_played, 0) + GREATEST(0, COALESCE(p_played_delta, 0))),
      GREATEST(0, COALESCE(u.total_correct, 0) + GREATEST(0, COALESCE(p_correct_delta, 0)))
    ),
    updated_at = NOW()
  WHERE u.id = p_user_id
  RETURNING u.coins, u.xp, u.level, u.streak, u.total_played, u.total_correct;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- For room/answer: simpler atomic coin increment
CREATE OR REPLACE FUNCTION increment_coins(
  p_user_id UUID,
  p_coins_delta INT DEFAULT 0
)
RETURNS INT AS $$
DECLARE
  v_coins INT;
BEGIN
  UPDATE users
  SET coins = GREATEST(0, COALESCE(coins, 0) + COALESCE(p_coins_delta, 0)),
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING coins INTO v_coins;

  RETURN v_coins;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION increment_user_stats(UUID, INT, INT, INT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION increment_coins(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_user_stats(UUID, INT, INT, INT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION increment_coins(UUID, INT) TO service_role;
