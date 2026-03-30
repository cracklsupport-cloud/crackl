import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Platform, useWindowDimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../theme/colors';
import Icons from '../components/Icons';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
const grotesk = isWeb ? '"Space Grotesk", sans-serif' : undefined;
const BrainImage = require('../../assets/brain_logo.png');

/* ── Corner Brackets ── */
function CornerBrackets() {
  const s = { position: 'absolute', width: 12, height: 12, borderColor: 'rgba(255,255,255,0.2)', zIndex: 10 };
  return (
    <>
      <View style={{ ...s, top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 }} />
      <View style={{ ...s, top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 }} />
      <View style={{ ...s, bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 }} />
      <View style={{ ...s, bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 }} />
    </>
  );
}

/* ── Arena Card (Row-style, matching ArenaGrid.tsx) ── */
function ArenaCard({ icon: IconComp, iconColor, title, subtitle, action, onPress, panicMode }) {
  const [hovered, setHovered] = useState(false);
  const accent = panicMode ? '#ff2a2a' : iconColor;
  const hoverBg = panicMode ? 'rgba(255,42,42,0.08)' : 'rgba(99,102,241,0.08)';
  return (
    <TouchableOpacity
      onPress={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      activeOpacity={0.7}
      style={[{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 20, borderRadius: 12,
        backgroundColor: hovered ? hoverBg : 'rgba(10,10,12,0.4)',
        borderWidth: 1, borderColor: panicMode ? 'rgba(255,42,42,0.2)' : 'rgba(255,255,255,0.08)',
        overflow: 'hidden', position: 'relative',
      }, isWeb ? { backdropFilter: 'blur(12px)', cursor: 'pointer', transition: 'all 0.3s ease' } : {}]}
    >
      {/* Background glow on hover */}
      {isWeb && <View style={{ position: 'absolute', inset: 0, backgroundColor: hovered ? (panicMode ? 'rgba(255,42,42,0.05)' : 'rgba(99,102,241,0.05)') : 'transparent', transition: 'background-color 0.3s ease' }} />}
      
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, zIndex: 10 }}>
        <View style={[{
          width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1,
          borderColor: panicMode ? 'rgba(255,42,42,0.2)' : 'rgba(255,255,255,0.08)',
        }, isWeb ? { boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' } : {}]}>
          <IconComp size={24} color={panicMode ? '#ff4444' : iconColor} />
        </View>
        <View>
          <Text style={{ fontFamily: grotesk, fontSize: 14, fontWeight: '900', color: panicMode ? '#fecaca' : '#e2e8f0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{title}</Text>
          <Text style={{ fontFamily: mono, fontSize: 11, color: '#64748b', letterSpacing: 0.5 }}>{subtitle}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 10 }}>
        <Text style={[{ fontFamily: mono, fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', color: panicMode ? '#dc2626' : '#6366f1' }, isWeb && hovered ? { color: panicMode ? '#ff4444' : '#818cf8' } : {}]}>{action}</Text>
        <Text style={[{ fontFamily: mono, fontSize: 14, color: panicMode ? '#dc2626' : '#6366f1', opacity: hovered ? 1 : 0 }, isWeb ? { transform: hovered ? 'translateX(0px)' : 'translateX(-10px)', transition: 'all 0.3s ease' } : {}]}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ═══ MAIN DASHBOARD ═══ */
export default function DashboardPage({ user, play, multi, go, panicMode, setPanicMode }) {
  const { width: winW } = useWindowDimensions();
  const isMobile = winW < 800;
  const themeAccent = panicMode ? '#ff2a2a' : '#00ffd0';

  const [heroHover, setHeroHover] = useState(false);
  const tickerAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(tickerAnim, { toValue: -1000, duration: 20000, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 4000, useNativeDriver: true })).start();
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  /* ── Real user data ── */
  const lvl = Math.floor((user?.xp ?? 0) / 50) + 1;
  const winRate = user?.gamesPlayed > 0 ? ((user?.gamesWon || 0) / user.gamesPlayed * 100).toFixed(1) + '%' : '--';
  const bestStreak = user?.streak ?? 0;
  const totalPlayed = user?.gamesPlayed ?? 0;

  /* ── All 8 game modes ── */
  const gameArenas = [
    { icon: Icons.ActivityIcon, iconColor: '#22d3ee', title: 'Standard Queue', subtitle: 'Classic unranked matchmaking', action: 'Play Now', onPress: () => play('mcq') },
    { icon: Icons.ZapIcon, iconColor: '#fbbf24', title: 'Brain Blast', subtitle: 'Speed-focused cognitive trials', action: 'Play For', onPress: () => play('type') },
    { icon: Icons.CrosshairIcon, iconColor: '#818cf8', title: 'Ranked 1v1', subtitle: 'Compete for global ELO', action: 'Find Match', onPress: () => multi() },
    { icon: Icons.ClockIcon, iconColor: '#34d399', title: 'Daily Drop', subtitle: 'New challenge every 24h', action: 'Play', onPress: () => go('daily') },
  ];

  const specialArenas = [
    { icon: Icons.ShieldIcon, iconColor: '#f97316', title: 'Gauntlet', subtitle: 'Survive as long as possible', action: 'Enter', onPress: () => go('gauntlet') },
    { icon: Icons.LinkIcon, iconColor: '#ec4899', title: 'The Chain', subtitle: 'Connected nodes & lore', action: 'Unlock', onPress: () => go('chain') },
    { icon: Icons.EyeOffIcon, iconColor: '#ef4444', title: 'Blind Wager', subtitle: 'Risk coins on unknown puzzles', action: 'Wager', onPress: () => go('wager') },
    { icon: Icons.FlameIcon, iconColor: '#eab308', title: 'Bounty Board', subtitle: 'Crowdfund high-reward cases', action: 'Hunt', onPress: () => go('bounty') },
  ];

  /* ── Background stripes ── */
  const stripeStyle = isWeb ? {
    backgroundImage: panicMode
      ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,0,0,0.05) 10px, rgba(255,0,0,0.05) 20px)'
      : 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 20px)'
  } : {};

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: isMobile ? 12 : 0, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 24 }}>

        {/* ══════════ LEFT SIDEBAR ══════════ */}
        <View style={{ width: isMobile ? '100%' : 288, gap: 24 }}>
          
          {/* Profile Card */}
          <View style={[{
            borderRadius: 24, padding: 4,
            backgroundColor: 'rgba(10,10,12,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden'
          }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}>
            <View style={[{
              borderRadius: 22, backgroundColor: '#050505', padding: 24, height: isMobile ? undefined : 400,
              flexDirection: 'column', position: 'relative', overflow: 'hidden'
            }, stripeStyle]}>
              
              <Text style={{ position: 'absolute', top: 16, right: 16, fontFamily: mono, fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>USR_ID_{user?.id || '0911'}</Text>
              
              <View style={{ position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', gap: 4 }}>
                {[1,2,3,4].map(i => (
                  <View key={i} style={{ width: 4, height: 12, backgroundColor: i === 4 ? 'rgba(255,255,255,0.1)' : themeAccent, opacity: 0.8 }} />
                ))}
              </View>

              <View style={{ alignItems: 'center', marginTop: 32, zIndex: 10 }}>
                {/* Brain Logo as Avatar */}
                <View style={[{ width: 112, height: 112, borderRadius: 56, borderWidth: 4, borderColor: '#050505', marginBottom: 16, overflow: 'hidden', backgroundColor: '#0a0a0c' }, panicMode && isWeb ? { boxShadow: '0 0 0 2px #ff2a2a' } : isWeb ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.1)' } : {}]}>
                  <Image source={BrainImage} style={{ width: '100%', height: '100%', resizeMode: 'cover', ...(isWeb ? { mixBlendMode: 'luminosity' } : {}) }} />
                </View>
                <Text style={{ fontFamily: grotesk, fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>{user?.username || 'Player'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Icons.ZapIcon size={10} color={themeAccent} />
                  <Text style={{ fontFamily: mono, fontSize: 10, color: '#fff', fontWeight: '900', letterSpacing: 2 }}>LEVEL {lvl}</Text>
                </View>
              </View>

              <View style={{ flex: 1, justifyContent: 'flex-end', gap: 12, zIndex: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingBottom: 4 }}>
                  <Text style={{ fontFamily: mono, fontSize: 10, color: '#64748b', letterSpacing: 2 }}>WIN RATE</Text>
                  <Text style={{ fontFamily: grotesk, fontSize: 18, color: '#fff', fontWeight: '900' }}>{winRate}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingBottom: 4 }}>
                  <Text style={{ fontFamily: mono, fontSize: 10, color: '#64748b', letterSpacing: 2 }}>MATCHES</Text>
                  <Text style={{ fontFamily: grotesk, fontSize: 18, color: '#fff', fontWeight: '900' }}>{totalPlayed}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingBottom: 4 }}>
                  <Text style={{ fontFamily: mono, fontSize: 10, color: '#64748b', letterSpacing: 2 }}>BEST STREAK</Text>
                  <Text style={{ fontFamily: grotesk, fontSize: 18, color: '#fff', fontWeight: '900' }}>{bestStreak}</Text>
                </View>
              </View>
              
            </View>
          </View>

          {/* Live Ops Panel */}
          <View style={[{
            borderRadius: 16, padding: 20, backgroundColor: 'rgba(10,10,12,0.8)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden'
          }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}>
            <CornerBrackets />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontFamily: mono, fontSize: 12, color: '#94a3b8', fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>Live Ops</Text>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Icons.LifeBuoyIcon size={14} color={themeAccent} />
              </Animated.View>
            </View>

            <View style={{ gap: 12 }}>
              {[
                { label: 'DAILY RIDDLES', prog: `${Math.min(100, Math.round((user?.xp || 0) % 100))}%` },
                { label: 'XP PROGRESS', prog: `${Math.min(100, Math.round(((user?.xp || 0) % 50) / 50 * 100))}%` },
              ].map((op, i) => (
                <View key={i}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontFamily: mono, fontSize: 10, color: '#fff' }}>{op.label}</Text>
                    <Text style={{ fontFamily: mono, fontSize: 10, color: themeAccent }}>{op.prog}</Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: '#000', borderRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <View style={[{ width: op.prog, height: '100%', backgroundColor: themeAccent, borderRadius: 2 }, isWeb ? { transition: 'width 1s ease' } : {}]} />
                  </View>
                </View>
              ))}
            </View>
          </View>

        </View>

        {/* ══════════ RIGHT MAIN CONTENT ══════════ */}
        <View style={{ flex: 1, gap: 24 }}>
          
          {/* ── HERO BANNER (Neon Wasteland / Featured Sector) ── */}
          <TouchableOpacity 
            style={[{
              width: '100%', height: isMobile ? 320 : 360, borderRadius: 24,
              backgroundColor: 'rgba(10,10,12,0.8)', borderWidth: 1, borderColor: panicMode ? 'rgba(255,42,42,0.3)' : 'rgba(255,255,255,0.1)',
              overflow: 'hidden', position: 'relative'
            }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}
            onPress={() => go('gauntlet')}
            onMouseEnter={() => setHeroHover(true)}
            onMouseLeave={() => setHeroHover(false)}
            activeOpacity={0.9}
          >
            <View style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              <Image source={{ uri: 'https://images.unsplash.com/photo-1673380704968-1b47dd77c555?w=1080&q=80' }} style={{ width: '100%', height: '100%', resizeMode: 'cover', ...(isWeb ? { filter: heroHover ? 'grayscale(0%)' : 'grayscale(100%)', mixBlendMode: 'screen', opacity: 0.4, transform: heroHover ? 'scale(1.05)' : 'scale(1)', transition: 'all 1s ease' } : { opacity: 0.2 }) }} />
              <LinearGradient colors={[panicMode ? 'rgba(26,0,0,1)' : 'rgba(5,5,5,1)', panicMode ? 'rgba(26,0,0,0.8)' : 'rgba(5,5,5,0.8)', 'transparent']} style={{ position: 'absolute', inset: 0 }} />
            </View>
            <CornerBrackets />
            
            {/* Scrolling Ticker */}
            <View style={{ position: 'absolute', top: 24, left: 0, right: 0, zIndex: 10 }}>
              <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 4, overflow: 'hidden' }}>
                <Animated.View style={{ transform: [{ translateX: tickerAnim }], flexDirection: 'row', width: 3000 }}>
                  <Text style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 4 }}>
                    {panicMode 
                      ? '/// CRITICAL SYSTEM FAILURE IMMINENT /// EVACUATE OR ENGAGE /// '.repeat(10)
                      : '/// GLOBAL TOURNAMENT QUALIFIERS NOW LIVE /// SECURE YOUR POSITION IN THE LADDER /// '.repeat(10)}
                  </Text>
                </Animated.View>
              </View>
            </View>

            <View style={{ flex: 1, justifyContent: 'flex-end', padding: 32, zIndex: 10, pointerEvents: 'none' }}>
              <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 }, isWeb ? { backdropFilter: 'blur(12px)' } : {}]}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: themeAccent }} />
                <Text style={{ fontFamily: grotesk, fontSize: 10, color: '#fff', fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>Featured Sector</Text>
              </View>

              <Text style={{ fontFamily: grotesk, fontSize: isMobile ? 40 : 72, fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: -2, lineHeight: isMobile ? 40 : 64, marginBottom: 16 }}>
                {panicMode ? 'CRITICAL\n' : 'NEON\n'}
                <Text style={isWeb ? { WebkitTextStroke: '2px rgba(255,255,255,0.8)', WebkitTextFillColor: 'transparent' } : { color: 'rgba(255,255,255,0.4)' }}>
                  {panicMode ? 'BREACH' : 'WASTELAND'}
                </Text>
              </Text>
              
              <Text style={{ fontFamily: mono, fontSize: 14, color: '#94a3b8', maxWidth: 400, borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.2)', paddingLeft: 16, marginBottom: 24 }}>
                The grid is shifting. Risk your assets in the highest stakes arena currently online.
              </Text>

              <View style={[{ pointerEvents: 'auto', flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, alignSelf: 'flex-start' }, isWeb && heroHover ? { paddingRight: 24, transition: 'all 0.3s ease' } : { transition: 'all 0.3s ease' }]}>
                <Text style={{ fontFamily: grotesk, fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 3, textTransform: 'uppercase' }}>DEPLOY NOW</Text>
                <Icons.ChevronRightIcon size={16} color="#000" />
              </View>
            </View>
          </TouchableOpacity>

          {/* ── GAME ARENAS (4 standard modes) ── */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 4, height: 24, borderRadius: 2, backgroundColor: panicMode ? '#ff2a2a' : '#6366f1' }} />
                <Text style={{ fontFamily: grotesk, fontSize: 20, fontWeight: '900', color: '#e2e8f0', letterSpacing: 2, textTransform: 'uppercase' }}>Game Arenas</Text>
              </View>
            </View>
            <View style={{ gap: 12 }}>
              {gameArenas.map((arena, i) => (
                <ArenaCard key={i} {...arena} panicMode={panicMode} />
              ))}
            </View>
          </View>

          {/* ── SPECIAL ARENAS (4 special modes) ── */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 4, height: 24, borderRadius: 2, backgroundColor: panicMode ? '#dc2626' : '#f59e0b' }} />
                <Text style={{ fontFamily: grotesk, fontSize: 20, fontWeight: '900', color: '#e2e8f0', letterSpacing: 2, textTransform: 'uppercase' }}>Special Arenas</Text>
              </View>
            </View>
            <View style={{ gap: 12 }}>
              {specialArenas.map((arena, i) => (
                <ArenaCard key={i} {...arena} panicMode={panicMode} />
              ))}
            </View>
          </View>

          {/* ── SYSTEM RES (Footer) ── */}
          <View style={[{
            width: '100%', borderRadius: 24, padding: 24,
            backgroundColor: 'rgba(10,10,12,0.8)', borderWidth: 1, borderColor: panicMode ? 'rgba(255,42,42,0.4)' : 'rgba(255,255,255,0.1)',
            flexDirection: 'column', position: 'relative', overflow: 'hidden'
          }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}>
            <View style={{ position: 'absolute', right: 0, top: 0, width: 128, height: 128, backgroundColor: 'rgba(255,255,255,0.05)', borderBottomLeftRadius: 100, zIndex: 0 }} />
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icons.CpuIcon size={14} color="rgba(255,255,255,0.4)" />
                <Text style={{ fontFamily: mono, fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' }}>System Res</Text>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontFamily: mono, fontSize: 9, color: '#fff' }}>NODE_ACTIVE</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 16, marginTop: 24, zIndex: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: mono, fontSize: 10, color: '#64748b', marginBottom: 4 }}>PING</Text>
                <Text style={{ fontFamily: grotesk, fontSize: 24, fontWeight: '900', color: '#fff' }}>12<Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500' }}>ms</Text></Text>
              </View>
              <View style={{ flex: 1, borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingLeft: 16 }}>
                <Text style={{ fontFamily: mono, fontSize: 10, color: '#64748b', marginBottom: 4 }}>LOSS</Text>
                <Text style={{ fontFamily: grotesk, fontSize: 24, fontWeight: '900', color: '#fff' }}>0.0<Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500' }}>%</Text></Text>
              </View>
              <View style={{ flex: 1, borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingLeft: 16 }}>
                <Text style={{ fontFamily: mono, fontSize: 10, color: '#64748b', marginBottom: 4 }}>SERVER</Text>
                <Text style={{ fontFamily: grotesk, fontSize: 24, fontWeight: '900', color: '#fff' }}>EU_W<Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500' }}>[04]</Text></Text>
              </View>
            </View>
          </View>

        </View>

      </View>
    </ScrollView>
  );
}
