/**
 * CRACKL — App Entry Point (V4.0)
 * 
 * Previously a 2076-line monolith. Now a clean entry point.
 * All screens, components, and theme files live under src/.
 * 
 * Architecture:
 *   App.js  →  AppNavigator  →  Screens  →  Components
 *                                   ↓
 *                            theme/ + utils/
 */
import React, { useEffect, useState } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.type = 'text/css';
      style.appendChild(document.createTextNode(`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Share+Tech+Mono&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
      `));
      document.head.appendChild(style);
      
      // Delay slightly to ensure fonts are downloaded
      setTimeout(() => setFontsLoaded(true), 50);
    }
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#07070F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#7C3AED" size="large" />
      </View>
    );
  }

  return <AppNavigator />;
}
