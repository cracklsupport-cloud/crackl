import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';

export default function LeaderboardPage({ user }) {
  const [entries, setEntries] = useState([]);
  const [isGlobal, setIsGlobal] = useState(false);
  const [loading, setLoading] = useState(true);
  const { width: winW } = useWindowDimensions();
  const showSector     = winW >= 860;
  const showClearance  = winW >= 1000;

  useEffect(() => { load(); }, [isGlobal]);

  async function load() {
    setLoading(true);
    try {
      const url = isGlobal ? `${BACKEND}/leaderboard/global/top` : `${BACKEND}/leaderboard/${user.city}`;
      const res = await fetch(url); const data = await res.json();
      if (data.success) setEntries(data.leaderboard || []);
    } catch {} setLoading(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <View style={{ paddingHorizontal: 28, paddingTop: 28, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 3, height: 20, backgroundColor: Colors.gold, borderRadius: 2 }} />
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: 24, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>CLASSIFIED RANKINGS</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={{
              paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, flexDirection: 'row', gap: 8, alignItems: 'center',
              backgroundColor: !isGlobal ? Colors.purple : 'rgba(255,255,255,0.02)',
              borderWidth: 1, borderColor: !isGlobal ? Colors.purple : Colors.borderDefault}}
            onPress={() => setIsGlobal(false)}
          >
            <Icons.TargetIcon size={14} color={!isGlobal ? '#fff' : Colors.textSecondary} />
            <Text style={{ color: !isGlobal ? '#fff' : Colors.textSecondary, fontFamily: 'Chakra Petch', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>{user.city}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, flexDirection: 'row', gap: 8, alignItems: 'center',
              backgroundColor: isGlobal ? Colors.purple : 'rgba(255,255,255,0.02)',
              borderWidth: 1, borderColor: isGlobal ? Colors.purple : Colors.borderDefault}}
            onPress={() => setIsGlobal(true)}
          >
            <Icons.GlobeIcon size={14} color={isGlobal ? '#fff' : Colors.textSecondary} />
            <Text style={{ color: isGlobal ? '#fff' : Colors.textSecondary, fontFamily: 'Chakra Petch', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>GLOBAL NET</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? <ActivityIndicator color={Colors.purple} style={{ marginTop: 60 }} size="large" /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Table Header */}
          <View style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: Colors.borderDefault, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
            <Text style={{ width: 62, color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>RANK</Text>
            <Text style={{ flex: 1, color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>OPERATIVE</Text>
            {showSector    && <Text style={{ width: 120, color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1, textAlign: 'center' }}>SECTOR</Text>}
            {showClearance && <Text style={{ width: 100, color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1, textAlign: 'center' }}>CLEARANCE</Text>}
            <Text style={{ width: 100, color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1, textAlign: 'right' }}>ASSETS</Text>
          </View>
          {entries.length === 0 && <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', textAlign: 'center', marginTop: 56, fontSize: 16, fontStyle: 'italic' }}>No data found in directory.</Text>}
          {entries.map((p, i) => {
            const isMe = p.username === user.username;
            const isTop3 = i < 3;
            const rankColor = i === 0 ? Colors.gold : i === 1 ? Colors.textPrimary : i === 2 ? Colors.orange : Colors.textMuted;
            return (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16,
                borderRadius: 10, marginBottom: 6,
                backgroundColor: isMe ? Colors.purple + '15' : 'rgba(255,255,255,0.02)',
                borderWidth: 1, borderColor: isMe ? Colors.purple + '40' : Colors.borderDefault}}>
                <View style={{ width: 62, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {isTop3 ? <Icons.TrophyIcon size={16} color={rankColor} /> : null}
                  <Text style={{ color: rankColor, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: 14 }}>#{i + 1}</Text>
                </View>
                <Text style={{ flex: 1, color: isMe ? Colors.purpleLight : Colors.textPrimary, fontFamily: 'Chakra Petch', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 }}>
                  {p.username}{isMe ? ' (YOU)' : ''}
                </Text>
                {showSector    && <Text style={{ width: 120, textAlign: 'center', color: Colors.textSecondary, fontFamily: 'Chakra Petch', fontSize: 13, textTransform: 'uppercase' }}>{p.city}</Text>}
                {showClearance && <Text style={{ width: 100, textAlign: 'center', color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 13 }}>{p.level || '—'}</Text>}
                <View style={{ width: 100, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                  <Icons.IntelIcon size={12} color={Colors.gold} />
                  <Text style={{ color: Colors.gold, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: 14 }}>{(p.coins || 0).toLocaleString()}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
