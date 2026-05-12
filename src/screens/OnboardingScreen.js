import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Platform } from 'react-native';
import Colors from '../theme/colors';
import LogoIcon from '../components/LogoIcon';
import CyberInput from '../components/CyberInput';
import GlowButton from '../components/GlowButton';
import Icons from '../components/Icons';

export default function OnboardingScreen({ user, go, update }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(user?.username || '');
  const [city, setCity] = useState(user?.city || '');
  const [area, setArea] = useState(user?.area || '');
  const fade = new Animated.Value(1);

  const nextStep = () => {
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();
    setTimeout(() => setStep(2), 200);
  };

  const finish = async () => {
    const updatedUser = { ...user, username: name || user.username, city, area };
    try {
      update(updatedUser);
    } catch {}
    go('home');
  };

  const Feature = ({ icon: IconComp, title, desc }) => (
    <View style={{
      backgroundColor: 'rgba(15,15,26,0.6)', borderWidth: 1, borderColor: Colors.borderDefault,
      borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14}}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bgBase, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.purple }}>
        <IconComp size={20} color={Colors.textPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 16, fontWeight: '800', marginBottom: 2, letterSpacing: 0.5 }}>{title}</Text>
        <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 15 }}>{desc}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgBase, padding: 24, paddingTop: 60, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 428 }}>
      {step === 1 ? (
        <Animated.View style={{ flex: 1, opacity: fade }}>
          <View style={{ alignItems: 'flex-start', marginBottom: 40 }}>
            <LogoIcon size={64} r={16} />
            <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 34, fontWeight: '900', marginTop: 24, letterSpacing: -0.5, textTransform: 'uppercase' }}>Welcome to CRACKL</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 16, marginTop: 12, lineHeight: 22 }}>
              India's most addictive intelligence game. Answer riddles. Earn real cash. Outsmart your city.
            </Text>
          </View>
          
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <Feature icon={Icons.ZapIcon} title="Quick Crack" desc="4 options. Pick fast. Earn Intel instantly." />
            <Feature icon={Icons.DatabaseIcon} title="Brain Blast" desc="Type your answer. AI understands. 1.5x Intel." />
            <Feature icon={Icons.SwordsIcon} title="Multiplayer" desc="Battle 2-5 friends in real-time rooms." />
            <Feature icon={Icons.IntelIcon} title="Real Cashback" desc="Intel → ₹ straight to your UPI." />
          </ScrollView>

          <View style={{ paddingVertical: 20 }}>
            <GlowButton text="INITIALIZE SEQUENCE →" onPress={nextStep} color={Colors.purple} />
          </View>
        </Animated.View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fade }}>
          <View style={{ marginBottom: 40 }}>
            <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, textTransform: 'uppercase' }}>Operative Profile</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 16, marginTop: 8 }}>
              Initialize your local surveillance grid by entering sector details.
            </Text>
          </View>

          <View style={{ gap: 24 }}>
            <View>
              <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 }}>ALIAS CODENAME</Text>
              <CyberInput value={name} onChangeText={setName} placeholder="Enter designation..." />
            </View>
            <View>
              <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 }}>PRIMARY SECTOR (CITY)</Text>
              <CyberInput value={city} onChangeText={setCity} placeholder="Bengaluru, Delhi, Mumbai..." />
            </View>
            <View>
              <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 }}>SUB-SECTOR (AREA)</Text>
              <CyberInput value={area} onChangeText={setArea} placeholder="Koramangala, Andheri..." />
            </View>
          </View>

          <View style={{ marginTop: 'auto', paddingBottom: 20 }}>
            <GlowButton text="ESTABLISH LINK ⚡" onPress={finish} color={Colors.purple} />
            <TouchableOpacity onPress={() => setStep(1)} style={{ marginTop: 24, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icons.TargetIcon size={14} color={Colors.textMuted} />
                <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>ABORT PROTOCOL</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      </View>
    </View>
  );
}
