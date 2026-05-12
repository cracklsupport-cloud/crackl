import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Animated, Easing, Dimensions, Platform } from 'react-native';
import Colors from '../theme/colors';
import { useResponsive } from '../theme/breakpoints';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';
import RiddleContent from '../components/RiddleContent';
import ChallengeShareButton from '../components/ChallengeShareButton';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CASE_FILES_KEY = 'crackl_case_files';

const { width: W, height: H } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : 'Share Tech Mono';
const grotesk = isWeb ? '"Space Grotesk", sans-serif' : 'Chakra Petch';
const serif = isWeb ? '"Cormorant Garamond", serif' : 'Cormorant Garamond';

/* ── HUD Corner Accents ── */
function HudCorner({ pos }) {
  const accent = 'rgba(0,255,208,0.25)';
  const size = 18;
  const styles = { position: 'absolute', width: size, height: size, zIndex: 20 };
  const border = { borderColor: accent };
  if (pos === 'tl') return <View style={{ ...styles, top: 0, left: 0, ...border, borderTopWidth: 2, borderLeftWidth: 2 }} />;
  if (pos === 'tr') return <View style={{ ...styles, top: 0, right: 0, ...border, borderTopWidth: 2, borderRightWidth: 2 }} />;
  if (pos === 'bl') return <View style={{ ...styles, bottom: 0, left: 0, ...border, borderBottomWidth: 2, borderLeftWidth: 2 }} />;
  return <View style={{ ...styles, bottom: 0, right: 0, ...border, borderBottomWidth: 2, borderRightWidth: 2 }} />;
}

function HudFrame({ children, style, accent }) {
  const a = accent || 'rgba(0,255,208,0.12)';
  return (
    <View style={[{
      borderWidth: 1, borderColor: a, borderRadius: 4, position: 'relative', overflow: 'hidden',
    }, isWeb ? { boxShadow: `inset 0 0 30px rgba(0,255,208,0.02), 0 0 1px ${a}` } : {}, style]}>
      <HudCorner pos="tl" />
      <HudCorner pos="tr" />
      <HudCorner pos="bl" />
      <HudCorner pos="br" />
      {/* Top edge glow line */}
      {isWeb && <View style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 1, backgroundColor: 'rgba(0,255,208,0.08)' }} />}
      {children}
    </View>
  );
}

/* ── Film Grain Overlay (panic mode atmosphere) ── */
function FilmGrainOverlay({ opacity = 0.12 }) {
  if (!isWeb) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 48,
      opacity, mixBlendMode: 'overlay',
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E")`,
    }} />
  );
}

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
      transform: [{ translateY: ty }]
    }} />
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
      color, fontFamily: mono, fontSize: 24, fontWeight: '900',
      opacity: op, transform: [{ translateY: ty }], zIndex: 50
    }}>{amount > 0 ? '+' : ''}{amount}</Animated.Text>
  );
}

