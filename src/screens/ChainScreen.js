import React, { useState } from 'react';
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

export default function ChainScreen({ user, go, update }) {
  const [phase, setPhase] = useState('intro');
  const [chainData, setChainData] = useState(null);
  const [currentRiddle, setCurrentRiddle] = useState(null);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [totalCoins, setTotalCoins] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const accent = Colors.emerald;

  async function startChain() {
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${BACKEND}/chain/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, city:user.city, area:user.area, xp:user.xp||0 }) });
      const data = await res.json();
      if (data.success) { setChainData(data); setCurrentRiddle(data.riddle); setPhase('playing'); }
    } catch { setErr('Connection error'); }
    setLoading(false);
  }

  async function submitAnswer(ans) {
    if (result) return; setSelected(ans);
    try {
      const res = await fetch(`${BACKEND}/chain/answer`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, chainId:chainData.chainId, step, riddleId:currentRiddle.id, userAnswer:ans }) });
      const data = await res.json(); setResult(data);
      if (data.isCorrect) {
        setTotalCoins(c => c + data.coinsEarned); update({...user, coins:(user.coins||0)+data.coinsEarned});
        if (data.completed) setTimeout(() => setPhase('done'), 1200);
        else setTimeout(() => { setStep(data.nextStep); setCurrentRiddle({...currentRiddle, question:'(Loading next link...)', options:[]}); setSelected(null); setResult(null); }, 1500);
      }
    } catch { setErr('Error submitting sequence'); }
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
        <Icons.LinkIcon size={14} color={accent} />
        <Text style={{ color: accent, fontFamily: mono, fontWeight: '900', fontSize: 12, letterSpacing: 2 }}>THE CHAIN {phase==='playing'?`${step+1}/5`:''}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.gold+'10', borderWidth: 1, borderColor: Colors.gold+'30' }}>
        <Icons.IntelIcon size={14} color={Colors.gold} />
        <Text style={{ color: Colors.gold, fontFamily: mono, fontWeight: '800', fontSize: 14 }}>{totalCoins}</Text>
      </View>
    </View>
  );

  if (phase === 'intro') return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      <TopBar />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, maxWidth: 560, alignSelf: 'center' }}>
        <Icons.LinkIcon size={64} color={accent} />
        <Text style={{ color: Colors.textPrimary, fontFamily: grotesk, fontSize: 32, fontWeight: '900', marginTop: 24, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' }}>The Chain</Text>
        <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 22 }}>5 decryption sequences linked together. Each correct node unlocks the next. Fall short, and the chain breaks. Secure all 5 nodes for a 250 credit yield.</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 40 }}>
          {[1,2,3,4,5].map(i => (
            <View key={i} style={[{ width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' }, isWeb ? { backgroundColor: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(8px)' } : { backgroundColor: 'rgba(255,255,255,0.02)' }]}>
              <Text style={{ color: Colors.textMuted, fontFamily: mono, fontWeight: '800', fontSize: 16 }}>{i}</Text>
            </View>
          ))}
        </View>
        {err ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24, backgroundColor: Colors.rose+'15', padding: 10, borderRadius: 8 }}><Icons.AlertTriangleIcon size={14} color={Colors.rose} /><Text style={{ color: Colors.rose, fontFamily: mono, fontWeight: '700', fontSize: 12 }}>{err}</Text></View> : null}
        <TouchableOpacity style={[{ backgroundColor: '#fff', paddingVertical: 18, paddingHorizontal: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 48, opacity: loading?0.5:1 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={startChain} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <><Icons.TerminalIcon size={18} color={'#000'} /><Text style={{ color: '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 }}>INITIALIZE LINK 1 →</Text></>}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (phase === 'done') return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      <TopBar />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Icons.TargetIcon size={80} color={Colors.gold} />
        <Text style={{ color: Colors.gold, fontFamily: grotesk, fontSize: 42, fontWeight: '900', marginTop: 24, letterSpacing: 2 }}>CHAIN SECURED</Text>
        <Text style={{ color: Colors.textSecondary, fontFamily: mono, marginTop: 16, fontSize: 16, letterSpacing: 1 }}>ALL 5 NODES DECRYPTED SUCCESSFULLY.</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 32, backgroundColor: Colors.gold+'15', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.gold+'40' }}>
          <Icons.IntelIcon size={24} color={Colors.gold} />
          <Text style={{ color: Colors.gold, fontFamily: mono, fontSize: 36, fontWeight: '900' }}>+{totalCoins}</Text>
        </View>
        <TouchableOpacity style={[{ paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)', marginTop: 48 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={() => go('home')}>
          <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>RETURN TO HUB</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      <TopBar />
      <ScrollView contentContainerStyle={{ maxWidth: 740, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Chain progress */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
          {[1,2,3,4,5].map(i => <View key={i} style={[{ flex: 1, height: 6, borderRadius: 3 }, isWeb ? { backgroundColor: i<=step ? accent : 'rgba(255,255,255,0.05)', transition: 'background-color 0.5s ease' } : { backgroundColor: i<=step ? accent : 'rgba(255,255,255,0.05)' }]} />)}
        </View>

        {/* Question */}
        <View style={[{ backgroundColor: 'rgba(10,10,12,0.8)', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 24, position: 'relative', overflow: 'hidden' }, isWeb ? { backdropFilter: 'blur(24px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' } : {}]}>
          <CornerBrackets />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icons.LinkIcon size={12} color={accent} />
              <Text style={{ fontFamily: mono, fontSize: 10, color: accent, letterSpacing: 2, textTransform: 'uppercase' }}>Chain Link // Node {step+1}</Text>
            </View>
            <Text style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>LINK_{(step+1).toString().padStart(2,'0')}</Text>
          </View>
          <Text style={{ color: Colors.textPrimary, fontFamily: 'Cormorant Garamond', fontSize: 24, fontWeight: '700', lineHeight: 34 }}>{currentRiddle?.question}</Text>
        </View>

        {/* Options */}
        {currentRiddle?.options?.map((opt, i) => {
          const right = result && opt === result.correctAnswer;
          const wrong = result && opt === selected && !result.isCorrect;
          return (
            <TouchableOpacity key={i} style={[{
              flexDirection: 'row', alignItems: 'center', gap: 16,
              padding: 18, borderRadius: 12, marginBottom: 10,
              backgroundColor: right?Colors.emerald+'12':wrong?Colors.rose+'12':'rgba(255,255,255,0.02)',
              borderWidth: 1.5, borderColor: right?Colors.emerald+'55':wrong?Colors.rose+'55':'rgba(255,255,255,0.07)'
            }, isWeb ? { transition: 'all 0.2s ease', cursor: 'pointer' } : {}]} onPress={() => !result && submitAnswer(opt)} disabled={!!result} activeOpacity={0.7}>
              <View style={{ width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: right?Colors.emerald:wrong?Colors.rose:'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: right?Colors.emerald:wrong?Colors.rose:'rgba(255,255,255,0.1)' }}>
                <Text style={{ color: right||wrong?'#000':Colors.textMuted, fontFamily: mono, fontWeight: '900', fontSize: 15 }}>{['A','B','C','D'][i]}</Text>
              </View>
              <Text style={{ flex: 1, color: right?Colors.emerald:wrong?'#fca5a5':Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 }}>{opt}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Chain broken */}
        {result && !result.isCorrect && (
          <View style={[{ marginTop: 24, alignItems: 'center', padding: 32, borderRadius: 24, borderWidth: 2, borderColor: Colors.rose+'40', position: 'relative', overflow: 'hidden' }, isWeb ? { backgroundColor: 'rgba(10,10,12,0.8)', backdropFilter: 'blur(24px)' } : { backgroundColor: 'rgba(10,10,12,0.8)' }]}>
            <CornerBrackets />
            <Icons.XIcon size={48} color={Colors.rose} />
            <Text style={{ color: Colors.rose, fontFamily: grotesk, fontWeight: '900', fontSize: 28, textAlign: 'center', marginTop: 16, letterSpacing: 1 }}>CHAIN COMPROMISED!</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 14, marginTop: 12 }}>CORRECT NODE SEQUENCE:</Text>
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 20, fontWeight: '900', marginTop: 6 }}>{result.correctAnswer}</Text>
            <TouchableOpacity style={[{ backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 32 }, isWeb ? { cursor: 'pointer' } : {}]} onPress={startChain}>
              <Icons.ZapIcon size={16} color="#000" />
              <Text style={{ color: '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>RE-INITIALIZE SEQUENCE</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Node secured */}
        {result && result.isCorrect && !result.completed && (
          <View style={{ marginTop: 24, padding: 24, borderRadius: 16, backgroundColor: Colors.emerald+'12', alignItems: 'center', borderWidth: 1, borderColor: Colors.emerald+'40' }}>
            <Icons.TargetIcon size={32} color={Colors.emerald} />
            <Text style={{ color: Colors.emerald, fontFamily: grotesk, fontWeight: '900', fontSize: 20, marginTop: 12, letterSpacing: 1 }}>NODE {step+1} SECURED! +{result.coinsEarned} CR</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: mono, marginTop: 8, fontSize: 12, letterSpacing: 1 }}>ESTABLISHING NEXT LINK...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
