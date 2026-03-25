import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';

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

  if (done) return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:Colors.bgBase, padding:40 }}>
      {score>=8 ? <Icons.TrophyIcon size={80} color={Colors.gold} /> : score>=5 ? <Icons.TargetIcon size={80} color={Colors.emerald} /> : <Icons.AlertTriangleIcon size={80} color={Colors.rose} />}
      <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:42, fontWeight:'900', marginTop:24, textAlign:'center', letterSpacing:2 }}>GAUNTLET COMPLETE</Text>
      <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:20, marginTop:12, letterSpacing:1 }}>{score}/{TOTAL} SEQUENCES CRACKED</Text>
      <Text style={{ color:score>=8?Colors.gold:score>=5?Colors.emerald:Colors.rose, fontFamily:'Chakra Petch', fontSize:24, fontWeight:'900', marginTop:16, letterSpacing:2 }}>{score>=8?'LEGENDARY OPERATIVE':score>=5?'SOLID FIELD RUN':'ADDITIONAL TRAINING REQUIRED'}</Text>
      <TouchableOpacity style={{ backgroundColor:'rgba(15,15,26,0.6)', paddingVertical:18, paddingHorizontal:48, borderRadius:10, borderWidth:1, borderColor:Colors.borderDefault, marginTop:48}} onPress={() => go('home')}>
        <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontWeight:'900', fontSize:14, letterSpacing:1.5 }}>RETURN TO HUB</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}>
      <View style={{ height:64, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:24, backgroundColor:'rgba(15,15,26,0.9)', borderBottomWidth:1, borderColor:Colors.borderDefault}}>
        <TouchableOpacity style={{ flexDirection:'row', alignItems:'center', gap:6, paddingVertical:8, paddingHorizontal:14, borderRadius:8, backgroundColor:Colors.bgBase, borderWidth:1, borderColor:Colors.borderDefault }} onPress={() => go('home')}>
          <Icons.ChevronLeftIcon size={12} color={Colors.purpleLight} />
          <Text style={{ color:Colors.purpleLight, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>ABORT</Text>
        </TouchableOpacity>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16, paddingVertical:8, borderRadius:8, backgroundColor:Colors.rose+'15', borderWidth:1, borderColor:Colors.rose+'35' }}>
          <Icons.SwordsIcon size={14} color={Colors.rose} />
          <Text style={{ color:Colors.rose, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>GAUNTLET {count+1}/{TOTAL}</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:8, backgroundColor:Colors.gold+'10', borderWidth:1, borderColor:Colors.gold+'30' }}>
          <Icons.TargetIcon size={14} color={Colors.gold} />
          <Text style={{ color:Colors.gold, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:14 }}>{score} PTS</Text>
        </View>
      </View>
      <View style={{ height:3, backgroundColor:Colors.borderDefault }}><View style={{ width:`${(count/TOTAL)*100}%`, height:3, backgroundColor:Colors.rose }} /></View>

      {loading ? <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator size="large" color={Colors.rose} /><Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', marginTop:16, letterSpacing:2 }}>LOADING NODE {count+1}...</Text></View> : (
        <ScrollView contentContainerStyle={{ maxWidth:700, alignSelf:'center', width:'100%', padding:32, paddingBottom:64 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:14, marginBottom:24 }}>
            <View style={{ flex:1, height:4, backgroundColor:Colors.borderDefault, borderRadius:2, overflow:'hidden' }}><View style={{ width:`${(timeLeft/20)*100}%`, height:4, backgroundColor:timeLeft>8?Colors.rose:Colors.orange, borderRadius:2 }} /></View>
            <Text style={{ color:timeLeft>8?Colors.rose:Colors.orange, fontWeight:'900', fontSize:22, fontFamily:'Share Tech Mono', minWidth:56, textAlign:'right' }}>{timeLeft}s</Text>
          </View>
          
          <View style={{ backgroundColor:'rgba(15,15,26,0.6)', borderRadius:16, padding:32, borderWidth:1.5, borderColor:Colors.borderDefault, marginBottom:24}}>
            <Text style={{ color:Colors.textPrimary, fontFamily:'Cormorant Garamond', fontSize:24, fontWeight:'700', lineHeight:34 }}>{riddle?.question}</Text>
          </View>
          
          {riddle?.options?.map((opt, i) => {
            const right = result && opt === result.correctAnswer;
            const wrong = result && opt === selected && !result.isCorrect;
            return (
              <TouchableOpacity key={i} style={{ flexDirection:'row', alignItems:'center', gap:16, padding:20, borderRadius:12, marginBottom:12, backgroundColor:right?Colors.emerald+'15':wrong?Colors.rose+'15':'rgba(15,15,26,0.6)', borderWidth:1.5, borderColor:right?Colors.emerald+'60':wrong?Colors.rose+'60':Colors.borderDefault}} onPress={() => !result && !selected && autoSubmit(opt)} disabled={!!result||!!selected} activeOpacity={0.7}>
                <View style={{ width:42, height:42, borderRadius:10, alignItems:'center', justifyContent:'center', backgroundColor:right?Colors.emerald:wrong?Colors.rose:Colors.bgBase, borderWidth:1, borderColor:right?Colors.emerald:wrong?Colors.rose:Colors.borderDefault }}><Text style={{ color:right||wrong?'#000':Colors.textSecondary, fontFamily:'Share Tech Mono', fontWeight:'900', fontSize:16 }}>{['A','B','C','D'][i]}</Text></View>
                <Text style={{ flex:1, color:right?Colors.emerald:wrong?'#fca5a5':Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:17, fontWeight:'600', letterSpacing:0.5 }}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
          
          {result && (
            <View style={{ padding:20, borderRadius:12, backgroundColor:result.isCorrect?Colors.emerald+'15':Colors.rose+'15', marginTop:12, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:12, borderWidth:1, borderColor:result.isCorrect?Colors.emerald+'40':Colors.rose+'40'}}>
              {result.isCorrect ? <Icons.TargetIcon size={24} color={Colors.emerald} /> : <Icons.XIcon size={24} color={Colors.rose} />}
              <Text style={{ color:result.isCorrect?Colors.emerald:Colors.rose, fontFamily:'Chakra Petch', fontWeight:'900', fontSize:20, letterSpacing:1 }}>{result.isCorrect?`CRACKED! +${result.coinsChange} CR`:'FAILED — NEXT NODE!'}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
