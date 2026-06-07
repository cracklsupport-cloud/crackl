const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { checkTypedAnswer, model: geminiModel } = require('./gemini');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Serve standalone admin website at /admin-ui
app.use('/admin-ui', express.static(path.join(__dirname, 'admin')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'crackl-super-secret-jwt-key-2026';

let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// Safe answer comparison — avoids false positives from overly loose substring matching
function isAnswerCorrect(userAnswer, correctAnswer) {
  const u = (userAnswer || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const c = (correctAnswer || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!u || u === '__timeout__') return false;
  if (u === c) return true;
  // Strip punctuation and compare again
  const uClean = u.replace(/[^a-z0-9 ]/g, '');
  const cClean = c.replace(/[^a-z0-9 ]/g, '');
  if (uClean === cClean) return true;
  // Allow user answer to be a meaningful substring of correct answer (e.g. "einstein" ⊂ "albert einstein")
  // Require at least 3 chars to avoid single-letter false positives
  if (u.length >= 3 && cClean.includes(uClean)) return true;
  return false;
}

function calculateLevel(xp) {
  if (xp < 100) return 'Novice';
  if (xp < 300) return 'Thinker';
  if (xp < 600) return 'Riddler';
  if (xp < 1000) return 'Mastermind';
  if (xp < 2000) return 'Genius';
  return 'Legend';
}

function makeRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.get('/', (req, res) => res.json({ status: 'CRACKL running!' }));

// ============================
// 🧠 SMART RIDDLE DISTRIBUTION ENGINE
// ============================

// Adaptive difficulty based on XP — probability bands
function getDifficultyForXP(xp) {
  const r = Math.random();
  if (xp < 50)   return 'Easy';
  if (xp < 150)  return r < 0.60 ? 'Easy' : r < 0.95 ? 'Medium' : 'Hard';
  if (xp < 400)  return r < 0.25 ? 'Easy' : r < 0.80 ? 'Medium' : 'Hard';
  if (xp < 1000) return r < 0.10 ? 'Easy' : r < 0.50 ? 'Medium' : 'Hard';
  return r < 0.05 ? 'Easy' : r < 0.30 ? 'Medium' : 'Hard';
}

// Seeded shuffle — ensures different users get different riddle ordering from same pool
function seededShuffle(arr, seed) {
  const result = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h + seed.charCodeAt(i)) | 0; }
  for (let i = result.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Core riddle picker — used by all modes
// New algorithm: daily lock (same riddle can't go to two users on same day),
// family blocking (user never gets two variants of same riddle family),
// onboarding priority (new users get easy/interesting riddles first)
async function pickRiddle(userId, xp, gameMode = 'arena', forceDifficulty = null) {
  const userXp = parseInt(xp) || 0;
  const today = new Date().toISOString().split('T')[0];

  // Determine target difficulty
  // New users (XP < 50) always get Easy for non-daily modes (onboarding flow)
  let targetDifficulty = forceDifficulty;
  if (!targetDifficulty) {
    targetDifficulty = (userXp < 50 && gameMode !== 'daily') ? 'Easy' : getDifficultyForXP(userXp);
  }

  // 1. Get all riddle IDs this user has already seen/solved
  const { data: solved } = await supabase
    .from('solved_riddles')
    .select('riddle_id')
    .eq('user_id', userId);
  const solvedIds = solved ? solved.map(s => s.riddle_id) : [];

  // 2. Get all riddle families this user has already seen (blocks all variants of same family)
  const { data: seenFamilies } = await supabase
    .from('riddle_family_seen')
    .select('family_id')
    .eq('user_id', userId);
  const seenFamilyIds = seenFamilies ? seenFamilies.map(f => f.family_id) : [];

  // 3. Get riddles already served to anyone today (daily anti-collision lock)
  const { data: todayLocks } = await supabase
    .from('riddle_daily_locks')
    .select('riddle_id')
    .eq('lock_date', today);
  const dailyLockedIds = todayLocks ? todayLocks.map(l => l.riddle_id) : [];

  // Combined exclusion list (sliced to prevent URL overflow limits)
  const rawExcludeIds = [...new Set([...solvedIds, ...dailyLockedIds])];
  const excludeIds = rawExcludeIds.slice(0, 500);

  // Build riddle query for a specific difficulty
  async function queryPool(difficulty, preferOnboarding) {
    let query = supabase
      .from('riddles')
      .select('*')
      .eq('game_mode', gameMode)
      .eq('difficulty', difficulty)
      .eq('is_active', true);

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data } = await query;
    if (!data || data.length === 0) return [];

    // Filter out riddles whose family the user has already seen
    let pool = data.filter(r => !r.family_id || !seenFamilyIds.includes(r.family_id));

    // For new users (XP < 50), prefer onboarding riddles first
    if (preferOnboarding) {
      const onboarding = pool.filter(r => r.is_onboarding === true);
      if (onboarding.length > 0) return onboarding;
    }

    return pool;
  }

  const isNewUser = userXp < 50 && gameMode !== 'daily';

  // Try target difficulty first
  let pool = await queryPool(targetDifficulty, isNewUser);

  // Fallback to adjacent difficulties if pool is empty
  if (pool.length === 0) {
    const fallbackOrder = ['Easy', 'Medium', 'Hard'].filter(d => d !== targetDifficulty);
    for (const fb of fallbackOrder) {
      pool = await queryPool(fb, isNewUser);
      if (pool.length > 0) break;
    }
  }

  // If still empty, pool is truly exhausted for this mode today
  if (pool.length === 0) return null;

  // Seeded shuffle: same user always gets same ordering from same pool (anti-collision between users)
  // Salt changes daily so ordering resets each day
  const sessionSalt = userId + today;
  const shuffled = seededShuffle(pool, sessionSalt);
  const chosen = shuffled[0];

  // Lock this riddle for today — ON CONFLICT DO NOTHING makes this race-condition safe
  await supabase
    .from('riddle_daily_locks')
    .upsert({ riddle_id: chosen.id, lock_date: today, served_to: userId, served_at: new Date().toISOString() }, { onConflict: 'riddle_id,lock_date', ignoreDuplicates: true });

  // If riddle has a family_id, mark this family as seen for this user
  if (chosen.family_id) {
    await supabase
      .from('riddle_family_seen')
      .upsert({ user_id: userId, family_id: chosen.family_id, seen_at: new Date().toISOString() }, { onConflict: 'user_id,family_id', ignoreDuplicates: true });
  }

  // Update riddle analytics
  await supabase
    .from('riddles')
    .update({ times_served: (chosen.times_served || 0) + 1, last_served_at: new Date().toISOString() })
    .eq('id', chosen.id);

  return chosen;
}

// ============================
// 🔧 MIDDLEWARE
// ============================

// Check if app is in maintenance mode — blocks all riddle endpoints
const checkMaintenance = async (req, res, next) => {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .single();
    if (data?.value === 'true') {
      const { data: msgData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'maintenance_message')
        .single();
      return res.status(503).json({
        maintenance: true,
        message: msgData?.value || 'App is under maintenance. Back soon!'
      });
    }
  } catch {
    // If app_settings table doesn't exist yet, allow through
  }
  next();
};

// Check admin secret (header-based, for admin routes)
const checkAdmin = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  const expected = process.env.ADMIN_SECRET || 'crackl-admin-2026';
  if (secret !== expected) {
    return res.status(403).json({ success: false, error: 'Unauthorized Admin Access.' });
  }
  next();
};

