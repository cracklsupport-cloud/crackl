import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Colors from '../theme/colors';
import { useResponsive } from '../theme/breakpoints';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';

export default function LeaderboardPage({ user }) {
  const [entries, setEntries] = useState([]);
  const [boardType, setBoardType] = useState('city');
  const [loading, setLoading] = useState(true);
  const { width, isPhone } = useResponsive();
  const showSector = width >= 860;
  const showClearance = width >= 1000;
  const isRankedBoard = boardType === 'ranked';

  useEffect(() => { load(); }, [boardType, user?.city]);

  async function load() {
    setLoading(true);
    const cityLabel = user?.city || 'Global';
    try {
      const url = boardType === 'global'
        ? `${BACKEND}/leaderboard/global/top`
        : boardType === 'ranked'
          ? `${BACKEND}/leaderboard/ranked/top`
          : `${BACKEND}/leaderboard/${encodeURIComponent(cityLabel)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setEntries(data.leaderboard || []);
      else setEntries([]);
    } catch { setEntries([]); }
    setLoading(false);
  }

  function TabButton({ active, onPress, icon: IconComp, label }) {
    return (
      <TouchableOpacity
        style={{
          paddingHorizontal: isPhone ? 12 : 20,
          paddingVertical: isPhone ? 8 : 10,
          borderRadius: 8,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
          backgroundColor: active ? Colors.purple : 'rgba(255,255,255,0.02)',
          borderWidth: 1,
          borderColor: active ? Colors.purple : Colors.borderDefault
        }}
        onPress={onPress}
      >
        <IconComp size={14} color={active ? '#fff' : Colors.textSecondary} />
        <Text style={{ color: active ? '#fff' : Colors.textSecondary, fontFamily: 'Chakra Petch', fontWeight: '800', fontSize: isPhone ? 11 : 13, letterSpacing: 0.5 }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <View style={{ paddingHorizontal: isPhone ? 12 : 28, paddingTop: isPhone ? 16 : 28, paddingBottom: isPhone ? 12 : 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: isPhone ? 12 : 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 3, height: 20, backgroundColor: Colors.gold, borderRadius: 2 }} />
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: isPhone ? 16 : 24, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>
              CLASSIFIED RANKINGS
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <TabButton active={boardType === 'city'} onPress={() => setBoardType('city')} icon={Icons.TargetIcon} label={user?.city || 'GLOBAL CITY'} />
          <TabButton active={boardType === 'global'} onPress={() => setBoardType('global')} icon={Icons.CompassIcon} label="GLOBAL NET" />
          <TabButton active={boardType === 'ranked'} onPress={() => setBoardType('ranked')} icon={Icons.CrosshairIcon} label="RANKED" />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.purple} style={{ marginTop: 60 }} size="large" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: isPhone ? 12 : 28, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', paddingVertical: isPhone ? 8 : 12, paddingHorizontal: isPhone ? 8 : 16, borderBottomWidth: 1, borderColor: Colors.borderDefault, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
            <Text style={{ width: isPhone ? 40 : 62, color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: isPhone ? 9 : 11, fontWeight: '800', letterSpacing: 1 }}>RANK</Text>
            <Text style={{ flex: 1, color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: isPhone ? 9 : 11, fontWeight: '800', letterSpacing: 1 }}>OPERATIVE</Text>
            {showSector && (
              <Text style={{ width: 120, color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1, textAlign: 'center' }}>
                SECTOR
              </Text>
            )}
            {showClearance && (
              <Text style={{ width: 100, color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '800', letterSpacing: 1, textAlign: 'center' }}>
                {isRankedBoard ? 'TIER' : 'CLEARANCE'}
              </Text>
            )}
            <Text style={{ width: isPhone ? 86 : 116, color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: isPhone ? 9 : 11, fontWeight: '800', letterSpacing: 1, textAlign: 'right' }}>
              {isRankedBoard ? 'RATING' : 'ASSETS'}
            </Text>
          </View>

          {entries.length === 0 && (
            <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', textAlign: 'center', marginTop: 56, fontSize: 16, fontStyle: 'italic' }}>
              No data found in directory.
            </Text>
          )}

          {entries.map((p, i) => {
            const isMe = p.username === user.username;
            const isTop3 = i < 3;
            const rankColor = i === 0 ? Colors.gold : i === 1 ? Colors.textPrimary : i === 2 ? Colors.orange : Colors.textMuted;
            const metric = isRankedBoard ? (p.rating || 0).toLocaleString() : (p.coins || 0).toLocaleString();

            return (
              <View
                key={`${boardType}-${p.username}-${i}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: isPhone ? 10 : 16,
                  paddingHorizontal: isPhone ? 8 : 16,
                  borderRadius: isPhone ? 6 : 10,
                  marginBottom: 6,
                  backgroundColor: isMe ? Colors.purple + '15' : 'rgba(255,255,255,0.02)',
                  borderWidth: 1,
                  borderColor: isMe ? Colors.purple + '40' : Colors.borderDefault
                }}
              >
                <View style={{ width: isPhone ? 40 : 62, flexDirection: 'row', alignItems: 'center', gap: isPhone ? 3 : 6 }}>
                  {isTop3 ? <Icons.TrophyIcon size={isPhone ? 12 : 16} color={rankColor} /> : null}
                  <Text style={{ color: rankColor, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: isPhone ? 11 : 14 }}>#{i + 1}</Text>
                </View>
                <Text numberOfLines={1} style={{ flex: 1, color: isMe ? Colors.purpleLight : Colors.textPrimary, fontFamily: 'Chakra Petch', fontWeight: '700', fontSize: isPhone ? 12 : 15, letterSpacing: 0.5 }}>
                  {p.username}{isMe ? ' (YOU)' : ''}
                </Text>
                {showSector && (
                  <Text style={{ width: 120, textAlign: 'center', color: Colors.textSecondary, fontFamily: 'Chakra Petch', fontSize: 13, textTransform: 'uppercase' }}>
                    {p.city || '—'}
                  </Text>
                )}
                {showClearance && (
                  <Text style={{ width: 100, textAlign: 'center', color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 13 }}>
                    {isRankedBoard ? (p.tier || 'Bronze') : (p.level || '—')}
                  </Text>
                )}
                <View style={{ width: isPhone ? 86 : 116, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: isPhone ? 3 : 6 }}>
                  {isRankedBoard ? <Icons.CrosshairIcon size={isPhone ? 10 : 12} color={Colors.indigo} /> : <Icons.IntelIcon size={isPhone ? 10 : 12} color={Colors.gold} />}
                  <Text style={{ color: isRankedBoard ? Colors.indigo : Colors.gold, fontFamily: 'Share Tech Mono', fontWeight: '800', fontSize: isPhone ? 11 : 14 }}>
                    {metric}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
