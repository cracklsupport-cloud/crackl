import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Platform, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LogoIcon from '../components/LogoIcon';
import Colors from '../theme/colors';
import { ParticleField } from '../components/ParticleField';
import { FlashlightCursor } from '../components/FlashlightCursor';
import { TacticalGrid, GlowOrb, SmokeWisp } from '../components/AtmosphericEffects';
import { usePanicSync } from '../components/PanicModeOrchestrator';
import Icons from '../components/Icons';
import DashboardPage from './DashboardPage';
import LeaderboardPage from './LeaderboardPage';
import WalletPage from './WalletPage';
import ProfilePage from './ProfilePage';

const BrainImage = require('../../assets/brain_logo.png');
const isWeb = Platform.OS === 'web';

// Simple placeholder for BlackMarket if needed
const BlackMarketPage = () => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: Colors.textMuted }}>Black Market Coming Soon</Text></View>;

export default function HomeShell({ user, active, go, update, play, multi, panicMode, setPanicMode }) {
  usePanicSync(panicMode);
  async function logout() { await AsyncStorage.removeItem('crackl_user'); go('auth'); }

  const navItems = [
    { id: 'home',    icon: Icons.HomeIcon,  label: 'Dashboard',     color: Colors.purple },
    { id: 'board',   icon: Icons.TargetIcon, label: 'Leaderboards',  color: Colors.gold },
    { id: 'cash',    icon: Icons.IntelIcon,   label: 'Wallet & Cash', color: Colors.emerald },
    { id: 'blackmarket', icon: Icons.EyeOffIcon, label: 'Black Market', color: Colors.rose },
    { id: 'profile', icon: Icons.UsersIcon,  label: 'My Profile',    color: Colors.cyan },
  ];

  const lvl     = Math.floor((user?.xp ?? 0) / 50) + 1;
  const estCash = (((user?.coins ?? 0) / 1000) * 10).toFixed(2);

  return (
    <View style={{ flex: 1, backgroundColor: '#000000', overflow: 'hidden' }}>
      
      {/* ═══ ATMOSPHERIC ENGINE ═══ */}
      <ParticleField panicMode={panicMode} opacity={panicMode ? 0.85 : 0.5} />
      <FlashlightCursor panicMode={panicMode} />
      <GlowOrb color={panicMode ? '#ff0000' : '#a855f7'} size={600} top={-200} right={-200} opacity={panicMode ? 0.12 : 0.06} />
      <TacticalGrid panicMode={panicMode} />
      {panicMode && isWeb && (
        <>
          <SmokeWisp color="rgba(255,40,40,0.06)" index={0} />
          <SmokeWisp color="rgba(255,60,60,0.05)" index={1} />
          <SmokeWisp color="rgba(200,20,20,0.04)" index={2} />
        </>
      )}

      {/* ═══ TOP BAR ═══ */}
      <View style={{
        height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 28, backgroundColor: isWeb ? 'rgba(0,0,0,0.85)' : 'rgba(15,15,26,0.9)',
        borderBottomWidth: 1, borderColor: panicMode ? 'rgba(255,0,0,0.35)' : 'rgba(255,255,255,0.06)', zIndex: 10}}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{
            width: 42, height: 42, borderRadius: 6, backgroundColor: '#0a0a0a',
            borderWidth: 1, borderColor: panicMode ? 'rgba(255,0,0,0.3)' : 'rgba(255,255,255,0.1)',
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 4}}>
            <Image source={BrainImage} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
          </View>
          <View>
            <Text style={{
              color: Colors.textPrimary,
              fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
              fontWeight: '700', fontSize: 14, letterSpacing: 0.5
            }}>Welcome back, {user?.username}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: panicMode ? Colors.rose : Colors.emerald, shadowColor: panicMode ? Colors.rose : Colors.emerald, shadowRadius: 4, shadowOpacity: 0.8 }} />
              <Text style={{ color: Colors.textSecondary, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 11, letterSpacing: 0.5 }}>
                {user?.level || 'Novice'} · Lvl {lvl}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Coin + Cash pill */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)',
            borderRadius: 8, borderWidth: 1, borderColor: panicMode ? 'rgba(255,0,0,0.2)' : 'rgba(255,255,255,0.08)', overflow: 'hidden'}}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderRightWidth: 1, borderColor: panicMode ? 'rgba(255,0,0,0.15)' : 'rgba(255,255,255,0.08)', flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Icons.IntelIcon size={14} color={Colors.gold} />
              <Text style={{ color: Colors.gold, fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 13 }}>{(user?.coins ?? 0).toLocaleString()}</Text>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.emerald + '12' }}>
              <Text style={{ color: Colors.emerald, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: 13 }}>₹{estCash}</Text>
            </View>
          </View>
          {/* Streak badge */}
          <View style={{
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', gap: 6, alignItems: 'center',
            backgroundColor: Colors.orange + '15', borderWidth: 1, borderColor: Colors.orange + '30'}}>
            <Icons.FlameIcon size={14} color={Colors.orange} animated={true} />
            <Text style={{ color: Colors.orange, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: 13 }}>{user?.streak ?? 0}</Text>
          </View>
          {/* Notification */}
          <TouchableOpacity style={{
            width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.8)',
            borderWidth: 1, borderColor: panicMode ? 'rgba(255,0,0,0.2)' : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center'}}>
            <Icons.BellIcon size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', zIndex: 1 }}>
        {/* ═══ SIDEBAR ═══ */}
        <View style={{
          width: Platform.OS === 'web' ? '240px' : 240,
          backgroundColor: isWeb ? 'rgba(0,0,0,0.5)' : 'rgba(15,15,26,0.9)',
          paddingVertical: 24, paddingHorizontal: 16,
          borderRightWidth: 1, borderColor: panicMode ? 'rgba(255,0,0,0.2)' : 'rgba(255,255,255,0.06)'}}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10, marginBottom: 40 }}>
            <View style={{ width: 42, height: 42, borderRadius: 6, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 4 }}>
              <Image source={BrainImage} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
            </View>
            <Text style={{ color: Colors.textPrimary, fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontWeight: 'bold', fontSize: 18, marginLeft: 12, letterSpacing: 2 }}>
              CRACKL <Text style={{ color: '#a855f7' }}>V5</Text>
            </Text>
          </View>

          <Text style={{ color: Colors.textMuted, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 10, fontWeight: '800', letterSpacing: 3, paddingLeft: 10, marginBottom: 16 }}>
            SYSTEM DIRECTORY
          </Text>

          <View style={{ position: 'relative' }}>
            {navItems.map((n) => {
              const isActive = active === n.id;
              const IconComp = n.icon;
              const accent = panicMode ? Colors.rose : n.color;
              return (
                <TouchableOpacity
                  key={n.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14,
                    borderRadius: 8, marginBottom: 6,
                    backgroundColor: isActive ? 'rgba(168,85,247,0.08)' : 'transparent',
                    borderWidth: 1, borderColor: isActive ? (panicMode ? 'rgba(255,0,0,0.3)' : 'rgba(168,85,247,0.25)') : 'transparent'}}
                  onPress={() => go(n.id)}
                  activeOpacity={0.7}
                >
                  <IconComp size={18} color={isActive ? accent : Colors.textMuted} />
                  <Text style={{
                    color: isActive ? Colors.textPrimary : Colors.textMuted,
                    fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
                    fontSize: 14, fontWeight: isActive ? '700' : '500', flex: 1, marginLeft: 14, letterSpacing: 0.5
                  }}>{n.label}</Text>
                  {isActive && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, shadowColor: accent, shadowOpacity: 0.8, shadowRadius: 6 }} />}
                  {isActive && (
                    <View style={{ position: 'absolute', left: -16, width: 3, height: 24, backgroundColor: accent, borderRadius: 2 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flex: 1 }} />

          {/* Settings */}
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14,
              borderRadius: 8, marginBottom: 6 }}
            onPress={() => go('settings')}
          >
            <Icons.SettingsIcon size={18} color={Colors.textMuted} />
            <Text style={{ color: Colors.textMuted, fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: 14, fontWeight: '500', marginLeft: 14, letterSpacing: 0.5 }}>Settings</Text>
          </TouchableOpacity>

          {/* Admin link — only for admin users */}
          {user?.is_admin && (
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14,
                borderRadius: 8, marginBottom: 10,
                backgroundColor: 'rgba(124,58,237,0.08)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' }}
              onPress={() => go('admin')}
            >
              <Icons.TerminalIcon size={18} color='#7C3AED' />
              <Text style={{ color: '#a78bfa', fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: 14, fontWeight: '700', marginLeft: 14, letterSpacing: 0.5 }}>Admin Panel</Text>
            </TouchableOpacity>
          )}

          {/* Sign Out */}
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14,
              borderRadius: 8, borderWidth: 1, borderColor: panicMode ? 'rgba(255,0,0,0.2)' : 'rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(0,0,0,0.6)' }}
            onPress={logout}
          >
            <Icons.LogOutIcon size={18} color={Colors.textMuted} />
            <Text style={{ color: Colors.textSecondary, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 13, fontWeight: '600', marginLeft: 14, letterSpacing: 0.5 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* ═══ MAIN CONTENT ═══ */}
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          {active === 'home'    && <DashboardPage user={user} play={play} multi={multi} go={go} panicMode={panicMode} setPanicMode={setPanicMode} />}
          {active === 'board'   && <LeaderboardPage user={user} />}
          {active === 'cash'    && <WalletPage user={user} update={update} />}
          {active === 'profile' && <ProfilePage user={user} go={go} />}
          {active === 'blackmarket' && <BlackMarketPage />}
        </View>
      </View>
    </View>
  );
}
