import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
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

export default function MultiSetupScreen({ user, go, setRoom }) {
  const [tab, setTab] = useState('create');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState({ mode:'mcq', timed:true, timeLimit:30, maxPlayers:4 });
  const accent = Colors.purple;

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
    <TouchableOpacity style={[{
      paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12,
      backgroundColor: on ? col+'12' : 'rgba(255,255,255,0.02)',
      borderWidth: 1.5, borderColor: on ? col : 'rgba(255,255,255,0.08)',
      flexDirection: 'row', alignItems: 'center', gap: 8
    }, isWeb ? { transition: 'all 0.2s ease', cursor: 'pointer' } : {}]} onPress={onPress}>
      {IconComp && <IconComp size={14} color={on?col:Colors.textSecondary} />}
      <Text style={{ color: on?col:Colors.textSecondary, fontFamily: 'Chakra Petch', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 }}>{lbl}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <ArenaOverlay />
      {isWeb && <View style={{ position: 'absolute', top: '20%', left: '20%', width: 400, height: 400, borderRadius: 200, backgroundColor: accent, opacity: 0.04, pointerEvents: 'none' }} />}

      <View style={[{
        height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        zIndex: 10, backgroundColor: 'rgba(10,10,12,0.8)',
      }, isWeb ? { backdropFilter: 'blur(24px)' } : {}]}>
        <TouchableOpacity style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, isWeb ? { transition: 'all 0.2s ease' } : {}]} onPress={() => go('home')}>
          <Icons.ChevronLeftIcon size={12} color="#00ffd0" />
          <Text style={{ color: '#00ffd0', fontFamily: mono, fontWeight: '800', fontSize: 12, letterSpacing: 2 }}>ABORT</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icons.SwordsIcon size={18} color={'#fff'} />
          <Text style={{ color: Colors.textPrimary, fontFamily: grotesk, fontWeight: '900', fontSize: 18, letterSpacing: 1, textTransform: 'uppercase' }}>Secure Uplink</Text>
        </View>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={{ maxWidth: 600, alignSelf: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 24 }} showsVerticalScrollIndicator={false}>
        {/* Tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
          <TouchableOpacity style={[{
            flex: 1, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
            backgroundColor: tab==='create' ? '#fff' : 'rgba(255,255,255,0.02)',
            borderWidth: 1, borderColor: tab==='create' ? '#fff' : 'rgba(255,255,255,0.08)'
          }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]} onPress={() => setTab('create')}>
            <Icons.PlusIcon size={16} color={tab==='create'?'#000':Colors.textSecondary} />
            <Text style={{ color: tab==='create'?'#000':Colors.textSecondary, fontFamily: 'Chakra Petch', fontWeight: '800', fontSize: 14, letterSpacing: 1 }}>HOST NODE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[{
            flex: 1, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
            backgroundColor: tab==='join' ? '#fff' : 'rgba(255,255,255,0.02)',
            borderWidth: 1, borderColor: tab==='join' ? '#fff' : 'rgba(255,255,255,0.08)'
          }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]} onPress={() => setTab('join')}>
            <Icons.TargetIcon size={16} color={tab==='join'?'#000':Colors.textSecondary} />
            <Text style={{ color: tab==='join'?'#000':Colors.textSecondary, fontFamily: 'Chakra Petch', fontWeight: '800', fontSize: 14, letterSpacing: 1 }}>JOIN NODE</Text>
          </TouchableOpacity>
        </View>

        {tab === 'create' && (
          <View style={{ gap: 24 }}>
            <View>
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }}>INTERROGATION MODE</Text>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                <Opt lbl="QUICK CRACK" icon={Icons.ZapIcon} on={cfg.mode==='mcq'} col={Colors.cyan} onPress={() => setCfg({...cfg,mode:'mcq'})} />
                <Opt lbl="BRAIN BLAST" icon={Icons.DatabaseIcon} on={cfg.mode==='type'} col={accent} onPress={() => setCfg({...cfg,mode:'type'})} />
              </View>
            </View>
            <View>
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }}>TEMPORAL CONSTRAINTS</Text>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                <Opt lbl="TIMED" icon={Icons.TimerIcon} on={cfg.timed} col={Colors.gold} onPress={() => setCfg({...cfg,timed:true})} />
                <Opt lbl="NO LIMIT" icon={Icons.ShieldIcon} on={!cfg.timed} col={Colors.gold} onPress={() => setCfg({...cfg,timed:false})} />
              </View>
            </View>
            {cfg.timed && <View>
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }}>SECONDS PER CYCLE</Text>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                {[20,30,45,60].map(v => <Opt key={v} lbl={`${v}s`} on={cfg.timeLimit===v} col={Colors.orange} onPress={() => setCfg({...cfg,timeLimit:v})} />)}
              </View>
            </View>}
            <View>
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }}>MAXIMUM OPERATIVES</Text>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                {[2,3,4,5].map(v => <Opt key={v} lbl={String(v)} on={cfg.maxPlayers===v} col={Colors.fuchsia} onPress={() => setCfg({...cfg,maxPlayers:v})} />)}
              </View>
            </View>
            <TouchableOpacity style={[{
              backgroundColor: '#fff', paddingVertical: 18, borderRadius: 12,
              flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16,
              opacity: loading?0.5:1
            }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]} onPress={createRoom} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <><Icons.TerminalIcon size={16} color={'#000'} /><Text style={{ color: '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>INITIALIZE NODE</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {tab === 'join' && (
          <View style={{ gap: 24, alignItems: 'center', marginTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icons.LockIcon size={16} color={Colors.textSecondary} />
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 14 }}>Enter the 6-letter cipher from your host</Text>
            </View>
            <TextInput
              style={[{
                width: '100%', backgroundColor: '#050505', borderWidth: 2, borderColor: code.length === 6 ? '#00ffd060' : 'rgba(255,255,255,0.08)',
                borderRadius: 16, textAlign: 'center', fontFamily: mono, fontSize: 36, fontWeight: '900', letterSpacing: 14,
                color: accent, paddingVertical: 24
              }, isWeb ? { outlineStyle: 'none', transition: 'all 0.3s ease', boxShadow: code.length === 6 ? '0 0 20px rgba(0,255,208,0.1)' : 'none' } : {}]}
              placeholder="XXXXXX" placeholderTextColor={Colors.textMuted}
              value={code} onChangeText={t => setCode(t.toUpperCase())}
              maxLength={6} autoCapitalize="characters"
            />
            <TouchableOpacity style={[{
              width: '100%', backgroundColor: '#fff', paddingVertical: 18, borderRadius: 12,
              flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
              opacity: (loading || code.length < 6) ? 0.5 : 1
            }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]} onPress={joinRoom} disabled={loading || code.length < 6}>
              {loading ? <ActivityIndicator color="#000" /> : <><Icons.LinkIcon size={16} color={'#000'} /><Text style={{ color: '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>ESTABLISH LINK</Text></>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
