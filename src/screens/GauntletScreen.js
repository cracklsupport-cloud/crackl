import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, TextInput } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';
import { getAuthToken } from '../utils/authSession';
import RiddleContent from '../components/RiddleContent';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
const grotesk = isWeb ? '"Space Grotesk", sans-serif' : 'Chakra Petch';
const serif = 'Cormorant Garamond';
const DEFAULT_TIME = 20;
const MAX_STRIKES = 3;

function CornerBrackets() {
  const s = { position: 'absolute', width: 12, height: 12, borderColor: 'rgba(255,255,255,0.2)', zIndex: 20 };
  return (<>{[
    { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 },
    { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 },
    { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 },
    { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 }
  ].map((pos, i) => <View key={i} style={{ ...s, ...pos }} />)}</>);
}

function ArenaOverlay() {
  if (!isWeb) return null;
  return (<>
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, opacity: 0.15, mixBlendMode: 'overlay', backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
    <View style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.05)', top: '33%' }} />
      <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.05)', bottom: '33%' }} />
      <View style={{ position: 'absolute', height: '100%', width: 1, backgroundColor: 'rgba(255,255,255,0.05)', left: '33%' }} />
      <View style={{ position: 'absolute', height: '100%', width: 1, backgroundColor: 'rgba(255,255,255,0.05)', right: '33%' }} />
    </View>
  </>);
}

