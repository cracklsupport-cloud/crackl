import React, { useState } from 'react';
import { Text, View, TextInput, Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const BrainImage = require('../../../assets/brain_logo.png');

export const GlassLabel = ({ children }) => (
  <Text style={{ fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, color: '#9ca3af', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginTop: 16, marginLeft: 4 }}>{children}</Text>
);

export const GlassField = ({
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize,
  autoComplete,
  textContentType,
  maxLength,
  style,
  onSubmitEditing,
  icon,
  focusColor = '#a855f7',
  nativeID,
  name,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Helper to convert hex to rgba for backgrounds/shadows
  const hexToRgba = (hex, alpha) => {
    let r = 0, g = 0, b = 0;
    if (hex.startsWith('#')) {
      if (hex.length === 4) { r = parseInt(hex[1]+hex[1],16); g = parseInt(hex[2]+hex[2],16); b = parseInt(hex[3]+hex[3],16); }
      else if (hex.length === 7) { r = parseInt(hex.substring(1,3),16); g = parseInt(hex.substring(3,5),16); b = parseInt(hex.substring(5,7),16); }
    }
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const focusBg = hexToRgba(focusColor, 0.05);
  const glowShadow = hexToRgba(focusColor, 0.15);

  return (
    <View style={[{ position: 'relative', justifyContent: 'center' }, style]}>
      {icon && (
        <View style={{ position: 'absolute', left: 16, zIndex: 10, height: '100%', justifyContent: 'center' }}>
          {isFocused && React.isValidElement(icon) 
            ? React.cloneElement(icon, { style: { ...icon.props.style, color: focusColor } })
            : icon}
        </View>
      )}
      <TextInput
        style={[{
          backgroundColor: isFocused ? focusBg : (isHovered ? 'rgba(255,255,255,0.03)' : '#050505'),
          borderWidth: 2,
          borderColor: isFocused ? focusColor : (isHovered ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'),
          borderRadius: 12,
          paddingVertical: 16,
          paddingLeft: icon ? 48 : 16,
          paddingRight: rightElement ? 48 : 16,
          color: '#ffffff',
          fontSize: 14,
          fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
          letterSpacing: 1,
        }, isWeb ? {
          outlineStyle: 'none',
          transition: 'all 0.3s ease',
        } : {}, isFocused && isWeb ? { boxShadow: `0 0 15px ${glowShadow}` } : {}]}
        placeholder={placeholder}
        placeholderTextColor="#4b5563"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'none'}
        autoComplete={autoComplete}
        textContentType={textContentType}
        nativeID={nativeID}
        dataSet={isWeb && name ? { field: name } : undefined}
        maxLength={maxLength}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        textContentType={textContentType}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        {...(isWeb ? {
          onMouseEnter: () => setIsHovered(true),
          onMouseLeave: () => setIsHovered(false),
        } : {})}
      />
      {rightElement && (
        <View style={{ position: 'absolute', right: 16, zIndex: 10, height: '100%', justifyContent: 'center' }}>
          {rightElement}
        </View>
      )}
    </View>
  );
};
