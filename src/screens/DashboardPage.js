import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../theme/colors';
import { useResponsive } from '../theme/breakpoints';
import Icons from '../components/Icons';
import { BACKEND } from '../utils/api';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : undefined;
const grotesk = isWeb ? '"Space Grotesk", sans-serif' : undefined;
const display = isWeb ? '"Black Ops One", sans-serif' : undefined;
const BrainImage = require('../../assets/brain_logo.png');

function formatIntel(value) {
  return Number(value || 0).toLocaleString('en-US');
}

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
  const { isPhone, isMobile } = useResponsive();
  const [hovered, setHovered] = useState(false);
  const accent = panicMode ? '#ff2a2a' : iconColor;
  const hoverBg = panicMode ? 'rgba(255,42,42,0.08)' : 'rgba(99,102,241,0.08)';
  const titleSize = isPhone ? 16 : isMobile ? 17 : 18;
  const subtitleSize = isPhone ? 13 : isMobile ? 14 : 14;
  const actionSize = isPhone ? 12 : 13;
  const cardPadding = isPhone ? 16 : isMobile ? 18 : 20;
  return (
    <TouchableOpacity
      onPress={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      activeOpacity={0.7}
      style={[{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: cardPadding, borderRadius: 12,
        backgroundColor: hovered ? hoverBg : 'rgba(10,10,12,0.4)',
        borderWidth: 1, borderColor: panicMode ? 'rgba(255,42,42,0.2)' : 'rgba(255,255,255,0.08)',
        overflow: 'hidden', position: 'relative',
      }, isWeb ? { backdropFilter: 'blur(12px)', cursor: 'pointer', transition: 'all 0.3s ease' } : {}]}
    >
      {/* Background glow on hover */}
      {isWeb && <View style={{ position: 'absolute', inset: 0, backgroundColor: hovered ? (panicMode ? 'rgba(255,42,42,0.05)' : 'rgba(99,102,241,0.05)') : 'transparent', transition: 'background-color 0.3s ease' }} />}
      
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPhone ? 12 : 16, zIndex: 10, flex: 1, minWidth: 0 }}>
        <View style={[{
          width: isPhone ? 44 : 48, height: isPhone ? 44 : 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1,
          borderColor: panicMode ? 'rgba(255,42,42,0.2)' : 'rgba(255,255,255,0.08)',
        }, isWeb ? { boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)' } : {}]}>
          <IconComp size={isPhone ? 22 : 24} color={panicMode ? '#ff4444' : iconColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={2}
            style={{ fontFamily: display, fontSize: titleSize, fontWeight: '900', color: panicMode ? '#fecaca' : '#e2e8f0', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4, lineHeight: titleSize + 4 }}
          >
            {title}
          </Text>
          <Text
            numberOfLines={2}
            style={{ fontFamily: mono, fontSize: subtitleSize, color: '#94a3b8', letterSpacing: 0.3, lineHeight: subtitleSize + 5 }}
          >
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 10, marginLeft: 8 }}>
        <Text style={[{ fontFamily: mono, fontSize: actionSize, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase', color: panicMode ? '#dc2626' : '#6366f1' }, isWeb && hovered ? { color: panicMode ? '#ff4444' : '#818cf8' } : {}]}>{action}</Text>
        <Text style={[{ fontFamily: mono, fontSize: isPhone ? 16 : 18, color: panicMode ? '#dc2626' : '#6366f1', opacity: hovered ? 1 : 0 }, isWeb ? { transform: hovered ? 'translateX(0px)' : 'translateX(-10px)', transition: 'all 0.3s ease' } : {}]}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ═══ MAIN DASHBOARD ═══ */
export default function DashboardPage({ user, play, multi, go, panicMode, setPanicMode }) {
  const { isMobile, isPhone, isWide } = useResponsive();
  const themeAccent = panicMode ? '#ff2a2a' : '#00ffd0';

  const [heroHover, setHeroHover] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [topOperatives, setTopOperatives] = useState([]);
  const tickerAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(tickerAnim, { toValue: -1000, duration: 20000, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 4000, useNativeDriver: true })).start();
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`${BACKEND}/leaderboard/global/top`)
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        const rows = Array.isArray(data?.leaderboard) ? data.leaderboard : [];
        setTopOperatives(rows.slice(0, 5).map((entry, index) => ({
          rank: index + 1,
          name: entry.username || 'UNKNOWN',
          score: formatIntel(entry.coins),
          color: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : 'rgba(255,255,255,0.4)'
        })));
      })
      .catch(() => {
        if (alive) setTopOperatives([]);
      });
    return () => { alive = false; };
  }, [user?.coins, user?.username]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  /* ── Real user data ── */
  const lvl = Math.floor((user?.xp ?? 0) / 50) + 1;
  const playedCount = user?.total_played ?? user?.gamesPlayed ?? 0;
  const correctCount = user?.total_correct ?? user?.gamesWon ?? 0;
  const winRate = playedCount > 0 ? ((correctCount / playedCount) * 100).toFixed(1) + '%' : '--';
  const currentStreak = user?.streak ?? 0;
  const totalPlayed = playedCount;

  /* ── All 8 game modes ── */
  const gameArenas = [
    { icon: Icons.ActivityIcon, iconColor: '#22d3ee', title: 'Standard Queue', subtitle: 'Vanilla neural beatdowns. No training wheels.', action: 'Decrypt', onPress: () => play('mcq') },
    { icon: Icons.ZapIcon, iconColor: '#fbbf24', title: 'Brain Blast', subtitle: "Fry your cortex in record time. Don't blink.", action: 'Decrypt', onPress: () => play('type') },
    { icon: Icons.CrosshairIcon, iconColor: '#818cf8', title: 'ECLIPSE LEVEL', subtitle: 'Beat the shit out of your Brain', action: 'Deploy', onPress: () => play('ranked') },
    { icon: Icons.UsersIcon, iconColor: '#14b8a6', title: 'War Room', subtitle: 'Drag your friends to hell and ruin their egos.', action: 'Deploy', onPress: () => multi() },
  ];

  const specialArenas = [
    { icon: Icons.ShieldIcon, iconColor: '#f97316', title: 'Gauntlet', subtitle: "Endless neural torture. Let's see when you snap.", action: 'Decrypt', onPress: () => go('gauntlet') },
    { icon: Icons.LinkIcon, iconColor: '#ec4899', title: 'The Chain', subtitle: 'Fall down the rabbit hole and lose your damn mind.', action: 'Decrypt', onPress: () => go('chain') },
    { icon: Icons.EyeOffIcon, iconColor: '#ef4444', title: 'Blind Wager', subtitle: 'Risk your stash like an absolute degenerate.', action: 'Decrypt', onPress: () => go('wager') },
    { icon: Icons.FlameIcon, iconColor: '#eab308', title: 'Bounty Board', subtitle: 'Crowdfund high-reward cases', action: 'Decrypt', onPress: () => go('bounty') },
  ];

  const displayedOperatives = topOperatives.length ? topOperatives : [{
    rank: 1,
    name: user?.username || 'YOU',
    score: formatIntel(user?.coins),
    color: '#fbbf24'
  }];

  /* ── Background stripes ── */
  const stripeStyle = isWeb ? {
    backgroundImage: panicMode
      ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,0,0,0.05) 10px, rgba(255,0,0,0.05) 20px)'
      : 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 20px)'
  } : {};

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: isMobile ? (isPhone ? 8 : 12) : 0, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <View style={{ flex: 1, flexDirection: isMobile ? 'column' : 'row', gap: isPhone ? 14 : 20 }}>

        {/* ══════════ LEFT COLUMN ══════════ */}
        <View style={[{ width: '100%', gap: isPhone ? 16 : 24 }, !isMobile && { width: 280, flexShrink: 0 }]}>

          {/* Profile Card */}
          <TouchableOpacity onPress={() => go('profile')} activeOpacity={0.9} style={[{
            borderRadius: isPhone ? 16 : 24, padding: 4,
            backgroundColor: 'rgba(10,10,12,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden'
          }, isWeb ? { backdropFilter: 'blur(20px)', cursor: 'pointer', transition: 'all 0.2s ease' } : {}]}>
            <View style={[{
              borderRadius: isPhone ? 14 : 22, backgroundColor: '#050505', padding: isPhone ? 16 : 24, height: isMobile ? undefined : 400,
              flexDirection: 'column', position: 'relative', overflow: 'hidden'
            }, stripeStyle]}>
              
              <Text style={{ position: 'absolute', top: 16, right: 16, fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.8 }}>USR_ID_{user?.id || '0911'}</Text>
              
              <View style={{ position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', gap: 4 }}>
                {[1,2,3,4].map(i => (
                  <View key={i} style={{ width: 4, height: 12, backgroundColor: i === 4 ? 'rgba(255,255,255,0.1)' : themeAccent, opacity: 0.8 }} />
                ))}
              </View>

              <View style={{ alignItems: 'center', marginTop: 32, zIndex: 10 }}>
                {/* Brain Logo as Avatar */}
                <View style={[{ width: 112, height: 112, borderRadius: 56, borderWidth: 4, borderColor: '#050505', marginBottom: 16, overflow: 'hidden', backgroundColor: '#0a0a0c' }, panicMode && isWeb ? { boxShadow: '0 0 0 2px #ff2a2a' } : isWeb ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.1)' } : {}]}>
                  <Image source={user?.avatar_url ? { uri: user.avatar_url } : BrainImage} style={{ width: '100%', height: '100%', resizeMode: 'cover', ...(isWeb ? { mixBlendMode: 'luminosity' } : {}) }} />
                </View>
                <Text style={{ fontFamily: grotesk, fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>{user?.username || 'Player'}</Text>
              </View>

              <View style={{ flex: 1, justifyContent: 'flex-end', gap: 12, zIndex: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingBottom: 4 }}>
                  <Text style={{ fontFamily: mono, fontSize: 11, color: '#64748b', letterSpacing: 1.6 }}>WIN RATE</Text>
                  <Text style={{ fontFamily: grotesk, fontSize: 18, color: '#fff', fontWeight: '900' }}>{winRate}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingBottom: 4 }}>
                  <Text style={{ fontFamily: mono, fontSize: 11, color: '#64748b', letterSpacing: 1.6 }}>MATCHES</Text>
                  <Text style={{ fontFamily: grotesk, fontSize: 18, color: '#fff', fontWeight: '900' }}>{totalPlayed}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingBottom: 4 }}>
                  <Text style={{ fontFamily: mono, fontSize: 11, color: '#64748b', letterSpacing: 1.6 }}>CURRENT STREAK</Text>
                  <Text style={{ fontFamily: grotesk, fontSize: 18, color: '#fff', fontWeight: '900' }}>{currentStreak}</Text>
                </View>
              </View>
              
            </View>
          </TouchableOpacity>

          {/* Live Ops Panel */}
          <View style={[{
            borderRadius: 16, padding: 20, backgroundColor: 'rgba(10,10,12,0.8)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', zIndex: 50
          }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}>
            <CornerBrackets />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: mono, fontSize: 12, color: '#94a3b8', fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>Live Ops</Text>
                <TouchableOpacity
                  onMouseEnter={() => isWeb && setShowInfo(true)} 
                  onMouseLeave={() => isWeb && setShowInfo(false)}
                  onPressIn={() => !isWeb && setShowInfo(true)}
                  onPressOut={() => !isWeb && setShowInfo(false)}
                  activeOpacity={0.7}
                  style={isWeb ? { cursor: 'help' } : {}}
                >
                  <Icons.InfoIcon size={14} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Icons.LifeBuoyIcon size={14} color={themeAccent} />
              </Animated.View>
            </View>

            {showInfo && (
              <View style={[{ position: 'absolute', top: 56, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.95)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: themeAccent+'50', zIndex: 100 }, isWeb ? { boxShadow: '0 10px 40px rgba(0,0,0,0.8)' } : {}]}>
                <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 13, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 }}>OPERATION COST</Text>
                <Text style={{ color: '#94a3b8', fontFamily: mono, fontSize: 12, lineHeight: 18 }}>
                  Intel moves when you solve, spend hints, or wager. Streak tracks active solve chains in standard and survival modes.
                </Text>
              </View>
            )}

            <View style={{ gap: 12 }}>
              {[
                { label: 'INTEL', value: formatIntel(user?.coins), width: `${Math.min(100, Math.round(((user?.coins || 0) % 5000) / 5000 * 100))}%` },
                { label: 'STREAK', value: `${user?.streak || 0} ACTIVE`, width: `${Math.min(100, Math.round(((user?.streak || 0) % 5 || ((user?.streak || 0) > 0 ? 5 : 0)) / 5 * 100))}%` },
              ].map((op, i) => (
                <View key={i}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontFamily: mono, fontSize: 11, color: '#fff' }}>{op.label}</Text>
                    <Text style={{ fontFamily: mono, fontSize: 11, color: themeAccent }}>{op.value}</Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: '#000', borderRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <View style={[{ width: op.width, height: '100%', backgroundColor: themeAccent, borderRadius: 2 }, isWeb ? { transition: 'width 1s ease' } : {}]} />
                  </View>
                </View>
              ))}
            </View>
          </View>

        </View>

        {/* ══════════ CENTER MAIN CONTENT ══════════ */}
        <View style={{ flex: 1, gap: 24, minWidth: 0 }}>
          
          {/* ── HERO BANNER (The Cold Case / Featured Sector) ── */}
          <TouchableOpacity
            style={[{
              width: '100%', height: isMobile ? (isPhone ? 260 : 320) : 360, borderRadius: isPhone ? 16 : 24,
              backgroundColor: 'rgba(10,10,12,0.8)', borderWidth: 1, borderColor: panicMode ? 'rgba(255,42,42,0.3)' : 'rgba(255,255,255,0.1)',
              overflow: 'hidden', position: 'relative'
            }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}
            onPress={() => go('daily')}
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
                  <Text style={{ fontFamily: mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 3 }}>
                    {panicMode 
                      ? '/// CRITICAL SYSTEM FAILURE IMMINENT /// EVACUATE OR ENGAGE /// '.repeat(10)
                      : '/// GLOBAL TOURNAMENT QUALIFIERS NOW LIVE /// SECURE YOUR POSITION IN THE LADDER /// '.repeat(10)}
                  </Text>
                </Animated.View>
              </View>
            </View>

            <View style={{ flex: 1, justifyContent: 'flex-end', padding: isPhone ? 18 : 32, zIndex: 10, pointerEvents: 'none' }}>
              <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, alignSelf: 'flex-start', marginBottom: isPhone ? 8 : 12 }, isWeb ? { backdropFilter: 'blur(12px)' } : {}]}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: themeAccent }} />
                <Text style={{ fontFamily: display, fontSize: isPhone ? 10 : 11, color: '#fff', fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' }}>
                  {panicMode ? 'Breach Protocol' : 'Featured Sector'}
                </Text>
              </View>

              <Text style={{ fontFamily: display, fontSize: isPhone ? 28 : (isMobile ? 40 : 72), fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: isPhone ? 0.5 : 1, lineHeight: isPhone ? 28 : (isMobile ? 40 : 64), marginBottom: isPhone ? 10 : 16 }}>
                {panicMode ? 'CRITICAL\n' : 'THE COLD\n'}
                <Text style={isWeb ? { WebkitTextStroke: '2px rgba(255,255,255,0.8)', WebkitTextFillColor: 'transparent' } : { color: 'rgba(255,255,255,0.4)' }}>
                  {panicMode ? 'BREACH' : 'CASE'}
                </Text>
              </Text>

              {!isPhone && (
                <Text style={{ fontFamily: mono, fontSize: 14, color: '#94a3b8', maxWidth: 400, borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.2)', paddingLeft: 16, marginBottom: 24 }}>
                  {panicMode
                    ? 'Same daily sequence, now under admin-timed breach protocol. Crack it before the countdown burns the run and pull bonus Intel.'
                    : "Decrypt today's highly classified sequence to maintain your daily streak combo."}
                </Text>
              )}

              <View style={[{ pointerEvents: 'auto', flexDirection: 'row', alignItems: 'center', gap: isPhone ? 10 : 16, backgroundColor: '#fff', paddingHorizontal: isPhone ? 20 : 32, paddingVertical: isPhone ? 12 : 16, borderRadius: 12, alignSelf: 'flex-start' }, isWeb && heroHover ? { paddingRight: isPhone ? 16 : 24, transition: 'all 0.3s ease' } : { transition: 'all 0.3s ease' }]}>
                <Text style={{ fontFamily: display, fontSize: isPhone ? 11 : 12, fontWeight: '900', color: '#000', letterSpacing: 1.3, textTransform: 'uppercase' }}>{panicMode ? 'ENTER BREACH' : 'DECRYPT'}</Text>
                <Icons.ChevronRightIcon size={isPhone ? 14 : 16} color="#000" />
              </View>
            </View>
          </TouchableOpacity>

          {/* ── GAME ARENAS (4 standard modes) ── */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 4, height: 24, borderRadius: 2, backgroundColor: panicMode ? '#ff2a2a' : '#6366f1' }} />
                <Text style={{ fontFamily: display, fontSize: 20, fontWeight: '900', color: '#e2e8f0', letterSpacing: 1.5, textTransform: 'uppercase' }}>Game Arenas</Text>
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
                <Text style={{ fontFamily: display, fontSize: 20, fontWeight: '900', color: '#e2e8f0', letterSpacing: 1.5, textTransform: 'uppercase' }}>Special Arenas</Text>
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
            width: '100%', borderRadius: isPhone ? 16 : 24, padding: isPhone ? 16 : 24,
            backgroundColor: 'rgba(10,10,12,0.8)', borderWidth: 1, borderColor: panicMode ? 'rgba(255,42,42,0.4)' : 'rgba(255,255,255,0.1)',
            flexDirection: 'column', position: 'relative', overflow: 'hidden'
          }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}>
            <View style={{ position: 'absolute', right: 0, top: 0, width: 128, height: 128, backgroundColor: 'rgba(255,255,255,0.05)', borderBottomLeftRadius: 100, zIndex: 0 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPhone ? 8 : 12 }}>
                <Icons.CpuIcon size={14} color="rgba(255,255,255,0.4)" />
                <Text style={{ fontFamily: mono, fontSize: isPhone ? 10 : 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' }}>System Res</Text>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontFamily: mono, fontSize: 10, color: '#fff' }}>NODE_ACTIVE</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: isPhone ? 10 : 16, marginTop: isPhone ? 16 : 24, zIndex: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: mono, fontSize: isPhone ? 9 : 10, color: '#64748b', marginBottom: 4 }}>PING</Text>
                <Text style={{ fontFamily: grotesk, fontSize: isPhone ? 18 : 24, fontWeight: '900', color: '#fff' }}>12<Text style={{ fontSize: isPhone ? 11 : 14, color: '#64748b', fontWeight: '500' }}>ms</Text></Text>
              </View>
              <View style={{ flex: 1, borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingLeft: isPhone ? 10 : 16 }}>
                <Text style={{ fontFamily: mono, fontSize: isPhone ? 9 : 10, color: '#64748b', marginBottom: 4 }}>LOSS</Text>
                <Text style={{ fontFamily: grotesk, fontSize: isPhone ? 18 : 24, fontWeight: '900', color: '#fff' }}>0.0<Text style={{ fontSize: isPhone ? 11 : 14, color: '#64748b', fontWeight: '500' }}>%</Text></Text>
              </View>
              <View style={{ flex: 1, borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingLeft: isPhone ? 10 : 16 }}>
                <Text style={{ fontFamily: mono, fontSize: isPhone ? 9 : 10, color: '#64748b', marginBottom: 4 }}>SERVER</Text>
                <Text style={{ fontFamily: grotesk, fontSize: isPhone ? 18 : 24, fontWeight: '900', color: '#fff' }}>EU_W<Text style={{ fontSize: isPhone ? 11 : 14, color: '#64748b', fontWeight: '500' }}>[04]</Text></Text>
              </View>
            </View>
          </View>

        </View>

        {/* ══════════ RIGHT COLUMN (TOP OPERATIVES) ══════════ */}
        {isWide && (
          <View style={{ width: 340, flexShrink: 0, gap: 24 }}>
            <View style={[{
              flex: 1, borderRadius: 24, padding: 28, backgroundColor: 'rgba(10,10,12,0.8)',
              borderWidth: 1, borderColor: panicMode ? 'rgba(255,42,42,0.3)' : 'rgba(255,255,255,0.1)',
              overflow: 'hidden', position: 'relative'
            }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}>
              <CornerBrackets />
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingBottom: 16, marginBottom: 16 }}>
                <Icons.TrophyIcon size={18} color={panicMode ? '#ff2a2a' : '#fbbf24'} />
                <Text style={{ fontFamily: display, fontSize: 18, color: '#e2e8f0', fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' }}>Top Operatives</Text>
              </View>

              <View style={{ flex: 1, gap: 14 }}>
                {displayedOperatives.map((op, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <Text style={{ fontFamily: mono, fontSize: 12, color: op.color, fontWeight: '900', width: 24 }}>#{op.rank}</Text>
                      <Text style={{ fontFamily: grotesk, fontSize: 16, color: i < 3 ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: '900', letterSpacing: 1.5 }}>{op.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontFamily: mono, fontSize: 14, color: themeAccent, fontWeight: '900' }}>{op.score}</Text>
                      <Text style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>CR</Text>
                    </View>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={[{ marginTop: 24, paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]} onPress={() => go('board')}>
                <Text style={{ fontFamily: mono, fontSize: 11, color: '#fff', letterSpacing: 1.8 }}>VIEW FULL LADDER</Text>
              </TouchableOpacity>

            </View>
          </View>
        )}

      </View>
    </ScrollView>
  );
}
