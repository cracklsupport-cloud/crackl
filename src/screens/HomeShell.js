import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Image, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import Colors from '../theme/colors';
import { useResponsive } from '../theme/breakpoints';
import { usePanicSync } from '../components/PanicModeOrchestrator';
import Icons from '../components/Icons';
import { useUser } from '../utils/UserContext';
import DashboardPage from './DashboardPage';
import LeaderboardPage from './LeaderboardPage';
import WalletPage from './WalletPage';
import ProfilePage from './ProfilePage';
import CaseFilesPage from './CaseFilesPage';

const NeuralBg = require('../../assets/ChatGPT Image Apr 2, 2026, 11_00_53 AM.png');
const PanicBg = require('../../assets/panic.png');

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
const grotesk = isWeb ? '"Space Grotesk", sans-serif' : undefined;
const display = isWeb ? '"Black Ops One", sans-serif' : undefined;

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

export default function HomeShell({ user: propUser, active, go, update, play, multi, panicMode, setPanicMode }) {
  // Use context user for instant sync; fall back to prop
  const ctx = useUser();
  const user = ctx?.user || propUser;
  const syncUser = ctx?.syncUser;
  const optimalUpdate = syncUser || update;
  usePanicSync(panicMode);
  const { isMobile: isMobileNav, isPhone } = useResponsive();

  const [isRadioActive, setIsRadioActive] = useState(false);
  const [showPanicInfo, setShowPanicInfo] = useState(false);
  const panicHoverTimer = useRef(null);
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

  async function logout() {
    await AsyncStorage.removeItem('crackl_user');
    await AsyncStorage.removeItem('crackl_token');
    go('auth');
  }

  const navItems = [
    { id: 'home', icon: Icons.HomeIcon, label: 'HUB' },
    { id: 'board', icon: Icons.TargetIcon, label: 'RANK' },
    { id: 'cases', icon: Icons.ArchiveIcon, label: 'CASE FILES' },
    { id: 'cash', icon: Icons.IntelIcon, label: 'VAULT' },
  ];

  const themeAccent = panicMode ? '#ff2a2a' : '#00ffd0';
  const themeBg = panicMode ? '#0a0000' : '#050505';
  const themeGlow = panicMode ? 'rgba(255,42,42,0.15)' : 'rgba(0,255,208,0.15)';

  const panicBg = isWeb && panicMode ? { backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,42,42,0.2) 4px, rgba(255,42,42,0.2) 8px)' } : {};
  const headerGlowBar = isWeb ? { backgroundImage: panicMode ? 'linear-gradient(to right, #dc2626, #f97316, #dc2626)' : 'linear-gradient(to right, rgba(0,255,208,0.5), rgba(0,255,208,0.1), transparent)' } : { backgroundColor: themeAccent };

  return (
    <View style={{ flex: 1, backgroundColor: themeBg, overflow: 'hidden' }}>

      {/* Full-page background — swaps on panic mode */}
      <Image
        source={panicMode ? PanicBg : NeuralBg}
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', resizeMode: 'cover', opacity: panicMode ? 0.2 : 0.45, zIndex: 0 }, isWeb ? { objectFit: 'cover', imageRendering: 'auto' } : {}]}
      />

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
            <CrosshairIcon style={{ position: 'absolute', top: '33%', left: '33%', transform: [{ translateX: -6 }, { translateY: -6 }] }} />
            <CrosshairIcon style={{ position: 'absolute', top: '33%', left: '66%', transform: [{ translateX: -6 }, { translateY: -6 }] }} />
            <CrosshairIcon style={{ position: 'absolute', top: '66%', left: '33%', transform: [{ translateX: -6 }, { translateY: -6 }] }} />
            <CrosshairIcon style={{ position: 'absolute', top: '66%', left: '66%', transform: [{ translateX: -6 }, { translateY: -6 }] }} />
          </View>
        </>
      )}

      <View style={{ flex: 1, padding: isMobileNav ? (isPhone ? 6 : 12) : 24, alignItems: 'center' }}>

        <View style={[{
          zIndex: 40, flexDirection: 'row', alignItems: 'center', gap: isMobileNav ? (isPhone ? 8 : 16) : 80,
          paddingHorizontal: isMobileNav ? (isPhone ? 10 : 16) : 40, paddingVertical: isMobileNav ? 8 : 7,
          borderRadius: 24, borderWidth: 1, borderColor: panicMode ? 'rgba(255,42,42,0.3)' : 'rgba(255,255,255,0.1)',
          backgroundColor: panicMode ? 'rgba(20,0,0,0.6)' : 'rgba(10,10,12,0.6)',
          overflow: 'hidden', position: 'relative'
        }, isWeb ? { backdropFilter: 'blur(24px)', boxShadow: `0 10px 40px ${themeGlow}` } : {}]}>

          <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: 4 }, headerGlowBar, isWeb && panicMode ? { animation: 'pulse 2s infinite' } : {}]} />

          {/* LEFT GROUP: logo + nav */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => go('home')} style={[{ flexDirection: 'row', alignItems: 'center', gap: isPhone ? 8 : 12 }, isWeb ? { cursor: 'pointer' } : {}]}>
              <View style={[{ width: isPhone ? 36 : 48, height: isPhone ? 36 : 48, borderRadius: isPhone ? 10 : 14, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 2, borderColor: panicMode ? 'rgba(255,42,42,0.4)' : 'rgba(0,255,208,0.3)', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }, isWeb ? { boxShadow: `0 0 20px rgba(0,255,208,0.1)` } : {}]}>
                <Image source={require('../../assets/brain_logo.png')} style={{ width: (isPhone ? 36 : 48) * 1.6, height: (isPhone ? 36 : 48) * 1.6, resizeMode: 'cover' }} />
              </View>
              <View>
                <Text style={{ fontFamily: isWeb ? '"Orbitron", "Space Grotesk", sans-serif' : undefined, fontWeight: '700', fontSize: isPhone ? 18 : 24, color: '#fff', letterSpacing: isPhone ? 0.8 : 1.2, lineHeight: isPhone ? 18 : 24, textTransform: 'uppercase' }}>CRACKL</Text>
                {!isPhone && <Text style={{ fontFamily: mono, fontSize: 11, color: '#64748b', letterSpacing: 2.6, marginTop: 2 }}>SYS_RDY // V.5.0</Text>}
              </View>
            </TouchableOpacity>

            {!isMobileNav && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 24 }} />
                {navItems.map((n, i) => {
                  const isActive = active === n.id;
                  return (
                    <TouchableOpacity key={n.id} onPress={() => go(n.id)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: isActive ? 'rgba(255,255,255,0.05)' : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: mono, color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>{`0${i + 1}`}</Text>
                      <Text style={{ fontFamily: mono, color: isActive ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: '900', letterSpacing: 2 }}>{n.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: isMobileNav ? 10 : 12, flexShrink: 0 }}>
            <TouchableOpacity onPress={toggleRadio} style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }]}>
              <View style={{ position: 'absolute', inset: 0, backgroundColor: isRadioActive ? themeAccent : 'transparent', opacity: 0.05 }} />
              {isRadioActive ? <Icons.ZapIcon size={14} color={themeAccent} /> : <Icons.EyeOffIcon size={14} color="#64748b" />}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 12, gap: 2 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Animated.View key={i} style={{ width: 3, height: isRadioActive ? radioAnim.interpolate({ inputRange: [0, 1], outputRange: [Math.random() * 8 + 3, 12] }) : 3, backgroundColor: isRadioActive ? themeAccent : 'rgba(255,255,255,0.2)', borderRadius: 1 }} />
                ))}
              </View>
              {!isMobileNav && (
                <View>
                  <Text style={{ fontFamily: mono, fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: '900', letterSpacing: 1.2 }}>Stream</Text>
                  <Text style={{ fontFamily: mono, fontSize: 11, color: isRadioActive ? '#fff' : '#475569' }}>{isRadioActive ? (panicMode ? 'DARK.FM' : 'NEON.FM') : 'OFFLINE'}</Text>
                </View>
              )}
            </TouchableOpacity>

            {!isMobileNav && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <Icons.IntelIcon size={14} color="#00ffd0" />
                <Text style={{ fontFamily: mono, fontWeight: '900', fontSize: 14, color: '#fff' }}>{(user?.coins || 0).toLocaleString()}</Text>
              </View>
            )}

            {!isMobileNav && (
              <TouchableOpacity onPress={() => go('profile')} style={[{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#1e293b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }, isWeb ? { cursor: 'pointer' } : {}]}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                ) : (
                  <Icons.UserIcon size={14} color="#94a3b8" />
                )}
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#00ffd0', borderWidth: 1, borderColor: '#000' }} />
              </TouchableOpacity>
            )}

            {!isMobileNav && (
              <TouchableOpacity onPress={logout} style={[{ width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]}>
                <Icons.LogOutIcon size={14} color="#64748b" />
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'column', alignItems: 'center', gap: 4, paddingLeft: isMobileNav ? 0 : 12, borderLeftWidth: isMobileNav ? 0 : 1, borderColor: 'rgba(255,255,255,0.1)', position: 'relative' }}
              onMouseEnter={() => {
                if (isWeb) {
                  panicHoverTimer.current = setTimeout(() => setShowPanicInfo(true), 2000);
                }
              }}
              onMouseLeave={() => {
                if (isWeb) {
                  clearTimeout(panicHoverTimer.current);
                  setShowPanicInfo(false);
                }
              }}
            >


              {!isMobileNav && (
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Icons.ShieldIcon size={9} color={panicMode ? '#ff2a2a' : '#64748b'} />
                    <Text style={{ fontFamily: mono, fontSize: 10, color: panicMode ? '#ff2a2a' : '#64748b', letterSpacing: 1.8 }}>OVERRIDE</Text>
                  </View>
                  <Text style={[{ fontFamily: display, fontSize: 13, fontWeight: '900', color: panicMode ? '#fff' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }, isWeb && panicMode ? { textShadow: '0 0 8px rgba(255,42,42,0.8)' } : {}]}>{panicMode ? 'PANIC' : 'ENGAGE'}</Text>
                </View>
              )}
              <TouchableOpacity
                testID="panic-mode-toggle"
                accessibilityRole="switch"
                accessibilityState={{ checked: !!panicMode }}
                accessibilityLabel={panicMode ? 'Disable Panic Mode' : 'Enable Panic Mode'}
                onPress={() => setPanicMode(!panicMode)}
                style={[{ width: 76, height: 36, borderRadius: 36, borderWidth: 2, borderColor: panicMode ? '#ff2a2a' : 'rgba(255,255,255,0.1)', backgroundColor: panicMode ? '#3a0000' : '#000', position: 'relative', overflow: 'hidden', padding: 3 }, panicMode ? panicBg : {}]}
              >
                <View style={[{ position: 'absolute', top: 2, left: panicMode ? 38 : 2, width: 28, height: 28, borderRadius: 14, borderLeftWidth: 1, borderRightWidth: 1, backgroundColor: panicMode ? '#ff2a2a' : '#334155', borderColor: panicMode ? '#ff8888' : '#64748b', alignItems: 'center', justifyContent: 'center' }, isWeb ? { transition: 'left 0.4s cubic-bezier(0.17, 0.55, 0.55, 1)' } : {}]}>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    <View style={{ width: 2, height: 10, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                    <View style={{ width: 2, height: 14, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                    <View style={{ width: 2, height: 10, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>

          </View>
        </View>

        <View style={{ flex: 1, width: '100%', maxWidth: 1360, marginTop: 24, zIndex: 10 }}>
          {active === 'home' && <DashboardPage user={user} play={play} multi={multi} go={go} panicMode={panicMode} setPanicMode={setPanicMode} />}
          {active === 'board' && <LeaderboardPage user={user} />}
          {active === 'cases' && <CaseFilesPage user={user} go={go} />}
          {active === 'cash' && <WalletPage user={user} update={optimalUpdate} />}
          {active === 'profile' && <ProfilePage user={user} go={go} update={optimalUpdate} syncUser={syncUser} />}
        </View>

      </View>

      {isMobileNav && (
        <View style={[{
          height: isPhone ? 60 : 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
          backgroundColor: panicMode ? 'rgba(20,0,0,0.95)' : 'rgba(5,5,5,0.95)',
          borderTopWidth: 1, borderColor: panicMode ? 'rgba(255,42,42,0.3)' : 'rgba(255,255,255,0.1)',
          zIndex: 50, paddingHorizontal: isPhone ? 4 : 0,
        }, isWeb ? { backdropFilter: 'blur(24px)' } : {}]}>
          {[
            { id: 'home', icon: Icons.HomeIcon, label: 'HUB' },
            { id: 'board', icon: Icons.TargetIcon, label: 'RANK' },
            { id: 'cases', icon: Icons.ArchiveIcon, label: 'FILES' },
            { id: 'profile', icon: Icons.UserIcon, label: 'PROFILE' },
            { id: '_logout', icon: Icons.LogOutIcon, label: 'EXIT' },
          ].map((n) => {
            const isActive = active === n.id;
            if (n.id === '_logout') {
              return (
                <TouchableOpacity key={n.id} onPress={logout} style={{ alignItems: 'center', padding: isPhone ? 4 : 8 }}>
                  <View style={{ padding: isPhone ? 6 : 8, borderRadius: 10 }}>
                    <n.icon size={isPhone ? 18 : 22} color="#ef4444" />
                  </View>
                  <Text style={{ fontFamily: mono, fontSize: isPhone ? 10 : 11, color: '#ef4444', marginTop: isPhone ? 2 : 4, letterSpacing: 1 }}>{n.label}</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={n.id} onPress={() => go(n.id)} style={{ alignItems: 'center', padding: isPhone ? 4 : 8 }}>
                <View style={{ padding: isPhone ? 6 : 8, borderRadius: 10, backgroundColor: isActive ? (panicMode ? 'rgba(255,42,42,0.2)' : 'rgba(0,255,208,0.2)') : 'transparent' }}>
                  <n.icon size={isPhone ? 18 : 22} color={isActive ? themeAccent : '#64748b'} />
                </View>
                <Text style={{ fontFamily: mono, fontSize: isPhone ? 10 : 11, color: isActive ? themeAccent : '#64748b', marginTop: isPhone ? 2 : 4, letterSpacing: 1 }}>{n.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Panic Mode Tooltip — moved to root so it escapes header clipping completely */}
      {showPanicInfo && !isMobileNav && isWeb && (
        <div style={{
          position: 'fixed', top: 100, right: 24, width: 280, zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.97)',
          border: `1px solid ${panicMode ? 'rgba(255,42,42,0.5)' : 'rgba(0,255,208,0.4)'}`,
          borderRadius: 12, padding: 16,
          boxShadow: panicMode ? '0 10px 40px rgba(255,42,42,0.3)' : '0 10px 40px rgba(0,255,208,0.15)',
          fontFamily: '"JetBrains Mono", monospace',
          pointerEvents: 'none'
        }}>
          <div style={{ color: panicMode ? '#ff2a2a' : '#00ffd0', fontSize: 11, fontWeight: 900, letterSpacing: 1.6, marginBottom: 8 }}>CLASSIFIED PROTOCOL</div>
          <div style={{ color: '#e2e8f0', fontSize: 11, lineHeight: '18px', marginBottom: 12 }}>
            Engage Panic Mode to test your limits. You'll be solving under extreme time pressure with higher stakes.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: panicMode ? '#ff2a2a' : '#fbbf24', fontSize: 12 }}>⏱</span>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>Solving under time, under pressure</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: panicMode ? '#ff2a2a' : '#00ffd0', fontSize: 12 }}>⚡</span>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>Shorter timers, sharper pressure, and bonus Intel on clears</span>
            </div>
          </div>
        </div>
      )}

    </View>
  );
}
