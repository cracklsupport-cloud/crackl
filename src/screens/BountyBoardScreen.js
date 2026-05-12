import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RiddleContent from '../components/RiddleContent';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
const grotesk = isWeb ? '"Black Ops One", sans-serif' : undefined;

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

export default function BountyBoardScreen({ user, go, exitToHome, update, panicMode }) {
  const [bounty, setBounty] = useState(null);
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [panicTimeLeft, setPanicTimeLeft] = useState(0);
  const [bountyToken, setBountyToken] = useState(null);
  const [err, setErr] = useState('');
  const submitLockRef = useRef(false);
  const typedRef = useRef('');
  const timerRef = useRef(null);
  const timeLeftRef = useRef(0);
  const accent = Colors.gold;

  useEffect(() => {
    load();
    return () => clearInterval(timerRef.current);
  }, []);

  function armPanicTimer(limit) {
    clearInterval(timerRef.current);
    const safeLimit = Math.max(0, parseInt(limit, 10) || 0);
    setPanicTimeLeft(safeLimit);
    timeLeftRef.current = safeLimit;
    if (!panicMode || !safeLimit) return;
    let t = safeLimit;
    timerRef.current = setInterval(() => {
      t--;
      setPanicTimeLeft(t);
      timeLeftRef.current = t;
      if (t <= 0) {
        clearInterval(timerRef.current);
        attempt('__timeout__');
      }
    }, 1000);
  }

  async function load() {
    clearInterval(timerRef.current);
    setLoading(true);
    setErr('');
    setResult(null);
    setBounty(null);
    setTyped('');
    typedRef.current = '';
	    submitLockRef.current = false;
	    try {
	      const token = await AsyncStorage.getItem('crackl_token');
	      const res = await fetch(`${BACKEND}/bounty/current?panicMode=${panicMode ? 'true' : 'false'}`, {
	        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success && data.bounty) {
        setBounty(data.bounty);
        setBountyToken(data.bountyToken || null);
        const ms = Math.max(0, new Date(data.bounty.expires_at) - Date.now());
        setTimeLeft(`${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`);
        armPanicTimer(data.bounty.timeLimit);
      } else {
        setBounty(null);
        setBountyToken(null);
        setTimeLeft(null);
        setPanicTimeLeft(0);
        timeLeftRef.current = 0;
        if (!data.noBounty) {
          setErr(data.error || 'Could not load the current bounty.');
        }
      }
    } catch {
      setErr('Signal lost while loading the current bounty.');
      setPanicTimeLeft(0);
      timeLeftRef.current = 0;
    }
    setLoading(false);
  }

  async function attempt(ans) {
    const finalAnswer = ans === '__timeout__' ? (typedRef.current.trim() || '__timeout__') : typed.trim();
    if ((!finalAnswer && ans !== '__timeout__') || !bounty || submitLockRef.current || result?.isCorrect) return;
    submitLockRef.current = true;
    clearInterval(timerRef.current);
	    setSubmitting(true);
	    setErr('');
	    try {
	      const token = await AsyncStorage.getItem('crackl_token');
	      const res = await fetch(`${BACKEND}/bounty/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId: user.id, bountyId: bounty.id, userAnswer: finalAnswer, username: user.username, panicMode: !!panicMode, bountyToken, timeTaken: panicMode ? ((bounty.timeLimit || 0) - timeLeftRef.current) : 0 })
      });
      const data = await res.json();
      setResult({ ...data, timedOut: finalAnswer === '__timeout__' });
      if (data.isCorrect) {
        update({ ...user, coins: data.newTotal ?? ((user.coins || 0) + (data.prize || bounty.prize_coins || 0)) });
      } else if (!panicMode) {
        submitLockRef.current = false;
      }
    } catch {
      submitLockRef.current = false;
      setErr('Signal failed. Try submitting again.');
    }
    setSubmitting(false);
  }

  const panicLimit = bounty?.timeLimit || panicTimeLeft || 1;
  const panicPct = Math.max(0, panicTimeLeft / panicLimit);

  const TopBar = () => (
    <View style={[{
      height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 24, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
      zIndex: 10, backgroundColor: 'rgba(10,10,12,0.8)',
    }, isWeb ? { backdropFilter: 'blur(24px)' } : {}]}>
      <TouchableOpacity style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, isWeb ? { transition: 'all 0.2s ease' } : {}]} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
        <Icons.ChevronLeftIcon size={12} color="#00ffd0" />
        <Text style={{ color: '#00ffd0', fontFamily: mono, fontWeight: '800', fontSize: 12, letterSpacing: 2 }}>ABORT</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: accent + '12', borderWidth: 1, borderColor: accent + '30' }}>
        <Icons.TrophyIcon size={14} color={accent} />
        <Text style={{ color: accent, fontFamily: mono, fontWeight: '900', fontSize: 12, letterSpacing: 2 }}>BOUNTY BOARD</Text>
      </View>
      <View style={{ width: 100 }} />
    </View>
  );

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}><ArenaOverlay /><TopBar />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <ActivityIndicator size="large" color={accent} />
        <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 12, letterSpacing: 2 }}>SEARCHING FOR ACTIVE BOUNTIES...</Text>
      </View>
    </View>
  );

  if (!bounty) return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}><ArenaOverlay /><TopBar />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Icons.ShieldIcon size={48} color={err ? Colors.rose : Colors.textMuted} />
        <Text style={{ color: err ? Colors.rose : Colors.textSecondary, fontFamily: grotesk, fontSize: 20, marginTop: 16, letterSpacing: 1, fontWeight: '700', textAlign: 'center' }}>
          {err ? 'BOUNTY LINK UNSTABLE.' : 'NO ACTIVE BOUNTIES AT THIS TIME.'}
        </Text>
        {err ? (
          <>
            <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 12, marginTop: 10, textAlign: 'center', lineHeight: 20, maxWidth: 420 }}>{err}</Text>
            <TouchableOpacity style={[{ paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, borderWidth: 1, borderColor: Colors.rose + '35', backgroundColor: Colors.rose + '10', marginTop: 20 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={load}>
              <Text style={{ color: Colors.rose, fontFamily: mono, fontWeight: '900', fontSize: 12, letterSpacing: 1.6 }}>RETRY BOUNTY FETCH</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );

  if (bounty.solved_by && !result) return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}><ArenaOverlay /><TopBar />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Icons.TrophyIcon size={80} color={accent} style={{ opacity: 0.5 }} />
        <Text style={{ color: accent, fontFamily: grotesk, fontSize: 36, fontWeight: '900', marginTop: 24, textAlign: 'center', letterSpacing: 2, opacity: 0.8 }}>BOUNTY CLAIMED</Text>
        <Text style={{ color: Colors.textSecondary, fontFamily: mono, marginTop: 16, fontSize: 16, letterSpacing: 1 }}>OPERATIVE <Text style={{ color: Colors.cyan, fontWeight: '700' }}>{bounty.solved_by}</Text> SECURED THE ASSET.</Text>
        <TouchableOpacity style={[{ paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)', marginTop: 40 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
          <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>RETURN TO HUB</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (result?.isCorrect) return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}><ArenaOverlay /><TopBar />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Icons.TargetIcon size={80} color={accent} />
        <Text style={{ color: accent, fontFamily: grotesk, fontSize: 42, fontWeight: '900', marginTop: 24, textAlign: 'center', letterSpacing: 2 }}>LEGENDARY SOLVER</Text>
        <Text style={{ color: Colors.textSecondary, fontFamily: mono, marginTop: 16, textAlign: 'center', lineHeight: 22, fontSize: 14 }}>{result.message}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 32, backgroundColor: accent + '15', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: accent + '40' }}>
          <Icons.IntelIcon size={24} color={accent} />
          <Text style={{ color: accent, fontFamily: mono, fontSize: 36, fontWeight: '900' }}>+{(result.prize || bounty.prize_coins || 0).toLocaleString()}</Text>
        </View>
        {result.panicBonus ? (
          <Text style={{ color: Colors.rose, fontFamily: mono, marginTop: 14, textAlign: 'center', fontSize: 12, letterSpacing: 1.2 }}>
            PANIC BONUS INTEL: +{result.panicBonus}
          </Text>
        ) : null}
        <TouchableOpacity style={[{ backgroundColor: '#fff', paddingVertical: 18, paddingHorizontal: 48, borderRadius: 12, marginTop: 48 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
          <Text style={{ color: '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 }}>ENTER HALL OF FAME →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      <TopBar />
      {isWeb && <View style={{ position: 'absolute', top: '15%', right: '10%', width: 400, height: 400, borderRadius: 200, backgroundColor: accent, opacity: 0.04, pointerEvents: 'none' }} />}
      <ScrollView contentContainerStyle={{ maxWidth: 660, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 64 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Icons.TrophyIcon size={56} color={accent} />
          <Text style={{ color: accent, fontFamily: mono, fontSize: 12, fontWeight: '900', letterSpacing: 4, marginTop: 16, opacity: 0.8 }}>GLOBAL DIRECTIVE</Text>
          <Text style={{ color: Colors.textPrimary, fontFamily: grotesk, fontSize: 36, fontWeight: '900', marginTop: 8, textAlign: 'center', letterSpacing: 1 }}>
            {(bounty.prize_coins || 0).toLocaleString()} CREDIT YIELD
          </Text>
          {panicMode ? (
            <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginTop: 8 }}>
              CLEAR IT UNDER BREACH TIMER FOR BONUS INTEL
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.02)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <Icons.TimerIcon size={14} color={Colors.textSecondary} />
            <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>EXPIRES: {timeLeft}</Text>
          </View>
          {panicMode && panicTimeLeft > 0 && !result?.isCorrect ? (
            <View style={{ width: '100%', marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 12, fontWeight: '900', letterSpacing: 1.8 }}>PANIC TIMER ACTIVE</Text>
              <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 16, fontWeight: '900' }}>{panicTimeLeft}s</Text>
              </View>
              <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <View style={[{ height: '100%', borderRadius: 4 }, isWeb ? { width: `${panicPct * 100}%`, backgroundImage: 'linear-gradient(to right, #880000, #ff2a2a)', boxShadow: '0 0 20px rgba(255,42,42,0.5)', transition: 'width 1s linear' } : { width: `${panicPct * 100}%`, backgroundColor: Colors.rose }]} />
              </View>
            </View>
          ) : null}
        </View>

        <View style={[{ backgroundColor: 'rgba(10,10,12,0.8)', borderRadius: 24, padding: 28, borderWidth: 2, borderColor: accent + '25', marginBottom: 28, position: 'relative', overflow: 'hidden' }, isWeb ? { backdropFilter: 'blur(24px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' } : {}]}>
          <CornerBrackets />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Icons.LockIcon size={14} color={accent} />
            <Text style={{ color: accent, fontFamily: mono, fontSize: 13, fontWeight: '900', letterSpacing: 1.8, textTransform: 'uppercase' }}>Classified Intel</Text>
          </View>
          <RiddleContent riddle={bounty} accent={accent} questionStyle={{ fontSize: 22 }} />
        </View>

        <View style={[{ backgroundColor: 'rgba(10,10,12,0.6)', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.rose + '25', marginBottom: 24 }, isWeb ? { backdropFilter: 'blur(12px)' } : {}]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Icons.AlertTriangleIcon size={14} color={Colors.rose} />
            <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 12, fontWeight: '900', letterSpacing: 1.8 }}>{panicMode ? 'ONE TIMED ATTEMPT PER RUN' : 'CRITICAL: ONE CLEAR ANSWER REQUIRED'}</Text>
          </View>
          <View style={{ position: 'relative' }}>
            <Text style={{ position: 'absolute', left: 20, top: 22, zIndex: 10, fontFamily: mono, fontSize: 22, fontWeight: '900', color: '#00ffd0' }}>{'>'}_</Text>
            <TextInput
              style={[{
                backgroundColor: '#050505', borderWidth: 2, borderColor: typed ? '#00ffd060' : 'rgba(255,255,255,0.08)',
                borderRadius: 16, paddingTop: 20, paddingBottom: 20, paddingLeft: 56, paddingRight: 20,
                color: Colors.textPrimary, fontFamily: mono, fontSize: 18, fontWeight: '900',
                letterSpacing: 2, textTransform: 'uppercase', minHeight: 70,
              }, isWeb ? { outlineStyle: 'none', transition: 'all 0.3s ease', boxShadow: typed ? '0 0 15px rgba(0,255,208,0.15)' : 'none' } : {}]}
              placeholder={panicMode ? 'ENTER ANSWER BEFORE TIMER COLLAPSES...' : 'ENTER DECRYPTION KEY...'}
              placeholderTextColor={Colors.textMuted}
              value={typed}
              onChangeText={(value) => { setTyped(value); typedRef.current = value; }}
              editable={!(panicMode && result && !result.isCorrect)}
            />
          </View>
          {result && !result.isCorrect ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: Colors.rose + '15', padding: 10, borderRadius: 8 }}>
              <Icons.XIcon size={14} color={Colors.rose} />
              <Text style={{ color: Colors.rose, fontFamily: mono, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>
                {panicMode ? (result.timedOut ? 'Timer expired. Start a fresh bounty run to try again.' : 'Timed run failed. Re-arm Panic Mode to make another attempt.') : 'SEQUENCE INVALID. RE-CALCULATE.'}
              </Text>
            </View>
          ) : null}
          {err ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: Colors.rose + '15', padding: 10, borderRadius: 8 }}>
              <Icons.AlertTriangleIcon size={14} color={Colors.rose} />
              <Text style={{ color: Colors.rose, fontFamily: mono, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>{err}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={[{
          backgroundColor: submitting ? '#666' : '#fff',
          paddingVertical: 18, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
          opacity: (!typed.trim() || submitting || (panicMode && result && !result.isCorrect)) ? 0.4 : 1
        }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]} onPress={() => attempt()} disabled={!typed.trim() || submitting || (panicMode && result && !result.isCorrect)}>
          {submitting ? <ActivityIndicator color="#000" /> : <><Icons.TerminalIcon size={18} color="#000" /><Text style={{ color: '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 }}>EXECUTE SOLUTION</Text></>}
        </TouchableOpacity>

        {panicMode && result && !result.isCorrect ? (
          <TouchableOpacity style={[{
            marginTop: 14,
            paddingVertical: 16,
            borderRadius: 12,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            backgroundColor: Colors.rose + '10',
            borderWidth: 1,
            borderColor: Colors.rose + '35'
          }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]} onPress={load}>
            <Icons.TimerIcon size={16} color={Colors.rose} />
            <Text style={{ color: Colors.rose, fontFamily: mono, fontWeight: '900', fontSize: 13, letterSpacing: 1.2 }}>RE-ARM PANIC TIMER</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}
