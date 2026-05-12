import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, TouchableOpacity, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND } from '../utils/api';

export default function MaintenanceScreen({ go, message }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const [tapCount, setTapCount] = useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Poll every 30s — when maintenance ends, go to home if session exists else auth
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND}/app/status`);
        const data = await res.json();
        if (!data.maintenance) {
          const raw = await AsyncStorage.getItem('crackl_user');
          go(raw ? 'home' : 'auth');
        }
      } catch {}
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Tap the lock 5 times to get admin escape hatch
  const handleLockTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    if (next >= 5) {
      setTapCount(0);
      go('auth');
    }
  };

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ flex: 1, backgroundColor: '#07070F', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      {/* Tap 5x to escape (admin escape hatch) */}
      <TouchableOpacity onPress={handleLockTap} activeOpacity={0.9}>
        <Animated.View style={{ transform: [{ scale: pulse }, { rotate: rotation }], marginBottom: 32 }}>
          <Text style={{ fontSize: 64 }}>🔒</Text>
        </Animated.View>
      </TouchableOpacity>

      <Text style={{ color: '#7C3AED', fontFamily: 'Chakra Petch', fontSize: 28, fontWeight: '900', letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 8 }}>
        CRACKL
      </Text>
      <Text style={{ color: '#fff', fontFamily: 'Share Tech Mono', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', marginBottom: 24 }}>
        VAULT UPDATE IN PROGRESS
      </Text>

      <View style={{ backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: 12, padding: 20, maxWidth: 340, width: '100%' }}>
        <Text style={{ color: '#C4B5FD', fontFamily: 'Chakra Petch', fontSize: 15, textAlign: 'center', lineHeight: 24 }}>
          {message || 'We are updating the vault with fresh riddles. Back soon!'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 40 }}>
        <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED', transform: [{ scale: pulse }] }} />
        <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 11, letterSpacing: 1 }}>
          AUTO-CHECKING EVERY 30 SECONDS
        </Text>
      </View>

      {/* Show tap progress hint after 2 taps */}
      {tapCount >= 2 && (
        <Text style={{ color: '#374151', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 24 }}>
          {5 - tapCount} more tap{5 - tapCount !== 1 ? 's' : ''} for admin access
        </Text>
      )}
    </View>
  );
}
