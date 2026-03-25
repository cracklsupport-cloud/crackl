import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Animated, Easing, Dimensions, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';
import { FilmGrainOverlay } from '../components/AtmosphericEffects';

const { width: W, height: H } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

/* ── Smoke Wisp for Panic Mode ── */
function SmokeWisp({ delay, startX }) {
  const ty = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(op, { toValue: 0.15, duration: 800, useNativeDriver: true }),
        Animated.timing(ty, { toValue: -H * 0.5, duration: 4000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.timing(op, { toValue: 0, duration: 1200, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', bottom: 0, left: startX,
      width: 120, height: 120, borderRadius: 60,
      backgroundColor: Colors.rose, opacity: op,
      transform: [{ translateY: ty }]}} />
  );
}

/* ── Emergency Light ── */
function EmergencyLight({ side }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.4, duration: 300, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.05, duration: 300, useNativeDriver: true }),
      Animated.delay(1400),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', top: 0, [side]: 0,
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: Colors.rose, opacity: op}} />
  );
}

/* ── Floating Coin Animation ── */
function FloatingCoin({ amount, color }) {
  const ty = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(ty, { toValue: -60, duration: 1200, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0, duration: 1200, delay: 400, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.Text style={{
      position: 'absolute', top: -20, alignSelf: 'center',
      color, fontFamily: 'Share Tech Mono', fontSize: 24, fontWeight: '900',
      opacity: op, transform: [{ translateY: ty }], zIndex: 50
    }}>{amount > 0 ? '+' : ''}{amount} 💾</Animated.Text>
  );
}

function DiffChip({ level }) {
  const col = level === 'Easy' ? Colors.emerald : level === 'Medium' ? Colors.gold : Colors.rose;
  return (
    <View style={{ backgroundColor: col + '15', borderColor: col + '35', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 }}>
      <Text style={{ color: col, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{level}</Text>
    </View>
  );
}

/* ── Animated Timer Bar ── */
function TimerBar({ tPct, tCol }) {
  const widthAnim = useRef(new Animated.Value(tPct)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: tPct, duration: 300, useNativeDriver: false }).start();
  }, [tPct]);
  const animWidth = widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
      <Animated.View style={{ width: animWidth, height: 5, backgroundColor: tCol, borderRadius: 3 }} />
    </View>
  );
}

