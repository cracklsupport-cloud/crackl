/**
 * LogoIcon — CRACKL brain logo with neon glow
 */
import React from 'react';
import { View, Image } from 'react-native';
import Colors from '../theme/colors';

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
      shadowColor: Colors.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 15,
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
