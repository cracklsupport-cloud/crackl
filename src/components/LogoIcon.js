/**
 * LogoIcon — CRACKL brain logo with neon glow
 */
import React from 'react';
import { View, Image, Platform } from 'react-native';
import Colors from '../theme/colors';

const isWeb = Platform.OS === 'web';

export default function LogoIcon({ size = 44, r = 14 }) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: r,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: Colors.purple,
      ...(isWeb ? {
        boxShadow: `0 0 15px ${Colors.purple}`,
      } : {
      shadowColor: Colors.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 15,
      }),
      elevation: 12,
      backgroundColor: Colors.black,
    }}>
      <Image
        source={require('../../assets/brain_logo.png')}
        style={{ width: size * 1.6, height: size * 1.6 }}
        resizeMode="cover"
      />
    </View>
  );
}
