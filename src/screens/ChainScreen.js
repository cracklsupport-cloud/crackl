import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';

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
    <View style={{ height:64, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:24, backgroundColor:'rgba(15,15,26,0.9)', borderBottomWidth:1, borderColor:Colors.borderDefault}}>
      <TouchableOpacity style={{ flexDirection:'row', alignItems:'center', gap:6, paddingVertical:8, paddingHorizontal:14, borderRadius:8, backgroundColor:Colors.bgBase, borderWidth:1, borderColor:Colors.borderDefault }} onPress={() => go('home')}>
        <Icons.ChevronLeftIcon size={12} color={Colors.purpleLight} />
        <Text style={{ color:Colors.purpleLight, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>HUB</Text>
      </TouchableOpacity>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16, paddingVertical:8, borderRadius:8, backgroundColor:Colors.emerald+'15', borderWidth:1, borderColor:Colors.emerald+'35' }}>
        <Icons.LinkIcon size={14} color={Colors.emerald} />
        <Text style={{ color:Colors.emerald, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>THE CHAIN {phase==='playing'?`${step+1}/5`:''}</Text>
      </View>
      <View style={{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:8, backgroundColor:Colors.gold+'10', borderWidth:1, borderColor:Colors.gold+'30' }}>
        <Icons.IntelIcon size={14} color={Colors.gold} />
        <Text style={{ color:Colors.gold, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:14 }}>{totalCoins}</Text>
      </View>
    </View>
  );

  if (phase === 'intro') return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}>
      <TopBar />
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:40, maxWidth:560, alignSelf:'center' }}>
        <Icons.LinkIcon size={64} color={Colors.emerald} />
        <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:32, fontWeight:'900', marginTop:24, textAlign:'center', letterSpacing:1, textTransform:'uppercase' }}>The Chain</Text>
        <Text style={{ color:Colors.textSecondary, fontFamily:'Cormorant Garamond', fontSize:18, marginTop:12, textAlign:'center', lineHeight:26, fontStyle:'italic' }}>5 decryption sequences linked together. Each correct node unlocks the next. Fall short, and the chain breaks. Secure all 5 nodes for a 250 credit yield.</Text>
        <View style={{ flexDirection:'row', gap:10, marginTop:40 }}>
          {[1,2,3,4,5].map(i => (
            <View key={i} style={{ width:48, height:48, borderRadius:12, backgroundColor:'rgba(15,15,26,0.6)', alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor:Colors.borderDefault}}>
              <Text style={{ color:Colors.textMuted, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:16 }}>{i}</Text>
            </View>
          ))}
        </View>
        {err ? <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:24, backgroundColor:Colors.rose+'15', padding:10, borderRadius:8 }}><Icons.AlertTriangleIcon size={14} color={Colors.rose} /><Text style={{ color:Colors.rose, fontFamily:'Share Tech Mono', fontWeight:'700', fontSize:12 }}>{err}</Text></View> : null}
        <TouchableOpacity style={{ backgroundColor:Colors.emerald, paddingVertical:18, paddingHorizontal:56, borderRadius:10, flexDirection:'row', alignItems:'center', gap:10, marginTop:48, opacity:loading?0.5:1 }} onPress={startChain} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <><Icons.TerminalIcon size={18} color={'#000'} /><Text style={{ color:'#000', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:15, letterSpacing:1.5 }}>INITIALIZE LINK 1 →</Text></>}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (phase === 'done') return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}>
      <TopBar />
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:40 }}>
        <Icons.TargetIcon size={80} color={Colors.gold} />
        <Text style={{ color:Colors.gold, fontFamily:'Chakra Petch', fontSize:42, fontWeight:'900', marginTop:24, letterSpacing:2 }}>CHAIN SECURED</Text>
        <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', marginTop:16, fontSize:16, letterSpacing:1 }}>ALL 5 NODES DECRYPTED SUCCESSFULLY.</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginTop:32, backgroundColor:Colors.gold+'15', paddingHorizontal:32, paddingVertical:16, borderRadius:12, borderWidth:1, borderColor:Colors.gold+'40' }}>
          <Icons.IntelIcon size={24} color={Colors.gold} />
          <Text style={{ color:Colors.gold, fontFamily:'Share Tech Mono', fontSize:36, fontWeight:'900' }}>+{totalCoins}</Text>
        </View>
        <TouchableOpacity style={{ backgroundColor:'rgba(15,15,26,0.6)', paddingVertical:18, paddingHorizontal:48, borderRadius:10, borderWidth:1, borderColor:Colors.borderDefault, marginTop:48}} onPress={() => go('home')}>
          <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontWeight:'900', fontSize:14, letterSpacing:1.5 }}>RETURN TO HUB</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}>
      <TopBar />
      <ScrollView contentContainerStyle={{ maxWidth:700, alignSelf:'center', width:'100%', padding:32, paddingBottom:64 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection:'row', gap:8, marginBottom:24 }}>
          {[1,2,3,4,5].map(i => <View key={i} style={{ flex:1, height:6, borderRadius:3, backgroundColor:i<=step?Colors.emerald:Colors.borderDefault }} />)}
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:16 }}>
          <Icons.LinkIcon size={16} color={Colors.emerald} />
          <Text style={{ color:Colors.emerald, fontFamily:'Share Tech Mono', fontWeight:'900', fontSize:12, letterSpacing:2 }}>NODE {step+1} OF 5</Text>
        </View>
        
        <View style={{ backgroundColor:'rgba(15,15,26,0.6)', borderRadius:16, padding:32, borderWidth:1.5, borderColor:Colors.borderDefault, marginBottom:24}}>
          <Text style={{ color:Colors.textPrimary, fontFamily:'Cormorant Garamond', fontSize:24, fontWeight:'700', lineHeight:34 }}>{currentRiddle?.question}</Text>
        </View>
        
        {currentRiddle?.options?.map((opt, i) => {
          const right = result && opt === result.correctAnswer; const wrong = result && opt === selected && !result.isCorrect;
          return (
            <TouchableOpacity key={i} style={{ flexDirection:'row', alignItems:'center', gap:16, padding:20, borderRadius:12, marginBottom:12, backgroundColor:right?Colors.emerald+'15':wrong?Colors.rose+'15':'rgba(15,15,26,0.6)', borderWidth:1.5, borderColor:right?Colors.emerald+'60':wrong?Colors.rose+'60':Colors.borderDefault}} onPress={() => !result && submitAnswer(opt)} disabled={!!result} activeOpacity={0.7}>
              <View style={{ width:42, height:42, borderRadius:10, alignItems:'center', justifyContent:'center', backgroundColor:right?Colors.emerald:wrong?Colors.rose:Colors.bgBase, borderWidth:1, borderColor:right?Colors.emerald:wrong?Colors.rose:Colors.borderDefault }}><Text style={{ color:right||wrong?'#000':Colors.textSecondary, fontFamily:'Share Tech Mono', fontWeight:'900', fontSize:16 }}>{['A','B','C','D'][i]}</Text></View>
              <Text style={{ flex:1, color:right?Colors.emerald:wrong?'#fca5a5':Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:17, fontWeight:'600', letterSpacing:0.5 }}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
        {result && !result.isCorrect && (
          <View style={{ marginTop:24, alignItems:'center', backgroundColor:'rgba(15,15,26,0.8)', padding:32, borderRadius:16, borderWidth:2, borderColor:Colors.rose+'50'}}>
            <Icons.XIcon size={48} color={Colors.rose} />
            <Text style={{ color:Colors.rose, fontFamily:'Chakra Petch', fontWeight:'900', fontSize:28, textAlign:'center', marginTop:16, letterSpacing:1 }}>CHAIN COMPROMISED!</Text>
            <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:14, marginTop:12 }}>CORRECT NODE SEQUENCE:</Text>
            <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:20, fontWeight:'900', marginTop:6 }}>{result.correctAnswer}</Text>
            <TouchableOpacity style={{ backgroundColor:Colors.emerald, paddingVertical:16, paddingHorizontal:48, borderRadius:10, flexDirection:'row', alignItems:'center', gap:10, marginTop:32}} onPress={startChain}>
              <Icons.ZapIcon size={16} color="#000" />
              <Text style={{ color:'#000', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:14, letterSpacing:1.5 }}>RE-INITIALIZE SEQUENCE</Text>
            </TouchableOpacity>
          </View>
        )}
        {result && result.isCorrect && !result.completed && (
          <View style={{ marginTop:24, padding:24, borderRadius:16, backgroundColor:Colors.emerald+'12', alignItems:'center', borderWidth:1, borderColor:Colors.emerald+'40'}}>
            <Icons.TargetIcon size={32} color={Colors.emerald} />
            <Text style={{ color:Colors.emerald, fontFamily:'Chakra Petch', fontWeight:'900', fontSize:20, marginTop:12, letterSpacing:1 }}>NODE {step+1} SECURED! +{result.coinsEarned} CR</Text>
            <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', marginTop:8, fontSize:12, letterSpacing:1 }}>ESTABLISHING NEXT LINK...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
