import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Image, useWindowDimensions, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import Colors from '../theme/colors';
import { usePanicSync } from '../components/PanicModeOrchestrator';
import Icons from '../components/Icons';
import DashboardPage from './DashboardPage';
import LeaderboardPage from './LeaderboardPage';
import WalletPage from './WalletPage';
import ProfilePage from './ProfilePage';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
const grotesk = isWeb ? '"Space Grotesk", sans-serif' : undefined;

function CrosshairIcon({ style }) {
  if (!isWeb) return null;
  return (
    <div style={{ ...style, width: 12, height: 12, color: 'rgba(255,255,255,0.2)' }}>
      <svg width="100%" height="100%" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 0V12" stroke="currentColor" strokeWidth="1" />
        <path d="M0 6H12" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
}

const BlackMarketPage = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#64748b', fontFamily: mono, letterSpacing: 4, fontSize: 12 }}>SYSTEM LOCKED — BLACK MARKET OFFLINE</Text>
  </View>
);

export default function HomeShell({ user, active, go, update, play, multi, panicMode, setPanicMode }) {
  usePanicSync(panicMode);
  const { width: winW } = useWindowDimensions();
  const isMobileNav = winW < 768;

  const [isRadioActive, setIsRadioActive] = useState(false);
  const [sound, setSound] = useState(null);
  const radioAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  useEffect(() => {
    if (isRadioActive) {
      Animated.loop(Animated.sequence([
        Animated.timing(radioAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(radioAnim, { toValue: 0.3, duration: 600, useNativeDriver: false }),
      ])).start();
    } else {
      radioAnim.stopAnimation();
      radioAnim.setValue(0.2);
    }
  }, [isRadioActive]);

  const toggleRadio = async () => {
    if (isRadioActive && sound) {
      await sound.pauseAsync();
      setIsRadioActive(false);
    } else {
      if (!sound) {
        try {
          const streamUrl = panicMode ? "https://stream.nightride.fm/darksynth.m4a" : "https://stream.nightride.fm/nightride.m4a";
          const { sound: s } = await Audio.Sound.createAsync({ uri: streamUrl });
          setSound(s);
          await s.playAsync();
          setIsRadioActive(true);
        } catch (e) { console.log('Audio error:', e); }
      } else {
        await sound.playAsync();
        setIsRadioActive(true);
      }
    }
  };

  const [mousePos, setMousePos] = useState({ x: -9999, y: -9999 });
  useEffect(() => {
    if (!isWeb) return;
    const fn = e => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', fn);
    return () => window.removeEventListener('mousemove', fn);
  }, []);

  async function logout() { await AsyncStorage.removeItem('crackl_user'); go('auth'); }

  const navItems = [
    { id: 'home', icon: Icons.HomeIcon, label: 'HUB' },
    { id: 'board', icon: Icons.TargetIcon, label: 'RANK' },
    { id: 'cash', icon: Icons.IntelIcon, label: 'VAULT' },
  ];

  const themeAccent = panicMode ? '#ff2a2a' : '#00ffd0';
  const themeBg = panicMode ? '#0a0000' : '#050505';
  const themeGlow = panicMode ? 'rgba(255,42,42,0.15)' : 'rgba(0,255,208,0.15)';

  const panicBg = isWeb && panicMode ? { backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,42,42,0.2) 4px, rgba(255,42,42,0.2) 8px)' } : {};
  const headerGlowBar = isWeb ? { backgroundImage: panicMode ? 'linear-gradient(to right, #dc2626, #f97316, #dc2626)' : 'linear-gradient(to right, rgba(0,255,208,0.5), rgba(0,255,208,0.1), transparent)' } : { backgroundColor: themeAccent };

  return (
    <View style={{ flex: 1, backgroundColor: themeBg, overflow: 'hidden' }}>

      {isWeb && (
        <>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.15, mixBlendMode: 'overlay', backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
          {!isMobileNav && (
            <div style={{
              position: 'fixed', width: 600, height: 600, borderRadius: '50%',
              backgroundColor: themeAccent, opacity: 0.3, filter: 'blur(150px)', mixBlendMode: 'screen',
              pointerEvents: 'none', zIndex: 0,
              transform: `translate(${mousePos.x - 300}px, ${mousePos.y - 300}px)`,
              transition: 'transform 1s cubic-bezier(0.17, 0.55, 0.55, 1), background-color 1s ease',
            }} />
          )}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.05)', top: '33%' }} />
            <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.05)', bottom: '33%' }} />
            <View style={{ position: 'absolute', height: '100%', width: 1, backgroundColor: 'rgba(255,255,255,0.05)', left: '33%' }} />
            <View style={{ position: 'absolute', height: '100%', width: 1, backgroundColor: 'rgba(255,255,255,0.05)', right: '33%' }} />
            <CrosshairIcon style={{ position: 'absolute', top: '33%', left: '33%', transform: [{translateX: -6},{translateY:-6}] }} />
            <CrosshairIcon style={{ position: 'absolute', top: '33%', left: '66%', transform: [{translateX: -6},{translateY:-6}] }} />
            <CrosshairIcon style={{ position: 'absolute', top: '66%', left: '33%', transform: [{translateX: -6},{translateY:-6}] }} />
            <CrosshairIcon style={{ position: 'absolute', top: '66%', left: '66%', transform: [{translateX: -6},{translateY:-6}] }} />
          </View>
        </>
      )}

      <View style={{ flex: 1, padding: isMobileNav ? 12 : 32, alignItems: 'center' }}>
        
        <View style={[{
          width: '100%', maxWidth: 1280, zIndex: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: isMobileNav ? 16 : 24, paddingVertical: isMobileNav ? 12 : 16,
          borderRadius: 16, borderWidth: 1, borderColor: panicMode ? 'rgba(255,42,42,0.3)' : 'rgba(255,255,255,0.1)',
          backgroundColor: panicMode ? 'rgba(20,0,0,0.6)' : 'rgba(10,10,12,0.6)',
          overflow: 'hidden', position: 'relative'
        }, isWeb ? { backdropFilter: 'blur(24px)', boxShadow: `0 10px 40px ${themeGlow}` } : {}]}>
          
          <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: 4 }, headerGlowBar, isWeb && panicMode ? { animation: 'pulse 2s infinite' } : {}]} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 2, borderColor: panicMode ? 'rgba(255,42,42,0.4)': 'rgba(0,255,208,0.3)', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }, isWeb ? { boxShadow: `0 0 20px rgba(0,255,208,0.1)` } : {}]}>
              <Image source={require('../../assets/brain_logo.png')} style={{ width: 40 * 1.6, height: 40 * 1.6, resizeMode: 'cover' }} />
            </View>
            <View>
              <Text style={{ fontFamily: grotesk, fontWeight: '900', fontSize: 24, color: '#fff', letterSpacing: -1, lineHeight: 24 }}>CRACKL<Text style={{ color: themeAccent }}>.</Text></Text>
              <Text style={{ fontFamily: mono, fontSize: 9, color: '#64748b', letterSpacing: 3, marginTop: 2 }}>SYS_RDY // V.5.0</Text>
            </View>
          </View>

          {!isMobileNav && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 24 }} />
              {navItems.map((n, i) => {
                const isActive = active === n.id;
                return (
                  <TouchableOpacity key={n.id} onPress={() => go(n.id)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: isActive ? 'rgba(255,255,255,0.05)' : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: mono, color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>{`0${i+1}`}</Text>
                    <Text style={{ fontFamily: mono, color: isActive ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>{n.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: isMobileNav ? 16 : 32 }}>
            <TouchableOpacity onPress={toggleRadio} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }]}>
              <View style={{ position: 'absolute', inset: 0, backgroundColor: isRadioActive ? themeAccent : 'transparent', opacity: 0.05 }} />
              {isRadioActive ? <Icons.ZapIcon size={14} color={themeAccent} /> : <Icons.EyeOffIcon size={14} color="#64748b" />}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 12, gap: 2 }}>
                {[1,2,3,4,5].map(i => (
                  <Animated.View key={i} style={{ width: 4, height: isRadioActive ? radioAnim.interpolate({ inputRange: [0, 1], outputRange: [Math.random()*10+4, 12] }) : 4, backgroundColor: isRadioActive ? themeAccent : 'rgba(255,255,255,0.2)', borderRadius: 1 }} />
                ))}
              </View>
              {!isMobileNav && (
                <View>
                  <Text style={{ fontFamily: mono, fontSize: 8, color: '#64748b', textTransform: 'uppercase', fontWeight: '900' }}>Stream</Text>
                  <Text style={{ fontFamily: mono, fontSize: 10, color: isRadioActive ? '#fff' : '#475569' }}>{isRadioActive ? (panicMode ? 'DARK.FM' : 'NEON.FM') : 'OFFLINE'}</Text>
                </View>
              )}
            </TouchableOpacity>

            {!isMobileNav && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <Icons.IntelIcon size={14} color="#00ffd0" />
                <Text style={{ fontFamily: mono, fontWeight: '900', fontSize: 14, color: '#fff' }}>{(user?.coins || 0).toLocaleString()}</Text>
              </View>
            )}

            {!isMobileNav && (
              <TouchableOpacity onPress={() => go('profile')} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <Icons.UserIcon size={14} color="#94a3b8" />
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#00ffd0', borderWidth: 1, borderColor: '#000' }} />
              </TouchableOpacity>
            )}

            {/* Logout Button */}
            {!isMobileNav && (
              <TouchableOpacity onPress={logout} style={[{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]}>
                <Icons.LogOutIcon size={14} color="#64748b" />
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: isMobileNav ? 0 : 24, borderLeftWidth: isMobileNav ? 0 : 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              {!isMobileNav && (
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icons.ShieldIcon size={10} color={panicMode ? '#ff2a2a' : '#64748b'} />
                    <Text style={{ fontFamily: mono, fontSize: 9, color: panicMode ? '#ff2a2a' : '#64748b', letterSpacing: 2 }}>OVERRIDE</Text>
                  </View>
                  <Text style={[{ fontFamily: grotesk, fontSize: 14, fontWeight: '900', color: panicMode ? '#fff' : '#94a3b8', textTransform: 'uppercase' }, isWeb && panicMode ? { textShadow: '0 0 8px rgba(255,42,42,0.8)' } : {}]}>{panicMode ? 'PANIC' : 'ENGAGE'}</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => setPanicMode(!panicMode)} style={[{ width: 80, height: 40, borderRadius: 40, borderWidth: 2, borderColor: panicMode ? '#ff2a2a' : 'rgba(255,255,255,0.1)', backgroundColor: panicMode ? '#3a0000' : '#000', position: 'relative', overflow: 'hidden', padding: 4 }, panicMode ? panicBg : {}]}>
                <View style={[{ position: 'absolute', top: 2, left: panicMode ? 38 : 2, width: 32, height: 32, borderRadius: 16, borderLeftWidth: 1, borderRightWidth: 1, backgroundColor: panicMode ? '#ff2a2a' : '#334155', borderColor: panicMode ? '#ff8888' : '#64748b', alignItems: 'center', justifyContent: 'center' }, isWeb ? { transition: 'left 0.4s cubic-bezier(0.17, 0.55, 0.55, 1)' } : {}]}>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                     <View style={{ width: 2, height: 12, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                     <View style={{ width: 2, height: 16, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                     <View style={{ width: 2, height: 12, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>

          </View>
        </View>

        <View style={{ flex: 1, width: '100%', maxWidth: 1280, marginTop: 24, zIndex: 10 }}>
          {active === 'home' && <DashboardPage user={user} play={play} multi={multi} go={go} panicMode={panicMode} setPanicMode={setPanicMode} />}
          {active === 'board' && <LeaderboardPage user={user} />}
          {active === 'cash' && <WalletPage user={user} update={update} />}
          {active === 'profile' && <ProfilePage user={user} go={go} />}
        </View>

      </View>

      {isMobileNav && (
        <View style={[{
          height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
          backgroundColor: panicMode ? 'rgba(20,0,0,0.95)' : 'rgba(5,5,5,0.95)',
          borderTopWidth: 1, borderColor: panicMode ? 'rgba(255,42,42,0.3)' : 'rgba(255,255,255,0.1)',
          zIndex: 50,
        }, isWeb ? { backdropFilter: 'blur(24px)' } : {}]}>
          {[
            { id: 'home', icon: Icons.HomeIcon, label: 'HUB' },
            { id: 'board', icon: Icons.TargetIcon, label: 'RANK' },
            { id: 'profile', icon: Icons.UserIcon, label: 'PROFILE' },
            { id: '_logout', icon: Icons.LogOutIcon, label: 'EXIT' },
          ].map((n) => {
            const isActive = active === n.id;
            if (n.id === '_logout') {
              return (
                <TouchableOpacity key={n.id} onPress={logout} style={{ alignItems: 'center', padding: 8 }}>
                  <View style={{ padding: 6, borderRadius: 8 }}>
                    <n.icon size={20} color="#ef4444" />
                  </View>
                  <Text style={{ fontFamily: mono, fontSize: 8, color: '#ef4444', marginTop: 4, letterSpacing: 1 }}>{n.label}</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={n.id} onPress={() => go(n.id)} style={{ alignItems: 'center', padding: 8 }}>
                <View style={{ padding: 6, borderRadius: 8, backgroundColor: isActive ? (panicMode ? 'rgba(255,42,42,0.2)' : 'rgba(0,255,208,0.2)') : 'transparent' }}>
                  <n.icon size={20} color={isActive ? themeAccent : '#64748b'} />
                </View>
                <Text style={{ fontFamily: mono, fontSize: 8, color: isActive ? themeAccent : '#64748b', marginTop: 4, letterSpacing: 1 }}>{n.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

    </View>
  );
}
