require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const BASE = process.env.SMOKE_BACKEND_URL || 'http://localhost:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'crackl-admin-2026');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

const stamp = Date.now();
const users = [1, 2].map((n) => ({
  id: crypto.randomUUID(),
  email: `codex-smoke-${stamp}-${n}@example.test`,
  username: `codex_smoke_${stamp}_${n}`,
  city: 'Test',
  area: 'Test',
  coins: 1000,
  xp: 0,
  level: 'Novice',
  streak: 0,
  total_played: 0,
  total_correct: 0,
  is_verified: true
}));

const createOnlyUser = {
  id: crypto.randomUUID(),
  email: `codex-smoke-create-${stamp}@example.test`,
  username: `codex_smoke_create_${stamp}`,
  city: 'Test',
  area: 'Created'
};

const tokens = users.map((user) =>
  jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  )
);
const createOnlyToken = jwt.sign(
  { id: createOnlyUser.id, username: createOnlyUser.username, email: createOnlyUser.email },
  process.env.JWT_SECRET,
  { expiresIn: '2h' }
);

const touched = { roomIds: [], chainIds: [], challengeIds: [], riddleIds: [], reportIds: [], ticketIds: [], operatorIds: [] };

function auth(index) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokens[index]}`
  };
}

function adminAuth(secret = ADMIN_SECRET, actor = 'codex-smoke') {
  return {
    'Content-Type': 'application/json',
    'x-admin-secret': secret,
    'x-admin-actor': actor
  };
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(`${message}${detail ? ` :: ${JSON.stringify(detail)}` : ''}`);
  }
}

async function getAnswer(riddleId, table = 'riddles') {
  const { data, error } = await supabase
    .from(table)
    .select('answer')
    .eq('id', riddleId)
    .single();
  if (error) throw error;
  return data.answer;
}

async function cleanup() {
  const userIds = [...users.map((user) => user.id), createOnlyUser.id];

  if (touched.roomIds.length) {
    await supabase.from('room_players').delete().in('room_id', touched.roomIds);
    await supabase.from('session_riddle_queue').delete().in('session_id', touched.roomIds);
    await supabase.from('multiplayer_rooms').delete().in('id', touched.roomIds);
  }

  if (touched.chainIds.length) {
    await supabase.from('session_riddle_queue').delete().in('session_id', touched.chainIds);
    await supabase.from('chain_progress').delete().in('chain_id', touched.chainIds);
  }

  if (touched.challengeIds.length) {
    await supabase.from('challenges').delete().in('id', touched.challengeIds);
  }

  if (touched.riddleIds.length) {
    await supabase.from('user_riddle_history').delete().in('riddle_id', touched.riddleIds);
    await supabase.from('session_riddle_queue').delete().in('riddle_id', touched.riddleIds);
    await supabase.from('challenges').delete().in('riddle_id', touched.riddleIds);
    await supabase.from('riddles').delete().in('id', touched.riddleIds);
  }

  if (touched.reportIds.length) {
    await supabase.from('user_riddle_reports').delete().in('id', touched.reportIds);
  }
  if (touched.ticketIds.length) {
    await supabase.from('support_tickets').delete().in('id', touched.ticketIds);
  }
  if (touched.operatorIds.length) {
    await supabase.from('admin_operators').delete().in('id', touched.operatorIds);
  }

  await supabase.from('bounty_attempts').delete().in('user_id', userIds);
  await supabase.from('admin_audit_logs').delete().eq('actor_label', 'codex-smoke');
  await supabase.from('user_riddle_history').delete().in('user_id', userIds);
  await supabase.from('leaderboard').delete().in('user_id', userIds);
  await supabase.from('users').delete().in('id', userIds);
}

async function run() {
  const health = await api('/health');
  assert(health.status === 200 && health.json.success && health.json.status === 'ok', 'Health endpoint failed', health);

  const ready = await api('/ready');
  assert(ready.status === 200 && ready.json.success && ready.json.database === 'ok', 'Readiness endpoint failed', ready);

  if (ADMIN_SECRET) {
    const unsafeMedia = await api('/admin/riddle/add', {
      method: 'POST',
      headers: adminAuth(),
      body: JSON.stringify({
        riddles: {
          question: `unsafe media smoke ${stamp}`,
          answer: 'blocked',
          explanation: 'should reject untrusted media origins',
          game_mode: 'mcq',
          difficulty: 'Easy',
          difficulty_tier: 1,
          riddle_type: 'image_text',
          media_url: 'https://evil.example/not-allowed.png'
        }
      })
    });
    assert(
      unsafeMedia.status === 200 &&
      unsafeMedia.json.success &&
      unsafeMedia.json.failed === 1 &&
      /media_url/i.test(unsafeMedia.json.results?.[0]?.error || ''),
      'Admin riddle add accepted an untrusted media URL',
      unsafeMedia
    );

    const bulkSeed = await api('/admin/riddle/add', {
      method: 'POST',
      headers: adminAuth(),
      body: JSON.stringify({
        riddles: [
          {
            question: `bulk delete safe smoke ${stamp}`,
            answer: `bulk-safe-${stamp}`,
            game_mode: 'mcq',
            difficulty: 'Easy',
            difficulty_tier: 1,
            options: ['alpha', 'beta', `bulk-safe-${stamp}`, 'delta'],
            riddle_type: 'text'
          },
          {
            question: `bulk purge smoke ${stamp}`,
            answer: `bulk-purge-${stamp}`,
            game_mode: 'type',
            difficulty: 'Easy',
            difficulty_tier: 1,
            riddle_type: 'text'
          }
        ]
      })
    });
    assert(bulkSeed.status === 200 && bulkSeed.json.success && bulkSeed.json.added === 2, 'Admin bulk delete seed failed', bulkSeed);
    const bulkIds = (bulkSeed.json.results || []).filter(row => row.success).map(row => row.id);
    touched.riddleIds.push(...bulkIds);

    const chainSeed = await api('/admin/riddle/add', {
      method: 'POST',
      headers: adminAuth(),
      body: JSON.stringify({
        riddles: [
          { tier: 1, question: `Which signal opens the cobalt gate ${stamp}?`, answer: `cobalt-${stamp}` },
          { tier: 1, question: `Decode the silent orchard coordinate ${stamp}.`, answer: `orchard-${stamp}` },
          { tier: 3, question: `Name the missing prism in relay ${stamp}.`, answer: `prism-${stamp}` },
          { tier: 3, question: `Resolve the midnight compass bearing ${stamp}.`, answer: `compass-${stamp}` },
          { tier: 5, question: `Complete the final obsidian lattice ${stamp}.`, answer: `lattice-${stamp}` },
        ].map(({ tier, question, answer }, index) => ({
          question,
          answer,
          game_mode: 'chain',
          difficulty: tier <= 1 ? 'Easy' : tier >= 5 ? 'Hard' : 'Medium',
          difficulty_tier: tier,
          riddle_type: 'text',
          category: `smoke-chain-${index + 1}`,
        }))
      })
    });
    const chainSeedIds = (chainSeed.json.results || []).filter(row => row.success).map(row => row.id);
    touched.riddleIds.push(...chainSeedIds);
    assert(chainSeed.status === 200 && chainSeed.json.success && chainSeed.json.added === 5, 'Chain smoke seed failed', chainSeed);

    const safeBulkDelete = await api('/admin/riddles/delete', {
      method: 'POST',
      headers: adminAuth(),
      body: JSON.stringify({ ids: [bulkIds[0]], purge: false })
    });
    assert(
      safeBulkDelete.status === 200 &&
      safeBulkDelete.json.success &&
      safeBulkDelete.json.deleted?.length === 1 &&
      safeBulkDelete.json.archived?.length === 0,
      'Admin safe bulk delete failed',
      safeBulkDelete
    );

    const purgeBulkDelete = await api('/admin/riddles/delete', {
      method: 'POST',
      headers: adminAuth(),
      body: JSON.stringify({ ids: [bulkIds[1]], purge: true })
    });
    assert(
      purgeBulkDelete.status === 200 &&
      purgeBulkDelete.json.success &&
      purgeBulkDelete.json.purged === true &&
      purgeBulkDelete.json.deleted?.length === 1,
      'Admin purge bulk delete failed',
      purgeBulkDelete
    );

    const auditLogs = await api('/admin/audit-logs?limit=10', { headers: adminAuth() });
    assert(
      auditLogs.status === 200 &&
      auditLogs.json.success &&
      (auditLogs.json.logs || []).some(log => log.action === 'riddles.purge' || log.action === 'riddles.delete'),
      'Admin audit logs did not record privileged actions',
      auditLogs
    );

    const storageScan = await api('/admin/storage/orphans', { headers: adminAuth() });
    assert(storageScan.status === 200 && storageScan.json.success && Number.isFinite(storageScan.json.orphanCount), 'Admin storage orphan scan failed', storageScan);

    const operatorCreate = await api('/admin/operators', {
      method: 'POST',
      headers: adminAuth(),
      body: JSON.stringify({ displayName: `codex-smoke-operator-${stamp}`, role: 'auditor' })
    });
    assert(
      operatorCreate.status === 200 &&
      operatorCreate.json.success &&
      operatorCreate.json.operator?.id &&
      operatorCreate.json.token,
      'Admin operator creation failed',
      operatorCreate
    );
    touched.operatorIds.push(operatorCreate.json.operator.id);

    const operatorStats = await api('/admin/stats', { headers: adminAuth(operatorCreate.json.token, 'codex-smoke-viewer') });
    assert(operatorStats.status === 200 && operatorStats.json.success, 'Admin operator token could not access read-only stats', operatorStats);

    const operatorDisable = await api(`/admin/operators/${operatorCreate.json.operator.id}`, {
      method: 'PATCH',
      headers: adminAuth(),
      body: JSON.stringify({ is_active: false })
    });
    assert(operatorDisable.status === 200 && operatorDisable.json.success && operatorDisable.json.operator?.is_active === false, 'Admin operator disable failed', operatorDisable);

    const analytics = await api('/admin/analytics/summary?days=7', { headers: adminAuth() });
    assert(analytics.status === 200 && analytics.json.success && Number.isFinite(analytics.json.users), 'Admin analytics summary failed', analytics);
  }

  const createdUser = await api('/user/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createOnlyToken}`
    },
    body: JSON.stringify({
      id: createOnlyUser.id,
      username: createOnlyUser.username,
      city: createOnlyUser.city,
      area: createOnlyUser.area
    })
  });
  assert(createdUser.status === 200 && createdUser.json.success && createdUser.json.user?.id === createOnlyUser.id, 'Authenticated user create failed', createdUser);

  const existingUser = await api('/user/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createOnlyToken}`
    },
    body: JSON.stringify({
      id: createOnlyUser.id,
      username: 'should_not_reset_state',
      city: 'Changed',
      area: 'Changed'
    })
  });
  assert(existingUser.status === 200 && existingUser.json.success && existingUser.json.existing === true, 'User create did not return existing record safely', existingUser);
  assert(!('password_hash' in (existingUser.json.user || {})) && !('reset_token' in (existingUser.json.user || {})), 'User create leaked private account fields', existingUser);

  const badUsernameUpdate = await api('/user/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createOnlyToken}`
    },
    body: JSON.stringify({ userId: createOnlyUser.id, username: 'bad name!' })
  });
  assert(badUsernameUpdate.status === 400, 'Profile update accepted an unsafe username', badUsernameUpdate);

  const badAvatarUpdate = await api('/user/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createOnlyToken}`
    },
    body: JSON.stringify({ userId: createOnlyUser.id, avatar_url: 'javascript:alert(1)' })
  });
  assert(badAvatarUpdate.status === 400, 'Profile update accepted an unsafe avatar URL', badAvatarUpdate);

  const validProfileUpdate = await api('/user/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createOnlyToken}`
    },
    body: JSON.stringify({
      userId: createOnlyUser.id,
      username: `codex_clean_${stamp}`,
      avatar_url: 'data:image/png;base64,iVBORw0KGgo='
    })
  });
  assert(validProfileUpdate.status === 200 && validProfileUpdate.json.success, 'Profile update rejected a safe profile payload', validProfileUpdate);
  assert(!('password_hash' in (validProfileUpdate.json.user || {})) && !('reset_token' in (validProfileUpdate.json.user || {})), 'Profile update leaked private account fields', validProfileUpdate);

  const weakReset = await api('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: createOnlyUser.email, otp: '123456', newPassword: 'short' })
  });
  assert(weakReset.status === 400, 'Password reset accepted a weak new password', weakReset);

  const spoofedCreate = await api('/user/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createOnlyToken}`
    },
    body: JSON.stringify({ id: users[0].id, username: 'spoofed_actor' })
  });
  assert(spoofedCreate.status === 403, 'User create allowed token/body actor mismatch', spoofedCreate);

  const { error: insertErr } = await supabase.from('users').insert(users);
  if (insertErr) throw insertErr;

  const next = await api('/api/riddles/next?mode=mcq', { headers: auth(0) });
  assert(next.status === 200 && next.json.success && next.json.riddle?.id, 'RDE next mcq failed', next);
  assert(!('answer' in next.json.riddle), 'Safe riddle leaked answer');

  const report = await api('/riddle/report', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({
      userId: users[0].id,
      riddleId: next.json.riddle.id,
      reason: 'smoke_test',
      details: 'Smoke report verifies the user-to-admin moderation queue.'
    })
  });
  assert(report.status === 200 && report.json.success && report.json.report?.id, 'User riddle report failed', report);
  touched.reportIds.push(report.json.report.id);

  const supportTicket = await api('/support/ticket', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({
      userId: users[0].id,
      category: 'smoke',
      subject: `Smoke ticket ${stamp}`,
      message: 'Smoke ticket verifies support queue plumbing.'
    })
  });
  assert(supportTicket.status === 200 && supportTicket.json.success && supportTicket.json.ticket?.id, 'Support ticket creation failed', supportTicket);
  touched.ticketIds.push(supportTicket.json.ticket.id);

  if (ADMIN_SECRET) {
    const reportsAdmin = await api('/admin/reports?limit=10', { headers: adminAuth() });
    assert(
      reportsAdmin.status === 200 &&
      reportsAdmin.json.success &&
      (reportsAdmin.json.reports || []).some(row => row.id === report.json.report.id),
      'Admin reports queue did not include user report',
      reportsAdmin
    );

    const reportResolve = await api(`/admin/reports/${report.json.report.id}`, {
      method: 'PATCH',
      headers: adminAuth(),
      body: JSON.stringify({ status: 'resolved' })
    });
    assert(reportResolve.status === 200 && reportResolve.json.success && reportResolve.json.report?.status === 'resolved', 'Admin report resolution failed', reportResolve);

    const supportAdmin = await api('/admin/support-tickets?limit=10', { headers: adminAuth() });
    assert(
      supportAdmin.status === 200 &&
      supportAdmin.json.success &&
      (supportAdmin.json.tickets || []).some(row => row.id === supportTicket.json.ticket.id),
      'Admin support queue did not include user ticket',
      supportAdmin
    );

    const supportResolve = await api(`/admin/support-tickets/${supportTicket.json.ticket.id}`, {
      method: 'PATCH',
      headers: adminAuth(),
      body: JSON.stringify({ status: 'resolved', priority: 'high' })
    });
    assert(supportResolve.status === 200 && supportResolve.json.success && supportResolve.json.ticket?.status === 'resolved', 'Admin support resolution failed', supportResolve);
  }

  const badFreeze = await api('/lifeline/time-freeze', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({ userId: users[0].id })
  });
  assert(badFreeze.status === 400, 'Time Freeze allowed use without an active riddle', badFreeze);

  const timeFreeze = await api('/lifeline/time-freeze', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({ userId: users[0].id, riddleId: next.json.riddle.id })
  });
  assert(timeFreeze.status === 200 && timeFreeze.json.success && timeFreeze.json.frozenSeconds === 10, 'Time Freeze active-riddle flow failed', timeFreeze);

  const exploitMode = Array.isArray(next.json.riddle.options) && next.json.riddle.options.length >= 2 ? 'mcq' : 'type';
  const punctuationExploit = await api('/answer', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({
      userId: users[0].id,
      riddleId: next.json.riddle.id,
      userAnswer: '!!!',
      mode: exploitMode,
      gameMode: 'mcq',
      timeTaken: 5
    })
  });
  assert(
    punctuationExploit.status === 200 &&
    punctuationExploit.json.success &&
    punctuationExploit.json.isCorrect === false,
    'Punctuation-only answer exploit was accepted',
    punctuationExploit
  );

  const nextSolved = await api('/api/riddles/next?mode=mcq', { headers: auth(0) });
  assert(nextSolved.status === 200 && nextSolved.json.success && nextSolved.json.riddle?.id, 'RDE next after exploit failed', nextSolved);
  assert(!('answer' in nextSolved.json.riddle), 'Safe riddle leaked answer on second fetch');

  const standardAnswer = await getAnswer(nextSolved.json.riddle.id);
  const answerMode = Array.isArray(nextSolved.json.riddle.options) && nextSolved.json.riddle.options.length >= 2 ? 'mcq' : 'type';
  const answer = await api('/answer', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({
      userId: users[0].id,
      riddleId: nextSolved.json.riddle.id,
      userAnswer: standardAnswer,
      mode: answerMode,
      gameMode: 'mcq',
      timeTaken: 5
    })
  });
  assert(answer.status === 200 && answer.json.success && answer.json.isCorrect, 'Standard answer failed', answer);

  const challengeCreate = await api('/challenge/create', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({
      challengerId: users[0].id,
      challengerName: users[0].username,
      riddleId: nextSolved.json.riddle.id,
      targetTime: 60,
      wagerCoins: 50
    })
  });
  assert(challengeCreate.status === 200 && challengeCreate.json.success && challengeCreate.json.linkId, 'Challenge create failed', challengeCreate);
  touched.challengeIds.push(challengeCreate.json.linkId);

  const challengeFetch = await api('/challenge/fetch', {
    method: 'POST',
    headers: auth(1),
    body: JSON.stringify({ linkId: challengeCreate.json.linkId })
  });
  assert(challengeFetch.status === 200 && challengeFetch.json.success && challengeFetch.json.riddle?.id, 'Challenge fetch failed', challengeFetch);

  const challengeResolve = await api('/challenge/resolve', {
    method: 'POST',
    headers: auth(1),
    body: JSON.stringify({
      challengeId: challengeCreate.json.linkId,
      defenderId: users[1].id,
      timeTaken: 30,
      userAnswer: await getAnswer(challengeFetch.json.riddle.id)
    })
  });
  assert(
    challengeResolve.status === 200 &&
    challengeResolve.json.success &&
    challengeResolve.json.defenderWon &&
    challengeResolve.json.prizeAwarded === 50,
    'Challenge resolve failed',
    challengeResolve
  );

  const wagerStart = await api('/wager/start', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({ userId: users[0].id, wageredCoins: 25, panicMode: false })
  });
  assert(wagerStart.status === 200 && wagerStart.json.success && wagerStart.json.wagerToken, 'Wager start failed', wagerStart);

  const wagerSettle = await api('/wager/settle', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({
      userId: users[0].id,
      wagerToken: wagerStart.json.wagerToken,
      userAnswer: await getAnswer(wagerStart.json.riddle.id),
      timeTaken: 4
    })
  });
  assert(wagerSettle.status === 200 && wagerSettle.json.success && wagerSettle.json.isCorrect, 'Wager settle failed', wagerSettle);
  assert(wagerSettle.json.payout === 50 && wagerSettle.json.netDelta === 25 && wagerSettle.json.coinsChange === 25, 'Wager payout/net fields are inconsistent', wagerSettle);

  const chainStart = await api('/chain/start', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({ userId: users[0].id, panicMode: false })
  });
  assert(chainStart.status === 200 && chainStart.json.success && chainStart.json.chainId && chainStart.json.totalSteps >= 3, 'Chain start failed', chainStart);
  touched.chainIds.push(chainStart.json.chainId);

  const { data: chainQueue } = await supabase
    .from('session_riddle_queue')
    .select('riddle_id, position')
    .eq('session_id', chainStart.json.chainId)
    .order('position');
  assert(chainQueue?.length === chainStart.json.totalSteps, 'Chain queue size mismatch', {
    chainQueue,
    totalSteps: chainStart.json.totalSteps
  });

  const queueIds = chainQueue.map((row) => row.riddle_id);
  const { data: beforeHistory } = await supabase
    .from('user_riddle_history')
    .select('riddle_id')
    .eq('user_id', users[0].id)
    .in('riddle_id', queueIds);
  assert(beforeHistory?.length === 1, 'Chain pre-served future nodes into user history', beforeHistory);

  const chainStep = await api('/chain/answer', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({
      userId: users[0].id,
      chainId: chainStart.json.chainId,
      step: 0,
      riddleId: chainStart.json.riddle.id,
      userAnswer: await getAnswer(chainStart.json.riddle.id),
      chainToken: chainStart.json.chainToken,
      timeTaken: 3
    })
  });
  assert(chainStep.status === 200 && chainStep.json.success && chainStep.json.isCorrect && chainStep.json.nextRiddle?.id, 'Chain first answer failed', chainStep);

  const { data: afterHistory } = await supabase
    .from('user_riddle_history')
    .select('riddle_id')
    .eq('user_id', users[0].id)
    .in('riddle_id', queueIds);
  assert(afterHistory?.length === 2, 'Chain did not mark exactly next visible node', afterHistory);

  const roomCreate = await api('/room/create', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({
      hostId: users[0].id,
      hostName: users[0].username,
      engagement: 'versus',
      mode: 'mcq',
      timed: 'panic',
      maxPlayers: 2
    })
  });
  assert(roomCreate.status === 200 && roomCreate.json.success && roomCreate.json.roomId, 'Room create failed', roomCreate);
  touched.roomIds.push(roomCreate.json.roomId);

  const roomJoin = await api('/room/join', {
    method: 'POST',
    headers: auth(1),
    body: JSON.stringify({ roomId: roomCreate.json.roomId, userId: users[1].id, username: users[1].username })
  });
  assert(roomJoin.status === 200 && roomJoin.json.success, 'Room join failed', roomJoin);

  const roomStart = await api('/room/start', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({ roomId: roomCreate.json.roomId, hostId: users[0].id })
  });
  assert(roomStart.status === 200 && roomStart.json.success && roomStart.json.riddle?.timeLimit, 'Room start panic failed', roomStart);

  const wagerRoomCreate = await api('/room/create', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({
      hostId: users[0].id,
      hostName: users[0].username,
      engagement: 'versus',
      mode: 'wager',
      timed: false,
      maxPlayers: 2,
      wagerAmount: 25
    })
  });
  assert(wagerRoomCreate.status === 200 && wagerRoomCreate.json.success && wagerRoomCreate.json.roomId, 'Wager room create failed', wagerRoomCreate);
  touched.roomIds.push(wagerRoomCreate.json.roomId);

  const wagerRoomJoin = await api('/room/join', {
    method: 'POST',
    headers: auth(1),
    body: JSON.stringify({ roomId: wagerRoomCreate.json.roomId, userId: users[1].id, username: users[1].username })
  });
  assert(wagerRoomJoin.status === 200 && wagerRoomJoin.json.success, 'Wager room join failed', wagerRoomJoin);

  const wagerRoomStart = await api('/room/start', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({ roomId: wagerRoomCreate.json.roomId, hostId: users[0].id })
  });
  assert(wagerRoomStart.status === 200 && wagerRoomStart.json.success && wagerRoomStart.json.riddle?.id, 'Wager room start failed', wagerRoomStart);

  const wagerRoomAnswer = await api('/room/answer', {
    method: 'POST',
    headers: auth(0),
    body: JSON.stringify({
      roomId: wagerRoomCreate.json.roomId,
      userId: users[0].id,
      userAnswer: await getAnswer(wagerRoomStart.json.riddle.id),
      timeTaken: 4
    })
  });
  assert(
    wagerRoomAnswer.status === 200 &&
    wagerRoomAnswer.json.success &&
    wagerRoomAnswer.json.isCorrect &&
    wagerRoomAnswer.json.showdownComplete &&
    wagerRoomAnswer.json.wagerPot === 50,
    'Wager room settle failed',
    wagerRoomAnswer
  );

  const bounty = await api('/bounty/current', { headers: auth(1) });
  if (bounty.status === 200 && bounty.json.success && bounty.json.bounty?.id) {
    const badBounty = await api('/bounty/attempt', {
      method: 'POST',
      headers: auth(1),
      body: JSON.stringify({
        userId: users[1].id,
        bountyId: bounty.json.bounty.id,
        userAnswer: '__definitely_wrong__',
        username: users[1].username,
        panicMode: false
      })
    });
    assert(badBounty.status === 200 && badBounty.json.success && badBounty.json.isCorrect === false, 'Bounty wrong attempt failed', badBounty);

    const secondBounty = await api('/bounty/attempt', {
      method: 'POST',
      headers: auth(1),
      body: JSON.stringify({
        userId: users[1].id,
        bountyId: bounty.json.bounty.id,
        userAnswer: '__definitely_wrong__',
        username: users[1].username,
        panicMode: false
      })
    });
    assert(secondBounty.status === 409 && secondBounty.json.alreadyAttempted, 'Bounty second attempt was not locked', secondBounty);
  }

  return {
    ok: true,
    checks: ['health-ready', 'admin-media-guard', 'admin-bulk-delete', 'admin-audit-logs', 'admin-storage-scan', 'admin-operators', 'admin-analytics', 'user-create-auth', 'profile-update-guard', 'auth-reset-guard', 'rde-safe', 'moderation-report', 'support-ticket', 'lifeline-guard', 'answer-guard', 'answer-stats', 'challenge-single-path', 'wager', 'chain-queue', 'panic-room', 'wager-room', 'bounty-lock'],
    chainSteps: chainStart.json.totalSteps
  };
}

run()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .finally(cleanup)
  .catch((error) => {
    console.error(error.stack || error.message);
    cleanup().finally(() => process.exit(1));
  });
