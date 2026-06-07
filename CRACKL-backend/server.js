const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const {
  checkTypedAnswer,
  checkTypedAnswerDetailed,
  model: geminiModel,
  ANSWER_CHECK_MODEL,
  ANSWER_CHECK_PROVIDER,
  cleanAnswerText
} = require('./gemini');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Multer — in-memory storage for admin media uploads (forwarded to Supabase Storage)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'https://crackl.app'];
const isLocalWebOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
app.use(cors({ origin: (origin, callback) => {
  const isDevNullOrigin = process.env.NODE_ENV !== 'production' && origin === 'null';
  if (!origin || isDevNullOrigin || allowedOrigins.includes(origin) || isLocalWebOrigin(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Blocked by CORS'));
  }
}}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(express.json({ limit: '2mb' }));

// Route-specific rate limits. Keep gameplay responsive, but cap abuse-heavy surfaces.
const gameActionLimiter = rateLimit({ windowMs: 60 * 1000, max: 90, message: { success: false, error: 'Too many game actions. Slow down and try again.' } });
const economyLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, message: { success: false, error: 'Too many economy actions. Try again in a moment.' } });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { success: false, error: 'Too many admin requests. Try again shortly.' } });

['/answer', '/riddle', '/api/riddles', '/daily-riddle', '/chain', '/room', '/bounty', '/challenge'].forEach((pathPrefix) => {
  app.use(pathPrefix, gameActionLimiter);
});
['/wager', '/lifeline', '/cashback'].forEach((pathPrefix) => {
  app.use(pathPrefix, economyLimiter);
});
app.use('/admin', adminLimiter);

// Rate limiting — auth routes get strict limits to prevent brute force
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { success: false, error: 'Too many attempts. Try again in 15 minutes.' } });
app.use('/auth/', authLimiter);

// Serve standalone admin website at /admin-ui
app.use('/admin-ui', express.static(path.join(__dirname, 'admin')));

if (!process.env.SUPABASE_URL) throw new Error('FATAL: SUPABASE_URL environment variable is missing.');
const supabaseServerKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!supabaseServerKey) throw new Error('FATAL: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY environment variable is missing.');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const warning = 'SUPABASE_SERVICE_ROLE_KEY is missing. Backend economy/stat writes may fall back to non-atomic anon-key updates.';
  if (process.env.NODE_ENV === 'production') throw new Error(`FATAL: ${warning}`);
  console.warn(`⚠️ ${warning}`);
}
const supabase = createClient(process.env.SUPABASE_URL, supabaseServerKey);
if (!process.env.JWT_SECRET) throw new Error('FATAL: JWT_SECRET environment variable is missing.');
const JWT_SECRET = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (JWT_SECRET.length < 32 || JWT_SECRET === 'crackljwtsecret1234567890')) {
  throw new Error('FATAL: JWT_SECRET must be a strong production secret.');
}
const DEFAULT_DEV_ADMIN_SECRET = 'crackl-admin-2026';
const ADMIN_SECRET = process.env.ADMIN_SECRET || (process.env.NODE_ENV === 'production' ? null : DEFAULT_DEV_ADMIN_SECRET);
if (process.env.NODE_ENV === 'production' && !ADMIN_SECRET) throw new Error('FATAL: ADMIN_SECRET environment variable is missing.');
const MIN_WAGER_INTEL = 10;
const AUTH_TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '30d';
const ADMIN_AUDIT_REDACT_KEYS = new Set(['password', 'password_hash', 'newPassword', 'token', 'otp', 'secret', 'x-admin-secret', 'answer']);
const ADMIN_OPERATOR_ROLES = ['owner', 'editor', 'support', 'auditor'];
const ADMIN_MUTATION_ROLES = ['owner', 'editor'];
const ADMIN_SUPPORT_ROLES = ['owner', 'editor', 'support'];
const VALID_REVIEW_STATUSES = ['draft', 'review', 'approved', 'archived'];
const VALID_REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'];
const VALID_SUPPORT_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const VALID_SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const LEGAL_POLICY_VERSION = '2026-05-29';

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'crackl-backend',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  const startedAt = Date.now();
  try {
    const { error } = await supabase
      .from('app_settings')
      .select('key', { count: 'exact', head: true })
      .limit(1);
    if (error) throw error;
    res.json({
      success: true,
      status: 'ready',
      database: 'ok',
      databasePingMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'not_ready',
      database: 'issue',
      databasePingMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      error: 'Database readiness check failed.'
    });
  }
});

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
function optionIndexFromAnswerKey(value, options = []) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!key || !Array.isArray(options) || options.length === 0) return -1;
  if (/^[a-z]$/.test(key)) {
    const index = key.charCodeAt(0) - 97;
    return index >= 0 && index < options.length ? index : -1;
  }
  if (/^[1-9]\d*$/.test(key)) {
    const index = parseInt(key, 10) - 1;
    return index >= 0 && index < options.length ? index : -1;
  }
  return -1;
}

function isAnswerCorrect(userAnswer, correctAnswer, options = []) {
  const u = (userAnswer || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const c = (correctAnswer || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!u || u === '__timeout__') return false;
  if (u === c) return true;
  // Strip punctuation and compare again
  const uClean = u.replace(/[^a-z0-9 ]/g, '');
  const cClean = c.replace(/[^a-z0-9 ]/g, '');
  if (!uClean || !cClean) return false;
  if (uClean === cClean) return true;

  const correctOptionIndex = optionIndexFromAnswerKey(cClean, options);
  if (correctOptionIndex >= 0) {
    const correctOption = options[correctOptionIndex];
    const normalizedCorrectOption = String(correctOption || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const cleanCorrectOption = normalizedCorrectOption.replace(/[^a-z0-9 ]/g, '');
    const userOptionIndex = optionIndexFromAnswerKey(uClean, options);
    return userOptionIndex === correctOptionIndex || (!!cleanCorrectOption && cleanCorrectOption === uClean);
  }

  const userOptionIndex = optionIndexFromAnswerKey(uClean, options);
  if (userOptionIndex >= 0) {
    const selectedOption = options[userOptionIndex];
    const cleanSelectedOption = String(selectedOption || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');
    if (cleanSelectedOption && cleanSelectedOption === cClean) return true;
  }

  // Allow user answer to be a meaningful substring of correct answer (e.g. "einstein" ⊂ "albert einstein")
  // Require at least 3 chars to avoid single-letter false positives
  if (uClean.length >= 3 && cClean.includes(uClean)) return true;
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

function getRankTier(rating) {
  if (rating < 900) return 'Unranked';
  if (rating < 1100) return 'Bronze';
  if (rating < 1300) return 'Silver';
  if (rating < 1500) return 'Gold';
  if (rating < 1700) return 'Platinum';
  if (rating < 1900) return 'Diamond';
  return 'Master';
}

function getRankedDifficulty(rating) {
  if (rating < 1100) return 'Easy';
  if (rating < 1500) return 'Medium';
  return 'Hard';
}

function getDifficultyTier(xp) {
  if (xp < 100) return 1;
  if (xp < 500) return 2;
  if (xp < 1500) return 3;
  if (xp < 4000) return 4;
  return 5;
}

function buildTierSearchOrder(tier) {
  const requested = Math.max(1, Math.min(5, parseInt(tier, 10) || 1));
  return [1, 2, 3, 4, 5].sort((a, b) => {
    const distance = Math.abs(a - requested) - Math.abs(b - requested);
    return distance || a - b;
  });
}

function getRankedDifficultyTier(rating) {
  if (rating < 1100) return 2;
  if (rating < 1500) return 3;
  if (rating < 1900) return 4;
  return 5;
}

function getDifficultyLabelForTier(tier) {
  if (tier <= 2) return 'Easy';
  if (tier === 3) return 'Medium';
  return 'Hard';
}

function getDifficultyTierFromLegacyDifficulty(difficulty) {
  if (difficulty === 'Hard') return 5;
  if (difficulty === 'Medium') return 3;
  return 1;
}

function getRewardDifficultyLabel(riddle) {
  return riddle?.difficulty || getDifficultyLabelForTier(
    parseInt(riddle?.difficulty_tier, 10) || getDifficultyTierFromLegacyDifficulty(riddle?.difficulty)
  );
}

function getRankDelta({ isCorrect, difficulty, timeTaken }) {
  const diff = difficulty || 'Medium';
  const elapsed = parseInt(timeTaken, 10) || 0;
  const baseWin = diff === 'Easy' ? 18 : diff === 'Medium' ? 24 : 32;
  const baseLoss = diff === 'Easy' ? -12 : diff === 'Medium' ? -16 : -22;
  if (!isCorrect) return baseLoss;
  if (elapsed <= 5) return baseWin + 8;
  if (elapsed <= 10) return baseWin + 5;
  if (elapsed <= 15) return baseWin + 2;
  return baseWin;
}

function makeRoomId() {
  return crypto.randomBytes(4).toString('base64url').replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase();
}

function normalizeRoomCode(value) {
  return String(value || '').trim().replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase();
}

async function makeUniqueRoomId() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomId = makeRoomId();
    if (roomId.length < 6) continue;
    const { data } = await supabase
      .from('multiplayer_rooms')
      .select('id')
      .eq('id', roomId)
      .maybeSingle();
    if (!data) return roomId;
  }
  throw new Error('Could not allocate a unique room code. Try again.');
}

async function getAdminPanicTimerSeconds() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'panic_timer_seconds')
    .single();
  return parsePositiveSeconds(data?.value) || 30;
}

function parsePositiveSeconds(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function resolveRiddlePanicTimerSeconds(riddle = null) {
  return parsePositiveSeconds(riddle?.panic_time) || await getAdminPanicTimerSeconds();
}

function getPanicIntelBonus({ gameMode = 'arena', rewardBasis = 0, wager = 0, bountyPrize = 0, completed = false }) {
  switch (gameMode) {
    case 'chain':
      return completed ? 75 : 15;
    case 'wager':
      return Math.max(15, Math.round((wager || 0) * 0.25));
    case 'bounty':
      return Math.max(25, Math.round((bountyPrize || 0) * 0.10));
    case 'multiplayer':
      return Math.max(10, Math.round((rewardBasis || 0) * 0.5));
    default:
      return Math.max(10, Math.round((rewardBasis || 0) * 0.5));
  }
}

function signModeToken(purpose, payload, expiresIn = '45m') {
  return jwt.sign({ purpose, ...payload }, JWT_SECRET, { expiresIn });
}

function verifyModeToken(token, purpose) {
  if (!token) {
    const error = new Error('Missing secure mode token.');
    error.statusCode = 400;
    throw error;
  }
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.purpose !== purpose) {
    const error = new Error('Invalid secure mode token.');
    error.statusCode = 403;
    throw error;
  }
  return decoded;
}

