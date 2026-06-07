/**
 * GlowButton — Gradient-style button with glow shadow
 */
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Platform } from 'react-native';
import Colors from '../theme/colors';

const isWeb = Platform.OS === 'web';

export default function GlowButton({
  title, onPress, color = Colors.purple, loading, disabled,
  style, textStyle, icon, ...props
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        {
          backgroundColor: color,
          borderRadius: 18,
          paddingVertical: 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          ...(isWeb ? {
            boxShadow: `0 0 20px ${color}72`,
          } : {
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.45,
          shadowRadius: 20,
          }),
          elevation: 8,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={Colors.white} />
      ) : (
        <>
          {icon}
          <Text style={[
            { color: Colors.white, fontWeight: '900', fontSize: 17, letterSpacing: 1 },
            textStyle,
          ]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
