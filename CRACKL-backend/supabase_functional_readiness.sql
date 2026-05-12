-- CRACKL functional readiness hardening.
-- Safe to rerun. Designed for the current Express-backed architecture.

-- 1. Ranked mode needs this table live.
CREATE TABLE IF NOT EXISTS public.ranked_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  username TEXT,
  city TEXT,
  rating INTEGER NOT NULL DEFAULT 1000 CHECK (rating >= 0),
  tier TEXT NOT NULL DEFAULT 'Bronze',
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  matches_played INTEGER NOT NULL DEFAULT 0 CHECK (matches_played >= 0),
  best_rating INTEGER NOT NULL DEFAULT 1000 CHECK (best_rating >= 0),
  last_delta INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ranked_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS backend_select_ranked_profiles ON public.ranked_profiles;
DROP POLICY IF EXISTS backend_insert_ranked_profiles ON public.ranked_profiles;
DROP POLICY IF EXISTS backend_update_ranked_profiles ON public.ranked_profiles;
CREATE POLICY backend_select_ranked_profiles ON public.ranked_profiles FOR SELECT TO anon USING (true);
CREATE POLICY backend_insert_ranked_profiles ON public.ranked_profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY backend_update_ranked_profiles ON public.ranked_profiles FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS ranked_profiles_rating_idx ON public.ranked_profiles (rating DESC);

