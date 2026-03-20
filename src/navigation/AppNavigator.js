/**
 * CRACKL — App Navigator
 * Central routing: manages screen state and renders the active screen.
 * Replaces the inline if-chain from the monolith.
 */
import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import HomeShell from '../screens/HomeShell';
import GameScreen from '../screens/GameScreen';
import DailyDropScreen from '../screens/DailyDropScreen';
import GauntletScreen from '../screens/GauntletScreen';
import ChainScreen from '../screens/ChainScreen';
import BlindWagerScreen from '../screens/BlindWagerScreen';
import BountyBoardScreen from '../screens/BountyBoardScreen';
import MultiSetupScreen from '../screens/MultiSetupScreen';
import MultiRoomScreen from '../screens/MultiRoomScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BlackMarketScreen from '../screens/BlackMarketScreen';
import BrainProfileScreen from '../screens/BrainProfileScreen';

export default function AppNavigator() {
  const [screen, setScreen]       = useState('splash');
  const [user, setUser]           = useState(null);
  const [mode, setMode]           = useState('mcq');
  const [room, setRoom]           = useState(null);
  const [panicMode, setPanicMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('crackl_user').then(raw => {
      if (raw) { setUser(JSON.parse(raw)); setScreen('home'); }
      else setTimeout(() => setScreen('auth'), 2500);
    }).catch(() => setTimeout(() => setScreen('auth'), 2500));
  }, []);

  const save = async (u, token) => {
    setUser(u);
    await AsyncStorage.setItem('crackl_user', JSON.stringify(u));
    if (token) await AsyncStorage.setItem('crackl_token', token);
    setScreen('home');
  };

  const handleSignup = async (u, token) => {
    setUser(u);
    await AsyncStorage.setItem('crackl_user', JSON.stringify(u));
    if (token) await AsyncStorage.setItem('crackl_token', token);
    setScreen('onboarding');
  };

  const go = setScreen;

  const play = (m) => { setMode(m); go('game'); };

  // Screen router
  if (screen === 'splash')   return <SplashScreen />;
  if (screen === 'auth')     return <AuthScreen onLogin={save} onSignup={handleSignup} />;
  if (screen === 'game')     return <GameScreen user={user} go={go} update={save} mode={mode} panicMode={panicMode} />;
  if (screen === 'setup')    return <MultiSetupScreen user={user} go={go} setRoom={setRoom} />;
  if (screen === 'room')     return <MultiRoomScreen user={user} go={go} room={room} update={save} />;
  if (screen === 'daily')    return <DailyDropScreen user={user} go={go} update={save} />;
  if (screen === 'gauntlet') return <GauntletScreen user={user} go={go} update={save} />;
  if (screen === 'chain')    return <ChainScreen user={user} go={go} update={save} />;
  if (screen === 'wager')    return <BlindWagerScreen user={user} go={go} update={save} />;
  if (screen === 'bounty')   return <BountyBoardScreen user={user} go={go} update={save} />;
  if (screen === 'onboarding') return <OnboardingScreen user={user} go={go} update={save} />;
  if (screen === 'brainprofile') return <BrainProfileScreen user={user} go={go} />;
  if (screen === 'blackmarket') return <BlackMarketScreen user={user} go={go} update={save} />;
  if (screen === 'settings') return <SettingsScreen user={user} go={go} update={save} />;

  // Default: Home shell with tabbed navigation
  return (
    <HomeShell
      user={user}
      active={screen}
      go={go}
      update={save}
      play={play}
      multi={() => go('setup')}
      panicMode={panicMode}
      setPanicMode={setPanicMode}
    />
  );
}
