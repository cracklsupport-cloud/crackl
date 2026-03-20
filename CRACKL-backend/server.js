const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { generateRiddle, checkTypedAnswer, CATEGORIES } = require('./gemini');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

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

app.get('/', (req, res) => res.json({ status: 'CRACKL running!', categories: CATEGORIES.length }));

app.post('/riddle', async (req, res) => {
  try {
    const { userId, city, area, xp } = req.body;
    console.log(`\n🎯 Riddle | ${area}, ${city} | XP: ${xp || 0}`);
    const g = await generateRiddle(city || 'Chennai', area || 'Vidyaranyapura', xp || 0);
    const { data: saved, error } = await supabase
      .from('riddles')
      .insert({ question: g.question, answer: g.answer, options: g.options, category: g.category, difficulty: g.difficulty, hint: g.hint })
      .select('id, question, answer, options, category, difficulty, hint')
      .single();
    if (error) throw error;
    console.log(`💾 Saved | Answer: "${saved.answer}"`);
    res.json({ success: true, riddle: { id: saved.id, question: saved.question, options: saved.options, category: saved.category, difficulty: saved.difficulty, hint: saved.hint, fun_fact: g.fun_fact, explanation: g.explanation, timeLimit: saved.difficulty === 'Easy' ? 30 : saved.difficulty === 'Medium' ? 45 : 60 } });
  } catch (error) {
    console.error('❌ /riddle:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/answer', async (req, res) => {
  try {
    const { userId, riddleId, userAnswer, timeTaken, mode } = req.body;
    console.log(`\n📝 Answer | riddleId: ${riddleId} | user: "${userAnswer}" | mode: ${mode}`);

    // Get the riddle answer from DB
    const { data: riddle, error: riddleErr } = await supabase
      .from('riddles')
      .select('id, answer, difficulty, question')
      .eq('id', riddleId)
      .single();

    if (riddleErr || !riddle) throw new Error('Riddle not found');
    console.log(`📖 Correct answer: "${riddle.answer}"`);

    // Check if answer is correct
    let isCorrect = false;
    if (mode === 'type') {
      isCorrect = await checkTypedAnswer(userAnswer, riddle.answer, riddle.question || '');
    } else {
      const u = (userAnswer || '').toLowerCase().trim();
      const c = (riddle.answer || '').toLowerCase().trim();
      isCorrect = u === c || u.includes(c) || c.includes(u);
    }
    console.log(`${isCorrect ? '✅ CORRECT' : '❌ WRONG'} | User: "${userAnswer}" | Correct: "${riddle.answer}"`);

    // Calculate coins
    const baseCoins = riddle.difficulty === 'Easy' ? 10 : riddle.difficulty === 'Medium' ? 25 : 50;
    const modeMultiplier = mode === 'type' ? 1.5 : 1;
    let coinsChange = isCorrect ? Math.round(baseCoins * modeMultiplier) : -5;
    const elapsed = parseInt(timeTaken) || 0;
    if (isCorrect && elapsed < 10) coinsChange += 20;
    else if (isCorrect && elapsed < 15) coinsChange += 10;

    // Try to get user — but DON'T crash if not found
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
        // User not in DB — auto-create them so future requests work
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

    // Always log the answer attempt
    try {
      await supabase.from('solved_riddles').insert({ user_id: userId, riddle_id: riddleId, was_correct: isCorrect });
    } catch {}

    // ✅ ALWAYS return correctAnswer — no matter what happened above
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

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const JWT_SECRET = process.env.JWT_SECRET || 'crackl-super-secret-jwt-key-2026';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'crackl@example.com',
    pass: process.env.EMAIL_PASS || 'password'
  }
});

// Middleware to protect routes (optional for future use)
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
      const { username, email, password } = req.body;
      if (!username || !email || !password) return res.status(400).json({ success: false, error: 'All fields required' });
      
      const { data: existingUser } = await supabase.from('users').select('id').or(`email.eq.${email},username.ilike.${username}`).maybeSingle();
      if (existingUser) return res.status(400).json({ success: false, error: 'Email or Username already in use' });
  
      const passwordHash = await bcrypt.hash(password, 10);
  
      const { data, error } = await supabase.from('users')
        .insert({ username, email, password_hash: passwordHash, is_verified: true, coins: 100, streak: 0, level: 'Novice', xp: 0, total_played: 0, total_correct: 0, city: 'Global', area: 'Arena' })
        .select('id, username, email, coins, streak, level, xp').single();
        
      if (error) throw error;

      const token = jwt.sign({ id: data.id, username: data.username }, JWT_SECRET, { expiresIn: '30d' });
      console.log(`👤 New User Signed Up (Auto-Verified): ${data.username}`);
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
      .select('id, username, email, coins, streak, level, xp').single();
      
    if (error) throw error;

    const token = jwt.sign({ id: data.id, username: data.username }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`✅ User Verified & Logged In: ${data.username}`);
    res.json({ success: true, user: data, token });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { loginId, password } = req.body; // loginId can be email or username
    if (!loginId || !password) return res.status(400).json({ success: false, error: 'All fields required' });

    const { data: user, error } = await supabase.from('users')
      .select('*')
      .or(`email.eq.${loginId},username.eq.${loginId}`)
      .maybeSingle();

    if (error || !user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    
    // Fallback for old users who don't have a password set yet
    if (!user.password_hash) return res.status(401).json({ success: false, error: 'Legacy account. Please use Sign Up to securely claim this tag or reset password.' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ success: false, error: 'Wrong password' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`🔑 User Logged In: ${user.username}`);
    
    // Strip sensitive info before sending to client
    delete user.password_hash;
    delete user.reset_token;
    
    res.json({ success: true, user, token });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/auth/oauth', async (req, res) => {
  try {
    const { provider, token: oauthToken } = req.body;
    if (!provider || !oauthToken) return res.status(400).json({ success: false, error: 'Missing provider or token' });

    // Note: In production with real Client IDs, you would verify the JWT signature here.
    // For Google: using google-auth-library
    // For Apple: using apple-signin-auth
    // Since we are scaffolding, we will decode the payload (which contains email) to mock the sync.
    const decoded = jwt.decode(oauthToken);
    if (!decoded || !decoded.email) {
      return res.status(400).json({ success: false, error: 'Invalid OAuth token received' });
    }

    const email = decoded.email;
    const name = decoded.name || email.split('@')[0];

    // Check if user exists
    let { data: user, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();

    if (!user) {
      // Auto Sign-Up for OAuth
      const { data: newUser, insertErr } = await supabase.from('users')
        .insert({
          username: name + Math.floor(Math.random() * 9999), 
          email: email,
          is_verified: true,
          coins: 100, streak: 0, level: 'Novice', xp: 0, total_played: 0, total_correct: 0, city: 'Global', area: 'Arena'
        })
        .select('*').single();
      
      if (insertErr) throw insertErr;
      user = newUser;
      console.log(`👤 New OAuth User Signed Up: ${user.username} (${provider})`);
    } else {
      console.log(`🔑 OAuth Log In: ${user.username} (${provider})`);
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    
    // Strip sensitive info before sending
    delete user.password_hash;
    delete user.reset_token;
    
    res.json({ success: true, user, token });
  } catch (error) {
    console.error('❌ /auth/oauth:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const crypto = require('crypto');

app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });

    const { data: user } = await supabase.from('users').select('id, username').eq('email', email).maybeSingle();
    if (!user) {
      // Return success anyway to prevent email enumeration attacks
      return res.json({ success: true, message: 'If that email exists, an OTP was sent.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    await supabase.from('users')
      .update({ reset_token: otp, reset_token_expires: tokenExpires })
      .eq('id', user.id);

    console.log(`📧 Simulated Password Reset OTP Sent to ${email}: Verification Code is ${otp}`);

    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail({
          from: '"CRACKL Arena" <' + process.env.EMAIL_USER + '>',
          to: email,
          subject: 'CRACKL Password Reset OTP',
          text: `You requested a password reset.\n\nYour 6-digit verification code is: ${otp}\n\nEnter this code in the app to reset your password.`
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
    
    await supabase.from('users')
      .update({ password_hash: passwordHash, reset_token: null, reset_token_expires: null })
      .eq('id', user.id);

    console.log(`🔒 Password reset successful for user ID ${user.id}`);
    res.json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/user/create', async (req, res) => {
  // Legacy support for backward compatibility if needed temporarily during dev
  try {
    const { id, username, city, area } = req.body;
    const { data, error } = await supabase.from('users')
      .upsert({ id, username, city, area, coins: 100, streak: 0, level: 'Novice', xp: 0, total_played: 0, total_correct: 0 }, { onConflict: 'id' })
      .select().single();
    if (error) throw error;
    res.json({ success: true, user: data });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/user/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*').eq('id', req.params.id).single();
    if (error) throw error;
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

app.post('/room/start', async (req, res) => {
  try {
    const { roomId, hostId, city, area } = req.body;
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (room.host_id !== hostId) return res.json({ success: false, error: 'Only host can start' });
    const g = await generateRiddle(city || 'Chennai', area || 'Vidyaranyapura', 0);
    const { data: saved } = await supabase.from('riddles').insert({ question: g.question, answer: g.answer, options: g.options, category: g.category, difficulty: g.difficulty, hint: g.hint }).select().single();
    await supabase.from('multiplayer_rooms').update({ status: 'playing', current_riddle_id: saved.id }).eq('id', roomId);
    await supabase.from('room_players').update({ answered: false, answer: null, is_correct: null, coins_earned: 0 }).eq('room_id', roomId);
    res.json({ success: true, riddle: { id: saved.id, question: saved.question, options: saved.options, category: saved.category, difficulty: saved.difficulty, hint: saved.hint, fun_fact: g.fun_fact, explanation: g.explanation, timeLimit: room.timed ? room.time_limit : null } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/room/answer', async (req, res) => {
  try {
    const { roomId, userId, userAnswer, timeTaken } = req.body;
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    const { data: riddle } = await supabase.from('riddles').select('id, answer, difficulty, question').eq('id', room.current_riddle_id).single();
    const u = (userAnswer || '').toLowerCase().trim();
    const c = (riddle.answer || '').toLowerCase().trim();
    const isCorrect = u === c || u.includes(c) || c.includes(u);
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

app.post('/room/next', async (req, res) => {
  try {
    const { roomId, hostId, city, area } = req.body;
    const { data: room } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single();
    if (room.host_id !== hostId) return res.json({ success: false, error: 'Only host can continue' });
    const g = await generateRiddle(city || 'Chennai', area || 'Vidyaranyapura', 0);
    const { data: saved } = await supabase.from('riddles').insert({ question: g.question, answer: g.answer, options: g.options, category: g.category, difficulty: g.difficulty, hint: g.hint }).select().single();
    await supabase.from('multiplayer_rooms').update({ status: 'playing', current_riddle_id: saved.id }).eq('id', roomId);
    await supabase.from('room_players').update({ answered: false, answer: null, is_correct: null, coins_earned: 0 }).eq('room_id', roomId);
    res.json({ success: true, riddle: { id: saved.id, question: saved.question, options: saved.options, category: saved.category, difficulty: saved.difficulty, hint: saved.hint, fun_fact: g.fun_fact, explanation: g.explanation, timeLimit: room.timed ? room.time_limit : null } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/cashback', async (req, res) => {
  try {
    const { userId, coinsToRedeem, upiId } = req.body;
    const tiers = [{ coins: 500, inr: 40 }, { coins: 1500, inr: 160 }, { coins: 5000, inr: 800 }, { coins: 15000, inr: 2800 }];
    const tier = tiers.find(t => t.coins === coinsToRedeem);
    if (!tier) return res.json({ success: false, error: 'Invalid tier' });
    const { data: user } = await supabase.from('users').select('coins').eq('id', userId).single();
    if (!user || (user.coins || 0) < coinsToRedeem) return res.json({ success: false, error: 'Not enough coins' });
    await supabase.from('users').update({ coins: user.coins - coinsToRedeem }).eq('id', userId);
    await supabase.from('cashback_requests').insert({ user_id: userId, coins_spent: coinsToRedeem, amount_inr: tier.inr, upi_id: upiId, status: 'pending' });
    res.json({ success: true, message: `₹${tier.inr} cashback requested! Sending to ${upiId} within 7 days.` });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

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
app.post('/daily-riddle', async (req, res) => {
  try {
    const { userId, city, area, xp } = req.body;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: user } = await supabase.from('users').select('last_daily_date, daily_streak').eq('id', userId).maybeSingle();
    
    if (user && user.last_daily_date === today) {
      return res.json({ success: false, alreadyPlayed: true, message: 'Come back tomorrow for your next Daily Drop!' });
    }

    const g = await generateRiddle(city || 'Global', area || 'Arena', xp || 0);
    const { data: saved, error } = await supabase.from('riddles')
      .insert({ question: g.question, answer: g.answer, options: g.options, category: g.category, difficulty: 'Hard', hint: g.hint })
      .select('id, question, answer, options, category, difficulty, hint').single();
    if (error) throw error;

    // Calculate new daily streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newDailyStreak = (user && user.last_daily_date === yesterday) ? (user.daily_streak || 0) + 1 : 1;
    await supabase.from('users').update({ last_daily_date: today, daily_streak: newDailyStreak }).eq('id', userId);

    console.log(`🌅 Daily Drop | ${userId} | Streak: ${newDailyStreak}`);
    res.json({ success: true, riddle: { id: saved.id, question: saved.question, options: saved.options, category: saved.category, difficulty: saved.difficulty, hint: saved.hint, fun_fact: g.fun_fact, explanation: g.explanation, timeLimit: 60 }, dailyStreak: newDailyStreak });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 🔗 THE CHAIN (TREASURE HUNT)
// ============================
app.post('/chain/start', async (req, res) => {
  try {
    const { userId, city, area, xp } = req.body;
    const chainId = 'chain_' + Date.now();
    const riddles = [];

    // Generate 5 linked riddles (each progressively harder)
    for (let i = 0; i < 5; i++) {
      const g = await generateRiddle(city || 'Global', area || 'Arena', (xp || 0) + (i * 100));
      const { data: saved } = await supabase.from('riddles')
        .insert({ question: g.question, answer: g.answer, options: g.options, category: g.category, difficulty: g.difficulty, hint: g.hint })
        .select('id, question, options, category, difficulty, hint').single();
      riddles.push({ id: saved.id, question: saved.question, options: saved.options, category: saved.category, difficulty: saved.difficulty, hint: saved.hint, fun_fact: g.fun_fact, answer: g.answer });
    }

    await supabase.from('chain_progress').upsert({ user_id: userId, chain_id: chainId, step: 0, completed: false }, { onConflict: 'user_id,chain_id' });
    
    console.log(`🔗 Chain Started | ${userId} | ${chainId}`);
    res.json({ success: true, chainId, totalSteps: 5, currentStep: 0, riddle: { ...riddles[0], answer: undefined }, chainAnswers: riddles.map(r => r.answer) });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/chain/answer', async (req, res) => {
  try {
    const { userId, chainId, step, riddleId, userAnswer } = req.body;
    const { data: riddle } = await supabase.from('riddles').select('answer, difficulty').eq('id', riddleId).single();
    const u = (userAnswer || '').toLowerCase().trim();
    const c = (riddle.answer || '').toLowerCase().trim();
    const isCorrect = u === c || u.includes(c) || c.includes(u);
    
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
// 🎰 BLIND WAGER SETTLE
// ============================
app.post('/wager/settle', async (req, res) => {
  try {
    const { userId, wageredCoins, isCorrect } = req.body;
    if (!userId || wageredCoins == null) return res.status(400).json({ success: false, error: 'Missing fields' });

    const { data: user } = await supabase.from('users').select('coins').eq('id', userId).single();
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const delta = isCorrect ? Math.abs(wageredCoins) : -Math.abs(wageredCoins);
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

    // Deduct 150 coins for Oracle
    const { data: user } = await supabase.from('users').select('coins').eq('id', userId).single();
    if (!user || user.coins < 150) return res.json({ success: false, error: 'Not enough coins! Oracle costs 150 coins.' });
    await supabase.from('users').update({ coins: user.coins - 150 }).eq('id', userId);

    // Generate a cryptic AI hint
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `You are The Oracle — a mysterious AI entity in a riddle game.
Riddle: "${riddleQuestion}"
The correct answer is: "${riddle.answer}"

Generate ONE cryptic, poetic, mysterious hint. DO NOT reveal the answer directly.
Be like a prophecy — metaphorical, mystical. Max 2 sentences. Make it feel powerful and rare.`;
    
    const result = await model.generateContent(prompt);
    const oracleHint = result.response.text().trim();
    
    console.log(`🔮 Oracle | ${userId} | ${riddleId}`);
    res.json({ success: true, oracleHint, newTotal: user.coins - 150 });
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
    await supabase.from('users').update({ coins: user.coins - 100 }).eq('id', userId);
    console.log(`🕐 Time Freeze | ${userId}`);
    res.json({ success: true, frozenSeconds: 10, newTotal: user.coins - 100 });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================
// 🏆 BOUNTY BOARD
// ============================
app.get('/bounty/current', async (req, res) => {
  try {
    let { data: bounty } = await supabase.from('bounty_board').select('*').eq('active', true).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();

    // Auto-create a bounty if none exists
    if (!bounty) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const prompt = `Create the hardest, most mind-bending riddle that requires multi-step reasoning. This will be a weekly BOUNTY riddle worth 5000 coins.
Return ONLY raw JSON: {"question": "...", "answer": "exact answer", "hint": "very cryptic hint"}`;
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
      const parsed = JSON.parse(raw.substring(start, end + 1));
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: newBounty } = await supabase.from('bounty_board').insert({ question: parsed.question, answer: parsed.answer, prize_coins: 5000, expires_at: expiresAt, active: true }).select().single();
      bounty = newBounty;
      console.log(`🏆 New Bounty Created | Expires: ${expiresAt}`);
    }

    res.json({ success: true, bounty: { id: bounty.id, question: bounty.question, prize_coins: bounty.prize_coins, solved_by: bounty.solved_by, solved_at: bounty.solved_at, expires_at: bounty.expires_at } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/bounty/attempt', async (req, res) => {
  try {
    const { userId, bountyId, userAnswer, username } = req.body;
    const { data: bounty } = await supabase.from('bounty_board').select('*').eq('id', bountyId).single();
    if (!bounty || bounty.solved_by) return res.json({ success: false, error: bounty?.solved_by ? `Already solved by ${bounty.solved_by}!` : 'Bounty not found' });

    const u = (userAnswer || '').toLowerCase().trim();
    const c = (bounty.answer || '').toLowerCase().trim();
    const isCorrect = u === c || u.includes(c) || c.includes(u);

    if (!isCorrect) return res.json({ success: true, isCorrect: false, message: 'Incorrect! Keep trying...' });

    await supabase.from('bounty_board').update({ solved_by: username, solved_at: new Date().toISOString(), active: false }).eq('id', bountyId);
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

    // Generate AI narrative
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `You are a world-class cognitive analyst for CRACKL riddle arena.
Player: ${user?.username || 'Unknown'} | Level: ${user?.level} | XP: ${user?.xp} | Streak: ${user?.streak} days
This week: ${total} riddles attempted, ${correct} correct (${accuracy}% accuracy)

Write a personalized 3-sentence cognitive "Brain Report Card". Be like a genius mentor — insightful, motivating, specific. 
Tell them their cognitive strengths, one weakness to work on, and a bold prediction for their future. NO markdown.`;
    const result = await model.generateContent(prompt);
    const narrative = result.response.text().trim();

    res.json({ success: true, report: { total, correct, accuracy, narrative, weekStreak: user?.streak || 0, level: user?.level } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

const server = app.listen(process.env.PORT || 3000, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  CRACKL Backend ⚡ RUNNING');
  console.log('  ✅ User not found: FIXED (auto-creates)');
  console.log('  ✅ Answer always returned: FIXED');
  console.log('  ✅ Coins always returned: FIXED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('\\n⚠️  PORT 3000 IS ALREADY IN USE!');
    console.log('👉 This means your backend is ALREADY RUNNING perfectly in the background.');
    console.log('👉 You DO NOT need to run it again. Just start your frontend!\\n');
  } else {
    console.error(e);
  }
});
