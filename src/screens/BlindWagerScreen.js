import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';

export default function BlindWagerScreen({ user, go, update }) {
  const [phase, setPhase] = useState('bet');
  const [wager, setWager] = useState(50);
  const [riddle, setRiddle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef(null);

  async function placeBet() {
    if (wager < 10) { alert('Minimum stake is 10 coins'); return; }
    if (wager > (user.coins||0)) { alert(`Insufficient funds. You have ${user.coins||0} coins.`); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/riddle`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, city:user.city, area:user.area, xp:user.xp||0 }) });
      const data = await res.json();
      if (data.success && data.riddle) { setRiddle(data.riddle); setPhase('reveal'); let t=data.riddle.timeLimit||30; setTimeLeft(t); timerRef.current=setInterval(()=>{t--;setTimeLeft(t);if(t<=0){clearInterval(timerRef.current);submitWager('__timeout__');}},1000); }
    } catch {} setLoading(false);
  }

  async function submitWager(ans) {
    if (result) return; clearInterval(timerRef.current); setSelected(ans);
    try {
      const ansRes = await fetch(`${BACKEND}/answer`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, riddleId:riddle.id, userAnswer:ans, timeTaken:(riddle?.timeLimit||30)-timeLeft, mode:'mcq' }) });
      const ansData = await ansRes.json(); setResult(ansData);
      await fetch(`${BACKEND}/wager/settle`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, wageredCoins:wager, isCorrect:ansData.isCorrect }) });
      const newCoins = (user.coins||0) + (ansData.isCorrect ? wager : -wager);
      update({...user, coins:Math.max(0,newCoins), xp:ansData.newXp, level:ansData.newLevel}); setPhase('done');
    } catch {}
  }

  const TopBar = () => (
    <View style={{ height:64, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:24, backgroundColor:'rgba(15,15,26,0.9)', borderBottomWidth:1, borderColor:Colors.borderDefault}}>
      <TouchableOpacity style={{ flexDirection:'row', alignItems:'center', gap:6, paddingVertical:8, paddingHorizontal:14, borderRadius:8, backgroundColor:Colors.bgBase, borderWidth:1, borderColor:Colors.borderDefault }} onPress={() => go('home')}>
        <Icons.ChevronLeftIcon size={12} color={Colors.purpleLight} />
        <Text style={{ color:Colors.purpleLight, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>HUB</Text>
      </TouchableOpacity>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16, paddingVertical:8, borderRadius:8, backgroundColor:Colors.fuchsia+'15', borderWidth:1, borderColor:Colors.fuchsia+'35' }}>
        <Icons.SwordsIcon size={14} color={Colors.fuchsia} />
        <Text style={{ color:Colors.fuchsia, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>BLIND WAGER</Text>
      </View>
      <View style={{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:8, backgroundColor:Colors.gold+'10', borderWidth:1, borderColor:Colors.gold+'30' }}>
        <Icons.CoinIcon size={14} color={Colors.gold} />
        <Text style={{ color:Colors.gold, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:14 }}>{user?.coins||0}</Text>
      </View>
    </View>
  );

  if (phase === 'bet') return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}>
      <TopBar />
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:40, maxWidth:520, alignSelf:'center' }}>
        <Icons.ShieldIcon size={64} color={Colors.fuchsia} />
        <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:32, fontWeight:'900', marginTop:24, textAlign:'center', letterSpacing:1, textTransform:'uppercase' }}>Assess the Risk</Text>
        <Text style={{ color:Colors.textSecondary, fontFamily:'Cormorant Garamond', fontSize:18, marginTop:12, textAlign:'center', lineHeight:26, fontStyle:'italic' }}>You operate blind. The sequence is unknown until the wager is locked. Choose your stake.</Text>
        <View style={{ flexDirection:'row', gap:12, marginTop:40, flexWrap:'wrap', justifyContent:'center' }}>
          {[25,50,100,250,500].map(v => (
            <TouchableOpacity key={v} style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:24, paddingVertical:16, borderRadius:12, backgroundColor:wager===v?Colors.fuchsia+'20':'rgba(15,15,26,0.6)', borderWidth:1.5, borderColor:wager===v?Colors.fuchsia:Colors.borderDefault}} onPress={() => setWager(v)}>
              <Icons.CoinIcon size={16} color={wager===v?Colors.fuchsia:Colors.textSecondary} />
              <Text style={{ color:wager===v?Colors.fuchsia:Colors.textSecondary, fontFamily:'Share Tech Mono', fontWeight:'900', fontSize:16 }}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={{ backgroundColor:Colors.fuchsia, paddingVertical:18, paddingHorizontal:56, borderRadius:10, flexDirection:'row', alignItems:'center', gap:10, marginTop:48, opacity:loading?0.5:1 }} onPress={placeBet} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <><Icons.TerminalIcon size={18} color={'#fff'} /><Text style={{ color:'#fff', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:15, letterSpacing:1.5 }}>DECRYPT SEQUENCE →</Text></>}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (phase === 'done' && result) return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}>
      <TopBar />
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:40 }}>
        {result.isCorrect ? <Icons.TargetIcon size={80} color={Colors.gold} /> : <Icons.XIcon size={80} color={Colors.rose} />}
        
        <Text style={{ color:result.isCorrect?Colors.gold:Colors.rose, fontFamily:'Chakra Petch', fontSize:36, fontWeight:'900', marginTop:24, textAlign:'center', letterSpacing:2 }}>{result.isCorrect?`YIELD: +${wager}`:`COMPROMISED: -${wager}`}</Text>
        <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:14, marginTop:16, letterSpacing:1.5 }}>CORRECT DECRYPTION KEY:</Text>
        <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:24, fontWeight:'900', marginTop:8 }}>{result.correctAnswer}</Text>
        
        <View style={{ flexDirection:'row', gap:16, marginTop:48 }}>
          <TouchableOpacity style={{ backgroundColor:Colors.fuchsia, paddingVertical:16, paddingHorizontal:36, borderRadius:10, flexDirection:'row', alignItems:'center', gap:8}} onPress={() => {setPhase('bet');setRiddle(null);setResult(null);setSelected(null);setTimeLeft(30);}}>
            <Icons.ZapIcon size={16} color={'#fff'} />
            <Text style={{ color:'#fff', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:14, letterSpacing:1.5 }}>RE-ENGAGE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ backgroundColor:'rgba(15,15,26,0.6)', paddingVertical:16, paddingHorizontal:36, borderRadius:10, borderWidth:1, borderColor:Colors.borderDefault}} onPress={() => go('home')}>
            <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontWeight:'800', fontSize:14, letterSpacing:1 }}>ABORT TO HUB</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Gameplay
  return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}>
      <TopBar />
      <ScrollView contentContainerStyle={{ maxWidth:700, alignSelf:'center', width:'100%', padding:32, paddingBottom:64 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor:Colors.fuchsia+'10', borderRadius:12, padding:20, marginBottom:24, flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderWidth:1, borderColor:Colors.fuchsia+'35'}}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <Icons.CoinIcon size={16} color={Colors.fuchsia} />
            <Text style={{ color:Colors.fuchsia, fontFamily:'Share Tech Mono', fontWeight:'900', fontSize:16 }}>STAKE: {wager}</Text>
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <Icons.TimerIcon size={16} color={timeLeft<10?Colors.rose:Colors.fuchsia} />
            <Text style={{ color:timeLeft<10?Colors.rose:Colors.fuchsia, fontFamily:'Share Tech Mono', fontWeight:'900', fontSize:18 }}>{timeLeft}s</Text>
          </View>
        </View>
        
        <View style={{ backgroundColor:'rgba(15,15,26,0.6)', borderRadius:16, padding:32, borderWidth:1.5, borderColor:Colors.borderDefault, marginBottom:24}}>
          <Text style={{ color:Colors.textPrimary, fontFamily:'Cormorant Garamond', fontSize:24, fontWeight:'700', lineHeight:34 }}>{riddle?.question}</Text>
        </View>
        
        {riddle?.options?.map((opt, i) => {
          const right=result&&opt===result.correctAnswer; const wrong=result&&opt===selected&&!result.isCorrect;
          const picked = !result && selected === opt;
          return (
            <TouchableOpacity key={i} style={{ flexDirection:'row', alignItems:'center', gap:16, padding:20, borderRadius:12, marginBottom:12, backgroundColor:right?Colors.emerald+'15':wrong?Colors.rose+'15':'rgba(15,15,26,0.6)', borderWidth:1.5, borderColor:right?Colors.emerald+'60':wrong?Colors.rose+'60':picked?Colors.fuchsia+'50':Colors.borderDefault}} onPress={() => !result&&!selected&&submitWager(opt)} disabled={!!result||!!selected} activeOpacity={0.7}>
              <View style={{ width:42, height:42, borderRadius:10, alignItems:'center', justifyContent:'center', backgroundColor:right?Colors.emerald:wrong?Colors.rose:Colors.bgBase, borderWidth:1, borderColor:right?Colors.emerald:wrong?Colors.rose:Colors.borderDefault }}><Text style={{ color:right||wrong?'#000':Colors.textSecondary, fontFamily:'Share Tech Mono', fontWeight:'900', fontSize:16 }}>{['A','B','C','D'][i]}</Text></View>
              <Text style={{ flex:1, color:right?Colors.emerald:wrong?'#fca5a5':Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:17, fontWeight:'600', letterSpacing:0.5 }}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
