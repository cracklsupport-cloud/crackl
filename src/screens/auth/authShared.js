import React, { useState } from 'react';
import { Text, View, TextInput } from 'react-native';
import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const BrainImage = require('../../../assets/brain_logo.png');

export const GlassLabel = ({ children }) => (
  <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#6b7280', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 }}>{children}</Text>
);

export const GlassField = ({ value, onChangeText, placeholder, secure, keyboardType, autoCapitalize, maxLength, style, onSubmitEditing, icon }) => {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={[{ position: 'relative', justifyContent: 'center' }, style]}>
      {icon && (
        <View style={{ position: 'absolute', left: 16, zIndex: 10, height: '100%', justifyContent: 'center' }}>
          {icon}
        </View>
      )}
      <TextInput
        style={[{
          backgroundColor: isFocused ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255, 255, 255, 0.02)',
          borderWidth: 1,
          borderColor: isFocused ? '#8b5cf6' : 'rgba(255, 255, 255, 0.08)',
          borderRadius: 4,
          paddingVertical: 16,
          paddingLeft: icon ? 48 : 16,
          paddingRight: 16,
          color: '#ffffff',
          fontSize: 14,
          fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
          outlineStyle: 'none',
        }, isFocused && isWeb ? { boxShadow: '0 0 15px rgba(139, 92, 246, 0.2)' } : {}]}
        placeholder={placeholder}
        placeholderTextColor="#4b5563"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'none'}
        maxLength={maxLength}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </View>
  );
};
