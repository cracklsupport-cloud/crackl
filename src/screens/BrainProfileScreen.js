import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Animated, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../theme/colors';
import Icons from '../components/Icons';
import { BACKEND } from '../utils/api';

export default function BrainProfileScreen({ user, go }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fillAnims] = useState([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]);

  useEffect(() => {
    (async () => {
      if (!user?.id) { setLoading(false); setError('No user data'); return; }
      try {
        const token = await AsyncStorage.getItem('crackl_token');
        const res = await fetch(`${BACKEND}/profile/brain-report/${user.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await res.json();
        if (data.success && data.report) {
          setReport(data.report);
          const acc = data.report.accuracy || 0;
          // Use an asymptotic learning curve for percentiles
          const streakPct = Math.min(100, Math.round(100 * (1 - Math.exp(-(data.report.weekStreak || 0) / 7)))); 
          const totalPct = Math.min(100, Math.round(100 * (1 - Math.exp(-(data.report.total || 0) / 30))));
          Animated.stagger(200, fillAnims.map((anim, i) =>
            Animated.timing(anim, {
              toValue: [acc, streakPct, totalPct][i],
              duration: 1200,
              useNativeDriver: false
            })
          )).start();
        } else {
          setError(data.error || 'Could not load report');
        }
      } catch { setError('Network error — could not reach server'); }
      setLoading(false);
    })();
  }, [user?.id]);

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

  const acc = report?.accuracy ?? 0;
  // Use asymptotic learning curve (e.g. 7 day streak = ~63%, 14 day = ~86%)
  const streakPct = Math.min(100, Math.round(100 * (1 - Math.exp(-(report?.weekStreak || 0) / 7))));
  // Activity volume curve (e.g. 30 riddles = ~63%, 60 = ~86%)
  const totalPct = Math.min(100, Math.round(100 * (1 - Math.exp(-(report?.total || 0) / 30))));

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
        <Text style={{ color: Colors.textPrimary, fontFamily: 'Cormorant Garamond', fontSize: 15, marginTop: 6, fontStyle: 'italic' }}>{report?.level || user?.level || 'Novice'}</Text>
        <Text style={{ color: Colors.purpleLight, fontFamily: 'Chakra Petch', fontSize: 24, fontWeight: '900', marginTop: 16, letterSpacing: 1, textTransform: 'uppercase' }}>OPERATIVE PROFILE</Text>
      </View>

      {/* Loading / Error states */}
      {loading && (
        <View style={{ alignItems: 'center', padding: 40 }}>
          <ActivityIndicator color={Colors.purple} size="large" />
          <Text style={{ color: Colors.textMuted, fontFamily: 'Share Tech Mono', fontSize: 11, marginTop: 12 }}>DECRYPTING BRAIN DATA...</Text>
        </View>
      )}
      {error && !loading && (
        <View style={{ alignItems: 'center', padding: 40 }}>
          <Icons.AlertTriangleIcon size={32} color={Colors.rose} />
          <Text style={{ color: Colors.rose, fontFamily: 'Share Tech Mono', fontSize: 12, marginTop: 12, textAlign: 'center' }}>{error}</Text>
        </View>
      )}

      {!loading && !error && report && (<>
      {/* AI Narrative Card */}
      <View style={{ backgroundColor: 'rgba(15,15,26,0.6)', borderRadius: 20, padding: 32, marginBottom: 24, overflow: 'hidden', borderWidth: 1, borderColor: Colors.purple+'50'}}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.purple, opacity: 0.05 }} />
        <View style={{ position: 'absolute', top: '-20%', right: '-20%', width: 150, height: 150, borderRadius: 75, backgroundColor: Colors.purple, opacity: 0.1}} />

        <View style={{ alignItems: 'center' }}>
          <Icons.TargetIcon size={48} color={Colors.purpleLight} />
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Share Tech Mono', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginTop: 24 }}>INTELLIGENCE ANALYSIS</Text>
          <Text style={{ color: Colors.textSecondary, fontFamily: 'Cormorant Garamond', fontSize: 15, textAlign: 'center', marginTop: 14, lineHeight: 22 }}>
            {report.narrative || 'No analysis available yet. Play more riddles to generate your brain report.'}
          </Text>
        </View>
      </View>

      {/* Strength Bars — driven by real data */}
      <View style={{ backgroundColor: 'rgba(15,15,26,0.6)', borderRadius: 20, padding: 28, marginBottom: 24, borderWidth: 1, borderColor: Colors.borderDefault}}>
        <StrengthBar index={0} anim={fillAnims[0]} pct={acc} label="Accuracy Rating" desc={`${report.correct || 0} correct out of ${report.total || 0} this week`} />
        <StrengthBar index={1} anim={fillAnims[1]} pct={streakPct} label="Streak Power" desc={`Current streak: ${report.weekStreak || 0} days`} />
        <StrengthBar index={2} anim={fillAnims[2]} pct={totalPct} label="Weekly Volume" desc={`${report.total || 0} riddles attempted this week`} />
      </View>

      {/* Weekly Stats Grid — real data */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Puzzles Decrypted', val: String(report.total || 0) },
          { label: 'Accuracy Rating', val: `${acc}%` },
          { label: 'Correct Answers', val: String(report.correct || 0) },
          { label: 'Current Streak', val: `${report.weekStreak || 0} days` }
        ].map(s => (
          <View key={s.label} style={{ width: '48%', backgroundColor: 'rgba(15,15,26,0.6)', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderDefault}}>
            <Text style={{ color: Colors.textPrimary, fontFamily: 'Share Tech Mono', fontSize: 22, fontWeight: '900' }}>{s.val}</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: 'Chakra Petch', fontSize: 11, fontWeight: '700', marginTop: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>{s.label}</Text>
          </View>
        ))}
      </View>

      </>)}
      </View>
    </ScrollView>
  );
}
