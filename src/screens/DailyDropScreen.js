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

export default function DailyDropScreen({ user, go, update }) {
  const [riddle, setRiddle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [loading, setLoading] = useState(true);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => { load(); return () => clearInterval(timerRef.current); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/daily-riddle`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, city:user.city, area:user.area, xp:user.xp||0 }) });
      const data = await res.json();
      if (data.alreadyPlayed) setAlreadyPlayed(true);
      else if (data.success) { setRiddle(data.riddle); setDailyStreak(data.dailyStreak); let t=60; timerRef.current=setInterval(()=>{t--;setTimeLeft(t);if(t<=0){clearInterval(timerRef.current);submit('__timeout__');}},1000); }
    } catch {}
    setLoading(false);
  }

  async function submit(ans) {
    if (result) return; clearInterval(timerRef.current); setSelected(ans);
    try {
      const res = await fetch(`${BACKEND}/answer`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, riddleId:riddle.id, userAnswer:ans, timeTaken:60-timeLeft, mode:'mcq' }) });
      const data = await res.json();
      if (data.success) { setResult(data); update({...user, coins:data.newTotal, xp:data.newXp, level:data.newLevel, streak:data.streakCount}); }
    } catch {}
  }

  const tPct = timeLeft / 60;
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
        <TouchableOpacity style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, isWeb ? { transition: 'all 0.2s ease' } : {}]} onPress={() => go('home')}>
          <Icons.ChevronLeftIcon size={12} color="#00ffd0" />
          <Text style={{ color: '#00ffd0', fontFamily: mono, fontWeight: '800', fontSize: 12, letterSpacing: 2 }}>ABORT</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: accent + '12', borderWidth: 1, borderColor: accent + '30' }}>
          <Icons.SunIcon size={14} color={accent} />
          <Text style={{ color: accent, fontFamily: mono, fontWeight: '900', fontSize: 12, letterSpacing: 2 }}>DAILY DROP</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.orange + '10', borderWidth: 1, borderColor: Colors.orange + '30' }}>
          <Icons.ZapIcon size={14} color={Colors.orange} />
          <Text style={{ color: Colors.orange, fontFamily: mono, fontWeight: '800', fontSize: 14 }}>{dailyStreak} COMBO</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>DECRYPTING TODAY'S DROP...</Text>
        </View>
      ) : alreadyPlayed ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Icons.TargetIcon size={80} color={Colors.emerald} />
          <Text style={{ color: Colors.textPrimary, fontFamily: grotesk, fontSize: 36, fontWeight: '900', marginTop: 24, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' }}>SYSTEM CLEARED</Text>
          <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 22 }}>You've already processed today's sequence. Return in 24h to maintain your <Text style={{ color: Colors.orange, fontWeight: '700' }}>{dailyStreak}</Text> day combo.</Text>
          <TouchableOpacity style={[{ paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)', marginTop: 40 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => go('home')}>
            <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontWeight: '900', fontSize: 13, letterSpacing: 2 }}>RETURN TO HUB</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ maxWidth: 740, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
          {/* Timer */}
          {!result && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 }}>
              <View style={{ flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <View style={[{ height: '100%', borderRadius: 4 }, isWeb ? { width: `${tPct*100}%`, backgroundImage: tPct > 0.5 ? 'linear-gradient(to right, #78350f, #fbbf24)' : 'linear-gradient(to right, #880000, #ff2a2a)', boxShadow: `0 0 20px ${tCol}80`, transition: 'width 1s linear' } : { width: `${tPct*100}%`, backgroundColor: tCol }]} />
              </View>
              <Text style={[{ color: tCol, fontFamily: mono, fontWeight: '900', fontSize: 22, minWidth: 72, textAlign: 'right' }, isWeb && timeLeft <= 10 ? { textShadow: '0 0 12px rgba(255,42,42,0.8)' } : {}]}>{timeLeft}s</Text>
            </View>
          )}

          {/* Question Card */}
          <View style={[{ backgroundColor: 'rgba(10,10,12,0.8)', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: accent + '30', marginBottom: 24, position: 'relative', overflow: 'hidden' }, isWeb ? { backdropFilter: 'blur(24px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' } : {}]}>
            <CornerBrackets />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icons.SunIcon size={12} color={accent} />
                <Text style={{ fontFamily: mono, fontSize: 10, color: accent, letterSpacing: 2, textTransform: 'uppercase' }}>Today's Directive</Text>
              </View>
              <Text style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>DAILY_DROP</Text>
            </View>
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Cormorant Garamond', fontSize: 24, fontWeight: '700', lineHeight: 34 }}>{riddle?.question}</Text>
          </View>

          {/* Options */}
          {riddle?.options?.map((opt, i) => {
            const right = result && opt === result.correctAnswer;
            const wrong = result && opt === selected && !result.isCorrect;
            const picked = !result && selected === opt;
            return (
              <TouchableOpacity key={i} style={[{
                flexDirection: 'row', alignItems: 'center', gap: 16,
                padding: 18, borderRadius: 12, marginBottom: 10,
                backgroundColor: right ? Colors.emerald + '12' : wrong ? Colors.rose + '12' : 'rgba(255,255,255,0.02)',
                borderWidth: 1.5,
                borderColor: right ? Colors.emerald + '55' : wrong ? Colors.rose + '55' : picked ? accent + '45' : 'rgba(255,255,255,0.07)'
              }, isWeb ? { transition: 'all 0.2s ease', cursor: 'pointer' } : {}]} onPress={() => !result && !selected && submit(opt)} disabled={!!result||!!selected} activeOpacity={0.7}>
                <View style={{
                  width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: right ? Colors.emerald : wrong ? Colors.rose : 'rgba(255,255,255,0.05)',
                  borderWidth: 1, borderColor: right ? Colors.emerald : wrong ? Colors.rose : 'rgba(255,255,255,0.1)'
                }}><Text style={{ color: right||wrong ? '#000' : Colors.textMuted, fontFamily: mono, fontWeight: '900', fontSize: 15 }}>{['A','B','C','D'][i]}</Text></View>
                <Text style={{ flex: 1, color: right ? Colors.emerald : wrong ? '#fca5a5' : Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 15, fontWeight: '600', lineHeight: 22, letterSpacing: 0.3 }}>{opt}</Text>
                {right && <Icons.TargetIcon size={18} color={Colors.emerald} />}
                {wrong && <Icons.XIcon size={18} color={Colors.rose} />}
              </TouchableOpacity>
            );
          })}

          {/* Result */}
          {result && (
            <View style={[{ backgroundColor: 'rgba(10,10,12,0.8)', borderRadius: 24, padding: 32, borderWidth: 1.5, borderColor: result.isCorrect ? accent + '40' : Colors.rose + '40', alignItems: 'center', marginTop: 16, position: 'relative', overflow: 'hidden' }, isWeb ? { backdropFilter: 'blur(24px)' } : {}]}>
              <CornerBrackets />
              <View style={{ position: 'absolute', top: 0, left: '20%', width: 220, height: 220, borderRadius: 110, backgroundColor: result.isCorrect ? accent : Colors.rose, opacity: 0.06 }} />
              {result.isCorrect ? <Icons.SunIcon size={52} color={accent} /> : <Icons.XIcon size={52} color={Colors.rose} />}
              <Text style={{ color: result.isCorrect ? accent : Colors.rose, fontFamily: grotesk, fontSize: 32, fontWeight: '900', marginTop: 16, letterSpacing: 2 }}>{result.isCorrect ? 'DAILY CONQUERED' : 'SYSTEM OVERLOAD'}</Text>
              <View style={{ marginTop: 22, padding: 18, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', width: '100%', alignItems: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 10, marginBottom: 8, letterSpacing: 2, fontWeight: '700' }}>CORRECT DECRYPTION KEY</Text>
                <Text style={{ color: result.isCorrect ? Colors.emerald : '#fca5a5', fontFamily: 'Chakra Petch', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>{result.correctAnswer}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, paddingVertical: 18, paddingHorizontal: 36, borderRadius: 14, backgroundColor: (result.coinsChange??0) > 0 ? accent + '08' : Colors.rose + '08', borderWidth: 1.5, borderColor: (result.coinsChange??0) > 0 ? accent + '35' : Colors.rose + '35' }}>
                <Icons.IntelIcon size={22} color={(result.coinsChange??0)>0 ? accent : Colors.rose} />
                <Text style={{ color: (result.coinsChange??0)>0 ? accent : Colors.rose, fontFamily: mono, fontSize: 34, fontWeight: '900' }}>{(result.coinsChange??0)>0?'+':''}{result.coinsChange}</Text>
              </View>
              <TouchableOpacity style={[{ backgroundColor: '#fff', paddingVertical: 16, borderRadius: 12, alignSelf: 'stretch', alignItems: 'center', marginTop: 28 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => go('home')}>
                <Text style={{ color: '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>RETURN TO HUB →</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
