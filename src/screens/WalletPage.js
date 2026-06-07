import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import Colors from '../theme/colors';
import { useResponsive } from '../theme/breakpoints';
import { BACKEND } from '../utils/api';
import { getAuthToken } from '../utils/authSession';
import Icons from '../components/Icons';

export default function WalletPage({ user, update }) {
  const [upi, setUpi] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const tiers = [{ c:500,r:40 },{ c:1500,r:160 },{ c:5000,r:800 },{ c:15000,r:2800 }];
  const { isMobile: stackLayout, isPhone } = useResponsive();

  async function redeem(t) {
    if (!upi.trim()) { setMsg('Enter your UPI ID first!'); return; }
    if ((user?.coins||0) < t.c) { setMsg(`Need ${t.c-user.coins} more Intel!`); return; }
    setLoading(true); setMsg('');
    try {
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND}/cashback`, { method:'POST', headers:{'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{})}, body:JSON.stringify({ userId:user.id, coinsToRedeem:t.c, upiId:upi }) });
      const data = await res.json();
      if (data.success) { setMsg('✅ '+data.message); update({...user, coins:user.coins-t.c}); } else setMsg('❌ '+(data.error||'Error'));
    } catch { setMsg('❌ Network error'); } setLoading(false);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: isPhone ? 12 : 28, paddingBottom: 60, backgroundColor: 'transparent' }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: isPhone ? 16 : 28 }}>
        <View style={{ width: 3, height: 20, backgroundColor: Colors.emerald, borderRadius: 2 }} />
        <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: isPhone ? 16 : 24, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>WALLET & FIAT EXCH.</Text>
      </View>

      <View style={{ flexDirection: stackLayout ? 'column' : 'row', gap: isPhone ? 16 : 28, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, width: stackLayout ? '100%' : undefined }}>
          {/* Balance Card */}
          <View style={{
            backgroundColor: 'rgba(15,15,26,0.6)', borderRadius: isPhone ? 12 : 16, alignItems: 'center', padding: isPhone ? 20 : 40, borderWidth: 1.5, borderColor: Colors.gold + '30', marginBottom: isPhone ? 16 : 24, overflow: 'hidden', position: 'relative'}}>
            <View style={{ position: 'absolute', top: '-30%', right: '-20%', width: 250, height: 250, borderRadius: 125, backgroundColor: Colors.gold, opacity: 0.05 }} />
            <Text style={{ color: Colors.textSecondary, fontFamily: 'Chakra Petch', fontSize: isPhone ? 11 : 13, marginBottom: isPhone ? 10 : 16, fontWeight: '700', letterSpacing: 1 }}>ASSET BALANCE</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPhone ? 6 : 10 }}>
              <Icons.IntelIcon size={isPhone ? 28 : 42} color={Colors.gold} />
              <Text style={{ color: Colors.gold, fontFamily: 'Share Tech Mono', fontSize: isPhone ? 36 : 56, fontWeight: '900' }}>{(user?.coins ?? 0).toLocaleString()}</Text>
            </View>

            <Text style={{ color: Colors.emerald, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: isPhone ? 16 : 22, marginTop: isPhone ? 8 : 12 }}>≈ ₹{(((user?.coins ?? 0) / 1000) * 10).toFixed(2)}</Text>
          </View>
          
          {/* UPI */}
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Chakra Petch', fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12, textTransform: 'uppercase' }}>YOUR UPI ID</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,15,26,0.6)', borderWidth: 1.5, borderColor: Colors.borderDefault, borderRadius: 10}}>
            <View style={{ paddingHorizontal: 16 }}>
              <Icons.LinkIcon size={16} color={Colors.textMuted} />
            </View>
            <TextInput 
              style={{ flex: 1, paddingVertical: 14, color: Colors.textPrimary, fontFamily: 'Share Tech Mono', fontSize: 14, paddingRight: 16 }} 
              placeholder="name@okicici / phone@paytm" 
              placeholderTextColor={Colors.textMuted} 
              value={upi} 
              onChangeText={setUpi} 
              autoCapitalize="none" 
            />
          </View>
          
          {msg ? <Text style={[{ fontFamily: 'Chakra Petch', fontSize: 13, fontWeight: '700', marginTop: 12 }, msg.startsWith('✅') ? { color: Colors.emerald } : { color: Colors.rose }]}>{msg}</Text> : null}
          <Text style={{ color: Colors.textMuted, fontFamily: 'Cormorant Garamond', fontSize: 14, marginTop: 8, fontStyle: 'italic' }}>Transfers are executed within 7 orbital cycles (working days).</Text>
        </View>
        
        <View style={{ width: stackLayout ? '100%' : 310 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: isPhone ? 10 : 16 }}>
            <View style={{ width: 3, height: 16, backgroundColor: Colors.gold, borderRadius: 2 }} />
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: isPhone ? 14 : 16, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>Exchange Rates</Text>
          </View>

          <View style={{ gap: isPhone ? 8 : 12 }}>
            {tiers.map((t, i) => {
              const ok = (user?.coins || 0) >= t.c;
              return (
                <TouchableOpacity key={i} style={{
                  backgroundColor: 'rgba(15,15,26,0.6)', borderRadius: isPhone ? 10 : 14, padding: isPhone ? 14 : 20, borderWidth: 1.5,
                  borderColor: ok ? Colors.emerald + '40' : Colors.borderDefault, opacity: ok ? 1 : 0.4,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}} onPress={() => !loading && ok && redeem(t)} disabled={loading || !ok} activeOpacity={0.7}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icons.IntelIcon size={isPhone ? 12 : 14} color={Colors.textPrimary} />
                      <Text style={{ color: Colors.textPrimary, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: isPhone ? 13 : 16 }}>{t.c.toLocaleString()}</Text>
                    </View>
                    <Text style={{ color: ok ? Colors.emerald : Colors.textMuted, fontFamily: 'Chakra Petch', fontSize: isPhone ? 9 : 11, marginTop: isPhone ? 4 : 6, fontWeight: '600', textTransform: 'uppercase' }}>
                      {ok ? 'AUTHORIZE TRANSFER' : `${(t.c - (user?.coins || 0)).toLocaleString()} DEFICIT`}
                    </Text>
                  </View>
                  <Text style={{ color: ok ? Colors.emerald : Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: isPhone ? 22 : 32, fontWeight: '900' }}>₹{t.r}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
