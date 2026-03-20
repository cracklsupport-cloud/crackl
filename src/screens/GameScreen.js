import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Animated, Easing, Dimensions, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';
import { FilmGrainOverlay } from '../components/AtmosphericEffects';

const { width: W, height: H } = Dimensions.get('window');

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
    }}>{amount > 0 ? '+' : ''}{amount} 🪙</Animated.Text>
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

export default function GameScreen({ user, go, update, mode, panicMode }) {
  const [riddle, setRiddle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [oracleHint, setOracleHint] = useState(null);
  const [lifelineMsg, setLifelineMsg] = useState('');
  const [showCoinFloat, setShowCoinFloat] = useState(false);
  const timerRef = useRef(null);
  const freezeRef = useRef(null);
  const resAnim = useRef(new Animated.Value(0.88)).current;
  const timerPulse = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadRiddle(); return () => { clearInterval(timerRef.current); clearTimeout(freezeRef.current); }; }, []);

  async function loadRiddle() {
    setLoading(true); setRiddle(null); setSelected(null); setResult(null);
    setHintUsed(false); setTyped(''); setOracleHint(null); setLifelineMsg(''); resAnim.setValue(0.88);
    clearInterval(timerRef.current);
    try {
      const res = await fetch(`${BACKEND}/riddle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, city: user.city, area: user.area, xp: user.xp || 0 }) });
      const data = await res.json();
      if (data.success && data.riddle) { setRiddle(data.riddle); const t = data.riddle.timeLimit || 30; setTimeLeft(t); startTick(t); }
    } catch { alert('Backend not running!\ncd ~/Desktop/CRACKL/CRACKL-backend && node server.js'); }
    setLoading(false);
  }

  function startTick(n) {
    clearInterval(timerRef.current);
    const tickMs = panicMode ? 500 : 1000;
    let t = n;
    timerRef.current = setInterval(() => {
      if (!frozen) { t--; setTimeLeft(t); }
      if (t <= 10 && t > 0) { Animated.sequence([Animated.timing(timerPulse, { toValue: 1.15, duration: 150, useNativeDriver: true }), Animated.timing(timerPulse, { toValue: 1, duration: 150, useNativeDriver: true })]).start(); }
      if (t <= 0) { clearInterval(timerRef.current); submit('__timeout__'); }
    }, tickMs);
  }

  async function useTimeFreezeLifeline() {
    if (frozen || result) return;
    try {
      const res = await fetch(`${BACKEND}/lifeline/time-freeze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
      const data = await res.json();
      if (data.success) { setFrozen(true); setLifelineMsg('❄️ Time frozen for 10s!'); update({ ...user, coins: data.newTotal }); freezeRef.current = setTimeout(() => { setFrozen(false); setLifelineMsg(''); }, 10000); }
      else { setLifelineMsg(data.error || 'Not enough assets'); }
    } catch { setLifelineMsg('Link failed'); }
  }

  async function useOracleLifeline() {
    if (!riddle || result) return;
    try {
      const res = await fetch(`${BACKEND}/lifeline/oracle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, riddleId: riddle.id, riddleQuestion: riddle.question }) });
      const data = await res.json();
      if (data.success) { setOracleHint(data.oracleHint); setLifelineMsg(''); update({ ...user, coins: data.newTotal }); }
      else { setLifelineMsg(data.error || 'Not enough assets'); }
    } catch { setLifelineMsg('Oracle unreachable'); }
  }

  async function submit(ans) {
    if (submitting || result) return;
    clearInterval(timerRef.current); setSubmitting(true);
    const final = ans === '__timeout__' ? (mode === 'type' ? (typed.trim() || '__timeout__') : '__timeout__') : ans;
    if (mode === 'mcq') setSelected(final);
    try {
      const res = await fetch(`${BACKEND}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, riddleId: riddle.id, userAnswer: final, timeTaken: (riddle.timeLimit || 30) - timeLeft, mode }) });
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
    } catch { alert('Network error'); }
    setSubmitting(false);
  }

  const tMax = riddle?.timeLimit || 30;
  const tPct = timeLeft / tMax;
  const tCol = frozen ? Colors.cyan : tPct > 0.5 ? Colors.emerald : tPct > 0.25 ? Colors.gold : Colors.rose;
  const mCol = panicMode ? Colors.rose : mode === 'type' ? Colors.purple : Colors.cyan;
  const mLabel = panicMode ? 'PANIC MODE' : mode === 'type' ? 'BRAIN BLAST' : 'QUICK CRACK';
  const bgColor = panicMode ? '#080004' : Colors.bgBase;
  const cardBg = panicMode ? 'rgba(30,0,10,0.8)' : 'rgba(15,15,26,0.8)';
  const panicBorder = panicMode ? 'rgba(255,0,0,0.2)' : Colors.borderDefault;

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {panicMode && <FilmGrainOverlay opacity={0.15} />}
      {!panicMode && Platform.OS === 'web' && (
        <View style={{ position: 'absolute', top: '10%', right: '5%', width: 400, height: 400, borderRadius: 200, backgroundColor: mCol, opacity: 0.05 }} />
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

      {/* Top Bar */}
      <View style={{
        height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, backgroundColor: panicMode ? '#1A0000' : 'rgba(15,15,26,0.9)',
        borderBottomWidth: 1, borderColor: panicBorder, zIndex: 10}}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.bgBase, borderWidth: 1, borderColor: Colors.borderDefault }} onPress={() => go('home')}>
          <Icons.ChevronLeftIcon size={12} color={Colors.purpleLight} />
          <Text style={{ color: Colors.purpleLight, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: 13, letterSpacing: 1 }}>ABORT</Text>
        </TouchableOpacity>
        
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexRow: 'row', alignItems: 'center', gap: 8, borderRadius: 8, backgroundColor: mCol + '15', borderWidth: 1, borderColor: mCol + '35' }}>
          {panicMode ? <Icons.AlertTriangleIcon size={12} color={mCol} /> : <Icons.ZapIcon size={12} color={mCol} />}
          <Text style={{ color: mCol, fontFamily: 'Chakra Petch', fontWeight: '800', fontSize: 13, letterSpacing: 1 }}>{mLabel}</Text>
        </View>
        
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.gold + '10', borderWidth: 1, borderColor: Colors.gold + '30' }}>
            <Icons.CoinIcon size={14} color={Colors.gold} />
            <Text style={{ color: Colors.gold, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: 14 }}>{user?.coins ?? 0}</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={mCol} />
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', marginTop: 24, textAlign: 'center', fontSize: 13, lineHeight: 22, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Synthesizing intelligence...{'\n'}Localizing variables to {user?.city}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ maxWidth: 720, alignSelf: 'center', width: '100%', padding: 32, paddingBottom: 64 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Timer Bar */}
          {!result && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <View style={{ flex: 1, height: 4, backgroundColor: Colors.borderDefault, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ width: `${tPct * 100}%`, height: 4, backgroundColor: tCol, borderRadius: 2, transition: 'width 0.3s' }} />
              </View>
              <Animated.Text style={{ color: tCol, fontWeight: '900', fontSize: 24, minWidth: 64, textAlign: 'right', fontFamily: 'Share Tech Mono', transform: [{ scale: timerPulse }] }}>
                {frozen ? 'FROZEN' : `${timeLeft}s`}
              </Animated.Text>
            </View>
          )}

          {/* Lifelines */}
          {!result && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TouchableOpacity style={{
                flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
                borderRadius: 10, backgroundColor: frozen ? Colors.cyan + '15' : 'rgba(15,15,26,0.6)',
                borderWidth: 1, borderColor: frozen ? Colors.cyan + '50' : Colors.borderDefault}} onPress={useTimeFreezeLifeline} disabled={!!frozen || !!result}>
                <Icons.TimerIcon size={14} color={frozen ? Colors.cyan : Colors.textSecondary} />
                <Text style={{ color: frozen ? Colors.cyan : Colors.textSecondary, fontFamily: 'Chakra Petch', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>FREEZE (100<Text style={{ fontFamily: 'Share Tech Mono' }}>🪙</Text>)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{
                flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
                borderRadius: 10, backgroundColor: oracleHint ? Colors.purple + '15' : 'rgba(15,15,26,0.6)',
                borderWidth: 1, borderColor: oracleHint ? Colors.purple + '50' : Colors.borderDefault}} onPress={useOracleLifeline} disabled={!!oracleHint || !!result}>
                <Icons.DatabaseIcon size={14} color={oracleHint ? Colors.purpleLight : Colors.textSecondary} />
                <Text style={{ color: oracleHint ? Colors.purpleLight : Colors.textSecondary, fontFamily: 'Chakra Petch', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>ORACLE (150<Text style={{ fontFamily: 'Share Tech Mono' }}>🪙</Text>)</Text>
              </TouchableOpacity>
              {lifelineMsg ? <Text style={{ color: Colors.rose, fontFamily: 'Share Tech Mono', fontSize: 11, alignSelf: 'center', flex: 1, fontWeight: '600' }}>{lifelineMsg}</Text> : null}
            </View>
          )}

          {/* Oracle Hint */}
          {oracleHint && (
            <View style={{ marginBottom: 18, padding: 18, borderRadius: 12, backgroundColor: Colors.purple + '10', borderWidth: 1, borderColor: Colors.purple + '35' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icons.DatabaseIcon size={12} color={Colors.purpleLight} />
                <Text style={{ color: Colors.purpleLight, fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 }}>ORACLE DECRYPTED</Text>
              </View>
              <Text style={{ color: Colors.textPrimary, fontFamily: 'Cormorant Garamond', fontSize: 16, fontStyle: 'italic', lineHeight: 22 }}>{oracleHint}</Text>
            </View>
          )}

          {/* Category + Difficulty */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
            <View style={{ backgroundColor: Colors.purple + '15', borderColor: Colors.purple + '30', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 }}>
              <Text style={{ color: Colors.purpleLight, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>{riddle?.category}</Text>
            </View>
            <DiffChip level={riddle?.difficulty} />
          </View>

          {/* Question Card */}
          <View style={{
            backgroundColor: cardBg, borderRadius: 16, padding: 28,
            borderWidth: 1.5, borderColor: panicBorder, marginBottom: 20, zIndex: 10}}>
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Cormorant Garamond', fontSize: 24, fontWeight: '700', lineHeight: 34 }}>{riddle?.question}</Text>
            
            {!hintUsed && !result && (
              <TouchableOpacity style={{ marginTop: 24, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.gold + '10', borderWidth: 1, borderColor: Colors.gold + '30' }} onPress={() => setHintUsed(true)}>
                <Icons.TargetIcon size={12} color={Colors.gold} />
                <Text style={{ color: Colors.gold, fontFamily: 'Chakra Petch', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>DEPLOY HINT (5 🪙)</Text>
              </TouchableOpacity>
            )}
            {hintUsed && (
              <View style={{ marginTop: 24, padding: 18, borderRadius: 10, backgroundColor: Colors.gold + '08', borderWidth: 1, borderColor: Colors.gold + '25', flexDirection: 'row', gap: 12 }}>
                <Icons.TargetIcon size={16} color={Colors.goldLight} />
                <Text style={{ flex: 1, color: Colors.goldLight, fontFamily: 'Share Tech Mono', fontSize: 13, lineHeight: 20 }}>{riddle?.hint}</Text>
              </View>
            )}
          </View>

          {/* MCQ Options */}
          {mode === 'mcq' && riddle?.options?.map((opt, i) => {
            const right = result && opt === result.correctAnswer;
            const wrong = result && opt === selected && !result.isCorrect;
            const picked = !result && selected === opt;
            const letter = ['A', 'B', 'C', 'D'][i];
            
            return (
              <TouchableOpacity key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18,
                borderRadius: 12, marginBottom: 12,
                backgroundColor: right ? Colors.emerald + '15' : wrong ? Colors.rose + '15' : 'rgba(15,15,26,0.6)',
                borderWidth: 1.5,
                borderColor: right ? Colors.emerald + '60' : wrong ? Colors.rose + '60' : picked ? mCol + '50' : Colors.borderDefault}} onPress={() => !result && !selected && !submitting && submit(opt)} disabled={!!result || !!selected || submitting} activeOpacity={0.7}>
                <View style={{
                  width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: right ? Colors.emerald : wrong ? Colors.rose : Colors.bgBase,
                  borderWidth: 1, borderColor: right ? Colors.emerald : wrong ? Colors.rose : Colors.borderDefault}}>
                  <Text style={{ color: right || wrong ? '#000' : Colors.textSecondary, fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 16 }}>{letter}</Text>
                </View>
                <Text style={{
                  flex: 1, color: right ? Colors.emerald : wrong ? '#fca5a5' : Colors.textPrimary,
                  fontFamily: 'Chakra Petch', fontSize: 16, fontWeight: '600', lineHeight: 22, letterSpacing: 0.5
                }}>{opt}</Text>
                {right && <Icons.TargetIcon size={20} color={Colors.emerald} />}
                {wrong && <Icons.XIcon size={20} color={Colors.rose} />}
              </TouchableOpacity>
            );
          })}

          {/* Type Answer */}
          {mode === 'type' && !result && (
            <View style={{ gap: 16 }}>
              <TextInput style={{
                backgroundColor: 'rgba(15,15,26,0.6)', borderWidth: 1.5, borderColor: Colors.borderDefault,
                borderRadius: 12, padding: 20, color: Colors.textPrimary, fontFamily: 'Share Tech Mono', fontSize: 16,
                minHeight: 100, textAlignVertical: 'top'}} placeholder="Awaiting manual input..." placeholderTextColor={Colors.textMuted} value={typed} onChangeText={setTyped} editable={!submitting} multiline onSubmitEditing={() => typed.trim() && submit(typed.trim())} />
              <TouchableOpacity style={{
                backgroundColor: Colors.purple, paddingVertical: 18, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12,
                borderWidth: 1, borderColor: Colors.purpleLight,
                opacity: (!typed.trim() || submitting) ? 0.4 : 1}} onPress={() => typed.trim() && !submitting && submit(typed.trim())} disabled={!typed.trim() || submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Icons.TerminalIcon size={16} color={'#fff'} />
                    <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>TRANSMIT RESPONSE</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Result Card */}
          {result && (
            <Animated.View style={{
              backgroundColor: cardBg, borderRadius: 18, padding: 36,
              borderWidth: 2, borderColor: result.isCorrect ? Colors.emerald + '50' : Colors.rose + '50',
              alignItems: 'center', marginTop: 16, overflow: 'hidden',
              transform: [{ scale: resAnim }, { translateX: result.isCorrect ? 0 : shakeAnim }]}}>
              {/* Floating coin animation */}
              {showCoinFloat && <FloatingCoin amount={result.coinsChange ?? 0} color={(result.coinsChange ?? 0) > 0 ? Colors.gold : Colors.rose} />}

              {/* Correct answer: emerald glow */}
              {result.isCorrect && (
                <View style={{ position: 'absolute', top: '30%', left: '30%', width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.emerald, opacity: 0.1}} />
              )}
              {/* Wrong answer: rose glow */}
              {!result.isCorrect && (
                <View style={{ position: 'absolute', top: '30%', left: '30%', width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.rose, opacity: 0.05}} />
              )}

              {result.isCorrect ? <Icons.TargetIcon size={56} color={Colors.emerald} /> : <Icons.XIcon size={56} color={Colors.rose} />}
              <Text style={{ color: result.isCorrect ? Colors.emerald : Colors.rose, fontFamily: 'Chakra Petch', fontSize: 36, fontWeight: '900', marginTop: 16, letterSpacing: 2 }}>
                {result.isCorrect ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
              </Text>

              <View style={{ marginTop: 24, padding: 20, borderRadius: 12, backgroundColor: 'rgba(15,15,26,0.6)', borderWidth: 1, borderColor: Colors.borderDefault, width: '100%', alignItems: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, marginBottom: 8, letterSpacing: 1.5, fontWeight: '700' }}>
                  {result.isCorrect ? 'TRANSMITTED ANSWER ACCEPTED' : 'CORRECT SOLUTION SEQUENCE'}
                </Text>
                <Text style={{ color: result.isCorrect ? Colors.emerald : '#fca5a5', fontFamily: 'Chakra Petch', fontSize: 24, fontWeight: '900', textAlign: 'center' }}>{result.correctAnswer}</Text>
              </View>

              <View style={{
                marginTop: 24, paddingVertical: 20, paddingHorizontal: 40, borderRadius: 14,
                backgroundColor: (result.coinsChange ?? 0) > 0 ? Colors.gold + '10' : Colors.rose + '10',
                borderWidth: 1.5, borderColor: (result.coinsChange ?? 0) > 0 ? Colors.gold + '40' : Colors.rose + '40'}}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Icons.CoinIcon size={24} color={(result.coinsChange ?? 0) > 0 ? Colors.gold : Colors.rose} />
                  <Text style={{ color: (result.coinsChange ?? 0) > 0 ? Colors.gold : Colors.rose, fontFamily: 'Share Tech Mono', fontSize: 36, fontWeight: '900' }}>
                    {(result.coinsChange ?? 0) > 0 ? '+' : ''}{result.coinsChange ?? 0}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 20 }}>
                {(result.xpGained ?? 0) > 0 && <View style={{ backgroundColor: Colors.purple + '15', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.purple + '30' }}><Text style={{ color: Colors.purpleLight, fontFamily: 'Share Tech Mono', fontSize: 13, fontWeight: '800' }}>+{result.xpGained} XP ⚡</Text></View>}
                {(result.streakCount ?? 0) > 0 && <View style={{ backgroundColor: Colors.orange + '15', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.orange + '30' }}><Text style={{ color: Colors.orange, fontFamily: 'Share Tech Mono', fontSize: 13, fontWeight: '800' }}>🔥 {result.streakCount} COMBO</Text></View>}
                {result.streakBonus && <View style={{ backgroundColor: Colors.gold + '15', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.gold + '30' }}><Text style={{ color: Colors.gold, fontFamily: 'Share Tech Mono', fontSize: 13, fontWeight: '800' }}>🎉 +100 BONUS</Text></View>}
              </View>

              {result.leveledUp && (
                <View style={{ marginTop: 24, padding: 24, borderRadius: 14, backgroundColor: Colors.purple + '15', borderWidth: 1.5, borderColor: Colors.purple + '50', width: '100%', alignItems: 'center', overflow: 'hidden' }}>
                  <View style={{ position: 'absolute', top: '-100%', left: '-50%', width: '200%', height: '400%', backgroundColor: 'rgba(255,255,255,0.04)', transform: [{ rotate: '25deg' }] }} />
                  <Text style={{ color: Colors.purpleLight, fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 20, letterSpacing: 2 }}>SECURITY CLEARANCE UPGRADED</Text>
                  <Text style={{ color: Colors.textPrimary, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: 15, marginTop: 8 }}>NEW LEVEL: {result.newLevel}</Text>
                </View>
              )}

              {riddle?.fun_fact && (
                <View style={{ marginTop: 20, padding: 20, borderRadius: 12, backgroundColor: Colors.cyan + '08', borderWidth: 1, borderColor: Colors.cyan + '25', width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Icons.LinkIcon size={12} color={Colors.cyanLight} />
                    <Text style={{ color: Colors.cyanLight, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: 12, letterSpacing: 1.5 }}>DECRYPTED ARCHIVE LOG</Text>
                  </View>
                  <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 15, lineHeight: 22, fontStyle: 'italic' }}>{riddle.fun_fact}</Text>
                </View>
              )}

              <TouchableOpacity style={{
                backgroundColor: mCol, paddingVertical: 18, borderRadius: 10,
                alignItems: 'center', alignSelf: 'stretch', marginTop: 32,
                borderWidth: 1, borderColor: mCol}} onPress={loadRiddle}>
                <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 }}>PROCEED TO NEXT NODE →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => go('home')} style={{ marginTop: 16, alignItems: 'center', padding: 10 }}>
                <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>HALT PROGRESSION</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
