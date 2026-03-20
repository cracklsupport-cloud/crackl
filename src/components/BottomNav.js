/**
 * BottomNav — 5-tab bottom navigation
 */
import React from 'react';
import { View, TouchableOpacity, Text, Platform } from 'react-native';
import Colors from '../theme/colors';

const TABS = [
  { key: 'home',        icon: '🏠', label: 'Home' },
  { key: 'leaderboard', icon: '🏆', label: 'Board' },
  { key: 'play',        icon: '⚡', label: 'Play', center: true },
  { key: 'wallet',      icon: '💸', label: 'Cash' },
  { key: 'profile',     icon: '👤', label: 'Profile' },
];

export default function BottomNav({ active, onTab }) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: 10,
      paddingBottom: Platform.OS === 'ios' ? 24 : 10,
      backgroundColor: Colors.glassBg,
      borderTopWidth: 1,
      borderTopColor: Colors.glassBorder,
      ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.key;
        if (tab.center) {
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onTab(tab.key)}
              activeOpacity={0.8}
              style={{
                backgroundColor: Colors.purple,
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -20,
                shadowColor: Colors.purple,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <Text style={{ fontSize: 22 }}>{tab.icon}</Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTab(tab.key)}
            activeOpacity={0.7}
            style={{ alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4 }}
          >
            <Text style={{ fontSize: 20, opacity: isActive ? 1 : 0.5 }}>{tab.icon}</Text>
            <Text style={{
              color: isActive ? Colors.purple : Colors.textMuted,
              fontSize: 10,
              fontWeight: isActive ? '800' : '500',
              marginTop: 2,
            }}>
              {tab.label}
            </Text>
            {isActive && (
              <View style={{
                width: 16,
                height: 2,
                backgroundColor: Colors.purple,
                borderRadius: 1,
                marginTop: 3,
                shadowColor: Colors.purple,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 4,
              }} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
