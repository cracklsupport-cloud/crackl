/**
 * CyberInput — Styled text input with focus glow
 */
import React, { useState } from 'react';
import { TextInput } from 'react-native';
import Colors from '../theme/colors';

export default function CyberInput({
  value, onChangeText, placeholder, style, accentColor,
  secureTextEntry, autoCapitalize, multiline, ...props
}) {
  const [focused, setFocused] = useState(false);
  const accent = accentColor || Colors.purple;

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize || 'none'}
      multiline={multiline}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          backgroundColor: Colors.cardSurface,
          borderWidth: 1.5,
          borderColor: focused ? accent : Colors.borderDefault,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 16,
          fontSize: 15,
          color: Colors.textPrimary,
          ...(focused ? {
            shadowColor: accent,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 4,
          } : {}),
        },
        style,
      ]}
      {...props}
    />
  );
}
