import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';

export default function MultiSetupScreen({ user, go, setRoom }) {
  const [tab, setTab] = useState('create');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState({ mode:'mcq', timed:true, timeLimit:30, maxPlayers:4 });

  async function createRoom() {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/room/create`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ hostId:user.id, hostName:user.username, ...cfg }) });
      const data = await res.json();
      if (data.success) { setRoom({ id:data.roomId, isHost:true, cfg }); go('room'); } else alert(data.error);
    } catch { alert('Network connection failed'); } setLoading(false);
  }

  async function joinRoom() {
    if (!code.trim()) { alert('Enter a room code'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/room/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ roomId:code.trim().toUpperCase(), userId:user.id, username:user.username }) });
      const data = await res.json();
      if (data.success) { setRoom({ id:code.trim().toUpperCase(), isHost:false, cfg:{ mode:data.room.mode } }); go('room'); } else alert(data.error);
    } catch { alert('Connection error'); } setLoading(false);
  }

  const Opt = ({ lbl, on, col, onPress, icon: IconComp }) => (
    <TouchableOpacity style={{ paddingHorizontal:20, paddingVertical:14, borderRadius:10, backgroundColor:on?col+'15':'rgba(15,15,26,0.6)', borderWidth:1.5, borderColor:on?col:Colors.borderDefault, flexDirection:'row', alignItems:'center', gap:8}} onPress={onPress}>
      {IconComp && <IconComp size={14} color={on?col:Colors.textSecondary} />}
      <Text style={{ color:on?col:Colors.textSecondary, fontFamily:'Chakra Petch', fontWeight:'700', fontSize:14, letterSpacing:0.5 }}>{lbl}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}>
      <View style={{ height:64, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:24, backgroundColor:'rgba(15,15,26,0.9)', borderBottomWidth:1, borderColor:Colors.borderDefault}}>
        <TouchableOpacity style={{ flexDirection:'row', alignItems:'center', gap:6, paddingVertical:8, paddingHorizontal:14, borderRadius:8, backgroundColor:Colors.bgBase, borderWidth:1, borderColor:Colors.borderDefault }} onPress={() => go('home')}>
          <Icons.ChevronLeftIcon size={12} color={Colors.purpleLight} />
          <Text style={{ color:Colors.purpleLight, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>HUB</Text>
        </TouchableOpacity>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          <Icons.SwordsIcon size={18} color={'#fff'} />
          <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontWeight:'900', fontSize:18, letterSpacing:1, textTransform:'uppercase' }}>Secure Uplink</Text>
        </View>
        <View style={{ width:80 }} />
      </View>
      <ScrollView contentContainerStyle={{ maxWidth:600, alignSelf:'center', width:'100%', padding:32 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection:'row', gap:8, marginBottom:32 }}>
          <TouchableOpacity style={{ flex:1, paddingVertical:14, borderRadius:10, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:8, backgroundColor:tab==='create'?Colors.purple:'rgba(15,15,26,0.6)', borderWidth:1, borderColor:tab==='create'?Colors.purple:Colors.borderDefault}} onPress={() => setTab('create')}>
            <Icons.PlusIcon size={16} color={tab==='create'?'#fff':Colors.textSecondary} />
            <Text style={{ color:tab==='create'?'#fff':Colors.textSecondary, fontFamily:'Chakra Petch', fontWeight:'800', fontSize:14, letterSpacing:1 }}>HOST NODE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex:1, paddingVertical:14, borderRadius:10, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:8, backgroundColor:tab==='join'?Colors.purple:'rgba(15,15,26,0.6)', borderWidth:1, borderColor:tab==='join'?Colors.purple:Colors.borderDefault}} onPress={() => setTab('join')}>
            <Icons.TargetIcon size={16} color={tab==='join'?'#fff':Colors.textSecondary} />
            <Text style={{ color:tab==='join'?'#fff':Colors.textSecondary, fontFamily:'Chakra Petch', fontWeight:'800', fontSize:14, letterSpacing:1 }}>JOIN NODE</Text>
          </TouchableOpacity>
        </View>
        
        {tab === 'create' && (
          <View style={{ gap:24 }}>
            <View>
              <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:11, fontWeight:'800', letterSpacing:1.5, marginBottom:12 }}>INTERROGATION MODE</Text>
              <View style={{ flexDirection:'row', gap:10, flexWrap:'wrap' }}>
                <Opt lbl="QUICK CRACK" icon={Icons.ZapIcon} on={cfg.mode==='mcq'} col={Colors.cyan} onPress={() => setCfg({...cfg,mode:'mcq'})} />
                <Opt lbl="BRAIN BLAST" icon={Icons.DatabaseIcon} on={cfg.mode==='type'} col={Colors.purple} onPress={() => setCfg({...cfg,mode:'type'})} />
              </View>
            </View>
            <View>
              <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:11, fontWeight:'800', letterSpacing:1.5, marginBottom:12 }}>TEMPORAL CONSTRAINTS</Text>
              <View style={{ flexDirection:'row', gap:10, flexWrap:'wrap' }}>
                <Opt lbl="TIMED" icon={Icons.TimerIcon} on={cfg.timed} col={Colors.gold} onPress={() => setCfg({...cfg,timed:true})} />
                <Opt lbl="NO LIMIT" icon={Icons.ShieldIcon} on={!cfg.timed} col={Colors.gold} onPress={() => setCfg({...cfg,timed:false})} />
              </View>
            </View>
            {cfg.timed && <View>
              <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:11, fontWeight:'800', letterSpacing:1.5, marginBottom:12 }}>SECONDS PER CYCLE</Text>
              <View style={{ flexDirection:'row', gap:10, flexWrap:'wrap' }}>
                {[20,30,45,60].map(v => <Opt key={v} lbl={`${v}s`} on={cfg.timeLimit===v} col={Colors.orange} onPress={() => setCfg({...cfg,timeLimit:v})} />)}
              </View>
            </View>}
            <View>
              <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:11, fontWeight:'800', letterSpacing:1.5, marginBottom:12 }}>MAXIMUM OPERATIVES</Text>
              <View style={{ flexDirection:'row', gap:10, flexWrap:'wrap' }}>
                {[2,3,4,5].map(v => <Opt key={v} lbl={String(v)} on={cfg.maxPlayers===v} col={Colors.fuchsia} onPress={() => setCfg({...cfg,maxPlayers:v})} />)}
              </View>
            </View>
            <TouchableOpacity style={{ backgroundColor:Colors.purple, paddingVertical:18, borderRadius:10, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, marginTop:16, opacity:loading?0.5:1 }} onPress={createRoom} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <><Icons.TerminalIcon size={16} color={'#fff'} /><Text style={{ color:'#fff', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:14, letterSpacing:1.5 }}>INITIALIZE NODE</Text></>}
            </TouchableOpacity>
          </View>
        )}
        
        {tab === 'join' && (
          <View style={{ gap:24, alignItems:'center', marginTop:20 }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
              <Icons.LockIcon size={16} color={Colors.textSecondary} />
              <Text style={{ color:Colors.textSecondary, fontFamily:'Cormorant Garamond', fontSize:16, fontStyle:'italic' }}>Enter the 6-letter cipher from your host</Text>
            </View>
            <TextInput style={{ width:'100%', backgroundColor:'rgba(15,15,26,0.6)', borderWidth:1.5, borderColor:Colors.borderDefault, borderRadius:12, textAlign:'center', fontFamily:'Share Tech Mono', fontSize:36, fontWeight:'900', letterSpacing:14, color:Colors.purple, paddingVertical:24}} placeholder="XXXXXX" placeholderTextColor={Colors.textMuted} value={code} onChangeText={t => setCode(t.toUpperCase())} maxLength={6} autoCapitalize="characters" />
            <TouchableOpacity style={{ width:'100%', backgroundColor:Colors.purple, paddingVertical:18, borderRadius:10, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, opacity:(loading || code.length < 6) ? 0.5 : 1 }} onPress={joinRoom} disabled={loading || code.length < 6}>
              {loading ? <ActivityIndicator color="#fff" /> : <><Icons.LinkIcon size={16} color={'#fff'} /><Text style={{ color:'#fff', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:14, letterSpacing:1.5 }}>ESTABLISH LINK</Text></>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
