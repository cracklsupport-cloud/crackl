import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Platform } from 'react-native';
import Colors from '../theme/colors';
import Icons from '../components/Icons';

export default function BlackMarketScreen({ user, go }) {
  const [coins, setCoins] = useState(user?.coins || 2450);
  const [stamps, setStamps] = useState({});

  const buyItem = (id, cost) => {
    if (coins < cost) return;
    setCoins(c => c - cost);
    setStamps(prev => ({ ...prev, [id]: true }));
    setTimeout(() => setStamps(prev => ({ ...prev, [id]: false })), 2000);
  };

  const PowerUp = ({ id, icon: IconComp, title, desc, cost, owned, color }) => {
    const isAcquired = stamps[id];
    return (
      <View style={{
        backgroundColor: 'rgba(15,15,26,0.6)', borderRadius: 20, padding: 24, marginBottom: 16,
        borderWidth: 1.5, borderColor: isAcquired ? color : Colors.borderDefault, overflow: 'hidden'}}>
        {/* Glow Background */}
        <View style={{ position: 'absolute', top: -40, left: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: color, opacity: 0.1}} />
        
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, flex: 1 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.bgBase, borderWidth: 1, borderColor: color+'40', alignItems: 'center', justifyContent: 'center' }}>
              <IconComp size={24} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 18, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>{title}</Text>
              <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 15, marginTop: 4, lineHeight: 22 }}>{desc}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <Icons.DatabaseIcon size={12} color={Colors.textMuted} />
                <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>CURRENT INVENTORY: {owned}</Text>
              </View>
            </View>
          </View>
          
          <TouchableOpacity 
            style={{ backgroundColor: color + '20', borderWidth: 1, borderColor: color, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, opacity: coins >= cost ? 1 : 0.4, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            onPress={() => buyItem(id, cost)}
            disabled={coins < cost}
          >
            <Icons.IntelIcon size={14} color={color} />
            <Text style={{ color: color, fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 16 }}>{cost}</Text>
          </TouchableOpacity>
        </View>

        {isAcquired && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center'}}>
            <Animated.Text style={{ color: color, fontFamily: 'Chakra Petch', fontSize: 28, fontWeight: '900', letterSpacing: 6, transform: [{ rotate: '-10deg' }] }}>
               ACQUIRED 
            </Animated.Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.bgBase }} contentContainerStyle={{ padding: 24, paddingBottom: 60, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ flex: 1, width: '100%', maxWidth: 428 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <TouchableOpacity onPress={() => go('home')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icons.ChevronLeftIcon size={14} color={Colors.purple} />
          <Text style={{ color: Colors.purple, fontFamily: 'Share Tech Mono', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>LEAVE MARKET</Text>
        </TouchableOpacity>
        <View style={{ backgroundColor: Colors.cardSurface, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.gold+'40'}}>
          <Icons.IntelIcon size={14} color={Colors.gold} />
          <Text style={{ color: Colors.gold, fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 16 }}>{coins}</Text>
        </View>
      </View>

      <View style={{ marginBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Icons.ShieldIcon size={24} color={'#fff'} />
          <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 28, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>THE BLACK MARKET</Text>
        </View>
        <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 16, paddingLeft: 36 }}>Spend your assets. Gain the tactical edge.</Text>
      </View>

      <PowerUp id="freeze" icon={Icons.TimerIcon} title="TIME FREEZE" desc="Deploys chronostatic field for 10 seconds during any live intercept (game round)." cost={25} owned={3} color={Colors.cyan} />
      <PowerUp id="oracle" icon={Icons.DatabaseIcon} title="THE ORACLE" desc="Access restricted database to receive one cryptic, high-value hint per puzzle." cost={40} owned={1} color={Colors.purple} />
      <PowerUp id="reveal" icon={Icons.ZapIcon} title="LETTER REVEAL" desc="Forces a system decrypt on the first character of the code sequence (Type Mode only)." cost={15} owned={0} color={Colors.emerald} />

      </View>
    </ScrollView>
  );
}
