import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';

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

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgBase }}>
      <View style={{ height:64, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:24, backgroundColor:'rgba(15,15,26,0.9)', borderBottomWidth:1, borderColor:Colors.borderDefault}}>
        <TouchableOpacity style={{ flexDirection:'row', alignItems:'center', gap:6, paddingVertical:8, paddingHorizontal:14, borderRadius:8, backgroundColor:Colors.bgBase, borderWidth:1, borderColor:Colors.borderDefault }} onPress={() => go('home')}>
          <Icons.ChevronLeftIcon size={12} color={Colors.purpleLight} />
          <Text style={{ color:Colors.purpleLight, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>HUB</Text>
        </TouchableOpacity>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16, paddingVertical:8, borderRadius:8, backgroundColor:Colors.gold+'15', borderWidth:1, borderColor:Colors.gold+'35' }}>
          <Icons.SunIcon size={14} color={Colors.gold} />
          <Text style={{ color:Colors.gold, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>DAILY DROP</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => go('blackmarket')} style={{ backgroundColor: 'rgba(15,15,26,0.6)', width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: Colors.borderDefault, alignItems: 'center', justifyContent: 'center'}}>
            <Icons.DatabaseIcon size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:8, backgroundColor:Colors.orange+'15', borderWidth:1, borderColor:Colors.orange+'30' }}>
            <Icons.ZapIcon size={14} color={Colors.orange} />
            <Text style={{ color:Colors.orange, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:14 }}>{dailyStreak} COMBO</Text>
          </View>
        </View>
      </View>

      {loading ? <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator size="large" color={Colors.gold} /><Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', marginTop:24, letterSpacing:2 }}>DECRYPTING TODAY'S DROP...</Text></View>
      : alreadyPlayed ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:40 }}>
          <Icons.TargetIcon size={80} color={Colors.emerald} />
          <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:36, fontWeight:'900', marginTop:24, textAlign:'center', letterSpacing:1 }}>SYSTEM CLEARED</Text>
          <Text style={{ color:Colors.textSecondary, fontFamily:'Cormorant Garamond', fontSize:18, marginTop:12, textAlign:'center', lineHeight:26, fontStyle:'italic' }}>You've already processed today's sequence. Return in 24 hours to maintain your <Text style={{ color:Colors.orange, fontWeight:'700' }}>{dailyStreak}</Text> day combo.</Text>
          <TouchableOpacity style={{ backgroundColor:'rgba(15,15,26,0.6)', paddingVertical:18, paddingHorizontal:48, borderRadius:10, borderWidth:1, borderColor:Colors.borderDefault, marginTop:40}} onPress={() => go('home')}>
            <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontWeight:'900', fontSize:14, letterSpacing:1.5 }}>RETURN TO HUB</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ maxWidth:700, alignSelf:'center', width:'100%', padding:32, paddingBottom:64 }} showsVerticalScrollIndicator={false}>
          {!result && (
            <View style={{ flexDirection:'row', alignItems:'center', gap:14, marginBottom:28 }}>
              <View style={{ flex:1, height:4, backgroundColor:Colors.borderDefault, borderRadius:2, overflow:'hidden' }}><View style={{ width:`${tPct*100}%`, height:4, backgroundColor:tCol, borderRadius:2 }} /></View>
              <Text style={{ color:tCol, fontWeight:'900', fontSize:22, fontFamily:'Share Tech Mono', minWidth:56, textAlign:'right' }}>{timeLeft}s</Text>
            </View>
          )}
          
          <View style={{ backgroundColor:'rgba(15,15,26,0.6)', borderRadius:16, padding:32, borderWidth:1.5, borderColor:Colors.gold+'35', marginBottom:24}}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:16 }}>
              <Icons.SunIcon size={16} color={Colors.gold} />
              <Text style={{ color:Colors.gold, fontFamily:'Chakra Petch', fontWeight:'900', fontSize:13, letterSpacing:2, textTransform:'uppercase' }}>Today's Directive</Text>
            </View>
            <Text style={{ color:Colors.textPrimary, fontFamily:'Cormorant Garamond', fontSize:24, fontWeight:'700', lineHeight:34 }}>{riddle?.question}</Text>
          </View>
          
          {riddle?.options?.map((opt, i) => {
            const right = result && opt === result.correctAnswer;
            const wrong = result && opt === selected && !result.isCorrect;
            const picked = !result && selected === opt;
            return (
              <TouchableOpacity key={i} style={{ flexDirection:'row', alignItems:'center', gap:16, padding:20, borderRadius:12, marginBottom:12, backgroundColor:right?Colors.emerald+'15':wrong?Colors.rose+'15':'rgba(15,15,26,0.6)', borderWidth:1.5, borderColor:right?Colors.emerald+'60':wrong?Colors.rose+'60':picked?Colors.gold+'50':Colors.borderDefault}} onPress={() => !result && !selected && submit(opt)} disabled={!!result||!!selected} activeOpacity={0.7}>
                <View style={{ width:42, height:42, borderRadius:10, alignItems:'center', justifyContent:'center', backgroundColor:right?Colors.emerald:wrong?Colors.rose:Colors.bgBase, borderWidth:1, borderColor:right?Colors.emerald:wrong?Colors.rose:Colors.borderDefault }}><Text style={{ color:right||wrong?'#000':Colors.textSecondary, fontFamily:'Share Tech Mono', fontWeight:'900', fontSize:16 }}>{['A','B','C','D'][i]}</Text></View>
                <Text style={{ flex:1, color:right?Colors.emerald:wrong?'#fca5a5':Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:17, fontWeight:'600', letterSpacing:0.5 }}>{opt}</Text>
                {right && <Icons.TargetIcon size={18} color={Colors.emerald} />}{wrong && <Icons.XIcon size={18} color={Colors.rose} />}
              </TouchableOpacity>
            );
          })}
          
          {result && (
            <View style={{ backgroundColor:'rgba(15,15,26,0.8)', borderRadius:18, padding:40, borderWidth:2, borderColor:result.isCorrect?Colors.gold+'50':Colors.rose+'50', alignItems:'center', marginTop:24}}>
              {result.isCorrect ? <Icons.SunIcon size={64} color={Colors.gold} /> : <Icons.AlertTriangleIcon size={64} color={Colors.rose} />}
              <Text style={{ color:result.isCorrect?Colors.gold:Colors.rose, fontFamily:'Chakra Petch', fontSize:32, fontWeight:'900', marginTop:20, letterSpacing:1 }}>{result.isCorrect ? 'DAILY CONQUERED' : 'SYSTEM OVERLOAD'}</Text>
              
              <View style={{ marginTop:24, padding:20, borderRadius:12, backgroundColor:'rgba(15,15,26,0.6)', borderWidth:1, borderColor:Colors.borderDefault, width:'100%', alignItems:'center' }}>
                <Text style={{ color:Colors.textMuted, fontFamily:'Share Tech Mono', fontSize:11, marginBottom:8, letterSpacing:1.5 }}>CORRECT DECRYPTION KEY</Text>
                <Text style={{ color:result.isCorrect?Colors.emerald:'#fca5a5', fontFamily:'Chakra Petch', fontSize:22, fontWeight:'900', textAlign:'center' }}>{result.correctAnswer}</Text>
              </View>
              
              <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginTop:32 }}>
                <Icons.IntelIcon size={24} color={result.coinsChange>0?Colors.gold:Colors.rose} />
                <Text style={{ color:result.coinsChange>0?Colors.gold:Colors.rose, fontFamily:'Share Tech Mono', fontSize:36, fontWeight:'900' }}>{result.coinsChange>0?'+':''}{result.coinsChange}</Text>
              </View>
              
              <TouchableOpacity style={{ backgroundColor:Colors.gold, paddingVertical:18, borderRadius:10, alignSelf:'stretch', flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, marginTop:40}} onPress={() => go('home')}>
                <Text style={{ color:'#000', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:15, letterSpacing:1.5 }}>RETURN TO HUB →</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
