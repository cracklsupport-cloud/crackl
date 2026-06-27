const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { checkTypedAnswer, model: geminiModel } = require('./gemini');
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
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'https://crackl.app'];
const isLocalWebOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
app.use(cors({ origin: (origin, callback) => {
  if (!origin || origin === 'null' || allowedOrigins.includes(origin) || isLocalWebOrigin(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Blocked by CORS'));
  }
}}));
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
  return [requested, requested - 1, requested + 1, requested - 2, requested + 2]
    .filter((value, index, arr) => value >= 1 && value <= 5 && arr.indexOf(value) === index);
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
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function getAdminPanicTimerSeconds() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'panic_timer_seconds')
    .single();
  const parsed = parseInt(data?.value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
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
    return nextTotal;
  }

  return getUserCoins(userId);
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

async function fetchProtectedRiddleRecord(riddleId, fields = 'id, answer, question, options, difficulty, difficulty_tier, hint, region, category') {
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
  const poolMode = modeOverride || getBaseDeliveryMode(requestedMode);
  const tier = tierOverride ?? await resolveRequestedTier({ userId, requestedMode, xp, totalPlayed });
  const categoryExclude = await pickWithCategoryRotation(userId);

  let data = null;
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
  let riddle = normalizeRiddleRecord(row, poolMode);
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
  if (!riddle) {
    return { riddle: null, tier, poolMode };
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

  return { riddle, tier, poolMode };
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

  const poolMode = getBaseDeliveryMode(mode);
  const bothSeenSet = new Set(bothSeen);
  const candidateMap = new Map();
  const perTierLimit = Math.max(queueSize * 3, 20);

  for (const tierToTry of buildTierSearchOrder(difficultyTier)) {
    let query = supabase
      .from('riddles_safe')
      .select('*')
      .eq('game_mode', poolMode)
      .eq('difficulty_tier', tierToTry)
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
    .map((row) => normalizeRiddleRecord(row, poolMode));

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

  const snapshotted = runtime.queueSnapshot?.find((entry) => entry.id === room.current_riddle_id);
  if (snapshotted) {
    let timeLimit = runtime.currentTimeLimit;
    if (timeLimit && runtime.roundStartedAt) {
      const elapsed = Math.max(0, Math.floor((Date.now() - runtime.roundStartedAt) / 1000));
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

  let timeLimit = runtime.currentTimeLimit;
  if (timeLimit && runtime.roundStartedAt) {
    const elapsed = Math.max(0, Math.floor((Date.now() - runtime.roundStartedAt) / 1000));
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
      const { data: user } = await supabase.from('users').select('coins').eq('id', player.user_id).single();
      if (!user || (user.coins || 0) < wagerAmount) {
        throw new Error(`${player.username} does not have ${wagerAmount} Intel to cover this showdown.`);
      }
      await incrementCoinsAtomic(player.user_id, -wagerAmount);
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

async function refundRoomWagers(roomId) {
  const runtime = getRoomRuntime(roomId);
  const balances = {};
  for (const [userId, wager] of runtime.escrow.entries()) {
    balances[userId] = await incrementCoinsAtomic(userId, wager);
  }
  runtime.escrow.clear();
  runtime.showdownComplete = true;
  return balances;
}

function consumeRoomWagerPot(roomId) {
  const runtime = getRoomRuntime(roomId);
  let pot = 0;
  for (const wager of runtime.escrow.values()) {
    pot += wager;
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

// Check admin secret (header-based, for admin routes)
const checkAdmin = (req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
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

// ============================
// 👑 ADMIN ROUTES
// ============================

// Real-time overview stats
app.get('/admin/stats', checkAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [riddlesRes, locksRes, usersRes, maintRes, panicTimerRes] = await Promise.all([
      supabase.from('riddles').select('id, game_mode, difficulty, difficulty_tier, is_active, is_onboarding'),
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
    modes.forEach(m => { byMode[m] = riddles.filter(r => r.game_mode === m && r.is_active).length; });

    const byDifficulty = {};
    difficulties.forEach(d => { byDifficulty[d] = riddles.filter(r => r.difficulty === d && r.is_active).length; });
    const byTier = {};
    [1, 2, 3, 4, 5].forEach(t => { byTier[t] = riddles.filter(r => (parseInt(r.difficulty_tier, 10) || getDifficultyTierFromLegacyDifficulty(r.difficulty)) === t && r.is_active).length; });

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

app.post('/admin/panic-timer', checkAdmin, async (req, res) => {
  try {
    const raw = parseInt(req.body?.seconds, 10);
    if (!Number.isFinite(raw) || raw <= 0) {
      return res.status(400).json({ success: false, error: 'Timer must be a positive number of seconds.' });
    }
    await supabase
      .from('app_settings')
      .upsert({ key: 'panic_timer_seconds', value: String(raw) }, { onConflict: 'key' });
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
      supabase.from('riddles').select('id, game_mode, difficulty, difficulty_tier, is_active, is_onboarding'),
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
      [1, 2, 3, 4, 5].forEach(t => {
        const active = riddles.filter(r => (
          r.game_mode === m
          && r.is_active
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
const VALID_GAME_MODES = ['mcq', 'type', 'arena', 'daily', 'gauntlet', 'chain', 'wager', 'bounty'];
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const VALID_RIDDLE_TYPES = ['text', 'image_text', 'image_only', 'audio_text', 'video_text', 'interactive'];
const MEDIA_RIDDLE_TYPES = ['image_text', 'image_only', 'audio_text', 'video_text', 'interactive'];

function parseAdminJsonField(value, fieldName) {
  if (value == null || value === '') return { value: null };
  if (typeof value !== 'string') return { value };
  try {
    return { value: JSON.parse(value) };
  } catch {
    return { error: `${fieldName} must be valid JSON when provided as text.` };
  }
}

function normalizeStoredMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:'].includes(parsed.protocol) ? raw : null;
  } catch {
    return null;
  }
}

app.post('/admin/riddle/add', checkAdmin, async (req, res) => {
  try {
    const { riddles } = req.body;
    const riddlesArray = Array.isArray(riddles) ? riddles : [riddles];
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
        panic_time: r.panic_time || null,
        is_onboarding: r.is_onboarding === true,
        is_active: true,
        times_served: 0,
        riddle_type: riddleType,
        media_url: mediaUrl,
        layout_config: layoutConfig || null,
      };
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
    const allowedFields = new Set([
      'question', 'answer', 'game_mode', 'difficulty', 'difficulty_tier', 'region',
      'options', 'hint', 'category', 'fun_fact', 'explanation', 'family_id',
      'panic_time', 'is_onboarding', 'is_active', 'riddle_type', 'media_url', 'layout_config'
    ]);
    const updates = {};
    Object.entries(req.body || {}).forEach(([key, value]) => {
      if (allowedFields.has(key)) updates[key] = value;
    });
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
    if (updates.options != null && !Array.isArray(updates.options)) {
      return res.status(400).json({ success: false, error: 'options must be an array when provided.' });
    }
    if (updates.layout_config != null && (typeof updates.layout_config !== 'object' || Array.isArray(updates.layout_config))) {
      return res.status(400).json({ success: false, error: 'layout_config must be an object when provided.' });
    }
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

// Upload media for riddles — saves to Supabase Storage
app.post('/admin/upload', checkAdmin, upload.single('file'), async (req, res) => {
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
    const fileName = `riddle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
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
    res.json({ success: true, url: urlData.publicUrl, path: filePath, mediaKind, mimeType: contentType });
  } catch (error) {
    console.error('❌ /admin/upload:', error.message);
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

  const timeLimit = panicMode ? await getAdminPanicTimerSeconds() : null;
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
        const timeLimit = panicMode ? await getAdminPanicTimerSeconds() : null;
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
    const actorId = resolveAuthenticatedActorId(req, req.body.userId);
    const { riddleId, userAnswer, timeTaken, mode, gameMode, panicMode } = req.body;
    const userId = actorId;
    if (!userId || !riddleId) {
      return res.status(400).json({ success: false, error: 'Missing required payload parameters: userId, riddleId' });
    }
    const effectiveGameMode = gameMode || mode || 'arena';
    const servedHistory = await resolveServedRiddleGuard({ userId, riddleId, mode: effectiveGameMode });
    console.log(`\n📝 Answer | riddleId: ${riddleId} | mode: ${effectiveGameMode}`);

    const riddle = await fetchProtectedRiddleRecord(riddleId, 'id, answer, difficulty, difficulty_tier, question, explanation, fun_fact');
    if (!riddle) throw new Error('Riddle not found');
    const timing = await resolvePanicSubmissionState({
      panicMode: !!panicMode,
      userId,
      riddleId,
      clientTimeTaken: timeTaken
    });

    let isCorrect = false;
    if (mode === 'type') {
      isCorrect = await checkTypedAnswer(userAnswer, riddle.answer, riddle.question || '');
    } else {
      isCorrect = isAnswerCorrect(userAnswer, riddle.answer);
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

    try {
      await supabase.from('solved_riddles').insert({ user_id: userId, riddle_id: riddleId, was_correct: isCorrect });
    } catch {}

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
      ranked
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
    const { username } = req.body;
    if (!username) return res.json({ success: false, error: 'Username required' });
    const { data } = await supabase.from('users').select('id').ilike('username', username).maybeSingle();
    res.json({ success: true, available: !data });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
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
      .insert({ username, email, password_hash: passwordHash, is_verified: true, coins: 100, streak: 0, level: 'Novice', xp: 0, total_played: 0, total_correct: 0, city: 'Global', area: 'Arena', is_admin: false })
      .select('id, username, email, coins, streak, level, xp, is_admin, total_played, total_correct, city, area').single();

    if (error || !data) throw new Error(error ? error.message : 'Database error: no data returned from signup insert');

    const token = jwt.sign({ id: data.id, username: data.username }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`👤 New User Signed Up: ${data.username} | College: ${resolvedCollege}`);
    res.json({ success: true, user: data, token });
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

    const token = jwt.sign({ id: data.id, username: data.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, user: data, token });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) return res.status(400).json({ success: false, error: 'All fields required' });

    const { data: user, error } = await supabase.from('users')
      .select('*')
      .or(`email.eq.${loginId},username.ilike.${loginId}`)
      .maybeSingle();

    // Block non-admin logins during maintenance
    if (user && !user.is_admin) {
      const { data: maintData } = await supabase.from('app_settings').select('value').eq('key', 'maintenance_mode').single();
      if (maintData?.value === 'true') {
        return res.status(503).json({ success: false, maintenance: true, error: 'CRACKL is under maintenance right now. Check back soon!' });
      }
    }

    if (error || !user) {
      console.log(`🔒 Login FAILED | loginId: "${loginId}" | DB error: ${error?.message || 'User not found'}`);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    if (!user.password_hash) return res.status(401).json({ success: false, error: 'Legacy account. Please use Sign Up or reset password.' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ success: false, error: 'Wrong password' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`🔑 User Logged In: ${user.username}`);

    delete user.password_hash;
    delete user.reset_token;
    delete user.verification_token;

    res.json({ success: true, user, token });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/auth/oauth', async (req, res) => {
  try {
    const { provider, token: oauthToken } = req.body;
    if (!provider || !oauthToken) return res.status(400).json({ success: false, error: 'Missing provider or token' });

    let email, name;

    if (provider === 'google') {
      // Verify Google ID token cryptographically
      const ticket = await googleClient.verifyIdToken({
        idToken: oauthToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(400).json({ success: false, error: 'Invalid Google token' });
      }
      email = payload.email;
      name = payload.name || email.split('@')[0];
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
      email = decoded.payload.email;
      name = decoded.payload.name || email.split('@')[0];
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported OAuth provider' });
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
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
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

    let updates = {};
    if (username !== undefined) {
      const cleanUsername = String(username).trim();
      if (cleanUsername.length < 3 || cleanUsername.length > 32) {
        return res.status(400).json({ success: false, error: 'Username must be 3-32 characters.' });
      }
      updates.username = cleanUsername;
    }
    if (avatar_url !== undefined) {
      if (typeof avatar_url === 'string' && avatar_url.length > 500_000) {
        return res.status(400).json({ success: false, error: 'Avatar too large (max ~375KB)' });
      }
      updates.avatar_url = avatar_url;
    }

    if (Object.keys(updates).length === 0) return res.json({ success: true });

    const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
    if (error) throw error;

    if (updates.username) {
      await supabase.from('leaderboard').update({ username: updates.username }).eq('user_id', userId);
    }

    delete data.password_hash;
    res.json({ success: true, user: data });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.get('/leaderboard/:city', async (req, res) => {
  try {
    const { data } = await supabase
      .from('leaderboard')
      .select('username, coins, city')
      .eq('city', req.params.city)
      .eq('week_start', getCurrentWeekStartDate())
      .order('coins', { ascending: false })
      .limit(20);
    res.json({ success: true, leaderboard: data || [] });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.get('/leaderboard/global/top', async (req, res) => {
  try {
    const { data } = await supabase
      .from('leaderboard')
      .select('username, coins, city')
      .eq('week_start', getCurrentWeekStartDate())
      .order('coins', { ascending: false })
      .limit(20);
    res.json({ success: true, leaderboard: data || [] });
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
    const hostId = resolveAuthenticatedActorId(req, req.body.hostId);
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
    const roomId = makeRoomId();
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
    const { roomId } = req.body;
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
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
    const actorId = resolveAuthenticatedActorId(req, req.query.userId);
    await assertRoomMembership(req.params.roomId, actorId);
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', req.params.roomId).single();
    const runtime = getRoomRuntime(req.params.roomId);
    const players = await getRoomPlayers(req.params.roomId);
    const currentRiddle = await hydrateRoomRiddle(room, runtime);
    const currentUserCoins = actorId ? await getUserCoins(actorId) : null;
    const wagerAmount = resolveRoomWagerAmount(req.params.roomId, room);
    res.json({
      success: true,
      room: { ...room, wager_amount: wagerAmount },
      players,
      currentRiddle,
      roundSummary: runtime.roundSummary,
      currentUserCoins
    });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/room/start', authenticateToken, checkMaintenance, async (req, res) => {
  try {
    const { roomId, xp } = req.body;
    const hostId = resolveAuthenticatedActorId(req, req.body.hostId);
    await assertRoomMembership(roomId, hostId);
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (room.host_id !== hostId) return res.json({ success: false, error: 'Only host can start' });
    const runtime = clearRoomRuntimeRound(roomId);
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
        await refundRoomWagers(roomId);
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
      finalTimeLimit = room.time_limit === -1 ? await getAdminPanicTimerSeconds() : room.time_limit;
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
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/room/answer', authenticateToken, async (req, res) => {
  try {
    const { roomId, userAnswer, timeTaken } = req.body;
    const userId = resolveAuthenticatedActorId(req, req.body.userId);
    if (!roomId || !userId) {
      return res.status(400).json({ success: false, error: 'Missing roomId or userId' });
    }
    await assertRoomMembership(roomId, userId);
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    const runtime = getRoomRuntime(roomId);
    const riddle = await fetchProtectedRiddleRecord(room.current_riddle_id, 'id, answer, question, options, difficulty, difficulty_tier');
    if (!riddle) return res.json({ success: false, error: 'The active riddle could not be found.' });

    let players = await getRoomPlayers(roomId);
    const existingPlayer = players.find((player) => player.user_id === userId);
    if (!existingPlayer) {
      return res.status(403).json({ success: false, error: 'This room is restricted to joined operatives only.' });
    }

    if (room.status === 'revealed' && runtime.roundSummary) {
      return res.json({
        success: true,
        ...runtime.roundSummary,
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

    const limit = runtime.currentTimeLimit || (room.timed ? (room.time_limit === -1 ? await getAdminPanicTimerSeconds() : room.time_limit) : null);
    const roundAge = runtime.roundStartedAt ? Math.max(0, Math.floor((Date.now() - runtime.roundStartedAt) / 1000)) : 0;
    const submittedTime = Math.max(parseInt(timeTaken, 10) || 0, roundAge);
    const isLate = !!limit && room.timed && submittedTime >= limit;
    const usesTypedInput = room.mode === 'type' || !Array.isArray(riddle.options) || riddle.options.length === 0;
    const answeredCorrectly = usesTypedInput
      ? await checkTypedAnswer(userAnswer, riddle.answer, riddle.question || '')
      : isAnswerCorrect(userAnswer, riddle.answer);
    const isCorrect = !isLate && answeredCorrectly;
    const rewardDifficulty = getRewardDifficultyLabel(riddle);
    const baseCoins = rewardDifficulty === 'Easy' ? 10 : rewardDifficulty === 'Medium' ? 25 : 50;
    const baseCoinsEarned = isCorrect ? Math.round(baseCoins * (room.mode === 'type' ? 1.5 : 1)) : 0;
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

    await updateRiddleHistory({
      userId,
      riddleId: room.current_riddle_id,
      mode: room.mode || 'arena',
      status: isCorrect ? 'solved' : ((isLate || userAnswer === '__timeout__') ? 'timed_out' : 'failed'),
      timeTakenMs: Number.isFinite(submittedTime) ? submittedTime * 1000 : null,
      sessionId: roomId
    });

    let answerRevealLock = false;
    if (isCorrect) {
      answerRevealLock = await tryRevealRoom(roomId);
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
        wagerPot = runtime.wagerAmount > 0 ? consumeRoomWagerPot(roomId) : 0;
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
          showdownComplete: runtime.wagerAmount > 0
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
        if (runtime.wagerAmount > 0) {
          const balances = await refundRoomWagers(roomId);
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
          showdownComplete: runtime.wagerAmount > 0
        };
      }
    }

    if (summary) {
      runtime.roundSummary = summary;
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
    const { roomId } = req.body;
    const hostId = resolveAuthenticatedActorId(req, req.body.hostId);
    await assertRoomMembership(roomId, hostId);
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (room.host_id !== hostId) return res.json({ success: false, error: 'Only host can give up' });
    const runtime = getRoomRuntime(roomId);
    const riddle = await fetchProtectedRiddleRecord(room.current_riddle_id, 'id, answer');
    let refunded = false;
    if (runtime.wagerAmount > 0 && runtime.escrow.size > 0) {
      await refundRoomWagers(roomId);
      refunded = true;
    }
    runtime.roundSummary = {
      correctAnswer: riddle.answer,
      gaveUp: true,
      resolved: true,
      refunded,
      showdownComplete: runtime.wagerAmount > 0
    };
    const { error: giveupRevealErr } = await supabase.from('multiplayer_rooms').update({ status: 'revealed' }).eq('id', roomId);
    if (giveupRevealErr) throw giveupRevealErr;
    res.json({ success: true, correctAnswer: riddle.answer, refunded });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); }
});

app.post('/room/next', authenticateToken, checkMaintenance, async (req, res) => {
  try {
    const { roomId, xp } = req.body;
    const hostId = resolveAuthenticatedActorId(req, req.body.hostId);
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
      finalTimeLimit = room.time_limit === -1 ? await getAdminPanicTimerSeconds() : room.time_limit;
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
    const chainId = 'chain_' + Date.now();
    const riddles = [];
    const progress = await getUserProgressProfile(userId);
    const userXp = Number.isFinite(parseInt(xp, 10)) ? parseInt(xp, 10) : progress.xp;
    const tierSequence = [1, 1, 3, 3, 5];
    for (let i = 0; i < 5; i++) {
      const { riddle } = await fetchNextRiddleFromEngine({
        userId,
        xp: userXp + (i * 100),
        totalPlayed: progress.totalPlayed + i,
        requestedMode: 'chain',
        tierOverride: tierSequence[i]
      });
      if (!riddle) {
        return res.json({ success: false, error: `Not enough chain riddles available (got ${i}/5). Admin needs to add more Chain riddles.` });
      }
      riddles.push(riddle);
    }

    await supabase.from('chain_progress').upsert({ user_id: userId, chain_id: chainId, step: 0, completed: false }, { onConflict: 'user_id,chain_id' });

    console.log(`🔗 Chain Started | ${userId} | ${chainId}`);
    const timeLimit = panicMode ? await getAdminPanicTimerSeconds() : null;
    const serializedRiddles = riddles.map((entry) => serializeRiddlePayload(entry, timeLimit));
    const queueIds = riddles.map(r => r.id);
    res.json({
      success: true,
      chainId,
      totalSteps: 5,
      currentStep: 0,
      riddle: serializedRiddles[0],
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
    const riddle = await fetchProtectedRiddleRecord(riddleId, 'id, answer, difficulty, difficulty_tier, question, options');
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
    let isCorrect = usesTypedInput
      ? await checkTypedAnswer(userAnswer, riddle.answer, riddle.question || '')
      : isAnswerCorrect(userAnswer, riddle.answer);
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

    // Atomic coin + xp update via RPC — no race conditions
    const { error: rpcErr } = await supabase.rpc('increment_user_stats', {
      p_user_id: userId,
      p_coins_delta: coinsEarned,
      p_xp_delta: xpGain,
      p_streak: null,   // don't touch streak in chain mode
      p_played_delta: 1,
      p_correct_delta: 1
    });
    if (rpcErr) {
      // Fallback: use increment_coins RPC if increment_user_stats is not yet deployed
      console.warn('⚠️ chain/answer increment_user_stats fallback:', rpcErr.message);
      const { error: coinErr } = await supabase.rpc('increment_coins', { p_user_id: userId, p_coins_delta: coinsEarned });
      if (coinErr) {
        // Final fallback: direct update with optimistic lock
        const { data: u2 } = await supabase.from('users').select('coins, xp').eq('id', userId).single();
        if (u2) {
          await supabase.from('users')
            .update({ coins: (u2.coins || 0) + coinsEarned, xp: (u2.xp || 0) + xpGain })
            .eq('id', userId);
        }
      }
    }

    const { data: finalUser } = await supabase
      .from('users')
      .select('coins, xp, level, streak')
      .eq('id', userId)
      .single();

    const nextRiddle = completed ? null : await fetchSafeRiddleById(queueIds[nextStep], 'chain');
    const nextPayload = nextRiddle ? serializeRiddlePayload(nextRiddle, chainState.limitSeconds || null) : null;
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
        limitSeconds: chainState.limitSeconds || null
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

	    const { error: rpcErr } = await supabase.rpc('increment_coins', { p_user_id: userId, p_coins_delta: -wager });
	    if (rpcErr) {
	      const fallbackTotal = Math.max(0, (user.coins || 0) - wager);
	      await supabase.from('users').update({ coins: fallbackTotal }).eq('id', userId);
	      console.warn('⚠️ wager/start RPC fallback executed');
	    }

	    const { data: finalUser } = await supabase.from('users').select('coins').eq('id', userId).single();
	    if (finalUser && finalUser.coins < 0) {
	      await supabase.rpc('increment_coins', { p_user_id: userId, p_coins_delta: wager }).catch(() => {});
	      return res.json({ success: false, error: 'Wager overlap detected. Try again after your balance refreshes.' });
	    }
	    const timeLimit = panicMode ? await getAdminPanicTimerSeconds() : null;

	    res.json({
	      success: true,
	      wager,
	      wagerToken: issueWagerToken({ userId, riddleId: riddle.id, wager, panicMode: !!panicMode, limitSeconds: timeLimit }),
	      newTotal: finalUser ? finalUser.coins : Math.max(0, (user.coins || 0) - wager),
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
    const wager = Math.abs(parseInt(tokenState.wager, 10) || 0);
    if (!userId || !riddleId || wager <= 0) return res.status(400).json({ success: false, error: 'Invalid wager settlement.' });
    await resolveServedRiddleGuard({ userId, riddleId, mode: 'wager' });

    // Server-side answer re-verification — never trust client-sent isCorrect
    const riddle = await fetchProtectedRiddleRecord(riddleId, 'id, answer, question, options');
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
    let isCorrect = usesTypedInput
      ? await checkTypedAnswer(userAnswer, riddle.answer, riddle.question || '')
      : isAnswerCorrect(userAnswer, riddle.answer);
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

    const { data: user } = await supabase.from('users').select('coins').eq('id', userId).single();
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const panicBonus = isCorrect && tokenState.panicMode ? getPanicIntelBonus({ gameMode: 'wager', wager }) : 0;
    const delta = isCorrect ? (wager * 2) + panicBonus : 0;
    const xpGain = isCorrect ? 15 : 2;

    // ATOMIC update
    const { error: rpcErr } = await supabase.rpc('increment_coins', { p_user_id: userId, p_coins_delta: delta });
    if (rpcErr) {
       // Fallback
       const newCoins = Math.max(0, (user.coins || 0) + delta);
       await supabase.from('users').update({ coins: newCoins }).eq('id', userId);
       console.warn('⚠️ wager/settle RPC fallback executed');
    }

    const { error: statsErr } = await supabase.rpc('increment_user_stats', {
      p_user_id: userId,
      p_coins_delta: 0,
      p_xp_delta: xpGain,
      p_streak: null,
      p_played_delta: 1,
      p_correct_delta: isCorrect ? 1 : 0
    });
    if (statsErr) {
      console.warn('⚠️ wager/settle stats fallback:', statsErr.message);
      const fallbackXp = (parseInt(user.xp, 10) || 0) + xpGain;
      await supabase.from('users')
        .update({ xp: fallbackXp, level: calculateLevel(fallbackXp), total_played: (user.total_played || 0) + 1, total_correct: (user.total_correct || 0) + (isCorrect ? 1 : 0) })
        .eq('id', userId);
    }

    const { data: finalUser } = await supabase.from('users').select('coins, xp, level, streak').eq('id', userId).single();
    const newCoins = finalUser ? finalUser.coins : 0;

	    console.log(`🎰 Wager | ${userId} | ${isCorrect ? 'WIN' : 'LOSE'} | ${delta > 0 ? '+' : ''}${delta} coins`);
	    res.json({
	      success: true,
	      isCorrect,
	      correctAnswer: riddle.answer,
	      delta,
	      coinsChange: 0,
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

    const result = await geminiModel.generateContent(prompt);
    const oracleHint = result.response.text().trim();

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

    const result = await geminiModel.generateContent(prompt);
    const paidHint = result.response.text().trim();

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
    const isCorrect = !timing.isLate && userAnswer !== '__timeout__' && await checkTypedAnswer(userAnswer, bounty.answer, bounty.question || '');

    if (!isCorrect) return res.json({ success: true, isCorrect: false, message: 'Incorrect! Keep trying...' });

    // Atomically lock the bounty logic
    const { data: claimed, error: clErr } = await supabase.from('bounty_board')
      .update({ solved_by: username, solved_at: new Date().toISOString(), active: false })
      .eq('id', bountyId)
      .eq('active', true)
      .select().single();
      
    if (!claimed || clErr) return res.json({ success: false, error: 'Very close! The bounty was literally just solved by someone else!' });

    const panicBonus = panicMode ? getPanicIntelBonus({ gameMode: 'bounty', bountyPrize: bounty.prize_coins }) : 0;
    const totalPrize = bounty.prize_coins + panicBonus;

    // Atomic coin award
    const { error: rpcErr } = await supabase.rpc('increment_coins', { p_user_id: userId, p_coins_delta: totalPrize });
    if (rpcErr) {
      // Fallback if RPC not deployed
      const { data: u } = await supabase.from('users').select('coins').eq('id', userId).single();
      if (u) await supabase.from('users').update({ coins: (u.coins || 0) + totalPrize }).eq('id', userId);
    }

    const { data: updatedUser } = await supabase.from('users').select('coins').eq('id', userId).single();
    console.log(`🏆 BOUNTY SOLVED! ${username} wins ${totalPrize} coins!`);
    res.json({
      success: true,
      isCorrect: true,
      prize: totalPrize,
      panicBonus,
      newTotal: updatedUser?.coins,
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
      const { data: user } = await supabase.from('users').select('coins').eq('id', actorId).single();
      if (!user || user.coins < wagerAmount) return res.json({ success: false, error: 'Insufficient Intel for this wager.' });

      // Atomic escrow via RPC
      const { error: rpcErr } = await supabase.rpc('increment_coins', { p_user_id: actorId, p_coins_delta: -wagerAmount });
      if (rpcErr) {
        // Fallback
        await supabase.from('users').update({ coins: user.coins - wagerAmount }).eq('id', actorId);
      }
    }

    const { data: riddleExists, error: riddleErr } = await supabase
      .from('riddles_safe')
      .select('id')
      .eq('id', riddleId)
      .maybeSingle();
    if (riddleErr || !riddleExists) {
      if (wagerAmount > 0) await supabase.rpc('increment_coins', { p_user_id: actorId, p_coins_delta: wagerAmount }).catch(() => {});
      return res.status(404).json({ success: false, error: 'Challenge riddle is unavailable.' });
    }

    const { data: solveHistory } = await supabase
      .from('user_riddle_history')
      .select('status')
      .eq('user_id', actorId)
      .eq('riddle_id', riddleId)
      .maybeSingle();
    if (!solveHistory || solveHistory.status !== 'solved') {
      if (wagerAmount > 0) await supabase.rpc('increment_coins', { p_user_id: actorId, p_coins_delta: wagerAmount }).catch(() => {});
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
	        await supabase.rpc('increment_coins', { p_user_id: actorId, p_coins_delta: wagerAmount }).catch(() => {});
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

    const riddle = await fetchProtectedRiddleRecord(activeChallenge.riddle_id, 'id, answer, question, options');
    if (!riddle) return res.status(404).json({ success: false, error: 'Challenge riddle not found.' });
    const usesTypedInput = !Array.isArray(riddle.options) || riddle.options.length < 2;
    const isVerifiedCorrect = usesTypedInput
      ? await checkTypedAnswer(userAnswer, riddle.answer, riddle.question || '')
      : isAnswerCorrect(userAnswer, riddle.answer);
    
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

    // Distribute Wager Pool — atomic coin updates
    if (challenge.wager_amount > 0) {
      const prizePool = challenge.wager_amount * 2;
      const winnerId = defenderWon ? actorId : challenge.challenger_id;
      const { error: rpcErr } = await supabase.rpc('increment_coins', { p_user_id: winnerId, p_coins_delta: prizePool });
      if (rpcErr) {
        // Fallback
        const { data: winner } = await supabase.from('users').select('coins').eq('id', winnerId).single();
        if (winner) await supabase.from('users').update({ coins: winner.coins + prizePool }).eq('id', winnerId);
      }
    }

    res.json({ 
      success: true, 
      defenderWon, 
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
