import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Switch, Platform
} from 'react-native';

// On web, Alert.alert confirmation dialogs don't work — use browser confirm
const confirm = (title, msg, onConfirm) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${msg}`)) onConfirm();
  } else {
    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm }
    ]);
  }
};
import { CONFIG } from '../../config';

const MODES = ['arena', 'daily', 'gauntlet', 'chain', 'wager', 'bounty'];
const MODE_LABELS = { arena: 'Arena', daily: 'Daily Drop', gauntlet: 'Gauntlet', chain: 'Chain', wager: 'Blind Wager', bounty: 'Bounty' };
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const DIFF_COLORS = { Easy: '#00FF9D', Medium: '#FFC800', Hard: '#FF0055' };

// ─── Styles ────────────────────────────────────────────────────────────────
const S = {
  bg: '#07070F',
  card: { backgroundColor: 'rgba(15,15,26,0.8)', borderRadius: 12, borderWidth: 1, borderColor: '#1F1F35', padding: 16, marginBottom: 12 },
  title: { color: '#fff', fontFamily: 'Chakra Petch', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  label: { color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  value: { color: '#fff', fontFamily: 'Chakra Petch', fontSize: 16, fontWeight: '700' },
  input: { backgroundColor: '#0F0F1A', borderWidth: 1, borderColor: '#1F1F35', borderRadius: 8, color: '#fff', fontFamily: 'Chakra Petch', fontSize: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  btn: (color = '#7C3AED') => ({ backgroundColor: color, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }),
  btnText: { color: '#fff', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  tab: (active) => ({ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: active ? '#7C3AED' : 'transparent' }),
  tabText: (active) => ({ color: active ? '#fff' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }),
  divider: { height: 1, backgroundColor: '#1F1F35', marginVertical: 16 },
  pill: (color) => ({ backgroundColor: color + '22', borderWidth: 1, borderColor: color + '66', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }),
  pillText: (color) => ({ color, fontFamily: 'Share Tech Mono', fontSize: 10, fontWeight: '700' }),
};

// ─── Login Gate ─────────────────────────────────────────────────────────────
function LoginGate({ onAuth, go }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);

  const tryLogin = async () => {
    if (!key.trim()) return Alert.alert('Enter your admin key first');
    setLoading(true);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/stats`, {
        headers: { 'x-admin-secret': key.trim() }
      });
      const data = await res.json();
      if (data.success) {
        onAuth(key.trim(), data);
      } else {
        Alert.alert('Wrong Key', 'That admin key is incorrect.');
      }
    } catch {
      Alert.alert('Cannot connect', 'Make sure the server is running.');
    }
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: S.bg, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <Text style={{ fontSize: 40, marginBottom: 16 }}>🔐</Text>
      <Text style={[S.title, { marginBottom: 8, textAlign: 'center' }]}>Admin Panel</Text>
      <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 12, textAlign: 'center', marginBottom: 32 }}>
        Enter your admin key to continue
      </Text>
      <View style={{ width: '100%', maxWidth: 360 }}>
        <TextInput
          style={[S.input, { marginBottom: 16 }]}
          placeholder="Admin key"
          placeholderTextColor="#374151"
          secureTextEntry
          value={key}
          onChangeText={setKey}
          onSubmitEditing={tryLogin}
        />
        <TouchableOpacity style={S.btn()} onPress={tryLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={S.btnText}>ENTER</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => go('home')}>
          <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 12 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Tab 1: Overview ────────────────────────────────────────────────────────
