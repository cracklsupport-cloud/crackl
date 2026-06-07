import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, TextInput } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';
import { getAuthToken } from '../utils/authSession';
import RiddleContent from '../components/RiddleContent';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
const grotesk = isWeb ? '"Space Grotesk", sans-serif' : 'Chakra Petch';
const WAGER_PRESETS = [25, 50, 100, 250, 500];
const MIN_WAGER = 10;

function parseStake(value) {
  return Math.max(0, parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0);
}

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

export default function BlindWagerScreen({ user, go, exitToHome, update, panicMode }) {
  const [phase, setPhase] = useState('bet');
  const [wager, setWager] = useState(50);
  const [riddle, setRiddle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const [wagerToken, setWagerToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [err, setErr] = useState('');
  const timerRef = useRef(null);
  const riddleRef = useRef(null);
  const typedRef = useRef('');
  const timeLeftRef = useRef(30);
  const submitLockRef = useRef(false);
  const stakedBalanceRef = useRef(user?.coins || 0);
  const accent = Colors.fuchsia;
  const balance = Math.max(0, parseInt(user?.coins, 10) || 0);
  const currentWager = parseStake(wager);
  const panicBonusPreview = panicMode && currentWager >= MIN_WAGER ? Math.max(15, Math.round(currentWager * 0.25)) : 0;
  const totalWinReturn = currentWager * 2 + panicBonusPreview;
  const stakeInvalid = currentWager < MIN_WAGER || currentWager > balance;

  useEffect(() => () => clearInterval(timerRef.current), []);

  const resetRun = () => {
    clearInterval(timerRef.current);
    setPhase('bet');
    setRiddle(null);
    riddleRef.current = null;
    setResult(null);
    setWagerToken(null);
    setSelected(null);
    setTyped('');
    typedRef.current = '';
    setTimeLeft(30);
    timeLeftRef.current = 30;
    submitLockRef.current = false;
    // Always read the current user.coins to avoid stale refs after first round
    stakedBalanceRef.current = user?.coins ?? 0;
    setErr('');
    setSubmitting(false);
  };

  async function placeBet() {
    const stake = parseStake(wager);
    setWager(stake);
    if (stake < MIN_WAGER) { setErr(`Minimum stake is ${MIN_WAGER} Intel.`); return; }
    if (stake > balance) { setErr(`Insufficient funds. You have ${balance} Intel.`); return; }
    setLoading(true); setErr(''); setResult(null); setSelected(null); setTyped(''); typedRef.current = ''; riddleRef.current = null; submitLockRef.current = false;
    try {
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND}/wager/start`, { method:'POST', headers:{'Content-Type':'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {})}, body:JSON.stringify({ userId:user.id, city:user.city, area:user.area, xp:user.xp||0, wageredCoins:stake, panicMode: !!panicMode }) });
      const data = await res.json();
      if (data.success && data.riddle) {
        setRiddle(data.riddle);
        setWagerToken(data.wagerToken || null);
        riddleRef.current = data.riddle;
        stakedBalanceRef.current = data.newTotal != null ? data.newTotal : Math.max(0, balance - stake);
        update({ ...user, coins: stakedBalanceRef.current });
        setPhase('reveal');
        let t=data.riddle.timeLimit||30;
        setTimeLeft(t);
        timeLeftRef.current = t;
        clearInterval(timerRef.current);
        // Timer ONLY starts in Panic Mode
        if (panicMode) {
          timerRef.current=setInterval(()=>{t--;setTimeLeft(t);timeLeftRef.current=t;if(t<=0){clearInterval(timerRef.current);submitWager('__timeout__');}},1000);
        }
      } else {
        setErr(data.error || 'No wager sequence available right now.');
      }
    } catch { setRiddle(null); setErr('Network error — could not load riddle.'); } setLoading(false);
  }

  async function submitWager(ans) {
    const activeRiddle = riddleRef.current || riddle;
    if (submitLockRef.current || !activeRiddle) return; submitLockRef.current = true; clearInterval(timerRef.current); setSubmitting(true); setErr('');
    const hasOptions = Array.isArray(activeRiddle.options) && activeRiddle.options.length > 1;
    const mode = hasOptions ? 'mcq' : 'type';
    const final = ans === '__timeout__'
      ? (mode === 'type' ? (typedRef.current.trim() || '__timeout__') : '__timeout__')
      : ans;
    setSelected(final);
    try {
      const timeTaken = panicMode ? ((activeRiddle.timeLimit||30)-timeLeftRef.current) : 0;
      const token = await getAuthToken();
      const settleRes = await fetch(`${BACKEND}/wager/settle`, {
        method:'POST',
        headers:{'Content-Type':'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {})},
        body:JSON.stringify({ userId:user.id, userAnswer:final, wagerToken, timeTaken })
      });
      const settleData = await settleRes.json();
      if (!settleData.success) {
        setErr(settleData.error || 'Could not settle this wager.');
        submitLockRef.current = false;
        setSelected(null);
        setSubmitting(false);
        return;
      }
      const finalTotal = settleData.newTotal != null ? settleData.newTotal : Math.max(0, stakedBalanceRef.current);
      const wagerDelta = settleData.netDelta ?? (settleData.isCorrect ? currentWager : -currentWager);

      const combined = { ...settleData, wagerDelta, finalTotal, settleError: null };
      setResult(combined);
      update({...user, coins:finalTotal, xp:settleData.newXp, level:settleData.newLevel, streak:settleData.streakCount});
      setPhase('done');
    } catch { submitLockRef.current = false; setSelected(null); setErr('Network error — your result may not have been saved.'); }
    setSubmitting(false);
  }

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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: accent+'12', borderWidth: 1, borderColor: accent+'30' }}>
        <Icons.ShieldIcon size={14} color={accent} />
        <Text style={{ color: accent, fontFamily: mono, fontWeight: '900', fontSize: 12, letterSpacing: 2 }}>BLIND WAGER</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.gold+'10', borderWidth: 1, borderColor: Colors.gold+'30' }}>
        <Icons.IntelIcon size={14} color={Colors.gold} />
        <Text style={{ color: Colors.gold, fontFamily: mono, fontWeight: '800', fontSize: 14 }}>{user?.coins||0}</Text>
      </View>
    </View>
  );

  if (phase === 'bet') return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      <TopBar />
      {isWeb && <View style={{ position: 'absolute', top: '20%', left: '30%', width: 400, height: 400, borderRadius: 200, backgroundColor: accent, opacity: 0.04, pointerEvents: 'none' }} />}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, maxWidth: 520, alignSelf: 'center' }}>
        <Icons.ShieldIcon size={64} color={accent} />
        <Text style={{ color: Colors.textPrimary, fontFamily: grotesk, fontSize: 32, fontWeight: '900', marginTop: 24, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' }}>Assess the Risk</Text>
          <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 22 }}>{panicMode ? 'You operate blind. Lock Intel, reveal the sequence, then crack it before the admin timer expires. Win to recover the stake, collect the matching bonus, and pull extra Panic Intel. Fail and the stake is burned.' : 'You operate blind. Lock Intel, reveal the sequence, then crack it cleanly to recover the stake and collect a matching bonus. Fail and the stake is burned.'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: accent+'30', backgroundColor: accent+'08' }}>
          <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>BALANCE</Text>
          <Text style={{ color: Colors.gold, fontFamily: mono, fontSize: 16, fontWeight: '900' }}>{(user?.coins||0).toLocaleString()} INTEL</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
          {WAGER_PRESETS.map(v => (
            <TouchableOpacity key={v} style={[{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12,
              backgroundColor: wager===v ? accent+'15' : 'rgba(255,255,255,0.02)',
              borderWidth: 1.5, borderColor: wager===v ? accent : 'rgba(255,255,255,0.08)'
            }, isWeb ? { transition: 'all 0.2s ease', cursor: 'pointer' } : {}]} onPress={() => setWager(v)}>
              <Icons.IntelIcon size={16} color={wager===v ? accent : Colors.textSecondary} />
              <Text style={{ color: wager===v ? accent : Colors.textSecondary, fontFamily: mono, fontWeight: '900', fontSize: 16 }}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ marginTop: 18, width: '100%' }}>
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 1.8, marginBottom: 8 }}>CUSTOM INTEL STAKE</Text>
          <TextInput
            value={currentWager ? String(currentWager) : ''}
            onChangeText={(value) => { setWager(parseStake(value)); setErr(''); }}
            keyboardType="numeric"
            placeholder="Enter Intel"
            placeholderTextColor={Colors.textMuted}
            style={[{
              width: '100%',
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: stakeInvalid ? Colors.rose+'80' : accent+'45',
              backgroundColor: 'rgba(0,0,0,0.45)',
              color: Colors.textPrimary,
              fontFamily: mono,
              fontSize: 22,
              fontWeight: '900',
              paddingHorizontal: 18,
              paddingVertical: 16,
              textAlign: 'center',
            }, isWeb ? { outlineStyle: 'none', transition: 'all 0.2s ease', boxShadow: stakeInvalid ? `0 0 16px ${Colors.rose}20` : `0 0 18px ${accent}18` } : {}]}
          />
        </View>
        <View style={{ marginTop: 22, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: stakeInvalid ? Colors.rose+'45' : accent+'35', backgroundColor: stakeInvalid ? Colors.rose+'08' : accent+'08', width: '100%' }}>
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 12, letterSpacing: 1.8, textAlign: 'center' }}>STAKE CONTRACT</Text>
          <Text style={{ color: stakeInvalid ? Colors.rose : accent, fontFamily: grotesk, fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 6 }}>{currentWager} INTEL</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.28)', padding: 10, alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 10, letterSpacing: 1.1 }}>WIN RETURN</Text>
              <Text style={{ color: Colors.gold, fontFamily: mono, fontSize: 16, fontWeight: '900', marginTop: 4 }}>+{totalWinReturn}</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.28)', padding: 10, alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 10, letterSpacing: 1.1 }}>LOSS BURN</Text>
              <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 16, fontWeight: '900', marginTop: 4 }}>-{currentWager}</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.28)', padding: 10, alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 10, letterSpacing: 1.1 }}>BALANCE LEFT</Text>
              <Text style={{ color: balance >= currentWager ? Colors.emerald : Colors.rose, fontFamily: mono, fontSize: 16, fontWeight: '900', marginTop: 4 }}>{Math.max(0, balance-currentWager)}</Text>
            </View>
          </View>
          <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 18 }}>
            {panicMode
              ? `Panic Mode is armed. Win under the admin timer to release stake + matching bonus${panicBonusPreview ? ` + ${panicBonusPreview} Panic Intel` : ''}.`
              : `Win releases stake + matching bonus. Fail or abandon and the locked ${currentWager} Intel is gone.`}
          </Text>
        </View>
        {err ? <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 12, marginTop: 16, textAlign: 'center' }}>{err}</Text> : null}
        <TouchableOpacity style={[{ backgroundColor: stakeInvalid ? 'rgba(255,255,255,0.14)' : '#fff', paddingVertical: 18, paddingHorizontal: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 36, opacity: loading?0.5:1 }, isWeb ? { cursor: stakeInvalid ? 'not-allowed' : 'pointer' } : {}]} onPress={placeBet} disabled={loading || stakeInvalid}>
          {loading ? <ActivityIndicator color="#000" /> : <><Icons.TerminalIcon size={18} color={stakeInvalid ? Colors.textMuted : '#000'} /><Text style={{ color: stakeInvalid ? Colors.textMuted : '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 }}>LOCK STAKE & REVEAL →</Text></>}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (phase === 'done' && result) return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      <TopBar />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        {result.isCorrect ? <Icons.TargetIcon size={80} color={Colors.gold} /> : <Icons.XIcon size={80} color={Colors.rose} />}
        <Text style={{ color: result.isCorrect?Colors.gold:Colors.rose, fontFamily: grotesk, fontSize: 36, fontWeight: '900', marginTop: 24, textAlign: 'center', letterSpacing: 2 }}>
          {result.isCorrect ? `PAYOUT RELEASED: +${result.payout ?? result.delta ?? 0}` : `STAKE BURNED: -${result.stake ?? currentWager}`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          <View style={{ minWidth: 130, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 1.5 }}>LOCKED STAKE</Text>
            <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 22, fontWeight: '900', marginTop: 6 }}>-{result.stake ?? currentWager}</Text>
          </View>
          <View style={{ minWidth: 130, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 1.5 }}>NET CHANGE</Text>
            <Text style={{ color: (result.wagerDelta??0) > 0 ? Colors.gold : Colors.rose, fontFamily: mono, fontSize: 22, fontWeight: '900', marginTop: 6 }}>{(result.wagerDelta??0) > 0 ? '+' : ''}{result.wagerDelta ?? (result.isCorrect ? currentWager : -currentWager)}</Text>
          </View>
          <View style={{ minWidth: 130, padding: 14, borderRadius: 12, backgroundColor: Colors.gold+'10', borderWidth: 1, borderColor: Colors.gold+'35', alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 1.5 }}>NEW BALANCE</Text>
            <Text style={{ color: Colors.gold, fontFamily: mono, fontSize: 22, fontWeight: '900', marginTop: 6 }}>{(result.finalTotal ?? user?.coins ?? 0).toLocaleString()}</Text>
          </View>
          {result.panicBonus ? (
            <View style={{ minWidth: 130, padding: 14, borderRadius: 12, backgroundColor: Colors.rose+'10', borderWidth: 1, borderColor: Colors.rose+'35', alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 1.5 }}>PANIC BONUS</Text>
              <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 22, fontWeight: '900', marginTop: 6 }}>+{result.panicBonus}</Text>
            </View>
          ) : null}
        </View>
        {result.settleError ? <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 11, textAlign: 'center', marginTop: 14 }}>Settlement warning: {result.settleError}</Text> : null}
        <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 14, marginTop: 16, letterSpacing: 1.5 }}>CORRECT DECRYPTION KEY:</Text>
        <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 24, fontWeight: '900', marginTop: 8 }}>{result.correctAnswer}</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 48 }}>
          <TouchableOpacity style={[{ backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 36, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={resetRun}>
            <Icons.ZapIcon size={16} color={'#000'} />
            <Text style={{ color: '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>CHANGE STAKE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[{ paddingVertical: 16, paddingHorizontal: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)' }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
            <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontWeight: '800', fontSize: 14, letterSpacing: 1 }}>ABORT TO HUB</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      <TopBar />
      <ScrollView contentContainerStyle={{ maxWidth: 740, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Stake + timer (timer only shown in panic mode) */}
        <View style={{ borderRadius: 16, padding: 20, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: accent+'30', backgroundColor: accent+'08' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icons.IntelIcon size={16} color={accent} />
            <Text style={{ color: accent, fontFamily: mono, fontWeight: '900', fontSize: 16 }}>ESCROWED STAKE: {currentWager}</Text>
          </View>
          {panicMode && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icons.TimerIcon size={16} color={timeLeft<10?Colors.rose:accent} />
              <Text style={[{ color: timeLeft<10?Colors.rose:accent, fontFamily: mono, fontWeight: '900', fontSize: 18 }, isWeb && timeLeft <= 5 ? { textShadow: '0 0 12px rgba(255,42,42,0.8)' } : {}]}>{timeLeft}s</Text>
            </View>
          )}
        </View>

        {/* Question */}
        <View style={[{ backgroundColor: 'rgba(10,10,12,0.82)', borderRadius: 8, padding: 30, borderWidth: 1, borderColor: accent + '28', marginBottom: 18, position: 'relative', overflow: 'hidden' }, isWeb ? { backdropFilter: 'blur(24px)', boxShadow: `0 18px 60px rgba(0,0,0,0.5), 0 0 34px ${accent}12` } : {}]}>
          <CornerBrackets />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icons.LockIcon size={12} color={accent} />
              <Text style={{ fontFamily: mono, fontSize: 11, color: accent, letterSpacing: 1.8, textTransform: 'uppercase' }}>
                {panicMode ? 'Blind Protocol // Timed Breach' : 'Blind Protocol // High Risk'}
              </Text>
            </View>
            <Text style={{ fontFamily: mono, fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.8 }}>WAGER_{wager}</Text>
          </View>
          <RiddleContent
            riddle={riddle}
            accent={accent}
            questionStyle={{ fontFamily: grotesk, fontSize: 36, lineHeight: 46, fontWeight: '900' }}
          />
        </View>

        {/* Options */}
        {Array.isArray(riddle?.options) && riddle.options.length > 1 ? riddle.options.map((opt, i) => {
          const right=result&&opt===result.correctAnswer; const wrong=result&&opt===selected&&!result.isCorrect;
          const picked = !result && selected === opt;
          return (
            <TouchableOpacity key={i} style={[{
              flexDirection: 'row', alignItems: 'center', gap: 16,
              padding: 18, borderRadius: 8, marginBottom: 10,
              backgroundColor: right?Colors.emerald+'12':wrong?Colors.rose+'12':'rgba(255,255,255,0.02)',
              borderWidth: 1.5, borderColor: right?Colors.emerald+'55':wrong?Colors.rose+'55':picked?accent+'45':'rgba(255,255,255,0.07)'
            }, isWeb ? { transition: 'all 0.2s ease', cursor: 'pointer' } : {}]} onPress={() => !result&&!selected&&!submitting&&submitWager(opt)} disabled={!!result||!!selected||submitting} activeOpacity={0.7}>
              <View style={{ width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: right?Colors.emerald:wrong?Colors.rose:'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: right?Colors.emerald:wrong?Colors.rose:'rgba(255,255,255,0.1)' }}>
                <Text style={{ color: right||wrong?'#000':Colors.textMuted, fontFamily: mono, fontWeight: '900', fontSize: 16 }}>{['A','B','C','D'][i]}</Text>
              </View>
              <Text style={{ flex: 1, color: right?Colors.emerald:wrong?'#fca5a5':Colors.textPrimary, fontFamily: grotesk, fontSize: 18, fontWeight: '700', lineHeight: 26, letterSpacing: 0.1 }}>{opt}</Text>
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
              onPress={() => typed.trim() && !submitting && submitWager(typed.trim())}
              disabled={!typed.trim() || submitting}
            >
              {submitting ? <ActivityIndicator color="#000" size="small" /> : <Text style={{ color: '#000', fontFamily: grotesk, fontWeight: '900', fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' }}>Execute</Text>}
            </TouchableOpacity>
          </View>
        )}
        {err ? <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 12, marginTop: 14, textAlign: 'center' }}>{err}</Text> : null}
      </ScrollView>
    </View>
  );
}
