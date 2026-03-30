import React, { useState, useEffect, useRef } from 'react';
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

export default function GauntletScreen({ user, go, update }) {
  const [riddle, setRiddle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);
  const TOTAL = 10;
  const accent = '#ff2a2a';

  useEffect(() => { loadRiddle(); return () => clearInterval(timerRef.current); }, []);

  async function loadRiddle() {
    setLoading(true); setRiddle(null); setSelected(null); setResult(null); clearInterval(timerRef.current);
    try {
      const res = await fetch(`${BACKEND}/riddle`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, city:user.city, area:user.area, xp:user.xp||0, mode:'gauntlet' }) });
      const data = await res.json();
      if (data.success && data.riddle) { setRiddle(data.riddle); setTimeLeft(20); let t=20; timerRef.current=setInterval(()=>{t--;setTimeLeft(t);if(t<=0){clearInterval(timerRef.current);autoSubmit('__timeout__');}},1000); }
    } catch {}
    setLoading(false);
  }

  async function autoSubmit(ans) {
    if (!riddle || result) return; clearInterval(timerRef.current); setSelected(ans);
    try {
      const res = await fetch(`${BACKEND}/answer`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, riddleId:riddle.id, userAnswer:ans, timeTaken:20-timeLeft, mode:'mcq' }) });
      const data = await res.json();
      if (data.success) { setResult(data); const ns=score+(data.isCorrect?1:0); setScore(ns); update({...user, coins:data.newTotal, xp:data.newXp, level:data.newLevel}); setTimeout(()=>{const nc=count+1;setCount(nc);if(nc>=TOTAL)setDone(true);else loadRiddle();},1200); }
    } catch {}
  }

  const tPct = timeLeft / 20;
  const tCol = timeLeft > 8 ? accent : Colors.orange;

  if (done) return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        {score>=8 ? <Icons.TrophyIcon size={80} color={Colors.gold} /> : score>=5 ? <Icons.TargetIcon size={80} color={Colors.emerald} /> : <Icons.AlertTriangleIcon size={80} color={Colors.rose} />}
        <Text style={{ color: Colors.textPrimary, fontFamily: grotesk, fontSize: 42, fontWeight: '900', marginTop: 24, textAlign: 'center', letterSpacing: 2 }}>GAUNTLET COMPLETE</Text>
        <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 20, marginTop: 12, letterSpacing: 1 }}>{score}/{TOTAL} SEQUENCES CRACKED</Text>
        <Text style={{ color: score>=8?Colors.gold:score>=5?Colors.emerald:Colors.rose, fontFamily: grotesk, fontSize: 20, fontWeight: '900', marginTop: 16, letterSpacing: 2 }}>{score>=8?'LEGENDARY OPERATIVE':score>=5?'SOLID FIELD RUN':'ADDITIONAL TRAINING REQUIRED'}</Text>
        <TouchableOpacity style={[{ paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)', marginTop: 48 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => go('home')}>
          <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>RETURN TO HUB</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      {isWeb && <View style={{ position: 'absolute', top: '10%', left: '5%', width: 400, height: 400, borderRadius: 200, backgroundColor: accent, opacity: 0.04, pointerEvents: 'none' }} />}

      {/* Top Bar */}
      <View style={[{
        height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        zIndex: 10, backgroundColor: 'rgba(10,10,12,0.8)',
      }, isWeb ? { backdropFilter: 'blur(24px)' } : {}]}>
        <TouchableOpacity style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, isWeb ? { transition: 'all 0.2s ease' } : {}]} onPress={() => go('home')}>
          <Icons.ChevronLeftIcon size={12} color="#00ffd0" />
          <Text style={{ color: '#00ffd0', fontFamily: mono, fontWeight: '800', fontSize: 12, letterSpacing: 2 }}>ABORT</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: accent + '15', borderWidth: 1, borderColor: accent + '30' }}>
          <Icons.SwordsIcon size={14} color={accent} />
          <Text style={{ color: accent, fontFamily: mono, fontWeight: '900', fontSize: 12, letterSpacing: 2 }}>GAUNTLET <Text style={{ color: '#fff', opacity: 0.8 }}>{count+1}/{TOTAL}</Text></Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.gold + '10', borderWidth: 1, borderColor: Colors.gold + '30' }}>
          <Icons.TargetIcon size={14} color={Colors.gold} />
          <Text style={{ color: Colors.gold, fontFamily: mono, fontWeight: '800', fontSize: 14 }}>{score} PTS</Text>
        </View>
      </View>

      {/* Progress steps */}
      <View style={{ flexDirection: 'row', gap: 3, paddingHorizontal: 24, paddingVertical: 8 }}>
        {Array.from({length: TOTAL}, (_, i) => (
          <View key={i} style={[{ flex: 1, height: 4, borderRadius: 2 }, isWeb ? { backgroundColor: i < count ? accent : 'rgba(255,255,255,0.05)', transition: 'background-color 0.5s ease' } : { backgroundColor: i < count ? accent : 'rgba(255,255,255,0.05)' }]} />
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 12, letterSpacing: 2 }}>LOADING NODE {count+1}...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ maxWidth: 740, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
          {/* Timer */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <View style={{ flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
              <View style={[{ height: '100%', borderRadius: 4 }, isWeb ? { width: `${tPct*100}%`, backgroundImage: 'linear-gradient(to right, #880000, #ff2a2a)', boxShadow: `0 0 20px ${accent}80`, transition: 'width 1s linear' } : { width: `${tPct*100}%`, backgroundColor: tCol }]} />
            </View>
            <Text style={[{ color: tCol, fontFamily: mono, fontWeight: '900', fontSize: 22, minWidth: 56, textAlign: 'right' }, isWeb && timeLeft <= 5 ? { textShadow: '0 0 12px rgba(255,42,42,0.8)' } : {}]}>{timeLeft}s</Text>
          </View>

          {/* Question */}
          <View style={[{ backgroundColor: 'rgba(10,10,12,0.8)', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 24, position: 'relative', overflow: 'hidden' }, isWeb ? { backdropFilter: 'blur(24px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' } : {}]}>
            <CornerBrackets />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icons.LockIcon size={12} color={accent} />
                <Text style={{ fontFamily: mono, fontSize: 10, color: accent, letterSpacing: 2, textTransform: 'uppercase' }}>Secure Channel // Encrypted</Text>
              </View>
              <Text style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>NODE_{(count+1).toString().padStart(2,'0')}</Text>
            </View>
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Cormorant Garamond', fontSize: 24, fontWeight: '700', lineHeight: 34 }}>{riddle?.question}</Text>
          </View>

          {/* Options */}
          {riddle?.options?.map((opt, i) => {
            const right = result && opt === result.correctAnswer;
            const wrong = result && opt === selected && !result.isCorrect;
            return (
              <TouchableOpacity key={i} style={[{
                flexDirection: 'row', alignItems: 'center', gap: 16,
                padding: 18, borderRadius: 12, marginBottom: 10,
                backgroundColor: right ? Colors.emerald+'12' : wrong ? Colors.rose+'12' : 'rgba(255,255,255,0.02)',
                borderWidth: 1.5, borderColor: right ? Colors.emerald+'55' : wrong ? Colors.rose+'55' : 'rgba(255,255,255,0.07)'
              }, isWeb ? { transition: 'all 0.2s ease', cursor: 'pointer' } : {}]} onPress={() => !result && !selected && autoSubmit(opt)} disabled={!!result||!!selected} activeOpacity={0.7}>
                <View style={{ width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: right?Colors.emerald:wrong?Colors.rose:'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: right?Colors.emerald:wrong?Colors.rose:'rgba(255,255,255,0.1)' }}>
                  <Text style={{ color: right||wrong?'#000':Colors.textMuted, fontFamily: mono, fontWeight: '900', fontSize: 15 }}>{['A','B','C','D'][i]}</Text>
                </View>
                <Text style={{ flex: 1, color: right?Colors.emerald:wrong?'#fca5a5':Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 }}>{opt}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Result inline */}
          {result && (
            <View style={[{ padding: 20, borderRadius: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 1 }, result.isCorrect ? { backgroundColor: Colors.emerald+'12', borderColor: Colors.emerald+'40' } : { backgroundColor: Colors.rose+'12', borderColor: Colors.rose+'40' }]}>
              {result.isCorrect ? <Icons.TargetIcon size={24} color={Colors.emerald} /> : <Icons.XIcon size={24} color={Colors.rose} />}
              <Text style={{ color: result.isCorrect?Colors.emerald:Colors.rose, fontFamily: grotesk, fontWeight: '900', fontSize: 18, letterSpacing: 1 }}>{result.isCorrect?`CRACKED! +${result.coinsChange} CR`:'FAILED — NEXT NODE!'}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
