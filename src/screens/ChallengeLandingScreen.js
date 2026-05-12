import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { BACKEND } from '../utils/api';
import Colors from '../theme/colors';
import { FilmGrainOverlay } from '../components/AtmosphericEffects';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChallengeLandingScreen({ user, go, update, wagerId, setMode }) {
  const [loading, setLoading] = useState(true);
  const [challengeData, setChallengeData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (!wagerId) {
      go('home');
      return;
    }

    const fetchChallenge = async () => {
      try {
        const token = await AsyncStorage.getItem('crackl_token');
        const res = await fetch(`${BACKEND}/challenge/fetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ linkId: wagerId, preview: true })
        });
        const data = await res.json();
        
        if (data.success && data.challenge) {
          setChallengeData(data.challenge);
          Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        } else {
          setErrorMsg(data.error || 'This challenge node is invalid or corrupted.');
        }
      } catch (e) {
        setErrorMsg('Network interference. Failed to retrieve challenge.');
      }
      setLoading(false);
    };

    fetchChallenge();
  }, [wagerId]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.cyan} size="large" />
        <Text style={{ color: '#64748b', fontFamily: 'Share Tech Mono', marginTop: 12, fontSize: 10, letterSpacing: 2 }}>DECRYPTING CHALLENGE NODE...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: Colors.rose, fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: '900', marginBottom: 12 }}>SYSTEM LOCKED</Text>
        <Text style={{ color: '#94a3b8', fontFamily: 'Share Tech Mono', fontSize: 12, textAlign: 'center', marginBottom: 32 }}>{errorMsg}</Text>
        <TouchableOpacity onPress={() => go('home')} style={{ padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Text style={{ color: '#fff', fontFamily: 'Share Tech Mono', fontSize: 12, letterSpacing: 1 }}>RETURN TO HUB</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const challengerName = challengeData?.challengerName || 'Unknown';
  const targetTime = challengeData?.targetTime || 0;
  const wagerAmount = challengeData?.wagerAmount || 0;
  const needsAuth = !user || !user.id;

  return (
    <View style={{ flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <FilmGrainOverlay opacity={0.03} />

      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', maxWidth: 400, width: '100%', backgroundColor: 'rgba(10,10,12,0.8)', padding: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,255,208,0.2)' }}>
        <Text style={{ color: Colors.cyan, fontFamily: 'Share Tech Mono', fontSize: 10, letterSpacing: 4, marginBottom: 8 }}>INCOMING BREACH</Text>

        <Text style={{ color: '#fff', fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 16, lineHeight: 32 }}>
          {challengerName.toUpperCase()} challenged your intellect.
        </Text>

        <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 24 }} />

        <Text style={{ color: '#94a3b8', fontFamily: 'Share Tech Mono', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
          They decrypted this exact node in <Text style={{ color: Colors.cyan, fontWeight: '700' }}>{targetTime}s</Text>.
          {wagerAmount > 0 ? `\n\nThey have wagered \n${wagerAmount} Intel\n against your failure.` : '\n\nCrack it correctly before their time to win the flex.'}
        </Text>

        {needsAuth ? (
          <TouchableOpacity
            onPress={() => go('auth')}
            style={{ width: '100%', marginTop: 32, backgroundColor: '#fbbf24', paddingVertical: 16, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#000', fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: '900', letterSpacing: 1 }}>SIGN IN TO ACCEPT</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              setMode('wager');
              go('game');
            }}
            style={{ width: '100%', marginTop: 32, backgroundColor: Colors.cyan, paddingVertical: 16, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#000', fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: '900', letterSpacing: 1 }}>ACCEPT CHALLENGE</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => go('home')} style={{ marginTop: 16, padding: 8 }}>
          <Text style={{ color: '#64748b', fontFamily: 'Share Tech Mono', fontSize: 11, letterSpacing: 1 }}>DECLINE & EVADE</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
