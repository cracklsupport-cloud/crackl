/**
 * GlassCard — Reusable glass morphism container
 */
import React from 'react';
import { View, Platform } from 'react-native';
import Colors from '../theme/colors';

import React from 'react';
import { View, Platform } from 'react-native';
import Colors from '../theme/colors';
import { FilmGrainOverlay } from './AtmosphericEffects';

export default function GlassCard({ children, style, accentColor, noBorder, noHover, ...props }) {
  if (Platform.OS === 'web') {
    return (
      <div 
        className={`glass-card ${noHover ? 'no-hover' : ''}`}
        style={{ padding: 18, borderRadius: 24, ...style }}
        {...props}
      >
        <FilmGrainOverlay />
        <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
      </div>
    );
  }

  // Native fallback
  const borderCol = accentColor ? `${accentColor}40` : Colors.glassBorder;
  const glowCol = accentColor || Colors.purple;

  return (
    <View
      style={[
        {
          backgroundColor: Colors.glassBg,
          borderWidth: noBorder ? 0 : 1.5,
          borderColor: borderCol,
          borderRadius: 24,
          padding: 18,
          shadowColor: glowCol,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 4,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