/* ── SVG Circular Timer (web only) ── */
function CircularTimer({ timeLeft, timeMax, panicMode }) {
  const pct = timeLeft / timeMax;
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const col = pct > 0.5 ? '#00ffd0' : pct > 0.25 ? '#fbbf24' : '#ff2a2a';
  const glowCol = panicMode ? 'rgba(255,42,42,0.3)' : `${col}40`;

  if (!isWeb) {
    // Fallback: simple text for native
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ color: col, fontFamily: mono, fontSize: 36, fontWeight: '900' }}>{timeLeft}s</Text>
      </View>
    );
  }

  return (
    <div style={{ position: 'relative', width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="130" height="130" style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 12px ${glowCol})` }}>
        {/* Background ring */}
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
        {/* Progress ring */}
        <circle cx="65" cy="65" r={r} fill="none" stroke={panicMode ? '#ff2a2a' : col}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.5s ease' }}
        />
        {/* Inner faint ring */}
        <circle cx="65" cy="65" r="42" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: 28, fontWeight: '900', color: panicMode ? '#ff2a2a' : col, textShadow: timeLeft <= 5 ? `0 0 20px ${col}` : 'none' }}>{timeLeft}s</span>
        <span style={{ fontFamily: mono, fontSize: 10, color: '#4b5563', letterSpacing: 1.5, marginTop: 2 }}>REMAINING</span>
      </div>
    </div>
  );
}

export default function GameScreen({ user, go, exitToHome, update, mode, panicMode, wagerId }) {
  const { isMobile, isPhone } = useResponsive();
  const isRanked = mode === 'ranked';

  const [riddle, setRiddle]         = useState(null);
  const [selected, setSelected]     = useState(null);
  const [typed, setTyped]           = useState('');
  const [result, setResult]         = useState(null);
  const [timeLeft, setTimeLeft]     = useState(30);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hintUsed, setHintUsed]     = useState(false);
  const [hintCount, setHintCount]   = useState(0);
  const [paidHints, setPaidHints]   = useState([]);
  const [hintLoading, setHintLoading] = useState(false);
  const [showCoinFloat, setShowCoinFloat] = useState(false);
  const [exhausted, setExhausted]   = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [loadError, setLoadError]   = useState('');
  const [quipIndex, setQuipIndex]   = useState(0);
  const [showForfeit, setShowForfeit] = useState(false);

  const [effectiveMode, setEffectiveMode] = useState(mode);

  const timerRef    = useRef(null);
  const submitLock  = useRef(false);  // Prevents race condition on double-submit
  const riddleRef   = useRef(null);
  const typedRef    = useRef('');
  const timeLeftRef = useRef(30);
  const startedAtRef = useRef(null);
  const resAnim     = useRef(new Animated.Value(0.88)).current;
  const timerPulse  = useRef(new Animated.Value(1)).current;
  const shakeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadRiddle();
    return () => { clearInterval(timerRef.current); };
  }, []);

  async function loadRiddle() {
    submitLock.current = false;
    setLoading(true); setRiddle(null); riddleRef.current = null; setSelected(null); setResult(null);
    setHintUsed(false); setHintCount(0); setPaidHints([]); setHintLoading(false);
    setTyped(''); typedRef.current = '';
    setExhausted(false); setMaintenance(false); setLoadError(''); setShowForfeit(false);
    resAnim.setValue(0.88);
    clearInterval(timerRef.current);
    try {
      const isWager = mode === 'wager' && wagerId;
      const token = await AsyncStorage.getItem('crackl_token');
      const params = new URLSearchParams({ mode, panicMode: panicMode ? 'true' : 'false' });
	      const res = isWager
	        ? await fetch(`${BACKEND}/challenge/fetch`, {
	            method: 'POST',
	            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
	            body: JSON.stringify({ linkId: wagerId })
	          })
        : token
          ? await fetch(`${BACKEND}/api/riddles/next?${params.toString()}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          : await fetch(`${BACKEND}/riddle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id || 'guest', xp: user.xp || 0, mode, panicMode: !!panicMode })
            });

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
        riddleRef.current = r;
        startedAtRef.current = Date.now();
        const hasOptions = Array.isArray(r.options) && r.options.length >= 2;
        const answerMode = hasOptions && mode !== 'type' ? 'mcq' : 'type';
        setEffectiveMode(answerMode);
        const t = r.timeLimit || 30;
        setTimeLeft(t);
        timeLeftRef.current = t;
        // Only start timer in panic mode
        if (panicMode) startTick(t);
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
    const tickMs = 1000; // 1 real second per displayed second
    let t = n;
    timeLeftRef.current = t;
    
    // Capture the current riddle ID to prevent stale interval submissions
    const currentRiddleId = riddleRef.current?.id;
    
    timerRef.current = setInterval(() => {
      t--;
      setTimeLeft(t);
      timeLeftRef.current = t;
      if (t <= 10 && t > 0) {
        Animated.sequence([
          Animated.timing(timerPulse, { toValue: 1.2, duration: 120, useNativeDriver: true }),
          Animated.timing(timerPulse, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
      }
      if (t <= 0) { 
        clearInterval(timerRef.current); 
        // Only submit if this timer belongs to the currently active riddle
        if (!currentRiddleId || riddleRef.current?.id === currentRiddleId) {
          submit('__timeout__'); 
        }
      }
    }, tickMs);
  }

  async function usePaidHint() {
    if (!riddle || result || hintLoading) return;
    setHintLoading(true);
    try {
      const nextNum = hintCount + 1;
      const token = await AsyncStorage.getItem('crackl_token');
      const res = await fetch(`${BACKEND}/lifeline/hint`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId: user.id, riddleId: riddle.id, riddleQuestion: riddle.question, hintNumber: nextNum })
      });
      const data = await res.json();
      if (data.success) {
        setPaidHints(prev => [...prev, data.hint]);
        setHintCount(nextNum);
        update({ ...user, coins: data.newTotal });
      }
    } catch {}
    setHintLoading(false);
  }

  const correctQuips = [
    "Sharp instincts, operative. The case cracks wide open.",
    "Precision decryption. You're one of the best we've got.",
    "Clean extraction. Intel secured, operative.",
    "The code breaks. Another mystery falls to your mind.",
    "Textbook fieldwork. The agency would be proud.",
    "Case closed. Your clearance just went up a notch.",
  ];
  const wrongQuips = [
    "The trail went cold, operative. The answer slipped through.",
    "Dead end. The cipher held this time — regroup and advance.",
    "Your lead was a decoy. The real answer was hiding in plain sight.",
    "Intel compromised. The case remains open... for now.",
    "The suspect got away. Better luck on the next lead, agent.",
    "Classified info eluded you. Every good detective has off days.",
  ];

  async function submit(ans) {
    const activeRiddle = riddleRef.current || riddle;
    if (submitting || result || submitLock.current || !activeRiddle) return;
    submitLock.current = true;
    clearInterval(timerRef.current); setSubmitting(true);
    const final = ans === '__timeout__'
      ? (effectiveMode === 'type' ? (typedRef.current.trim() || '__timeout__') : '__timeout__')
      : ans;
    if (effectiveMode === 'mcq') setSelected(final);
    try {
      const elapsedForChallenge = startedAtRef.current
        ? Math.max(1, Math.ceil((Date.now() - startedAtRef.current) / 1000))
        : Math.max(1, (activeRiddle.timeLimit || 30) - timeLeftRef.current);
      const actTime = panicMode ? ((activeRiddle.timeLimit || 30) - timeLeftRef.current) : 0;
      const token = await AsyncStorage.getItem('crackl_token');
      const res = await fetch(`${BACKEND}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          userId: user.id || 'guest', riddleId: activeRiddle.id, userAnswer: final,
          timeTaken: actTime, mode: effectiveMode, gameMode: mode, panicMode: !!panicMode
        })
      });
      const data = await res.json();

      if (data.success && mode === 'wager' && wagerId) {
	        const cr = await fetch(`${BACKEND}/challenge/resolve`, {
	          method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
	          body: JSON.stringify({
	            challengeId: wagerId,
	            defenderId: user.id || null,
	            timeTaken: elapsedForChallenge,
	            userAnswer: final
	          })
	        });
        const cData = await cr.json();
        data.challengeResult = cData;
      }
      if (data.success) {
        setResult({ ...data, challengeTimeSeconds: elapsedForChallenge });
        setQuipIndex(Math.floor(Math.random() * 6));
        update({ ...user, coins: data.newTotal, streak: data.streakCount, xp: data.newXp, level: data.newLevel });
        setShowCoinFloat(true);
        setTimeout(() => setShowCoinFloat(false), 1600);

        // Save to Case Files
        const wasTimeout = ans === '__timeout__';
        const wasForfeit = ans === '__forfeit__';
        const caseEntry = {
          question: activeRiddle.question,
          riddle_type: activeRiddle.riddle_type || 'text',
          media_url: activeRiddle.media_url || null,
          layout_config: activeRiddle.layout_config || null,
          userAnswer: final === '__timeout__' || final === '__forfeit__' ? null : final,
          correctAnswer: data.correctAnswer,
          status: data.isCorrect ? 'cracked' : wasForfeit ? 'forfeited' : wasTimeout ? 'expired' : 'failed',
          intelEarned: data.coinsChange ?? 0,
          timeTaken: mode === 'wager' && wagerId ? elapsedForChallenge : actTime,
          difficulty: activeRiddle.difficulty || null,
          category: activeRiddle.category || null,
          mode: effectiveMode,
          gameMode: mode,
          panicMode: !!panicMode,
          timestamp: Date.now(),
          rating: data.ranked?.tier || null,
        };
        try {
          const raw = await AsyncStorage.getItem(CASE_FILES_KEY);
          const existing = raw ? JSON.parse(raw) : [];
          existing.unshift(caseEntry);
          await AsyncStorage.setItem(CASE_FILES_KEY, JSON.stringify(existing));
        } catch {}
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
  const tCol  = tPct > 0.5 ? '#00ffd0' : tPct > 0.25 ? '#fbbf24' : '#ff2a2a';
  const mCol  = panicMode ? '#ff2a2a' : isRanked ? '#818cf8' : effectiveMode === 'type' ? '#a78bfa' : '#00ffd0';
  const mLabel = panicMode ? 'PANIC MODE' : isRanked ? 'ECLIPSE LEVEL' : effectiveMode === 'type' ? 'BRAIN BLAST' : 'QUICK CRACK';
  const bgColor = panicMode ? '#080004' : '#050508';
  const hudAccent = panicMode ? 'rgba(255,42,42,0.15)' : 'rgba(0,255,208,0.12)';

  /* ── Non-riddle states ── */
  function renderSpecial() {
    if (maintenance) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#a78bfa', fontFamily: grotesk, fontSize: 20, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 12 }}>VAULT LOCKED</Text>
          <Text style={{ color: '#64748b', fontFamily: mono, fontSize: 12, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>{maintenanceMsg}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
            <Icons.ChevronLeftIcon size={12} color="#a78bfa" />
            <Text style={styles.backBtnText}>BACK TO HQ</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (exhausted) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#fbbf24', fontFamily: grotesk, fontSize: 20, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 12 }}>VAULT CLEARED</Text>
          <Text style={{ color: '#64748b', fontFamily: mono, fontSize: 12, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>All riddles decrypted. New intel incoming soon.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
            <Icons.ChevronLeftIcon size={12} color="#a78bfa" />
            <Text style={styles.backBtnText}>BACK TO HQ</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (loadError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#f43f5e', fontFamily: grotesk, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>SIGNAL LOST</Text>
          <Text style={{ color: '#64748b', fontFamily: mono, fontSize: 12, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>{loadError}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={[styles.backBtn, { borderColor: 'rgba(0,255,208,0.2)' }]} onPress={loadRiddle}>
              <Icons.ZapIcon size={12} color="#00ffd0" />
              <Text style={[styles.backBtnText, { color: '#00ffd0' }]}>RETRY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
              <Icons.ChevronLeftIcon size={12} color="#a78bfa" />
              <Text style={styles.backBtnText}>GO BACK</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return null;
  }

  /* ── Right Sidebar Panel ── */
  function renderSidebar() {
    return (
      <View style={{ width: isMobile ? '100%' : 220, gap: isPhone ? 8 : 12 }}>
        {/* Timer Panel (panic only) or Riddle Intel */}
        <HudFrame accent={hudAccent} style={{ padding: 20, alignItems: 'center' }}>
          {panicMode && !result ? (
            <>
              <Text style={{ color: '#64748b', fontFamily: mono, fontSize: 10, letterSpacing: 2.2, marginBottom: 12, fontWeight: '700' }}>TIME PROTOCOL</Text>
              <CircularTimer timeLeft={timeLeft} timeMax={tMax} panicMode={panicMode} />
            </>
          ) : (
            <>
              <Text style={{ color: '#64748b', fontFamily: mono, fontSize: 10, letterSpacing: 2.2, marginBottom: 14, fontWeight: '700' }}>RIDDLE INTEL</Text>
              <View style={{ width: '100%', gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 10, letterSpacing: 1 }}>CATEGORY</Text>
                  <Text style={{ color: '#94a3b8', fontFamily: mono, fontSize: 11, fontWeight: '700' }}>{riddle?.category || '—'}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 10, letterSpacing: 1 }}>MODE</Text>
                  <Text style={{ color: mCol, fontFamily: mono, fontSize: 11, fontWeight: '700' }}>{mLabel}</Text>
                </View>
                {panicMode && (
                  <>
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)' }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 10, letterSpacing: 1 }}>TIME LIMIT</Text>
                      <Text style={{ color: '#ff2a2a', fontFamily: mono, fontSize: 11, fontWeight: '700' }}>{tMax}s</Text>
                    </View>
                  </>
                )}
              </View>
            </>
          )}
        </HudFrame>

        {/* Hint Panel */}
        {!result && riddle?.hint && (
          <HudFrame accent={hudAccent} style={{ padding: 16 }}>
            <Text style={{ color: '#64748b', fontFamily: mono, fontSize: 10, letterSpacing: 2.2, marginBottom: 10, fontWeight: '700' }}>INFORMANT TIPS</Text>

            {!hintUsed ? (
              <TouchableOpacity
                style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 4, backgroundColor: 'rgba(251,191,36,0.06)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.15)' }, isWeb ? { cursor: 'pointer' } : {}]}
                onPress={() => { setHintUsed(true); setHintCount(1); }}
              >
                <Icons.TargetIcon size={10} color="#fbbf24" />
                <Text style={{ color: '#fbbf24', fontFamily: mono, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 }}>REQUEST TIP — FREE</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 8 }}>
                <View style={{ padding: 10, borderRadius: 4, backgroundColor: 'rgba(251,191,36,0.04)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.1)' }}>
                  <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 10, letterSpacing: 0.9, marginBottom: 4, fontWeight: '700' }}>TIP #1 — FREE</Text>
                  <Text style={{ color: '#fbbf24', fontFamily: mono, fontSize: 11, lineHeight: 17 }}>{riddle?.hint}</Text>
                </View>

                {paidHints.map((h, i) => (
                  <View key={i} style={{ padding: 10, borderRadius: 4, backgroundColor: 'rgba(0,255,208,0.03)', borderWidth: 1, borderColor: 'rgba(0,255,208,0.08)' }}>
                    <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 10, letterSpacing: 0.9, marginBottom: 4, fontWeight: '700' }}>TIP #{i + 2} — 12 INTEL</Text>
                    <Text style={{ color: '#00ffd0', fontFamily: mono, fontSize: 11, lineHeight: 17 }}>{h}</Text>
                  </View>
                ))}

                <TouchableOpacity
                  style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4, backgroundColor: 'rgba(0,255,208,0.04)', borderWidth: 1, borderColor: 'rgba(0,255,208,0.1)', opacity: hintLoading ? 0.5 : 1 }, isWeb ? { cursor: 'pointer' } : {}]}
                  onPress={usePaidHint} disabled={hintLoading}
                >
                  {hintLoading ? <ActivityIndicator size="small" color="#00ffd0" /> : <Icons.DatabaseIcon size={9} color="#00ffd0" />}
                  <Text style={{ color: '#00ffd0', fontFamily: mono, fontSize: 10, fontWeight: '700' }}>{hintLoading ? 'LOADING...' : 'MORE INTEL — 12'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </HudFrame>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {panicMode && <FilmGrainOverlay opacity={0.15} />}

      {/* Noise overlay */}
      {isWeb && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50, opacity: 0.12, mixBlendMode: 'overlay', backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      )}

      {/* Panic Mode Overlays */}
      {panicMode && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', pointerEvents: 'none', zIndex: 4 }}>
          <SmokeWisp delay={0} startX={20} />
          <SmokeWisp delay={1200} startX={W * 0.5} />
          <SmokeWisp delay={2400} startX={W - 80} />
        </View>
      )}

      {/* ── Top Bar ── */}
      <View style={[{
        height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, backgroundColor: 'rgba(5,5,8,0.98)',
        borderBottomWidth: 1, borderColor: hudAccent, zIndex: 10
      }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}>
        <TouchableOpacity
          style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }, isWeb ? { cursor: 'pointer' } : {}]}
          onPress={() => (exitToHome ? exitToHome() : go('home'))}
        >
          <Icons.ChevronLeftIcon size={10} color="#64748b" />
          <Text style={{ color: '#64748b', fontFamily: mono, fontWeight: '700', fontSize: 10, letterSpacing: 1 }}>ABORT</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: mCol }} />
          <Text style={{ color: mCol, fontFamily: grotesk, fontWeight: '900', fontSize: 15, letterSpacing: 2, textTransform: 'uppercase' }}>{mLabel}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.1)' }}>
          <Icons.IntelIcon size={11} color="#fbbf24" />
          <Text style={{ color: '#fbbf24', fontFamily: mono, fontWeight: '800', fontSize: 12 }}>{user?.coins ?? 0}</Text>
        </View>
      </View>

      {/* ── Body ── */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={mCol} />
          <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 10, letterSpacing: 2, textAlign: 'center', lineHeight: 20 }}>
            ACCESSING VAULT...{'\n'}CALIBRATING DIFFICULTY
          </Text>
        </View>
      ) : renderSpecial() ?? (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[{
              maxWidth: 1100, alignSelf: 'center', width: '100%', paddingHorizontal: isPhone ? 10 : (isMobile ? 16 : 24),
              paddingTop: isPhone ? 12 : 20, paddingBottom: 60,
            }, !isMobile ? { flexDirection: 'row', gap: 20 } : {}]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Left Panel (main content) ── */}
            <View style={{ flex: 1, minWidth: 0 }}>

              {/* Panic mode timer bar (mobile only) */}
              {panicMode && !result && isMobile && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                    <View style={[{ height: '100%', borderRadius: 2, backgroundColor: panicMode ? '#ff2a2a' : tCol }, isWeb ? { width: `${tPct * 100}%`, transition: 'width 0.5s linear' } : { width: `${tPct * 100}%` }]} />
                  </View>
                  <Text style={{ color: panicMode ? '#ff2a2a' : tCol, fontFamily: mono, fontWeight: '900', fontSize: 16, minWidth: 40, textAlign: 'right' }}>{timeLeft}s</Text>
                </View>
              )}

              {/* ── Question Card ── */}
              <HudFrame accent={hudAccent} style={{ padding: isPhone ? 14 : (isMobile ? 20 : 28), marginBottom: isPhone ? 10 : 16 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)', paddingBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: panicMode ? '#ff2a2a' : '#00ffd0' }} />
                    <Text style={{ fontFamily: mono, fontSize: 10, color: '#4b5563', letterSpacing: 1.6 }}>ENCRYPTED CHANNEL</Text>
                  </View>
                  {isMobile && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {riddle?.category ? (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                          <Text style={{ color: '#64748b', fontFamily: mono, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>{riddle.category}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>

                <RiddleContent
                  riddle={riddle}
                  accent={mCol}
                  questionStyle={{
                    fontSize: isPhone ? 17 : (isMobile ? 21 : 25),
                    lineHeight: isPhone ? 25 : (isMobile ? 31 : 37),
                  }}
                />
              </HudFrame>

              {/* ── MCQ Options ── */}
              {effectiveMode === 'mcq' && Array.isArray(riddle?.options) && riddle.options.map((opt, i) => {
                const right   = result && opt === result.correctAnswer;
                const wrong   = result && opt === selected && !result.isCorrect;
                const picked  = !result && selected === opt;
                const letter  = ['A', 'B', 'C', 'D'][i];
                return (
                  <TouchableOpacity
                    key={i}
                    style={[{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      padding: 14, borderRadius: 4, marginBottom: 6,
                      backgroundColor: right ? 'rgba(0,201,122,0.06)' : wrong ? 'rgba(244,63,94,0.06)' : picked ? `${mCol}08` : 'rgba(10,10,14,0.5)',
                      borderWidth: 1,
                      borderColor: right ? 'rgba(0,201,122,0.3)' : wrong ? 'rgba(244,63,94,0.3)' : picked ? `${mCol}25` : 'rgba(255,255,255,0.05)'
                    }, isWeb ? { cursor: result ? 'default' : 'pointer', transition: 'all 0.15s ease', backdropFilter: 'blur(8px)' } : {}]}
                    onPress={() => !result && !selected && !submitting && submit(opt)}
                    disabled={!!result || !!selected || submitting}
                    activeOpacity={0.7}
                  >
                    <View style={[{
                      width: 30, height: 30, borderRadius: 4, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: right ? '#00c97a' : wrong ? '#f43f5e' : 'rgba(0,0,0,0.4)',
                      borderWidth: 1,
                      borderColor: right ? '#00c97a' : wrong ? '#f43f5e' : 'rgba(255,255,255,0.06)'
                    }, isWeb ? { boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' } : {}]}>
                      <Text style={{ color: right || wrong ? '#000' : '#4b5563', fontFamily: mono, fontWeight: '900', fontSize: 12 }}>{letter}</Text>
                    </View>
                    <Text style={{
                      flex: 1, color: right ? '#00c97a' : wrong ? '#fca5a5' : '#e2e8f0',
                      fontFamily: grotesk, fontSize: 13, fontWeight: '600', lineHeight: 20
                    }}>{opt}</Text>
                    {right && <Icons.TargetIcon size={14} color="#00c97a" />}
                    {wrong && <Icons.XIcon size={14} color="#f43f5e" />}
                  </TouchableOpacity>
                );
              })}

              {/* ── Type Answer ── */}
              {effectiveMode === 'type' && !result && (
                <View style={{ gap: 10 }}>
                  {(mode === 'mcq' || isRanked) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: 'rgba(251,191,36,0.03)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.1)' }}>
                      <Icons.TargetIcon size={10} color="#fbbf24" />
                      <Text style={{ color: '#64748b', fontFamily: mono, fontSize: 10, letterSpacing: 0.4 }}>
                        {isRanked ? 'Ranked node switched to typed response' : 'No choices available — type your answer'}
                      </Text>
                    </View>
                  )}
                  <View style={[{ position: 'relative' }, isWeb ? { transition: 'all 0.3s ease' } : {}]}>
                    <Text style={{ position: 'absolute', left: 16, top: 18, zIndex: 10, fontFamily: mono, fontSize: 18, fontWeight: '900', color: panicMode ? 'rgba(255,42,42,0.5)' : 'rgba(0,255,208,0.4)' }}>{'>_'}</Text>
                    <TextInput
                      style={[{
                        backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1,
                        borderColor: typed ? (panicMode ? 'rgba(255,42,42,0.25)' : 'rgba(0,255,208,0.2)') : 'rgba(255,255,255,0.05)',
                        borderRadius: 4, paddingTop: 16, paddingBottom: 16, paddingLeft: 48, paddingRight: 120,
                        color: '#e2e8f0', fontFamily: mono, fontSize: 15, fontWeight: '900',
                        letterSpacing: 2, textTransform: 'uppercase', minHeight: 56,
                      }, isWeb ? { outlineStyle: 'none', transition: 'border-color 0.3s ease' } : {}]}
                      placeholder="ENTER DECRYPTION KEY..."
                      placeholderTextColor="#333"
                      value={typed}
                      onChangeText={(value) => { setTyped(value); typedRef.current = value; }}
                      editable={!submitting}
                    />
                    <TouchableOpacity
                      style={[{
                        position: 'absolute', right: 4, top: 4, bottom: 4,
                        backgroundColor: submitting ? '#222' : '#e2e8f0',
                        paddingHorizontal: 18, borderRadius: 3,
                        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
                        opacity: (!typed.trim() || submitting) ? 0.3 : 1
                      }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]}
                      onPress={() => typed.trim() && !submitting && submit(typed.trim())}
                      disabled={!typed.trim() || submitting}
                    >
                      {submitting
                        ? <ActivityIndicator color="#000" size="small" />
                        : <Text style={{ color: '#050508', fontFamily: mono, fontWeight: '900', fontSize: 11, letterSpacing: 1.6 }}>EXECUTE</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── Forfeit Button ── */}
              {!result && !submitting && riddle && (
                <TouchableOpacity
                  style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 8, borderRadius: 4, backgroundColor: 'rgba(244,63,94,0.03)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.1)' }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]}
                  onPress={() => setShowForfeit(true)}
                  activeOpacity={0.7}
                >
                  <Icons.XIcon size={10} color="#f43f5e80" />
                  <Text style={{ color: '#f43f5e80', fontFamily: mono, fontWeight: '700', fontSize: 10, letterSpacing: 1.6 }}>FORFEIT CASE</Text>
                </TouchableOpacity>
              )}

              {/* ── Result Card ── */}
              {result && (
                <Animated.View style={{
                  marginTop: 12, overflow: 'hidden',
                  transform: [{ scale: resAnim }, { translateX: result.isCorrect ? 0 : shakeAnim }]
                }}>
                  <HudFrame accent={result.isCorrect ? 'rgba(0,201,122,0.2)' : 'rgba(244,63,94,0.2)'} style={{ padding: isPhone ? 14 : (isMobile ? 20 : 28), alignItems: 'center' }}>
                    {showCoinFloat && <FloatingCoin amount={result.coinsChange ?? 0} color={(result.coinsChange ?? 0) > 0 ? '#fbbf24' : '#f43f5e'} />}

                    {/* Status */}
                    <View style={{ width: '100%', alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingBottom: 20, marginBottom: 20 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: result.isCorrect ? '#00c97a' : '#f43f5e' }} />
                        <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 10, letterSpacing: 2.2, fontWeight: '700' }}>
                          {result.isCorrect ? 'CASE STATUS: RESOLVED' : 'CASE STATUS: COLD'}
                        </Text>
                      </View>

                      <View style={[{
                        width: 48, height: 48, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: result.isCorrect ? 'rgba(0,201,122,0.08)' : 'rgba(244,63,94,0.08)',
                        borderWidth: 1, borderColor: result.isCorrect ? 'rgba(0,201,122,0.2)' : 'rgba(244,63,94,0.2)',
                      }, isWeb ? { boxShadow: `0 0 20px ${result.isCorrect ? 'rgba(0,201,122,0.1)' : 'rgba(244,63,94,0.1)'}` } : {}]}>
                        {result.isCorrect
                          ? <Icons.TargetIcon size={22} color="#00c97a" />
                          : <Icons.XIcon size={22} color="#f43f5e" />
                        }
                      </View>

                      <Text style={{ color: result.isCorrect ? '#00c97a' : '#f43f5e', fontFamily: grotesk, fontSize: 22, fontWeight: '900', marginTop: 12, letterSpacing: 3 }}>
                        {result.isCorrect ? 'CASE CRACKED' : 'CASE COLD'}
                      </Text>

                      <Text style={{ color: '#64748b', fontFamily: serif, fontSize: 14, fontStyle: 'italic', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                        {result.isCorrect ? correctQuips[quipIndex % correctQuips.length] : wrongQuips[quipIndex % wrongQuips.length]}
                      </Text>
                    </View>

                    {/* Wrong answer */}
                    {!result.isCorrect && (selected || typed) && (
                      <View style={{ padding: 12, borderRadius: 4, width: '100%', alignItems: 'center', marginBottom: 10, backgroundColor: 'rgba(244,63,94,0.04)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.1)' }}>
                        <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 10, letterSpacing: 1.6, fontWeight: '800', marginBottom: 4 }}>YOUR LEAD</Text>
                        <Text style={{ color: '#f43f5e', fontFamily: grotesk, fontSize: 16, fontWeight: '800', textDecorationLine: 'line-through' }}>{selected || typed}</Text>
                      </View>
                    )}

                    {/* Correct answer */}
                    <View style={[{
                      padding: 16, borderRadius: 4, width: '100%', alignItems: 'center',
                      backgroundColor: result.isCorrect ? 'rgba(0,201,122,0.04)' : 'rgba(0,255,208,0.03)',
                      borderWidth: 1, borderColor: result.isCorrect ? 'rgba(0,201,122,0.12)' : 'rgba(0,255,208,0.08)'
                    }, isWeb ? { boxShadow: result.isCorrect ? '0 0 15px rgba(0,201,122,0.04)' : 'none' } : {}]}>
                      <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 10, marginBottom: 6, letterSpacing: 1.6, fontWeight: '800' }}>
                        {result.isCorrect ? 'DECRYPTION KEY CONFIRMED' : 'THE REAL DECRYPTION KEY'}
                      </Text>
                      <Text style={{ color: result.isCorrect ? '#00c97a' : '#00ffd0', fontFamily: grotesk, fontSize: 20, fontWeight: '900', textAlign: 'center', letterSpacing: 1 }}>
                        {result.correctAnswer}
                      </Text>
                    </View>

                    {/* Explanation */}
                    {(result.explanation || riddle?.explanation) && (
                      <View style={{ marginTop: 10, padding: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', width: '100%' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Icons.LockIcon size={9} color="#a78bfa" />
                          <Text style={{ color: '#a78bfa', fontFamily: mono, fontWeight: '800', fontSize: 10, letterSpacing: 1.6 }}>CASE BRIEFING</Text>
                        </View>
                        <Text style={{ color: '#64748b', fontFamily: serif, fontSize: 13, lineHeight: 20, fontStyle: 'italic' }}>{result.explanation || riddle.explanation}</Text>
                      </View>
                    )}

                    {/* Intel */}
                    <View style={{ marginTop: 14, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: (result.coinsChange ?? 0) > 0 ? 'rgba(251,191,36,0.15)' : 'rgba(244,63,94,0.15)' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Icons.IntelIcon size={18} color={(result.coinsChange ?? 0) > 0 ? '#fbbf24' : '#f43f5e'} />
                        <Text style={{ color: (result.coinsChange ?? 0) > 0 ? '#fbbf24' : '#f43f5e', fontFamily: mono, fontSize: 24, fontWeight: '900' }}>
                          {(result.coinsChange ?? 0) > 0 ? '+' : ''}{result.coinsChange ?? 0}
                        </Text>
                        <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>INTEL</Text>
                      </View>
                    </View>

                    {result.ranked && (
                      <View style={{ marginTop: 12, width: '100%', padding: 14, borderRadius: 4, backgroundColor: 'rgba(129,140,248,0.05)', borderWidth: 1, borderColor: 'rgba(129,140,248,0.18)' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <View>
                            <Text style={{ color: '#818cf8', fontFamily: mono, fontSize: 10, letterSpacing: 1.6, fontWeight: '800' }}>ECLIPSE LEVEL</Text>
                            <Text style={{ color: '#e2e8f0', fontFamily: grotesk, fontSize: 18, fontWeight: '900', marginTop: 4 }}>{result.ranked.tier}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: '#64748b', fontFamily: mono, fontSize: 10, letterSpacing: 1.6 }}>RATING</Text>
                            <Text style={{ color: '#818cf8', fontFamily: mono, fontSize: 24, fontWeight: '900', marginTop: 4 }}>{result.ranked.rating}</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                            <Text style={{ color: (result.ranked.delta ?? 0) >= 0 ? '#22c55e' : '#f43f5e', fontFamily: mono, fontSize: 10, fontWeight: '800' }}>
                              {(result.ranked.delta ?? 0) >= 0 ? '+' : ''}{result.ranked.delta} RATING
                            </Text>
                          </View>
                          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                            <Text style={{ color: '#cbd5f5', fontFamily: mono, fontSize: 10, fontWeight: '800' }}>
                              {result.ranked.wins}-{result.ranked.losses} RECORD
                            </Text>
                          </View>
                          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                            <Text style={{ color: '#cbd5f5', fontFamily: mono, fontSize: 10, fontWeight: '800' }}>
                              BEST {result.ranked.bestRating}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Badges */}
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                      {(result.xpGained ?? 0) > 0 && (
                        <View style={{ backgroundColor: 'rgba(124,58,237,0.06)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)' }}>
                          <Text style={{ color: '#a78bfa', fontFamily: mono, fontSize: 10, fontWeight: '800' }}>+{result.xpGained} CS</Text>
                        </View>
                      )}
                      {!isRanked && (result.streakCount ?? 0) > 1 && (
                        <View style={{ backgroundColor: 'rgba(251,146,60,0.06)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(251,146,60,0.15)' }}>
                          <Text style={{ color: '#fb923c', fontFamily: mono, fontSize: 10, fontWeight: '800' }}>{result.streakCount} STREAK</Text>
                        </View>
                      )}
                      {!isRanked && result.streakBonus && (
                        <View style={{ backgroundColor: 'rgba(251,191,36,0.06)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(251,191,36,0.15)' }}>
                          <Text style={{ color: '#fbbf24', fontFamily: mono, fontSize: 10, fontWeight: '800' }}>+100 BONUS</Text>
                        </View>
                      )}
                    </View>

                    {/* Level up */}
                    {result.leveledUp && (
                      <View style={{ marginTop: 14, padding: 16, borderRadius: 4, backgroundColor: 'rgba(124,58,237,0.04)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)', width: '100%', alignItems: 'center' }}>
                        <Text style={{ color: '#a78bfa', fontFamily: grotesk, fontWeight: '900', fontSize: 14, letterSpacing: 2 }}>CLEARANCE UPGRADED</Text>
                        <Text style={{ color: '#4b5563', fontFamily: mono, fontWeight: '700', fontSize: 11, marginTop: 4 }}>LEVEL {result.newLevel}</Text>
                      </View>
                    )}

                    {/* Fun fact */}
                    {(result.fun_fact || result.funFact || riddle?.fun_fact) && (
                      <View style={{ marginTop: 12, padding: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', width: '100%' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Icons.LinkIcon size={9} color="#00ffd0" />
                          <Text style={{ color: '#00ffd0', fontFamily: mono, fontWeight: '800', fontSize: 10, letterSpacing: 1.6 }}>FIELD INTEL</Text>
                        </View>
                        <Text style={{ color: '#64748b', fontFamily: serif, fontSize: 13, lineHeight: 20, fontStyle: 'italic' }}>{result.fun_fact || result.funFact || riddle.fun_fact}</Text>
                      </View>
                    )}

                    {/* Action buttons */}
                    {mode !== 'wager' ? (
                      <View style={{ width: '100%', marginTop: 18, gap: 8 }}>
                        {result.isCorrect && (
                          <ChallengeShareButton
                            user={user}
                            riddle={riddleRef.current || riddle}
                            targetTime={result.challengeTimeSeconds}
                            mode={mode}
                            accent="#00ffd0"
                          />
                        )}
                        <TouchableOpacity
                          style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }, isWeb ? { cursor: 'pointer' } : {}]}
                          onPress={loadRiddle}
                        >
                          <Text style={{ color: '#e2e8f0', fontFamily: mono, fontWeight: '900', fontSize: 11, letterSpacing: 2 }}>{isRanked ? 'QUEUE NEXT MATCH' : 'NEXT CASE FILE'}</Text>
                          <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 12 }}>→</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => (exitToHome ? exitToHome() : go('home'))} style={[{ alignItems: 'center', padding: 8 }, isWeb ? { cursor: 'pointer' } : {}]}>
                          <Text style={{ color: '#333', fontFamily: mono, fontSize: 10, letterSpacing: 1 }}>RETURN TO HQ</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ width: '100%', marginTop: 18 }}>
                        {result.challengeResult && (
                          <Text style={{ color: result.challengeResult.success && result.challengeResult.defenderWon ? '#00c97a' : '#f43f5e', fontFamily: mono, textAlign: 'center', marginBottom: 14, fontSize: 11, fontWeight: '700' }}>
                            {result.challengeResult.message || result.challengeResult.error || 'Challenge could not be resolved.'}
                          </Text>
                        )}
                        {(!user || !user.id || user.id === 'guest') ? (
                          <TouchableOpacity onPress={() => go('auth')} style={[{ alignItems: 'center', padding: 14, backgroundColor: 'rgba(251,191,36,0.06)', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' }, isWeb ? { cursor: 'pointer' } : {}]}>
                            <Text style={{ color: '#fbbf24', fontFamily: mono, fontWeight: '900', fontSize: 11, letterSpacing: 2 }}>SIGN UP TO LOCK IN</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity onPress={() => (exitToHome ? exitToHome() : go('home'))} style={[{ alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }, isWeb ? { cursor: 'pointer' } : {}]}>
                            <Text style={{ color: '#e2e8f0', fontFamily: mono, fontWeight: '900', fontSize: 11, letterSpacing: 2 }}>EXIT CHALLENGE</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </HudFrame>
                </Animated.View>
              )}

              {/* Mobile: sidebar below main content */}
              {isMobile && renderSidebar()}
            </View>

            {/* ── Right Sidebar (desktop only) ── */}
            {!isMobile && renderSidebar()}
          </ScrollView>

          {/* ── Bottom Status Bar ── */}
          <View style={[{
            height: isPhone ? 26 : 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: isPhone ? 8 : 16, backgroundColor: 'rgba(5,5,8,0.98)',
            borderTopWidth: 1, borderColor: hudAccent
          }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}>
            <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: isPhone ? 9 : 11, letterSpacing: 1 }}>
              ID: RDL_{String(riddle?.id || '???').slice(-3).padStart(3, '0')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPhone ? 8 : 16 }}>
              {!isPhone && <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 11, letterSpacing: 1 }}>LVL {user?.level || '—'}</Text>}
              <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: isPhone ? 9 : 11, letterSpacing: 1 }}>STREAK: {user?.streak ?? 0}</Text>
              {panicMode && <Text style={{ color: '#ff2a2a70', fontFamily: mono, fontSize: isPhone ? 9 : 11, letterSpacing: 1 }}>PANIC</Text>}
            </View>
            {!isPhone && <Text style={{ color: '#4b5563', fontFamily: mono, fontSize: 11, letterSpacing: 1 }}>CRACKL v1.0</Text>}
          </View>
        </View>
      )}

      {/* ── Forfeit Confirmation Overlay ── */}
      {showForfeit && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={[{ maxWidth: 360, width: '100%', padding: 28, borderRadius: 8, backgroundColor: 'rgba(10,10,14,0.95)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.25)', alignItems: 'center' }, isWeb ? { boxShadow: '0 0 40px rgba(244,63,94,0.1)' } : {}]}>
            <Icons.AlertTriangleIcon size={32} color="#f43f5e" />
            <Text style={{ color: '#f43f5e', fontFamily: grotesk, fontSize: 18, fontWeight: '900', letterSpacing: 2, marginTop: 16, textAlign: 'center' }}>FORFEIT CASE?</Text>
            <Text style={{ color: '#64748b', fontFamily: mono, fontSize: 11, marginTop: 12, textAlign: 'center', lineHeight: 18 }}>This will count as an incorrect answer.{'\n'}Your streak will reset.</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' }}>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 12, borderRadius: 4, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }, isWeb ? { cursor: 'pointer' } : {}]}
                onPress={() => setShowForfeit(false)}
              >
                <Text style={{ color: '#e2e8f0', fontFamily: mono, fontWeight: '800', fontSize: 10, letterSpacing: 1.5 }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 12, borderRadius: 4, alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.1)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.3)' }, isWeb ? { cursor: 'pointer' } : {}]}
                onPress={() => { setShowForfeit(false); submit('__forfeit__'); }}
              >
                <Text style={{ color: '#f43f5e', fontFamily: mono, fontWeight: '900', fontSize: 10, letterSpacing: 1.5 }}>FORFEIT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = {
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 4,
    backgroundColor: 'rgba(124,58,237,0.06)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)'
  },
  backBtnText: {
    color: '#a78bfa', fontFamily: isWeb ? '"JetBrains Mono", monospace' : 'Share Tech Mono', fontWeight: '700',
    fontSize: 10, letterSpacing: 1.5
  }
};
