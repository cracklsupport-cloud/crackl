import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Animated, Platform, TouchableOpacity } from 'react-native';
import Colors from '../theme/colors';
import Icons from '../components/Icons';

export default function BrainProfileScreen({ go }) {
  const [fillAnims] = useState([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]);

  useEffect(() => {
    Animated.stagger(200, fillAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: [82, 71, 54][i],
        duration: 1200,
        useNativeDriver: false
      })
    )).start();
  }, []);

  const StrengthBar = ({ label, pct, desc, anim, index }) => {
    const barCol = index === 0 ? Colors.purple : index === 1 ? Colors.cyan : Colors.emerald;
    return (
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
          <Text style={{ color: barCol, fontFamily: 'Share Tech Mono', fontSize: 14, fontWeight: '900' }}>{pct}%</Text>
        </View>
        <View style={{ height: 6, backgroundColor: Colors.borderDefault, borderRadius: 3, overflow: 'hidden' }}>
          <Animated.View style={{
            height: '100%', backgroundColor: barCol,
            width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
          }} />
        </View>
        <Text style={{ color: Colors.textMuted, fontFamily: 'Cormorant Garamond', fontSize: 13, marginTop: 8, fontStyle: 'italic' }}>{desc}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.bgBase }} contentContainerStyle={{ padding: 24, paddingBottom: 60, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ flex: 1, width: '100%', maxWidth: 428 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <TouchableOpacity onPress={() => go('home')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icons.ChevronLeftIcon size={14} color={Colors.purple} />
          <Text style={{ color: Colors.purple, fontFamily: 'Share Tech Mono', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>BACK TO HUB</Text>
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 10, fontWeight: '900', letterSpacing: 3 }}>WEEKLY INTELLIGENCE REPORT</Text>
        <Text style={{ color: Colors.textPrimary, fontFamily: 'Cormorant Garamond', fontSize: 15, marginTop: 6, fontStyle: 'italic' }}>Cycle 99.4</Text>
        <Text style={{ color: Colors.purpleLight, fontFamily: 'Chakra Petch', fontSize: 24, fontWeight: '900', marginTop: 16, letterSpacing: 1, textTransform: 'uppercase' }}>OPERATIVE PROFILE</Text>
      </View>

      {/* Archetype Card */}
      <View style={{ backgroundColor: 'rgba(15,15,26,0.6)', borderRadius: 20, padding: 32, marginBottom: 24, overflow: 'hidden', borderWidth: 1, borderColor: Colors.purple+'50'}}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.purple, opacity: 0.05 }} />
        <View style={{ position: 'absolute', top: '-20%', right: '-20%', width: 150, height: 150, borderRadius: 75, backgroundColor: Colors.purple, opacity: 0.1}} />
        
        <View style={{ alignItems: 'center' }}>
          <Icons.TargetIcon size={48} color={Colors.purpleLight} />
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginTop: 24 }}>INTELLIGENCE ARCHETYPE</Text>
          <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 28, fontWeight: '900', textAlign: 'center', marginTop: 8, letterSpacing: 1, textTransform: 'uppercase' }}>THE PATTERN DETECTIVE</Text>
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 15, textAlign: 'center', marginTop: 14, lineHeight: 22 }}>
            You excel at seeing the invisible threads connecting seemingly unrelated data points in the grid.
          </Text>
        </View>
      </View>

      {/* Strength Bars */}
      <View style={{ backgroundColor: 'rgba(15,15,26,0.6)', borderRadius: 20, padding: 28, marginBottom: 24, borderWidth: 1, borderColor: Colors.borderDefault}}>
        <StrengthBar index={0} anim={fillAnims[0]} pct={82} label="Lateral Thinking" desc="Top 12% of operatives in Sector BLR" />
        <StrengthBar index={1} anim={fillAnims[1]} pct={71} label="Pattern Recognition" desc="Top 23% of operatives globally" />
        <StrengthBar index={2} anim={fillAnims[2]} pct={54} label="Historical Decryption" desc="Top 41% of operatives globally" />
      </View>

      {/* Weakness Card */}
      <View style={{ backgroundColor: 'rgba(15,15,26,0.4)', borderRadius: 20, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: Colors.rose+'40', borderLeftWidth: 4, borderLeftColor: Colors.rose}}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icons.AlertTriangleIcon size={16} color={Colors.rose} />
          <Text style={{ color: Colors.rose, fontFamily: 'Chakra Petch', fontSize: 14, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>Identified Vulnerability</Text>
        </View>
        <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 15, lineHeight: 22 }}>Logic Sequences. System flags a struggle when decrypting step-by-step logic chains over intuitive leaps.</Text>
        <View style={{ marginTop: 16, backgroundColor: Colors.rose+'10', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.rose+'25' }}>
          <Icons.TerminalIcon size={12} color={Colors.rose} />
          <Text style={{ color: Colors.rose, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '700' }}>SYS REQ: Run 3 Logic Sequences daily.</Text>
        </View>
      </View>

      {/* Weekly Stats Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Puzzles Decrypted', val: '47' },
          { label: 'Accuracy Rating', val: '72%' },
          { label: 'Peak Cycle', val: 'Wednesday' },
          { label: 'Longest Combo', val: '8 streak' }
        ].map(s => (
          <View key={s.label} style={{ width: '48%', backgroundColor: 'rgba(15,15,26,0.6)', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderDefault}}>
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Share Tech Mono', fontSize: 22, fontWeight: '900' }}>{s.val}</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: 'Chakra Petch', fontSize: 11, fontWeight: '700', marginTop: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Challenge Card */}
      <View style={{ backgroundColor: 'rgba(15,15,26,0.4)', borderRadius: 20, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: Colors.gold+'40', borderLeftWidth: 4, borderLeftColor: Colors.gold}}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icons.TrophyIcon size={16} color={Colors.gold} />
          <Text style={{ color: Colors.gold, fontFamily: 'Chakra Petch', fontSize: 14, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>Next Cycle Objective</Text>
        </View>
        <Text style={{ color: Colors.textPrimary, fontFamily: 'Cormorant Garamond', fontSize: 16, fontWeight: '600' }}>Crack 10 Cipher Sequences.</Text>
        <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 15, marginTop: 4 }}>Your code-breaking skill needs unlocking.</Text>
      </View>

      {/* AI Insight */}
      <View style={{ backgroundColor: 'rgba(15,15,26,0.4)', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.indigo+'40', borderLeftWidth: 4, borderLeftColor: Colors.indigo}}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icons.DatabaseIcon size={16} color={Colors.indigo} />
          <Text style={{ color: Colors.indigo, fontFamily: 'Chakra Petch', fontSize: 14, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>System Insight</Text>
        </View>
        <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 16, lineHeight: 24, fontStyle: 'italic' }}>
          "Subject relies heavily on speed and intuition natively. While this yields results in Quick Crack protocol, crucial details are lost in complex cipher texts. Slow computation by 3s could yield a 15% system accuracy increase."
        </Text>
      </View>
      </View>
    </ScrollView>
  );
}
