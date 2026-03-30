import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
const grotesk = isWeb ? '"Space Grotesk", sans-serif' : undefined;

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

export default function BlindWagerScreen({ user, go, update }) {
  const [phase, setPhase] = useState('bet');
  const [wager, setWager] = useState(50);
  const [riddle, setRiddle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef(null);
  const accent = Colors.fuchsia;

  async function placeBet() {
    if (wager < 10) { alert('Minimum stake is 10 Intel'); return; }
    if (wager > (user.coins||0)) { alert(`Insufficient funds. You have ${user.coins||0} coins.`); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/riddle`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, city:user.city, area:user.area, xp:user.xp||0, mode:'wager' }) });
      const data = await res.json();
      if (data.success && data.riddle) { setRiddle(data.riddle); setPhase('reveal'); let t=data.riddle.timeLimit||30; setTimeLeft(t); timerRef.current=setInterval(()=>{t--;setTimeLeft(t);if(t<=0){clearInterval(timerRef.current);submitWager('__timeout__');}},1000); }
    } catch {} setLoading(false);
  }

  async function submitWager(ans) {
    if (result) return; clearInterval(timerRef.current); setSelected(ans);
    try {
      const ansRes = await fetch(`${BACKEND}/answer`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, riddleId:riddle.id, userAnswer:ans, timeTaken:(riddle?.timeLimit||30)-timeLeft, mode:'mcq' }) });
      const ansData = await ansRes.json(); setResult(ansData);
      await fetch(`${BACKEND}/wager/settle`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, wageredIntel:wager, isCorrect:ansData.isCorrect }) });
      const newCoins = (user.coins||0) + (ansData.isCorrect ? wager : -wager);
      update({...user, coins:Math.max(0,newCoins), xp:ansData.newXp, level:ansData.newLevel}); setPhase('done');
    } catch {}
  }

  const TopBar = () => (
    <View style={[{
      height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 24, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
      zIndex: 10, backgroundColor: 'rgba(10,10,12,0.8)',
    }, isWeb ? { backdropFilter: 'blur(24px)' } : {}]}>
      <TouchableOpacity style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, isWeb ? { transition: 'all 0.2s ease' } : {}]} onPress={() => go('home')}>
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
        <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 22 }}>You operate blind. The sequence is unknown until the wager is locked. Choose your stake.</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[25,50,100,250,500].map(v => (
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
        <TouchableOpacity style={[{ backgroundColor: '#fff', paddingVertical: 18, paddingHorizontal: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 48, opacity: loading?0.5:1 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={placeBet} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <><Icons.TerminalIcon size={18} color={'#000'} /><Text style={{ color: '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 }}>DECRYPT SEQUENCE →</Text></>}
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
        <Text style={{ color: result.isCorrect?Colors.gold:Colors.rose, fontFamily: grotesk, fontSize: 36, fontWeight: '900', marginTop: 24, textAlign: 'center', letterSpacing: 2 }}>{result.isCorrect?`YIELD: +${wager}`:`COMPROMISED: -${wager}`}</Text>
        <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 14, marginTop: 16, letterSpacing: 1.5 }}>CORRECT DECRYPTION KEY:</Text>
        <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 24, fontWeight: '900', marginTop: 8 }}>{result.correctAnswer}</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 48 }}>
          <TouchableOpacity style={[{ backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 36, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => {setPhase('bet');setRiddle(null);setResult(null);setSelected(null);setTimeLeft(30);}}>
            <Icons.ZapIcon size={16} color={'#000'} />
            <Text style={{ color: '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>RE-ENGAGE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[{ paddingVertical: 16, paddingHorizontal: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)' }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => go('home')}>
            <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontWeight: '800', fontSize: 14, letterSpacing: 1 }}>ABORT TO HUB</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const tPct = timeLeft / (riddle?.timeLimit || 30);

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      <TopBar />
      <ScrollView contentContainerStyle={{ maxWidth: 740, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Stake + timer */}
        <View style={{ borderRadius: 16, padding: 20, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: accent+'30', backgroundColor: accent+'08' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icons.IntelIcon size={16} color={accent} />
            <Text style={{ color: accent, fontFamily: mono, fontWeight: '900', fontSize: 16 }}>STAKE: {wager}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icons.TimerIcon size={16} color={timeLeft<10?Colors.rose:accent} />
            <Text style={[{ color: timeLeft<10?Colors.rose:accent, fontFamily: mono, fontWeight: '900', fontSize: 18 }, isWeb && timeLeft <= 5 ? { textShadow: '0 0 12px rgba(255,42,42,0.8)' } : {}]}>{timeLeft}s</Text>
          </View>
        </View>

        {/* Question */}
        <View style={[{ backgroundColor: 'rgba(10,10,12,0.8)', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 24, position: 'relative', overflow: 'hidden' }, isWeb ? { backdropFilter: 'blur(24px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' } : {}]}>
          <CornerBrackets />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icons.LockIcon size={12} color={accent} />
              <Text style={{ fontFamily: mono, fontSize: 10, color: accent, letterSpacing: 2, textTransform: 'uppercase' }}>Blind Protocol // High Risk</Text>
            </View>
            <Text style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>WAGER_{wager}</Text>
          </View>
          <Text style={{ color: Colors.textPrimary, fontFamily: 'Cormorant Garamond', fontSize: 24, fontWeight: '700', lineHeight: 34 }}>{riddle?.question}</Text>
        </View>

        {/* Options */}
        {riddle?.options?.map((opt, i) => {
          const right=result&&opt===result.correctAnswer; const wrong=result&&opt===selected&&!result.isCorrect;
          const picked = !result && selected === opt;
          return (
            <TouchableOpacity key={i} style={[{
              flexDirection: 'row', alignItems: 'center', gap: 16,
              padding: 18, borderRadius: 12, marginBottom: 10,
              backgroundColor: right?Colors.emerald+'12':wrong?Colors.rose+'12':'rgba(255,255,255,0.02)',
              borderWidth: 1.5, borderColor: right?Colors.emerald+'55':wrong?Colors.rose+'55':picked?accent+'45':'rgba(255,255,255,0.07)'
            }, isWeb ? { transition: 'all 0.2s ease', cursor: 'pointer' } : {}]} onPress={() => !result&&!selected&&submitWager(opt)} disabled={!!result||!!selected} activeOpacity={0.7}>
              <View style={{ width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: right?Colors.emerald:wrong?Colors.rose:'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: right?Colors.emerald:wrong?Colors.rose:'rgba(255,255,255,0.1)' }}>
                <Text style={{ color: right||wrong?'#000':Colors.textMuted, fontFamily: mono, fontWeight: '900', fontSize: 15 }}>{['A','B','C','D'][i]}</Text>
              </View>
              <Text style={{ flex: 1, color: right?Colors.emerald:wrong?'#fca5a5':Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 }}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
