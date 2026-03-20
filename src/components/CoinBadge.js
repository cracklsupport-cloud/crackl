/**
 * CoinBadge — Animated coin display with pulsing glow
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import Colors from '../theme/colors';

export default function CoinBadge({ amount, size = 'md', style }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const fontSize = size === 'lg' ? 18 : size === 'sm' ? 13 : 16;

  return (
    <Animated.View style={[{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.goldBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      shadowColor: Colors.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 4,
      transform: [{ scale: pulse }],
    }, style]}>
      <Text style={{ fontSize: fontSize + 2, marginRight: 4 }}>🪙</Text>
      <Text style={{
        color: Colors.gold,
        fontWeight: '900',
        fontSize,
      }}>
        {typeof amount === 'number' ? amount.toLocaleString() : amount}
      </Text>
    </Animated.View>
  );
}
