import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';

export default function MultiRoomScreen({ user, go, room, update }) {
  const [players, setPlayers] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [riddle, setRiddle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const [allRes, setAllRes] = useState([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { pollRoom(); pollRef.current=setInterval(pollRoom,3000); return()=>{clearInterval(pollRef.current);clearInterval(timerRef.current);}; }, []);

  async function pollRoom() { try { const res=await fetch(`${BACKEND}/room/${room.id}`); const data=await res.json(); if(data.success){setRoomData(data.room);setPlayers(data.players||[]);} } catch{} }

  async function startGame() {
    setLoading(true);
    try { const res=await fetch(`${BACKEND}/room/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId:room.id,hostId:user.id,city:user.city,area:user.area})}); const data=await res.json();
      if(data.success){const t=data.riddle.timeLimit||30;setRiddle(data.riddle);setSelected(null);setResult(null);setTyped('');setAllRes([]);if(room.cfg?.timed!==false){setTimeLeft(t);tick(t);}}
    } catch{alert('Error starting sequence');} setLoading(false);
  }

  function tick(n){clearInterval(timerRef.current);let t=n;timerRef.current=setInterval(()=>{t--;setTimeLeft(t);if(t<=0){clearInterval(timerRef.current);submitAns('__timeout__');}},1000);}

  async function submitAns(ans) {
    if(selected)return;clearInterval(timerRef.current);
    const final=ans==='__timeout__'?(room.cfg?.mode==='type'?(typed.trim()||'__timeout__'):'__timeout__'):ans;setSelected(final);
    try{const res=await fetch(`${BACKEND}/room/answer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId:room.id,userId:user.id,userAnswer:final,timeTaken:(riddle?.timeLimit||30)-timeLeft})});const data=await res.json();
      if(data.success){setResult({isCorrect:data.isCorrect,correctAnswer:data.correctAnswer,coinsEarned:data.coinsEarned});setAllRes(data.players||[]);if(data.isCorrect)update({...user,coins:user.coins+data.coinsEarned});}
    }catch{}
  }

  async function giveUp(){try{const res=await fetch(`${BACKEND}/room/giveup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId:room.id,hostId:user.id})});const data=await res.json();if(data.success){clearInterval(timerRef.current);setResult({gaveUp:true,correctAnswer:data.correctAnswer});}}catch{}}

  async function nextRiddle(){
    setLoading(true);
    try{const res=await fetch(`${BACKEND}/room/next`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId:room.id,hostId:user.id,city:user.city,area:user.area})});const data=await res.json();
      if(data.success){const t=data.riddle.timeLimit||30;setRiddle(data.riddle);setSelected(null);setResult(null);setTyped('');setAllRes([]);if(room.cfg?.timed!==false){setTimeLeft(t);tick(t);}}
    }catch{} setLoading(false);
  }

  const isHost = room.isHost;

  const TopBar = () => (
    <View style={{ height:64, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:24, backgroundColor:'rgba(15,15,26,0.9)', borderBottomWidth:1, borderColor:Colors.borderDefault}}>
      <TouchableOpacity style={{ flexDirection:'row', alignItems:'center', gap:6, paddingVertical:8, paddingHorizontal:14, borderRadius:8, backgroundColor:Colors.bgBase, borderWidth:1, borderColor:Colors.borderDefault }} onPress={() => go('home')}>
        <Icons.ChevronLeftIcon size={12} color={Colors.purpleLight} />
        <Text style={{ color:Colors.purpleLight, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>ABORT</Text>
      </TouchableOpacity>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16, paddingVertical:8, borderRadius:8, backgroundColor:Colors.fuchsia+'15', borderWidth:1, borderColor:Colors.fuchsia+'35' }}>
        <Icons.TargetIcon size={14} color={Colors.fuchsia} />
        <Text style={{ color:Colors.fuchsia, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>NODE: {room.id}</Text>
      </View>
      <View style={{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:8, backgroundColor:Colors.gold+'10', borderWidth:1, borderColor:Colors.gold+'30' }}>
        <Icons.IntelIcon size={14} color={Colors.gold} />
        <Text style={{ color:Colors.gold, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:14 }}>{user?.coins??0}</Text>
      </View>
    </View>
  );

  // Lobby
  if (!riddle) return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}>
      <TopBar />
      <View style={{ maxWidth:480, alignSelf:'center', width:'100%', padding:32 }}>
        <View style={{ backgroundColor:'rgba(15,15,26,0.6)', borderRadius:16, alignItems:'center', padding:32, borderWidth:1.5, borderColor:Colors.purple+'50', marginBottom:24}}>
          <Text style={{ color:Colors.textSecondary, fontFamily:'Chakra Petch', fontSize:13, marginBottom:10, letterSpacing:1, textTransform:'uppercase' }}>Secure Uplink Code</Text>
          <Text style={{ color:Colors.purple, fontFamily:'Share Tech Mono', fontSize:48, fontWeight:'900', letterSpacing:14 }}>{room.id}</Text>
        </View>
        <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:10, fontWeight:'800', letterSpacing:2, marginBottom:12 }}>CONNECTED OPERATIVES ({players.length}/{roomData?.max_players||4})</Text>
        {players.map((p,i) => (
          <View key={i} style={{ backgroundColor:'rgba(15,15,26,0.6)', borderRadius:12, flexDirection:'row', alignItems:'center', gap:14, padding:16, marginBottom:8, borderWidth:1, borderColor:Colors.borderDefault}}>
            {i===0 && p.user_id===roomData?.host_id ? <Icons.ShieldIcon size={20} color={Colors.gold} /> : <Icons.UserIcon size={20} color={Colors.cyan} />}
            <Text style={{ flex:1, color:Colors.textPrimary, fontFamily:'Chakra Petch', fontWeight:'700', fontSize:15, letterSpacing:0.5 }}>{p.username}{p.user_id===user.id?' (You)':''}</Text>
            {p.user_id===roomData?.host_id && <View style={{ backgroundColor:Colors.gold+'18', paddingHorizontal:10, paddingVertical:4, borderRadius:6 }}><Text style={{ color:Colors.gold, fontFamily:'Share Tech Mono', fontSize:10, fontWeight:'900', letterSpacing:1 }}>HOST</Text></View>}
          </View>
        ))}
        {isHost
          ? <TouchableOpacity style={{ backgroundColor:Colors.purple, paddingVertical:16, borderRadius:10, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, marginTop:24, opacity:(players.length<2||loading)?0.4:1}} onPress={startGame} disabled={players.length<2||loading}>
              {loading?<ActivityIndicator color="#fff"/>:<><Icons.TerminalIcon size={16} color="#fff" /><Text style={{ color:'#fff', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:14, letterSpacing:1.5 }}>INITIALIZE SEQUENCE</Text></>}
            </TouchableOpacity>
          : <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', textAlign:'center', marginTop:32, fontSize:14, letterSpacing:1 }}>AWAITING HOST SYNCHRONIZATION...</Text>
        }
      </View>
    </View>
  );

  // Game
  return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}>
      <TopBar />
      <ScrollView contentContainerStyle={{ maxWidth:700, alignSelf:'center', width:'100%', padding:32, paddingBottom:64 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {room.cfg?.timed!==false && !result && (
          <View style={{ flexDirection:'row', alignItems:'center', gap:14, marginBottom:20 }}>
            <View style={{ flex:1, height:4, backgroundColor:Colors.borderDefault, borderRadius:2, overflow:'hidden' }}><View style={{ width:`${(timeLeft/(riddle.timeLimit||30))*100}%`, height:4, backgroundColor:timeLeft<10?Colors.rose:Colors.emerald, borderRadius:2 }} /></View>
            <Text style={{ color:timeLeft<10?Colors.rose:Colors.emerald, fontWeight:'900', fontSize:22, fontFamily:'Share Tech Mono', minWidth:56, textAlign:'right' }}>{timeLeft}s</Text>
          </View>
        )}
        {/* Player chips */}
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:20 }}>
          {players.map((p,i) => { const pr=allRes.find(x=>x.user_id===p.user_id); return (
            <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:12, paddingVertical:8, borderRadius:8, backgroundColor:'rgba(15,15,26,0.5)', borderWidth:1, borderColor:Colors.borderDefault}}>
              {p.user_id===roomData?.host_id ? <Icons.ShieldIcon size={12} color={Colors.gold} /> : <Icons.UserIcon size={12} color={Colors.cyan} />}
              <Text style={{ color:Colors.textPrimary, fontFamily:'Share Tech Mono', fontSize:12, fontWeight:'700' }}>{p.username}</Text>
              {pr ? (pr.is_correct ? <Icons.TargetIcon size={14} color={Colors.emerald} /> : <Icons.XIcon size={14} color={Colors.rose} />) : <Icons.TimerIcon size={14} color={Colors.textMuted} />}
            </View>
          );})}
        </View>
        {/* Question */}
        <View style={{ backgroundColor:'rgba(15,15,26,0.6)', borderRadius:16, padding:28, borderWidth:1.5, borderColor:Colors.borderDefault, marginBottom:20}}>
          <Text style={{ color:Colors.textPrimary, fontFamily:'Cormorant Garamond', fontSize:24, fontWeight:'700', lineHeight:34 }}>{riddle.question}</Text>
        </View>
        {/* MCQ */}
        {room.cfg?.mode==='mcq' && riddle.options?.map((opt,i) => {
          const right=result&&opt===result.correctAnswer; const wrong=result&&opt===selected&&!result?.isCorrect;
          const picked = !result && selected === opt;
          return (
            <TouchableOpacity key={i} style={{ flexDirection:'row', alignItems:'center', gap:16, padding:18, borderRadius:12, marginBottom:10, backgroundColor:right?Colors.emerald+'15':wrong?Colors.rose+'15':'rgba(15,15,26,0.6)', borderWidth:1.5, borderColor:right?Colors.emerald+'60':wrong?Colors.rose+'60':picked?Colors.purple+'50':Colors.borderDefault}} onPress={() => !result&&!selected&&submitAns(opt)} disabled={!!result||!!selected} activeOpacity={0.7}>
              <View style={{ width:38, height:38, borderRadius:10, alignItems:'center', justifyContent:'center', backgroundColor:right?Colors.emerald:wrong?Colors.rose:Colors.bgBase, borderWidth:1, borderColor:right?Colors.emerald:wrong?Colors.rose:Colors.borderDefault }}><Text style={{ color:right||wrong?'#000':Colors.textSecondary, fontFamily:'Share Tech Mono', fontWeight:'900', fontSize:16 }}>{['A','B','C','D'][i]}</Text></View>
              <Text style={{ flex:1, color:right?Colors.emerald:wrong?'#fca5a5':Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:16, fontWeight:'600', letterSpacing:0.5 }}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
        {/* Type */}
        {room.cfg?.mode==='type' && !result && (
          <View style={{ gap:16 }}>
            <TextInput style={{ backgroundColor:'rgba(15,15,26,0.6)', borderWidth:1.5, borderColor:Colors.borderDefault, borderRadius:12, padding:20, color:Colors.textPrimary, fontFamily:'Share Tech Mono', fontSize:16, minHeight:100, textAlignVertical:'top'}} placeholder="Awaiting manual input..." placeholderTextColor={Colors.textMuted} value={typed} onChangeText={setTyped} onSubmitEditing={() => typed.trim()&&submitAns(typed.trim())} multiline />
            <TouchableOpacity style={{ backgroundColor:Colors.purple, paddingVertical:18, borderRadius:10, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:12, opacity:!typed.trim()?0.4:1}} onPress={() => typed.trim()&&submitAns(typed.trim())} disabled={!typed.trim()}>
              <Icons.TerminalIcon size={16} color="#fff" />
              <Text style={{ color:'#fff', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:14, letterSpacing:1.5 }}>TRANSMIT RESPONSE</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Result */}
        {result && (
          <View style={{ backgroundColor:'rgba(15,15,26,0.8)', borderRadius:18, padding:36, borderWidth:2, borderColor:result.gaveUp?Colors.gold+'50':result.isCorrect?Colors.emerald+'50':Colors.rose+'50', alignItems:'center', marginTop:16}}>
            {result.gaveUp ? <Icons.AlertTriangleIcon size={48} color={Colors.gold} /> : result.isCorrect ? <Icons.TargetIcon size={48} color={Colors.emerald} /> : <Icons.XIcon size={48} color={Colors.rose} />}
            <Text style={{ color:result.gaveUp?Colors.gold:result.isCorrect?Colors.emerald:Colors.rose, fontFamily:'Chakra Petch', fontSize:28, fontWeight:'900', marginTop:16, letterSpacing:2, textTransform:'uppercase' }}>{result.gaveUp?'ABORTED!':result.isCorrect?'ACCESS GRANTED':'ACCESS DENIED!'}</Text>
            
            <View style={{ marginTop:24, padding:20, borderRadius:12, backgroundColor:'rgba(15,15,26,0.6)', borderWidth:1, borderColor:Colors.borderDefault, width:'100%', alignItems:'center' }}>
              <Text style={{ color:Colors.textMuted, fontFamily:'Share Tech Mono', fontSize:11, marginBottom:8, letterSpacing:1.5, fontWeight:'700' }}>CORRECT SOLUTION SEQUENCE</Text>
              <Text style={{ color:result.isCorrect?Colors.emerald:'#fca5a5', fontFamily:'Chakra Petch', fontSize:24, fontWeight:'900', textAlign:'center' }}>{result.correctAnswer}</Text>
            </View>
            
            <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:10, fontWeight:'800', letterSpacing:2, marginTop:32, marginBottom:12 }}>🏆 ROUND LOGS</Text>
            {[...allRes].sort((a,b)=>(b.coins_earned||0)-(a.coins_earned||0)).map((p,i) => (
              <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:12, padding:14, backgroundColor:'rgba(15,15,26,0.5)', borderRadius:10, marginBottom:8, width:'100%', borderWidth:1, borderColor:Colors.borderDefault}}>
                <Text style={{ fontFamily:'Share Tech Mono', fontSize:18, width:36, textAlign:'center', color:i===0?Colors.gold:i===1?'#C0C0C0':i===2?'#CD7F32':Colors.textSecondary, fontWeight:'900' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</Text>
                <Text style={{ flex:1, color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:16, fontWeight:'700', letterSpacing:0.5 }}>{p.username}</Text>
                {p.is_correct ? <Icons.TargetIcon size={16} color={Colors.emerald} /> : <Icons.XIcon size={16} color={Colors.rose} />}
                <Text style={{ color:p.is_correct?Colors.gold:Colors.textMuted, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:14 }}>{p.is_correct?`+${p.coins_earned} 💾`:'—'}</Text>
              </View>
            ))}
            
            {isHost
              ? <TouchableOpacity style={{ backgroundColor:Colors.purple, paddingVertical:18, borderRadius:10, alignSelf:'stretch', flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, marginTop:32, opacity:loading?0.5:1}} onPress={nextRiddle} disabled={loading}>{loading?<ActivityIndicator color="#fff"/>:<><Icons.DatabaseIcon size={16} color="#fff" /><Text style={{ color:'#fff', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:14, letterSpacing:1.5 }}>FETCH NEXT NODE →</Text></>}</TouchableOpacity>
              : <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', textAlign:'center', marginTop:24, fontSize:14, letterSpacing:1 }}>AWAITING HOST COMMAND...</Text>
            }
          </View>
        )}
        {isHost && riddle && !result && (
          <TouchableOpacity style={{ marginTop:24, padding:16, borderRadius:10, borderWidth:1, borderColor:Colors.rose+'35', flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, backgroundColor:Colors.rose+'08' }} onPress={giveUp}>
            <Icons.AlertTriangleIcon size={14} color={Colors.rose} />
            <Text style={{ color:Colors.rose, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>SYSTEM ABORT (REVEAL ANSWER)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
