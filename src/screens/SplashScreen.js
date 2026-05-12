import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, Dimensions, Platform } from 'react-native';
import LogoIcon from '../components/LogoIcon';
import Colors from '../theme/colors';
import Icons from '../components/Icons';

const { width, height } = Dimensions.get('window');

function Particle({ delay, x, y }) {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(op, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
          Animated.timing(ty, { toValue: -60, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.timing(op, { toValue: 0, duration: 800, useNativeDriver: true }),
        Animated.timing(ty, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: x, top: y,
      width: 3, height: 3, borderRadius: 1.5,
      backgroundColor: Colors.purple,
      opacity: op,
      transform: [{ translateY: ty }]}} />
  );
}

export default function SplashScreen() {
  const bootOp    = useRef(new Animated.Value(1)).current;
  const logoOp    = useRef(new Animated.Value(0)).current;
  const logoSc    = useRef(new Animated.Value(0.3)).current;
  const ringOp    = useRef(new Animated.Value(0)).current;
  const ringSc    = useRef(new Animated.Value(0.5)).current;
  const subOp     = useRef(new Animated.Value(0)).current;
  const taglineOp = useRef(new Animated.Value(0)).current;
  const scanLine  = useRef(new Animated.Value(-2)).current;
  const glowPulse = useRef(new Animated.Value(0.1)).current;
  const barWidths = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  const [bootLines, setBootLines] = useState([]);

  useEffect(() => {
    const lines = [
      { text: '> ESTABLISHING SECURE TUNNEL...', delay: 0 },
      { text: '> NEURAL CORES ONLINE [4/4]', delay: 400 },
      { text: '> GEMINI AI LINK ◉ CONNECTED', delay: 800 },
      { text: '> DECRYPTING RIDDLE VAULT...', delay: 1200 },
      { text: '> IDENTITY MATRIX LOADED', delay: 1600 },
      { text: '> STATUS: ██████████ READY', delay: 2000 },
    ];
    lines.forEach(l => {
      setTimeout(() => setBootLines(prev => [...prev, l.text]), l.delay);
    });

    Animated.loop(
      Animated.timing(scanLine, { toValue: height, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 0.25, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.08, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    barWidths.forEach((b, i) => {
      Animated.timing(b, { toValue: 1, duration: 1800, delay: i * 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    });

    setTimeout(() => {
      Animated.sequence([
        Animated.timing(bootOp, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.parallel([
          Animated.spring(logoSc, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
          Animated.timing(logoOp, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(ringOp, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.spring(ringSc, { toValue: 1, tension: 40, friction: 8, useNativeDriver: true }),
        ]),
        Animated.timing(subOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(taglineOp, { toValue: 1, duration: 300, delay: 200, useNativeDriver: true }),
      ]).start();
    }, 2400);
  }, []);

  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * width,
    y: height * 0.3 + Math.random() * height * 0.5,
    delay: Math.random() * 3000}));

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgBase, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      
      {/* Grid overlay */}
      <View style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.03 }}>
        {Array.from({ length: 40 }, (_, i) => (
          <View key={`h${i}`} style={{ width: '100%', height: 1, backgroundColor: Colors.purple, marginTop: height / 40 }} />
        ))}
        {Array.from({ length: 20 }, (_, i) => (
          <View key={`v${i}`} style={{ position: 'absolute', left: (width / 20) * i, width: 1, height: '100%', backgroundColor: Colors.purple }} />
        ))}
      </View>

      {/* Scanning line */}
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, height: 2,
        backgroundColor: Colors.purple, opacity: 0.15,
        transform: [{ translateY: scanLine }]}}>
        <View style={{ width: '100%', height: 40, backgroundColor: Colors.purple, opacity: 0.05, marginTop: -20 }} />
      </Animated.View>

      {/* Particles */}
      {particles.map(p => <Particle key={p.id} delay={p.delay} x={p.x} y={p.y} />)}

      {/* Central glow orb */}
      <Animated.View style={{
        position: 'absolute', width: 400, height: 400, borderRadius: 200,
        backgroundColor: Colors.purple, opacity: glowPulse}} />

      {/* Ring effect behind logo */}
      <Animated.View style={{
        position: 'absolute', width: 220, height: 220, borderRadius: 110,
        borderWidth: 1.5, borderColor: Colors.purple,
        opacity: ringOp, transform: [{ scale: ringSc }]}} />
      <Animated.View style={{
        position: 'absolute', width: 300, height: 300, borderRadius: 150,
        borderWidth: 1, borderColor: Colors.purpleLight,
        opacity: Animated.multiply(ringOp, 0.3), transform: [{ scale: ringSc }]}} />

      {/* Boot sequence */}
      <Animated.View style={{ position: 'absolute', opacity: bootOp, width: '100%', maxWidth: 500, paddingHorizontal: 40 }}>
        <Text style={{ color: Colors.purple, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '900', letterSpacing: 4, marginBottom: 20, textTransform: 'uppercase' }}>
          CRACKL SYSTEM BOOT v5.0
        </Text>
        {bootLines.map((line, i) => (
          <Text key={i} style={{
            color: i === bootLines.length - 1 ? Colors.purpleLight : Colors.textMuted,
            fontSize: 12, fontFamily: 'Share Tech Mono', fontWeight: '600',
            marginBottom: 6, letterSpacing: 0.5}}>
            {line}
          </Text>
        ))}
        <View style={{ marginTop: 20, gap: 8 }}>
          {['Neural Net', 'Riddle Engine', 'Intel Vault'].map((label, i) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 10, fontWeight: '700', width: 80, letterSpacing: 1 }}>{label}</Text>
              <View style={{ flex: 1, height: 3, backgroundColor: Colors.borderDefault, borderRadius: 2, overflow: 'hidden' }}>
                <Animated.View style={{ height: 3, backgroundColor: Colors.purple, borderRadius: 2, width: barWidths[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
              </View>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Logo + Brand */}
      <Animated.View style={{ alignItems: 'center', opacity: logoOp, transform: [{ scale: logoSc }] }}>
        <View style={{
          width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
          backgroundColor: Colors.cardSurface, borderWidth: 1.5, borderColor: Colors.purple + '60'}}>
          <LogoIcon size={72} r={20} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 24 }}>
          <Text style={{ color: Colors.textPrimary, fontFamily: 'Black Ops One', fontSize: 48, fontWeight: '900', letterSpacing: 3 }}>CRACKL</Text>
        </View>
        <Animated.View style={{ opacity: subOp, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <View style={{ width: 40, height: 1.5, backgroundColor: Colors.purple }} />
            <Text style={{ color: Colors.purple, fontFamily: 'Share Tech Mono', fontSize: 13, fontWeight: '800', letterSpacing: 6 }}>V 5 . 0</Text>
            <View style={{ width: 40, height: 1.5, backgroundColor: Colors.purple }} />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: taglineOp, alignItems: 'center', marginTop: 28 }}>
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Chakra Petch', fontSize: 11, fontWeight: '800', letterSpacing: 4, textTransform: 'uppercase' }}>
            THE ULTIMATE BRAIN CRACK ARENA
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { icon: Icons.LinkIcon, label: 'NEURAL LINK', color: Colors.emerald },
              { icon: Icons.LockIcon, label: 'ENCRYPTED', color: Colors.cyan },
              { icon: Icons.DatabaseIcon, label: 'AI READY', color: Colors.purple },
            ].map(tag => {
              const TagIcon = tag.icon;
              return (
                <View key={tag.label} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6,
                  backgroundColor: 'rgba(15,15,26,0.6)', borderWidth: 1,
                  borderColor: tag.color + '30'}}>
                  <TagIcon size={10} color={tag.color} />
                  <Text style={{ color: tag.color, fontFamily: 'Share Tech Mono', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 }}>{tag.label}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>

      {/* Corner decorations */}
      <View style={{ position: 'absolute', top: 30, left: 30 }}>
        <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 9, fontWeight: '700', letterSpacing: 2, opacity: 0.4 }}>SYS://CRACKL.IO</Text>
      </View>
      <View style={{ position: 'absolute', top: 30, right: 30 }}>
        <Text style={{ color: Colors.purple, fontFamily: 'Share Tech Mono', fontSize: 9, fontWeight: '700', letterSpacing: 2, opacity: 0.5 }}>◉ LIVE</Text>
      </View>
      <View style={{ position: 'absolute', bottom: 30, left: 30 }}>
        <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 9, fontWeight: '700', letterSpacing: 2, opacity: 0.3 }}>LATENCY: 12ms</Text>
      </View>
      <View style={{ position: 'absolute', bottom: 30, right: 30 }}>
        <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 9, fontWeight: '700', letterSpacing: 2, opacity: 0.3 }}>NODE: ALPHA-7</Text>
      </View>
    </View>
  );
}