export default function GameScreen({ user, go, update, mode, panicMode }) {
  const [riddle, setRiddle]         = useState(null);
  const [selected, setSelected]     = useState(null);
  const [typed, setTyped]           = useState('');
  const [result, setResult]         = useState(null);
  const [timeLeft, setTimeLeft]     = useState(30);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hintUsed, setHintUsed]     = useState(false);
  const [frozen, setFrozen]         = useState(false);
  const [oracleHint, setOracleHint] = useState(null);
  const [lifelineMsg, setLifelineMsg] = useState('');
  const [showCoinFloat, setShowCoinFloat] = useState(false);
  const [exhausted, setExhausted]   = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [loadError, setLoadError]   = useState('');

  // Determine effective answer mode: fall back to 'type' if MCQ has no options
  const [effectiveMode, setEffectiveMode] = useState(mode);

  const timerRef    = useRef(null);
  const freezeRef   = useRef(null);
  const resAnim     = useRef(new Animated.Value(0.88)).current;
  const timerPulse  = useRef(new Animated.Value(1)).current;
  const shakeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadRiddle();
    return () => { clearInterval(timerRef.current); clearTimeout(freezeRef.current); };
  }, []);

  async function loadRiddle() {
    setLoading(true); setRiddle(null); setSelected(null); setResult(null);
    setHintUsed(false); setTyped(''); setOracleHint(null); setLifelineMsg('');
    setExhausted(false); setMaintenance(false); setLoadError('');
    resAnim.setValue(0.88);
    clearInterval(timerRef.current);
    try {
      const res = await fetch(`${BACKEND}/riddle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, xp: user.xp || 0 })
      });

      // Handle maintenance mode (503)
      if (res.status === 503) {
        const data = await res.json();
        setMaintenance(true);
        setMaintenanceMsg(data.message || 'Vault is being updated. Check back soon!');
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (data.riddlesExhausted) {
        setExhausted(true);
        setLoading(false);
        return;
      }

      if (data.success && data.riddle) {
        const r = data.riddle;
        setRiddle(r);
        // If MCQ mode but riddle has no options, fall back to type mode
        const hasOptions = Array.isArray(r.options) && r.options.length >= 2;
        setEffectiveMode(mode === 'mcq' && !hasOptions ? 'type' : mode);
        const t = r.timeLimit || 30;
        setTimeLeft(t);
        startTick(t);
      } else {
        setLoadError(data.error || 'Could not load a riddle. Try again.');
      }
    } catch {
      setLoadError('Cannot reach the backend. Make sure the server is running.');
    }
    setLoading(false);
  }

  function startTick(n) {
    clearInterval(timerRef.current);
    const tickMs = panicMode ? 500 : 1000;
    let t = n;
    timerRef.current = setInterval(() => {
      if (!frozen) { t--; setTimeLeft(t); }
      if (t <= 10 && t > 0) {
        Animated.sequence([
          Animated.timing(timerPulse, { toValue: 1.2, duration: 120, useNativeDriver: true }),
          Animated.timing(timerPulse, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
      }
      if (t <= 0) { clearInterval(timerRef.current); submit('__timeout__'); }
    }, tickMs);
  }

  async function useTimeFreezeLifeline() {
    if (frozen || result) return;
    try {
      const res = await fetch(`${BACKEND}/lifeline/time-freeze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.success) {
        setFrozen(true); setLifelineMsg('❄️ Time frozen for 10s!');
        update({ ...user, coins: data.newTotal });
        freezeRef.current = setTimeout(() => { setFrozen(false); setLifelineMsg(''); }, 10000);
      } else {
        setLifelineMsg(data.error || 'Not enough Intel');
      }
    } catch { setLifelineMsg('Connection failed'); }
  }

  async function useOracleLifeline() {
    if (!riddle || result) return;
    try {
      const res = await fetch(`${BACKEND}/lifeline/oracle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, riddleId: riddle.id, riddleQuestion: riddle.question })
      });
      const data = await res.json();
      if (data.success) {
        setOracleHint(data.oracleHint); setLifelineMsg('');
        update({ ...user, coins: data.newTotal });
      } else {
        setLifelineMsg(data.error || 'Not enough Intel');
      }
    } catch { setLifelineMsg('Oracle unreachable'); }
  }

  async function submit(ans) {
    if (submitting || result) return;
    clearInterval(timerRef.current); setSubmitting(true);
    const final = ans === '__timeout__'
      ? (effectiveMode === 'type' ? (typed.trim() || '__timeout__') : '__timeout__')
      : ans;
    if (effectiveMode === 'mcq') setSelected(final);
    try {
      const res = await fetch(`${BACKEND}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id, riddleId: riddle.id, userAnswer: final,
          timeTaken: (riddle.timeLimit || 30) - timeLeft, mode: effectiveMode
        })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        update({ ...user, coins: data.newTotal, streak: data.streakCount, xp: data.newXp, level: data.newLevel });
        setShowCoinFloat(true);
        setTimeout(() => setShowCoinFloat(false), 1600);
        if (data.isCorrect) {
          Animated.spring(resAnim, { toValue: 1, tension: 46, friction: 7, useNativeDriver: true }).start();
        } else {
          Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
          ]).start();
          Animated.spring(resAnim, { toValue: 1, tension: 46, friction: 7, useNativeDriver: true }).start();
        }
      }
    } catch { setLoadError('Network error. Your answer may not have been saved.'); }
    setSubmitting(false);
  }

  const tMax  = riddle?.timeLimit || 30;
  const tPct  = timeLeft / tMax;
  const tCol  = frozen ? Colors.cyan : tPct > 0.5 ? Colors.emerald : tPct > 0.25 ? Colors.gold : Colors.rose;
  const mCol  = panicMode ? Colors.rose : effectiveMode === 'type' ? Colors.purple : Colors.cyan;
  const mLabel = panicMode ? 'PANIC MODE' : effectiveMode === 'type' ? 'BRAIN BLAST' : 'QUICK CRACK';
  const bgColor  = panicMode ? '#080004' : Colors.bgBase;
  const cardBg   = panicMode ? 'rgba(30,0,10,0.85)' : 'rgba(12,12,22,0.92)';
  const cardBorder = panicMode ? 'rgba(255,0,0,0.25)' : 'rgba(255,255,255,0.07)';

  /* ── Non-riddle states ── */
  function renderSpecial() {
    if (maintenance) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 56, marginBottom: 24 }}>🔒</Text>
          <Text style={{ color: Colors.purpleLight, fontFamily: 'Chakra Petch', fontSize: 22, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 12 }}>VAULT LOCKED</Text>
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', fontSize: 13, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>{maintenanceMsg}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => go('home')}>
            <Icons.ChevronLeftIcon size={14} color={Colors.purpleLight} />
            <Text style={styles.backBtnText}>BACK TO BASE</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (exhausted) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 56, marginBottom: 24 }}>🏆</Text>
          <Text style={{ color: Colors.gold, fontFamily: 'Chakra Petch', fontSize: 22, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 12 }}>VAULT CLEARED</Text>
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', fontSize: 13, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            You've solved all available riddles for today.{'\n'}New riddles will be added soon!
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => go('home')}>
            <Icons.ChevronLeftIcon size={14} color={Colors.purpleLight} />
            <Text style={styles.backBtnText}>BACK TO BASE</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (loadError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 20 }}>⚠️</Text>
          <Text style={{ color: Colors.rose, fontFamily: 'Chakra Petch', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>CONNECTION FAILED</Text>
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', fontSize: 13, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>{loadError}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={[styles.backBtn, { backgroundColor: Colors.purple + '20', borderColor: Colors.purple + '50' }]} onPress={loadRiddle}>
              <Icons.ZapIcon size={14} color={Colors.purpleLight} />
              <Text style={styles.backBtnText}>RETRY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => go('home')}>
              <Icons.ChevronLeftIcon size={14} color={Colors.purpleLight} />
              <Text style={styles.backBtnText}>GO BACK</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {panicMode && <FilmGrainOverlay opacity={0.15} />}

      {/* Web ambient glow */}
      {!panicMode && isWeb && (
        <View style={{ position: 'absolute', top: '5%', right: '3%', width: 500, height: 500, borderRadius: 250, backgroundColor: mCol, opacity: 0.04, pointerEvents: 'none' }} />
      )}

      {/* Panic Mode Overlays */}
      {panicMode && (
        <>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 5 }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(255,0,0,0.08)' }} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(255,0,0,0.08)' }} />
            <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 60, backgroundColor: 'rgba(255,0,0,0.06)' }} />
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 60, backgroundColor: 'rgba(255,0,0,0.06)' }} />
          </View>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', pointerEvents: 'none', zIndex: 4 }}>
            <SmokeWisp delay={0} startX={20} />
            <SmokeWisp delay={800} startX={W * 0.3} />
            <SmokeWisp delay={1600} startX={W * 0.7} />
            <SmokeWisp delay={2400} startX={W - 80} />
          </View>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, pointerEvents: 'none' }}>
            <EmergencyLight side="left" />
            <EmergencyLight side="right" />
          </View>
        </>
      )}

      {/* ── Top Bar ── */}
      <View style={{
        height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, backgroundColor: panicMode ? '#1A0000' : 'rgba(8,8,16,0.95)',
        borderBottomWidth: 1, borderColor: panicMode ? 'rgba(255,0,0,0.3)' : 'rgba(255,255,255,0.06)', zIndex: 10
      }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
          onPress={() => go('home')}
        >
          <Icons.ChevronLeftIcon size={12} color={Colors.textSecondary} />
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>ABORT</Text>
        </TouchableOpacity>

        <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: mCol + '12', borderWidth: 1, borderColor: mCol + '30', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {panicMode ? <Icons.AlertTriangleIcon size={12} color={mCol} /> : <Icons.ZapIcon size={12} color={mCol} />}
          <Text style={{ color: mCol, fontFamily: 'Chakra Petch', fontWeight: '800', fontSize: 12, letterSpacing: 1.5 }}>{mLabel}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.gold + '10', borderWidth: 1, borderColor: Colors.gold + '25' }}>
          <Icons.IntelIcon size={13} color={Colors.gold} />
          <Text style={{ color: Colors.gold, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: 14 }}>{user?.coins ?? 0}</Text>
        </View>
      </View>

      {/* ── Body ── */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <ActivityIndicator size="large" color={mCol} />
          <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', lineHeight: 20 }}>
            Accessing vault...{'\n'}Calibrating difficulty
          </Text>
        </View>
      ) : renderSpecial() ?? (
        <ScrollView
          contentContainerStyle={{ maxWidth: 740, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Timer Row ── */}
          {!result && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 }}>
              <TimerBar tPct={tPct} tCol={tCol} />
              <Animated.Text style={{
                color: tCol, fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 22,
                minWidth: 72, textAlign: 'right', transform: [{ scale: timerPulse }]
              }}>
                {frozen ? '❄️ HELD' : `${timeLeft}s`}
              </Animated.Text>
            </View>
          )}

          {/* ── Lifelines ── */}
          {!result && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9,
                  borderRadius: 9, backgroundColor: frozen ? Colors.cyan + '15' : 'rgba(255,255,255,0.03)',
                  borderWidth: 1, borderColor: frozen ? Colors.cyan + '50' : 'rgba(255,255,255,0.08)'
                }}
                onPress={useTimeFreezeLifeline} disabled={!!frozen || !!result}
              >
                <Icons.TimerIcon size={13} color={frozen ? Colors.cyan : Colors.textMuted} />
                <Text style={{ color: frozen ? Colors.cyan : Colors.textMuted, fontFamily: 'Share Tech Mono', fontWeight: '700', fontSize: 11, letterSpacing: 0.5 }}>
                  FREEZE  100💾
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9,
                  borderRadius: 9, backgroundColor: oracleHint ? Colors.purple + '15' : 'rgba(255,255,255,0.03)',
                  borderWidth: 1, borderColor: oracleHint ? Colors.purple + '50' : 'rgba(255,255,255,0.08)'
                }}
                onPress={useOracleLifeline} disabled={!!oracleHint || !!result}
              >
                <Icons.DatabaseIcon size={13} color={oracleHint ? Colors.purpleLight : Colors.textMuted} />
                <Text style={{ color: oracleHint ? Colors.purpleLight : Colors.textMuted, fontFamily: 'Share Tech Mono', fontWeight: '700', fontSize: 11, letterSpacing: 0.5 }}>
                  ORACLE  150💾
                </Text>
              </TouchableOpacity>

              {lifelineMsg ? (
                <Text style={{ color: Colors.rose, fontFamily: 'Share Tech Mono', fontSize: 11, alignSelf: 'center', flex: 1, fontWeight: '600' }}>{lifelineMsg}</Text>
              ) : null}
            </View>
          )}

          {/* ── Oracle Hint ── */}
          {oracleHint && (
            <View style={{ marginBottom: 18, padding: 18, borderRadius: 12, backgroundColor: Colors.purple + '08', borderWidth: 1, borderColor: Colors.purple + '25' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icons.DatabaseIcon size={11} color={Colors.purpleLight} />
                <Text style={{ color: Colors.purpleLight, fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 10, letterSpacing: 2 }}>ORACLE DECRYPTED</Text>
              </View>
              <Text style={{ color: Colors.textPrimary, fontFamily: 'Cormorant Garamond', fontSize: 16, fontStyle: 'italic', lineHeight: 22 }}>{oracleHint}</Text>
            </View>
          )}

          {/* ── Meta row: category + difficulty ── */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {riddle?.category ? (
              <View style={{ backgroundColor: Colors.purple + '12', borderColor: 'rgba(168,85,247,0.25)', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 }}>
                <Text style={{ color: Colors.purpleLight, fontFamily: 'Share Tech Mono', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>{riddle.category}</Text>
              </View>
            ) : null}
            {riddle?.difficulty ? <DiffChip level={riddle.difficulty} /> : null}
          </View>

          {/* ── Question Card ── */}
          <View style={{
            backgroundColor: cardBg, borderRadius: 16, padding: 28,
            borderWidth: 1, borderColor: cardBorder, marginBottom: 20
          }}>
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Cormorant Garamond', fontSize: 24, fontWeight: '700', lineHeight: 36 }}>
              {riddle?.question}
            </Text>

            {!hintUsed && !result && riddle?.hint ? (
              <TouchableOpacity
                style={{ marginTop: 22, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.gold + '08', borderWidth: 1, borderColor: Colors.gold + '25' }}
                onPress={() => setHintUsed(true)}
              >
                <Icons.TargetIcon size={11} color={Colors.gold} />
                <Text style={{ color: Colors.gold, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>DEPLOY HINT — 5💾</Text>
              </TouchableOpacity>
            ) : null}

            {hintUsed && (
              <View style={{ marginTop: 22, padding: 16, borderRadius: 10, backgroundColor: Colors.gold + '06', borderWidth: 1, borderColor: Colors.gold + '20', flexDirection: 'row', gap: 12 }}>
                <Icons.TargetIcon size={15} color={Colors.gold} />
                <Text style={{ flex: 1, color: Colors.gold, fontFamily: 'Share Tech Mono', fontSize: 13, lineHeight: 20 }}>{riddle?.hint}</Text>
              </View>
            )}
          </View>

          {/* ── MCQ Options ── */}
          {effectiveMode === 'mcq' && Array.isArray(riddle?.options) && riddle.options.map((opt, i) => {
            const right   = result && opt === result.correctAnswer;
            const wrong   = result && opt === selected && !result.isCorrect;
            const picked  = !result && selected === opt;
            const letter  = ['A', 'B', 'C', 'D'][i];
            return (
              <TouchableOpacity
                key={i}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 16,
                  padding: 18, borderRadius: 12, marginBottom: 10,
                  backgroundColor: right ? Colors.emerald + '12' : wrong ? Colors.rose + '12' : picked ? mCol + '08' : 'rgba(255,255,255,0.02)',
                  borderWidth: 1.5,
                  borderColor: right ? Colors.emerald + '55' : wrong ? Colors.rose + '55' : picked ? mCol + '45' : 'rgba(255,255,255,0.07)'
                }}
                onPress={() => !result && !selected && !submitting && submit(opt)}
                disabled={!!result || !!selected || submitting}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: right ? Colors.emerald : wrong ? Colors.rose : 'rgba(255,255,255,0.05)',
                  borderWidth: 1,
                  borderColor: right ? Colors.emerald : wrong ? Colors.rose : 'rgba(255,255,255,0.1)'
                }}>
                  <Text style={{ color: right || wrong ? '#000' : Colors.textMuted, fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 15 }}>{letter}</Text>
                </View>
                <Text style={{
                  flex: 1, color: right ? Colors.emerald : wrong ? '#fca5a5' : Colors.textPrimary,
                  fontFamily: 'Chakra Petch', fontSize: 15, fontWeight: '600', lineHeight: 22, letterSpacing: 0.3
                }}>{opt}</Text>
                {right && <Icons.TargetIcon size={18} color={Colors.emerald} />}
                {wrong && <Icons.XIcon size={18} color={Colors.rose} />}
              </TouchableOpacity>
            );
          })}

          {/* ── Type Answer ── */}
          {effectiveMode === 'type' && !result && (
            <View style={{ gap: 14 }}>
              {mode === 'mcq' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.gold + '08', borderWidth: 1, borderColor: Colors.gold + '20' }}>
                  <Icons.TargetIcon size={12} color={Colors.gold} />
                  <Text style={{ color: Colors.gold, fontFamily: 'Share Tech Mono', fontSize: 11, letterSpacing: 0.5 }}>No choices available — type your answer</Text>
                </View>
              )}
              <TextInput
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
                  borderRadius: 12, padding: 20, color: Colors.textPrimary, fontFamily: 'Share Tech Mono', fontSize: 16,
                  minHeight: 100, textAlignVertical: 'top'
                }}
                placeholder="Type your answer here..."
                placeholderTextColor={Colors.textMuted}
                value={typed}
                onChangeText={setTyped}
                editable={!submitting}
                multiline
              />
              <TouchableOpacity
                style={{
                  backgroundColor: submitting ? Colors.purple + '60' : Colors.purple,
                  paddingVertical: 16, borderRadius: 10,
                  flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
                  borderWidth: 1, borderColor: Colors.purpleLight + '40',
                  opacity: (!typed.trim() || submitting) ? 0.45 : 1
                }}
                onPress={() => typed.trim() && !submitting && submit(typed.trim())}
                disabled={!typed.trim() || submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Icons.TerminalIcon size={15} color={'#fff'} />
                      <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 13, letterSpacing: 1.5 }}>TRANSMIT RESPONSE</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── Result Card ── */}
          {result && (
            <Animated.View style={{
              backgroundColor: cardBg, borderRadius: 18, padding: 32,
              borderWidth: 1.5,
              borderColor: result.isCorrect ? Colors.emerald + '45' : Colors.rose + '45',
              alignItems: 'center', marginTop: 16, overflow: 'hidden',
              transform: [{ scale: resAnim }, { translateX: result.isCorrect ? 0 : shakeAnim }]
            }}>
              {showCoinFloat && <FloatingCoin amount={result.coinsChange ?? 0} color={(result.coinsChange ?? 0) > 0 ? Colors.gold : Colors.rose} />}

              {/* Ambient glow behind icon */}
              <View style={{
                position: 'absolute', top: 0, left: '20%',
                width: 220, height: 220, borderRadius: 110,
                backgroundColor: result.isCorrect ? Colors.emerald : Colors.rose,
                opacity: 0.06
              }} />

              {result.isCorrect
                ? <Icons.TargetIcon size={52} color={Colors.emerald} />
                : <Icons.XIcon size={52} color={Colors.rose} />
              }

              <Text style={{
                color: result.isCorrect ? Colors.emerald : Colors.rose,
                fontFamily: 'Chakra Petch', fontSize: 32, fontWeight: '900', marginTop: 16, letterSpacing: 2
              }}>
                {result.isCorrect ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
              </Text>

              {/* Correct answer box */}
              <View style={{
                marginTop: 22, padding: 18, borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                width: '100%', alignItems: 'center'
              }}>
                <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 10, marginBottom: 8, letterSpacing: 2, fontWeight: '700' }}>
                  {result.isCorrect ? 'YOUR ANSWER WAS CORRECT' : 'CORRECT ANSWER'}
                </Text>
                <Text style={{ color: result.isCorrect ? Colors.emerald : '#fca5a5', fontFamily: 'Chakra Petch', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
                  {result.correctAnswer}
                </Text>
              </View>

              {/* Intel Earned */}
              <View style={{
                marginTop: 20, paddingVertical: 18, paddingHorizontal: 36, borderRadius: 14,
                backgroundColor: (result.coinsChange ?? 0) > 0 ? Colors.gold + '08' : Colors.rose + '08',
                borderWidth: 1.5, borderColor: (result.coinsChange ?? 0) > 0 ? Colors.gold + '35' : Colors.rose + '35'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icons.IntelIcon size={22} color={(result.coinsChange ?? 0) > 0 ? Colors.gold : Colors.rose} />
                  <Text style={{ color: (result.coinsChange ?? 0) > 0 ? Colors.gold : Colors.rose, fontFamily: 'Share Tech Mono', fontSize: 34, fontWeight: '900' }}>
                    {(result.coinsChange ?? 0) > 0 ? '+' : ''}{result.coinsChange ?? 0}
                  </Text>
                </View>
              </View>

              {/* XP / Streak badges */}
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
                {(result.xpGained ?? 0) > 0 && (
                  <View style={{ backgroundColor: Colors.purple + '15', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: Colors.purple + '30' }}>
                    <Text style={{ color: Colors.purpleLight, fontFamily: 'Share Tech Mono', fontSize: 12, fontWeight: '800' }}>+{result.xpGained} Crack Score ⚡</Text>
                  </View>
                )}
                {(result.streakCount ?? 0) > 1 && (
                  <View style={{ backgroundColor: Colors.orange + '15', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: Colors.orange + '30' }}>
                    <Text style={{ color: Colors.orange, fontFamily: 'Share Tech Mono', fontSize: 12, fontWeight: '800' }}>🔥 {result.streakCount} STREAK</Text>
                  </View>
                )}
                {result.streakBonus && (
                  <View style={{ backgroundColor: Colors.gold + '15', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: Colors.gold + '30' }}>
                    <Text style={{ color: Colors.gold, fontFamily: 'Share Tech Mono', fontSize: 12, fontWeight: '800' }}>🎉 +100 BONUS</Text>
                  </View>
                )}
              </View>

              {/* Level up banner */}
              {result.leveledUp && (
                <View style={{ marginTop: 22, padding: 22, borderRadius: 14, backgroundColor: Colors.purple + '12', borderWidth: 1.5, borderColor: Colors.purple + '40', width: '100%', alignItems: 'center' }}>
                  <Text style={{ color: Colors.purpleLight, fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 18, letterSpacing: 2 }}>CLEARANCE UPGRADED</Text>
                  <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', fontWeight: '700', fontSize: 14, marginTop: 6 }}>NEW LEVEL: {result.newLevel}</Text>
                </View>
              )}

              {/* Fun fact */}
              {riddle?.fun_fact && (
                <View style={{ marginTop: 18, padding: 18, borderRadius: 12, backgroundColor: Colors.cyan + '06', borderWidth: 1, borderColor: Colors.cyan + '20', width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Icons.LinkIcon size={11} color={Colors.cyan} />
                    <Text style={{ color: Colors.cyan, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: 10, letterSpacing: 2 }}>DID YOU KNOW</Text>
                  </View>
                  <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 15, lineHeight: 22, fontStyle: 'italic' }}>{riddle.fun_fact}</Text>
                </View>
              )}

              {/* Next / Home */}
              <TouchableOpacity
                style={{ backgroundColor: mCol, paddingVertical: 16, borderRadius: 10, alignItems: 'center', alignSelf: 'stretch', marginTop: 28, borderWidth: 1, borderColor: mCol + '60' }}
                onPress={loadRiddle}
              >
                <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>NEXT RIDDLE →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => go('home')} style={{ marginTop: 14, alignItems: 'center', padding: 10 }}>
                <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 12, letterSpacing: 1 }}>RETURN TO BASE</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = {
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.purple + '15', borderWidth: 1, borderColor: Colors.purple + '40'
  },
  backBtnText: {
    color: Colors.purpleLight, fontFamily: 'Share Tech Mono', fontWeight: '700',
    fontSize: 12, letterSpacing: 1.5
  }
};
