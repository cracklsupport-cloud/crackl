/**
 * CRACKL v5 — Panic Mode Switch
 * 
 * Cinematic mechanical switch.
 * Triggers a 3-second choreographed activation sequence on the web.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Platform, Animated, TouchableWithoutFeedback, View } from 'react-native';

export default function PanicSwitch({ isPanic, onToggle }) {
  const [isActivating, setIsActivating] = useState(false);

  // Web implementation with GSAP sequence
  if (Platform.OS === 'web') {
    const handleToggle = () => {
      if (isActivating) return;
      
      if (!isPanic) {
        // Activation sequence (3 seconds)
        setIsActivating(true);
        
        // 1. Initial click - lock UI
        document.body.classList.add('panic-activating');
        
        // Use standard setTimeout since we're using CSS animations mostly
        // GSAP would be better but this works without adding the dep to every file
        
        // 2. Add chromatic aberration flash
        const flash = document.createElement('div');
        flash.className = 'vignette chromatic-flash';
        flash.style.zIndex = 9999;
        document.body.appendChild(flash);
        
        setTimeout(() => flash.remove(), 400);

        // 3. Final activation after suspense
        setTimeout(() => {
          setIsActivating(false);
          document.body.classList.remove('panic-activating');
          document.documentElement.classList.add('panic-active');
          onToggle(true);
        }, 3000);

      } else {
        // Deactivation (fast)
        document.documentElement.classList.remove('panic-active');
        onToggle(false);
      }
    };

    return (
      <div 
        className="mech-switch-housing" 
        onClick={handleToggle}
        style={{ opacity: isActivating ? 0.7 : 1, cursor: isActivating ? 'wait' : 'pointer' }}
      >
        <div className={`mech-switch-knob ${isPanic ? 'on' : ''}`} style={{ left: isPanic ? '30px' : '2px' }} />
        <div className={`mech-switch-led ${isPanic ? 'on' : ''}`} />
      </div>
    );
  }

  // Native fallback toggle
  return (
    <TouchableWithoutFeedback onPress={() => onToggle(!isPanic)}>
      <View style={{
        width: 60, height: 32, borderRadius: 16,
        backgroundColor: isPanic ? '#991B1B' : '#1A1B2E',
        justifyContent: 'center', padding: 2,
        borderWidth: 1, borderColor: isPanic ? '#FF0000' : '#334155'
      }}>
        <View style={{
          width: 26, height: 26, borderRadius: 13,
          backgroundColor: isPanic ? '#FF0000' : '#94A3B8',
          marginLeft: isPanic ? 28 : 2,
        }} />
      </View>
    </TouchableWithoutFeedback>
  );
}