export default function GauntletScreen({ user, go, exitToHome, update, panicMode }) {
  const [riddle, setRiddle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cleared, setCleared] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [endReason, setEndReason] = useState('');
  const [err, setErr] = useState('');
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const timerRef = useRef(null);
  const riddleRef = useRef(null);
  const typedRef = useRef('');
  const timeLeftRef = useRef(DEFAULT_TIME);
  const answerLockRef = useRef(false);
  const accent = panicMode ? '#ff2a2a' : '#00ffd0';

  useEffect(() => {
    loadRiddle();
    return () => clearInterval(timerRef.current);
  }, []);

  function startTimer(limit) {
    clearInterval(timerRef.current);
    let t = limit;
    setTimeLeft(t);
    timeLeftRef.current = t;
    timerRef.current = setInterval(() => {
      t--;
      setTimeLeft(t);
      timeLeftRef.current = t;
      if (t <= 0) {
        clearInterval(timerRef.current);
        submitAnswer('__timeout__');
      }
    }, 1000);
  }

  async function loadRiddle() {
    setLoading(true);
    setErr('');
    setResult(null);
    setSelected(null);
    setTyped('');
    typedRef.current = '';
    clearInterval(timerRef.current);
    riddleRef.current = null;
    answerLockRef.current = false;
    try {
      const token = await getAuthToken();
      const params = new URLSearchParams({ mode: 'gauntlet', panicMode: panicMode ? 'true' : 'false' });
      const res = token
        ? await fetch(`${BACKEND}/api/riddles/next?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        : await fetch(`${BACKEND}/riddle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, city: user.city, area: user.area, xp: user.xp || 0, mode: 'gauntlet', panicMode: !!panicMode })
          });
      const data = await res.json();
      if (data.success && data.riddle) {
        const nextRiddle = data.riddle;
        const limit = nextRiddle.timeLimit || DEFAULT_TIME;
        setRiddle(nextRiddle);
        riddleRef.current = nextRiddle;
        // Timer ONLY runs in Panic Mode
        if (panicMode) startTimer(limit);
        else { clearInterval(timerRef.current); setTimeLeft(limit); timeLeftRef.current = limit; }
      } else {
        setDone(true);
        setEndReason(data.error || 'Gauntlet pool is empty right now.');
      }
    } catch {
      setErr('Connection lost while loading the next node.');
    }
    setLoading(false);
  }

  async function submitAnswer(ans) {
    const activeRiddle = riddleRef.current || riddle;
    if (!activeRiddle || answerLockRef.current) return;
    answerLockRef.current = true;
    clearInterval(timerRef.current);
    setSubmitting(true);
    setErr('');

    const hasOptions = Array.isArray(activeRiddle.options) && activeRiddle.options.length > 1;
    const answerMode = hasOptions ? 'mcq' : 'type';
    const final = ans === '__timeout__'
      ? (answerMode === 'type' ? (typedRef.current.trim() || '__timeout__') : '__timeout__')
      : ans;
    setSelected(final);

    try {
      const limit = activeRiddle.timeLimit || DEFAULT_TIME;
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          userId: user.id,
          riddleId: activeRiddle.id,
          userAnswer: final,
          timeTaken: panicMode ? (limit - timeLeftRef.current) : 0,
          mode: answerMode,
          gameMode: 'gauntlet',
          panicMode: !!panicMode
        })
      });
      const data = await res.json();
      if (!data.success) {
        answerLockRef.current = false;
        setSelected(null);
        setErr(data.error || 'Gauntlet answer could not be recorded.');
        setSubmitting(false);
        return;
      }

      const nextStrikes = data.isCorrect ? strikes : strikes + 1;
      const nextCleared = data.isCorrect ? cleared + 1 : cleared;
      const nextStreak = data.isCorrect ? streak + 1 : 0;
      const nextBestStreak = Math.max(bestStreak, nextStreak);

      setResult({ ...data, strikeNumber: nextStrikes, timedOut: final === '__timeout__' });
      setStrikes(nextStrikes);
      setCleared(nextCleared);
      setStreak(nextStreak);
      setBestStreak(nextBestStreak);
      update({ ...user, coins: data.newTotal, xp: data.newXp, level: data.newLevel, streak: data.streakCount });

      setTimeout(() => {
        if (nextStrikes >= MAX_STRIKES) {
          setDone(true);
          setEndReason('Three strikes. The gauntlet has closed.');
          return;
        }
        loadRiddle();
      }, 1200);
    } catch {
      answerLockRef.current = false;
      setSelected(null);
      setErr('Network error while submitting this node.');
    }
    setSubmitting(false);
  }

  const activeLimit = riddle?.timeLimit || DEFAULT_TIME;
  const tPct = Math.max(0, timeLeft / activeLimit);
  const tCol = timeLeft > 8 ? accent : Colors.orange;
  const runIndex = cleared + strikes + 1;
  const showTimer = panicMode && !result;

  if (done) return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        {cleared >= 10 ? <Icons.TrophyIcon size={80} color={Colors.gold} /> : cleared >= 5 ? <Icons.TargetIcon size={80} color={Colors.emerald} /> : <Icons.AlertTriangleIcon size={80} color={Colors.rose} />}
        <Text style={{ color: Colors.textPrimary, fontFamily: grotesk, fontSize: 42, fontWeight: '900', marginTop: 24, textAlign: 'center', letterSpacing: 2 }}>GAUNTLET CLOSED</Text>
        <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 15, marginTop: 12, textAlign: 'center', lineHeight: 24 }}>{endReason || 'Run complete.'}</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
          <View style={{ minWidth: 120, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 1.2 }}>NODES CLEARED</Text>
            <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontSize: 22, fontWeight: '900', marginTop: 6 }}>{cleared}</Text>
          </View>
          <View style={{ minWidth: 120, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 1.2 }}>BEST STREAK</Text>
            <Text style={{ color: Colors.emerald, fontFamily: mono, fontSize: 22, fontWeight: '900', marginTop: 6 }}>{bestStreak}</Text>
          </View>
          <View style={{ minWidth: 120, padding: 14, borderRadius: 12, backgroundColor: Colors.rose+'10', borderWidth: 1, borderColor: Colors.rose+'35', alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 1.2 }}>STRIKES TAKEN</Text>
            <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 22, fontWeight: '900', marginTop: 6 }}>{strikes}/{MAX_STRIKES}</Text>
          </View>
        </View>
        <TouchableOpacity style={[{ paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)', marginTop: 48 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
          <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>RETURN TO HUB</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[{ paddingVertical: 14, paddingHorizontal: 48, borderRadius: 12, borderWidth: 1, borderColor: accent+'40', backgroundColor: accent+'10', marginTop: 12 }, isWeb ? { cursor: 'pointer' } : {}]}
          onPress={() => {
            answerLockRef.current = false;
            clearInterval(timerRef.current);
            setDone(false);
            setCleared(0);
            setStrikes(0);
            setStreak(0);
            setBestStreak(0);
            setEndReason('');
            setResult(null);
            setSelected(null);
            setTyped('');
            typedRef.current = '';
            loadRiddle();
          }}
        >
          <Text style={{ color: accent, fontFamily: mono, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>RUN AGAIN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      {isWeb && <View style={{ position: 'absolute', top: '10%', left: '5%', width: 400, height: 400, borderRadius: 200, backgroundColor: accent, opacity: 0.04, pointerEvents: 'none' }} />}

      <View style={[{
        height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        zIndex: 10, backgroundColor: 'rgba(10,10,12,0.8)',
      }, isWeb ? { backdropFilter: 'blur(24px)' } : {}]}>
        <TouchableOpacity
          style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, isWeb ? { transition: 'all 0.2s ease' } : {}]}
          onPress={() => panicMode ? setShowAbortConfirm(true) : (exitToHome ? exitToHome() : go('home'))}
        >
          <Icons.ChevronLeftIcon size={12} color={accent} />
          <Text style={{ color: accent, fontFamily: mono, fontWeight: '800', fontSize: 12, letterSpacing: 2 }}>ABORT</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: accent+'15', borderWidth: 1, borderColor: accent+'30' }}>
          <Icons.SwordsIcon size={14} color={accent} />
          <Text style={{ color: accent, fontFamily: mono, fontWeight: '900', fontSize: 12, letterSpacing: 2 }}>GAUNTLET RUN {runIndex}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.gold+'10', borderWidth: 1, borderColor: Colors.gold+'30' }}>
          <Icons.TargetIcon size={14} color={Colors.gold} />
          <Text style={{ color: Colors.gold, fontFamily: mono, fontWeight: '800', fontSize: 14 }}>{cleared} CLR</Text>
        </View>
      </View>

      {panicMode && (
        <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#ff2a2a12', borderWidth: 1, borderColor: '#ff2a2a30', alignSelf: 'center' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff2a2a' }} />
            <Text style={{ color: '#ff2a2a', fontFamily: mono, fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>PANIC PROTOCOL ACTIVE</Text>
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingTop: 10 }}>
        <View style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)', alignItems: 'center' }}>
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 1.5 }}>STREAK</Text>
          <Text style={{ color: Colors.emerald, fontFamily: mono, fontSize: 20, fontWeight: '900', marginTop: 4 }}>{streak}</Text>
        </View>
        <View style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)', alignItems: 'center' }}>
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 1.5 }}>BEST</Text>
          <Text style={{ color: Colors.gold, fontFamily: mono, fontSize: 20, fontWeight: '900', marginTop: 4 }}>{bestStreak}</Text>
        </View>
        <View style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.rose+'25', backgroundColor: Colors.rose+'08', alignItems: 'center' }}>
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 1.5 }}>STRIKES</Text>
          <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 20, fontWeight: '900', marginTop: 4 }}>{strikes}/{MAX_STRIKES}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingTop: 10 }}>
        {Array.from({ length: MAX_STRIKES }, (_, i) => {
          const filled = i < strikes;
          return (
            <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: filled ? Colors.rose : 'rgba(255,255,255,0.06)' }} />
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 12, letterSpacing: 2 }}>LOADING NEXT NODE...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ maxWidth: 740, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 80 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {showTimer && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 }}>
              <View style={{ flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <View style={[{ height: '100%', borderRadius: 4 }, isWeb ? { width: `${tPct*100}%`, backgroundImage: `linear-gradient(to right, ${panicMode ? '#5f0000' : '#880000'}, ${accent})`, boxShadow: `0 0 20px ${accent}80`, transition: 'width 1s linear' } : { width: `${tPct*100}%`, backgroundColor: tCol }]} />
              </View>
              <Text style={[{ color: tCol, fontFamily: mono, fontWeight: '900', fontSize: 22, minWidth: 56, textAlign: 'right' }, isWeb && timeLeft <= 5 ? { textShadow: '0 0 12px rgba(255,42,42,0.8)' } : {}]}>{timeLeft}s</Text>
            </View>
          )}

          {err ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: Colors.rose+'12', borderWidth: 1, borderColor: Colors.rose+'30', marginBottom: 18 }}>
              <Icons.AlertTriangleIcon size={14} color={Colors.rose} />
              <Text style={{ flex: 1, color: Colors.rose, fontFamily: mono, fontSize: 12, fontWeight: '700' }}>{err}</Text>
            </View>
          ) : null}

          <View style={[{ backgroundColor: 'rgba(10,10,12,0.82)', borderRadius: 8, padding: 30, borderWidth: 1, borderColor: accent + '25', marginBottom: 18, position: 'relative', overflow: 'hidden' }, isWeb ? { backdropFilter: 'blur(24px)', boxShadow: `0 18px 60px rgba(0,0,0,0.5), 0 0 34px ${accent}0F` } : {}]}>
            <CornerBrackets />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icons.LockIcon size={12} color={accent} />
                <Text style={{ fontFamily: mono, fontSize: 11, color: accent, letterSpacing: 1.8, textTransform: 'uppercase' }}>{panicMode ? 'Panic Protocol // Active' : 'Gauntlet Channel // Live'}</Text>
              </View>
              <Text style={{ fontFamily: mono, fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.8 }}>NODE_{String(runIndex).padStart(2, '0')}</Text>
            </View>
            <RiddleContent
              riddle={riddle}
              accent={accent}
              questionStyle={{ fontFamily: grotesk, fontSize: 36, lineHeight: 46, fontWeight: '900' }}
            />
          </View>

          {Array.isArray(riddle?.options) && riddle.options.length > 1 ? riddle.options.map((opt, i) => {
            const right = result && opt === result.correctAnswer;
            const wrong = result && opt === selected && !result.isCorrect;
            const picked = !result && selected === opt;
            return (
              <TouchableOpacity key={i} style={[{
                flexDirection: 'row', alignItems: 'center', gap: 16,
                padding: 18, borderRadius: 8, marginBottom: 10,
                backgroundColor: right ? Colors.emerald+'12' : wrong ? Colors.rose+'12' : 'rgba(255,255,255,0.02)',
                borderWidth: 1.5, borderColor: right ? Colors.emerald+'55' : wrong ? Colors.rose+'55' : picked ? accent+'45' : 'rgba(255,255,255,0.07)'
              }, isWeb ? { transition: 'all 0.2s ease', cursor: 'pointer' } : {}]} onPress={() => !result && !selected && !submitting && submitAnswer(opt)} disabled={!!result || !!selected || submitting} activeOpacity={0.7}>
                <View style={{ width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: right ? Colors.emerald : wrong ? Colors.rose : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: right ? Colors.emerald : wrong ? Colors.rose : 'rgba(255,255,255,0.1)' }}>
                  <Text style={{ color: right || wrong ? '#000' : Colors.textMuted, fontFamily: mono, fontWeight: '900', fontSize: 16 }}>{['A','B','C','D'][i]}</Text>
                </View>
                <Text style={{ flex: 1, color: right ? Colors.emerald : wrong ? '#fca5a5' : Colors.textPrimary, fontFamily: grotesk, fontSize: 18, fontWeight: '700', lineHeight: 26, letterSpacing: 0.1 }}>{opt}</Text>
              </TouchableOpacity>
            );
          }) : (
            <View style={{ position: 'relative' }}>
              <Text style={{ position: 'absolute', left: 20, top: 22, zIndex: 10, fontFamily: mono, fontSize: 22, fontWeight: '900', color: accent }}>{'>_'}</Text>
              <TextInput
                style={[{
                  backgroundColor: '#050505', borderWidth: 2, borderColor: typed ? accent+'60' : 'rgba(255,255,255,0.08)',
                  borderRadius: 8, paddingTop: 20, paddingBottom: 20, paddingLeft: 56, paddingRight: 140,
                  color: Colors.textPrimary, fontFamily: mono, fontSize: 20, fontWeight: '900',
                  letterSpacing: 0.8, textTransform: 'uppercase', minHeight: 76,
                }, isWeb ? { outlineStyle: 'none', transition: 'all 0.3s ease', boxShadow: typed ? `0 0 15px ${accent}20` : 'none' } : {}]}
                placeholder="ENTER DECRYPTION KEY..."
                placeholderTextColor={Colors.textMuted}
                value={typed}
                onChangeText={(value) => { setTyped(value); typedRef.current = value; }}
                editable={!submitting}
              />
              <TouchableOpacity
                style={[{
                  position: 'absolute', right: 8, top: 8, bottom: 8,
                  backgroundColor: submitting ? '#666' : '#fff',
                  paddingHorizontal: 24, borderRadius: 12,
                  flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
                  opacity: (!typed.trim() || submitting) ? 0.5 : 1
                }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]}
                onPress={() => typed.trim() && !submitting && submitAnswer(typed.trim())}
                disabled={!typed.trim() || submitting}
              >
                  {submitting ? <ActivityIndicator color="#000" size="small" /> : <Text style={{ color: '#000', fontFamily: grotesk, fontWeight: '900', fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' }}>Execute</Text>}
              </TouchableOpacity>
            </View>
          )}

          {result && (
            <View style={[{ padding: 20, borderRadius: 16, marginTop: 16, borderWidth: 1.5 }, result.isCorrect ? { backgroundColor: Colors.emerald+'12', borderColor: Colors.emerald+'40' } : { backgroundColor: Colors.rose+'12', borderColor: Colors.rose+'40' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                {result.isCorrect ? <Icons.TargetIcon size={24} color={Colors.emerald} /> : <Icons.XIcon size={24} color={Colors.rose} />}
                <Text style={{ color: result.isCorrect ? Colors.emerald : Colors.rose, fontFamily: grotesk, fontWeight: '900', fontSize: 18, letterSpacing: 1, textAlign: 'center' }}>
                  {result.isCorrect ? `NODE CLEARED - STREAK ${streak}` : `${result.timedOut ? 'TIMEOUT' : 'STRIKE'} ${result.strikeNumber}/${MAX_STRIKES}`}
                </Text>
              </View>
              {!result.isCorrect ? (
                <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 12, textAlign: 'center', marginTop: 10 }}>Correct answer: {result.correctAnswer}</Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      )}
      {/* ── Panic Abort Confirmation ── */}
      {showAbortConfirm && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 200, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={[{ maxWidth: 360, width: '100%', padding: 28, borderRadius: 16, backgroundColor: 'rgba(10,10,12,0.98)', borderWidth: 1, borderColor: '#ff2a2a40', alignItems: 'center' }, isWeb ? { boxShadow: '0 0 60px rgba(255,42,42,0.15)' } : {}]}>
            <Icons.AlertTriangleIcon size={36} color="#ff2a2a" />
            <Text style={{ color: '#ff2a2a', fontFamily: 'Chakra Petch', fontSize: 20, fontWeight: '900', letterSpacing: 2, marginTop: 16, textAlign: 'center' }}>ABORT PANIC RUN?</Text>
            <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 12, marginTop: 12, textAlign: 'center', lineHeight: 18 }}>
              {'You have cleared '}{cleared}{' node'}{ cleared !== 1 ? 's' : ''}{' this run.\nAbandoning will count as a loss.\n\nAre you sure?'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' }}>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, isWeb ? { cursor: 'pointer' } : {}]}
                onPress={() => setShowAbortConfirm(false)}
              >
                <Text style={{ color: '#e2e8f0', fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 12, letterSpacing: 1.5 }}>STAY IN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(255,42,42,0.12)', borderWidth: 1, borderColor: '#ff2a2a50' }, isWeb ? { cursor: 'pointer' } : {}]}
                onPress={() => { setShowAbortConfirm(false); (exitToHome ? exitToHome() : go('home')); }}
              >
                <Text style={{ color: '#ff2a2a', fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 12, letterSpacing: 1.5 }}>ABORT RUN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