function OverviewTab({ adminKey, initialStats }) {
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);
  const [maintenanceOn, setMaintenanceOn] = useState(initialStats?.maintenanceMode || false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('We are updating the vault. Back soon!');
  const [togglingMaint, setTogglingMaint] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/stats`, { headers: { 'x-admin-secret': adminKey } });
      const data = await res.json();
      if (data.success) { setStats(data); setMaintenanceOn(data.maintenanceMode); }
    } catch {}
    setLoading(false);
  }, [adminKey]);

  const toggleMaintenance = () => {
    const next = !maintenanceOn;
    const title = next ? 'Turn ON Maintenance?' : 'Turn OFF Maintenance?';
    const msg = next
      ? 'All players will see a "Vault Updating" screen. You can still use the admin panel.'
      : 'The app will become live again for all players.';
    confirm(title, msg, async () => {
      setTogglingMaint(true);
      try {
        await fetch(`${CONFIG.BACKEND_URL}/admin/maintenance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminKey },
          body: JSON.stringify({ on: next, message: maintenanceMsg })
        });
        setMaintenanceOn(next);
      } catch { Alert.alert('Error', 'Could not toggle maintenance mode.'); }
      setTogglingMaint(false);
    });
  };

  if (!stats) return <ActivityIndicator color="#7C3AED" style={{ marginTop: 40 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>

      {/* Maintenance Toggle */}
      <View style={[S.card, { borderColor: maintenanceOn ? '#FF0055' : '#1F1F35' }]}>
        <Text style={[S.label, { marginBottom: 0 }]}>App Status</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <View>
            <Text style={[S.value, { color: maintenanceOn ? '#FF0055' : '#00FF9D' }]}>
              {maintenanceOn ? '🔴  Under Maintenance' : '🟢  Live for Players'}
            </Text>
            <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 4 }}>
              {maintenanceOn ? 'Players see a "Back Soon" screen' : 'Players can play normally'}
            </Text>
          </View>
          {togglingMaint
            ? <ActivityIndicator color="#7C3AED" />
            : <Switch value={maintenanceOn} onValueChange={toggleMaintenance} trackColor={{ false: '#1F1F35', true: '#FF0055' }} thumbColor="#fff" />
          }
        </View>
        {maintenanceOn && (
          <TextInput
            style={[S.input, { marginTop: 10, marginBottom: 0 }]}
            placeholder="Message to show players..."
            placeholderTextColor="#374151"
            value={maintenanceMsg}
            onChangeText={setMaintenanceMsg}
          />
        )}
      </View>

      {/* Quick Numbers */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={[S.card, { flex: 1, marginBottom: 0, alignItems: 'center' }]}>
          <Text style={[S.label, { marginBottom: 4, textAlign: 'center' }]}>Total Riddles</Text>
          <Text style={{ color: '#7C3AED', fontSize: 28, fontWeight: '900', fontFamily: 'Chakra Petch' }}>{stats.totalRiddles ?? '—'}</Text>
        </View>
        <View style={[S.card, { flex: 1, marginBottom: 0, alignItems: 'center' }]}>
          <Text style={[S.label, { marginBottom: 4, textAlign: 'center' }]}>Sent Today</Text>
          <Text style={{ color: '#FFC800', fontSize: 28, fontWeight: '900', fontFamily: 'Chakra Petch' }}>{stats.servedToday ?? '—'}</Text>
        </View>
        <View style={[S.card, { flex: 1, marginBottom: 0, alignItems: 'center' }]}>
          <Text style={[S.label, { marginBottom: 4, textAlign: 'center' }]}>Active Users</Text>
          <Text style={{ color: '#00FF9D', fontSize: 28, fontWeight: '900', fontFamily: 'Chakra Petch' }}>{stats.activeUsers24h ?? '—'}</Text>
        </View>
      </View>

      {/* Riddles per Mode */}
      <View style={S.card}>
        <Text style={[S.label, { marginBottom: 12 }]}>Riddles by Game Mode</Text>
        {MODES.map(m => (
          <View key={m} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1F1F35' }}>
            <Text style={{ color: '#D1D5DB', fontFamily: 'Chakra Petch', fontSize: 14 }}>{MODE_LABELS[m]}</Text>
            <Text style={{ color: '#fff', fontFamily: 'Share Tech Mono', fontSize: 14, fontWeight: '700' }}>{stats.byMode?.[m] ?? 0}</Text>
          </View>
        ))}
      </View>

      {/* Low Stock Warnings */}
      {stats.lowStockAlerts?.length > 0 && (
        <View style={[S.card, { borderColor: '#FF005566' }]}>
          <Text style={[S.label, { color: '#FF0055', marginBottom: 10 }]}>⚠️  Riddles Running Low</Text>
          {stats.lowStockAlerts.map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: '#FCA5A5', fontFamily: 'Chakra Petch', fontSize: 13 }}>
                {MODE_LABELS[a.mode]} — {a.difficulty}
              </Text>
              <Text style={{ color: '#FF0055', fontFamily: 'Share Tech Mono', fontWeight: '700' }}>
                {a.count} left
              </Text>
            </View>
          ))}
          <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 8 }}>
            Add more riddles to keep the game running smoothly
          </Text>
        </View>
      )}

      <TouchableOpacity style={S.btn('#1F1F35')} onPress={refresh} disabled={loading}>
        {loading ? <ActivityIndicator color="#7C3AED" /> : <Text style={[S.btnText, { color: '#7C3AED' }]}>REFRESH STATS</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Tab 2: Add Riddles ─────────────────────────────────────────────────────
function AddRiddlesTab({ adminKey }) {
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [loading, setLoading] = useState(false);

  // Single riddle fields
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [gameMode, setGameMode] = useState('arena');
  const [difficulty, setDifficulty] = useState('Medium');
  const [hint, setHint] = useState('');
  const [funFact, setFunFact] = useState('');
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [panicTime, setPanicTime] = useState('');

  // Bulk
  const [bulkJson, setBulkJson] = useState('');
  const [bulkResult, setBulkResult] = useState(null);

  const resetSingle = () => {
    setQuestion(''); setAnswer(''); setHint(''); setFunFact('');
    setExplanation(''); setOptions(''); setFamilyId(''); setPanicTime('');
    setIsOnboarding(false);
  };

  const submitSingle = async () => {
    if (!question.trim() || !answer.trim()) return Alert.alert('Missing Fields', 'Question and Answer are required.');
    setLoading(true);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/riddle/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminKey },
        body: JSON.stringify({
          riddles: [{
            question: question.trim(),
            answer: answer.trim(),
            game_mode: gameMode,
            difficulty,
            hint: hint.trim() || null,
            fun_fact: funFact.trim() || null,
            explanation: explanation.trim() || null,
            options: options.trim() ? options.split(',').map(s => s.trim()) : null,
            family_id: familyId.trim() || null,
            is_onboarding: isOnboarding,
            panic_time: panicTime ? parseInt(panicTime) : null,
          }]
        })
      });
      const data = await res.json();
      if (data.success && data.added > 0) {
        Alert.alert('Saved!', 'Riddle added successfully.');
        resetSingle();
      } else {
        const err = data.results?.[0]?.error || data.error || 'Something went wrong';
        Alert.alert('Error', err);
      }
    } catch (e) { Alert.alert('Error', e.message); }
    setLoading(false);
  };

  const submitBulk = async () => {
    let parsed;
    try { parsed = JSON.parse(bulkJson); }
    catch { return Alert.alert('Bad Format', 'Must be a valid JSON array. Example:\n[{"question":"...", "answer":"...", "game_mode":"arena", "difficulty":"Easy"}]'); }
    if (!Array.isArray(parsed)) return Alert.alert('Bad Format', 'Must be a JSON array (starts with [)');

    setLoading(true);
    setBulkResult(null);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/riddle/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminKey },
        body: JSON.stringify({ riddles: parsed })
      });
      const data = await res.json();
      setBulkResult(data);
      if (data.success) setBulkJson('');
    } catch (e) { Alert.alert('Error', e.message); }
    setLoading(false);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
      {/* Mode Switch */}
      <View style={{ flexDirection: 'row', backgroundColor: '#0F0F1A', borderRadius: 8, marginBottom: 16, padding: 4 }}>
        {['single', 'bulk'].map(m => (
          <TouchableOpacity key={m} onPress={() => setMode(m)} style={{ flex: 1, paddingVertical: 10, borderRadius: 6, backgroundColor: mode === m ? '#7C3AED' : 'transparent', alignItems: 'center' }}>
            <Text style={{ color: mode === m ? '#fff' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 11, letterSpacing: 1 }}>
              {m === 'single' ? 'ONE RIDDLE' : 'MANY AT ONCE'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'single' ? (
        <>
          {/* Game Mode */}
          <Text style={S.label}>Which game mode?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {MODES.map(m => (
                <TouchableOpacity key={m} onPress={() => setGameMode(m)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: gameMode === m ? '#7C3AED' : '#0F0F1A', borderWidth: 1, borderColor: gameMode === m ? '#7C3AED' : '#1F1F35' }}>
                  <Text style={{ color: gameMode === m ? '#fff' : '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11 }}>{MODE_LABELS[m]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Difficulty */}
          <Text style={S.label}>Difficulty level</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {DIFFICULTIES.map(d => (
              <TouchableOpacity key={d} onPress={() => setDifficulty(d)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: difficulty === d ? DIFF_COLORS[d] + '33' : '#0F0F1A', borderWidth: 1, borderColor: difficulty === d ? DIFF_COLORS[d] : '#1F1F35', alignItems: 'center' }}>
                <Text style={{ color: difficulty === d ? DIFF_COLORS[d] : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '700' }}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Required Fields */}
          <Text style={S.label}>The Riddle / Question <Text style={{ color: '#FF0055' }}>*</Text></Text>
          <TextInput style={[S.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Type the riddle here..." placeholderTextColor="#374151" multiline value={question} onChangeText={setQuestion} />

          <Text style={S.label}>Correct Answer <Text style={{ color: '#FF0055' }}>*</Text></Text>
          <TextInput style={S.input} placeholder="The exact answer" placeholderTextColor="#374151" value={answer} onChangeText={setAnswer} />

          {/* Optional Fields */}
          <Text style={S.label}>Hint (optional — shown when player taps hint)</Text>
          <TextInput style={S.input} placeholder="A helpful clue..." placeholderTextColor="#374151" value={hint} onChangeText={setHint} />

          <Text style={S.label}>Fun Fact (optional — shown after answer)</Text>
          <TextInput style={S.input} placeholder="Interesting fact about this riddle..." placeholderTextColor="#374151" value={funFact} onChangeText={setFunFact} />

          <Text style={S.label}>Explanation (optional — the why/how)</Text>
          <TextInput style={S.input} placeholder="Why is the answer correct?" placeholderTextColor="#374151" value={explanation} onChangeText={setExplanation} />

          <Text style={S.label}>Answer Options for Multiple Choice (optional)</Text>
          <TextInput style={S.input} placeholder="Option A, Option B, Option C, Option D" placeholderTextColor="#374151" value={options} onChangeText={setOptions} />

          <Text style={S.label}>Variant Group ID (optional)</Text>
          <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginBottom: 6 }}>
            If this is a variant of another riddle (same logic, different data), give them the same group ID. A user who sees one variant will never see another.
          </Text>
          <TextInput style={S.input} placeholder="e.g. speed-distance-1" placeholderTextColor="#374151" value={familyId} onChangeText={setFamilyId} />

          <Text style={S.label}>Custom Timer (optional, seconds)</Text>
          <TextInput style={S.input} placeholder="e.g. 45 (leave blank for default)" placeholderTextColor="#374151" keyboardType="numeric" value={panicTime} onChangeText={setPanicTime} />

          {/* For New Players toggle */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1F1F35', marginTop: 4 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: '#D1D5DB', fontFamily: 'Chakra Petch', fontSize: 14, fontWeight: '700' }}>Show to New Players First</Text>
              <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 2 }}>Brand new players (0 CRACK SCORE) see these riddles first</Text>
            </View>
            <Switch value={isOnboarding} onValueChange={setIsOnboarding} trackColor={{ false: '#1F1F35', true: '#7C3AED' }} thumbColor="#fff" />
          </View>

          <TouchableOpacity style={[S.btn(), { marginTop: 8 }]} onPress={submitSingle} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>SAVE RIDDLE</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={[S.card, { borderColor: '#1F1F3566' }]}>
            <Text style={[S.label, { color: '#7C3AED' }]}>Required fields per riddle</Text>
            <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11, lineHeight: 18 }}>
              {"question, answer, game_mode, difficulty\n\nOptional: hint, fun_fact, explanation,\noptions (array), family_id, is_onboarding,\npanic_time"}
            </Text>
            <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 8 }}>
              {"game_mode: arena | daily | gauntlet | chain | wager | bounty\ndifficulty: Easy | Medium | Hard"}
            </Text>
          </View>

          <Text style={S.label}>Paste your riddles here (JSON array)</Text>
          <TextInput
            style={[S.input, { height: 200, textAlignVertical: 'top', fontFamily: 'Share Tech Mono', fontSize: 12 }]}
            placeholder={'[\n  {\n    "question": "What has hands but cannot clap?",\n    "answer": "A clock",\n    "game_mode": "arena",\n    "difficulty": "Easy"\n  }\n]'}
            placeholderTextColor="#374151"
            multiline
            value={bulkJson}
            onChangeText={setBulkJson}
          />

          <TouchableOpacity style={S.btn('#7C3AED')} onPress={submitBulk} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>UPLOAD ALL</Text>}
          </TouchableOpacity>

          {/* Upload Report */}
          {bulkResult && (
            <View style={[S.card, { borderColor: bulkResult.failed > 0 ? '#FF005566' : '#00FF9D66' }]}>
              <Text style={[S.label, { marginBottom: 8 }]}>Upload Report</Text>
              <Text style={{ color: '#00FF9D', fontFamily: 'Chakra Petch', fontWeight: '700' }}>✓ Saved: {bulkResult.added}</Text>
              {bulkResult.failed > 0 && <Text style={{ color: '#FF0055', fontFamily: 'Chakra Petch', fontWeight: '700' }}>✗ Failed: {bulkResult.failed}</Text>}
              {bulkResult.results?.filter(r => !r.success).map((r, i) => (
                <Text key={i} style={{ color: '#FCA5A5', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 4 }}>
                  Row {r.index + 1}: {r.error}
                </Text>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ─── Tab 3: Manage Riddles ───────────────────────────────────────────────────
function ManageTab({ adminKey }) {
  const [riddles, setRiddles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('all');
  const [filterDiff, setFilterDiff] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  const fetchRiddles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (filterMode !== 'all') params.set('mode', filterMode);
      if (filterDiff !== 'all') params.set('difficulty', filterDiff);
      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/riddles?${params}`, { headers: { 'x-admin-secret': adminKey } });
      const data = await res.json();
      if (data.success) { setRiddles(data.riddles || []); setTotal(data.total || 0); }
    } catch {}
    setLoading(false);
  }, [adminKey, filterMode, filterDiff, page]);

  useEffect(() => { fetchRiddles(); }, [fetchRiddles]);

  const deleteRiddle = (id) => {
    confirm('Delete Riddle?', 'This cannot be undone.', async () => {
      try {
        await fetch(`${CONFIG.BACKEND_URL}/admin/riddle/${id}`, { method: 'DELETE', headers: { 'x-admin-secret': adminKey } });
        fetchRiddles();
      } catch { Alert.alert('Error', 'Could not delete.'); }
    });
  };

  const toggleActive = async (riddle) => {
    try {
      await fetch(`${CONFIG.BACKEND_URL}/admin/riddle/${riddle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminKey },
        body: JSON.stringify({ is_active: !riddle.is_active })
      });
      fetchRiddles();
    } catch { Alert.alert('Error', 'Could not update.'); }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Filters */}
      <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#1F1F35' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => { setFilterMode('all'); setPage(1); }}
              style={[S.pill(filterMode === 'all' ? '#7C3AED' : '#6B7280'), { marginRight: 2 }]}>
              <Text style={S.pillText(filterMode === 'all' ? '#C4B5FD' : '#9CA3AF')}>All Modes</Text>
            </TouchableOpacity>
            {MODES.map(m => (
              <TouchableOpacity key={m} onPress={() => { setFilterMode(m); setPage(1); }} style={S.pill(filterMode === m ? '#7C3AED' : '#6B7280')}>
                <Text style={S.pillText(filterMode === m ? '#C4B5FD' : '#9CA3AF')}>{MODE_LABELS[m]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {['all', ...DIFFICULTIES].map(d => (
            <TouchableOpacity key={d} onPress={() => { setFilterDiff(d); setPage(1); }}
              style={S.pill(d === 'all' ? (filterDiff === d ? '#7C3AED' : '#6B7280') : (filterDiff === d ? DIFF_COLORS[d] : '#6B7280'))}>
              <Text style={S.pillText(d === 'all' ? (filterDiff === d ? '#C4B5FD' : '#9CA3AF') : (filterDiff === d ? DIFF_COLORS[d] : '#9CA3AF'))}>
                {d === 'all' ? 'All Levels' : d}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 6 }}>
          Showing {riddles.length} of {total} riddles
        </Text>
      </View>

      {loading
        ? <ActivityIndicator color="#7C3AED" style={{ marginTop: 40 }} />
        : (
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            {riddles.length === 0
              ? <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', textAlign: 'center', marginTop: 40 }}>No riddles found</Text>
              : riddles.map(r => (
                <View key={r.id} style={[S.card, { borderColor: DIFF_COLORS[r.difficulty] + '44', opacity: r.is_active ? 1 : 0.5 }]}>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                    <View style={S.pill(DIFF_COLORS[r.difficulty])}>
                      <Text style={S.pillText(DIFF_COLORS[r.difficulty])}>{r.difficulty}</Text>
                    </View>
                    <View style={S.pill('#7C3AED')}>
                      <Text style={S.pillText('#C4B5FD')}>{MODE_LABELS[r.game_mode] || r.game_mode}</Text>
                    </View>
                    {r.is_onboarding && (
                      <View style={S.pill('#00FF9D')}>
                        <Text style={S.pillText('#00FF9D')}>New Players</Text>
                      </View>
                    )}
                    {!r.is_active && (
                      <View style={S.pill('#FF0055')}>
                        <Text style={S.pillText('#FF0055')}>Hidden</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontFamily: 'Chakra Petch', fontSize: 13, marginBottom: 4 }} numberOfLines={3}>{r.question}</Text>
                  <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11 }}>Answer: {r.answer}</Text>
                  {r.times_served > 0 && <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 2 }}>Sent to {r.times_served} player{r.times_served !== 1 ? 's' : ''}</Text>}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => toggleActive(r)}>
                      <Text style={{ color: r.is_active ? '#FFC800' : '#00FF9D', fontFamily: 'Share Tech Mono', fontSize: 11 }}>
                        {r.is_active ? 'Hide Riddle' : 'Show Riddle'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteRiddle(r.id)}>
                      <Text style={{ color: '#FF0055', fontFamily: 'Share Tech Mono', fontSize: 11 }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            }
            {/* Pagination */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8 }}>
              {page > 1 && (
                <TouchableOpacity onPress={() => setPage(p => p - 1)} style={[S.btn('#1F1F35'), { marginBottom: 0, paddingHorizontal: 20 }]}>
                  <Text style={[S.btnText, { color: '#9CA3AF' }]}>← Prev</Text>
                </TouchableOpacity>
              )}
              {riddles.length === LIMIT && (
                <TouchableOpacity onPress={() => setPage(p => p + 1)} style={[S.btn('#1F1F35'), { marginBottom: 0, paddingHorizontal: 20 }]}>
                  <Text style={[S.btnText, { color: '#9CA3AF' }]}>Next →</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )
      }
    </View>
  );
}

// ─── Tab 4: Riddle Stock ─────────────────────────────────────────────────────
function StockTab({ adminKey }) {
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/pool-health`, { headers: { 'x-admin-secret': adminKey } });
      const data = await res.json();
      if (data.success) setGrid(data.grid);
    } catch {}
    setLoading(false);
  }, [adminKey]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const statusColor = (s) => s === 'LOW' ? '#FF0055' : s === 'WARNING' ? '#FFC800' : '#00FF9D';
  const statusLabel = (s) => s === 'LOW' ? '⚠️ LOW' : s === 'WARNING' ? '⚡ OK' : '✓ GOOD';

  if (loading) return <ActivityIndicator color="#7C3AED" style={{ marginTop: 40 }} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginBottom: 16, lineHeight: 16 }}>
        This shows how many riddles are available for each mode and level. RED means you need to add more.
      </Text>
      {MODES.map(m => (
        <View key={m} style={[S.card, { marginBottom: 8 }]}>
          <Text style={[S.label, { marginBottom: 10 }]}>{MODE_LABELS[m]}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {DIFFICULTIES.map(d => {
              const cell = grid?.[m]?.[d];
              const color = statusColor(cell?.status);
              return (
                <View key={d} style={{ flex: 1, backgroundColor: color + '11', borderWidth: 1, borderColor: color + '44', borderRadius: 8, padding: 10, alignItems: 'center' }}>
                  <Text style={{ color, fontFamily: 'Share Tech Mono', fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>{d.toUpperCase()}</Text>
                  <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 20, fontWeight: '900' }}>{cell?.remaining ?? '?'}</Text>
                  <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 9, marginTop: 2 }}>left today</Text>
                  <Text style={{ color, fontFamily: 'Share Tech Mono', fontSize: 8, marginTop: 4, fontWeight: '700' }}>{statusLabel(cell?.status)}</Text>
                  {cell?.onboardingCount > 0 && (
                    <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 8, marginTop: 2 }}>{cell.onboardingCount} for new users</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
      <TouchableOpacity style={[S.btn('#1F1F35')]} onPress={fetch_}>
        <Text style={[S.btnText, { color: '#7C3AED' }]}>REFRESH</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function AdminDashboard({ go }) {
  const [adminKey, setAdminKey] = useState('');
  const [initialStats, setInitialStats] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const TABS = [
    { label: 'Overview', emoji: '📊' },
    { label: 'Add', emoji: '➕' },
    { label: 'Manage', emoji: '📋' },
    { label: 'Stock', emoji: '📦' },
  ];

  if (!adminKey) {
    return <LoginGate onAuth={(key, stats) => { setAdminKey(key); setInitialStats(stats); }} go={go} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: S.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1F1F35' }}>
        <Text style={[S.title, { fontSize: 18 }]}>Admin Panel</Text>
        <TouchableOpacity onPress={() => go('home')}>
          <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 11, letterSpacing: 1 }}>EXIT</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1F1F35' }}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={i} style={S.tab(activeTab === i)} onPress={() => setActiveTab(i)}>
            <Text style={{ fontSize: 16 }}>{t.emoji}</Text>
            <Text style={S.tabText(activeTab === i)}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 0 && <OverviewTab adminKey={adminKey} initialStats={initialStats} />}
        {activeTab === 1 && <AddRiddlesTab adminKey={adminKey} />}
        {activeTab === 2 && <ManageTab adminKey={adminKey} />}
        {activeTab === 3 && <StockTab adminKey={adminKey} />}
      </View>
    </View>
  );
}
