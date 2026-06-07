import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import Colors from '../theme/colors';
import Icons from '../components/Icons';

const isWeb = Platform.OS === 'web';

export default function BlackMarketScreen({ user, go }) {
  const [notice, setNotice] = useState('');
  const coins = Math.max(0, parseInt(user?.coins, 10) || 0);

  const handleToolPress = (title, cost) => {
    if (coins < cost) {
      setNotice(`Need ${(cost - coins).toLocaleString()} more Intel for ${title}.`);
      return;
    }
    setNotice(`${title} is armed inside live riddles. No Intel is deducted from the market preview.`);
  };

  const PowerUp = ({ icon: IconComp, title, desc, cost, color, availableIn }) => {
    const canAfford = coins >= cost;
    return (
      <View style={{
        backgroundColor: 'rgba(15,15,26,0.6)',
        borderRadius: 12,
        padding: 22,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: Colors.borderDefault,
        overflow: 'hidden'
      }}>
        <View style={{ position: 'absolute', top: -40, left: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: color, opacity: 0.1 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, flex: 1 }}>
            <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: Colors.bgBase, borderWidth: 1, borderColor: color + '40', alignItems: 'center', justifyContent: 'center' }}>
              <IconComp size={23} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 17, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>{title}</Text>
              <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 15, marginTop: 4, lineHeight: 22 }}>{desc}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <Icons.DatabaseIcon size={12} color={Colors.textMuted} />
                <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>{availableIn}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[{
              backgroundColor: color + '16',
              borderWidth: 1,
              borderColor: color + (canAfford ? 'AA' : '44'),
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 8,
              opacity: canAfford ? 1 : 0.5,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6
            }, isWeb ? { cursor: 'pointer' } : {}]}
            onPress={() => handleToolPress(title, cost)}
          >
            <Icons.IntelIcon size={14} color={color} />
            <Text style={{ color, fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 15 }}>{cost}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.bgBase }} contentContainerStyle={{ padding: 24, paddingBottom: 60, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ flex: 1, width: '100%', maxWidth: 520 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <TouchableOpacity onPress={() => go('home')} style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, isWeb ? { cursor: 'pointer' } : {}]}>
            <Icons.ChevronLeftIcon size={14} color={Colors.purple} />
            <Text style={{ color: Colors.purple, fontFamily: 'Share Tech Mono', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>LEAVE MARKET</Text>
          </TouchableOpacity>
          <View style={{ backgroundColor: Colors.cardSurface, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.gold + '40' }}>
            <Icons.IntelIcon size={14} color={Colors.gold} />
            <Text style={{ color: Colors.gold, fontFamily: 'Share Tech Mono', fontWeight: '900', fontSize: 16 }}>{coins.toLocaleString()}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icons.ShieldIcon size={24} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 28, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>Tactical Arsenal</Text>
          </View>
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 16, paddingLeft: 36, lineHeight: 22 }}>
            Live tools now activate inside active riddles, so Intel stays synced with Supabase.
          </Text>
        </View>

        {!!notice && (
          <View style={{ marginBottom: 18, padding: 14, borderRadius: 8, backgroundColor: 'rgba(0,255,208,0.05)', borderWidth: 1, borderColor: 'rgba(0,255,208,0.15)' }}>
            <Text style={{ color: Colors.cyan, fontFamily: 'Share Tech Mono', fontSize: 12, lineHeight: 18 }}>{notice}</Text>
          </View>
        )}

        <PowerUp
          icon={Icons.TimerIcon}
          title="Time Freeze"
          desc="Add ten seconds during a Panic Mode riddle when the clock is eating your brain."
          cost={100}
          availableIn="LIVE GAME // PANIC MODE ONLY"
          color={Colors.cyan}
        />
        <PowerUp
          icon={Icons.DatabaseIcon}
          title="The Oracle"
          desc="Pull one cryptic, high-value clue from the restricted archive without exposing the answer."
          cost={150}
          availableIn="LIVE GAME // ACTIVE RIDDLE"
          color={Colors.purple}
        />
        <PowerUp
          icon={Icons.ZapIcon}
          title="Field Tip"
          desc="Buy an extra hint when the first clue is not enough."
          cost={12}
          availableIn="LIVE GAME // ACTIVE RIDDLE"
          color={Colors.emerald}
        />

        <TouchableOpacity onPress={() => go('home')} style={[{ marginTop: 8, paddingVertical: 14, alignItems: 'center', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.borderDefault }, isWeb ? { cursor: 'pointer' } : {}]}>
          <Text style={{ color: Colors.textPrimary, fontFamily: 'Share Tech Mono', fontSize: 12, fontWeight: '900', letterSpacing: 1.6 }}>OPEN A LIVE CASE</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