-- 2. Make RDE functions actually respect mode pools.
CREATE OR REPLACE FUNCTION public.get_next_riddle(
  p_user_id UUID,
  p_tier INTEGER,
  p_mode TEXT DEFAULT 'arena',
  p_session_id TEXT DEFAULT NULL,
  p_category_exclude TEXT[] DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  question TEXT,
  options JSONB,
  category TEXT,
  difficulty TEXT,
  difficulty_tier INTEGER,
  hint TEXT,
  fun_fact TEXT,
  game_mode TEXT,
  riddle_type TEXT,
  media_url TEXT,
  layout_config JSONB,
  times_served INTEGER
)
LANGUAGE SQL
SET search_path = public
AS $$
  SELECT
    r.id, r.question, r.options, r.category,
    r.difficulty, r.difficulty_tier, r.hint,
    r.fun_fact, r.game_mode, r.riddle_type,
    r.media_url, r.layout_config, r.times_served
  FROM public.riddles r
  WHERE r.is_active = true
    AND r.difficulty_tier = p_tier
    AND (p_mode IS NULL OR p_mode = '' OR r.game_mode = p_mode)
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_riddle_history urh
      WHERE urh.user_id = p_user_id
        AND urh.riddle_id = r.id
    )
    AND (
      p_session_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.session_riddle_queue srq
        WHERE srq.session_id = p_session_id
          AND srq.riddle_id = r.id
      )
    )
    AND (
      p_category_exclude IS NULL
      OR r.category != ALL(p_category_exclude)
      OR NOT EXISTS (
        SELECT 1
        FROM public.riddles r2
        WHERE r2.is_active = true
          AND r2.difficulty_tier = p_tier
          AND (p_mode IS NULL OR p_mode = '' OR r2.game_mode = p_mode)
          AND NOT EXISTS (
            SELECT 1
            FROM public.user_riddle_history u2
            WHERE u2.user_id = p_user_id
              AND u2.riddle_id = r2.id
          )
          AND r2.category != ALL(p_category_exclude)
      )
    )
  ORDER BY r.times_served ASC, r.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_oldest_solved_riddle(
  p_user_id UUID,
  p_tier INTEGER,
  p_mode TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  question TEXT,
  options JSONB,
  category TEXT,
  difficulty TEXT,
  difficulty_tier INTEGER,
  hint TEXT,
  fun_fact TEXT,
  game_mode TEXT,
  riddle_type TEXT,
  media_url TEXT,
  layout_config JSONB,
  times_served INTEGER
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT
    r.id, r.question, r.options, r.category,
    r.difficulty, r.difficulty_tier, r.hint,
    r.fun_fact, r.game_mode, r.riddle_type,
    r.media_url, r.layout_config, r.times_served
  FROM public.riddles r
  JOIN public.user_riddle_history urh ON urh.riddle_id = r.id
  WHERE urh.user_id = p_user_id
    AND urh.status = 'solved'
    AND urh.solved_at < NOW() - INTERVAL '30 days'
    AND r.difficulty_tier = p_tier
    AND r.is_active = true
    AND (p_mode IS NULL OR p_mode = '' OR r.game_mode = p_mode)
  ORDER BY urh.solved_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.serve_riddle(
  p_user_id UUID,
  p_tier INTEGER,
  p_mode TEXT DEFAULT 'arena',
  p_session_id TEXT DEFAULT NULL,
  p_category_exclude TEXT[] DEFAULT NULL,
  p_xp_at_time INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  question TEXT,
  options JSONB,
  category TEXT,
  difficulty TEXT,
  difficulty_tier INTEGER,
  hint TEXT,
  fun_fact TEXT,
  game_mode TEXT,
  riddle_type TEXT,
  media_url TEXT,
  layout_config JSONB,
  times_served INTEGER
)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_riddle_id UUID;
BEGIN
  SELECT r.id INTO v_riddle_id
  FROM public.riddles r
  WHERE r.is_active = true
    AND r.difficulty_tier = p_tier
    AND (p_mode IS NULL OR p_mode = '' OR r.game_mode = p_mode)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_riddle_history urh
      WHERE urh.user_id = p_user_id AND urh.riddle_id = r.id
    )
    AND (
      p_session_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.session_riddle_queue srq
        WHERE srq.session_id = p_session_id AND srq.riddle_id = r.id
      )
    )
    AND (
      p_category_exclude IS NULL
      OR r.category != ALL(p_category_exclude)
      OR NOT EXISTS (
        SELECT 1 FROM public.riddles r2
        WHERE r2.is_active = true
          AND r2.difficulty_tier = p_tier
          AND (p_mode IS NULL OR p_mode = '' OR r2.game_mode = p_mode)
          AND NOT EXISTS (
            SELECT 1 FROM public.user_riddle_history u2
            WHERE u2.user_id = p_user_id AND u2.riddle_id = r2.id
          )
          AND r2.category != ALL(p_category_exclude)
      )
    )
  ORDER BY r.times_served ASC, r.created_at ASC
  LIMIT 1;

  IF v_riddle_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.riddles
  SET times_served = times_served + 1,
      last_served_at = NOW()
  WHERE public.riddles.id = v_riddle_id;

  INSERT INTO public.user_riddle_history
    (user_id, riddle_id, mode, status, xp_at_time, attempted_at)
  VALUES
    (p_user_id, v_riddle_id, p_mode, 'served', p_xp_at_time, NOW())
  ON CONFLICT (user_id, riddle_id) DO NOTHING;

  IF p_session_id IS NOT NULL THEN
    INSERT INTO public.session_riddle_queue
      (session_id, riddle_id, position, served_at)
    VALUES
      (
        p_session_id,
        v_riddle_id,
        COALESCE((SELECT MAX(position) + 1 FROM public.session_riddle_queue WHERE session_id = p_session_id), 1),
        NOW()
      )
    ON CONFLICT (session_id, riddle_id) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.question, r.options, r.category,
    r.difficulty, r.difficulty_tier, r.hint,
    r.fun_fact, r.game_mode, r.riddle_type,
    r.media_url, r.layout_config, r.times_served
  FROM public.riddles r
  WHERE r.id = v_riddle_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_next_riddle(UUID, INT, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_oldest_solved_riddle(UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_oldest_solved_riddle(UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.serve_riddle(UUID, INT, TEXT, TEXT, TEXT[], INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_riddle(UUID, INT, TEXT, TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_oldest_solved_riddle(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_oldest_solved_riddle(UUID, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.serve_riddle(UUID, INT, TEXT, TEXT, TEXT[], INT) TO service_role;

-- 3. Clear security advisor search-path warnings for existing helper functions.
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.upsert_leaderboard(UUID, TEXT, TEXT, INT) SET search_path = public;
ALTER FUNCTION public.cleanup_stale_rooms() SET search_path = public;
ALTER FUNCTION public.cleanup_orphan_session_queues() SET search_path = public;

-- 4. Cover foreign keys and remove duplicate indexes flagged by advisors.
CREATE INDEX IF NOT EXISTS idx_multiplayer_rooms_current_riddle_id ON public.multiplayer_rooms (current_riddle_id);
CREATE INDEX IF NOT EXISTS idx_session_riddle_queue_answered_by ON public.session_riddle_queue (answered_by);
CREATE INDEX IF NOT EXISTS idx_session_riddle_queue_riddle_id ON public.session_riddle_queue (riddle_id);
CREATE INDEX IF NOT EXISTS idx_solved_riddles_riddle_id ON public.solved_riddles (riddle_id);
CREATE INDEX IF NOT EXISTS idx_solved_riddles_user_id ON public.solved_riddles (user_id);

DROP INDEX IF EXISTS public.idx_room_players_room;
DROP INDEX IF EXISTS public.idx_rooms_status;
ALTER TABLE public.chain_progress DROP CONSTRAINT IF EXISTS uq_chain_progress_user_chain;
ALTER TABLE public.riddle_daily_locks DROP CONSTRAINT IF EXISTS uq_daily_lock_riddle_date;
ALTER TABLE public.riddle_family_seen DROP CONSTRAINT IF EXISTS uq_family_seen_user_family;

-- 5. Global settings defaults.
INSERT INTO public.app_settings (key, value)
VALUES
  ('panic_timer_seconds', '30'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- 6. Retire obvious throwaway test content from the live pool.
UPDATE public.riddles
SET is_active = false
WHERE question IN ('shata', 'g4g3', 'your mom is hot');

UPDATE public.bounty_board
SET active = false
WHERE expires_at IS NOT NULL AND expires_at < NOW();

-- 7. Seed a clean starter content pool so every mode has something to serve.
WITH seed(question, answer, options, category, difficulty, difficulty_tier, game_mode, hint, fun_fact, family_id) AS (
  VALUES
    ('What has keys but cannot unlock a door?', 'keyboard', jsonb_build_array('Clock','Keyboard','Compass','Mirror'), 'Logic', 'Easy', 1, 'mcq', 'It answers through your fingers.', 'The word key can mean both a button and a lock tool.', NULL),
    ('Which word becomes shorter when two letters are added to it?', 'short', jsonb_build_array('Tall','Short','Small','Large'), 'Wordplay', 'Easy', 2, 'mcq', 'Read the word, not the object.', 'Adding e and r creates shorter.', NULL),
    ('I am a number. Double me, then add ten, and you get thirty. What am I?', '10', jsonb_build_array('5','10','15','20'), 'Logic', 'Medium', 3, 'mcq', 'Undo the final addition first.', 'Simple algebra is still a riddle when wrapped in words.', NULL),
    ('What is taken from a mine, locked inside wood, and released by a hand?', 'pencil lead', jsonb_build_array('Diamond','Pencil lead','Coal','Ink'), 'Objects', 'Hard', 4, 'mcq', 'It writes without being liquid.', 'Graphite is the material inside many pencils.', NULL),
    ('A guard says one door always lies and one always tells truth. What kind of question finds freedom?', 'a comparative question', jsonb_build_array('A yes question','A comparative question','A random guess','A password'), 'Deduction', 'Hard', 5, 'mcq', 'Ask one door about the other.', 'Classic liar/truth puzzles test structure, not trivia.', NULL),

    ('I speak without a mouth and answer without a body. What am I?', 'echo', NULL::jsonb, 'Logic', 'Easy', 1, 'type', 'It only exists after sound.', 'Echoes are reflections of sound waves.', NULL),
    ('I have cities, roads, and rivers, but no people, cars, or water. What am I?', 'map', NULL::jsonb, 'Objects', 'Easy', 2, 'type', 'It shows places without being a place.', 'Maps compress geography into symbols.', NULL),
    ('The more you take from me, the bigger I become. What am I?', 'hole', NULL::jsonb, 'Logic', 'Medium', 3, 'type', 'Taking away creates it.', 'A hole grows by removal.', NULL),
    ('I can travel around the world while staying in one corner. What am I?', 'stamp', NULL::jsonb, 'Wordplay', 'Hard', 4, 'type', 'It rides on envelopes.', 'A stamp sits in the corner of a letter.', NULL),
    ('I am always ahead of you, but I never arrive. What am I?', 'future', NULL::jsonb, 'Abstract', 'Hard', 5, 'type', 'You move toward it every second.', 'The future is a moving horizon.', NULL),

    ('What can be cracked, made, told, and played?', 'joke', jsonb_build_array('Code','Joke','Case','Lock'), 'Wordplay', 'Easy', 1, 'arena', 'It can make a room laugh.', 'One word can carry several actions.', NULL),
    ('What has one eye but cannot see?', 'needle', jsonb_build_array('Storm','Needle','Camera','Cyclops'), 'Objects', 'Easy', 2, 'arena', 'Thread passes through it.', 'Needles have eyes for thread.', NULL),
    ('I am light as a feather, yet the strongest agent cannot hold me for long. What am I?', 'breath', jsonb_build_array('Smoke','Breath','Secret','Feather'), 'Body', 'Medium', 3, 'arena', 'You can take it, but not keep it.', 'Breath becomes harder to hold over time.', NULL),
    ('I reveal everything in front of me but keep nothing. What am I?', 'mirror', jsonb_build_array('Camera','Mirror','Witness','Window'), 'Objects', 'Hard', 4, 'arena', 'It copies without memory.', 'A mirror reflects without recording.', NULL),
    ('I become true only when everyone stops doubting me. What am I?', 'consensus', jsonb_build_array('Rumor','Consensus','Secret','Signal'), 'Abstract', 'Hard', 5, 'arena', 'It is built from agreement.', 'Consensus is social proof turned into decision.', NULL),

    ('What has a face and two hands but no arms?', 'clock', jsonb_build_array('Clock','Mask','Robot','Statue'), 'Objects', 'Easy', 1, 'daily', 'It keeps pointing all day.', 'Analog clocks use hands to show time.', NULL),
    ('What runs but never walks?', 'river', NULL::jsonb, 'Nature', 'Easy', 2, 'daily', 'It has a bed but does not sleep.', 'Rivers run through channels.', NULL),
    ('What can fill a room without taking up space?', 'light', NULL::jsonb, 'Physics', 'Medium', 3, 'daily', 'It arrives through a window.', 'Light occupies a room visually, not physically.', NULL),
    ('What loses its head in the morning and gets it back at night?', 'pillow', NULL::jsonb, 'Objects', 'Hard', 4, 'daily', 'Your head leaves it when you wake.', 'A pillow supports your head while sleeping.', NULL),
    ('What is strongest when broken and weakest when kept whole?', 'promise', NULL::jsonb, 'Abstract', 'Hard', 5, 'daily', 'Breaking it changes its power over trust.', 'A broken promise can shape behavior more than an untested one.', NULL),

    ('I disappear the moment you say my name. What am I?', 'silence', NULL::jsonb, 'Logic', 'Easy', 1, 'gauntlet', 'Naming it makes noise.', 'Silence ends when speech begins.', NULL),
    ('I shrink while I work. What am I?', 'candle', NULL::jsonb, 'Objects', 'Easy', 2, 'gauntlet', 'It pays for light with itself.', 'Candles burn down as they glow.', NULL),
    ('What has branches but no fruit, trunk, or leaves?', 'bank', NULL::jsonb, 'Wordplay', 'Medium', 3, 'gauntlet', 'Money may pass through it.', 'Bank branches are offices, not trees.', NULL),
    ('I show every answer except my own. What am I?', 'question', NULL::jsonb, 'Meta', 'Hard', 4, 'gauntlet', 'You are inside one now.', 'A question points at an answer but is not the answer.', NULL),
    ('I am the proof left after every perfect lie fails. What am I?', 'contradiction', NULL::jsonb, 'Deduction', 'Hard', 5, 'gauntlet', 'It breaks the story from inside.', 'Contradictions expose faulty logic.', NULL),

    ('Node 1: I begin every mission but vanish when action starts.', 'plan', NULL::jsonb, 'Chain', 'Easy', 1, 'chain', 'It is made before the move.', 'Plans guide action until reality takes over.', 'starter-chain-alpha'),
    ('Node 2: I protect a secret and open only when you know me.', 'cipher', NULL::jsonb, 'Chain', 'Easy', 1, 'chain', 'It turns meaning into disguise.', 'Ciphers transform readable text into coded text.', 'starter-chain-alpha'),
    ('Node 3: I am the trail left by every wrong guess.', 'clue', NULL::jsonb, 'Chain', 'Medium', 3, 'chain', 'Failure still leaves information.', 'Good deduction treats mistakes as signal.', 'starter-chain-alpha'),
    ('Node 4: I connect separate clues into one truth.', 'pattern', NULL::jsonb, 'Chain', 'Medium', 3, 'chain', 'It appears when pieces repeat.', 'Pattern recognition is core to puzzle solving.', 'starter-chain-alpha'),
    ('Node 5: I arrive after doubt and before victory.', 'answer', NULL::jsonb, 'Chain', 'Hard', 5, 'chain', 'It ends the sequence.', 'A final answer closes a chain.', 'starter-chain-alpha'),

    ('I am safest when locked away, but most useful when risked wisely. What am I?', 'stake', NULL::jsonb, 'Wager', 'Easy', 1, 'wager', 'You put it forward before the reveal.', 'A wager turns confidence into consequence.', NULL),
    ('I am the lie you pay for before you know if it is true. What am I?', 'bluff', NULL::jsonb, 'Wager', 'Easy', 2, 'wager', 'Cards made me famous.', 'Bluffs are risk wrapped in performance.', NULL),
    ('I grow when courage wins and vanish when confidence fails. What am I?', 'wager', NULL::jsonb, 'Wager', 'Medium', 3, 'wager', 'It is the mode itself.', 'A wager converts outcome into reward or loss.', NULL),
    ('I hold value, but only a correct answer can release me twice. What am I?', 'escrow', NULL::jsonb, 'Wager', 'Hard', 4, 'wager', 'It waits between risk and reward.', 'Escrow is a locked holding state.', NULL),
    ('I am the cost of being certain before evidence appears. What am I?', 'risk', NULL::jsonb, 'Wager', 'Hard', 5, 'wager', 'Blind wager begins with it.', 'Risk is uncertainty priced into action.', NULL),

    ('I am a prize that gets heavier as fewer people can reach me. What am I?', 'bounty', NULL::jsonb, 'Bounty', 'Easy', 1, 'bounty', 'Hunters chase it.', 'Bounties make one target valuable.', NULL),
    ('I am claimed once, then disappear from the board. What am I?', 'contract', NULL::jsonb, 'Bounty', 'Easy', 2, 'bounty', 'The first solver closes it.', 'A contract ends when fulfilled.', NULL),
    ('I turn one correct answer into a public event. What am I?', 'bounty board', NULL::jsonb, 'Bounty', 'Medium', 3, 'bounty', 'It announces the prize.', 'Shared prize boards create urgency.', NULL),
    ('I am a reward that punishes hesitation more than ignorance. What am I?', 'deadline', NULL::jsonb, 'Bounty', 'Hard', 4, 'bounty', 'It expires.', 'Deadlines change player behavior.', NULL),
    ('I am the rare target everyone sees, but only one operative owns. What am I?', 'legendary bounty', NULL::jsonb, 'Bounty', 'Hard', 5, 'bounty', 'There is only one first clear.', 'Scarcity makes a shared challenge feel legendary.', NULL)
)
INSERT INTO public.riddles (
  question,
  answer,
  options,
  category,
  difficulty,
  difficulty_tier,
  game_mode,
  hint,
  fun_fact,
  family_id,
  data_used,
  riddle_type,
  region,
  is_active
)
SELECT
  question,
  answer,
  options,
  category,
  difficulty,
  difficulty_tier,
  game_mode,
  hint,
  fun_fact,
  family_id,
  'seed:crackl-starter-v1',
  'text',
  'IN',
  true
FROM seed
WHERE NOT EXISTS (
  SELECT 1 FROM public.riddles WHERE data_used = 'seed:crackl-starter-v1'
);

INSERT INTO public.bounty_board (question, answer, prize_coins, expires_at, active)
SELECT
  'I vanish when named, return when ignored, and make a room heavier without adding weight. What am I?',
  'silence',
  1500,
  NOW() + INTERVAL '30 days',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.bounty_board
  WHERE question = 'I vanish when named, return when ignored, and make a room heavier without adding weight. What am I?'
);
