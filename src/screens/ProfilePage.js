import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import Colors from '../theme/colors';
import Icons from '../components/Icons';

export default function ProfilePage({ user, go }) {
  const { width: winW } = useWindowDimensions();
  const stackLayout = winW < 900;
  const xpMap = { Novice:100, Thinker:300, Riddler:600, Mastermind:1000, Genius:2000, Legend:9999 };
  const nextXp = xpMap[user?.level] || 100;
  const xpPct = Math.min(1, (user?.xp??0) / nextXp);
  const lvl = Math.floor((user?.xp??0)/50)+1;

  const badges = [
    { icon: Icons.ZapIcon, name:'Hot Streak', desc:'5 in a row', earned:(user?.streak||0)>=5, color:Colors.orange },
    { icon: Icons.DatabaseIcon, name:'Brain Blast', desc:'Used type mode', earned:(user?.xp||0)>0, color:Colors.purple },
    { icon: Icons.IntelIcon, name:'Intel Hoarder', desc:'500+ Intel', earned:(user?.coins||0)>=500, color:Colors.gold },
    { icon: Icons.TrophyIcon, name:'Champion', desc:'Top 10 rank', earned:false, color:Colors.cyan },
    { icon: Icons.SwordsIcon, name:'Socialite', desc:'Multiplayer win', earned:false, color:Colors.fuchsia },
    { icon: Icons.ShieldIcon, name:'Riddler', desc:'Reach Riddler rank', earned:['Riddler','Mastermind','Genius','Legend'].includes(user?.level), color:Colors.emerald },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding:28, paddingBottom:60, backgroundColor:Colors.bgBase, alignItems:'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ width:'100%', maxWidth:900 }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:32 }}>
        <View style={{ width:3, height:20, backgroundColor:Colors.cyan, borderRadius:2 }} />
        <Icons.UserIcon size={22} color={Colors.textPrimary} />
        <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:22, fontWeight:'900', letterSpacing:1, textTransform:'uppercase' }}>Operative Profile</Text>
      </View>
      <View style={{ flexDirection: stackLayout ? 'column' : 'row', gap:28, alignItems:'flex-start' }}>
        {/* Left — Profile Card */}
        <View style={{ width: stackLayout ? '100%' : 280 }}>
          <View style={{ backgroundColor:'rgba(255,255,255,0.02)', borderRadius:16, alignItems:'center', padding:32, borderWidth:1, borderColor:Colors.borderDefault, overflow:'hidden', position:'relative'}}>
            <View style={{ position:'absolute', top:'-20%', left:'-20%', width:200, height:200, borderRadius:100, backgroundColor:Colors.purple, opacity:0.06}} />
            <View style={{ width:80, height:80, borderRadius:20, backgroundColor:Colors.bgBase, borderWidth:2, borderColor:Colors.purple+'40', alignItems:'center', justifyContent:'center' }}>
              <Icons.UserIcon size={44} color={Colors.purple} />
            </View>
            <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:24, fontWeight:'900', marginTop:16, letterSpacing:0.5 }}>{user?.username}</Text>
            <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:8 }}>
              <Icons.TargetIcon size={12} color={Colors.textSecondary} />
              <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:13 }}>{user?.area}, {user?.city}</Text>
            </View>
            <View style={{ width:'100%', marginTop:28 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                <Text style={{ color:Colors.purpleLight, fontFamily:'Chakra Petch', fontSize:13, fontWeight:'800', letterSpacing:0.5 }}>{user?.level}</Text>
                <Text style={{ color:Colors.textMuted, fontFamily:'Share Tech Mono', fontSize:11 }}>LVL {lvl}</Text>
              </View>
              <View style={{ height:6, backgroundColor:Colors.borderDefault, borderRadius:3 }}>
                <View style={{ width:`${xpPct*100}%`, height:6, backgroundColor:Colors.purple, borderRadius:3 }} />
              </View>
              <Text style={{ color:Colors.textMuted, fontFamily:'Share Tech Mono', fontSize:10, marginTop:6, textAlign:'right' }}>{user?.xp??0} / {nextXp} XP</Text>
            </View>
          </View>
          {/* Stats Row */}
          <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
            {[[Icons.IntelIcon,user?.coins??0,'Credits',Colors.gold],[Icons.ZapIcon,user?.streak??0,'Streak',Colors.orange],[Icons.TerminalIcon,user?.xp??0,'Crack Score',Colors.purpleLight]].map(([IconComp,v,lbl,col]) => (
              <View key={lbl} style={{ flex:1, alignItems:'center', padding:16, backgroundColor:'rgba(255,255,255,0.02)', borderRadius:12, borderWidth:1, borderColor:Colors.borderDefault}}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                  <IconComp size={14} color={col} />
                  <Text style={{ color:col, fontFamily:'Share Tech Mono', fontSize:16, fontWeight:'900' }}>{v}</Text>
                </View>
                <Text style={{ color:Colors.textMuted, fontFamily:'Share Tech Mono', fontSize:10, marginTop:4, fontWeight:'700', letterSpacing:1 }}>{lbl.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Right — Achievements */}
        <View style={{ flex:1, minWidth:300 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:24 }}>
            <View style={{ width:3, height:16, backgroundColor:Colors.gold, borderRadius:2 }} />
            <Icons.TrophyIcon size={16} color={Colors.gold} />
            <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:16, fontWeight:'900', letterSpacing:1, textTransform:'uppercase' }}>Commendations</Text>
          </View>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:14 }}>
            {badges.map((b,i) => {
              const BadgeIcon = b.icon;
              return (
                <View key={i} style={{
                  width:140, padding:24, borderRadius:14,
                  backgroundColor:'rgba(255,255,255,0.02)', borderWidth:1,
                  borderColor:b.earned?b.color+'45':Colors.borderDefault,
                  opacity:b.earned?1:0.3, alignItems:'center'}}>
                  <BadgeIcon size={32} color={b.earned ? b.color : Colors.textMuted} />
                  <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontWeight:'800', fontSize:13, marginTop:12, textAlign:'center', letterSpacing:0.5 }}>{b.name}</Text>
                  <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize:11, marginTop:4, textAlign:'center' }}>{b.desc}</Text>
                  {b.earned && <View style={{ width:8, height:8, borderRadius:4, backgroundColor:b.color, marginTop:12}} />}
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Weekly Brain Profile Link */}
      <TouchableOpacity 
        style={{ marginTop:32, backgroundColor:'rgba(255,255,255,0.02)', borderRadius:20, padding:24, borderWidth:1, borderColor:Colors.indigo+'40', borderLeftWidth:4, borderLeftColor:Colors.indigo, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}
        onPress={() => go('brainprofile')}
      >
        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <Icons.DatabaseIcon size={18} color={Colors.indigo} />
          <Text style={{ color:Colors.indigo, fontFamily:'Chakra Petch', fontSize:15, fontWeight:'900', letterSpacing:0.5 }}>View Intelligence Report</Text>
        </View>
        <Icons.ChevronRightIcon size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* Settings Link */}
      <TouchableOpacity 
        style={{ marginTop:16, backgroundColor:'rgba(255,255,255,0.02)', borderRadius:20, padding:24, borderWidth:1, borderColor:Colors.borderDefault, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}
        onPress={() => go('settings')}
      >
        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <Icons.SettingsIcon size={18} color={Colors.textPrimary} />
          <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:15, fontWeight:'800', letterSpacing:0.5 }}>System Settings</Text>
        </View>
        <Icons.ChevronRightIcon size={16} color={Colors.textMuted} />
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
