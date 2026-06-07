import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, Image, Modal, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../theme/colors';
import { useResponsive } from '../theme/breakpoints';
import Icons from '../components/Icons';
import { useUser } from '../utils/UserContext';
import { getAuthToken } from '../utils/authSession';

import { BACKEND } from '../utils/api';
const isWeb = Platform.OS === 'web';

export default function ProfilePage({ user: initialUser, go, update, syncUser: propSyncUser }) {
  // Use context for instant global sync; fall back to prop
  const ctx = useUser();
  const contextUser = ctx?.user;
  const contextSync = ctx?.syncUser;
  const optimisticUpdate = ctx?.optimisticUpdate;
  
  // Prefer context user (always freshest), fall back to prop
  const user = contextUser || initialUser;
  const syncGlobal = contextSync || propSyncUser;
  
  const [loading, setLoading] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptType, setPromptType] = useState('username');
  const [promptValue, setPromptValue] = useState('');

  const handleUpdate = useCallback(async () => {
    if (!promptValue || promptValue.trim().length === 0) {
      setPromptVisible(false);
      return;
    }

    // Build the partial update
    const partial = {};
    if (promptType === 'username') partial.username = promptValue.trim();
    if (promptType === 'avatar') partial.avatar_url = promptValue;

    // OPTIMISTIC: Apply instantly to context → Dashboard, Header, everywhere updates NOW
    const previousUser = { ...user };
    if (optimisticUpdate) {
      optimisticUpdate(partial);
    } else if (syncGlobal) {
      syncGlobal({ ...user, ...partial });
    }

    setPromptVisible(false);

    // BACKGROUND: Send to API — if it fails, revert
    try {
      const token = await getAuthToken();
      const payload = { userId: user?.id, ...partial };
      const res = await fetch(`${BACKEND}/user/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.user) {
        // Confirm with server data (may include extra fields)
        if (syncGlobal) syncGlobal(data.user);
      } else {
        // API rejected — revert optimistic update
        if (syncGlobal) syncGlobal(previousUser);
      }
    } catch {
      // Revert on network failure
      if (syncGlobal) syncGlobal(previousUser);
    }
  }, [promptValue, promptType, user, optimisticUpdate, syncGlobal]);

  useEffect(() => {
    async function fetchFresh() {
      if (!initialUser?.id) return;
      try {
        setLoading(true);
        const token = await getAuthToken();
        const res = await fetch(`${BACKEND}/user/${initialUser.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && syncGlobal) syncGlobal(json.user);
      } catch (e) { /* fallback to cached */ } finally { setLoading(false); }
    }
    fetchFresh();
  }, [initialUser?.id]);

  const { isMobile: stackLayout, isPhone } = useResponsive();
  const levels = ['Novice', 'Thinker', 'Riddler', 'Mastermind', 'Genius', 'Legend'];
  const xpMap = { Novice:100, Thinker:300, Riddler:600, Mastermind:1000, Genius:2000, Legend:9999 };
  const currentLvlIndex = levels.indexOf(user?.level) !== -1 ? levels.indexOf(user?.level) : 0;
  const prevXp = currentLvlIndex > 0 ? xpMap[levels[currentLvlIndex - 1]] : 0;
  const nextXp = xpMap[user?.level] || 100;
  const earnedInLevel = Math.max(0, (user?.xp ?? 0) - prevXp);
  const range = nextXp - prevXp;
  const xpPct = Math.min(1, earnedInLevel / Math.max(1, range));
  const tierToNum = { Novice:1, Thinker:2, Riddler:3, Mastermind:4, Genius:5, Legend:6 };
  const lvl = tierToNum[user?.level] || 1;
  const totalPlayed = user?.total_played || 0;
  const totalCorrect = user?.total_correct || 0;
  const accuracyPct = totalPlayed > 0 ? Math.round((totalCorrect / totalPlayed) * 100) : 0;

  const badges = [
    { icon: Icons.ZapIcon, name:'Hot Streak', desc:'5 in a row', earned:(user?.streak||0)>=5, color:Colors.orange },
    { icon: Icons.DatabaseIcon, name:'Brain Blast', desc:'Gained 100+ XP', earned:(user?.xp||0)>=100, color:Colors.purple },
    { icon: Icons.IntelIcon, name:'Intel Hoarder', desc:'500+ Intel', earned:(user?.coins||0)>=500, color:Colors.gold },
    { icon: Icons.TrophyIcon, name:'Champion', desc:'50+ Correct', earned:(user?.total_correct||0)>=50, color:Colors.cyan },
    { icon: Icons.SwordsIcon, name:'Socialite', desc:'Played 10+ games', earned:(user?.total_played||0)>=10, color:Colors.fuchsia },
    { icon: Icons.ShieldIcon, name:'Riddler', desc:'Reach Riddler rank', earned:['Riddler','Mastermind','Genius','Legend'].includes(user?.level), color:Colors.emerald },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: isPhone ? 12 : 28, paddingBottom:60, backgroundColor:Colors.bgBase, alignItems:'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ width:'100%', maxWidth:900 }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom: isPhone ? 20 : 32 }}>
        <View style={{ width:3, height:20, backgroundColor:Colors.cyan, borderRadius:2 }} />
        <Icons.UserIcon size={isPhone ? 18 : 22} color={Colors.textPrimary} />
        <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize: isPhone ? 16 : 22, fontWeight:'900', letterSpacing:1, textTransform:'uppercase' }}>Operative Profile</Text>
      </View>
      <View style={{ flexDirection: stackLayout ? 'column' : 'row', gap: isPhone ? 16 : 28, alignItems:'flex-start' }}>
        {/* Left — Profile Card */}
        <View style={{ width: stackLayout ? '100%' : 280 }}>
          <View style={{ backgroundColor:'rgba(255,255,255,0.02)', borderRadius: isPhone ? 12 : 16, alignItems:'center', padding: isPhone ? 20 : 32, borderWidth:1, borderColor:Colors.borderDefault, overflow:'hidden', position:'relative'}}>
            <View style={{ position:'absolute', top:'-20%', left:'-20%', width:200, height:200, borderRadius:100, backgroundColor:Colors.purple, opacity:0.06}} />
            
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => {
                setPromptType('avatar');
                setPromptValue(user?.avatar_url || '');
                setPromptVisible(true);
              }}
              style={[{ width:80, height:80, borderRadius:20, backgroundColor:Colors.bgBase, borderWidth:2, borderColor:Colors.purple+'40', alignItems:'center', justifyContent:'center', position: 'relative' }, isWeb ? { cursor: 'pointer' } : {}]}
            >
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: 18 }} />
              ) : (
                <Icons.UserIcon size={44} color={Colors.purple} />
              )}
              <View style={{ position: 'absolute', bottom: -8, right: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.bgBase }}>
                <Icons.EditIcon size={12} color="#fff" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }, isWeb ? { cursor: 'pointer' } : {} ]}
              onPress={() => {
                setPromptType('username');
                setPromptValue(user?.username || '');
                setPromptVisible(true);
              }}
            >
              <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize:24, fontWeight:'900', letterSpacing:0.5 }}>{user?.username}</Text>
              <Icons.EditIcon size={14} color={Colors.textSecondary} />
            </TouchableOpacity>

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
          <View style={{ flexDirection:'row', gap: isPhone ? 4 : 8, marginTop:12 }}>
            {[[Icons.IntelIcon,user?.coins??0,'Intel',Colors.gold],[Icons.ZapIcon,user?.streak??0,'Streak',Colors.orange],[Icons.TerminalIcon,user?.xp??0,'Crack Score',Colors.purpleLight]].map(([IconComp,v,lbl,col]) => (
              <View key={lbl} style={{ flex:1, alignItems:'center', padding: isPhone ? 10 : 16, backgroundColor:'rgba(255,255,255,0.02)', borderRadius: isPhone ? 8 : 12, borderWidth:1, borderColor:Colors.borderDefault}}>
                <View style={{ flexDirection:'row', alignItems:'center', gap: isPhone ? 3 : 6 }}>
                  <IconComp size={isPhone ? 11 : 14} color={col} />
                  <Text style={{ color:col, fontFamily:'Share Tech Mono', fontSize: isPhone ? 12 : 16, fontWeight:'900' }}>{v}</Text>
                </View>
                <Text style={{ color:Colors.textMuted, fontFamily:'Share Tech Mono', fontSize: isPhone ? 8 : 10, marginTop: isPhone ? 2 : 4, fontWeight:'700', letterSpacing:1 }}>{lbl.toUpperCase()}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 12, padding: isPhone ? 14 : 18, backgroundColor: 'rgba(34,197,94,0.06)', borderRadius: isPhone ? 10 : 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)' }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap: 8 }}>
                <Icons.ShieldIcon size={isPhone ? 14 : 16} color={Colors.emerald} />
                <Text style={{ color:Colors.emerald, fontFamily:'Chakra Petch', fontSize: isPhone ? 12 : 14, fontWeight:'900', letterSpacing:0.8, textTransform:'uppercase' }}>Field Record</Text>
              </View>
              <Text style={{ color:'#dcfce7', fontFamily:'Share Tech Mono', fontSize: isPhone ? 14 : 16, fontWeight:'900' }}>{accuracyPct}%</Text>
            </View>
            <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize: isPhone ? 10 : 11, lineHeight: 18 }}>A clear read on how this operative is performing across the live arena.</Text>
            <View style={{ flexDirection:'row', gap: isPhone ? 6 : 8, marginTop: 12 }}>
              {[
                ['DECRYPTS', totalPlayed, Colors.cyan],
                ['SOLVED', totalCorrect, Colors.gold],
                ['ACCURACY', `${accuracyPct}%`, Colors.emerald],
              ].map(([label, value, color]) => (
                <View key={label} style={{ flex:1, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10, backgroundColor:'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.borderDefault }}>
                  <Text style={{ color, fontFamily:'Share Tech Mono', fontSize: isPhone ? 12 : 14, fontWeight:'900' }}>{value}</Text>
                  <Text style={{ color:'#cbd5e1', fontFamily:'Share Tech Mono', fontSize: isPhone ? 8 : 9, fontWeight:'800', marginTop: 4, letterSpacing: 0.8 }}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Right — Achievements */}
        <View style={{ flex:1, minWidth: isPhone ? 0 : 300, width: stackLayout ? '100%' : undefined }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom: isPhone ? 16 : 24 }}>
            <View style={{ width:3, height:16, backgroundColor:Colors.gold, borderRadius:2 }} />
            <Icons.TrophyIcon size={16} color={Colors.gold} />
            <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize: isPhone ? 14 : 16, fontWeight:'900', letterSpacing:1, textTransform:'uppercase' }}>Commendations</Text>
          </View>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap: isPhone ? 8 : 14 }}>
            {badges.map((b,i) => {
              const BadgeIcon = b.icon;
              return (
                <View key={i} style={{
                  width: isPhone ? '47%' : 140, padding: isPhone ? 14 : 24, borderRadius: isPhone ? 10 : 14,
                  backgroundColor:'rgba(255,255,255,0.02)', borderWidth:1,
                  borderColor:b.earned?b.color+'45':Colors.borderDefault,
                  opacity:b.earned?1:0.3, alignItems:'center'}}>
                  <BadgeIcon size={isPhone ? 24 : 32} color={b.earned ? b.color : Colors.textMuted} />
                  <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontWeight:'800', fontSize: isPhone ? 11 : 13, marginTop: isPhone ? 8 : 12, textAlign:'center', letterSpacing:0.5 }}>{b.name}</Text>
                  <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize: isPhone ? 9 : 11, marginTop:4, textAlign:'center' }}>{b.desc}</Text>
                  {b.earned && <View style={{ width:8, height:8, borderRadius:4, backgroundColor:b.color, marginTop: isPhone ? 8 : 12}} />}
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Weekly Brain Profile Link */}
      <View style={{ marginTop: isPhone ? 20 : 32, gap: isPhone ? 10 : 16 }}>
        <TouchableOpacity
          style={{ backgroundColor:'rgba(255,255,255,0.02)', borderRadius: isPhone ? 14 : 20, padding: isPhone ? 16 : 24, borderWidth:1, borderColor:Colors.indigo+'40', borderLeftWidth:4, borderLeftColor:Colors.indigo, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}
          onPress={() => go('brainprofile')}
        >
          <View style={{ flexDirection:'row', alignItems:'center', gap: isPhone ? 8 : 10, flex: 1 }}>
            <Icons.DatabaseIcon size={isPhone ? 14 : 18} color={Colors.indigo} />
            <View style={{ flex: 1 }}>
              <Text style={{ color:Colors.indigo, fontFamily:'Chakra Petch', fontSize: isPhone ? 12 : 15, fontWeight:'900', letterSpacing:0.5 }}>View Intelligence Report</Text>
              <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize: isPhone ? 9 : 11, marginTop: 4, lineHeight: 18 }}>Weekly performance, strike rate, and activity patterns.</Text>
            </View>
          </View>
          <Icons.ChevronRightIcon size={isPhone ? 14 : 16} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ backgroundColor:'rgba(255,255,255,0.02)', borderRadius: isPhone ? 14 : 20, padding: isPhone ? 16 : 24, borderWidth:1, borderColor:Colors.borderDefault, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}
          onPress={() => go('settings')}
        >
          <View style={{ flexDirection:'row', alignItems:'center', gap: isPhone ? 8 : 10, flex: 1 }}>
            <Icons.SettingsIcon size={isPhone ? 14 : 18} color={Colors.textPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color:Colors.textPrimary, fontFamily:'Chakra Petch', fontSize: isPhone ? 12 : 15, fontWeight:'800', letterSpacing:0.5 }}>System Settings</Text>
              <Text style={{ color:Colors.textSecondary, fontFamily:'Share Tech Mono', fontSize: isPhone ? 9 : 11, marginTop: 4, lineHeight: 18 }}>Account controls, admin access, and system identity.</Text>
            </View>
          </View>
          <Icons.ChevronRightIcon size={isPhone ? 14 : 16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      </View>

      {/* Custom Edit Modal */}
      <Modal transparent={true} visible={promptVisible} animationType="fade">
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setPromptVisible(false)}
          style={[{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 }, isWeb ? { backdropFilter: 'blur(10px)' } : {}]}
        >
          <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 400, backgroundColor: '#0A0A0C', borderRadius: 20, padding: 32, borderWidth: 1, borderColor: Colors.borderDefault }}>
            <Text style={{ fontFamily: 'Chakra Petch', fontSize: 18, color: promptType === 'username' ? Colors.cyan : Colors.purple, fontWeight: '900', letterSpacing: 2, marginBottom: 20 }}>
              {promptType === 'username' ? 'UPDATE USERNAME' : 'UPDATE AVATAR PICTURE'}
            </Text>

            {promptType === 'username' ? (
              <TextInput
                value={promptValue}
                onChangeText={setPromptValue}
                style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, color: '#fff', fontFamily: 'Share Tech Mono', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 24 }}
                placeholder="Enter new username..."
                placeholderTextColor="#64748b"
                autoFocus
              />
            ) : (
              <View style={{ width: '100%', marginBottom: 24, alignItems: 'center' }}>
                {promptValue ? (
                  <Image source={{ uri: promptValue }} style={{ width: 100, height: 100, borderRadius: 25, marginBottom: 16, borderWidth: 2, borderColor: Colors.purple }} />
                ) : (
                  <View style={{ width: 100, height: 100, borderRadius: 25, marginBottom: 16, borderWidth: 2, borderColor: Colors.borderDefault, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <Icons.UserIcon size={40} color={Colors.textSecondary} />
                  </View>
                )}
                <TouchableOpacity 
                  onPress={async () => {
                    try {
                       let result = await ImagePicker.launchImageLibraryAsync({
                         mediaTypes: ImagePicker.MediaTypeOptions.Images,
                         allowsEditing: true,
                         aspect: [1, 1],
                         quality: 0.5,
                         base64: true,
                       });
                       if (!result.canceled && result.assets && result.assets.length > 0) {
                         const asset = result.assets[0];
                         const b64 = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
                         if (b64.length > 500_000) {
                           return;
                         }
                         setPromptValue(b64);
                       }
                    } catch {}
                  }}
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.purple + '50' }}
                >
                  <Text style={{ fontFamily: 'Share Tech Mono', color: Colors.purpleLight, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 }}>CHOOSE FILE</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setPromptVisible(false)} style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Share Tech Mono', color: '#94a3b8', fontSize: 14, fontWeight: '700' }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUpdate} style={[{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: promptType === 'username' ? Colors.cyan : Colors.purple, alignItems: 'center' }, isWeb ? { boxShadow: `0 0 15px ${promptType === 'username' ? Colors.cyan : Colors.purple}40` } : {}]}>
                <Text style={{ fontFamily: 'Share Tech Mono', color: '#000', fontSize: 14, fontWeight: '900' }}>CONFIRM</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </ScrollView>
  );
}