// Check admin via JWT + is_admin field in users table
const checkAdminUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Token required' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', decoded.id)
      .single();
    if (!user?.is_admin) return res.status(403).json({ success: false, error: 'Admin access only.' });
    req.adminUserId = decoded.id;
    next();
  } catch {
    return res.status(403).json({ success: false, error: 'Invalid or expired token.' });
  }
};

// Token authentication middleware (for future protected routes)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Access denied' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ============================
// 📡 APP STATUS (public — no auth)
// ============================
app.get('/app/status', async (req, res) => {
  try {
    const { data: modeData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .single();
    const { data: msgData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'maintenance_message')
      .single();
    res.json({
      maintenance: modeData?.value === 'true',
      message: msgData?.value || 'We are updating the vault. Back soon!'
    });
  } catch {
    res.json({ maintenance: false, message: '' });
  }
});

// ============================
// 👑 ADMIN ROUTES
// ============================

// Real-time overview stats
app.get('/admin/stats', checkAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [riddlesRes, locksRes, usersRes, maintRes] = await Promise.all([
      supabase.from('riddles').select('id, game_mode, difficulty, is_active, is_onboarding'),
      supabase.from('riddle_daily_locks').select('riddle_id').eq('lock_date', today),
      supabase.from('users').select('id').gte('updated_at', yesterday24h),
      supabase.from('app_settings').select('value').eq('key', 'maintenance_mode').single()
    ]);

    const riddles = riddlesRes.data || [];
    const servedToday = (locksRes.data || []).length;
    const activeUsers24h = (usersRes.data || []).length;
    const maintenanceMode = maintRes.data?.value === 'true';

    const modes = ['arena', 'daily', 'gauntlet', 'chain', 'wager', 'bounty'];
    const difficulties = ['Easy', 'Medium', 'Hard'];

    const byMode = {};
    modes.forEach(m => { byMode[m] = riddles.filter(r => r.game_mode === m && r.is_active).length; });

    const byDifficulty = {};
    difficulties.forEach(d => { byDifficulty[d] = riddles.filter(r => r.difficulty === d && r.is_active).length; });

    // Low stock alerts: any mode+difficulty combo with < 10 active riddles
    const lowStockAlerts = [];
    modes.forEach(m => {
      difficulties.forEach(d => {
        const count = riddles.filter(r => r.game_mode === m && r.difficulty === d && r.is_active).length;
        if (count < 10) {
          lowStockAlerts.push({ mode: m, difficulty: d, count });
        }
      });
    });

    res.json({
      success: true,
      totalRiddles: riddles.filter(r => r.is_active).length,
      byMode,
      byDifficulty,
      servedToday,
      activeUsers24h,
      lowStockAlerts,
      maintenanceMode
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Riddle pool health — per mode + difficulty breakdown
app.get('/admin/pool-health', checkAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const modes = ['arena', 'daily', 'gauntlet', 'chain', 'wager', 'bounty'];
    const difficulties = ['Easy', 'Medium', 'Hard'];

    const [riddlesRes, locksRes] = await Promise.all([
      supabase.from('riddles').select('id, game_mode, difficulty, is_active, is_onboarding'),
      supabase.from('riddle_daily_locks').select('riddle_id').eq('lock_date', today)
    ]);

    const riddles = riddlesRes.data || [];
    const lockedToday = new Set((locksRes.data || []).map(l => l.riddle_id));

    const grid = {};
    modes.forEach(m => {
      grid[m] = {};
      difficulties.forEach(d => {
        const active = riddles.filter(r => r.game_mode === m && r.difficulty === d && r.is_active);
        const servedToday = active.filter(r => lockedToday.has(r.id)).length;
        const remaining = active.length - servedToday;
        const onboardingCount = active.filter(r => r.is_onboarding).length;
        grid[m][d] = {
          total: active.length,
          servedToday,
          remaining,
          onboardingCount,
          status: remaining < 10 ? 'LOW' : remaining < 25 ? 'WARNING' : 'OK'
        };
      });
    });

    res.json({ success: true, grid });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle maintenance mode
app.post('/admin/maintenance', checkAdmin, async (req, res) => {
  try {
    const { on, message } = req.body;
    await supabase.from('app_settings').upsert({ key: 'maintenance_mode', value: on ? 'true' : 'false' }, { onConflict: 'key' });
    if (message) {
      await supabase.from('app_settings').upsert({ key: 'maintenance_message', value: message }, { onConflict: 'key' });
    }
    console.log(`🔧 Maintenance mode: ${on ? 'ON' : 'OFF'}`);
    res.json({ success: true, maintenanceMode: on });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get riddles — with filtering and pagination
app.get('/admin/riddles', checkAdmin, async (req, res) => {
  try {
    const { mode, difficulty, is_active, is_onboarding, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 50);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase.from('riddles').select('*', { count: 'exact' }).order('created_at', { ascending: false });

    if (mode) query = query.eq('game_mode', mode);
    if (difficulty) query = query.eq('difficulty', difficulty);
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');
    if (is_onboarding !== undefined) query = query.eq('is_onboarding', is_onboarding === 'true');

    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: riddles, error, count } = await query;
    if (error) throw error;
    res.json({ success: true, riddles, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add riddles — single or bulk, with per-riddle validation and report
app.post('/admin/riddle/add', checkAdmin, async (req, res) => {
  try {
    const { riddles } = req.body;
    const riddlesArray = Array.isArray(riddles) ? riddles : [riddles];

    const results = [];
    const toInsert = [];

    for (let i = 0; i < riddlesArray.length; i++) {
      const r = riddlesArray[i];
      if (!r.question || !r.answer || !r.game_mode || !r.difficulty) {
        results.push({ index: i, success: false, error: 'Missing required fields: question, answer, game_mode, difficulty' });
        continue;
      }
      const validModes = ['arena', 'daily', 'gauntlet', 'chain', 'wager', 'bounty'];
      if (!validModes.includes(r.game_mode)) {
        results.push({ index: i, success: false, error: `Invalid game_mode "${r.game_mode}". Must be one of: ${validModes.join(', ')}` });
        continue;
      }
      const validDiffs = ['Easy', 'Medium', 'Hard'];
      if (!validDiffs.includes(r.difficulty)) {
        results.push({ index: i, success: false, error: `Invalid difficulty "${r.difficulty}". Must be Easy, Medium, or Hard` });
        continue;
      }
      toInsert.push({
        index: i,
        data: {
          question: r.question,
          answer: r.answer,
          options: r.options || null,
          category: r.category || 'General',
          difficulty: r.difficulty,
          game_mode: r.game_mode,
          hint: r.hint || null,
          fun_fact: r.fun_fact || null,
          explanation: r.explanation || null,
          family_id: r.family_id || null,
          panic_time: r.panic_time || null,
          is_onboarding: r.is_onboarding === true,
          is_active: true,
          times_served: 0,
        }
      });
    }

    // Insert valid riddles
    if (toInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from('riddles')
        .insert(toInsert.map(r => r.data))
        .select();
      if (error) throw error;
      inserted.forEach((row, idx) => {
        results.push({ index: toInsert[idx].index, success: true, id: row.id, question: row.question });
      });
    }

    results.sort((a, b) => a.index - b.index);
    const added = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`👑 Admin uploaded riddles: ${added} added, ${failed} failed`);
    res.json({ success: true, added, failed, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a riddle
app.put('/admin/riddle/:id', checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const { data, error } = await supabase.from('riddles').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ success: true, riddle: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a riddle — clean up FK-dependent tables first
app.delete('/admin/riddle/:id', checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Remove from dependent tables before deleting the riddle (FK constraints)
    await supabase.from('riddle_daily_locks').delete().eq('riddle_id', id);
    await supabase.from('solved_riddles').delete().eq('riddle_id', id);
    const { error } = await supabase.from('riddles').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: `Deleted riddle ${id}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================
// 🎯 RIDDLE ENDPOINT
// ============================
app.post('/riddle', checkMaintenance, async (req, res) => {
  try {
    const { userId, xp, mode } = req.body;
    const gameMode = mode || 'arena';
    console.log(`\n🎯 Riddle Request | User: ${userId} | XP: ${xp || 0} | Mode: ${gameMode}`);

    const selectedRiddle = await pickRiddle(userId, xp, gameMode);

    if (!selectedRiddle) {
      console.log(`🚨 ALL ARENA RIDDLES EXHAUSTED for ${userId}`);
      return res.json({ success: false, riddlesExhausted: true, error: 'All riddles have been played today! New ones coming soon.' });
    }

    let timeLimit = selectedRiddle.difficulty === 'Easy' ? 30 : selectedRiddle.difficulty === 'Medium' ? 45 : 60;
    if (selectedRiddle.panic_time) timeLimit = selectedRiddle.panic_time;

    console.log(`📘 Served Riddle: ${selectedRiddle.id} (${selectedRiddle.difficulty}) | Answer: "${selectedRiddle.answer}" | Time: ${timeLimit}s`);
    res.json({
      success: true,
      riddle: {
        id: selectedRiddle.id,
        question: selectedRiddle.question,
        options: selectedRiddle.options,
        category: selectedRiddle.category,
        difficulty: selectedRiddle.difficulty,
        hint: selectedRiddle.hint,
        fun_fact: selectedRiddle.fun_fact,
        explanation: selectedRiddle.explanation,
        timeLimit,
        isCurated: true
      }
    });
  } catch (error) {
    console.error('❌ /riddle:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================
// 📝 ANSWER SUBMISSION
// ============================
app.post('/answer', async (req, res) => {
  try {
    const { userId, riddleId, userAnswer, timeTaken, mode } = req.body;
    console.log(`\n📝 Answer | riddleId: ${riddleId} | user: "${userAnswer}" | mode: ${mode}`);

    const { data: riddle, error: riddleErr } = await supabase
      .from('riddles')
      .select('id, answer, difficulty, question')
      .eq('id', riddleId)
      .single();

    if (riddleErr || !riddle) throw new Error('Riddle not found');
    console.log(`📖 Correct answer: "${riddle.answer}"`);

    let isCorrect = false;
    if (mode === 'type') {
      isCorrect = await checkTypedAnswer(userAnswer, riddle.answer, riddle.question || '');
    } else {
      isCorrect = isAnswerCorrect(userAnswer, riddle.answer);
    }
    console.log(`${isCorrect ? '✅ CORRECT' : '❌ WRONG'} | User: "${userAnswer}" | Correct: "${riddle.answer}"`);

    const baseCoins = riddle.difficulty === 'Easy' ? 10 : riddle.difficulty === 'Medium' ? 25 : 50;
    const modeMultiplier = mode === 'type' ? 1.5 : 1;
    let coinsChange = isCorrect ? Math.round(baseCoins * modeMultiplier) : -5;
    const elapsed = parseInt(timeTaken) || 0;
    if (isCorrect && elapsed < 10) coinsChange += 20;
    else if (isCorrect && elapsed < 15) coinsChange += 10;

    let newCoins = 100;
    let newStreak = isCorrect ? 1 : 0;
    let newXp = isCorrect ? (riddle.difficulty === 'Easy' ? 5 : riddle.difficulty === 'Medium' ? 15 : 30) : 2;
    let newLevel = 'Novice';
    let leveledUp = false;
    let streakBonus = false;
    const xpGain = newXp;

    try {
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('id, coins, streak, username, city, xp, level, total_played, total_correct')
        .eq('id', userId)
        .single();

      if (!userErr && user) {
        const currentCoins = parseInt(user.coins) || 0;
        newStreak = isCorrect ? (parseInt(user.streak) || 0) + 1 : 0;
        newXp = (parseInt(user.xp) || 0) + xpGain;
        newLevel = calculateLevel(newXp);
        leveledUp = newLevel !== user.level;

        if (isCorrect && newStreak > 0 && newStreak % 5 === 0) { coinsChange += 100; streakBonus = true; }
        newCoins = Math.max(0, currentCoins + coinsChange);

        await supabase.from('users').update({
          coins: newCoins, streak: newStreak, xp: newXp, level: newLevel,
          total_played: (parseInt(user.total_played) || 0) + 1,
          total_correct: (parseInt(user.total_correct) || 0) + (isCorrect ? 1 : 0)
        }).eq('id', userId);

        await supabase.from('leaderboard').upsert({
          user_id: userId, username: user.username, city: user.city,
          coins: newCoins, updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        console.log(`💰 Coins: ${currentCoins} → ${newCoins} (${coinsChange > 0 ? '+' : ''}${coinsChange})`);
      } else {
        console.log(`⚠️ User not in DB, auto-creating: ${userId}`);
        await supabase.from('users').insert({
          id: userId, username: 'Player', city: 'India', area: 'India',
          coins: Math.max(0, 100 + coinsChange), streak: newStreak,
          level: 'Novice', xp: xpGain, total_played: 1,
          total_correct: isCorrect ? 1 : 0
        });
        newCoins = Math.max(0, 100 + coinsChange);
      }
    } catch (userUpdateErr) {
      console.log('⚠️ User update failed (non-fatal):', userUpdateErr.message);
    }

    try {
      await supabase.from('solved_riddles').insert({ user_id: userId, riddle_id: riddleId, was_correct: isCorrect });
    } catch {}

    res.json({
      success: true,
      isCorrect,
      correctAnswer: riddle.answer,
      coinsChange,
      newTotal: newCoins,
      streakCount: newStreak,
      xpGained: xpGain,
      newXp,
      newLevel,
      leveledUp,
      streakBonus
    });

  } catch (error) {
    console.error('❌ /answer:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================
// 🔐 AUTH ROUTES
// ============================

app.post('/auth/check-username', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.json({ success: false, error: 'Username required' });
    const { data } = await supabase.from('users').select('id').ilike('username', username).maybeSingle();
    res.json({ success: true, available: !data });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/auth/signup', async (req, res) => {
  try {
    const { username, email, password, college } = req.body;
    if (!username || !email || !password) return res.status(400).json({ success: false, error: 'All fields required' });

    const resolvedCollege = college || 'Other';

    const { data: existingUser } = await supabase.from('users').select('id').or(`email.eq.${email},username.ilike.${username}`).maybeSingle();
    if (existingUser) return res.status(400).json({ success: false, error: 'Email or Username already in use' });

    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase.from('users')
      .insert({ username, email, password_hash: passwordHash, is_verified: true, coins: 100, streak: 0, level: 'Novice', xp: 0, total_played: 0, total_correct: 0, city: 'Global', area: 'Arena', is_admin: false, college: resolvedCollege })
      .select('id, username, email, coins, streak, level, xp, is_admin, college').single();

    if (error || !data) throw new Error(error ? error.message : 'Database error: no data returned from signup insert');

    const token = jwt.sign({ id: data.id, username: data.username }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`👤 New User Signed Up: ${data.username} | College: ${resolvedCollege}`);
    res.json({ success: true, user: data, token });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/auth/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, error: 'Email and OTP required' });

    const { data: user } = await supabase.from('users')
      .select('id, verification_token')
      .eq('email', email)
      .maybeSingle();

    if (!user || user.verification_token !== otp) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    const { data, error } = await supabase.from('users')
      .update({ is_verified: true, verification_token: null })
      .eq('id', user.id)
      .select('id, username, email, coins, streak, level, xp, is_admin').single();

    if (error || !data) throw new Error(error ? error.message : 'Database error: verify user not found');

    const token = jwt.sign({ id: data.id, username: data.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, user: data, token });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) return res.status(400).json({ success: false, error: 'All fields required' });

    const { data: user, error } = await supabase.from('users')
      .select('*')
      .or(`email.eq.${loginId},username.eq.${loginId}`)
      .maybeSingle();

    // Block non-admin logins during maintenance
    if (user && !user.is_admin) {
      const { data: maintData } = await supabase.from('app_settings').select('value').eq('key', 'maintenance_mode').single();
      if (maintData?.value === 'true') {
        return res.status(503).json({ success: false, maintenance: true, error: 'CRACKL is under maintenance right now. Check back soon!' });
      }
    }

    if (error || !user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    if (!user.password_hash) return res.status(401).json({ success: false, error: 'Legacy account. Please use Sign Up or reset password.' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ success: false, error: 'Wrong password' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`🔑 User Logged In: ${user.username}`);

    delete user.password_hash;
    delete user.reset_token;
    delete user.verification_token;

    res.json({ success: true, user, token });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/auth/oauth', async (req, res) => {
  try {
    const { provider, token: oauthToken } = req.body;
    if (!provider || !oauthToken) return res.status(400).json({ success: false, error: 'Missing provider or token' });

    let email, name;
    const decoded = jwt.decode(oauthToken);
    
    if (decoded && decoded.email) {
      email = decoded.email;
      name = decoded.name || email.split('@')[0];
    } else {
      // If it's an Access Token instead of an ID Token, jwt.decode will fail.
      // We must securely fetch the user's profile from Google API instead!
      try {
        const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${oauthToken}` }
        });
        const gData = await gRes.json();
        if (!gData.email) throw new Error('No email in Google response');
        email = gData.email;
        name = gData.name || gData.given_name || email.split('@')[0];
      } catch (err) {
        return res.status(400).json({ success: false, error: 'Invalid OAuth token received' });
      }
    }

    let { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();

    if (!user) {
      const { data: newUser, error: insertErr } = await supabase.from('users')
        .insert({
          username: name + Math.floor(Math.random() * 9999),
          email, is_verified: true,
          coins: 100, streak: 0, level: 'Novice', xp: 0, total_played: 0, total_correct: 0,
          city: 'Global', area: 'Arena', is_admin: false
        })
        .select('*').single();
      if (insertErr) throw insertErr;
      user = newUser;
      console.log(`👤 New OAuth User: ${user.username} (${provider})`);
    } else {
      console.log(`🔑 OAuth Login: ${user.username} (${provider})`);
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    delete user.password_hash;
    delete user.reset_token;
    delete user.verification_token;

    res.json({ success: true, user, token });
  } catch (error) {
    console.error('❌ /auth/oauth:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });

    const { data: user } = await supabase.from('users').select('id, username').eq('email', email).maybeSingle();
    if (!user) return res.json({ success: true, message: 'If that email exists, an OTP was sent.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpires = new Date(Date.now() + 3600000).toISOString();

    await supabase.from('users').update({ reset_token: otp, reset_token_expires: tokenExpires }).eq('id', user.id);
    console.log(`📧 Password Reset OTP for ${email}: ${otp}`);

    try {
      if (transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail({
          from: '"CRACKL Arena" <' + process.env.EMAIL_USER + '>',
          to: email,
          subject: 'CRACKL Password Reset OTP',
          text: `Your 6-digit verification code is: ${otp}\n\nEnter this in the app to reset your password.`
        });
      }
    } catch (err) {
      console.error('Email send failed:', err);
    }

    res.json({ success: true, message: 'If that email exists, an OTP was sent.' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ success: false, error: 'Email, OTP, and new password required' });

    const { data: user } = await supabase.from('users')
      .select('id, reset_token_expires')
      .eq('email', email)
      .eq('reset_token', otp)
      .maybeSingle();

    if (!user || new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP code' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await supabase.from('users').update({ password_hash: passwordHash, reset_token: null, reset_token_expires: null }).eq('id', user.id);

    res.json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 👤 USER ROUTES
// ============================

app.post('/user/create', async (req, res) => {
  try {
    const { id, username, city, area } = req.body;
    const { data, error } = await supabase.from('users')
      .upsert({ id, username, city, area, coins: 100, streak: 0, level: 'Novice', xp: 0, total_played: 0, total_correct: 0 }, { onConflict: 'id', ignoreDuplicates: true })
      .select().single();
    if (error) throw error;
    res.json({ success: true, user: data });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/user/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    delete data.password_hash;
    delete data.reset_token;
    res.json({ success: true, user: data });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/leaderboard/:city', async (req, res) => {
  try {
    const { data } = await supabase.from('leaderboard').select('username, coins, city').eq('city', req.params.city).order('coins', { ascending: false }).limit(20);
    res.json({ success: true, leaderboard: data || [] });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/leaderboard/global/top', async (req, res) => {
  try {
    const { data } = await supabase.from('leaderboard').select('username, coins, city').order('coins', { ascending: false }).limit(20);
    res.json({ success: true, leaderboard: data || [] });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 🎮 MULTIPLAYER ROOMS
// ============================

app.post('/room/create', async (req, res) => {
  try {
    const { hostId, hostName, mode, timed, timeLimit, maxPlayers } = req.body;
    const roomId = makeRoomId();
    await supabase.from('multiplayer_rooms').insert({ id: roomId, host_id: hostId, host_name: hostName, status: 'waiting', mode: mode || 'mcq', timed: timed !== false, time_limit: timeLimit || 30, max_players: maxPlayers || 4 });
    await supabase.from('room_players').insert({ room_id: roomId, user_id: hostId, username: hostName });
    res.json({ success: true, roomId });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/room/join', async (req, res) => {
  try {
    const { roomId, userId, username } = req.body;
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (!room) return res.json({ success: false, error: 'Room not found' });
    if (room.status !== 'waiting') return res.json({ success: false, error: 'Game already started' });
    const { data: players } = await supabase.from('room_players').select('*').eq('room_id', roomId);
    if (players.length >= room.max_players) return res.json({ success: false, error: 'Room is full' });
    await supabase.from('room_players').insert({ room_id: roomId, user_id: userId, username });
    res.json({ success: true, room, players: [...players, { user_id: userId, username }] });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/room/:roomId', async (req, res) => {
  try {
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', req.params.roomId).single();
    const { data: players } = await supabase.from('room_players').select('*').eq('room_id', req.params.roomId);
    res.json({ success: true, room, players: players || [] });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/room/start', checkMaintenance, async (req, res) => {
  try {
    const { roomId, hostId, xp } = req.body;
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (room.host_id !== hostId) return res.json({ success: false, error: 'Only host can start' });

    const riddle = await pickRiddle(hostId, xp || 0, 'arena');
    if (!riddle) return res.json({ success: false, error: 'No riddles available right now. Admin needs to add more.' });

    await supabase.from('multiplayer_rooms').update({ status: 'playing', current_riddle_id: riddle.id }).eq('id', roomId);
    await supabase.from('room_players').update({ answered: false, answer: null, is_correct: null, coins_earned: 0 }).eq('room_id', roomId);

    let timeLimit = riddle.difficulty === 'Easy' ? 30 : riddle.difficulty === 'Medium' ? 45 : 60;
    if (riddle.panic_time) timeLimit = riddle.panic_time;

    res.json({ success: true, riddle: { id: riddle.id, question: riddle.question, options: riddle.options, category: riddle.category, difficulty: riddle.difficulty, hint: riddle.hint, fun_fact: riddle.fun_fact, explanation: riddle.explanation, timeLimit: room.timed ? room.time_limit : timeLimit } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/room/answer', async (req, res) => {
  try {
    const { roomId, userId, userAnswer, timeTaken } = req.body;
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    const { data: riddle } = await supabase.from('riddles').select('id, answer, difficulty, question').eq('id', room.current_riddle_id).single();
    const isCorrect = isAnswerCorrect(userAnswer, riddle.answer);
    const coinsEarned = isCorrect ? (riddle.difficulty === 'Easy' ? 10 : riddle.difficulty === 'Medium' ? 25 : 50) : 0;
    await supabase.from('room_players').update({ answered: true, answer: userAnswer, is_correct: isCorrect, coins_earned: coinsEarned }).eq('room_id', roomId).eq('user_id', userId);
    if (isCorrect) {
      try {
        const { data: u2 } = await supabase.from('users').select('coins').eq('id', userId).single();
        if (u2) await supabase.from('users').update({ coins: (u2.coins || 0) + coinsEarned }).eq('id', userId);
      } catch {}
    }
    const { data: players } = await supabase.from('room_players').select('*').eq('room_id', roomId);
    res.json({ success: true, isCorrect, correctAnswer: riddle.answer, coinsEarned, allAnswered: players.every(p => p.answered), players });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/room/giveup', async (req, res) => {
  try {
    const { roomId, hostId } = req.body;
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (room.host_id !== hostId) return res.json({ success: false, error: 'Only host can give up' });
    const { data: riddle } = await supabase.from('riddles').select('answer').eq('id', room.current_riddle_id).single();
    await supabase.from('multiplayer_rooms').update({ status: 'revealed' }).eq('id', roomId);
    res.json({ success: true, correctAnswer: riddle.answer });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/room/next', checkMaintenance, async (req, res) => {
  try {
    const { roomId, hostId, xp } = req.body;
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (room.host_id !== hostId) return res.json({ success: false, error: 'Only host can continue' });

    const riddle = await pickRiddle(hostId, xp || 0, 'arena');
    if (!riddle) return res.json({ success: false, error: 'No riddles available right now.' });

    await supabase.from('multiplayer_rooms').update({ status: 'playing', current_riddle_id: riddle.id }).eq('id', roomId);
    await supabase.from('room_players').update({ answered: false, answer: null, is_correct: null, coins_earned: 0 }).eq('room_id', roomId);

    let timeLimit = riddle.difficulty === 'Easy' ? 30 : riddle.difficulty === 'Medium' ? 45 : 60;
    if (riddle.panic_time) timeLimit = riddle.panic_time;

    res.json({ success: true, riddle: { id: riddle.id, question: riddle.question, options: riddle.options, category: riddle.category, difficulty: riddle.difficulty, hint: riddle.hint, fun_fact: riddle.fun_fact, explanation: riddle.explanation, timeLimit: room.timed ? room.time_limit : timeLimit } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 💰 CASHBACK
// ============================
app.post('/cashback', async (req, res) => {
  try {
    const { userId, coinsToRedeem, upiId } = req.body;
    const tiers = [{ coins: 500, inr: 40 }, { coins: 1500, inr: 160 }, { coins: 5000, inr: 800 }, { coins: 15000, inr: 2800 }];
    const tier = tiers.find(t => t.coins === coinsToRedeem);
    if (!tier) return res.json({ success: false, error: 'Invalid tier' });
    const { data: user } = await supabase.from('users').select('coins').eq('id', userId).single();
    const coinsNum = parseInt(coinsToRedeem) || 0;
    if (!user || (user.coins || 0) < coinsNum) return res.json({ success: false, error: 'Not enough coins' });
    
    // Concurrent optimistic lock
    const { data: updated, error: updateErr } = await supabase.from('users')
      .update({ coins: user.coins - coinsToRedeem })
      .eq('id', userId)
      .eq('coins', user.coins)
      .select('coins').single();
      
    if (updateErr || !updated) return res.json({ success: false, error: 'Request conflict. Please try again.' });
    
    await supabase.from('cashback_requests').insert({ user_id: userId, coins_spent: coinsToRedeem, amount_inr: tier.inr, upi_id: upiId, status: 'pending' });
    res.json({ success: true, message: `₹${tier.inr} cashback requested! Sending to ${upiId} within 7 days.` });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 📊 STATS
// ============================
app.get('/stats/:userId', async (req, res) => {
  try {
    const { data: solved } = await supabase.from('solved_riddles').select('was_correct').eq('user_id', req.params.userId);
    const total = solved?.length || 0;
    const correct = solved?.filter(s => s.was_correct).length || 0;
    res.json({ success: true, total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 🌅 DAILY DROP
// ============================
app.post('/daily-riddle', checkMaintenance, async (req, res) => {
  try {
    const { userId, xp } = req.body;
    const today = new Date().toISOString().split('T')[0];

    const { data: user } = await supabase.from('users').select('last_daily_date, daily_streak').eq('id', userId).maybeSingle();

    if (user && user.last_daily_date === today) {
      return res.json({ success: false, alreadyPlayed: true, message: 'Come back tomorrow for your next Daily Drop!' });
    }

    const riddle = await pickRiddle(userId, xp || 0, 'daily', 'Hard');
    if (!riddle) {
      return res.json({ success: false, error: 'No Daily riddles available today. Admin needs to add more Hard daily riddles.' });
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newDailyStreak = (user && user.last_daily_date === yesterday) ? (user.daily_streak || 0) + 1 : 1;
    await supabase.from('users').update({ last_daily_date: today, daily_streak: newDailyStreak }).eq('id', userId);

    let timeLimit = riddle.panic_time || 60;
    console.log(`🌅 Daily Drop | ${userId} | Streak: ${newDailyStreak}`);
    res.json({
      success: true,
      riddle: { id: riddle.id, question: riddle.question, options: riddle.options, category: riddle.category, difficulty: riddle.difficulty, hint: riddle.hint, fun_fact: riddle.fun_fact, explanation: riddle.explanation, timeLimit },
      dailyStreak: newDailyStreak
    });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 🔗 THE CHAIN (TREASURE HUNT)
// ============================
app.post('/chain/start', checkMaintenance, async (req, res) => {
  try {
    const { userId, xp } = req.body;
    const chainId = 'chain_' + Date.now();
    const riddles = [];
    const userXp = parseInt(xp) || 0;

    // Pick 5 distinct chain riddles with increasing difficulty pressure
    const diffSequence = ['Easy', 'Easy', 'Medium', 'Medium', 'Hard'];
    for (let i = 0; i < 5; i++) {
      const riddle = await pickRiddle(userId, userXp + (i * 100), 'chain', diffSequence[i]);
      if (!riddle) {
        return res.json({ success: false, error: `Not enough chain riddles available (got ${i}/5). Admin needs to add more Chain riddles.` });
      }
      riddles.push(riddle);
    }

    await supabase.from('chain_progress').upsert({ user_id: userId, chain_id: chainId, step: 0, completed: false }, { onConflict: 'user_id,chain_id' });

    console.log(`🔗 Chain Started | ${userId} | ${chainId}`);
    res.json({
      success: true,
      chainId,
      totalSteps: 5,
      currentStep: 0,
      riddle: { id: riddles[0].id, question: riddles[0].question, options: riddles[0].options, category: riddles[0].category, difficulty: riddles[0].difficulty, hint: riddles[0].hint },
      chainRiddleIds: riddles.map(r => r.id)
    });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/chain/answer', async (req, res) => {
  try {
    const { userId, chainId, step, riddleId, userAnswer } = req.body;
    const { data: riddle } = await supabase.from('riddles').select('answer, difficulty').eq('id', riddleId).single();
    const isCorrect = isAnswerCorrect(userAnswer, riddle.answer);

    if (!isCorrect) return res.json({ success: true, isCorrect: false, correctAnswer: riddle.answer, message: 'Chain broken! Try again.' });

    const nextStep = step + 1;
    const completed = nextStep >= 5;
    const coinsEarned = completed ? 250 : 25;

    await supabase.from('chain_progress').update({ step: nextStep, completed }).eq('user_id', userId).eq('chain_id', chainId);
    try {
      const { data: u2 } = await supabase.from('users').select('coins, xp').eq('id', userId).single();
      if (u2) await supabase.from('users').update({ coins: (u2.coins || 0) + coinsEarned, xp: (u2.xp || 0) + (completed ? 50 : 10) }).eq('id', userId);
    } catch {}

    res.json({ success: true, isCorrect: true, correctAnswer: riddle.answer, nextStep, completed, coinsEarned });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 🎰 BLIND WAGER
// ============================
app.post('/wager/settle', checkMaintenance, async (req, res) => {
  try {
    const { userId, wageredCoins, isCorrect } = req.body;
    if (!userId || wageredCoins == null) return res.status(400).json({ success: false, error: 'Missing fields' });

    const wager = Math.abs(parseInt(wageredCoins) || 0);
    if (wager <= 0) return res.status(400).json({ success: false, error: 'Invalid wager amount' });

    const { data: user } = await supabase.from('users').select('coins').eq('id', userId).single();
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (!isCorrect && (user.coins || 0) < wager) return res.json({ success: false, error: 'Not enough coins to cover the wager' });

    const delta = isCorrect ? wager : -wager;
    const newCoins = Math.max(0, (user.coins || 0) + delta);
    await supabase.from('users').update({ coins: newCoins }).eq('id', userId);

    console.log(`🎰 Wager | ${userId} | ${isCorrect ? 'WIN' : 'LOSE'} | ${delta > 0 ? '+' : ''}${delta} coins`);
    res.json({ success: true, delta, newTotal: newCoins });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 🔮 ORACLE LIFELINE
// ============================
app.post('/lifeline/oracle', async (req, res) => {
  try {
    const { userId, riddleId, riddleQuestion } = req.body;
    const { data: riddle } = await supabase.from('riddles').select('answer, hint').eq('id', riddleId).single();
    if (!riddle) return res.status(404).json({ success: false, error: 'Riddle not found' });

    const { data: user } = await supabase.from('users').select('coins').eq('id', userId).single();
    if (!user || user.coins < 150) return res.json({ success: false, error: 'Not enough coins! Oracle costs 150 coins.' });
    
    // Concurrent optimistic lock
    const { data: updated, error: updateErr } = await supabase.from('users')
      .update({ coins: user.coins - 150 })
      .eq('id', userId)
      .eq('coins', user.coins)
      .select('coins').single();
      
    if (updateErr || !updated) return res.json({ success: false, error: 'Transaction overlap. Please try again.' });

    const prompt = `You are The Oracle — a mysterious AI entity in a riddle game.
Riddle: "${riddleQuestion}"
The correct answer is: "${riddle.answer}"

Generate ONE cryptic, poetic, mysterious hint. DO NOT reveal the answer directly.
Be like a prophecy — metaphorical, mystical. Max 2 sentences. Make it feel powerful and rare.`;

    const result = await geminiModel.generateContent(prompt);
    const oracleHint = result.response.text().trim();

    console.log(`🔮 Oracle | ${userId} | ${riddleId}`);
    res.json({ success: true, oracleHint, newTotal: updated.coins });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 🕐 TIME FREEZE LIFELINE
// ============================
app.post('/lifeline/time-freeze', async (req, res) => {
  try {
    const { userId } = req.body;
    const { data: user } = await supabase.from('users').select('coins').eq('id', userId).single();
    if (!user || user.coins < 100) return res.json({ success: false, error: 'Need 100 coins for Time Freeze!' });
    
    // Concurrent optimistic lock
    const { data: updated, error: updateErr } = await supabase.from('users')
      .update({ coins: user.coins - 100 })
      .eq('id', userId)
      .eq('coins', user.coins)
      .select('coins').single();
      
    if (updateErr || !updated) return res.json({ success: false, error: 'Transaction overlap. Please try again.' });

    console.log(`🕐 Time Freeze | ${userId}`);
    res.json({ success: true, frozenSeconds: 10, newTotal: updated.coins });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 🏆 BOUNTY BOARD
// ============================
app.get('/bounty/current', checkMaintenance, async (req, res) => {
  try {
    const { data: bounty } = await supabase
      .from('bounty_board')
      .select('*')
      .eq('active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!bounty) {
      return res.json({ success: false, noBounty: true, error: 'No active bounty right now. Admin needs to add a bounty riddle.' });
    }

    res.json({ success: true, bounty: { id: bounty.id, question: bounty.question, prize_coins: bounty.prize_coins, solved_by: bounty.solved_by, solved_at: bounty.solved_at, expires_at: bounty.expires_at } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/bounty/attempt', async (req, res) => {
  try {
    const { userId, bountyId, userAnswer, username } = req.body;
    const { data: bounty } = await supabase.from('bounty_board').select('*').eq('id', bountyId).single();
    if (!bounty || bounty.solved_by) return res.json({ success: false, error: bounty?.solved_by ? `Already solved by ${bounty.solved_by}!` : 'Bounty not found' });

    const isCorrect = isAnswerCorrect(userAnswer, bounty.answer);

    if (!isCorrect) return res.json({ success: true, isCorrect: false, message: 'Incorrect! Keep trying...' });

    // Atomically lock the bounty logic
    const { data: claimed, error: clErr } = await supabase.from('bounty_board')
      .update({ solved_by: username, solved_at: new Date().toISOString(), active: false })
      .eq('id', bountyId)
      .eq('active', true)
      .select().single();
      
    if (!claimed || clErr) return res.json({ success: false, error: 'Very close! The bounty was literally just solved by someone else!' });

    const { data: user } = await supabase.from('users').select('coins').eq('id', userId).single();
    if (user) await supabase.from('users').update({ coins: (user.coins || 0) + bounty.prize_coins }).eq('id', userId);

    console.log(`🏆 BOUNTY SOLVED! ${username} wins ${bounty.prize_coins} coins!`);
    res.json({ success: true, isCorrect: true, prize: bounty.prize_coins, message: `🎉 LEGENDARY! You cracked the Bounty and won ${bounty.prize_coins} coins!` });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 🧠 BRAIN PROFILE REPORT
// ============================
app.get('/profile/brain-report/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: solved } = await supabase.from('solved_riddles').select('was_correct, riddle_id').eq('user_id', userId).gte('created_at', weekAgo);
    const { data: user } = await supabase.from('users').select('username, xp, streak, level').eq('id', userId).single();

    const total = solved?.length || 0;
    const correct = solved?.filter(s => s.was_correct).length || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const prompt = `You are a world-class cognitive analyst for CRACKL riddle arena.
Player: ${user?.username || 'Unknown'} | Level: ${user?.level} | XP: ${user?.xp} | Streak: ${user?.streak} days
This week: ${total} riddles attempted, ${correct} correct (${accuracy}% accuracy)

Write a personalized 3-sentence cognitive "Brain Report Card". Be like a genius mentor — insightful, motivating, specific.
Tell them their cognitive strengths, one weakness to work on, and a bold prediction for their future. NO markdown.`;
    const result = await geminiModel.generateContent(prompt);
    const narrative = result.response.text().trim();

    res.json({ success: true, report: { total, correct, accuracy, narrative, weekStreak: user?.streak || 0, level: user?.level } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 🚀 START SERVER
// ============================
const server = app.listen(process.env.PORT || 3000, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  CRACKL Backend ⚡ RUNNING');
  console.log('  ✅ AI riddle generation: REMOVED');
  console.log('  ✅ Admin-curated riddles only');
  console.log('  ✅ Daily anti-collision lock: ACTIVE');
  console.log('  ✅ Family variant blocking: ACTIVE');
  console.log('  ✅ Maintenance mode: READY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('\n⚠️  PORT 3000 IS ALREADY IN USE!');
    console.log('👉 Backend is already running. Just start your frontend!\n');
  } else {
    console.error(e);
  }
});
