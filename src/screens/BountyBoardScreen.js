import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';

export default function BountyBoardScreen({ user, go, update }) {
  const [bounty, setBounty] = useState(null);
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/bounty/current`); const data = await res.json();
      if (data.success && data.bounty) { setBounty(data.bounty); const ms=new Date(data.bounty.expires_at)-Date.now(); setTimeLeft(`${Math.floor(ms/3600000)}h ${Math.floor((ms%3600000)/60000)}m`); }
    } catch {} setLoading(false);
  }

  async function attempt() {
    if (!typed.trim()) return; setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/bounty/attempt`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, bountyId:bounty.id, userAnswer:typed.trim(), username:user.username }) });
      const data = await res.json(); setResult(data);
      if (data.isCorrect) update({...user, coins:(user.coins||0)+bounty.prize_coins});
    } catch {} setSubmitting(false);
  }

  const TopBar = () => (
    <View style={{ height:64, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:24, backgroundColor:'rgba(15,15,26,0.9)', borderBottomWidth:1, borderColor:Colors.borderDefault}}>
      <TouchableOpacity style={{ flexDirection:'row', alignItems:'center', gap:6, paddingVertical:8, paddingHorizontal:14, borderRadius:8, backgroundColor:Colors.bgBase, borderWidth:1, borderColor:Colors.borderDefault }} onPress={() => go('home')}>
        <Icons.ChevronLeftIcon size={12} color={Colors.purpleLight} />
        <Text style={{ color:Colors.purpleLight, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>HUB</Text>
      </TouchableOpacity>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:16, paddingVertical:8, borderRadius:8, backgroundColor:Colors.gold+'15', borderWidth:1, borderColor:Colors.gold+'35' }}>
        <Icons.TrophyIcon size={14} color={Colors.gold} />
        <Text style={{ color:Colors.gold, fontFamily:'Share Tech Mono', fontWeight:'800', fontSize:13, letterSpacing:1 }}>BOUNTY BOARD</Text>
      </View>
      <View style={{ width:100 }} />
    </View>
  );

  if (loading) return <View style={{ flex:1, backgroundColor:Colors.bgBase }}><TopBar /><View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator size="large" color={Colors.gold} /><Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', marginTop:24, letterSpacing:2 }}>SEARCHING FOR ACTIVE BOUNTIES...</Text></View></View>;

  if (!bounty) return <View style={{ flex:1, backgroundColor:Colors.bgBase }}><TopBar /><View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><Icons.ShieldIcon size={48} color={Colors.textMuted} /><Text style={{ color:Colors.textSecondary, fontFamily:'Chakra Petch', fontSize:20, marginTop:16, letterSpacing:1 }}>NO ACTIVE BOUNTIES AT THIS TIME.</Text></View></View>;

  // Render claimed state initially when loaded as claimed
  if (bounty.solved_by && !result) return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}><TopBar />
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:40 }}>
        <Icons.TrophyIcon size={80} color={Colors.gold} style={{ opacity: 0.5 }} />
        <Text style={{ color:Colors.gold, fontFamily:'Chakra Petch', fontSize:36, fontWeight:'900', marginTop:24, textAlign:'center', letterSpacing:2, opacity: 0.8 }}>BOUNTY CLAIMED</Text>
        <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', marginTop:16, fontSize:16, letterSpacing:1 }}>OPERATIVE <Text style={{ color:Colors.cyan, fontWeight:'700' }}>{bounty.solved_by}</Text> SECURED THE ASSET.</Text>
        <TouchableOpacity style={{ backgroundColor:'rgba(15,15,26,0.6)', paddingVertical:16, paddingHorizontal:48, borderRadius:10, borderWidth:1, borderColor:Colors.borderDefault, marginTop:40}} onPress={() => go('home')}>
          <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontWeight:'900', fontSize:14, letterSpacing:1.5 }}>RETURN TO HUB</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render win state if user specifically solved it just now
  if (result?.isCorrect) return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}><TopBar />
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:40 }}>
        <Icons.TargetIcon size={80} color={Colors.gold} />
        <Text style={{ color:Colors.gold, fontFamily:'Chakra Petch', fontSize:42, fontWeight:'900', marginTop:24, textAlign:'center', letterSpacing:2}}>LEGENDARY SOLVER</Text>
        <Text style={{ color:Colors.textSecondary, fontFamily:'Cormorant Garamond', marginTop:16, textAlign:'center', lineHeight:24, fontSize:18, fontStyle:'italic' }}>{result.message}</Text>
        
        <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginTop:32, backgroundColor:Colors.gold+'15', paddingHorizontal:32, paddingVertical:16, borderRadius:12, borderWidth:1, borderColor:Colors.gold+'40' }}>
          <Icons.CoinIcon size={24} color={Colors.gold} />
          <Text style={{ color:Colors.gold, fontFamily:'Share Tech Mono', fontSize:36, fontWeight:'900' }}>+{(bounty.prize_coins||0).toLocaleString()}</Text>
        </View>

        <TouchableOpacity style={{ backgroundColor:Colors.gold, paddingVertical:18, paddingHorizontal:48, borderRadius:10, marginTop:48}} onPress={() => go('home')}>
          <Text style={{ color:'#000', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:15, letterSpacing:1.5 }}>ENTER HALL OF FAME →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:Colors.bgBase }}><TopBar />
      <ScrollView contentContainerStyle={{ maxWidth:660, alignSelf:'center', width:'100%', padding:32, paddingBottom:64 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems:'center', marginBottom:40 }}>
          <Icons.TrophyIcon size={56} color={Colors.gold} />
          <Text style={{ color:Colors.gold, fontFamily:'Share Tech Mono', fontSize:12, fontWeight:'900', letterSpacing:4, marginTop:16, opacity: 0.8 }}>GLOBAL DIRECTIVE</Text>
          <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:36, fontWeight:'900', marginTop:8, textAlign:'center', letterSpacing:1 }}>{(bounty.prize_coins||0).toLocaleString()} CREDIT YIELD</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:12, backgroundColor:'rgba(15,15,26,0.6)', paddingHorizontal:16, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:Colors.borderDefault }}>
            <Icons.TimerIcon size={14} color={Colors.textSecondary} />
            <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:13, fontWeight:'700', letterSpacing:1 }}>EXPIRES: {timeLeft}</Text>
          </View>
        </View>
        
        <View style={{ backgroundColor:'rgba(15,15,26,0.6)', borderRadius:16, padding:32, borderWidth:2, borderColor:Colors.gold+'30', marginBottom:28}}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:16 }}>
            <Icons.LockIcon size={16} color={Colors.gold} />
            <Text style={{ color:Colors.gold, fontFamily:'Chakra Petch', fontSize:13, fontWeight:'900', letterSpacing:2, textTransform:'uppercase' }}>Classified Intel</Text>
          </View>
          <Text style={{ color:Colors.textPrimary, fontFamily:'Cormorant Garamond', fontSize:22, fontWeight:'700', lineHeight:34 }}>{bounty.question}</Text>
        </View>
        
        <View style={{ backgroundColor:'rgba(15,15,26,0.4)', borderRadius:16, padding:24, borderWidth:1, borderColor:Colors.rose+'25', marginBottom:24}}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:16 }}>
            <Icons.AlertTriangleIcon size={14} color={Colors.rose} />
            <Text style={{ color:Colors.rose, fontFamily:'Share Tech Mono', fontSize:11, fontWeight:'900', letterSpacing:2 }}>CRITICAL: EXACT MATCH REQUIRED</Text>
          </View>
          <TextInput style={{ backgroundColor:'rgba(15,15,26,0.8)', borderWidth:1.5, borderColor:Colors.borderDefault, borderRadius:12, padding:20, color:Colors.textPrimary, fontFamily:'Share Tech Mono', fontSize:16, minHeight:80, textAlignVertical:'top' }} placeholder="Input exact decryption sequence..." placeholderTextColor={Colors.textMuted} value={typed} onChangeText={setTyped} multiline />
          {result && !result.isCorrect && (
            <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:12, backgroundColor:Colors.rose+'15', padding:10, borderRadius:8 }}>
              <Icons.XIcon size={14} color={Colors.rose} />
              <Text style={{ color:Colors.rose, fontFamily:'Share Tech Mono', fontWeight:'700', fontSize:12, letterSpacing:0.5 }}>SEQUENCE INVALID. RE-CALCULATE.</Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity style={{ backgroundColor:Colors.gold, paddingVertical:18, borderRadius:10, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, opacity:(!typed.trim()||submitting)?0.4:1 }} onPress={attempt} disabled={!typed.trim()||submitting}>
          {submitting ? <ActivityIndicator color="#000" /> : <><Icons.TerminalIcon size={18} color="#000" /><Text style={{ color:'#000', fontFamily:'Chakra Petch', fontWeight:'900', fontSize:15, letterSpacing:1.5 }}>TRANSMIT SOLUTION</Text></>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