function secondsSince(timestampMs) {
  const startedAt = parseInt(timestampMs, 10);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return 0;
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function issueChainToken({ userId, chainId, queueIds, step, panicMode, limitSeconds }) {
  return signModeToken('chain_run', {
    userId,
    chainId,
    queueIds,
    step,
    panicMode: !!panicMode,
    limitSeconds: limitSeconds || null,
    stepStartedAt: Date.now()
  }, '2h');
}

function issueWagerToken({ userId, riddleId, wager, panicMode, limitSeconds }) {
  return signModeToken('solo_wager', {
    userId,
    riddleId,
    wager,
    panicMode: !!panicMode,
    limitSeconds: limitSeconds || null,
    startedAt: Date.now(),
    nonce: crypto.randomUUID()
  }, '45m');
}

function issueBountyToken({ userId, bountyId, panicMode, limitSeconds }) {
  return signModeToken('bounty_run', {
    userId,
    bountyId,
    panicMode: !!panicMode,
    limitSeconds: limitSeconds || null,
    startedAt: Date.now()
  }, '45m');
}

function makeChallengeId() {
  return crypto.randomBytes(9).toString('base64url');
}

function normalizeChallengeSeconds(value) {
  const seconds = parseInt(value, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return 1;
  return Math.min(seconds, 24 * 60 * 60);
}

function normalizeDefenderSeconds(value) {
  const seconds = parseInt(value, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return Number.MAX_SAFE_INTEGER;
  return Math.min(seconds, 24 * 60 * 60);
}

const roomRuntimeState = new Map();

function getRoomRuntime(roomId) {
  if (!roomRuntimeState.has(roomId)) {
    roomRuntimeState.set(roomId, {
      wagerAmount: 0,
      escrow: new Map(),
      currentRiddle: null,
      currentTimeLimit: null,
      roundStartedAt: null,
      roundSummary: null,
      showdownComplete: false,
      queueSnapshot: [],
      queuePosition: 0,
      queueSize: 0
    });
  }
  return roomRuntimeState.get(roomId);
}

function clearRoomRuntimeRound(roomId, { preserveQueue = false } = {}) {
  const runtime = getRoomRuntime(roomId);
  runtime.escrow.clear();
  runtime.currentRiddle = null;
  runtime.currentTimeLimit = null;
  runtime.roundStartedAt = null;
  runtime.roundSummary = null;
  runtime.showdownComplete = false;
  if (!preserveQueue) {
    runtime.queueSnapshot = [];
  }
  runtime.queuePosition = 0;
  runtime.queueSize = 0;
  return runtime;
}

function getStoredRoomWager(room) {
  return Math.max(0, parseInt(room?.wager_amount ?? room?.wagerAmount, 10) || 0);
}

function resolveRoomWagerAmount(roomId, room) {
  const runtime = getRoomRuntime(roomId);
  const storedWager = getStoredRoomWager(room);
  if (runtime.wagerAmount <= 0 && storedWager > 0) {
    runtime.wagerAmount = storedWager;
  }
  return room?.engagement === 'versus' && room?.mode === 'wager'
    ? Math.max(0, runtime.wagerAmount || storedWager || 0)
    : 0;
}

async function persistRoomWagerAmount(roomId, wagerAmount) {
  if (!roomId) return;
  // Some environments already have this column, older ones do not. Runtime state
  // remains canonical either way; this makes active wager rooms recoverable when supported.
  await supabase
    .from('multiplayer_rooms')
    .update({ wager_amount: Math.max(0, parseInt(wagerAmount, 10) || 0) })
    .eq('id', roomId)
    .then(({ error }) => {
      if (error && !/wager_amount|column/i.test(error.message || '')) {
        console.warn('⚠️ room wager persistence skipped:', error.message);
      }
    })
    .catch(() => {});
}

function normalizeRiddleRecord(riddle, fallbackMode = 'arena') {
  if (!riddle) return null;
  const difficultyTierRaw = parseInt(riddle.difficulty_tier ?? riddle.tier, 10);
  const difficultyTier = Number.isFinite(difficultyTierRaw) && difficultyTierRaw > 0
    ? difficultyTierRaw
    : getDifficultyTierFromLegacyDifficulty(riddle.difficulty);
  return {
    ...riddle,
    difficulty_tier: difficultyTier,
    difficulty: riddle.difficulty || getDifficultyLabelForTier(difficultyTier),
    game_mode: riddle.game_mode || fallbackMode,
    region: riddle.region || 'IN'
  };
}

function serializeRiddlePayload(riddle, timeLimit = null) {
  const normalized = normalizeRiddleRecord(riddle);
  if (!normalized) return null;
  return {
    id: normalized.id,
    question: normalized.question,
    options: normalized.options,
    category: normalized.category,
    difficulty: normalized.difficulty,
    difficulty_tier: normalized.difficulty_tier,
    game_mode: normalized.game_mode,
    region: normalized.region,
    hint: normalized.hint,
    fun_fact: normalized.fun_fact,
    timeLimit,
    panic_time: parsePositiveSeconds(normalized.panic_time),
    isCurated: true,
    riddle_type: normalized.riddle_type || 'text',
    media_url: normalized.media_url || null,
    layout_config: normalized.layout_config || null
  };
}

async function getUserCoins(userId) {
  const { data } = await supabase.from('users').select('coins').eq('id', userId).single();
  return data?.coins ?? null;
}

async function incrementCoinsAtomic(userId, delta) {
  if (!userId || !delta) return getUserCoins(userId);

  const { error: rpcErr } = await supabase.rpc('increment_coins', {
    p_user_id: userId,
    p_coins_delta: delta
  });

  if (rpcErr) {
    console.warn('⚠️ increment_coins fallback:', rpcErr.message);
    const { data: user } = await supabase.from('users').select('coins, xp, level, total_played, total_correct').eq('id', userId).single();
    if (!user) return null;
    const nextTotal = Math.max(0, (user.coins || 0) + delta);
    await supabase.from('users').update({ coins: nextTotal }).eq('id', userId);
    await syncLeaderboardForUser(userId);
    return nextTotal;
  }

  const updatedTotal = await getUserCoins(userId);
  await syncLeaderboardForUser(userId);
  return updatedTotal;
}

async function debitCoinsWithBalanceGuard(userId, amount) {
  const debit = Math.max(0, parseInt(amount, 10) || 0);
  if (!userId || debit <= 0) return getUserCoins(userId);

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: user, error: readErr } = await supabase
      .from('users')
      .select('coins')
      .eq('id', userId)
      .single();
    if (readErr || !user) {
      const error = new Error('User balance could not be verified.');
      error.statusCode = 404;
      throw error;
    }

    const currentCoins = parseInt(user.coins, 10) || 0;
    if (currentCoins < debit) {
      const error = new Error(`You need at least ${debit} Intel to cover this action.`);
      error.statusCode = 400;
      throw error;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('users')
      .update({ coins: currentCoins - debit })
      .eq('id', userId)
      .eq('coins', currentCoins)
      .select('coins')
      .maybeSingle();
    if (updateErr) throw updateErr;
    if (updated) {
      await syncLeaderboardForUser(userId);
      return updated.coins;
    }
  }

  const conflict = new Error('Balance changed while locking Intel. Refresh and try again.');
  conflict.statusCode = 409;
  throw conflict;
}

async function syncLeaderboardForUser(userId, userSnapshot = null) {
  if (!userId) return;
  const user = userSnapshot || (await supabase
    .from('users')
    .select('username, city, coins')
    .eq('id', userId)
    .single()).data;

  if (!user) return;

  await supabase.from('leaderboard').upsert({
    user_id: userId,
    username: user.username || 'Operative',
    city: user.city || 'Global',
    coins: Math.max(0, parseInt(user.coins, 10) || 0),
    week_start: getCurrentWeekStartDate(),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,week_start' });
}

async function attachUserLevelsToLeaderboard(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const userIds = [...new Set(safeRows.map(row => row.user_id).filter(Boolean))];
  if (!userIds.length) {
    return safeRows.map(({ user_id, ...row }) => ({ ...row, level: row.level || null }));
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, level')
    .in('id', userIds);

  if (error) {
    console.warn('⚠️ leaderboard level hydration failed:', error.message);
    return safeRows.map(({ user_id, ...row }) => ({ ...row, level: row.level || null }));
  }

  const levelByUserId = new Map((data || []).map(user => [user.id, user.level]));
  return safeRows.map(({ user_id, ...row }) => ({
    ...row,
    level: levelByUserId.get(user_id) || row.level || null
  }));
}

async function incrementUserStatsAtomic({
  userId,
  coinsDelta = 0,
  xpDelta = 0,
  streak = null,
  playedDelta = 0,
  correctDelta = 0,
  syncLeaderboard = true
}) {
  if (!userId) return null;

  const normalizedCoinsDelta = parseInt(coinsDelta, 10) || 0;
  const normalizedXpDelta = parseInt(xpDelta, 10) || 0;
  const normalizedPlayedDelta = parseInt(playedDelta, 10) || 0;
  const normalizedCorrectDelta = parseInt(correctDelta, 10) || 0;
  const normalizedStreak = streak === null || streak === undefined ? null : Math.max(0, parseInt(streak, 10) || 0);

  const { error: rpcErr } = await supabase.rpc('increment_user_stats', {
    p_user_id: userId,
    p_coins_delta: normalizedCoinsDelta,
    p_xp_delta: normalizedXpDelta,
    p_streak: normalizedStreak,
    p_played_delta: normalizedPlayedDelta,
    p_correct_delta: normalizedCorrectDelta
  });

  if (rpcErr) {
    console.warn('⚠️ increment_user_stats fallback:', rpcErr.message);
    const { data: user } = await supabase
      .from('users')
      .select('coins, xp, level, streak, total_played, total_correct, username, city')
      .eq('id', userId)
      .single();
    if (!user) return null;

    const nextXp = Math.max(0, (parseInt(user.xp, 10) || 0) + normalizedXpDelta);
    const payload = {
      coins: Math.max(0, (parseInt(user.coins, 10) || 0) + normalizedCoinsDelta),
      xp: nextXp,
      level: calculateLevel(nextXp),
      total_played: Math.max(0, (parseInt(user.total_played, 10) || 0) + normalizedPlayedDelta),
      total_correct: Math.max(0, (parseInt(user.total_correct, 10) || 0) + normalizedCorrectDelta)
    };
    if (normalizedStreak !== null) payload.streak = normalizedStreak;

    const { data: updated } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select('coins, xp, level, streak, total_played, total_correct, username, city')
      .single();

    if (syncLeaderboard) await syncLeaderboardForUser(userId, updated || { ...user, ...payload });
    return updated || { ...user, ...payload };
  }

  const { data: updatedUser } = await supabase
    .from('users')
    .select('coins, xp, level, streak, total_played, total_correct, username, city')
    .eq('id', userId)
    .single();

  if (syncLeaderboard) await syncLeaderboardForUser(userId, updatedUser);
  return updatedUser || null;
}

async function getRoomPlayers(roomId) {
  const { data: players } = await supabase
    .from('room_players')
    .select('*')
    .eq('room_id', roomId);
  return players || [];
}

function normalizeComparableText(text = '') {
  return (text || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeComparableText(text = '') {
  return [...new Set(
    normalizeComparableText(text)
      .split(' ')
      .filter((token) => token.length >= 2)
  )];
}

function calculateTokenSimilarity(left = '', right = '') {
  const leftSet = new Set(tokenizeComparableText(left));
  const rightSet = new Set(tokenizeComparableText(right));
  if (!leftSet.size || !rightSet.size) return 0;
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  const unionSize = new Set([...leftSet, ...rightSet]).size;
  return unionSize ? intersection / unionSize : 0;
}

function calculateContainmentSimilarity(left = '', right = '') {
  const a = normalizeComparableText(left);
  const b = normalizeComparableText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  return 0;
}

function buildComparableRiddleShape(riddle) {
  return {
    ...riddle,
    normalizedQuestion: normalizeComparableText(riddle.question),
    normalizedAnswer: normalizeComparableText(riddle.answer)
  };
}

function findPotentialDuplicateRiddle(candidate, corpus = []) {
  const prepared = buildComparableRiddleShape(candidate);
  for (const existing of corpus) {
    if (!existing) continue;
    if ((existing.game_mode || 'arena') !== (prepared.game_mode || 'arena')) continue;

    if (existing.normalizedQuestion && existing.normalizedQuestion === prepared.normalizedQuestion) {
      return { id: existing.id, score: 1, reason: 'matching question', question: existing.question };
    }

    const questionSimilarity = Math.max(
      calculateTokenSimilarity(prepared.normalizedQuestion, existing.normalizedQuestion),
      calculateContainmentSimilarity(prepared.normalizedQuestion, existing.normalizedQuestion)
    );
    const answerSimilarity = Math.max(
      calculateTokenSimilarity(prepared.normalizedAnswer, existing.normalizedAnswer),
      calculateContainmentSimilarity(prepared.normalizedAnswer, existing.normalizedAnswer)
    );
    const sameAnswer = !!prepared.normalizedAnswer && prepared.normalizedAnswer === existing.normalizedAnswer;
    const similarity = (questionSimilarity * 0.75) + (answerSimilarity * 0.25);

    if (sameAnswer && questionSimilarity >= 0.6) {
      return { id: existing.id, score: similarity, reason: 'same answer with highly similar question', question: existing.question };
    }

    if (similarity >= 0.88) {
      return { id: existing.id, score: similarity, reason: 'very high text similarity', question: existing.question };
    }
  }
  return null;
}

const PROTECTED_ANSWER_FIELDS = [
  'id',
  'answer',
  'question',
  'options',
  'difficulty',
  'difficulty_tier',
  'hint',
  'region',
  'category',
  'panic_time',
  'explanation',
  'fun_fact',
  'version',
  'semantic_check_enabled',
  'answer_strictness',
  'accepted_aliases',
  'required_keywords',
  'forbidden_meanings',
  'answer_rubric'
].join(', ');

async function fetchProtectedRiddleRecord(riddleId, fields = PROTECTED_ANSWER_FIELDS) {
  if (!riddleId) return null;
  const { data, error } = await supabase
    .from('riddles')
    .select(fields)
    .eq('id', riddleId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('⚠️ fetchProtectedRiddleRecord failed:', error.message);
    return null;
  }
  return normalizeRiddleRecord(data);
}

async function fetchProtectedBountyRecord(bountyId) {
  if (!bountyId) return null;
  const { data, error } = await supabase
    .from('bounty_board')
    .select('id, question, answer, prize_coins, solved_by, solved_at, active, expires_at')
    .eq('id', bountyId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('⚠️ fetchProtectedBountyRecord failed:', error.message);
    return null;
  }
  return data;
}

function resolveAuthenticatedActorId(req, claimedUserId = null) {
  const tokenUserId = req.user?.id || null;
  if (tokenUserId && claimedUserId && tokenUserId !== claimedUserId) {
    const error = new Error('Authenticated user does not match the requested actor.');
    error.statusCode = 403;
    throw error;
  }
  return tokenUserId || claimedUserId || null;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/;

function normalizeUsernameInput(value, fallback = 'Operative') {
  const clean = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  if (USERNAME_PATTERN.test(clean)) return clean;
  return `${fallback}_${crypto.randomBytes(2).toString('hex')}`.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32);
}

function isAcceptedAvatarUrl(value) {
  if (value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length > 500_000) return false;
  if (/^https:\/\/[^\s]+$/i.test(trimmed)) return true;
  return /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(trimmed);
}

function stripPrivateUserFields(user) {
  if (!user || typeof user !== 'object') return user;
  delete user.password_hash;
  delete user.reset_token;
  delete user.reset_token_expires;
  delete user.verification_token;
  return user;
}

function issueAuthToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: AUTH_TOKEN_TTL });
}

function hashAdminToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '')
    .toString()
    .split(',')[0]
    .trim();
}

function hashClientIp(req) {
  const ip = getClientIp(req);
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${JWT_SECRET}:${ip}`).digest('hex');
}

function sanitizeAdminActorLabel(value, fallback = 'shared-admin-key') {
  return String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_.@-]/g, '_')
    .slice(0, 80) || fallback;
}

function adminHasRole(actor, allowedRoles = []) {
  if (!actor) return false;
  if (actor.role === 'owner') return true;
  return allowedRoles.includes(actor.role);
}

function requireAdminRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!adminHasRole(req.adminActor, allowedRoles)) {
      return res.status(403).json({
        success: false,
        error: `Admin role required: ${allowedRoles.join(' or ')}.`
      });
    }
    next();
  };
}

function normalizeReviewStatus(value, fallback = 'approved') {
  const status = String(value || fallback).trim().toLowerCase();
  return VALID_REVIEW_STATUSES.includes(status) ? status : null;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function isDeliverableRiddle(row) {
  return row?.is_active === true && (row.review_status || 'approved') === 'approved';
}

function applyRiddleReviewState(payload, status, actorLabel, now = new Date().toISOString(), activeOverride = undefined) {
  if (!status) return payload;
  payload.review_status = status;

  if (status === 'approved') {
    payload.is_active = activeOverride === undefined ? true : !!activeOverride;
    payload.approved_at = now;
    payload.approved_by = actorLabel;
    payload.archived_at = null;
    payload.archived_by = null;
  } else if (status === 'archived') {
    payload.is_active = false;
    payload.archived_at = now;
    payload.archived_by = actorLabel;
  } else {
    payload.is_active = false;
  }

  return payload;
}

function cleanAdminText(value, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeStrictness(value) {
  const strictness = String(value || 'normal').trim().toLowerCase();
  return ['lenient', 'normal', 'strict'].includes(strictness) ? strictness : 'normal';
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 20);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(item => item.trim()).filter(Boolean).slice(0, 20);
  }
  return [];
}

function answerHashForRiddle(userAnswer) {
  const clean = cleanAnswerText(userAnswer || '');
  return crypto.createHash('sha256').update(clean).digest('hex');
}

function answerPreview(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function semanticModelCacheKey(riddle) {
  return `${ANSWER_CHECK_PROVIDER || 'off'}:${ANSWER_CHECK_MODEL}:riddle-v${parseInt(riddle?.version, 10) || 1}`;
}

function buildSemanticOptions(riddle) {
  return {
    semanticEnabled: riddle?.semantic_check_enabled === true,
    strictness: normalizeStrictness(riddle?.answer_strictness),
    acceptedAliases: normalizeStringArray(riddle?.accepted_aliases),
    requiredKeywords: normalizeStringArray(riddle?.required_keywords),
    forbiddenMeanings: normalizeStringArray(riddle?.forbidden_meanings),
    answerRubric: riddle?.answer_rubric || ''
  };
}

async function getCachedSemanticVerdict({ riddle, answerHash, strictness, modelKey }) {
  if (!riddle?.id || !answerHash) return null;
  const { data, error } = await supabase
    .from('semantic_answer_cache')
    .select('is_correct, confidence, reason, model, created_at')
    .eq('riddle_id', riddle.id)
    .eq('answer_hash', answerHash)
    .eq('strictness', strictness)
    .eq('model', modelKey)
    .maybeSingle();
  if (error) {
    if (!['42P01', '42703'].includes(error.code)) console.warn('⚠️ semantic cache read failed:', error.message);
    return null;
  }
  if (!data) return null;
  return {
    isCorrect: data.is_correct === true,
    confidence: Number(data.confidence) || 0,
    source: 'cache',
    reason: data.reason || 'Cached semantic verdict.',
    model: data.model,
    semanticUsed: false
  };
}

async function saveSemanticVerdict({ riddle, answerHash, strictness, modelKey, verdict }) {
  if (!riddle?.id || !answerHash || !verdict) return;
  const { error } = await supabase
    .from('semantic_answer_cache')
    .upsert({
      riddle_id: riddle.id,
      answer_hash: answerHash,
      strictness,
      model: modelKey,
      is_correct: verdict.isCorrect === true,
      confidence: Math.max(0, Math.min(1, Number(verdict.confidence) || 0)),
      reason: String(verdict.reason || '').slice(0, 500)
    }, { onConflict: 'riddle_id,answer_hash,strictness,model' });
  if (error && !['42P01', '42703'].includes(error.code)) {
    console.warn('⚠️ semantic cache write failed:', error.message);
  }
}

async function recordAnswerJudgment({ userId, riddle, mode, userAnswer, verdict, answerHash }) {
  if (!riddle?.id || !answerHash || !verdict) return;
  const source = ['exact', 'alias', 'heuristic', 'llm', 'cache', 'fallback', 'timeout'].includes(verdict.source)
    ? verdict.source
    : 'fallback';
  const { error } = await supabase
    .from('answer_judgments')
    .insert({
      user_id: userId || null,
      riddle_id: riddle.id,
      mode: mode || null,
      answer_hash: answerHash,
      answer_preview: answerPreview(userAnswer),
      source,
      is_correct: verdict.isCorrect === true,
      confidence: Math.max(0, Math.min(1, Number(verdict.confidence) || 0)),
      model: verdict.model || null,
      reason: String(verdict.reason || '').slice(0, 500)
    });
  if (error && !['42P01', '42703'].includes(error.code)) {
    console.warn('⚠️ answer judgment log failed:', error.message);
  }
}

async function recordStandaloneAnswerJudgment({ userId, mode, userAnswer, verdict }) {
  if (!verdict) return;
  const answerHash = answerHashForRiddle(userAnswer);
  if (!answerHash) return;
  const source = ['exact', 'alias', 'heuristic', 'llm', 'cache', 'fallback', 'timeout'].includes(verdict.source)
    ? verdict.source
    : 'fallback';
  const { error } = await supabase
    .from('answer_judgments')
    .insert({
      user_id: userId || null,
      riddle_id: null,
      mode: mode || null,
      answer_hash: answerHash,
      answer_preview: answerPreview(userAnswer),
      source,
      is_correct: verdict.isCorrect === true,
      confidence: Math.max(0, Math.min(1, Number(verdict.confidence) || 0)),
      model: verdict.model || null,
      reason: String(verdict.reason || '').slice(0, 500)
    });
  if (error && !['42P01', '42703'].includes(error.code)) {
    console.warn('⚠️ standalone answer judgment log failed:', error.message);
  }
}

async function judgeTypedAnswer({ userId, riddle, userAnswer, mode }) {
  const semanticOptions = buildSemanticOptions(riddle);
  const answerHash = answerHashForRiddle(userAnswer);
  const modelKey = semanticModelCacheKey(riddle);
  let verdict = null;

  if (semanticOptions.semanticEnabled) {
    verdict = await getCachedSemanticVerdict({
      riddle,
      answerHash,
      strictness: semanticOptions.strictness,
      modelKey
    });
  }

  if (!verdict) {
    verdict = await checkTypedAnswerDetailed(userAnswer, riddle.answer, riddle.question || '', semanticOptions);
    if (semanticOptions.semanticEnabled && ['llm', 'heuristic', 'alias', 'exact'].includes(verdict.source)) {
      await saveSemanticVerdict({
        riddle,
        answerHash,
        strictness: semanticOptions.strictness,
        modelKey,
        verdict: { ...verdict, model: verdict.model || modelKey }
      });
    }
  }

  await recordAnswerJudgment({
    userId,
    riddle,
    mode,
    userAnswer,
    verdict,
    answerHash
  });

  return verdict;
}

async function assertRoomMembership(roomId, userId) {
  if (!roomId || !userId) {
    const error = new Error('Room access requires a signed-in operative.');
    error.statusCode = 401;
    throw error;
  }
  const { data: membership, error } = await supabase
    .from('room_players')
    .select('room_id, user_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!membership) {
    const accessError = new Error('This room is restricted to joined operatives only.');
    accessError.statusCode = 403;
    throw accessError;
  }
  return membership;
}

function getBaseDeliveryMode(requestedMode = 'arena') {
  return requestedMode === 'ranked' ? 'arena' : requestedMode;
}

function getDeliveryModeCandidates(requestedMode = 'arena') {
  const mode = String(requestedMode || 'arena').trim() || 'arena';
  if (mode === 'daily') return ['daily'];

  const primary = getBaseDeliveryMode(mode);
  const fallbacksByMode = {
    arena: ['arena', 'mcq', 'type'],
    ranked: ['arena', 'mcq', 'type'],
    wager: ['wager', 'mcq', 'type', 'arena'],
    gauntlet: ['gauntlet', 'mcq', 'type', 'arena'],
    chain: ['chain', 'type', 'mcq', 'arena'],
    mcq: ['mcq', 'arena'],
    type: ['type', 'arena'],
    bounty: ['bounty', 'mcq', 'type', 'arena']
  };

  return [...new Set(fallbacksByMode[mode] || [primary, 'mcq', 'type', 'arena'])];
}

function getCurrentWeekStartDate(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().split('T')[0];
}

async function getUserProgressProfile(userId) {
  const { data: user } = await supabase
    .from('users')
    .select('xp, total_played')
    .eq('id', userId)
    .single();
  return {
    xp: parseInt(user?.xp, 10) || 0,
    totalPlayed: parseInt(user?.total_played, 10) || 0
  };
}

async function resolveRequestedTier({ userId, requestedMode = 'arena', xp = 0, totalPlayed = 0 }) {
  if (totalPlayed < 5) {
    return 1;
  }

  if (requestedMode === 'ranked') {
    try {
      const { data: rankedProfile } = await supabase
        .from('ranked_profiles')
        .select('rating')
        .eq('user_id', userId)
        .single();
      return getRankedDifficultyTier(rankedProfile?.rating ?? 1000);
    } catch {
      return getRankedDifficultyTier(1000);
    }
  }

  return getDifficultyTier(xp);
}

async function getRecentCategoriesForUser(userId, limit = 3) {
  const { data: history } = await supabase
    .from('user_riddle_history')
    .select('riddle_id, attempted_at')
    .eq('user_id', userId)
    .order('attempted_at', { ascending: false })
    .limit(Math.max(limit, 6));

  const ids = (history || []).map((row) => row.riddle_id).filter(Boolean);
  if (ids.length === 0) return [];

  const { data: riddles } = await supabase
    .from('riddles_safe')
    .select('id, category')
    .in('id', ids);

  const categoryById = new Map((riddles || []).map((row) => [row.id, row.category]));
  return ids.map((id) => categoryById.get(id)).filter(Boolean).slice(0, limit);
}

async function pickWithCategoryRotation(userId) {
  return getRecentCategoriesForUser(userId, 3);
}

async function callRpcVariants(functionName, payloads) {
  let lastError = null;
  for (const payload of payloads) {
    const { data, error } = await supabase.rpc(functionName, payload);
    if (!error) return { data, error: null };
    lastError = error;
  }
  return { data: null, error: lastError };
}

async function fetchSafeRiddleById(riddleId, fallbackMode = 'arena') {
  if (!riddleId) return null;
  const { data, error } = await supabase
    .from('riddles_safe')
    .select('*')
    .eq('id', riddleId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn('⚠️ fetchSafeRiddleById failed:', error.message);
    }
    return null;
  }

  return normalizeRiddleRecord(data, fallbackMode);
}

async function getOldestSolvedRiddle(userId, tier, poolMode = null) {
  const { data, error } = await callRpcVariants('get_oldest_solved_riddle', [
    { p_user_id: userId, p_tier: tier, p_mode: poolMode },
    { user_id: userId, tier },
    { p_user_id: userId, p_tier: tier }
  ]);
  if (error) {
    console.warn('⚠️ get_oldest_solved_riddle failed:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  const normalized = normalizeRiddleRecord(row);
  if (normalized?.question && normalized?.id) {
    return normalized;
  }
  return fetchSafeRiddleById(normalized?.id || row?.id || row?.riddle_id);
}

async function markRiddleServed({ userId, riddle, mode, sessionId = null, xpAtTime = null, position = null }) {
  if (!userId || !riddle?.id) return;
  const now = new Date().toISOString();

  await supabase
    .from('user_riddle_history')
    .upsert({
      user_id: userId,
      riddle_id: riddle.id,
      mode,
      status: 'served',
      attempted_at: now,
      xp_at_time: xpAtTime
    }, { onConflict: 'user_id,riddle_id' });

  if (sessionId) {
    const queuePayload = {
      session_id: sessionId,
      riddle_id: riddle.id,
      served_at: now
    };
    if (position) queuePayload.position = position;
    await supabase
      .from('session_riddle_queue')
      .upsert(queuePayload, { onConflict: 'session_id,riddle_id' });
  }

  await supabase
    .from('riddles')
    .update({
      times_served: (parseInt(riddle.times_served, 10) || 0) + 1,
      last_served_at: now
    })
    .eq('id', riddle.id);
}

async function updateRiddleHistory({ userId, riddleId, mode, status, timeTakenMs = null, hintsUsed = null, sessionId = null }) {
  if (!userId || !riddleId) return;
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    riddle_id: riddleId,
    status,
    attempted_at: now,
    time_taken_ms: timeTakenMs
  };

  if (mode) {
    payload.mode = mode;
  }

  if (status === 'solved' || status === 'hint_used') {
    payload.solved_at = now;
  }
  if (Number.isInteger(hintsUsed)) {
    payload.hints_used = hintsUsed;
  }

  await supabase
    .from('user_riddle_history')
    .upsert(payload, { onConflict: 'user_id,riddle_id' });

  if (sessionId && status === 'solved') {
    await supabase
      .from('session_riddle_queue')
      .update({ answered_by: userId })
      .eq('session_id', sessionId)
      .eq('riddle_id', riddleId);
  }
}

async function recordHintUsage({ userId, riddleId, hintsUsed = 1 }) {
  if (!userId || !riddleId) {
    const error = new Error('Hint usage requires a served riddle and authenticated operative.');
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from('user_riddle_history')
    .update({ hints_used: Math.max(1, parseInt(hintsUsed, 10) || 1) })
    .eq('user_id', userId)
    .eq('riddle_id', riddleId)
    .not('status', 'in', '(solved,failed,skipped,timed_out,hint_used)')
    .select('riddle_id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const conflict = new Error('Hints are only available while the riddle is active.');
    conflict.statusCode = 409;
    throw conflict;
  }
}

async function claimRiddleResolutionOnce({ userId, riddleId, mode, status, timeTakenMs = null, hintsUsed = null, sessionId = null }) {
  if (!userId || !riddleId) {
    const error = new Error('Resolution requires a served riddle and authenticated operative.');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();
  const payload = {
    mode,
    status,
    attempted_at: now,
    time_taken_ms: timeTakenMs
  };
  if (status === 'solved') payload.solved_at = now;
  if (hintsUsed !== null) payload.hints_used = hintsUsed;

  const { data, error } = await supabase
    .from('user_riddle_history')
    .update(payload)
    .eq('user_id', userId)
    .eq('riddle_id', riddleId)
    .not('status', 'in', '(solved,failed,skipped,timed_out,hint_used)')
    .select('riddle_id, status')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const conflict = new Error('This riddle has already been resolved.');
    conflict.statusCode = 409;
    throw conflict;
  }

  if (sessionId) {
    await supabase
      .from('session_riddle_queue')
      .update({ answered_by: userId })
      .eq('session_id', sessionId)
      .eq('riddle_id', riddleId);
  }

  return data;
}

async function getRiddleHistoryEntry(userId, riddleId) {
  if (!userId || !riddleId) return null;
  const { data, error } = await supabase
    .from('user_riddle_history')
    .select('mode, status, attempted_at, solved_at')
    .eq('user_id', userId)
    .eq('riddle_id', riddleId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function isTerminalRiddleStatus(status) {
  return ['solved', 'failed', 'skipped', 'timed_out', 'hint_used'].includes(status);
}

async function resolveServedRiddleGuard({ userId, riddleId, mode, requireServed = true }) {
  const history = await getRiddleHistoryEntry(userId, riddleId);
  if (!history) {
    if (!requireServed) return null;
    const error = new Error('This riddle was not served by the delivery engine for this operative.');
    error.statusCode = 409;
    throw error;
  }
  if (isTerminalRiddleStatus(history.status)) {
    const error = new Error('This riddle has already been resolved.');
    error.statusCode = 409;
    throw error;
  }
  if (mode && history.mode && history.mode !== mode) {
    const error = new Error('Riddle mode mismatch. Refresh and request a new node.');
    error.statusCode = 409;
    throw error;
  }
  return history;
}

async function resolvePanicSubmissionState({ panicMode, userId, riddleId, clientTimeTaken = 0, startedAtMs = null, limitSeconds = null }) {
  const clientElapsed = Math.max(0, parseInt(clientTimeTaken, 10) || 0);
  if (!panicMode) {
    return { limitSeconds: null, elapsedSeconds: clientElapsed, isLate: false };
  }

  const limit = Math.max(1, parseInt(limitSeconds, 10) || await getAdminPanicTimerSeconds());
  let serverElapsed = startedAtMs ? secondsSince(startedAtMs) : 0;
  if (!serverElapsed && userId && riddleId) {
    const history = await getRiddleHistoryEntry(userId, riddleId);
    if (history?.attempted_at) {
      serverElapsed = Math.max(0, Math.floor((Date.now() - new Date(history.attempted_at).getTime()) / 1000));
    }
  }

  const elapsed = Math.max(clientElapsed, serverElapsed);
  return { limitSeconds: limit, elapsedSeconds: elapsed, isLate: elapsed >= limit };
}

async function fetchNextRiddleFromEngine({
  userId,
  xp = 0,
  totalPlayed = 0,
  requestedMode = 'arena',
  sessionId = null,
  modeOverride = null,
  tierOverride = null,
  suppressServeLog = false,
  position = null
}) {
  const modeCandidates = modeOverride ? [modeOverride] : getDeliveryModeCandidates(requestedMode);
  const tier = tierOverride ?? await resolveRequestedTier({ userId, requestedMode, xp, totalPlayed });
  const categoryExclude = await pickWithCategoryRotation(userId);

  let data = null;
  let selectedPoolMode = modeCandidates[0];
  let riddle = null;

  for (const poolMode of modeCandidates) {
    const { data: rpcData, error } = await callRpcVariants('get_next_riddle', [
      {
        user_id: userId,
        tier,
        mode: poolMode,
        session_id: sessionId || null,
        category_exclude: categoryExclude
      },
      {
        p_user_id: userId,
        p_tier: tier,
        p_mode: poolMode,
        p_session_id: sessionId || null,
        p_category_exclude: categoryExclude
      }
    ]);

    if (error) {
      console.warn('⚠️ get_next_riddle RPC unavailable, using server RDE fallback:', error.message);
      data = await fetchNextRiddleFallback({ userId, tier, poolMode, sessionId, categoryExclude });
    } else {
      data = rpcData;
    }

    const row = Array.isArray(data) ? data[0] : data;
    riddle = normalizeRiddleRecord(row, poolMode);
    if (riddle?.id && !riddle?.question) {
      riddle = await fetchSafeRiddleById(riddle.id, poolMode);
    }
    if (!riddle) {
      const fallback = await fetchNextRiddleFallback({ userId, tier, poolMode, sessionId, categoryExclude });
      riddle = normalizeRiddleRecord(fallback, poolMode);
    }
    if (!riddle) {
      riddle = await getOldestSolvedRiddle(userId, tier, poolMode);
    }
    if (riddle) {
      selectedPoolMode = poolMode;
      break;
    }
  }
  if (!riddle) {
    return { riddle: null, tier, poolMode: selectedPoolMode };
  }

  if (!suppressServeLog) {
    await markRiddleServed({
      userId,
      riddle,
      mode: requestedMode,
      sessionId,
      xpAtTime: xp,
      position
    });
  }

  return { riddle, tier, poolMode: selectedPoolMode };
}

async function fetchNextRiddleFallback({ userId, tier, poolMode, sessionId = null, categoryExclude = [] }) {
  const [{ data: seenRows }, sessionRows] = await Promise.all([
    supabase.from('user_riddle_history').select('riddle_id').eq('user_id', userId),
    sessionId
      ? supabase.from('session_riddle_queue').select('riddle_id').eq('session_id', sessionId)
      : Promise.resolve({ data: [] })
  ]);

  const seenIds = [...new Set([
    ...(seenRows || []).map(row => row.riddle_id).filter(Boolean),
    ...((sessionRows.data || []).map(row => row.riddle_id).filter(Boolean))
  ])];

  let filtered = [];
  const seenSet = new Set(seenIds);

  for (const tierToTry of buildTierSearchOrder(tier)) {
    let query = supabase
      .from('riddles_safe')
      .select('*')
      .eq('game_mode', poolMode)
      .eq('difficulty_tier', tierToTry)
      .eq('is_active', true)
      .eq('review_status', 'approved')
      .order('times_served', { ascending: true })
      .limit(40);

    if (seenIds.length > 0 && seenIds.length <= 300) {
      query = query.not('id', 'in', `(${seenIds.join(',')})`);
    }

    const { data: candidates, error } = await query;
    if (error) throw error;

    filtered = seenIds.length > 300
      ? (candidates || []).filter(row => !seenSet.has(row.id))
      : (candidates || []);

    if (filtered.length > 0) break;
  }

  const prioritized = [...filtered].sort((a, b) => {
    const aRecent = categoryExclude.includes(a.category) ? 1 : 0;
    const bRecent = categoryExclude.includes(b.category) ? 1 : 0;
    if (aRecent !== bRecent) return aRecent - bRecent;
    return (parseInt(a.times_served, 10) || 0) - (parseInt(b.times_served, 10) || 0);
  });

  return prioritized[0] || null;
}

async function generateSessionQueue(sessionId, playerIds, difficultyTier, mode = 'arena', queueSize = 10) {
  const runtime = getRoomRuntime(sessionId);
  const { data: existingEntries } = await supabase
    .from('session_riddle_queue')
    .select('riddle_id, position')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });

  if (existingEntries && existingEntries.length > 0) {
    if (runtime.queueSnapshot?.length) {
      return runtime.queueSnapshot.slice().sort((a, b) => a.position - b.position);
    }
    const ids = existingEntries.map((entry) => entry.riddle_id);
    const { data: riddles } = await supabase.from('riddles_safe').select('*').in('id', ids);
    const byId = new Map((riddles || []).map((row) => [row.id, normalizeRiddleRecord(row, getBaseDeliveryMode(mode))]));
    const hydratedQueue = existingEntries
      .map((entry) => {
        const riddle = byId.get(entry.riddle_id);
        return riddle ? { position: entry.position, ...riddle } : null;
      })
      .filter(Boolean);
    runtime.queueSnapshot = hydratedQueue;
    return hydratedQueue;
  }

  const historyResponses = await Promise.all(
    playerIds.map((playerId) =>
      supabase.from('user_riddle_history').select('riddle_id').eq('user_id', playerId)
    )
  );

  const bothSeen = [...new Set(
    historyResponses.flatMap((response) => (response.data || []).map((row) => row.riddle_id))
  )];

  const bothSeenSet = new Set(bothSeen);
  const candidateMap = new Map();
  const perTierLimit = Math.max(queueSize * 3, 20);

  for (const poolMode of getDeliveryModeCandidates(mode)) {
    for (const tierToTry of buildTierSearchOrder(difficultyTier)) {
      let query = supabase
        .from('riddles_safe')
        .select('*')
        .eq('game_mode', poolMode)
        .eq('difficulty_tier', tierToTry)
        .eq('is_active', true)
        .eq('review_status', 'approved')
        .order('times_served', { ascending: true })
        .limit(perTierLimit);

      if (bothSeen.length > 0 && bothSeen.length <= 300) {
        query = query.not('id', 'in', `(${bothSeen.join(',')})`);
      }

      const { data: candidates, error } = await query;
      if (error) throw error;

      for (const row of candidates || []) {
        if (bothSeenSet.has(row.id) || candidateMap.has(row.id)) continue;
        candidateMap.set(row.id, row);
      }

      if (candidateMap.size >= queueSize) break;
    }
    if (candidateMap.size >= queueSize) break;
  }

  const filteredCandidates = [...candidateMap.values()];

  if (filteredCandidates.length === 0) return [];

  const categoryExclude = await pickWithCategoryRotation(playerIds[0]);
  const prioritized = [...filteredCandidates].sort((a, b) => {
    const aRecent = categoryExclude.includes(a.category) ? 1 : 0;
    const bRecent = categoryExclude.includes(b.category) ? 1 : 0;
    if (aRecent !== bRecent) return aRecent - bRecent;
    return (parseInt(a.times_served, 10) || 0) - (parseInt(b.times_served, 10) || 0);
  });

  const queue = seededShuffle(prioritized, `${sessionId}:${difficultyTier}`)
    .slice(0, queueSize)
    .map((row) => normalizeRiddleRecord(row, getBaseDeliveryMode(mode)));

  if (queue.length === 0) return [];

  const { error: queueInsertErr } = await supabase
    .from('session_riddle_queue')
    .insert(queue.map((riddle, index) => ({
      session_id: sessionId,
      riddle_id: riddle.id,
      position: index + 1
    })));
  if (queueInsertErr) throw queueInsertErr;
  runtime.queueSnapshot = queue.map((riddle, index) => ({ ...riddle, position: index + 1 }));
  return runtime.queueSnapshot;
}

async function getSessionQueuedRiddle(sessionId, position) {
  const { data: entry } = await supabase
    .from('session_riddle_queue')
    .select('riddle_id, position, served_at, answered_by')
    .eq('session_id', sessionId)
    .eq('position', position)
    .maybeSingle();

  if (!entry) return null;

  const runtime = getRoomRuntime(sessionId);
  const snapshotted = runtime.queueSnapshot?.find((row) => row.position === position);
  if (snapshotted) {
    return {
      position: entry.position,
      served_at: entry.served_at,
      answered_by: entry.answered_by,
      riddle: normalizeRiddleRecord(snapshotted)
    };
  }

  const { data: riddle } = await supabase
    .from('riddles_safe')
    .select('*')
    .eq('id', entry.riddle_id)
    .maybeSingle();

  if (!riddle) return null;

  return {
    position: entry.position,
    served_at: entry.served_at,
    answered_by: entry.answered_by,
    riddle: normalizeRiddleRecord(riddle)
  };
}

async function getSessionQueuePosition(sessionId, riddleId) {
  const { data: entry } = await supabase
    .from('session_riddle_queue')
    .select('position')
    .eq('session_id', sessionId)
    .eq('riddle_id', riddleId)
    .maybeSingle();
  return entry?.position || 0;
}

async function getSessionQueueSize(sessionId) {
  const { count } = await supabase
    .from('session_riddle_queue')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  return count || 0;
}

async function getSessionRiddleServedAt(sessionId, riddleId) {
  if (!sessionId || !riddleId) return null;
  const { data } = await supabase
    .from('session_riddle_queue')
    .select('served_at')
    .eq('session_id', sessionId)
    .eq('riddle_id', riddleId)
    .maybeSingle();
  return data?.served_at || null;
}

async function resolveRoomModeSelection(userId, xp, roomMode = 'mcq') {
  const requestedMode = roomMode || 'mcq';
  const progress = await getUserProgressProfile(userId);
  const effectiveXp = Number.isFinite(parseInt(xp, 10)) ? parseInt(xp, 10) : progress.xp;
  const tier = await resolveRequestedTier({
    userId,
    requestedMode,
    xp: effectiveXp,
    totalPlayed: progress.totalPlayed
  });

  return {
    requestedMode,
    gameMode: getBaseDeliveryMode(requestedMode),
    tier,
    xp: effectiveXp,
    totalPlayed: progress.totalPlayed
  };
}

async function hydrateRoomRiddle(room, runtime) {
  if (!room?.current_riddle_id) return null;
  if (runtime.currentRiddle?.id === room.current_riddle_id) {
    return runtime.currentRiddle;
  }

  let timeLimit = runtime.currentTimeLimit;
  if (!timeLimit && room.timed && room.time_limit !== -1) {
    timeLimit = room.time_limit;
    runtime.currentTimeLimit = timeLimit;
  }

  let startedAt = runtime.roundStartedAt;
  if (!startedAt && timeLimit) {
    const servedAt = await getSessionRiddleServedAt(room.id, room.current_riddle_id);
    if (servedAt) {
      startedAt = new Date(servedAt).getTime();
      runtime.roundStartedAt = startedAt;
    }
  }

  const snapshotted = runtime.queueSnapshot?.find((entry) => entry.id === room.current_riddle_id);
  if (snapshotted) {
    if (!timeLimit && room.timed && room.time_limit === -1) {
      timeLimit = await resolveRiddlePanicTimerSeconds(snapshotted);
      runtime.currentTimeLimit = timeLimit;
    }
    if (timeLimit && startedAt) {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      timeLimit = Math.max(0, timeLimit - elapsed);
    }
    runtime.currentRiddle = serializeRiddlePayload(snapshotted, timeLimit);
    return runtime.currentRiddle;
  }

  const { data: riddle } = await supabase
    .from('riddles_safe')
    .select('*')
    .eq('id', room.current_riddle_id)
    .single();

  if (!riddle) return null;

  if (!timeLimit && room.timed && room.time_limit === -1) {
    timeLimit = await resolveRiddlePanicTimerSeconds(riddle);
    runtime.currentTimeLimit = timeLimit;
  }

  if (timeLimit && startedAt) {
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    timeLimit = Math.max(0, timeLimit - elapsed);
  }

  runtime.currentRiddle = serializeRiddlePayload(riddle, timeLimit);
  return runtime.currentRiddle;
}

async function escrowRoomWagers(roomId, players, wagerAmount) {
  const runtime = getRoomRuntime(roomId);
  runtime.escrow.clear();

  if (!wagerAmount || wagerAmount <= 0) {
    return { success: true, pot: 0 };
  }

  const staged = [];
  try {
    for (const player of players) {
      await debitCoinsWithBalanceGuard(player.user_id, wagerAmount);
      runtime.escrow.set(player.user_id, wagerAmount);
      staged.push(player.user_id);
    }
    return { success: true, pot: wagerAmount * players.length };
  } catch (error) {
    for (const userId of staged) {
      const wager = runtime.escrow.get(userId) || 0;
      if (wager > 0) {
        await incrementCoinsAtomic(userId, wager);
      }
    }
    runtime.escrow.clear();
    return { success: false, error: error.message };
  }
}

async function refundRoomWagers(roomId, room = null, players = null) {
  const runtime = getRoomRuntime(roomId);
  const balances = {};

  let entries = [...runtime.escrow.entries()];
  if (entries.length === 0) {
    const wagerAmount = resolveRoomWagerAmount(roomId, room);
    const roomPlayers = players || await getRoomPlayers(roomId);
    entries = wagerAmount > 0 ? roomPlayers.map((player) => [player.user_id, wagerAmount]) : [];
  }

  for (const [userId, wager] of entries) {
    balances[userId] = await incrementCoinsAtomic(userId, wager);
  }
  runtime.escrow.clear();
  runtime.showdownComplete = true;
  return balances;
}

async function consumeRoomWagerPot(roomId, room = null, players = null) {
  const runtime = getRoomRuntime(roomId);
  let pot = 0;
  for (const wager of runtime.escrow.values()) {
    pot += wager;
  }
  if (pot <= 0) {
    const wagerAmount = resolveRoomWagerAmount(roomId, room);
    const roomPlayers = players || await getRoomPlayers(roomId);
    pot = wagerAmount > 0 ? wagerAmount * roomPlayers.length : 0;
  }
  runtime.escrow.clear();
  runtime.showdownComplete = true;
  return pot;
}

async function tryRevealRoom(roomId) {
  const { data, error } = await supabase
    .from('multiplayer_rooms')
    .update({ status: 'revealed' })
    .eq('id', roomId)
    .eq('status', 'playing')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

function buildStoredRoundSummary({ room, players, riddle, runtime }) {
  if (runtime?.roundSummary) return runtime.roundSummary;

  const sortedPlayers = [...(players || [])].sort((a, b) => {
    if (!!b.is_correct !== !!a.is_correct) return b.is_correct ? 1 : -1;
    return (b.coins_earned || 0) - (a.coins_earned || 0);
  });
  const winner = sortedPlayers.find((player) => player.is_correct);
  const isWagerRoom = room?.engagement === 'versus' && room?.mode === 'wager';

  if (room?.engagement === 'coop') {
    return {
      correctAnswer: riddle?.answer,
      coinsEarned: winner?.coins_earned || 0,
      panicBonus: 0,
      resolved: true,
      teamWin: !!winner,
      winnerId: winner?.user_id || null,
      winnerName: winner?.username || null,
      noWinner: !winner
    };
  }

  return {
    correctAnswer: riddle?.answer,
    coinsEarned: winner?.coins_earned || 0,
    panicBonus: 0,
    resolved: true,
    winnerId: winner?.user_id || null,
    winnerName: winner?.username || null,
    noWinner: !winner,
    showdownComplete: isWagerRoom,
    wagerPot: isWagerRoom ? Math.max(0, (winner?.coins_earned || 0)) : 0
  };
}

app.get('/', (req, res) => res.json({ status: 'CRACKL running!' }));

// ============================
// 🧠 RIDDLE DELIVERY ENGINE
// ============================

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

// Check admin secret/operator token (header-based, for admin routes)
const checkAdmin = async (req, res, next) => {
  try {
    const suppliedToken = String(req.headers['x-admin-secret'] || '').trim();
    if (!suppliedToken) {
      return res.status(403).json({ success: false, error: 'Unauthorized Admin Access.' });
    }

    if (ADMIN_SECRET && suppliedToken === ADMIN_SECRET) {
      req.adminActor = {
        id: null,
        label: sanitizeAdminActorLabel(req.headers['x-admin-actor'], 'shared-admin-key'),
        role: 'owner',
        source: 'master_secret'
      };
      return next();
    }

    const tokenHash = hashAdminToken(suppliedToken);
    const { data: operator, error } = await supabase
      .from('admin_operators')
      .select('id, display_name, role, is_active')
      .eq('token_hash', tokenHash)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      if (['42P01', '42703'].includes(error.code)) {
        return res.status(403).json({ success: false, error: 'Admin operators are not initialized.' });
      }
      throw error;
    }
    if (!operator || !ADMIN_OPERATOR_ROLES.includes(operator.role)) {
      return res.status(403).json({ success: false, error: 'Unauthorized Admin Access.' });
    }

    req.adminActor = {
      id: operator.id,
      label: sanitizeAdminActorLabel(operator.display_name, `operator-${operator.id}`),
      role: operator.role,
      source: 'operator_token'
    };

    supabase
      .from('admin_operators')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', operator.id)
      .then(({ error: updateErr }) => {
        if (updateErr) console.warn('⚠️ admin operator last_used update failed:', updateErr.message);
      });

    return next();
  } catch (error) {
    console.error('❌ checkAdmin:', error.message);
    return res.status(500).json({ success: false, error: 'Admin authorization failed.' });
  }
};

function sanitizeAuditMetadata(value, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitizeAuditMetadata(item, depth + 1));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
    return value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (ADMIN_AUDIT_REDACT_KEYS.has(key)) return [key, '[redacted]'];
    return [key, sanitizeAuditMetadata(item, depth + 1)];
  }));
}

function getAdminActorLabel(req) {
  return req.adminActor?.label || sanitizeAdminActorLabel(req.headers['x-admin-actor'], 'shared-admin-key');
}

async function recordAdminAudit(req, { action, entityType = null, entityId = null, metadata = {} }) {
  try {
    await supabase.from('admin_audit_logs').insert({
      actor_label: getAdminActorLabel(req),
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId).slice(0, 120) : null,
      metadata: sanitizeAuditMetadata(metadata),
      ip_address: (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim().slice(0, 80),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 300)
    });
  } catch (error) {
    console.warn('⚠️ admin audit log failed:', error.message);
  }
}

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

// Strict auth — rejects if no valid token
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

// Soft auth — validates token if present, but allows unauthenticated requests through
const softAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { req.user = null; return next(); }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    req.user = err ? null : user;
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

app.post('/support/ticket', authenticateToken, async (req, res) => {
  try {
    const userId = resolveAuthenticatedActorId(req, req.body?.userId);
    const subject = cleanAdminText(req.body?.subject, 180);
    const message = cleanAdminText(req.body?.message, 4000);
    const category = cleanAdminText(req.body?.category || 'general', 40).toLowerCase() || 'general';
    const priority = VALID_SUPPORT_PRIORITIES.includes(req.body?.priority) ? req.body.priority : 'normal';
    if (!subject || !message) {
      return res.status(400).json({ success: false, error: 'Support tickets require a subject and message.' });
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: userId,
        category,
        subject,
        message,
        priority,
        metadata: sanitizeAuditMetadata(req.body?.metadata || {})
      })
      .select('id, status, created_at')
      .single();
    if (error) throw error;

    res.json({ success: true, ticket: data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

app.post('/riddle/report', authenticateToken, async (req, res) => {
  try {
    const userId = resolveAuthenticatedActorId(req, req.body?.userId);
    const riddleId = String(req.body?.riddleId || '').trim();
    const reason = cleanAdminText(req.body?.reason, 80).toLowerCase();
    const details = cleanAdminText(req.body?.details, 2000) || null;
    if (!riddleId || !reason) {
      return res.status(400).json({ success: false, error: 'Riddle reports require a riddleId and reason.' });
    }

    const { data: riddle, error: riddleErr } = await supabase
      .from('riddles_safe')
      .select('id')
      .eq('id', riddleId)
      .maybeSingle();
    if (riddleErr) throw riddleErr;
    if (!riddle) return res.status(404).json({ success: false, error: 'Riddle not found.' });

    const { data, error } = await supabase
      .from('user_riddle_reports')
      .insert({ user_id: userId, riddle_id: riddleId, reason, details })
      .select('id, status, created_at')
      .single();
    if (error) throw error;
    res.json({ success: true, report: data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

// ============================
// 👑 ADMIN ROUTES
// ============================

async function countRows(table, buildQuery = null) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (buildQuery) query = buildQuery(query);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

// Real-time overview stats
app.get('/admin/stats', checkAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [riddlesRes, locksRes, usersRes, maintRes, panicTimerRes] = await Promise.all([
      supabase.from('riddles').select('id, game_mode, difficulty, difficulty_tier, is_active, is_onboarding, review_status'),
      supabase.from('riddle_daily_locks').select('riddle_id').eq('lock_date', today),
      supabase.from('users').select('id').gte('updated_at', yesterday24h),
      supabase.from('app_settings').select('value').eq('key', 'maintenance_mode').single(),
      supabase.from('app_settings').select('value').eq('key', 'panic_timer_seconds').single()
    ]);

    const riddles = riddlesRes.data || [];
    const servedToday = (locksRes.data || []).length;
    const activeUsers24h = (usersRes.data || []).length;
    const maintenanceMode = maintRes.data?.value === 'true';
    const panicTimerSeconds = parseInt(panicTimerRes.data?.value, 10) > 0 ? parseInt(panicTimerRes.data?.value, 10) : 30;

    const modes = ['mcq', 'type', 'arena', 'daily', 'gauntlet', 'chain', 'wager', 'bounty'];
    const difficulties = ['Easy', 'Medium', 'Hard'];

    const byMode = {};
    modes.forEach(m => { byMode[m] = riddles.filter(r => r.game_mode === m && isDeliverableRiddle(r)).length; });

    const byDifficulty = {};
    difficulties.forEach(d => { byDifficulty[d] = riddles.filter(r => r.difficulty === d && isDeliverableRiddle(r)).length; });
    const byTier = {};
    [1, 2, 3, 4, 5].forEach(t => { byTier[t] = riddles.filter(r => (parseInt(r.difficulty_tier, 10) || getDifficultyTierFromLegacyDifficulty(r.difficulty)) === t && isDeliverableRiddle(r)).length; });

    // Low stock alerts: any mode+difficulty combo with < 10 active riddles
    const lowStockAlerts = [];
    modes.forEach(m => {
      difficulties.forEach(d => {
        const count = riddles.filter(r => r.game_mode === m && r.difficulty === d && isDeliverableRiddle(r)).length;
        if (count < 10) {
          lowStockAlerts.push({ mode: m, difficulty: d, count });
        }
      });
    });

    res.json({
      success: true,
      totalRiddles: riddles.filter(isDeliverableRiddle).length,
      byMode,
      byDifficulty,
      byTier,
      servedToday,
      activeUsers24h,
      lowStockAlerts,
      maintenanceMode,
      panicTimerSeconds
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/admin/audit-logs', checkAdmin, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    let query = supabase
      .from('admin_audit_logs')
      .select('id, actor_label, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (req.query.action) query = query.eq('action', String(req.query.action).slice(0, 120));
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, logs: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/admin/operators', checkAdmin, requireAdminRole(['owner']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_operators')
      .select('id, display_name, role, is_active, created_by, created_at, last_used_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, operators: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/admin/operators', checkAdmin, requireAdminRole(['owner']), async (req, res) => {
  try {
    const displayName = cleanAdminText(req.body?.displayName || req.body?.display_name, 80);
    const role = String(req.body?.role || 'viewer').trim().toLowerCase();
    if (!displayName) return res.status(400).json({ success: false, error: 'Operator display name is required.' });
    if (!ADMIN_OPERATOR_ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: `Invalid operator role. Use one of: ${ADMIN_OPERATOR_ROLES.join(', ')}` });
    }

    const token = `crackl_adm_${crypto.randomBytes(24).toString('base64url')}`;
    const { data, error } = await supabase
      .from('admin_operators')
      .insert({
        display_name: displayName,
        role,
        token_hash: hashAdminToken(token),
        created_by: getAdminActorLabel(req)
      })
      .select('id, display_name, role, is_active, created_by, created_at, last_used_at')
      .single();
    if (error) throw error;

    await recordAdminAudit(req, {
      action: 'operator.create',
      entityType: 'admin_operator',
      entityId: data.id,
      metadata: { displayName, role }
    });
    res.json({ success: true, operator: data, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/admin/operators/:id', checkAdmin, requireAdminRole(['owner']), async (req, res) => {
  try {
    const updates = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'is_active')) {
      updates.is_active = normalizeBoolean(req.body.is_active, true);
    }
    if (req.body?.role) {
      const role = String(req.body.role).trim().toLowerCase();
      if (!ADMIN_OPERATOR_ROLES.includes(role)) {
        return res.status(400).json({ success: false, error: `Invalid operator role. Use one of: ${ADMIN_OPERATOR_ROLES.join(', ')}` });
      }
      updates.role = role;
    }
    if (req.body?.displayName || req.body?.display_name) {
      updates.display_name = cleanAdminText(req.body.displayName || req.body.display_name, 80);
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, error: 'No operator changes supplied.' });

    const { data, error } = await supabase
      .from('admin_operators')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, display_name, role, is_active, created_by, created_at, last_used_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Operator not found.' });

    await recordAdminAudit(req, {
      action: 'operator.update',
      entityType: 'admin_operator',
      entityId: req.params.id,
      metadata: { fields: Object.keys(updates) }
    });
    res.json({ success: true, operator: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/admin/analytics/summary', checkAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [
      userCount,
      openReports,
      openTickets,
      totalChallenges,
      historyRes,
      riddlesRes
    ] = await Promise.all([
      countRows('users'),
      countRows('user_riddle_reports', query => query.in('status', ['open', 'reviewing'])),
      countRows('support_tickets', query => query.in('status', ['open', 'in_progress'])),
      countRows('challenges'),
      supabase
        .from('user_riddle_history')
        .select('mode, status, time_taken_ms, attempted_at')
        .gte('attempted_at', since)
        .limit(10000),
      supabase
        .from('riddles')
        .select('id, game_mode, difficulty_tier, is_active, review_status')
        .limit(20000)
    ]);
    if (historyRes.error) throw historyRes.error;
    if (riddlesRes.error) throw riddlesRes.error;

    const history = historyRes.data || [];
    const riddles = riddlesRes.data || [];
    const byMode = {};
    const byStatus = {};
    history.forEach(row => {
      byMode[row.mode || 'unknown'] = (byMode[row.mode || 'unknown'] || 0) + 1;
      byStatus[row.status || 'unknown'] = (byStatus[row.status || 'unknown'] || 0) + 1;
    });
    const solved = history.filter(row => row.status === 'solved').length;
    const averageTimeMs = history.length
      ? Math.round(history.reduce((sum, row) => sum + (parseInt(row.time_taken_ms, 10) || 0), 0) / history.length)
      : 0;

    const inventory = {
      deliverable: riddles.filter(isDeliverableRiddle).length,
      draft: riddles.filter(row => row.review_status === 'draft').length,
      review: riddles.filter(row => row.review_status === 'review').length,
      archived: riddles.filter(row => row.review_status === 'archived' || row.is_active === false).length
    };

    res.json({
      success: true,
      windowDays: days,
      users: userCount,
      challenges: totalChallenges,
      openReports,
      openTickets,
      attempts: history.length,
      solved,
      accuracy: history.length ? Math.round((solved / history.length) * 100) : 0,
      averageTimeMs,
      byMode,
      byStatus,
      inventory
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/admin/reports', checkAdmin, requireAdminRole(ADMIN_SUPPORT_ROLES), async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 80));
    let query = supabase
      .from('user_riddle_reports')
      .select('id, user_id, riddle_id, reason, details, status, created_at, resolved_at, resolved_by')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (req.query.status) query = query.eq('status', String(req.query.status).slice(0, 40));
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, reports: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/admin/reports/:id', checkAdmin, requireAdminRole(ADMIN_SUPPORT_ROLES), async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim().toLowerCase();
    if (!VALID_REPORT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid report status. Use one of: ${VALID_REPORT_STATUSES.join(', ')}` });
    }
    const updates = { status };
    if (['resolved', 'dismissed'].includes(status)) {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = getAdminActorLabel(req);
    }

    const { data, error } = await supabase
      .from('user_riddle_reports')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, user_id, riddle_id, reason, details, status, created_at, resolved_at, resolved_by')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Report not found.' });

    await recordAdminAudit(req, {
      action: 'riddle_report.update',
      entityType: 'user_riddle_report',
      entityId: req.params.id,
      metadata: { status }
    });
    res.json({ success: true, report: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/admin/support-tickets', checkAdmin, requireAdminRole(ADMIN_SUPPORT_ROLES), async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 80));
    let query = supabase
      .from('support_tickets')
      .select('id, user_id, category, subject, message, status, priority, metadata, created_at, updated_at, resolved_at, resolved_by')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (req.query.status) query = query.eq('status', String(req.query.status).slice(0, 40));
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, tickets: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/admin/support-tickets/:id', checkAdmin, requireAdminRole(ADMIN_SUPPORT_ROLES), async (req, res) => {
  try {
    const updates = { updated_at: new Date().toISOString() };
    if (req.body?.status) {
      const status = String(req.body.status).trim().toLowerCase();
      if (!VALID_SUPPORT_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, error: `Invalid ticket status. Use one of: ${VALID_SUPPORT_STATUSES.join(', ')}` });
      }
      updates.status = status;
      if (['resolved', 'closed'].includes(status)) {
        updates.resolved_at = updates.updated_at;
        updates.resolved_by = getAdminActorLabel(req);
      }
    }
    if (req.body?.priority) {
      const priority = String(req.body.priority).trim().toLowerCase();
      if (!VALID_SUPPORT_PRIORITIES.includes(priority)) {
        return res.status(400).json({ success: false, error: `Invalid ticket priority. Use one of: ${VALID_SUPPORT_PRIORITIES.join(', ')}` });
      }
      updates.priority = priority;
    }
    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ success: false, error: 'No support ticket changes supplied.' });
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, user_id, category, subject, message, status, priority, metadata, created_at, updated_at, resolved_at, resolved_by')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Support ticket not found.' });

    await recordAdminAudit(req, {
      action: 'support_ticket.update',
      entityType: 'support_ticket',
      entityId: req.params.id,
      metadata: { fields: Object.keys(updates).filter(key => key !== 'updated_at') }
    });
    res.json({ success: true, ticket: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/admin/panic-timer', checkAdmin, requireAdminRole(ADMIN_MUTATION_ROLES), async (req, res) => {
  try {
    const raw = parseInt(req.body?.seconds, 10);
    if (!Number.isFinite(raw) || raw <= 0) {
      return res.status(400).json({ success: false, error: 'Timer must be a positive number of seconds.' });
    }
    await supabase
      .from('app_settings')
      .upsert({ key: 'panic_timer_seconds', value: String(raw) }, { onConflict: 'key' });
    await recordAdminAudit(req, {
      action: 'panic_timer.update',
      entityType: 'app_settings',
      entityId: 'panic_timer_seconds',
      metadata: { seconds: raw }
    });
    res.json({ success: true, panicTimerSeconds: raw });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Riddle pool health — per mode + difficulty breakdown
app.get('/admin/pool-health', checkAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const modes = ['mcq', 'type', 'arena', 'daily', 'gauntlet', 'chain', 'wager', 'bounty'];
    const difficulties = ['Easy', 'Medium', 'Hard'];

    const [riddlesRes, locksRes] = await Promise.all([
      supabase.from('riddles').select('id, game_mode, difficulty, difficulty_tier, is_active, is_onboarding, review_status'),
      supabase.from('riddle_daily_locks').select('riddle_id').eq('lock_date', today)
    ]);

    const riddles = riddlesRes.data || [];
    const lockedToday = new Set((locksRes.data || []).map(l => l.riddle_id));

    const grid = {};
    const tierGrid = {};
    modes.forEach(m => {
      grid[m] = {};
      tierGrid[m] = {};
      difficulties.forEach(d => {
        const active = riddles.filter(r => r.game_mode === m && r.difficulty === d && isDeliverableRiddle(r));
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
      [1, 2, 3, 4, 5].forEach(t => {
        const active = riddles.filter(r => (
          r.game_mode === m
          && isDeliverableRiddle(r)
          && (parseInt(r.difficulty_tier, 10) || getDifficultyTierFromLegacyDifficulty(r.difficulty)) === t
        ));
        const servedToday = active.filter(r => lockedToday.has(r.id)).length;
        const remaining = active.length - servedToday;
        tierGrid[m][t] = {
          total: active.length,
          servedToday,
          remaining,
          status: remaining < 5 ? 'LOW' : remaining < 15 ? 'WARNING' : 'OK'
        };
      });
    });

    res.json({ success: true, grid, tierGrid });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle maintenance mode
app.post('/admin/maintenance', checkAdmin, requireAdminRole(ADMIN_MUTATION_ROLES), async (req, res) => {
  try {
    const { on, message } = req.body;
    await supabase.from('app_settings').upsert({ key: 'maintenance_mode', value: on ? 'true' : 'false' }, { onConflict: 'key' });
    if (message) {
      await supabase.from('app_settings').upsert({ key: 'maintenance_message', value: message }, { onConflict: 'key' });
    }
    await recordAdminAudit(req, {
      action: 'maintenance.update',
      entityType: 'app_settings',
      entityId: 'maintenance_mode',
      metadata: { enabled: !!on, messageUpdated: !!message }
    });
    console.log(`🔧 Maintenance mode: ${on ? 'ON' : 'OFF'}`);
    res.json({ success: true, maintenanceMode: on });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get riddles — with filtering and pagination
app.get('/admin/riddles', checkAdmin, async (req, res) => {
  try {
    const { mode, difficulty, difficulty_tier, is_active, is_onboarding, review_status, type, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let query = supabase.from('riddles').select('*', { count: 'exact' }).order('created_at', { ascending: false });

    if (mode) query = query.eq('game_mode', mode);
    if (difficulty) query = query.eq('difficulty', difficulty);
    if (difficulty_tier) query = query.eq('difficulty_tier', Math.max(1, Math.min(5, parseInt(difficulty_tier, 10) || 1)));
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');
    if (is_onboarding !== undefined) query = query.eq('is_onboarding', is_onboarding === 'true');
    if (review_status) query = query.eq('review_status', String(review_status).slice(0, 40));
    if (type === 'image') query = query.in('riddle_type', ['image_text', 'image_only']);
    if (type === 'text') query = query.or('riddle_type.is.null,riddle_type.eq.text');
    if (search) {
      const safeSearch = String(search).replace(/[%,()]/g, ' ').trim().slice(0, 120);
      if (safeSearch) query = query.ilike('question', `%${safeSearch}%`);
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data: riddles, error, count } = await query;
    if (error) throw error;
    res.json({ success: true, riddles, total: count, page: pageNum, limit: limitNum });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add riddles — single or bulk, with per-riddle validation and report
const VALID_GAME_MODES = ['mcq', 'type', 'arena', 'daily', 'gauntlet', 'chain', 'wager', 'bounty'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const VALID_RIDDLE_TYPES = ['text', 'image_text', 'image_only', 'audio_text', 'video_text', 'interactive'];
const MEDIA_RIDDLE_TYPES = ['image_text', 'image_only', 'audio_text', 'video_text', 'interactive'];
const MAX_ADMIN_BULK_DELETE = 1000;

function normalizeRiddleIdList(ids) {
  const values = Array.isArray(ids) ? ids : [ids];
  const unique = [...new Set(values.map(id => String(id || '').trim()).filter(Boolean))];
  return unique.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
}

function incrementCount(entry, key) {
  if (!entry || !key) return;
  entry[key] = (entry[key] || 0) + 1;
}

async function fetchRowsOrEmpty(table, select, column, ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from(table).select(select).in(column, ids);
  if (error) {
    // Some old local DB snapshots may not have every auxiliary table yet.
    if (['42P01', '42703'].includes(error.code)) return [];
    throw error;
  }
  return data || [];
}

async function deleteWhereInOrIgnore(table, column, ids) {
  if (!ids.length) return;
  const { error } = await supabase.from(table).delete().in(column, ids);
  if (error && !['42P01', '42703'].includes(error.code)) throw error;
}

async function getRiddleDependencySummary(ids) {
  const summary = new Map(ids.map(id => [id, {
    history: 0,
    queues: 0,
    challenges: 0,
    reports: 0,
    rooms: 0,
    liveRooms: 0
  }]));

  const [historyRows, queueRows, challengeRows, reportRows, roomRows] = await Promise.all([
    fetchRowsOrEmpty('user_riddle_history', 'riddle_id', 'riddle_id', ids),
    fetchRowsOrEmpty('session_riddle_queue', 'riddle_id', 'riddle_id', ids),
    fetchRowsOrEmpty('challenges', 'riddle_id', 'riddle_id', ids),
    fetchRowsOrEmpty('user_riddle_reports', 'riddle_id', 'riddle_id', ids),
    fetchRowsOrEmpty('multiplayer_rooms', 'id,current_riddle_id,status', 'current_riddle_id', ids)
  ]);

  historyRows.forEach(row => incrementCount(summary.get(row.riddle_id), 'history'));
  queueRows.forEach(row => incrementCount(summary.get(row.riddle_id), 'queues'));
  challengeRows.forEach(row => incrementCount(summary.get(row.riddle_id), 'challenges'));
  reportRows.forEach(row => incrementCount(summary.get(row.riddle_id), 'reports'));
  roomRows.forEach(row => {
    const entry = summary.get(row.current_riddle_id);
    if (!entry) return;
    entry.rooms += 1;
    if (['active', 'playing'].includes(row.status)) entry.liveRooms += 1;
  });

  return summary;
}

function hasRiddleDependencies(summary) {
  return (summary.history + summary.queues + summary.challenges + summary.reports + summary.rooms) > 0;
}

async function deleteRiddlesByIds(ids, { purge = false, actorLabel = null } = {}) {
  const requestedIds = normalizeRiddleIdList(ids).slice(0, MAX_ADMIN_BULK_DELETE);
  if (!requestedIds.length) {
    return {
      requested: 0,
      found: 0,
      deleted: [],
      archived: [],
      skipped: [],
      notFound: [],
      purged: false
    };
  }

  const { data: existingRows, error: existingErr } = await supabase
    .from('riddles')
    .select('id, question')
    .in('id', requestedIds);
  if (existingErr) throw existingErr;

  const existingIds = (existingRows || []).map(row => row.id);
  const existingSet = new Set(existingIds);
  const notFound = requestedIds.filter(id => !existingSet.has(id));
  const dependencies = await getRiddleDependencySummary(existingIds);

  if (purge) {
    const blockedLive = existingIds.filter(id => (dependencies.get(id)?.liveRooms || 0) > 0);
    const purgeIds = existingIds.filter(id => !blockedLive.includes(id));

    await deleteWhereInOrIgnore('user_riddle_history', 'riddle_id', purgeIds);
    await deleteWhereInOrIgnore('session_riddle_queue', 'riddle_id', purgeIds);
    await deleteWhereInOrIgnore('riddle_daily_locks', 'riddle_id', purgeIds);
    await deleteWhereInOrIgnore('solved_riddles', 'riddle_id', purgeIds);
    await deleteWhereInOrIgnore('challenges', 'riddle_id', purgeIds);
    await deleteWhereInOrIgnore('user_riddle_reports', 'riddle_id', purgeIds);

    if (purgeIds.length) {
      const { error: roomErr } = await supabase
        .from('multiplayer_rooms')
        .update({ current_riddle_id: null })
        .in('current_riddle_id', purgeIds)
        .not('status', 'in', '(active,playing)');
      if (roomErr && !['42P01', '42703'].includes(roomErr.code)) throw roomErr;
    }

    if (purgeIds.length) {
      const { error: deleteErr } = await supabase.from('riddles').delete().in('id', purgeIds);
      if (deleteErr) throw deleteErr;
    }

    return {
      requested: requestedIds.length,
      found: existingIds.length,
      deleted: purgeIds,
      archived: [],
      skipped: blockedLive.map(id => ({
        id,
        reason: 'Riddle is currently attached to an active/playing room. End the room first, then purge.'
      })),
      notFound,
      purged: true
    };
  }

  const cleanIds = [];
  const archiveIds = [];
  existingIds.forEach(id => {
    const summary = dependencies.get(id) || {};
    if (hasRiddleDependencies(summary)) archiveIds.push(id);
    else cleanIds.push(id);
  });

  await deleteWhereInOrIgnore('riddle_daily_locks', 'riddle_id', cleanIds);
  await deleteWhereInOrIgnore('solved_riddles', 'riddle_id', cleanIds);

  if (cleanIds.length) {
    const { error: deleteErr } = await supabase.from('riddles').delete().in('id', cleanIds);
    if (deleteErr) throw deleteErr;
  }
  if (archiveIds.length) {
    const now = new Date().toISOString();
    const { error: archiveErr } = await supabase
      .from('riddles')
      .update({
        is_active: false,
        review_status: 'archived',
        archived_at: now,
        archived_by: actorLabel || 'admin'
      })
      .in('id', archiveIds);
    if (archiveErr) throw archiveErr;
  }

  return {
    requested: requestedIds.length,
    found: existingIds.length,
    deleted: cleanIds,
    archived: archiveIds,
    skipped: [],
    notFound,
    purged: false
  };
}

function parseAdminJsonField(value, fieldName) {
  if (value == null || value === '') return { value: null };
  if (typeof value !== 'string') return { value };
  try {
    return { value: JSON.parse(value) };
  } catch {
    return { error: `${fieldName} must be valid JSON when provided as text.` };
  }
}

function getAllowedMediaOrigins() {
  const origins = new Set(
    String(process.env.ALLOWED_MEDIA_ORIGINS || '')
      .split(',')
      .map(origin => origin.trim().replace(/\/$/, ''))
      .filter(Boolean)
  );

  try {
    if (process.env.SUPABASE_URL) origins.add(new URL(process.env.SUPABASE_URL).origin);
  } catch {}

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }

  return origins;
}

function normalizeStoredMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const allowedOrigins = getAllowedMediaOrigins();
    if (allowedOrigins.size && !allowedOrigins.has(parsed.origin)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function getRiddleMediaStoragePath(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const marker = '/storage/v1/object/public/riddle-media/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length)).replace(/^\/+/, '');
  } catch {
    return null;
  }
}

async function listRiddleMediaObjects(prefix = 'uploads') {
  const objects = [];
  const pageSize = 100;
  for (let offset = 0; offset < 5000; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from('riddle-media')
      .list(prefix, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    const page = data || [];
    page
      .filter(item => item?.name && item.id !== null)
      .forEach(item => objects.push({
        ...item,
        path: `${prefix.replace(/\/$/, '')}/${item.name}`
      }));
    if (page.length < pageSize) break;
  }
  return objects;
}

async function getOrphanRiddleMedia() {
  const [{ data: mediaRows, error: mediaErr }, objects] = await Promise.all([
    supabase.from('riddles').select('media_url').not('media_url', 'is', null),
    listRiddleMediaObjects('uploads')
  ]);
  if (mediaErr) throw mediaErr;
  const referenced = new Set((mediaRows || []).map(row => getRiddleMediaStoragePath(row.media_url)).filter(Boolean));
  const orphans = objects.filter(object => !referenced.has(object.path));
  return {
    totalObjects: objects.length,
    referencedCount: referenced.size,
    orphanCount: orphans.length,
    orphans
  };
}

app.get('/admin/storage/orphans', checkAdmin, async (req, res) => {
  try {
    const report = await getOrphanRiddleMedia();
    res.json({
      success: true,
      totalObjects: report.totalObjects,
      referencedCount: report.referencedCount,
      orphanCount: report.orphanCount,
      orphans: report.orphans.slice(0, 500).map(object => ({
        name: object.name,
        path: object.path,
        updated_at: object.updated_at,
        created_at: object.created_at,
        size: object.metadata?.size || null,
        mimetype: object.metadata?.mimetype || object.metadata?.contentType || null
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/admin/storage/orphans/delete', checkAdmin, requireAdminRole(ADMIN_MUTATION_ROLES), async (req, res) => {
  try {
    if (req.body?.confirm !== 'DELETE') {
      return res.status(400).json({ success: false, error: 'Type DELETE to confirm orphan media cleanup.' });
    }
    const limit = Math.min(500, Math.max(1, parseInt(req.body?.limit, 10) || 100));
    const report = await getOrphanRiddleMedia();
    const toDelete = report.orphans.slice(0, limit).map(object => object.path);
    if (toDelete.length) {
      const { error } = await supabase.storage.from('riddle-media').remove(toDelete);
      if (error) throw error;
    }
    await recordAdminAudit(req, {
      action: 'storage.orphans.delete',
      entityType: 'storage',
      entityId: 'riddle-media',
      metadata: { deletedCount: toDelete.length, totalOrphans: report.orphanCount, paths: toDelete }
    });
    res.json({ success: true, deletedCount: toDelete.length, totalOrphans: report.orphanCount, deleted: toDelete });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/admin/riddle/add', checkAdmin, requireAdminRole(ADMIN_MUTATION_ROLES), async (req, res) => {
  try {
    const { riddles } = req.body;
    const riddlesArray = Array.isArray(riddles) ? riddles : [riddles];
    const actorLabel = getAdminActorLabel(req);
    const { data: existingRiddles } = await supabase
      .from('riddles')
      .select('id, question, answer, game_mode');
    const duplicateCorpus = (existingRiddles || []).map(buildComparableRiddleShape);

    const results = [];
    const toInsert = [];

    for (let i = 0; i < riddlesArray.length; i++) {
      const r = riddlesArray[i];
      const riddleType = r.riddle_type || 'text';
      const questionOptional = ['image_only', 'interactive'].includes(riddleType);
      if ((!r.question && !questionOptional) || !r.answer || !r.game_mode || !r.difficulty) {
        results.push({ index: i, success: false, error: 'Missing required fields: question, answer, game_mode, difficulty' });
        continue;
      }
      if (!VALID_GAME_MODES.includes(r.game_mode)) {
        results.push({ index: i, success: false, error: `Invalid game_mode "${r.game_mode}". Must be one of: ${VALID_GAME_MODES.join(', ')}` });
        continue;
      }
      if (!VALID_DIFFICULTIES.includes(r.difficulty)) {
        results.push({ index: i, success: false, error: `Invalid difficulty "${r.difficulty}". Must be Easy, Medium, or Hard` });
        continue;
      }
      if (!VALID_RIDDLE_TYPES.includes(riddleType)) {
        results.push({ index: i, success: false, error: `Invalid riddle_type "${riddleType}". Must be one of: ${VALID_RIDDLE_TYPES.join(', ')}` });
        continue;
      }
      const reviewStatus = normalizeReviewStatus(r.review_status ?? (r.is_active === false ? 'archived' : 'approved'), 'approved');
      if (!reviewStatus) {
        results.push({ index: i, success: false, error: `Invalid review_status "${r.review_status}". Must be one of: ${VALID_REVIEW_STATUSES.join(', ')}` });
        continue;
      }
      const activeOverride = Object.prototype.hasOwnProperty.call(r, 'is_active')
        ? normalizeBoolean(r.is_active, true)
        : undefined;
      if (MEDIA_RIDDLE_TYPES.includes(riddleType) && !r.media_url) {
        results.push({ index: i, success: false, error: `${riddleType} riddles require a media_url from the admin uploader.` });
        continue;
      }
      const mediaUrl = normalizeStoredMediaUrl(r.media_url);
      if (r.media_url && !mediaUrl) {
        results.push({ index: i, success: false, error: 'media_url must be a valid http(s) URL from the admin uploader.' });
        continue;
      }
      const parsedOptions = parseAdminJsonField(r.options, 'options');
      if (parsedOptions.error) {
        results.push({ index: i, success: false, error: parsedOptions.error });
        continue;
      }
      const parsedLayout = parseAdminJsonField(r.layout_config, 'layout_config');
      if (parsedLayout.error) {
        results.push({ index: i, success: false, error: parsedLayout.error });
        continue;
      }
      const options = parsedOptions.value;
      if (options != null && !Array.isArray(options)) {
        results.push({ index: i, success: false, error: 'options must be an array when provided.' });
        continue;
      }
      const layoutConfig = parsedLayout.value;
      if (layoutConfig != null && (typeof layoutConfig !== 'object' || Array.isArray(layoutConfig))) {
        results.push({ index: i, success: false, error: 'layout_config must be an object when provided.' });
        continue;
      }
      const difficultyTier = Math.max(1, Math.min(5, parseInt(r.difficulty_tier, 10) || getDifficultyTierFromLegacyDifficulty(r.difficulty)));
      const semanticEnabled = Object.prototype.hasOwnProperty.call(r, 'semantic_check_enabled')
        ? normalizeBoolean(r.semantic_check_enabled, false)
        : false;
      const candidatePayload = {
        question: r.question || (riddleType === 'image_only' ? '[Visual Riddle]' : '[Interactive Riddle]'),
        answer: r.answer,
        options: options || null,
        category: r.category || 'General',
        difficulty: r.difficulty,
        difficulty_tier: difficultyTier,
        region: r.region || 'IN',
        game_mode: r.game_mode,
        hint: r.hint || null,
        fun_fact: r.fun_fact || null,
        explanation: r.explanation || null,
        family_id: r.family_id || null,
        parent_riddle_id: r.parent_riddle_id || null,
        panic_time: r.panic_time || null,
        is_onboarding: r.is_onboarding === true,
        version: 1,
        times_served: 0,
        riddle_type: riddleType,
        media_url: mediaUrl,
        layout_config: layoutConfig || null,
        semantic_check_enabled: semanticEnabled,
        answer_strictness: normalizeStrictness(r.answer_strictness),
        accepted_aliases: normalizeStringArray(r.accepted_aliases || r.acceptedAliases),
        required_keywords: normalizeStringArray(r.required_keywords || r.requiredKeywords),
        forbidden_meanings: normalizeStringArray(r.forbidden_meanings || r.forbiddenMeanings),
        answer_rubric: cleanAdminText(r.answer_rubric || r.answerRubric, 1500) || null,
      };
      applyRiddleReviewState(candidatePayload, reviewStatus, actorLabel, new Date().toISOString(), activeOverride);
      const duplicate = findPotentialDuplicateRiddle(candidatePayload, duplicateCorpus);
      if (duplicate) {
        results.push({
          index: i,
          success: false,
          error: `Potential duplicate detected (${duplicate.reason}) against existing riddle ${duplicate.id}. Review before uploading.`,
          duplicateOf: duplicate.id,
          similarity: Number(duplicate.score.toFixed(2))
        });
        continue;
      }
      duplicateCorpus.push(buildComparableRiddleShape(candidatePayload));
      toInsert.push({
        index: i,
        data: candidatePayload
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

    await recordAdminAudit(req, {
      action: 'riddles.add',
      entityType: 'riddle',
      metadata: {
        requested: riddlesArray.length,
        added,
        failed,
        insertedIds: results.filter(r => r.success).map(r => r.id)
      }
    });
    console.log(`👑 Admin uploaded riddles: ${added} added, ${failed} failed`);
    res.json({ success: true, added, failed, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a riddle
app.put('/admin/riddle/:id', checkAdmin, requireAdminRole(ADMIN_MUTATION_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = new Set([
      'question', 'answer', 'game_mode', 'difficulty', 'difficulty_tier', 'region',
      'options', 'hint', 'category', 'fun_fact', 'explanation', 'family_id',
      'parent_riddle_id', 'panic_time', 'is_onboarding', 'is_active', 'review_status',
      'riddle_type', 'media_url', 'layout_config', 'semantic_check_enabled',
      'answer_strictness', 'accepted_aliases', 'required_keywords', 'forbidden_meanings',
      'answer_rubric'
    ]);
    const updates = {};
    Object.entries(req.body || {}).forEach(([key, value]) => {
      if (allowedFields.has(key)) updates[key] = value;
    });
    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, error: 'No riddle changes supplied.' });
    if (updates.game_mode && !VALID_GAME_MODES.includes(updates.game_mode)) {
      return res.status(400).json({ success: false, error: `Invalid game_mode "${updates.game_mode}".` });
    }
    if (updates.difficulty && !VALID_DIFFICULTIES.includes(updates.difficulty)) {
      return res.status(400).json({ success: false, error: `Invalid difficulty "${updates.difficulty}".` });
    }
    if (updates.riddle_type && !VALID_RIDDLE_TYPES.includes(updates.riddle_type)) {
      return res.status(400).json({ success: false, error: `Invalid riddle_type "${updates.riddle_type}".` });
    }
    if (updates.media_url) {
      const mediaUrl = normalizeStoredMediaUrl(updates.media_url);
      if (!mediaUrl) return res.status(400).json({ success: false, error: 'media_url must be a valid http(s) URL.' });
      updates.media_url = mediaUrl;
    }
    if (updates.difficulty_tier != null) {
      updates.difficulty_tier = Math.max(1, Math.min(5, parseInt(updates.difficulty_tier, 10) || 1));
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'is_active')) {
      updates.is_active = normalizeBoolean(updates.is_active, true);
    }
    if (updates.review_status != null) {
      const reviewStatus = normalizeReviewStatus(updates.review_status, null);
      if (!reviewStatus) {
        return res.status(400).json({ success: false, error: `Invalid review_status "${updates.review_status}".` });
      }
      updates.review_status = reviewStatus;
    }
    if (updates.options != null && !Array.isArray(updates.options)) {
      return res.status(400).json({ success: false, error: 'options must be an array when provided.' });
    }
    if (updates.layout_config != null && (typeof updates.layout_config !== 'object' || Array.isArray(updates.layout_config))) {
      return res.status(400).json({ success: false, error: 'layout_config must be an object when provided.' });
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'semantic_check_enabled')) {
      updates.semantic_check_enabled = normalizeBoolean(updates.semantic_check_enabled, true);
    }
    if (updates.answer_strictness != null) {
      updates.answer_strictness = normalizeStrictness(updates.answer_strictness);
    }
    ['accepted_aliases', 'required_keywords', 'forbidden_meanings'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        updates[field] = normalizeStringArray(updates[field]);
      }
    });
    if (Object.prototype.hasOwnProperty.call(updates, 'answer_rubric')) {
      updates.answer_rubric = cleanAdminText(updates.answer_rubric, 1500) || null;
    }
    if (updates.parent_riddle_id === '') updates.parent_riddle_id = null;

    const { data: current, error: currentErr } = await supabase
      .from('riddles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (currentErr) throw currentErr;
    if (!current) return res.status(404).json({ success: false, error: 'Riddle not found.' });

    const actorLabel = getAdminActorLabel(req);
    if (updates.review_status) {
      const activeOverride = Object.prototype.hasOwnProperty.call(updates, 'is_active') ? updates.is_active : undefined;
      applyRiddleReviewState(updates, updates.review_status, actorLabel, new Date().toISOString(), activeOverride);
    } else if (updates.is_active === true && current.review_status && current.review_status !== 'approved') {
      applyRiddleReviewState(updates, 'approved', actorLabel, new Date().toISOString(), true);
    }
    updates.version = (parseInt(current.version, 10) || 1) + 1;

    const { error: versionErr } = await supabase
      .from('riddle_versions')
      .insert({
        riddle_id: id,
        version: parseInt(current.version, 10) || 1,
        snapshot: current,
        changed_by: actorLabel,
        change_reason: cleanAdminText(req.body?.change_reason, 300) || null
      });
    if (versionErr && !['42P01', '42703'].includes(versionErr.code)) throw versionErr;

    const { data, error } = await supabase.from('riddles').update(updates).eq('id', id).select().single();
    if (error) throw error;
    await recordAdminAudit(req, {
      action: 'riddle.update',
      entityType: 'riddle',
      entityId: id,
      metadata: { fields: Object.keys(updates) }
    });
    res.json({ success: true, riddle: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk delete riddles.
// Safe mode archives referenced riddles; purge mode removes dependent history/queues/challenges
// and refuses to touch riddles currently attached to active gameplay rooms.
app.post('/admin/riddles/delete', checkAdmin, requireAdminRole(ADMIN_MUTATION_ROLES), async (req, res) => {
  try {
    const { ids, purge = false } = req.body || {};
    const requestedIds = normalizeRiddleIdList(ids);
    if (!requestedIds.length) {
      return res.status(400).json({ success: false, error: 'Select at least one valid riddle id.' });
    }
    if (requestedIds.length > MAX_ADMIN_BULK_DELETE) {
      return res.status(400).json({ success: false, error: `Bulk delete is capped at ${MAX_ADMIN_BULK_DELETE} riddles per request.` });
    }

    const result = await deleteRiddlesByIds(requestedIds, { purge: !!purge, actorLabel: getAdminActorLabel(req) });
    const action = result.purged ? 'purged' : 'processed';
    await recordAdminAudit(req, {
      action: result.purged ? 'riddles.purge' : 'riddles.delete',
      entityType: 'riddle',
      metadata: {
        requested: result.requested,
        found: result.found,
        deleted: result.deleted.length,
        archived: result.archived.length,
        skipped: result.skipped.length,
        ids: requestedIds
      }
    });
    console.log(`🗑️ Admin bulk riddle delete: ${action} ${result.deleted.length}, archived ${result.archived.length}, skipped ${result.skipped.length}`);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a riddle — archive if it has ever touched live user/session/challenge data.
app.delete('/admin/riddle/:id', checkAdmin, requireAdminRole(ADMIN_MUTATION_ROLES), async (req, res) => {
  try {
    const result = await deleteRiddlesByIds([req.params.id], { purge: req.query.purge === 'true', actorLabel: getAdminActorLabel(req) });
    const archived = result.archived.length > 0;
    const deleted = result.deleted.length > 0;
    const skipped = result.skipped.length > 0;
    if (!deleted && !archived && !skipped) return res.status(404).json({ success: false, error: 'Riddle not found.' });
    await recordAdminAudit(req, {
      action: req.query.purge === 'true' ? 'riddle.purge' : 'riddle.delete',
      entityType: 'riddle',
      entityId: req.params.id,
      metadata: { deleted, archived, skipped }
    });
    res.json({
      success: true,
      archived,
      deleted,
      skipped,
      message: skipped
        ? result.skipped[0].reason
        : archived
          ? `Riddle ${req.params.id} was archived instead of deleted because it has live history, session, or challenge references.`
          : `Deleted riddle ${req.params.id}`,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload media for riddles — saves to Supabase Storage
app.post('/admin/upload', checkAdmin, requireAdminRole(ADMIN_MUTATION_ROLES), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const ext = (path.extname(req.file.originalname) || '.png').toLowerCase();
    const interactiveExts = ['.html', '.htm', '.json', '.txt', '.js'];
    const interactiveByExt = interactiveExts.includes(ext);
    const allowedMime = /^(image|audio|video)\//.test(req.file.mimetype)
      || ['application/json', 'text/html', 'text/plain', 'application/javascript', 'text/javascript'].includes(req.file.mimetype)
      || interactiveByExt;
    if (!allowedMime) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported media type. Upload an image, audio, video, HTML, JSON, or plain text interactive asset.'
      });
    }

    const contentType = req.file.mimetype === 'application/octet-stream' && interactiveByExt
      ? (ext === '.html' || ext === '.htm' ? 'text/html' : ext === '.json' ? 'application/json' : ext === '.js' ? 'text/javascript' : 'text/plain')
      : req.file.mimetype;
    const fileName = `riddle_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    const filePath = `uploads/${fileName}`;

    const { data, error } = await supabase.storage
      .from('riddle-media')
      .upload(filePath, req.file.buffer, {
        contentType,
        upsert: false
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('riddle-media')
      .getPublicUrl(filePath);

    const mediaKind = contentType.startsWith('audio/')
      ? 'audio'
      : contentType.startsWith('video/')
        ? 'video'
        : contentType.startsWith('image/')
          ? 'image'
          : 'interactive';

    console.log(`📸 Media uploaded: ${fileName}`);
    await recordAdminAudit(req, {
      action: 'media.upload',
      entityType: 'storage',
      entityId: filePath,
      metadata: {
        mediaKind,
        mimeType: contentType,
        size: req.file.size,
        originalExt: ext
      }
    });
    res.json({ success: true, url: urlData.publicUrl, path: filePath, mediaKind, mimeType: contentType });
  } catch (error) {
    console.error('❌ /admin/upload:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/admin/image-assets', checkAdmin, requireAdminRole(ADMIN_MUTATION_ROLES), async (req, res) => {
  try {
    const body = req.body || {};
    const originalImageUrl = normalizeStoredMediaUrl(body.original_image_url || body.originalImageUrl);
    const finalImageUrl = normalizeStoredMediaUrl(body.final_image_url || body.finalImageUrl);
    const rawWidth = parseInt(body.width, 10);
    const rawHeight = parseInt(body.height, 10);
    const width = Math.max(1, Math.min(8192, rawWidth || 0));
    const height = Math.max(1, Math.min(8192, rawHeight || 0));
    const rotation = Number.isFinite(Number(body.rotation)) ? Number(body.rotation) : 0;
    const orientation = ['portrait', 'landscape', 'square'].includes(body.orientation) ? body.orientation : (
      width === height ? 'square' : width > height ? 'landscape' : 'portrait'
    );
    const fileSize = Math.max(0, parseInt(body.file_size || body.fileSize, 10) || 0);
    const crop = body.crop && typeof body.crop === 'object' && !Array.isArray(body.crop) ? body.crop : {};
    const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {};

    if (!originalImageUrl || !finalImageUrl) {
      return res.status(400).json({ success: false, error: 'original_image_url and final_image_url must be valid admin media URLs.' });
    }
    if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight) || rawWidth <= 0 || rawHeight <= 0) {
      return res.status(400).json({ success: false, error: 'Edited image width and height are required.' });
    }

    const payload = {
      original_image_url: originalImageUrl,
      final_image_url: finalImageUrl,
      width,
      height,
      rotation,
      crop,
      orientation,
      file_size: fileSize,
      uploaded_by: cleanAdminText(body.uploaded_by || getAdminActorLabel(req), 120),
      metadata,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('admin_image_assets')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;

    await recordAdminAudit(req, {
      action: 'image_asset.create',
      entityType: 'image_asset',
      entityId: data.id,
      metadata: {
        width,
        height,
        orientation,
        finalImageUrl,
        originalImageUrl,
        fileSize
      }
    });

    res.json({ success: true, asset: data });
  } catch (error) {
    console.error('❌ /admin/image-assets:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================
// 🎯 RIDDLE ENDPOINT
// ============================
async function buildRiddleDelivery({ userId, xp, totalPlayed, requestedMode = 'arena', sessionId = null, panicMode = false }) {
  const { riddle, tier } = await fetchNextRiddleFromEngine({
    userId,
    xp,
    totalPlayed,
    requestedMode,
    sessionId
  });

  if (!riddle) {
    return { success: false, tier, error: 'Pool exhausted — new riddles coming soon' };
  }

  const timeLimit = panicMode ? await resolveRiddlePanicTimerSeconds(riddle) : null;
  return {
    success: true,
    tier,
    riddle: serializeRiddlePayload(riddle, timeLimit)
  };
}

async function buildDailyDelivery({ userId, xp = 0, panicMode = false }) {
  if (!userId) {
    return { success: false, statusCode: 400, error: 'Missing userId' };
  }

  const today = new Date().toISOString().split('T')[0];
  const dayStartIso = new Date(`${today}T00:00:00.000Z`).toISOString();
  const { data: user } = await supabase.from('users').select('last_daily_date').eq('id', userId).maybeSingle();

  if (user && user.last_daily_date === today) {
    const { data: existingDaily } = await supabase
      .from('user_riddle_history')
      .select('riddle_id, status, attempted_at')
      .eq('user_id', userId)
      .eq('mode', 'daily')
      .gte('attempted_at', dayStartIso)
      .order('attempted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDaily?.riddle_id && existingDaily.status === 'served') {
      const resumeRiddle = await fetchSafeRiddleById(existingDaily.riddle_id, 'daily');
      if (resumeRiddle) {
        const timeLimit = panicMode ? await resolveRiddlePanicTimerSeconds(resumeRiddle) : null;
        return {
          success: true,
          resumed: true,
          riddle: serializeRiddlePayload(resumeRiddle, timeLimit),
          tier: resumeRiddle.difficulty_tier || null
        };
      }
    }

    return {
      success: false,
      alreadyPlayed: true,
      statusCode: 200,
      message: 'Come back tomorrow for your next Daily Drop!'
    };
  }

  const progress = await getUserProgressProfile(userId);
  const delivery = await buildRiddleDelivery({
    userId,
    xp: Number.isFinite(parseInt(xp, 10)) ? parseInt(xp, 10) : progress.xp,
    totalPlayed: progress.totalPlayed,
    requestedMode: 'daily',
    panicMode: !!panicMode
  });

  if (!delivery.success) {
    return {
      success: false,
      statusCode: 404,
      error: 'No Daily riddles available today. Admin needs to add more Daily riddles.'
    };
  }

  await supabase.from('users').update({ last_daily_date: today }).eq('id', userId);
  return {
    success: true,
    riddle: delivery.riddle,
    tier: delivery.tier
  };
}

app.get('/api/riddles/next', authenticateToken, checkMaintenance, async (req, res) => {
  try {
    const requestedMode = req.query.mode || 'arena';
    const sessionId = req.query.session_id || null;
    const panicMode = req.query.panicMode === 'true';
    const userId = req.user.id;

    if (requestedMode === 'daily') {
      const dailyDelivery = await buildDailyDelivery({ userId, panicMode });
      if (dailyDelivery.alreadyPlayed) {
        return res.status(200).json({
          success: false,
          alreadyPlayed: true,
          message: dailyDelivery.message
        });
      }
      if (!dailyDelivery.success) {
        return res.status(dailyDelivery.statusCode || 404).json({
          success: false,
          riddlesExhausted: true,
          error: dailyDelivery.error
        });
      }
      return res.json({
        success: true,
        resumed: !!dailyDelivery.resumed,
        riddle: dailyDelivery.riddle,
        difficultyTier: dailyDelivery.tier
      });
    }

    const progress = await getUserProgressProfile(userId);
    const delivery = await buildRiddleDelivery({
      userId,
      xp: progress.xp,
      totalPlayed: progress.totalPlayed,
      requestedMode,
      sessionId,
      panicMode
    });

    if (!delivery.success) {
      return res.status(404).json({
        success: false,
        riddlesExhausted: true,
        message: delivery.error
      });
    }

    res.json({ success: true, riddle: delivery.riddle, difficultyTier: delivery.tier });
  } catch (error) {
    console.error('❌ /api/riddles/next:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/riddle', authenticateToken, checkMaintenance, async (req, res) => {
  try {
    const { xp, mode, panicMode, sessionId } = req.body;
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing required payload parameters: userId' });
    }
    const requestedMode = mode || 'arena';
    const progress = await getUserProgressProfile(userId);
    const delivery = await buildRiddleDelivery({
      userId,
      xp: Number.isFinite(parseInt(xp, 10)) ? parseInt(xp, 10) : progress.xp,
      totalPlayed: progress.totalPlayed,
      requestedMode,
      sessionId: sessionId || null,
      panicMode: !!panicMode
    });

    if (!delivery.success) {
      return res.json({ success: false, riddlesExhausted: true, error: delivery.error });
    }

    console.log(`📘 RDE Served | User: ${userId} | Mode: ${requestedMode} | Tier: ${delivery.tier} | Riddle: ${delivery.riddle.id}`);
    res.json({ success: true, riddle: delivery.riddle, difficultyTier: delivery.tier });
  } catch (error) {
    console.error('❌ /riddle:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================
// 📝 ANSWER SUBMISSION
// ============================
app.post('/answer', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const actorId = resolveAuthenticatedActorId(req, body.userId);
    const { riddleId, userAnswer, timeTaken, mode, gameMode, panicMode } = body;
    const userId = actorId;
    if (!userId || !riddleId) {
      return res.status(400).json({ success: false, error: 'Missing required payload parameters: userId, riddleId' });
    }
    const effectiveGameMode = gameMode || mode || 'arena';
    const servedHistory = await resolveServedRiddleGuard({ userId, riddleId, mode: effectiveGameMode });
    console.log(`\n📝 Answer | riddleId: ${riddleId} | mode: ${effectiveGameMode}`);

    const riddle = await fetchProtectedRiddleRecord(riddleId, PROTECTED_ANSWER_FIELDS);
    if (!riddle) throw new Error('Riddle not found');
    const timing = await resolvePanicSubmissionState({
      panicMode: !!panicMode,
      userId,
      riddleId,
      clientTimeTaken: timeTaken,
      limitSeconds: panicMode ? await resolveRiddlePanicTimerSeconds(riddle) : null
    });

    let isCorrect = false;
    let answerJudgment = null;
    const usesTypedInput = mode === 'type' || effectiveGameMode === 'type' || !Array.isArray(riddle.options) || riddle.options.length < 2;
    if (usesTypedInput) {
      answerJudgment = await judgeTypedAnswer({ userId, riddle, userAnswer, mode: effectiveGameMode });
      isCorrect = answerJudgment.isCorrect === true;
    } else {
      isCorrect = isAnswerCorrect(userAnswer, riddle.answer, riddle.options);
    }
    if (timing.isLate || userAnswer === '__timeout__') {
      isCorrect = false;
    }
    console.log(`${isCorrect ? '✅ CORRECT' : '❌ WRONG'} | Mode: ${effectiveGameMode}`);

    const elapsed = timing.elapsedSeconds;
    const hasTimedSubmission = elapsed > 0;
    const resolutionStatus = isCorrect ? 'solved' : ((userAnswer === '__timeout__' || timing.isLate) ? 'timed_out' : 'failed');
    await claimRiddleResolutionOnce({
      userId,
      riddleId,
      mode: effectiveGameMode,
      status: resolutionStatus,
      timeTakenMs: hasTimedSubmission ? elapsed * 1000 : null
    });

    const isWagerMode = effectiveGameMode === 'wager' || mode === 'wager';
    const rewardDifficulty = getRewardDifficultyLabel(riddle);
    const baseCoins = rewardDifficulty === 'Easy' ? 10 : rewardDifficulty === 'Medium' ? 25 : 50;
    const modeMultiplier = mode === 'type' ? 1.5 : 1;
    const baseReward = isCorrect ? Math.round(baseCoins * modeMultiplier) : 0;
    let coinsChange = isCorrect ? baseReward : -5;
    let speedBonus = 0;
    if (isCorrect && hasTimedSubmission && elapsed < 10) speedBonus = 20;
    else if (isCorrect && hasTimedSubmission && elapsed < 15) speedBonus = 10;
    coinsChange += speedBonus;
    const panicBonus = isCorrect && panicMode && !isWagerMode ? getPanicIntelBonus({ gameMode: effectiveGameMode, rewardBasis: baseReward }) : 0;
    coinsChange += panicBonus;
    if (isWagerMode) coinsChange = 0;

    const xpGain = isCorrect ? (rewardDifficulty === 'Easy' ? 5 : rewardDifficulty === 'Medium' ? 15 : 30) : 2;
    let newCoins = 100;
	    const streakEnabled = effectiveGameMode !== 'daily' && effectiveGameMode !== 'ranked' && !isWagerMode;
    let newStreak = streakEnabled && isCorrect ? 1 : 0;
    let newXp = xpGain;
    let newLevel = 'Novice';
    let leveledUp = false;
    let streakBonus = false;

    let ranked = null;
    try {
      // Read user for streak calculation + leaderboard info (read-only, no write here)
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('id, coins, streak, username, city, xp, level, total_played, total_correct')
        .eq('id', userId)
        .single();

      if (!userErr && user) {
        if (streakEnabled) {
          newStreak = isCorrect ? (parseInt(user.streak) || 0) + 1 : 0;
          if (isCorrect && newStreak > 0 && newStreak % 5 === 0) { coinsChange += 100; streakBonus = true; }
        } else {
          newStreak = parseInt(user.streak) || 0;
        }

        // ATOMIC update via Supabase RPC — no race conditions
        const { data: rpcResult, error: rpcErr } = await supabase.rpc('increment_user_stats', {
          p_user_id: userId,
          p_coins_delta: coinsChange,
          p_xp_delta: xpGain,
          p_streak: streakEnabled ? newStreak : (parseInt(user.streak) || 0),
          p_played_delta: 1,
          p_correct_delta: isCorrect ? 1 : 0
        });

        if (!rpcErr && rpcResult && rpcResult.length > 0) {
          const r = rpcResult[0];
          newCoins = r.new_coins;
          newXp = r.new_xp;
          newLevel = r.new_level;
          leveledUp = newLevel !== user.level;
        } else {
          // Fallback if RPC not yet deployed — use old method
          console.warn('⚠️ RPC fallback:', rpcErr?.message);
          const currentCoins = parseInt(user.coins) || 0;
          newXp = (parseInt(user.xp) || 0) + xpGain;
          newLevel = calculateLevel(newXp);
          leveledUp = newLevel !== user.level;
          newCoins = Math.max(0, currentCoins + coinsChange);
          await supabase.from('users').update({
            coins: newCoins, streak: newStreak, xp: newXp, level: newLevel,
            total_played: (parseInt(user.total_played) || 0) + 1,
            total_correct: (parseInt(user.total_correct) || 0) + (isCorrect ? 1 : 0)
          }).eq('id', userId);
        }

        await supabase.from('leaderboard').upsert({
          user_id: userId, username: user.username, city: user.city,
          coins: newCoins, week_start: getCurrentWeekStartDate(), updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,week_start' });

        console.log(`💰 Coins: ${user.coins} → ${newCoins} (${coinsChange > 0 ? '+' : ''}${coinsChange})`);

	        if (effectiveGameMode === 'ranked') {
          try {
            const { data: existingRank } = await supabase
              .from('ranked_profiles')
              .select('*')
              .eq('user_id', userId)
              .single();

            const startRating = existingRank?.rating ?? 1000;
            const delta = getRankDelta({ isCorrect, difficulty: riddle.difficulty, timeTaken });
            const rating = Math.max(0, startRating + delta);
            const wins = (existingRank?.wins || 0) + (isCorrect ? 1 : 0);
            const losses = (existingRank?.losses || 0) + (isCorrect ? 0 : 1);
            const matchesPlayed = (existingRank?.matches_played || 0) + 1;
            const bestRating = Math.max(existingRank?.best_rating || startRating, rating);
            const tier = getRankTier(rating);

            await supabase.from('ranked_profiles').upsert({
              user_id: userId,
              username: user.username,
              city: user.city,
              rating,
              tier,
              wins,
              losses,
              matches_played: matchesPlayed,
              best_rating: bestRating,
              last_delta: delta,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

            ranked = { rating, delta, tier, wins, losses, matchesPlayed, bestRating };
          } catch (rankErr) {
            console.warn('⚠️ ranked profile update failed:', rankErr.message);
          }
        }
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

    res.json({
      success: true,
      isCorrect,
      correctAnswer: riddle.answer,
      explanation: riddle.explanation || null,
      fun_fact: riddle.fun_fact || null,
      coinsChange,
      speedBonus,
      panicBonus,
      newTotal: newCoins,
      streakCount: newStreak,
      xpGained: xpGain,
      newXp,
      newLevel,
      leveledUp,
      streakBonus,
      ranked,
      answerJudgment: answerJudgment ? {
        source: answerJudgment.source,
        confidence: answerJudgment.confidence,
        semanticUsed: !!answerJudgment.semanticUsed
      } : null
    });

  } catch (error) {
    console.error('❌ /answer:', error.message);
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

// ============================
// 🔐 AUTH ROUTES
// ============================

app.post('/auth/check-username', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    if (!username) return res.json({ success: false, error: 'Username required' });
    if (!USERNAME_PATTERN.test(username)) {
      return res.json({ success: true, available: false, error: 'Use 3-32 letters, numbers, and underscores only.' });
    }
    const { data } = await supabase.from('users').select('id').ilike('username', username).maybeSingle();
    res.json({ success: true, available: !data });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/auth/signup', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const college = String(req.body.college || 'Other').trim().slice(0, 160) || 'Other';
    const { password, legalAccepted } = req.body;
    if (!username || !email || !password) return res.status(400).json({ success: false, error: 'All fields required' });
    if (legalAccepted !== true) return res.status(400).json({ success: false, error: 'Accept the Terms, Privacy, Fair Play, and Rewards rules to create an account.' });
    if (!USERNAME_PATTERN.test(username)) return res.status(400).json({ success: false, error: 'Username can use 3-32 letters, numbers, and underscores only.' });
    if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ success: false, error: 'Valid email required' });
    if (String(password).length < 8 || String(password).length > 128) return res.status(400).json({ success: false, error: 'Password must be 8-128 characters.' });

    const [existingEmail, existingUsername] = await Promise.all([
      supabase.from('users').select('id').eq('email', email).maybeSingle(),
      supabase.from('users').select('id').ilike('username', username).maybeSingle()
    ]);
    if (existingEmail.error) throw existingEmail.error;
    if (existingUsername.error) throw existingUsername.error;
    if (existingEmail.data || existingUsername.data) {
      return res.status(400).json({ success: false, error: 'Email or Username already in use' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const { data, error } = await supabase.from('users')
      .insert({ username, email, college, password_hash: passwordHash, is_verified: true, coins: 100, streak: 0, level: 'Novice', xp: 0, total_played: 0, total_correct: 0, city: 'Global', area: 'Arena', is_admin: false })
      .select('id, username, email, college, coins, streak, level, xp, is_admin, total_played, total_correct, city, area').single();

    if (error || !data) throw new Error(error ? error.message : 'Database error: no data returned from signup insert');

    const { error: legalError } = await supabase.from('legal_acceptances').insert({
      user_id: data.id,
      policy_version: LEGAL_POLICY_VERSION,
      terms_version: LEGAL_POLICY_VERSION,
      privacy_version: LEGAL_POLICY_VERSION,
      fair_play_version: LEGAL_POLICY_VERSION,
      rewards_version: LEGAL_POLICY_VERSION,
      source: 'signup',
      ip_hash: hashClientIp(req),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
      metadata: {
        route: '/auth/signup',
        accepted_client_version: String(req.body.legalVersion || LEGAL_POLICY_VERSION).slice(0, 40)
      }
    });

    if (legalError) {
      console.error('Legal acceptance insert failed during signup:', legalError.message);
      await supabase.from('users').delete().eq('id', data.id);
      throw new Error('Could not record legal acceptance. Please try again.');
    }

    const token = issueAuthToken(data);
    console.log(`👤 New User Signed Up: ${data.username}`);
    res.json({ success: true, user: stripPrivateUserFields(data), token });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
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
      .select('id, username, email, coins, streak, level, xp, is_admin, total_played, total_correct, city, area').single();

    if (error || !data) throw new Error(error ? error.message : 'Database error: verify user not found');

    const token = issueAuthToken(data);
    res.json({ success: true, user: data, token });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/auth/login', async (req, res) => {
  try {
    const loginId = String(req.body.loginId || '').trim();
    const { password } = req.body;
    if (!loginId || !password) return res.status(400).json({ success: false, error: 'All fields required' });

    const loginIsEmail = loginId.includes('@');
    if (loginId.length > 254 || (loginIsEmail && !EMAIL_PATTERN.test(loginId)) || (!loginIsEmail && !USERNAME_PATTERN.test(loginId))) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const { data: user, error } = loginIsEmail
      ? await supabase.from('users').select('*').eq('email', loginId.toLowerCase()).maybeSingle()
      : await supabase.from('users').select('*').ilike('username', loginId).maybeSingle();

    // Block non-admin logins during maintenance
    if (user && !user.is_admin) {
      const { data: maintData } = await supabase.from('app_settings').select('value').eq('key', 'maintenance_mode').single();
      if (maintData?.value === 'true') {
        return res.status(503).json({ success: false, maintenance: true, error: 'CRACKL is under maintenance right now. Check back soon!' });
      }
    }

    if (error || !user) {
      console.log(`🔒 Login FAILED | ${error?.message || 'User not found'}`);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    if (!user.password_hash) return res.status(401).json({ success: false, error: 'Legacy account. Please use Sign Up or reset password.' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = issueAuthToken(user);
    console.log(`🔑 User Logged In: ${user.username}`);

    res.json({ success: true, user: stripPrivateUserFields(user), token });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/auth/oauth', async (req, res) => {
  try {
    const { provider, token: oauthToken } = req.body;
    if (!provider || !oauthToken) return res.status(400).json({ success: false, error: 'Missing provider or token' });

    let email, name;

    if (provider === 'google') {
      try {
        // ID tokens are verified cryptographically when Google returns one.
        const ticket = await googleClient.verifyIdToken({
          idToken: oauthToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          return res.status(400).json({ success: false, error: 'Invalid Google token' });
        }
        email = String(payload.email).trim().toLowerCase();
        name = payload.name || email.split('@')[0];
      } catch {
        // Expo web may return an access token instead. Validate it with Google,
        // never by decoding or trusting client-provided profile data.
        const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${oauthToken}` },
        });
        if (!googleResponse.ok) {
          return res.status(400).json({ success: false, error: 'Invalid Google token' });
        }
        const profile = await googleResponse.json();
        if (!profile?.email || profile.email_verified === false) {
          return res.status(400).json({ success: false, error: 'Google email is not verified' });
        }
        email = String(profile.email).trim().toLowerCase();
        name = profile.name || email.split('@')[0];
      }
    } else if (provider === 'apple') {
      // Apple tokens: decode and verify issuer + audience claims
      const decoded = jwt.decode(oauthToken, { complete: true });
      if (!decoded || !decoded.payload || !decoded.payload.email) {
        return res.status(400).json({ success: false, error: 'Invalid Apple token' });
      }
      if (decoded.payload.iss !== 'https://appleid.apple.com') {
        return res.status(400).json({ success: false, error: 'Invalid Apple token issuer' });
      }
      if (process.env.APPLE_CLIENT_ID && decoded.payload.aud !== process.env.APPLE_CLIENT_ID) {
        return res.status(400).json({ success: false, error: 'Invalid Apple token audience' });
      }
      email = String(decoded.payload.email).trim().toLowerCase();
      name = decoded.payload.name || email.split('@')[0];
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported OAuth provider' });
    }

    let { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();

    if (!user) {
      const { data: newUser, error: insertErr } = await supabase.from('users')
        .insert({
          username: `${normalizeUsernameInput(name, 'operative').slice(0, 22)}_${crypto.randomBytes(3).toString('hex')}`,
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

    const token = issueAuthToken(user);

    res.json({ success: true, user: stripPrivateUserFields(user), token });
  } catch (error) {
    console.error('❌ /auth/oauth:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !EMAIL_PATTERN.test(email)) return res.status(400).json({ success: false, error: 'Valid email required' });

    const { data: user } = await supabase.from('users').select('id, username').eq('email', email).maybeSingle();
    if (!user) return res.json({ success: true, message: 'If that email exists, an OTP was sent.' });

    const otp = crypto.randomInt(100000, 1000000).toString();
    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const otpHash = await bcrypt.hash(otp, 10);

    await supabase.from('users').update({ reset_token: otpHash, reset_token_expires: tokenExpires }).eq('id', user.id);
    console.log(`📧 Password reset requested for user ${user.id}`);

    try {
      if (!transporter || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return res.status(500).json({ success: false, error: 'Email misconfigured on server. Cannot send OTP.' });
      }
      await transporter.sendMail({
        from: '"CRACKL Arena" <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: 'CRACKL Password Reset OTP',
        text: `Your 6-digit verification code is: ${otp}\n\nEnter this in the app to reset your password.`
      });
    } catch (err) {
      console.error('Email send failed:', err);
      return res.status(500).json({ success: false, error: 'Failed to send OTP email.' });
    }

    res.json({ success: true, message: 'If that email exists, an OTP was sent.' });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const { newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ success: false, error: 'Email, OTP, and new password required' });
    if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP code' });
    }
    if (String(newPassword).length < 8 || String(newPassword).length > 128) {
      return res.status(400).json({ success: false, error: 'Password must be 8-128 characters.' });
    }

    const { data: user } = await supabase.from('users')
      .select('id, reset_token, reset_token_expires')
      .eq('email', email)
      .maybeSingle();

    if (!user || new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP code' });
    }
    const tokenMatches = String(user.reset_token || '').startsWith('$2')
      ? await bcrypt.compare(otp, user.reset_token)
      : user.reset_token === otp;
    if (!tokenMatches) return res.status(400).json({ success: false, error: 'Invalid or expired OTP code' });

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await supabase.from('users').update({ password_hash: passwordHash, reset_token: null, reset_token_expires: null }).eq('id', user.id);

    res.json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 👤 USER ROUTES
// ============================

app.post('/user/create', authenticateToken, async (req, res) => {
  try {
    const id = resolveAuthenticatedActorId(req, req.body.id);
    const { city, area } = req.body;
    const username = normalizeUsernameInput(req.body.username || req.user?.username || 'Operative');
    const fallbackEmail = `${id}@crackl.local`;
    const email = String(req.body.email || req.user?.email || fallbackEmail).trim().toLowerCase().slice(0, 254) || fallbackEmail;
    if (!id) return res.status(400).json({ success: false, error: 'User ID required' });

    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return res.json({ success: true, user: stripPrivateUserFields(existing), existing: true });
    }

    const { data, error } = await supabase.from('users')
      .insert({ id, email, username, city, area, coins: 100, streak: 0, level: 'Novice', xp: 0, total_played: 0, total_correct: 0 })
      .select().single();
    if (error) throw error;
    res.json({ success: true, user: stripPrivateUserFields(data) });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// NOTE: The unauthenticated GET /user/:id has been intentionally removed.
// The authenticated version below (/user/:id with authenticateToken) is the only valid route.
// This prevents user data from being leaked to anonymous callers via guessed user IDs.

app.post('/user/update', authenticateToken, async (req, res) => {
  try {
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
    const { username, avatar_url } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID required' });

    const updates = {};
    if (username !== undefined) {
      const cleanUsername = String(username).trim();
      if (!USERNAME_PATTERN.test(cleanUsername)) {
        return res.status(400).json({ success: false, error: 'Username can use 3-32 letters, numbers, and underscores only.' });
      }
      updates.username = cleanUsername;
    }
    if (avatar_url !== undefined) {
      if (!isAcceptedAvatarUrl(avatar_url)) {
        return res.status(400).json({ success: false, error: 'Avatar must be HTTPS or a PNG/JPEG/WebP/GIF data image under 500KB.' });
      }
      updates.avatar_url = typeof avatar_url === 'string' && avatar_url.trim() ? avatar_url.trim() : null;
    }

    if (Object.keys(updates).length === 0) return res.json({ success: true });

    const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
    if (error) throw error;

    if (updates.username) {
      await supabase.from('leaderboard').update({ username: updates.username }).eq('user_id', userId);
    }

    res.json({ success: true, user: stripPrivateUserFields(data) });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.get('/leaderboard/:city', async (req, res) => {
  try {
    const { data } = await supabase
      .from('leaderboard')
      .select('user_id, username, coins, city')
      .eq('city', req.params.city)
      .eq('week_start', getCurrentWeekStartDate())
      .order('coins', { ascending: false })
      .limit(20);
    res.json({ success: true, leaderboard: await attachUserLevelsToLeaderboard(data || []) });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.get('/leaderboard/global/top', async (req, res) => {
  try {
    const { data } = await supabase
      .from('leaderboard')
      .select('user_id, username, coins, city')
      .eq('week_start', getCurrentWeekStartDate())
      .order('coins', { ascending: false })
      .limit(20);
    res.json({ success: true, leaderboard: await attachUserLevelsToLeaderboard(data || []) });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.get('/leaderboard/ranked/top', async (req, res) => {
  try {
    const { data } = await supabase
      .from('ranked_profiles')
      .select('username, city, rating, tier, wins, losses')
      .order('rating', { ascending: false })
      .limit(20);
    res.json({ success: true, leaderboard: data || [] });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.get('/ranked/profile/:userId', async (req, res) => {
  try {
    const { data } = await supabase
      .from('ranked_profiles')
      .select('user_id, username, city, rating, tier, wins, losses, matches_played, best_rating, last_delta')
      .eq('user_id', req.params.userId)
      .single();
    if (!data) {
      return res.json({
        success: true,
        profile: { rating: 1000, tier: getRankTier(1000), wins: 0, losses: 0, matches_played: 0, best_rating: 1000, last_delta: 0 }
      });
    }
    res.json({ success: true, profile: data });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 🎮 MULTIPLAYER ROOMS
// ============================

app.post('/api/sessions/:id/generate-queue', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { player1_id, player2_id, player_ids, difficulty, mode } = req.body;
    const playerIds = Array.isArray(player_ids) && player_ids.length > 0
      ? player_ids.filter(Boolean)
      : [player1_id, player2_id].filter(Boolean);

    if (playerIds.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one player is required to generate a queue.' });
    }

    const actorId = req.user.id;
    const { data: room } = await supabase
      .from('multiplayer_rooms')
      .select('id, host_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (room) {
      await assertRoomMembership(sessionId, actorId);
      if (room.host_id !== actorId) {
        return res.status(403).json({ success: false, error: 'Only the host can generate a room queue.' });
      }
    } else if (!playerIds.includes(actorId)) {
      return res.status(403).json({ success: false, error: 'Queue generation requires one of the session players.' });
    }

    const difficultyTier = Math.max(1, Math.min(5, parseInt(difficulty, 10) || 1));
    const queue = await generateSessionQueue(sessionId, playerIds, difficultyTier, mode || 'arena');
    res.json({ success: true, queue_size: queue.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/room/create', authenticateToken, async (req, res) => {
  try {
    const hostId = req.user.id;
    const { engagement, mode, timed, maxPlayers, wagerAmount } = req.body;
    const hostName = req.user?.username || req.body.hostName || 'Operative';
    const normalizedEngagement = engagement === 'coop' ? 'coop' : 'versus';
    const allowedModes = normalizedEngagement === 'coop'
      ? ['mcq', 'type', 'ranked', 'gauntlet', 'chain', 'bounty']
      : ['mcq', 'type', 'ranked', 'gauntlet', 'chain', 'wager', 'bounty'];
    const normalizedMode = allowedModes.includes(mode) ? mode : 'mcq';
    const normalizedWager = normalizedEngagement === 'versus' && normalizedMode === 'wager'
      ? Math.max(0, parseInt(wagerAmount, 10) || 0)
      : 0;
    if (normalizedMode === 'wager' && normalizedWager < MIN_WAGER_INTEL) {
      return res.status(400).json({ success: false, error: `Blind Wager rooms need at least ${MIN_WAGER_INTEL} Intel per operative.` });
    }
    if (normalizedWager > 0) {
      const { data: host } = await supabase.from('users').select('coins').eq('id', hostId).single();
      if (!host) return res.status(404).json({ success: false, error: 'Host user not found' });
      if ((host.coins || 0) < normalizedWager) {
        return res.status(400).json({ success: false, error: `You need at least ${normalizedWager} Intel to open this wagered showdown.` });
      }
    }
    const roomId = await makeUniqueRoomId();
    const isPanic = timed === 'panic';
    const finalTimed = isPanic;
    const finalTimeLimit = isPanic ? -1 : null;
    const { error: roomInsertErr } = await supabase.from('multiplayer_rooms').insert({
      id: roomId,
      host_id: hostId,
      host_name: hostName,
      status: 'waiting',
      engagement: normalizedEngagement,
      mode: normalizedMode,
      timed: finalTimed,
      time_limit: finalTimeLimit,
      panic_mode: isPanic,
      max_players: maxPlayers || 4
    });
    if (roomInsertErr) throw roomInsertErr;

    const { error: playerInsertErr } = await supabase.from('room_players').insert({ room_id: roomId, user_id: hostId, username: hostName });
    if (playerInsertErr) throw playerInsertErr;
    const runtime = clearRoomRuntimeRound(roomId);
    runtime.wagerAmount = normalizedWager;
    await persistRoomWagerAmount(roomId, normalizedWager);
    res.json({ success: true, roomId, wagerAmount: normalizedWager });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/room/join', authenticateToken, async (req, res) => {
  try {
    const roomId = normalizeRoomCode(req.body.roomId);
    const userId = req.user.id;
    const username = req.user?.username || req.body.username || 'Operative';
    if (!roomId || !userId) return res.status(400).json({ success: false, error: 'Missing roomId or userId' });
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (!room) return res.json({ success: false, error: 'Room not found' });
    if (room.status !== 'waiting') return res.json({ success: false, error: 'Game already started' });
    const wagerAmount = resolveRoomWagerAmount(roomId, room);
    const { data: players } = await supabase.from('room_players').select('*').eq('room_id', roomId);
    // Guard: prevent duplicate join (same user already in room)
    if (players.some(p => p.user_id === userId)) {
      return res.json({
        success: true,
        room: { ...room, wager_amount: wagerAmount },
        players,
        alreadyJoined: true
      });
    }
    if (players.length >= room.max_players) return res.json({ success: false, error: 'Room is full' });
    if (wagerAmount > 0) {
      const currentCoins = await getUserCoins(userId);
      if ((currentCoins || 0) < wagerAmount) {
        return res.status(400).json({ success: false, error: `You need ${wagerAmount} Intel to join this Blind Wager room.` });
      }
    }
    const { error: joinErr } = await supabase.from('room_players').insert({ room_id: roomId, user_id: userId, username });
    if (joinErr) throw joinErr;
    res.json({
      success: true,
      room: { ...room, wager_amount: wagerAmount },
      players: [...players, { user_id: userId, username }]
    });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.get('/room/:roomId', authenticateToken, async (req, res) => {
  try {
    const roomId = normalizeRoomCode(req.params.roomId);
    const actorId = req.user.id;
    await assertRoomMembership(roomId, actorId);
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    const runtime = getRoomRuntime(roomId);
    const players = await getRoomPlayers(roomId);
    const currentRiddle = await hydrateRoomRiddle(room, runtime);
    const { data: currentUser } = await supabase
      .from('users')
      .select('id, username, email, coins, streak, level, xp, is_admin, total_played, total_correct, city, area, avatar_url')
      .eq('id', actorId)
      .single();
    const wagerAmount = resolveRoomWagerAmount(roomId, room);
    res.json({
      success: true,
      room: { ...room, wager_amount: wagerAmount },
      players,
      currentRiddle,
      roundSummary: runtime.roundSummary,
      currentUser,
      currentUserId: actorId,
      isHost: room.host_id === actorId,
      currentUserCoins: currentUser?.coins ?? null
    });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/room/start', authenticateToken, checkMaintenance, async (req, res) => {
  let runtimeForStart = null;
  try {
    const roomId = normalizeRoomCode(req.body.roomId);
    const { xp } = req.body;
    const hostId = req.user.id;
    await assertRoomMembership(roomId, hostId);
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (room.host_id !== hostId) return res.json({ success: false, error: 'Only host can start' });
    if (room.status !== 'waiting') {
      return res.json({ success: false, error: 'This room has already launched. Rejoin from the active room screen.' });
    }
    runtimeForStart = getRoomRuntime(roomId);
    if (runtimeForStart.launching) {
      return res.json({ success: false, error: 'This room is already launching. Hold tight.' });
    }
    runtimeForStart.launching = true;
    const runtime = clearRoomRuntimeRound(roomId);
    runtime.launching = true;
    runtimeForStart = runtime;
    const roomPlayers = await getRoomPlayers(roomId);
    if (roomPlayers.length < 2) {
      return res.json({ success: false, error: 'At least two operatives are required to launch the room.' });
    }

    runtime.wagerAmount = room.mode === 'wager' ? resolveRoomWagerAmount(roomId, room) : 0;
    if (runtime.wagerAmount > 0 && room.engagement !== 'versus') {
      runtime.wagerAmount = 0;
    }
    if (room.engagement === 'versus' && room.mode === 'wager' && runtime.wagerAmount < MIN_WAGER_INTEL) {
      return res.json({ success: false, error: `Blind Wager rooms need at least ${MIN_WAGER_INTEL} Intel per operative. Create a fresh room and set the buy-in.` });
    }

    if (runtime.wagerAmount > 0) {
      const escrow = await escrowRoomWagers(roomId, roomPlayers, runtime.wagerAmount);
      if (!escrow.success) {
        return res.json({ success: false, error: escrow.error });
      }
    }

    const roomContext = await resolveRoomModeSelection(hostId, xp || 0, room.mode || 'mcq');
    const queue = await generateSessionQueue(
      roomId,
      roomPlayers.map((player) => player.user_id),
      roomContext.tier,
      room.mode || 'mcq'
    );
    const firstQueued = queue[0];
    if (!firstQueued) {
      if (runtime.wagerAmount > 0 && runtime.escrow.size > 0) {
        await refundRoomWagers(roomId, room, roomPlayers);
      }
      return res.json({ success: false, error: 'No riddles available right now. Admin needs to add more.' });
    }

    await Promise.all(roomPlayers.map((player) =>
      markRiddleServed({
        userId: player.user_id,
        riddle: firstQueued,
        mode: room.mode || 'arena',
        sessionId: roomId,
        xpAtTime: roomContext.xp,
        position: firstQueued.position
      })
    ));

    const { error: roomUpdateErr } = await supabase.from('multiplayer_rooms').update({ status: 'playing', current_riddle_id: firstQueued.id }).eq('id', roomId);
    if (roomUpdateErr) throw roomUpdateErr;
    const { error: playerResetErr } = await supabase.from('room_players').update({ answered: false, answer: null, is_correct: null, coins_earned: 0 }).eq('room_id', roomId);
    if (playerResetErr) throw playerResetErr;

    let finalTimeLimit = null;
    if (room.timed) {
      finalTimeLimit = room.time_limit === -1 ? await resolveRiddlePanicTimerSeconds(firstQueued) : room.time_limit;
    }

    runtime.currentTimeLimit = finalTimeLimit;
    runtime.roundStartedAt = Date.now();
    runtime.currentRiddle = serializeRiddlePayload(firstQueued, finalTimeLimit);
    runtime.queuePosition = firstQueued.position || 1;
    runtime.queueSize = queue.length;

    res.json({
      success: true,
      riddle: runtime.currentRiddle,
      wagerAmount: runtime.wagerAmount || 0,
      currentUserCoins: await getUserCoins(hostId)
    });
    runtime.launching = false;
  } catch (error) {
    if (runtimeForStart) runtimeForStart.launching = false;
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

app.post('/room/answer', authenticateToken, async (req, res) => {
  try {
    const roomId = normalizeRoomCode(req.body.roomId);
    const { userAnswer, timeTaken } = req.body;
    const userId = req.user.id;
    if (!roomId || !userId) {
      return res.status(400).json({ success: false, error: 'Missing roomId or userId' });
    }
    await assertRoomMembership(roomId, userId);
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    const runtime = getRoomRuntime(roomId);
    const roomWagerAmount = resolveRoomWagerAmount(roomId, room);
    const riddle = await fetchProtectedRiddleRecord(room.current_riddle_id, PROTECTED_ANSWER_FIELDS);
    if (!riddle) return res.json({ success: false, error: 'The active riddle could not be found.' });

    let players = await getRoomPlayers(roomId);
    const existingPlayer = players.find((player) => player.user_id === userId);
    if (!existingPlayer) {
      return res.status(403).json({ success: false, error: 'This room is restricted to joined operatives only.' });
    }

    if (room.status === 'revealed') {
      if (!runtime.roundSummary && runtime.resolving) {
        return res.json({
          success: true,
          isCorrect: false,
          players,
          resolved: false,
          pending: true,
          newTotal: await getUserCoins(userId)
        });
      }
      const storedSummary = runtime.roundSummary || buildStoredRoundSummary({ room, players, riddle, runtime });
      runtime.roundSummary = storedSummary;
      return res.json({
        success: true,
        ...storedSummary,
        resolved: true,
        players,
        newTotal: await getUserCoins(userId)
      });
    }
    if (room.status !== 'playing') {
      return res.status(409).json({ success: false, error: 'This room is not accepting answers right now.' });
    }
    if (existingPlayer.answered) {
      return res.json({
        success: true,
        isCorrect: !!existingPlayer.is_correct,
        players,
        allAnswered: players.every((player) => player.answered),
        resolved: false,
        pending: true,
        newTotal: await getUserCoins(userId)
      });
    }

    const limit = runtime.currentTimeLimit || (room.timed ? (room.time_limit === -1 ? await resolveRiddlePanicTimerSeconds(riddle) : room.time_limit) : null);
    let roundStartedAt = runtime.roundStartedAt;
    if (!roundStartedAt && limit) {
      const servedAt = await getSessionRiddleServedAt(roomId, room.current_riddle_id);
      if (servedAt) {
        roundStartedAt = new Date(servedAt).getTime();
        runtime.roundStartedAt = roundStartedAt;
        runtime.currentTimeLimit = limit;
      }
    }
    const roundAge = roundStartedAt ? Math.max(0, Math.floor((Date.now() - roundStartedAt) / 1000)) : 0;
    const submittedTime = Math.max(parseInt(timeTaken, 10) || 0, roundAge);
    const isLate = !!limit && room.timed && submittedTime >= limit;
    const usesTypedInput = room.mode === 'type' || !Array.isArray(riddle.options) || riddle.options.length === 0;
    let answeredCorrectly = false;
    if (!isLate && userAnswer !== '__timeout__') {
      if (usesTypedInput) {
        const judgment = await judgeTypedAnswer({ userId, riddle, userAnswer, mode: room.mode || 'room' });
        answeredCorrectly = judgment.isCorrect === true;
      } else {
        answeredCorrectly = isAnswerCorrect(userAnswer, riddle.answer, riddle.options);
      }
    }
    const isCorrect = !isLate && answeredCorrectly;
    const rewardDifficulty = getRewardDifficultyLabel(riddle);
    const baseCoins = rewardDifficulty === 'Easy' ? 10 : rewardDifficulty === 'Medium' ? 25 : 50;
    const baseCoinsEarned = isCorrect ? Math.round(baseCoins * (room.mode === 'type' ? 1.5 : 1)) : 0;
    const xpGain = isCorrect ? (rewardDifficulty === 'Easy' ? 5 : rewardDifficulty === 'Medium' ? 15 : 30) : 2;
    const panicRoom = room.timed && room.time_limit === -1;
    const panicBonus = isCorrect && panicRoom ? getPanicIntelBonus({ gameMode: 'multiplayer', rewardBasis: baseCoinsEarned }) : 0;
    const coinsEarned = baseCoinsEarned + panicBonus;
    const { data: answerLock, error: answerLockError } = await supabase
      .from('room_players')
      .update({ answered: true, answer: userAnswer, is_correct: isCorrect, coins_earned: coinsEarned })
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('answered', false)
      .select('user_id')
      .maybeSingle();
    if (answerLockError) throw answerLockError;
    if (!answerLock) {
      players = await getRoomPlayers(roomId);
      return res.json({
        success: true,
        isCorrect: !!players.find((player) => player.user_id === userId)?.is_correct,
        players,
        allAnswered: players.every((player) => player.answered),
        resolved: false,
        pending: true,
        newTotal: await getUserCoins(userId)
      });
    }

    if (!isCorrect) {
      await updateRiddleHistory({
        userId,
        riddleId: room.current_riddle_id,
        mode: room.mode || 'arena',
        status: (isLate || userAnswer === '__timeout__') ? 'timed_out' : 'failed',
        timeTakenMs: Number.isFinite(submittedTime) ? submittedTime * 1000 : null,
        sessionId: roomId
      });
    }
    if (!isCorrect && room.engagement !== 'coop') {
      await incrementUserStatsAtomic({
        userId,
        coinsDelta: 0,
        xpDelta: xpGain,
        streak: null,
        playedDelta: 1,
        correctDelta: isCorrect ? 1 : 0
      });
    }

    let answerRevealLock = false;
    if (isCorrect) {
      answerRevealLock = await tryRevealRoom(roomId);
      if (answerRevealLock) runtime.resolving = true;
      if (!answerRevealLock) {
        if (room.engagement !== 'coop') {
          const { error: rollbackErr } = await supabase
            .from('room_players')
            .update({ is_correct: false, coins_earned: 0 })
            .eq('room_id', roomId)
            .eq('user_id', userId);
          if (rollbackErr) throw rollbackErr;
          await updateRiddleHistory({
            userId,
            riddleId: room.current_riddle_id,
            mode: room.mode || 'arena',
            status: 'failed',
            timeTakenMs: Number.isFinite(submittedTime) ? submittedTime * 1000 : null,
            sessionId: roomId
          });
        }
        players = await getRoomPlayers(roomId);
        if (runtime.roundSummary) {
          return res.json({
            success: true,
            isCorrect: false,
            ...runtime.roundSummary,
            resolved: true,
            players,
            newTotal: await getUserCoins(userId)
          });
        }
        return res.json({
          success: true,
          isCorrect: false,
          resolved: false,
          pending: true,
          players,
          newTotal: await getUserCoins(userId)
        });
      }
    }

    players = await getRoomPlayers(roomId);
    const everyoneAnswered = players.every((player) => player.answered);
    const currentPlayer = players.find((player) => player.user_id === userId);
    const winnerName = currentPlayer?.username || 'Operative';
    let resolved = false;
    let teamWin = false;
    let refunded = false;
    let wagerPot = 0;
    let newTotal = await getUserCoins(userId);
    let summary = null;

    if (room.engagement === 'coop') {
      if (isCorrect) {
        resolved = true;
        teamWin = true;
        for (const player of players) {
          await updateRiddleHistory({
            userId: player.user_id,
            riddleId: room.current_riddle_id,
            mode: room.mode || 'arena',
            status: 'solved',
            timeTakenMs: Number.isFinite(submittedTime) ? submittedTime * 1000 : null,
            sessionId: roomId
          });
          await incrementUserStatsAtomic({
            userId: player.user_id,
            coinsDelta: 0,
            xpDelta: xpGain,
            streak: null,
            playedDelta: 1,
            correctDelta: 1
          });
          const latestCoins = await incrementCoinsAtomic(player.user_id, coinsEarned);
          const { error: coopPlayerErr } = await supabase.from('room_players')
            .update({ answered: true, is_correct: true, coins_earned: coinsEarned })
            .eq('room_id', roomId)
            .eq('user_id', player.user_id);
          if (coopPlayerErr) throw coopPlayerErr;
          if (player.user_id === userId) {
            newTotal = latestCoins;
          }
        }
        const { error: coopRevealErr } = await supabase.from('multiplayer_rooms').update({ status: 'revealed' }).eq('id', roomId);
        if (coopRevealErr) throw coopRevealErr;
        summary = {
          correctAnswer: riddle.answer,
          coinsEarned,
          panicBonus,
          resolved: true,
          teamWin: true,
          winnerId: userId,
          winnerName
        };
      } else if (everyoneAnswered) {
        const finalRevealLock = await tryRevealRoom(roomId);
        if (!finalRevealLock) {
          players = await getRoomPlayers(roomId);
          const storedSummary = buildStoredRoundSummary({ room, players, riddle, runtime });
          runtime.roundSummary = runtime.roundSummary || storedSummary;
          return res.json({
            success: true,
            isCorrect: false,
            ...runtime.roundSummary,
            resolved: true,
            players,
            newTotal: await getUserCoins(userId)
          });
        }
        resolved = true;
        await Promise.all(players.map((player) =>
          incrementUserStatsAtomic({
            userId: player.user_id,
            coinsDelta: 0,
            xpDelta: 2,
            streak: null,
            playedDelta: 1,
            correctDelta: 0
          })
        ));
        summary = {
          correctAnswer: riddle.answer,
          coinsEarned: 0,
          panicBonus: 0,
          resolved: true,
          teamWin: false,
          noWinner: true
        };
      }
    } else {
      if (isCorrect) {
        resolved = true;
        await updateRiddleHistory({
          userId,
          riddleId: room.current_riddle_id,
          mode: room.mode || 'arena',
          status: 'solved',
          timeTakenMs: Number.isFinite(submittedTime) ? submittedTime * 1000 : null,
          sessionId: roomId
        });
        await incrementUserStatsAtomic({
          userId,
          coinsDelta: 0,
          xpDelta: xpGain,
          streak: null,
          playedDelta: 1,
          correctDelta: 1
        });
        wagerPot = roomWagerAmount > 0 ? await consumeRoomWagerPot(roomId, room, players) : 0;
        newTotal = await incrementCoinsAtomic(userId, coinsEarned + wagerPot);
        const { error: versusPlayerErr } = await supabase.from('room_players')
          .update({ coins_earned: coinsEarned + wagerPot })
          .eq('room_id', roomId)
          .eq('user_id', userId);
        if (versusPlayerErr) throw versusPlayerErr;
        const { error: versusRevealErr } = await supabase.from('multiplayer_rooms').update({ status: 'revealed' }).eq('id', roomId);
        if (versusRevealErr) throw versusRevealErr;
        summary = {
          correctAnswer: riddle.answer,
          coinsEarned: coinsEarned + wagerPot,
          panicBonus,
          resolved: true,
          winnerId: userId,
          winnerName,
          wagerPot,
          showdownComplete: roomWagerAmount > 0
        };
      } else if (everyoneAnswered) {
        const finalRevealLock = await tryRevealRoom(roomId);
        if (!finalRevealLock) {
          players = await getRoomPlayers(roomId);
          const storedSummary = buildStoredRoundSummary({ room, players, riddle, runtime });
          runtime.roundSummary = runtime.roundSummary || storedSummary;
          return res.json({
            success: true,
            isCorrect: false,
            ...runtime.roundSummary,
            resolved: true,
            players,
            newTotal: await getUserCoins(userId)
          });
        }
        resolved = true;
        if (roomWagerAmount > 0) {
          const balances = await refundRoomWagers(roomId, room, players);
          refunded = true;
          newTotal = balances[userId] ?? newTotal;
        }
        summary = {
          correctAnswer: riddle.answer,
          coinsEarned: 0,
          panicBonus: 0,
          resolved: true,
          noWinner: true,
          refunded,
          showdownComplete: roomWagerAmount > 0
        };
      }
    }

    if (summary) {
      runtime.roundSummary = summary;
      runtime.resolving = false;
    }

    players = await getRoomPlayers(roomId);
    if (teamWin && newTotal == null) {
      newTotal = await getUserCoins(userId);
    }

    res.json({
      success: true,
      isCorrect,
      correctAnswer: riddle.answer,
      coinsEarned: summary?.coinsEarned ?? coinsEarned,
      panicBonus,
      allAnswered: everyoneAnswered,
      resolved,
      teamWin,
      refunded,
      wagerPot,
      showdownComplete: summary?.showdownComplete || false,
      winnerId: summary?.winnerId || null,
      winnerName: summary?.winnerName || null,
      noWinner: summary?.noWinner || false,
      players,
      newTotal
    });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/room/giveup', authenticateToken, async (req, res) => {
  try {
    const roomId = normalizeRoomCode(req.body.roomId);
    const hostId = req.user.id;
    await assertRoomMembership(roomId, hostId);
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (room.host_id !== hostId) return res.json({ success: false, error: 'Only host can give up' });
    const runtime = getRoomRuntime(roomId);
    const riddle = await fetchProtectedRiddleRecord(room.current_riddle_id, 'id, answer');
    const roomWagerAmount = resolveRoomWagerAmount(roomId, room);
    let refunded = false;
    if (roomWagerAmount > 0) {
      const players = await getRoomPlayers(roomId);
      await refundRoomWagers(roomId, room, players);
      refunded = true;
    }
    runtime.roundSummary = {
      correctAnswer: riddle.answer,
      gaveUp: true,
      resolved: true,
      refunded,
      showdownComplete: roomWagerAmount > 0
    };
    const { error: giveupRevealErr } = await supabase.from('multiplayer_rooms').update({ status: 'revealed' }).eq('id', roomId);
    if (giveupRevealErr) throw giveupRevealErr;
    res.json({ success: true, correctAnswer: riddle.answer, refunded });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/room/next', authenticateToken, checkMaintenance, async (req, res) => {
  try {
    const roomId = normalizeRoomCode(req.body.roomId);
    const { xp } = req.body;
    const hostId = req.user.id;
    await assertRoomMembership(roomId, hostId);
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (room.host_id !== hostId) return res.json({ success: false, error: 'Only host can continue' });
    const existingRuntime = getRoomRuntime(roomId);
    if (resolveRoomWagerAmount(roomId, room) > 0) {
      return res.json({ success: false, error: 'Wagered Dead Heat rooms settle in one showdown. Start a fresh room for the next stake.' });
    }

    const currentPosition = existingRuntime.queuePosition || await getSessionQueuePosition(roomId, room.current_riddle_id);
    const queueSize = existingRuntime.queueSize || await getSessionQueueSize(roomId);
    const nextPosition = currentPosition + 1;
    if (!nextPosition || nextPosition > queueSize) {
      return res.json({ success: false, error: 'This session queue is exhausted. Start a fresh room for the next operation.' });
    }

    const nextQueued = await getSessionQueuedRiddle(roomId, nextPosition);
    if (!nextQueued?.riddle) return res.json({ success: false, error: 'No riddles available right now.' });

    const roomPlayers = await getRoomPlayers(roomId);
    const roomContext = await resolveRoomModeSelection(hostId, xp || 0, room.mode || 'mcq');
    await Promise.all(roomPlayers.map((player) =>
      markRiddleServed({
        userId: player.user_id,
        riddle: nextQueued.riddle,
        mode: room.mode || 'arena',
        sessionId: roomId,
        xpAtTime: roomContext.xp,
        position: nextPosition
      })
    ));

    const runtime = clearRoomRuntimeRound(roomId, { preserveQueue: true });
    const { error: nextRoomUpdateErr } = await supabase.from('multiplayer_rooms').update({ status: 'playing', current_riddle_id: nextQueued.riddle.id }).eq('id', roomId);
    if (nextRoomUpdateErr) throw nextRoomUpdateErr;
    const { error: nextPlayerResetErr } = await supabase.from('room_players').update({ answered: false, answer: null, is_correct: null, coins_earned: 0 }).eq('room_id', roomId);
    if (nextPlayerResetErr) throw nextPlayerResetErr;

    let finalTimeLimit = null;
    if (room.timed) {
      finalTimeLimit = room.time_limit === -1 ? await resolveRiddlePanicTimerSeconds(nextQueued.riddle) : room.time_limit;
    }

    runtime.currentTimeLimit = finalTimeLimit;
    runtime.roundStartedAt = Date.now();
    runtime.currentRiddle = serializeRiddlePayload(nextQueued.riddle, finalTimeLimit);
    runtime.queuePosition = nextPosition;
    runtime.queueSize = queueSize;

    res.json({ success: true, riddle: runtime.currentRiddle });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 💰 CASHBACK
// ============================
app.post('/cashback', authenticateToken, async (req, res) => {
  try {
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
    const { coinsToRedeem } = req.body;
    const cleanUpiId = String(req.body.upiId || '').trim();
    const tiers = [{ coins: 500, inr: 40 }, { coins: 1500, inr: 160 }, { coins: 5000, inr: 800 }, { coins: 15000, inr: 2800 }];
    const coinsNum = parseInt(coinsToRedeem, 10) || 0;
    const tier = tiers.find(t => t.coins === coinsNum);
    if (!tier) return res.json({ success: false, error: 'Invalid tier' });
    if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9._-]{2,64}$/.test(cleanUpiId)) {
      return res.status(400).json({ success: false, error: 'Enter a valid UPI ID.' });
    }
    const { data: user } = await supabase
      .from('users')
      .select('coins, xp, level, total_played, total_correct')
      .eq('id', userId)
      .single();
    if (!user || (user.coins || 0) < coinsNum) return res.json({ success: false, error: 'Not enough coins' });
    
    // Concurrent optimistic lock
    const { data: updated, error: updateErr } = await supabase.from('users')
      .update({ coins: user.coins - coinsNum })
      .eq('id', userId)
      .eq('coins', user.coins)
      .select('coins').single();
      
    if (updateErr || !updated) return res.json({ success: false, error: 'Request conflict. Please try again.' });
    
    await supabase.from('cashback_requests').insert({ user_id: userId, coins_spent: coinsNum, amount_inr: tier.inr, upi_id: cleanUpiId, status: 'pending' });
    res.json({ success: true, message: `₹${tier.inr} cashback requested! Sending to ${cleanUpiId} within 7 days.` });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 📊 STATS
// ============================
app.get('/stats/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = resolveAuthenticatedActorId(req, req.params.userId);
    const { data: history } = await supabase
      .from('user_riddle_history')
      .select('status')
      .eq('user_id', userId)
      .in('status', ['solved', 'failed', 'timed_out', 'skipped']);
    const total = history?.length || 0;
    const correct = history?.filter(row => row.status === 'solved').length || 0;
    res.json({ success: true, total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 🌅 DAILY DROP
// ============================
app.post('/daily-riddle', authenticateToken, checkMaintenance, async (req, res) => {
  try {
    const { xp, panicMode } = req.body;
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
    const delivery = await buildDailyDelivery({ userId, xp, panicMode: !!panicMode });
    if (delivery.alreadyPlayed) {
      return res.json({ success: false, alreadyPlayed: true, message: delivery.message });
    }
    if (!delivery.success) {
      return res.status(delivery.statusCode || 400).json({ success: false, error: delivery.error });
    }
    console.log(`🌅 Daily Drop | ${userId}`);
    res.json({ success: true, resumed: !!delivery.resumed, riddle: delivery.riddle, difficultyTier: delivery.tier });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 🔗 THE CHAIN (TREASURE HUNT)
// ============================
app.post('/chain/start', authenticateToken, checkMaintenance, async (req, res) => {
  try {
    const { xp, panicMode } = req.body;
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }
    const chainId = `chain_${crypto.randomUUID()}`;
    const riddles = [];
    const progress = await getUserProgressProfile(userId);
    const userXp = Number.isFinite(parseInt(xp, 10)) ? parseInt(xp, 10) : progress.xp;
    const tierSequence = [1, 1, 3, 3, 5];
    const minChainSteps = 3;
    for (let i = 0; i < tierSequence.length; i++) {
      const { riddle } = await fetchNextRiddleFromEngine({
        userId,
        xp: userXp + (i * 100),
        totalPlayed: progress.totalPlayed + i,
        requestedMode: 'chain',
        sessionId: chainId,
        tierOverride: tierSequence[i],
        suppressServeLog: true,
        position: i + 1
      });
      if (!riddle) {
        break;
      }
      await supabase.from('session_riddle_queue').upsert({
        session_id: chainId,
        riddle_id: riddle.id,
        position: i + 1
      }, { onConflict: 'session_id,riddle_id' });
      riddles.push(riddle);
    }
    if (riddles.length < minChainSteps) {
      await supabase.from('session_riddle_queue').delete().eq('session_id', chainId);
      return res.json({ success: false, error: `Not enough chain riddles available (got ${riddles.length}/${minChainSteps}). Admin needs to add more Chain riddles.` });
    }

    await supabase.from('chain_progress').upsert({ user_id: userId, chain_id: chainId, step: 0, completed: false }, { onConflict: 'user_id,chain_id' });
    await markRiddleServed({
      userId,
      riddle: riddles[0],
      mode: 'chain',
      sessionId: chainId,
      xpAtTime: userXp,
      position: 1
    });

    console.log(`🔗 Chain Started | ${userId} | ${chainId}`);
    const timeLimit = panicMode ? await resolveRiddlePanicTimerSeconds(riddles[0]) : null;
    const queueIds = riddles.map(r => r.id);
    res.json({
      success: true,
      chainId,
      totalSteps: riddles.length,
      currentStep: 0,
      riddle: serializeRiddlePayload(riddles[0], timeLimit),
      chainToken: issueChainToken({ userId, chainId, queueIds, step: 0, panicMode: !!panicMode, limitSeconds: timeLimit })
    });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/chain/answer', authenticateToken, async (req, res) => {
  try {
    const { chainId, step, riddleId, userAnswer, panicMode, chainToken, timeTaken } = req.body;
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
    if (!userId || !chainId || step === undefined || !riddleId) {
      return res.status(400).json({ success: false, error: 'Missing required chain answer parameters' });
    }
    const chainState = verifyModeToken(chainToken, 'chain_run');
    if (chainState.userId !== userId || chainState.chainId !== chainId || parseInt(chainState.step, 10) !== parseInt(step, 10)) {
      return res.status(403).json({ success: false, error: 'Chain session mismatch. Restart the chain.' });
    }
    const queueIds = Array.isArray(chainState.queueIds) ? chainState.queueIds : [];
    if (queueIds[parseInt(step, 10)] !== riddleId) {
      return res.status(409).json({ success: false, error: 'Chain node mismatch. Restart the chain.' });
    }
    const { data: progress } = await supabase
      .from('chain_progress')
      .select('step, completed')
      .eq('user_id', userId)
      .eq('chain_id', chainId)
      .maybeSingle();
    if (!progress || progress.completed || parseInt(progress.step, 10) !== parseInt(step, 10)) {
      return res.status(409).json({ success: false, error: 'This chain link has already moved on.' });
    }
    const riddle = await fetchProtectedRiddleRecord(riddleId, PROTECTED_ANSWER_FIELDS);
    if (!riddle) return res.status(404).json({ success: false, error: 'Riddle not found' });
    const timing = await resolvePanicSubmissionState({
      panicMode: !!chainState.panicMode || !!panicMode,
      userId,
      riddleId,
      clientTimeTaken: timeTaken,
      startedAtMs: chainState.stepStartedAt,
      limitSeconds: chainState.limitSeconds
    });
    const usesTypedInput = !Array.isArray(riddle.options) || riddle.options.length === 0;
    let isCorrect = false;
    if (userAnswer !== '__timeout__' && !timing.isLate) {
      if (usesTypedInput) {
        const judgment = await judgeTypedAnswer({ userId, riddle, userAnswer, mode: 'chain' });
        isCorrect = judgment.isCorrect === true;
      } else {
        isCorrect = isAnswerCorrect(userAnswer, riddle.answer, riddle.options);
      }
    }
    if (timing.isLate || userAnswer === '__timeout__') {
      isCorrect = false;
    }

    if (!isCorrect) {
      await claimRiddleResolutionOnce({
        userId,
        riddleId,
        mode: 'chain',
        status: (userAnswer === '__timeout__' || timing.isLate) ? 'timed_out' : 'failed',
        timeTakenMs: timing.elapsedSeconds ? timing.elapsedSeconds * 1000 : null
      });
      await supabase.from('chain_progress')
        .update({ completed: true })
        .eq('user_id', userId)
        .eq('chain_id', chainId)
        .eq('step', parseInt(step, 10))
        .eq('completed', false);
      return res.json({ success: true, isCorrect: false, correctAnswer: riddle.answer, message: 'Chain broken! Try again.' });
    }

    const nextStep = parseInt(step, 10) + 1;
    const completed = nextStep >= queueIds.length;
    const baseCoinsEarned = completed ? 250 : 25;
    const panicBonus = (chainState.panicMode || panicMode) ? getPanicIntelBonus({ gameMode: 'chain', completed, rewardBasis: baseCoinsEarned }) : 0;
    const coinsEarned = baseCoinsEarned + panicBonus;
    const xpGain = completed ? 50 : 10;

    await claimRiddleResolutionOnce({
      userId,
      riddleId,
      mode: 'chain',
      status: 'solved',
      timeTakenMs: timing.elapsedSeconds ? timing.elapsedSeconds * 1000 : null
    });

    const { data: chainUpdate, error: chainUpdateErr } = await supabase.from('chain_progress')
      .update({ step: nextStep, completed })
      .eq('user_id', userId)
      .eq('chain_id', chainId)
      .eq('step', parseInt(step, 10))
      .eq('completed', false)
      .select('chain_id')
      .maybeSingle();
    if (chainUpdateErr) throw chainUpdateErr;
    if (!chainUpdate) {
      return res.status(409).json({ success: false, error: 'This chain link has already moved on.' });
    }

    await incrementUserStatsAtomic({
      userId,
      coinsDelta: coinsEarned,
      xpDelta: xpGain,
      streak: null,
      playedDelta: 1,
      correctDelta: 1
    });

    const { data: finalUser } = await supabase
      .from('users')
      .select('coins, xp, level, streak')
      .eq('id', userId)
      .single();

    const nextRiddle = completed ? null : await fetchSafeRiddleById(queueIds[nextStep], 'chain');
    if (nextRiddle) {
      await markRiddleServed({
        userId,
        riddle: nextRiddle,
        mode: 'chain',
        sessionId: chainId,
        xpAtTime: finalUser?.xp || null,
        position: nextStep + 1
      });
    }
    const nextTimeLimit = nextRiddle && chainState.panicMode ? await resolveRiddlePanicTimerSeconds(nextRiddle) : null;
    const nextPayload = nextRiddle ? serializeRiddlePayload(nextRiddle, nextTimeLimit) : null;
    res.json({
      success: true,
      isCorrect: true,
      correctAnswer: riddle.answer,
      nextStep,
      completed,
      coinsEarned,
      panicBonus,
      newTotal: finalUser?.coins,
      newXp: finalUser?.xp,
      newLevel: finalUser?.level,
      streakCount: finalUser?.streak,
      nextRiddle: nextPayload,
      chainToken: !completed ? issueChainToken({
        userId,
        chainId,
        queueIds,
        step: nextStep,
        panicMode: !!chainState.panicMode,
        limitSeconds: nextTimeLimit
      }) : null
    });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 🎰 BLIND WAGER
// ============================
app.post('/wager/start', authenticateToken, checkMaintenance, async (req, res) => {
  try {
    const { xp, wageredCoins, panicMode } = req.body;
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
    if (!userId || wageredCoins == null) return res.status(400).json({ success: false, error: 'Missing fields' });

    const wager = parseInt(wageredCoins, 10);
    if (!Number.isFinite(wager) || wager <= 0) return res.status(400).json({ success: false, error: 'Invalid wager amount' });
    if (wager < MIN_WAGER_INTEL) return res.status(400).json({ success: false, error: `Minimum stake is ${MIN_WAGER_INTEL} Intel.` });

    const { data: user } = await supabase.from('users').select('coins, xp, level, total_played, total_correct').eq('id', userId).single();
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if ((user.coins || 0) < wager) return res.json({ success: false, error: 'Not enough coins to cover this wager' });

    const progress = await getUserProgressProfile(userId);
    const { riddle } = await fetchNextRiddleFromEngine({
      userId,
      xp: Number.isFinite(parseInt(xp, 10)) ? parseInt(xp, 10) : progress.xp,
      totalPlayed: progress.totalPlayed,
      requestedMode: 'wager'
    });
    if (!riddle) return res.json({ success: false, error: 'No wager sequence available right now.' });

	    const lockedBalance = await debitCoinsWithBalanceGuard(userId, wager);
	    const timeLimit = panicMode ? await resolveRiddlePanicTimerSeconds(riddle) : null;

	    res.json({
	      success: true,
	      wager,
	      wagerToken: issueWagerToken({ userId, riddleId: riddle.id, wager, panicMode: !!panicMode, limitSeconds: timeLimit }),
	      newTotal: lockedBalance,
	      riddle: serializeRiddlePayload(riddle, timeLimit)
	    });
	  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/wager/settle', authenticateToken, checkMaintenance, async (req, res) => {
  try {
    const { userAnswer, wagerToken, timeTaken } = req.body;
    const tokenState = verifyModeToken(wagerToken, 'solo_wager');
    const userId = resolveAuthenticatedActorId(req, req.body.userId || tokenState.userId);
    if (tokenState.userId !== userId) return res.status(403).json({ success: false, error: 'Wager token does not belong to this operative.' });

    const riddleId = tokenState.riddleId;
    const wager = parseInt(tokenState.wager, 10) || 0;
    if (!userId || !riddleId || wager <= 0) return res.status(400).json({ success: false, error: 'Invalid wager settlement.' });
    await resolveServedRiddleGuard({ userId, riddleId, mode: 'wager' });

    // Server-side answer re-verification — never trust client-sent isCorrect
    const riddle = await fetchProtectedRiddleRecord(riddleId, PROTECTED_ANSWER_FIELDS);
    if (!riddle) return res.status(404).json({ success: false, error: 'Riddle not found for settlement' });
    const timing = await resolvePanicSubmissionState({
      panicMode: !!tokenState.panicMode,
      userId,
      riddleId,
      clientTimeTaken: timeTaken,
      startedAtMs: tokenState.startedAt,
      limitSeconds: tokenState.limitSeconds
    });
    const usesTypedInput = !Array.isArray(riddle.options) || riddle.options.length < 2;
    let isCorrect = false;
    if (userAnswer !== '__timeout__' && !timing.isLate) {
      if (usesTypedInput) {
        const judgment = await judgeTypedAnswer({ userId, riddle, userAnswer, mode: 'wager' });
        isCorrect = judgment.isCorrect === true;
      } else {
        isCorrect = isAnswerCorrect(userAnswer, riddle.answer, riddle.options);
      }
    }
    if (timing.isLate || userAnswer === '__timeout__') {
      isCorrect = false;
    }

    await claimRiddleResolutionOnce({
      userId,
      riddleId,
      mode: 'wager',
      status: isCorrect ? 'solved' : ((userAnswer === '__timeout__' || timing.isLate) ? 'timed_out' : 'failed'),
      timeTakenMs: timing.elapsedSeconds ? timing.elapsedSeconds * 1000 : null
    });

    const { data: user } = await supabase
      .from('users')
      .select('coins, xp, level, total_played, total_correct')
      .eq('id', userId)
      .single();
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const panicBonus = isCorrect && tokenState.panicMode ? getPanicIntelBonus({ gameMode: 'wager', wager }) : 0;
    const payout = isCorrect ? (wager * 2) + panicBonus : 0;
    const netDelta = isCorrect ? wager + panicBonus : -wager;
    const xpGain = isCorrect ? 15 : 2;

    // ATOMIC update
    const { error: rpcErr } = await supabase.rpc('increment_coins', { p_user_id: userId, p_coins_delta: payout });
    if (rpcErr) {
       // Fallback
       const newCoins = Math.max(0, (user.coins || 0) + payout);
       await supabase.from('users').update({ coins: newCoins }).eq('id', userId);
       console.warn('⚠️ wager/settle RPC fallback executed');
    }

    await incrementUserStatsAtomic({
      userId,
      coinsDelta: 0,
      xpDelta: xpGain,
      streak: null,
      playedDelta: 1,
      correctDelta: isCorrect ? 1 : 0
    });

    const { data: finalUser } = await supabase.from('users').select('coins, xp, level, streak').eq('id', userId).single();
    const newCoins = finalUser ? finalUser.coins : 0;

	    console.log(`🎰 Wager | ${userId} | ${isCorrect ? 'WIN' : 'LOSE'} | payout ${payout > 0 ? '+' : ''}${payout} coins`);
	    res.json({
	      success: true,
	      isCorrect,
	      correctAnswer: riddle.answer,
	      stake: wager,
	      payout,
	      delta: payout,
	      netDelta,
	      coinsChange: netDelta,
	      newTotal: newCoins,
	      finalTotal: newCoins,
	      panicBonus,
	      newXp: finalUser?.xp,
	      newLevel: finalUser?.level,
	      streakCount: finalUser?.streak,
	      timedOut: timing.isLate || userAnswer === '__timeout__'
	    });
	  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 🔮 ORACLE LIFELINE
// ============================
app.post('/lifeline/oracle', authenticateToken, async (req, res) => {
  try {
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
    const { riddleId, riddleQuestion } = req.body;
    await resolveServedRiddleGuard({ userId, riddleId });
    const riddle = await fetchProtectedRiddleRecord(riddleId, 'id, answer, hint');
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

    let oracleHint;
    try {
      const result = await geminiModel.generateContent(prompt);
      oracleHint = result.response.text().trim();
    } catch {
      await incrementCoinsAtomic(userId, 150);
      return res.status(502).json({ success: false, error: 'Oracle signal failed. Intel refunded.' });
    }

    await recordHintUsage({
      userId,
      riddleId,
      hintsUsed: 1
    });

    console.log(`🔮 Oracle | ${userId} | ${riddleId}`);
    res.json({ success: true, oracleHint, newTotal: updated.coins });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 🕐 TIME FREEZE LIFELINE
// ============================
app.post('/lifeline/time-freeze', authenticateToken, async (req, res) => {
  try {
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
    const { riddleId } = req.body;
    if (!riddleId) return res.status(400).json({ success: false, error: 'Time Freeze requires an active riddle.' });
    await resolveServedRiddleGuard({ userId, riddleId });
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
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 💡 PAID HINT LIFELINE (12 Intel)
// ============================
app.post('/lifeline/hint', authenticateToken, async (req, res) => {
  try {
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
    const { riddleId, riddleQuestion, hintNumber } = req.body;
    await resolveServedRiddleGuard({ userId, riddleId });
    const riddle = await fetchProtectedRiddleRecord(riddleId, 'id, answer, hint');
    if (!riddle) return res.status(404).json({ success: false, error: 'Riddle not found' });

    const { data: user } = await supabase.from('users').select('coins').eq('id', userId).single();
    if (!user || user.coins < 12) return res.json({ success: false, error: 'Need 12 Intel for an extra hint.' });

    const { data: updated, error: updateErr } = await supabase.from('users')
      .update({ coins: user.coins - 12 })
      .eq('id', userId)
      .eq('coins', user.coins)
      .select('coins').single();

    if (updateErr || !updated) return res.json({ success: false, error: 'Transaction overlap. Please try again.' });

    const prompt = `You are a cryptic informant in a detective intelligence game called CRACKL.
Riddle: "${riddleQuestion}"
The correct answer is: "${riddle.answer}"
Existing hint: "${riddle.hint || 'none'}"
This is hint #${hintNumber} the operative is requesting.

Generate ONE short, cryptic clue that nudges toward the answer without revealing it directly.
Be detective-themed — like a confidential tip from an informant. Max 1-2 sentences.
Each hint should be progressively more helpful. Hint #2 is vaguer, hint #3 is slightly more direct.`;

    let paidHint;
    try {
      const result = await geminiModel.generateContent(prompt);
      paidHint = result.response.text().trim();
    } catch {
      await incrementCoinsAtomic(userId, 12);
      return res.status(502).json({ success: false, error: 'Hint signal failed. Intel refunded.' });
    }

    await recordHintUsage({
      userId,
      riddleId,
      hintsUsed: Math.max(1, parseInt(hintNumber, 10) || 1)
    });

    console.log(`💡 Paid Hint #${hintNumber} | ${userId} | ${riddleId} | -12 Intel`);
    res.json({ success: true, hint: paidHint, newTotal: updated.coins });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 🏆 BOUNTY BOARD
// ============================
app.get('/bounty/current', softAuth, checkMaintenance, async (req, res) => {
  try {
    const panicMode = req.query.panicMode === 'true';
    const { data: bounty, error: bountyErr } = await supabase
      .from('bounty_board_safe')
      .select('*')
      .eq('active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bountyErr) throw bountyErr;

    if (!bounty) {
      return res.json({ success: false, noBounty: true, error: 'No active bounty right now. Admin needs to add a bounty riddle.' });
    }
    if (req.user?.id) {
      const { data: priorAttempt } = await supabase
        .from('bounty_attempts')
        .select('status')
        .eq('bounty_id', bounty.id)
        .eq('user_id', req.user.id)
        .maybeSingle();
      if (priorAttempt) {
        return res.json({
          success: false,
          alreadyAttempted: true,
          error: 'You have already spent your attempt on this bounty. Wait for a fresh contract.'
        });
      }
    }

    const timeLimit = panicMode ? await getAdminPanicTimerSeconds() : null;
    res.json({
      success: true,
      bounty: { ...bounty, timeLimit },
      bountyToken: req.user ? issueBountyToken({ userId: req.user.id, bountyId: bounty.id, panicMode, limitSeconds: timeLimit }) : null
    });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/bounty/attempt', authenticateToken, async (req, res) => {
  try {
    const actorId = resolveAuthenticatedActorId(req, req.body.userId);
    const { bountyId, userAnswer, username, panicMode, bountyToken } = req.body;
    const userId = actorId;
    if (!userId || !bountyId) {
      return res.status(400).json({ success: false, error: 'Missing userId or bountyId' });
    }
    let bountyState = null;
    if (panicMode || bountyToken) {
      bountyState = verifyModeToken(bountyToken, 'bounty_run');
      if (bountyState.userId !== userId || bountyState.bountyId !== bountyId) {
        return res.status(403).json({ success: false, error: 'Bounty timer token mismatch. Reload the bounty.' });
      }
    }
    const bounty = await fetchProtectedBountyRecord(bountyId);
    if (!bounty || bounty.solved_by) return res.json({ success: false, error: bounty?.solved_by ? `Already solved by ${bounty.solved_by}!` : 'Bounty not found' });

    const timing = await resolvePanicSubmissionState({
      panicMode: !!panicMode,
      userId,
      riddleId: null,
      clientTimeTaken: req.body.timeTaken,
      startedAtMs: bountyState?.startedAt,
      limitSeconds: bountyState?.limitSeconds
    });
    const bountyVerdict = (!timing.isLate && userAnswer !== '__timeout__')
      ? await checkTypedAnswerDetailed(userAnswer, bounty.answer, bounty.question || '', {
          semanticEnabled: false,
          strictness: 'normal'
        })
      : { isCorrect: false, confidence: 1, source: 'timeout', reason: 'Bounty attempt timed out.', semanticUsed: false };
    const isCorrect = bountyVerdict.isCorrect === true;
    await recordStandaloneAnswerJudgment({ userId, mode: 'bounty', userAnswer, verdict: bountyVerdict });
    const attemptStatus = isCorrect ? 'solved' : ((timing.isLate || userAnswer === '__timeout__') ? 'timed_out' : 'failed');
    const attemptTimeMs = timing.elapsedSeconds ? timing.elapsedSeconds * 1000 : null;
    const { data: attemptLock, error: attemptLockErr } = await supabase
      .from('bounty_attempts')
      .insert({
        bounty_id: bountyId,
        user_id: userId,
        status: 'served',
        time_taken_ms: attemptTimeMs
      })
      .select('id')
      .maybeSingle();

    if (attemptLockErr) {
      if (attemptLockErr.code === '23505') {
        return res.status(409).json({ success: false, alreadyAttempted: true, error: 'This bounty attempt is already spent. Wait for a fresh contract.' });
      }
      throw attemptLockErr;
    }

    if (!isCorrect) {
      await supabase
        .from('bounty_attempts')
        .update({ status: attemptStatus, attempted_at: new Date().toISOString(), time_taken_ms: attemptTimeMs })
        .eq('id', attemptLock.id);
      const stats = await incrementUserStatsAtomic({
        userId,
        coinsDelta: 0,
        xpDelta: 2,
        streak: null,
        playedDelta: 1,
        correctDelta: 0
      });
      return res.json({
        success: true,
        isCorrect: false,
        timedOut: timing.isLate || userAnswer === '__timeout__',
        newTotal: stats?.coins,
        newXp: stats?.xp,
        newLevel: stats?.level,
        streakCount: stats?.streak,
        message: 'Contract failed. This bounty attempt is spent.'
      });
    }

    // Atomically lock the bounty logic
    const { data: claimed, error: clErr } = await supabase.from('bounty_board')
      .update({ solved_by: username, solved_at: new Date().toISOString(), active: false })
      .eq('id', bountyId)
      .eq('active', true)
      .select().single();
      
    if (!claimed || clErr) {
      await supabase
        .from('bounty_attempts')
        .update({ status: 'failed', attempted_at: new Date().toISOString(), time_taken_ms: attemptTimeMs })
        .eq('id', attemptLock.id);
      return res.json({ success: false, error: 'Very close! The bounty was literally just solved by someone else!' });
    }

    const panicBonus = panicMode ? getPanicIntelBonus({ gameMode: 'bounty', bountyPrize: bounty.prize_coins }) : 0;
    const totalPrize = bounty.prize_coins + panicBonus;

    await supabase
      .from('bounty_attempts')
      .update({ status: 'solved', attempted_at: new Date().toISOString(), time_taken_ms: attemptTimeMs })
      .eq('id', attemptLock.id);
    const updatedUser = await incrementUserStatsAtomic({
      userId,
      coinsDelta: totalPrize,
      xpDelta: 50,
      streak: null,
      playedDelta: 1,
      correctDelta: 1
    });

    console.log(`🏆 BOUNTY SOLVED! ${username} wins ${totalPrize} coins!`);
    res.json({
      success: true,
      isCorrect: true,
      prize: totalPrize,
      panicBonus,
      newTotal: updatedUser?.coins,
      newXp: updatedUser?.xp,
      newLevel: updatedUser?.level,
      streakCount: updatedUser?.streak,
      message: `🎉 LEGENDARY! You cracked the Bounty and won ${totalPrize} coins!`
    });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 🧠 BRAIN PROFILE REPORT
// ============================
app.get('/profile/brain-report/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    // Prevent cross-user access — only allow viewing your own report
    if (req.user.id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied — you can only view your own report' });
    }
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: history } = await supabase
      .from('user_riddle_history')
      .select('status, riddle_id')
      .eq('user_id', userId)
      .gte('attempted_at', weekAgo)
      .in('status', ['solved', 'failed', 'timed_out', 'skipped']);
    const { data: user } = await supabase.from('users').select('username, xp, streak, level').eq('id', userId).single();

    const total = history?.length || 0;
    const correct = history?.filter(row => row.status === 'solved').length || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const prompt = `You are a world-class cognitive analyst for CRACKL riddle arena.
Player: ${user?.username || 'Unknown'} | Level: ${user?.level} | XP: ${user?.xp} | Streak: ${user?.streak} days
This week: ${total} riddles attempted, ${correct} correct (${accuracy}% accuracy)

Write a personalized 3-sentence cognitive "Brain Report Card". Be like a genius mentor — insightful, motivating, specific.
Tell them their cognitive strengths, one weakness to work on, and a bold prediction for their future. NO markdown.`;
    const result = await geminiModel.generateContent(prompt);
    const narrative = result.response.text().trim();

    res.json({ success: true, report: { total, correct, accuracy, narrative, weekStreak: user?.streak || 0, level: user?.level } });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// ⚔️ CHALLENGE A GENIUS
// ============================

app.post('/challenge/create', authenticateToken, async (req, res) => {
  try {
    const { challengerId, challengerName, riddleId, targetTime, wagerCoins } = req.body;
    const actorId = resolveAuthenticatedActorId(req, challengerId);
    const rawWagerAmount = parseInt(wagerCoins, 10) || 0;
    const wagerAmount = Math.max(0, rawWagerAmount);
    const targetSeconds = normalizeChallengeSeconds(targetTime);
    
    // Validate inputs
    if (!actorId || !riddleId) return res.status(400).json({ success: false, error: 'Missing challenge constraints.' });
    if (rawWagerAmount < 0) return res.status(400).json({ success: false, error: 'Invalid wager amount.' });
    if (wagerAmount > 0 && wagerAmount < MIN_WAGER_INTEL) {
      return res.status(400).json({ success: false, error: `Minimum challenge stake is ${MIN_WAGER_INTEL} Intel.` });
    }

    // Ensure the challenger actually has the wager amount and escrow atomically
    if (wagerAmount > 0) {
      await debitCoinsWithBalanceGuard(actorId, wagerAmount);
    }

    const { data: riddleExists, error: riddleErr } = await supabase
      .from('riddles_safe')
      .select('id')
      .eq('id', riddleId)
      .eq('is_active', true)
      .eq('review_status', 'approved')
      .maybeSingle();
    if (riddleErr || !riddleExists) {
      if (wagerAmount > 0) await incrementCoinsAtomic(actorId, wagerAmount);
      return res.status(404).json({ success: false, error: 'Challenge riddle is unavailable.' });
    }

    const { data: solveHistory } = await supabase
      .from('user_riddle_history')
      .select('status')
      .eq('user_id', actorId)
      .eq('riddle_id', riddleId)
      .maybeSingle();
    if (!solveHistory || solveHistory.status !== 'solved') {
      if (wagerAmount > 0) await incrementCoinsAtomic(actorId, wagerAmount);
      return res.status(403).json({ success: false, error: 'Only solved nodes can be challenged.' });
    }

    const challengeId = makeChallengeId();
    
    const { error } = await supabase.from('challenges').insert({
      id: challengeId,
      challenger_id: actorId,
      challenger_name: req.user?.username || challengerName || 'Unknown',
      riddle_id: riddleId,
      target_time: targetSeconds,
      wager_amount: wagerAmount,
      active: true,
      created_at: new Date().toISOString()
    });

	    if (error) {
	      if (wagerAmount > 0) { // Refund on error — atomic
	        await incrementCoinsAtomic(actorId, wagerAmount);
	      }
	      return res.status(500).json({ success: false, error: 'Failed to record challenge in Data Core.' });
	    }

    res.json({ success: true, linkId: challengeId });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/challenge/fetch', softAuth, async (req, res) => {
  try {
    const { linkId, preview } = req.body;
    if (!linkId) return res.status(400).json({ success: false, error: 'No node link provided.' });

    const { data: challenge, error: cErr } = await supabase.from('challenges').select('*').eq('id', linkId).single();
    if (cErr || !challenge) return res.json({ success: false, error: 'This challenge link has dissolved or is invalid.' });
    if (!challenge.active) return res.json({ success: false, error: 'This challenge has already been attempted.' });
    if (req.user?.id && req.user.id === challenge.challenger_id) {
      return res.status(403).json({ success: false, error: 'You cannot accept your own challenge link.' });
    }

    const { data: riddle, error: rErr } = await supabase.from('riddles_safe')
      .select('id, question, options, category, difficulty, difficulty_tier, region, hint, fun_fact, riddle_type, media_url, layout_config')
      .eq('id', challenge.riddle_id)
      .eq('is_active', true)
      .eq('review_status', 'approved')
      .single();

    if (rErr || !riddle) return res.json({ success: false, error: 'Target node data missing.' });
    if (req.user?.id && !preview) {
      const existingHistory = await getRiddleHistoryEntry(req.user.id, riddle.id);
      if (existingHistory && isTerminalRiddleStatus(existingHistory.status)) {
        return res.status(409).json({ success: false, error: 'You have already resolved this node. Ask for a fresh challenge.' });
      }
      await markRiddleServed({
        userId: req.user.id,
        riddle,
        mode: 'wager',
        xpAtTime: 0
      });
    }

    res.json({
      success: true,
      challenge: {
        id: challenge.id,
        challengerName: challenge.challenger_name,
        targetTime: challenge.target_time,
        wagerAmount: challenge.wager_amount
      },
      riddle
    });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/challenge/resolve', authenticateToken, async (req, res) => {
  try {
    const { challengeId, defenderId, timeTaken, userAnswer } = req.body;
    const actorId = resolveAuthenticatedActorId(req, defenderId);
    if (!challengeId || !actorId) return res.status(400).json({ success: false, error: 'Missing challenge resolution payload.' });

    const { data: activeChallenge, error: lookupErr } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .eq('active', true)
      .single();
    if (lookupErr || !activeChallenge) return res.json({ success: false, error: 'Challenge was already resolved by another operative.' });
    if (activeChallenge.challenger_id && activeChallenge.challenger_id === actorId) {
      return res.status(403).json({ success: false, error: 'You cannot resolve your own challenge.' });
    }
    await resolveServedRiddleGuard({ userId: actorId, riddleId: activeChallenge.riddle_id, mode: 'wager' });

    const riddle = await fetchProtectedRiddleRecord(activeChallenge.riddle_id, PROTECTED_ANSWER_FIELDS);
    if (!riddle) return res.status(404).json({ success: false, error: 'Challenge riddle not found.' });
    const usesTypedInput = !Array.isArray(riddle.options) || riddle.options.length < 2;
    let isVerifiedCorrect = false;
    if (userAnswer !== '__timeout__') {
      if (usesTypedInput) {
        const judgment = await judgeTypedAnswer({ userId: actorId, riddle, userAnswer, mode: 'challenge' });
        isVerifiedCorrect = judgment.isCorrect === true;
      } else {
        isVerifiedCorrect = isAnswerCorrect(userAnswer, riddle.answer, riddle.options);
      }
    }
    
    // Lock the challenge securely
    const { data: challenge, error: cErr } = await supabase.from('challenges')
      .update({ active: false, defender_id: actorId, completed_at: new Date().toISOString() })
      .eq('id', challengeId)
      .eq('active', true)
      .select().single();

    if (cErr || !challenge) return res.json({ success: false, error: 'Challenge was already resolved by another operative.' });

    const targetSeconds = parseInt(challenge.target_time, 10) || 0;
    const defenderSeconds = normalizeDefenderSeconds(timeTaken);
    const defenderWon = isVerifiedCorrect && defenderSeconds <= Math.max(1, targetSeconds);

    await claimRiddleResolutionOnce({
      userId: actorId,
      riddleId: challenge.riddle_id,
      mode: 'wager',
      status: defenderWon ? 'solved' : 'failed',
      timeTakenMs: Number.isFinite(defenderSeconds) && defenderSeconds < Number.MAX_SAFE_INTEGER ? defenderSeconds * 1000 : null
    });
    const defenderStats = await incrementUserStatsAtomic({
      userId: actorId,
      coinsDelta: 0,
      xpDelta: defenderWon ? 15 : 2,
      streak: null,
      playedDelta: 1,
      correctDelta: defenderWon ? 1 : 0
    });

    // Distribute the escrowed challenge stake. Only the challenger escrows here,
    // so paying 2x would mint Intel out of thin air.
    let prizeAwarded = 0;
    let winnerId = null;
    let defenderTotal = defenderStats?.coins ?? null;
    if (challenge.wager_amount > 0) {
      prizeAwarded = challenge.wager_amount;
      winnerId = defenderWon ? actorId : challenge.challenger_id;
      await incrementCoinsAtomic(winnerId, prizeAwarded);
      if (winnerId === actorId) {
        defenderTotal = await getUserCoins(actorId);
      }
    }

    res.json({ 
      success: true, 
      isCorrect: defenderWon,
      defenderWon, 
      correctAnswer: riddle.answer,
      prizeAwarded,
      winnerId,
      newTotal: defenderTotal ?? await getUserCoins(actorId),
      newXp: defenderStats?.xp,
      newLevel: defenderStats?.level,
      streakCount: defenderStats?.streak,
      message: defenderWon ? 'BREACH SUCCESSFUL. YOU BEAT THE CLOCK.' : 'SYSTEM LOCKED. CHALLENGER HOLDS THE LINE.' 
    });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

// ============================
// 👤 USER PROFILE FETCH
// ============================
app.get('/user/:id', authenticateToken, async (req, res) => {
  try {
    // Only allow users to fetch their own data
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const { data, error } = await supabase.from('users')
      .select('id, username, email, coins, streak, level, xp, is_admin, total_played, total_correct, city, area, avatar_url')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user: data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
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
