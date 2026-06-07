import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, TextInput } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';
import { getAuthToken } from '../utils/authSession';
import RiddleContent from '../components/RiddleContent';
import ChallengeShareButton from '../components/ChallengeShareButton';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
const grotesk = isWeb ? '"Space Grotesk", sans-serif' : 'Chakra Petch';

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

export default function DailyDropScreen({ user, go, exitToHome, update, panicMode }) {
  const [riddle, setRiddle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [loading, setLoading] = useState(true);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const timerRef = useRef(null);
  const riddleRef = useRef(null);
  const typedRef = useRef('');
  const timeLeftRef = useRef(60);
  const startedAtRef = useRef(null);
  const submitLockRef = useRef(false);

  useEffect(() => { load(); return () => clearInterval(timerRef.current); }, []);

  async function load() {
    clearInterval(timerRef.current);
    setLoading(true);
    setLoadError('');
    setAlreadyPlayed(false);
    setRiddle(null);
    setResult(null);
    setSelected(null);
    setTyped('');
    riddleRef.current = null;
    typedRef.current = '';
    submitLockRef.current = false;
    try {
      const token = await getAuthToken();
      const params = new URLSearchParams({ mode: 'daily', panicMode: panicMode ? 'true' : 'false' });
      const res = token
        ? await fetch(`${BACKEND}/api/riddles/next?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        : await fetch(`${BACKEND}/daily-riddle`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ userId:user.id, city:user.city, area:user.area, xp:user.xp||0, panicMode: !!panicMode })
          });
      const data = await res.json();
      if (data.alreadyPlayed) setAlreadyPlayed(true);
      else if (data.success) {
        setRiddle(data.riddle);
        riddleRef.current = data.riddle;
        startedAtRef.current = Date.now();
        let t = data.riddle?.timeLimit || 60;
        setTimeLeft(t);
        timeLeftRef.current = t;
        if (panicMode) {
          timerRef.current=setInterval(()=>{t--;setTimeLeft(t);timeLeftRef.current=t;if(t<=0){clearInterval(timerRef.current);submit('__timeout__');}},1000);
        }
      } else {
        setLoadError(data.error || 'Could not load today\'s case.');
      }
    } catch { setLoadError('Network error — could not load today\'s riddle.'); }
    setLoading(false);
  }

  async function submit(ans) {
    const activeRiddle = riddleRef.current || riddle;
    if (submitLockRef.current || !activeRiddle) return; submitLockRef.current = true; clearInterval(timerRef.current); setSubmitting(true);
    const mode = (!activeRiddle?.options || activeRiddle.options.length < 2) ? 'type' : 'mcq';
    const final = ans === '__timeout__' && mode === 'type' ? (typedRef.current.trim() || '__timeout__') : ans;
    setSelected(final);
    try {
      const limit = activeRiddle?.timeLimit || 60;
      const elapsedForChallenge = startedAtRef.current
        ? Math.max(1, Math.ceil((Date.now() - startedAtRef.current) / 1000))
        : Math.max(1, limit - timeLeftRef.current);
      const timeTaken = panicMode ? (limit - timeLeftRef.current) : 0;
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND}/answer`, { method:'POST', headers:{'Content-Type':'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {})}, body:JSON.stringify({ userId:user.id, riddleId:activeRiddle.id, userAnswer:final, timeTaken, mode, gameMode:'daily', panicMode: !!panicMode }) });
      const data = await res.json();
      if (data.success) { setResult({ ...data, challengeTimeSeconds: elapsedForChallenge }); update({...user, coins:data.newTotal, xp:data.newXp, level:data.newLevel, streak:data.streakCount}); }
      else { submitLockRef.current = false; setLoadError(data.error || 'Failed to submit answer.'); }
    } catch { submitLockRef.current = false; setLoadError('Network error — your answer may not have been saved.'); }
    setSubmitting(false);
  }

  const tPct = timeLeft / (riddle?.timeLimit || 60);
  const tCol = tPct > 0.5 ? Colors.gold : Colors.rose;
  const accent = Colors.gold;

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />

      {/* Ambient glow */}
      {isWeb && <View style={{ position: 'absolute', top: '10%', right: '5%', width: 400, height: 400, borderRadius: 200, backgroundColor: accent, opacity: 0.04, pointerEvents: 'none' }} />}

      {/* Top Bar */}
      <View style={[{
        height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        zIndex: 10, backgroundColor: 'rgba(10,10,12,0.8)',
      }, isWeb ? { backdropFilter: 'blur(24px)' } : {}]}>
        <TouchableOpacity style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, isWeb ? { transition: 'all 0.2s ease' } : {}]} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
          <Icons.ChevronLeftIcon size={12} color="#00ffd0" />
          <Text style={{ color: '#00ffd0', fontFamily: mono, fontWeight: '800', fontSize: 13, letterSpacing: 1.8 }}>ABORT</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icons.SunIcon size={16} color={accent} />
          <Text style={{ color: accent, fontFamily: grotesk, fontWeight: '900', fontSize: 16, letterSpacing: 1.6, textTransform: 'uppercase' }}>
            {panicMode ? 'CRITICAL BREACH' : 'THE COLD CASE'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Icons.CpuIcon size={14} color={Colors.gold} />
          <Text style={{ color: Colors.gold, fontFamily: mono, fontWeight: '800', fontSize: 14 }}>{panicMode ? 'TIMED BREACH' : 'ISOLATED RUN'}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 13, letterSpacing: 1.8, textTransform: 'uppercase' }}>
            {panicMode ? 'ARMING CRITICAL BREACH...' : 'DECRYPTING THE COLD CASE...'}
          </Text>
        </View>
      ) : loadError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Icons.XIcon size={48} color={Colors.rose} />
          <Text style={{ color: Colors.rose, fontFamily: grotesk, fontSize: 30, fontWeight: '900', marginTop: 16, textAlign: 'center', letterSpacing: 0.6 }}>SIGNAL LOST</Text>
          <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 15, marginTop: 12, textAlign: 'center', lineHeight: 24, maxWidth: 560 }}>{loadError}</Text>
          <TouchableOpacity style={[{ paddingVertical: 16, paddingHorizontal: 48, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)', marginTop: 32 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
            <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontWeight: '900', fontSize: 13, letterSpacing: 2 }}>RETURN TO HUB</Text>
          </TouchableOpacity>
        </View>
      ) : alreadyPlayed ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Icons.TargetIcon size={80} color={Colors.emerald} />
          <Text style={{ color: Colors.textPrimary, fontFamily: grotesk, fontSize: 36, fontWeight: '900', marginTop: 24, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' }}>SYSTEM CLEARED</Text>
          <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 22 }}>You've already processed today's sequence. Return in 24h for the next standalone Cold Case.</Text>
          <TouchableOpacity style={[{ paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)', marginTop: 40 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
            <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontWeight: '900', fontSize: 13, letterSpacing: 2 }}>RETURN TO HUB</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ maxWidth: 740, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
          {/* Timer */}
          {!result && panicMode && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 }}>
              <View style={{ flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <View style={[{ height: '100%', borderRadius: 4 }, isWeb ? { width: `${tPct*100}%`, backgroundImage: tPct > 0.5 ? 'linear-gradient(to right, #78350f, #fbbf24)' : 'linear-gradient(to right, #880000, #ff2a2a)', boxShadow: `0 0 20px ${tCol}80`, transition: 'width 1s linear' } : { width: `${tPct*100}%`, backgroundColor: tCol }]} />
              </View>
              <Text style={[{ color: tCol, fontFamily: mono, fontWeight: '900', fontSize: 22, minWidth: 72, textAlign: 'right' }, isWeb && timeLeft <= 10 ? { textShadow: '0 0 12px rgba(255,42,42,0.8)' } : {}]}>{timeLeft}s</Text>
            </View>
          )}

          {/* Question Card */}
          <View style={[{ backgroundColor: 'rgba(10,10,12,0.82)', borderRadius: 8, padding: 30, borderWidth: 1, borderColor: accent + '35', marginBottom: 18, position: 'relative', overflow: 'hidden' }, isWeb ? { backdropFilter: 'blur(24px)', boxShadow: `0 18px 60px rgba(0,0,0,0.5), 0 0 34px ${accent}14` } : {}]}>
            <CornerBrackets />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icons.SunIcon size={12} color={accent} />
                <Text style={{ fontFamily: mono, fontSize: 11, color: accent, letterSpacing: 1.8, textTransform: 'uppercase' }}>
                  {panicMode ? 'Breach Directive' : "Today's Directive"}
                </Text>
              </View>
              <Text style={{ fontFamily: mono, fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.8 }}>
                {panicMode ? 'CRITICAL_BREACH' : 'COLD_CASE'}
              </Text>
            </View>
            <RiddleContent
              riddle={riddle}
              accent={accent}
              questionStyle={{ fontFamily: grotesk, fontSize: 36, lineHeight: 46, fontWeight: '900' }}
            />
          </View>

          {/* Options */}
          {riddle?.options && riddle.options.length > 1 ? riddle.options.map((opt, i) => {
            const right = result && opt === result.correctAnswer;
            const wrong = result && opt === selected && !result.isCorrect;
            const picked = !result && selected === opt;
            return (
              <TouchableOpacity key={i} style={[{
                flexDirection: 'row', alignItems: 'center', gap: 16,
                padding: 18, borderRadius: 8, marginBottom: 10,
                backgroundColor: right ? Colors.emerald + '12' : wrong ? Colors.rose + '12' : 'rgba(255,255,255,0.02)',
                borderWidth: 1.5,
                borderColor: right ? Colors.emerald + '55' : wrong ? Colors.rose + '55' : picked ? accent + '45' : 'rgba(255,255,255,0.07)'
              }, isWeb ? { transition: 'all 0.2s ease', cursor: 'pointer' } : {}]} onPress={() => !result && !selected && submit(opt)} disabled={!!result||!!selected} activeOpacity={0.7}>
                <View style={{
                  width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: right ? Colors.emerald : wrong ? Colors.rose : 'rgba(255,255,255,0.05)',
                  borderWidth: 1, borderColor: right ? Colors.emerald : wrong ? Colors.rose : 'rgba(255,255,255,0.1)'
                }}><Text style={{ color: right||wrong ? '#000' : Colors.textMuted, fontFamily: mono, fontWeight: '900', fontSize: 16 }}>{['A','B','C','D'][i]}</Text></View>
                <Text style={{ flex: 1, color: right ? Colors.emerald : wrong ? '#fca5a5' : Colors.textPrimary, fontFamily: grotesk, fontSize: 18, fontWeight: '700', lineHeight: 26, letterSpacing: 0.1 }}>{opt}</Text>
                {right && <Icons.TargetIcon size={18} color={Colors.emerald} />}
                {wrong && <Icons.XIcon size={18} color={Colors.rose} />}
              </TouchableOpacity>
            );
          }) : (
            !result && (
              <View style={[{ position: 'relative', marginTop: 8 }, isWeb ? { boxShadow: typed ? '0 0 30px rgba(251,191,36,0.08)' : 'none', transition: 'box-shadow 0.3s ease' } : {}]}>
                <Text style={{ position: 'absolute', left: 20, top: 22, zIndex: 10, fontFamily: mono, fontSize: 22, fontWeight: '900', color: accent }}>{'>_'}</Text>
                <TextInput
                  style={[{
                    backgroundColor: '#050505', borderWidth: 2, borderColor: typed ? accent + '60' : 'rgba(255,255,255,0.08)',
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
                  onPress={() => typed.trim() && !submitting && submit(typed.trim())}
                  disabled={!typed.trim() || submitting}
                >
                  {submitting ? <ActivityIndicator color="#000" size="small" /> : <Text style={{ color: '#000', fontFamily: grotesk, fontWeight: '900', fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' }}>Execute</Text>}
                </TouchableOpacity>
              </View>
            )
          )}

          {/* Result */}
          {result && (
            <View style={[{ backgroundColor: 'rgba(10,10,12,0.8)', borderRadius: 24, padding: 32, borderWidth: 1.5, borderColor: result.isCorrect ? accent + '40' : Colors.rose + '40', alignItems: 'center', marginTop: 16, position: 'relative', overflow: 'hidden' }, isWeb ? { backdropFilter: 'blur(24px)' } : {}]}>
              <CornerBrackets />
              <View style={{ position: 'absolute', top: 0, left: '20%', width: 220, height: 220, borderRadius: 110, backgroundColor: result.isCorrect ? accent : Colors.rose, opacity: 0.06 }} />
              {result.isCorrect ? <Icons.SunIcon size={52} color={accent} /> : <Icons.LockIcon size={52} color={Colors.rose} />}
              <Text style={{ color: result.isCorrect ? accent : Colors.rose, fontFamily: grotesk, fontSize: 32, fontWeight: '900', marginTop: 16, letterSpacing: 2, textAlign: 'center' }}>{result.isCorrect ? 'CASE CLOSED' : 'SYSTEM LOCKED.\nDECRYPTION FAILED.'}</Text>
              <View style={{ marginTop: 22, padding: 18, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', width: '100%', alignItems: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, marginBottom: 8, letterSpacing: 1.8, fontWeight: '700' }}>CORRECT DECRYPTION KEY</Text>
                <Text style={{ color: result.isCorrect ? Colors.emerald : '#fca5a5', fontFamily: 'Chakra Petch', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>{result.correctAnswer}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, paddingVertical: 18, paddingHorizontal: 36, borderRadius: 14, backgroundColor: (result.coinsChange??0) > 0 ? accent + '08' : Colors.rose + '08', borderWidth: 1.5, borderColor: (result.coinsChange??0) > 0 ? accent + '35' : Colors.rose + '35' }}>
                <Icons.IntelIcon size={22} color={(result.coinsChange??0)>0 ? accent : Colors.rose} />
                <Text style={{ color: (result.coinsChange??0)>0 ? accent : Colors.rose, fontFamily: mono, fontSize: 34, fontWeight: '900' }}>{(result.coinsChange??0)>0?'+':''}{result.coinsChange}</Text>
              </View>
              {result.isCorrect && (
                <View style={{ alignSelf: 'stretch', marginTop: 22 }}>
                  <ChallengeShareButton
                    user={user}
                    riddle={riddleRef.current || riddle}
                    targetTime={result.challengeTimeSeconds}
                    mode="daily"
                    accent={accent}
                  />
                </View>
              )}
              <TouchableOpacity style={[{ backgroundColor: '#fff', paddingVertical: 16, borderRadius: 12, alignSelf: 'stretch', alignItems: 'center', marginTop: 28 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
                <Text style={{ color: '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>RETURN TO HUB →</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
