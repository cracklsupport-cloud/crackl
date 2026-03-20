/**
 * TagPill — Small colored tag badge
 */
import React from 'react';
import { View, Text } from 'react-native';

export default function TagPill({ label, color, style }) {
  return (
    <View style={[{
      backgroundColor: `${color}20`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      alignSelf: 'flex-start',
    }, style]}>
      <Text style={{
        color: color,
        fontWeight: '900',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 2,
      }}>
        {label}
      </Text>
    </View>
  );
}
