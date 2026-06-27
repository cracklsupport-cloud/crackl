/**
 * CRACKL — App Navigator
 * Central routing: manages screen state and renders the active screen.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProvider } from '../utils/UserContext';
import { BACKEND } from '../utils/api';

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
import AdminDashboard from '../screens/AdminDashboard';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import ChallengeLandingScreen from '../screens/ChallengeLandingScreen';

export default function AppNavigator() {
  const [screen, setScreen]             = useState('splash');
  const [user, setUser]                 = useState(null);
  const [mode, setMode]                 = useState('mcq');
  const [room, setRoom]                 = useState(null);
  const [panicMode, setPanicMode]       = useState(false);
  const [wagerNode, setWagerNode]       = useState(null);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const allowGameExitRef = useRef(false);

  // Callback for UserContext to keep AppNavigator's own state in sync
  const handleUserChange = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  if (typeof window !== 'undefined') {
    window.updateUserContext = (newUser) => {
      setUser(newUser);
      AsyncStorage.setItem('crackl_user', JSON.stringify(newUser));
    };
  }

  useEffect(() => {
    const init = async () => {
      // 1. Intercept Deep-Linked Viral Wagers
      let incomingWagerId = null;
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        incomingWagerId = urlParams.get('challengeId');
        if (incomingWagerId) {
          setWagerNode(incomingWagerId);
        }
      }

      // Maintenance is a global gate: cached sessions must not bypass it.
      try {
        const statusRes = await fetch(`${BACKEND}/app/status`);
        const status = await statusRes.json();
        if (status?.maintenance) {
          setMaintenanceMsg(status.message || '');
          setScreen('maintenance');
          return;
        }
      } catch {
        // Keep booting if status cannot be reached; individual screens still handle API failures.
      }

      // 2. Load Auth State
	      try {
	        const raw = await AsyncStorage.getItem('crackl_user');
	        const token = await AsyncStorage.getItem('crackl_token');
	        if (raw && token) {
	          const cachedUser = JSON.parse(raw);
	          const res = await fetch(`${BACKEND}/user/${cachedUser.id}`, {
	            headers: { Authorization: `Bearer ${token}` }
	          });
	          const data = await res.json();
	          if (data.success && data.user) {
	            setUser(data.user);
	            await AsyncStorage.setItem('crackl_user', JSON.stringify(data.user));
	            setScreen(incomingWagerId ? 'challenge_landing' : 'home');
	            return;
	          }
	        }
	        if (raw && !token) {
	          await AsyncStorage.multiRemove(['crackl_user', 'crackl_token']);
	        }
	      } catch {
	        await AsyncStorage.multiRemove(['crackl_user', 'crackl_token']);
	      }

      // 3. Unauthenticated route handling
      if (incomingWagerId) {
        setScreen('challenge_landing'); // Guest play is allowed
      } else {
        setTimeout(() => setScreen('auth'), 2500);
      }
    };

    init();
  }, []);

	  const save = async (u, token) => {
	    setUser(u);
	    await AsyncStorage.setItem('crackl_user', JSON.stringify(u));
	    if (token) await AsyncStorage.setItem('crackl_token', token);
	    else await AsyncStorage.removeItem('crackl_token');
	    setScreen(wagerNode ? 'challenge_landing' : 'home');
	  };

  // Onboarding has been removed, map handleSignup to save
  const handleSignup = save;

  // Update user state + storage WITHOUT navigating (for in-game updates)
  const syncUser = async (u) => {
    setUser(u);
    await AsyncStorage.setItem('crackl_user', JSON.stringify(u));
  };

  const go = (nextScreen) => {
    const activeRunScreens = ['game', 'daily', 'gauntlet', 'chain', 'wager', 'bounty', 'room'];
    // Defensive guard: prevent unintended run->home redirects during Panic sessions.
    if (nextScreen === 'home' && activeRunScreens.includes(screen) && panicMode && !allowGameExitRef.current) {
      return;
    }
    allowGameExitRef.current = false;
    setScreen(nextScreen);
  };
  const exitGameToHome = () => {
    allowGameExitRef.current = true;
    setScreen('home');
  };
  const play = (m) => { setMode(m); go('game'); };

  const routeScreen = () => {
    if (screen === 'splash')      return <SplashScreen />;
    if (screen === 'maintenance') return <MaintenanceScreen go={go} message={maintenanceMsg} />;
    if (screen === 'auth')        return <AuthScreen onLogin={save} onSignup={handleSignup} />;
    if (screen === 'challenge_landing') return <ChallengeLandingScreen user={user} go={go} update={save} wagerId={wagerNode} setMode={setMode} />;

    if (!user) return <AuthScreen onLogin={save} onSignup={handleSignup} />;

    if (screen === 'setup')       return <MultiSetupScreen user={user} go={go} setRoom={setRoom} />;
    if (screen === 'room')        return <MultiRoomScreen user={user} go={go} exitToHome={exitGameToHome} room={room} update={syncUser} />;
    if (screen === 'game')        return <GameScreen user={user} go={go} exitToHome={exitGameToHome} update={syncUser} mode={mode} panicMode={panicMode} wagerId={wagerNode} />;
    if (screen === 'daily')       return <DailyDropScreen user={user} go={go} exitToHome={exitGameToHome} update={syncUser} panicMode={panicMode} />;
    if (screen === 'gauntlet')    return <GauntletScreen user={user} go={go} exitToHome={exitGameToHome} update={syncUser} panicMode={panicMode} />;
    if (screen === 'chain')       return <ChainScreen user={user} go={go} exitToHome={exitGameToHome} update={syncUser} panicMode={panicMode} />;
    if (screen === 'wager')       return <BlindWagerScreen user={user} go={go} exitToHome={exitGameToHome} update={syncUser} panicMode={panicMode} />;
    if (screen === 'bounty')      return <BountyBoardScreen user={user} go={go} exitToHome={exitGameToHome} update={syncUser} panicMode={panicMode} />;
    if (screen === 'onboarding')  return <OnboardingScreen user={user} go={go} update={save} />;
    if (screen === 'brainprofile') return <BrainProfileScreen user={user} go={go} />;
    if (screen === 'blackmarket') return <BlackMarketScreen user={user} go={go} update={syncUser} />;
    if (screen === 'settings')    return <SettingsScreen user={user} go={go} update={save} />;
    if (screen === 'admin')       return <AdminDashboard go={go} />;

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
  };

  return (
    <UserProvider initialUser={user} onUserChange={handleUserChange}>
      {routeScreen()}
    </UserProvider>
  );
}
