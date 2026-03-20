import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Platform } from 'react-native';
import Colors from '../theme/colors';
import Icons from '../components/Icons';
import { FilmGrainOverlay } from '../components/AtmosphericEffects';
import { runPanicActivationSequence, runPanicDeactivation } from '../components/PanicModeOrchestrator';

const isWeb = Platform.OS === 'web';

function ArenaCard({ icon: IconComp, iconBg, iconGlow, title, desc, cta, ctaColor, onPress, panicMode }) {
  return (
    <TouchableOpacity
      {...(isWeb && { dataSet: { card: '' } })}
      style={{
        backgroundColor: isWeb ? 'rgba(15,15,26,0.85)' : Colors.cardSurface,
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: panicMode ? 'rgba(255,0,0,0.25)' : 'rgba(255,255,255,0.08)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
      }}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={{
        width: 52,
        height: 52,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: iconBg,
        borderWidth: 1,
        borderColor: (iconGlow || ctaColor) + '30',
      }}>
        <IconComp size={24} color={ctaColor || Colors.textPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          color: Colors.textPrimary,
          fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
          fontSize: 16,
          fontWeight: '700',
          marginBottom: 6,
          letterSpacing: 0.5,
        }}>{title}</Text>
        <Text style={{
          color: Colors.textSecondary,
          fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
          fontSize: 13,
          lineHeight: 18,
          flexShrink: 1,
        }}>{desc}</Text>
      </View>
      <Text style={{
        color: panicMode ? Colors.rose : ctaColor,
        fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
        fontWeight: '800',
        fontSize: 12,
        letterSpacing: 1,
        paddingLeft: 8,
        textTransform: 'uppercase',
      }}>{cta} ›</Text>
    </TouchableOpacity>
  );
}

function QuickCard({ icon: IconComp, label, sub, accent, onPress, panicMode }) {
  return (
    <TouchableOpacity
      {...(isWeb && { dataSet: { card: '' } })}
      style={{
        width: '47%',
        backgroundColor: isWeb ? 'rgba(15,15,26,0.85)' : Colors.cardSurface,
        borderRadius: 12,
        padding: 18,
        borderWidth: 1,
        borderColor: panicMode ? 'rgba(255,0,0,0.2)' : (accent ? Colors.purple + '40' : 'rgba(255,255,255,0.08)'),
        ...(accent && !panicMode ? { backgroundColor: Colors.purple + '08' } : {}),
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <IconComp size={20} color={accent ? Colors.purpleLight : Colors.textPrimary} />
      <Text style={{
        color: accent ? Colors.purpleLight : Colors.textPrimary,
        fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
        fontWeight: '700',
        fontSize: 14,
        marginTop: 12,
        letterSpacing: 0.5,
      }}>{label}</Text>
      <Text style={{
        color: Colors.textMuted,
        fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
        fontSize: 11,
        marginTop: 4,
      }}>{sub}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardPage({ user, play, multi, go, panicMode, setPanicMode }) {
  const [isActivating, setIsActivating] = useState(false);
  const featPulse = useRef(new Animated.Value(0.06)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(featPulse, { toValue: 0.12, duration: 2500, useNativeDriver: true }),
        Animated.timing(featPulse, { toValue: 0.06, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handlePanicToggle = () => {
    if (isActivating) return;
    if (!panicMode) {
      setIsActivating(true);
      runPanicActivationSequence(() => {
        setPanicMode(true);
        setIsActivating(false);
      });
    } else {
      runPanicDeactivation();
      setPanicMode(false);
    }
  };

  const cardBg = panicMode ? 'rgba(20,0,0,0.9)' : 'rgba(15,15,26,0.85)';
  const cardBorder = panicMode ? 'rgba(255,0,0,0.35)' : 'rgba(255,255,255,0.08)';

  return (
    <ScrollView
      contentContainerStyle={{ padding: 28, paddingBottom: 60, backgroundColor: 'transparent' }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
        {/* ═══ MAIN COLUMN ═══ */}
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Featured Event Card */}
          <View
            {...(isWeb && { dataSet: { card: '' } })}
            style={{
              borderRadius: 14,
              padding: 32,
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: panicMode ? 'rgba(255,0,0,0.4)' : 'rgba(168,85,247,0.25)',
              backgroundColor: cardBg,
              position: 'relative',
            }}
          >
            <FilmGrainOverlay opacity={0.05} />
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: panicMode ? '#8B0000' : Colors.purple,
                opacity: featPulse,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: '-30%',
                right: '-15%',
                width: 300,
                height: 300,
                borderRadius: 150,
                backgroundColor: panicMode ? 'rgba(255,0,0,0.15)' : Colors.purple,
                opacity: 0.12,
              }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, zIndex: 1 }}>
              <View style={{
                backgroundColor: panicMode ? 'rgba(255,0,0,0.2)' : Colors.purple + '20',
                borderWidth: 1,
                borderColor: panicMode ? 'rgba(255,80,80,0.5)' : Colors.purple + '45',
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}>
                <Icons.ZapIcon size={12} color={panicMode ? Colors.rose : Colors.purpleLight} />
                <Text style={{
                  color: panicMode ? Colors.rose : Colors.purpleLight,
                  fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
                  fontWeight: '900',
                  fontSize: 10,
                  letterSpacing: 2,
                }}>MAJOR EVENT</Text>
              </View>
              <View style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: cardBorder,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}>
                <Icons.TimerIcon size={12} color={Colors.textMuted} />
                <Text style={{
                  color: Colors.textMuted,
                  fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 1,
                }}>ENDS IN 2H 45M</Text>
              </View>
            </View>

            <Text style={{
              color: Colors.textPrimary,
              fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
              fontSize: 34,
              fontWeight: '900',
              lineHeight: 42,
              marginBottom: 14,
              marginTop: 16,
              letterSpacing: -0.5,
              zIndex: 1,
              textTransform: 'uppercase',
            }}>
              Weekend Clash{'\n'}
              <Text style={{ color: panicMode ? Colors.rose : Colors.cyan }}>Arena</Text>
            </Text>
            <Text style={{
              color: Colors.textSecondary,
              fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
              fontSize: 15,
              lineHeight: 22,
              maxWidth: 420,
              fontWeight: '500',
              zIndex: 1,
            }}>
              Compete against the top 100 players globally.{'\n'}Prize Pool: ₹50,000.
            </Text>

            <TouchableOpacity
              style={{
                backgroundColor: panicMode ? Colors.rose : Colors.textPrimary,
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 8,
                marginTop: 24,
                alignSelf: 'flex-start',
                zIndex: 1,
              }}
              onPress={() => play('mcq')}
            >
              <Text style={{
                color: panicMode ? '#fff' : Colors.bgBase,
                fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
                fontWeight: '900',
                fontSize: 13,
                letterSpacing: 1,
              }}>ENTER FOR 100 COINS →</Text>
            </TouchableOpacity>
          </View>

          {/* Game Arenas */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 3, height: 16, backgroundColor: panicMode ? Colors.rose : Colors.purple, borderRadius: 2 }} />
              <Text style={{
                color: Colors.textPrimary,
                fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
                fontSize: 18,
                fontWeight: '900',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}>Game Arenas</Text>
            </View>
            <TouchableOpacity onPress={multi} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: panicMode ? Colors.rose : Colors.purple, fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>BROWSE LOBBIES ›</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 10 }}>
            <ArenaCard icon={Icons.TerminalIcon} iconBg={Colors.cyan + '15'} title="Standard Queue" desc="Solve riddles solo. Farm Coins at your pace." cta="PLAY NOW" ctaColor={Colors.cyan} onPress={() => play('mcq')} panicMode={panicMode} />
            <ArenaCard icon={Icons.DatabaseIcon} iconBg={Colors.purple + '15'} title="Brain Blast" desc="Type answers. AI validates. Earn 1.5× coins." cta="PLAY NOW" ctaColor={Colors.purple} onPress={() => play('type')} panicMode={panicMode} />
            <ArenaCard icon={Icons.SwordsIcon} iconBg={Colors.gold + '15'} title="Ranked 1v1" desc="Competitive matchmaking. Wager real cash." cta="FIND MATCH" ctaColor={Colors.gold} onPress={multi} panicMode={panicMode} />
          </View>

          {/* Special Arenas */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 32, marginBottom: 16 }}>
            <View style={{ width: 3, height: 16, backgroundColor: Colors.rose, borderRadius: 2 }} />
            <Text style={{
              color: Colors.textPrimary,
              fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
              fontSize: 18,
              fontWeight: '900',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>Special Arenas</Text>
          </View>

          <View style={{ gap: 10 }}>
            <ArenaCard icon={Icons.SunIcon} iconBg={Colors.gold + '15'} title="Daily Drop" desc="One legendary riddle per day. Keep your streak alive." cta="PLAY" ctaColor={Colors.gold} onPress={() => go('daily')} panicMode={panicMode} />
            <ArenaCard icon={Icons.BombIcon} iconBg={Colors.rose + '15'} title="Gauntlet — Rapid Fire" desc="10 riddles back to back. No breaks. No mercy." cta="ENTER" ctaColor={Colors.rose} onPress={() => go('gauntlet')} panicMode={panicMode} />
            <ArenaCard icon={Icons.LinkIcon} iconBg={Colors.emerald + '15'} title="The Chain" desc="5 linked riddles — each answer is the next clue." cta="UNLOCK" ctaColor={Colors.emerald} onPress={() => go('chain')} panicMode={panicMode} />
            <ArenaCard icon={Icons.DiceIcon} iconBg={Colors.fuchsia + '15'} title="Blind Wager" desc="Bet before you see the riddle. High risk, high reward." cta="WAGER" ctaColor={Colors.fuchsia} onPress={() => go('wager')} panicMode={panicMode} />
            <ArenaCard icon={Icons.TrophyIcon} iconBg={Colors.gold + '20'} title="The Bounty Board" desc="Weekly riddle. First solver wins the 5,000 coin prize." cta="HUNT" ctaColor={Colors.gold} onPress={() => go('bounty')} panicMode={panicMode} />
          </View>

          {/* Panic Mode Toggle — Cinematic mechanical switch */}
          <View
            {...(isWeb && { dataSet: { card: '' } })}
            style={{
              marginTop: 24,
              padding: 20,
              borderRadius: 12,
              backgroundColor: panicMode ? 'rgba(26,0,0,0.95)' : cardBg,
              borderWidth: 1.5,
              borderColor: panicMode ? 'rgba(255,0,0,0.5)' : cardBorder,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Icons.AlertTriangleIcon size={28} color={panicMode ? Colors.rose : Colors.textMuted} animated={panicMode} />
              <View>
                <Text style={{
                  color: panicMode ? Colors.rose : Colors.textPrimary,
                  fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
                  fontWeight: '900',
                  fontSize: 18,
                  letterSpacing: 1,
                }}>PANIC MODE</Text>
                <Text style={{
                  color: Colors.textSecondary,
                  fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
                  fontSize: 11,
                  marginTop: 4,
                }}>2× faster timer · 1.5× coins · Veterans only</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{
                width: 56,
                height: 30,
                borderRadius: 6,
                backgroundColor: panicMode ? Colors.rose : 'rgba(50,50,60,0.8)',
                borderWidth: 1.5,
                borderColor: panicMode ? 'rgba(255,100,100,0.6)' : 'rgba(255,255,255,0.08)',
                justifyContent: 'center',
                paddingHorizontal: 4,
                opacity: isActivating ? 0.6 : 1,
              }}
              onPress={handlePanicToggle}
              disabled={isActivating}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  backgroundColor: '#fff',
                  alignSelf: panicMode ? 'flex-end' : 'flex-start',
                  shadowColor: panicMode ? Colors.rose : 'transparent',
                  shadowRadius: 10,
                  shadowOpacity: 0.8,
                  elevation: 4,
                }}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══ SIDEBAR COLUMN (desktop) ═══ */}
        <View style={{ width: 280, ...(isWeb ? { display: 'flex' } : { display: 'none' }) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <View style={{ width: 3, height: 16, backgroundColor: panicMode ? Colors.rose : Colors.cyan, borderRadius: 2 }} />
            <Text style={{
              color: Colors.textPrimary,
              fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
              fontSize: 16,
              fontWeight: '900',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>Quick Actions</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <QuickCard icon={Icons.TargetIcon} label="Missions" sub="Daily rewards" onPress={() => {}} panicMode={panicMode} />
            <QuickCard icon={Icons.FlameIcon} label="Streaks" sub={`${user?.streak || 0} days hot`} onPress={() => {}} panicMode={panicMode} />
          </View>

          {/* Earn Cash */}
          <View
            {...(isWeb && { dataSet: { card: '' } })}
            style={{
              marginTop: 16,
              padding: 20,
              borderRadius: 12,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: cardBorder,
            }}
          >
            <Text style={{
              color: Colors.gold,
              fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined,
              fontWeight: '900',
              fontSize: 14,
              marginBottom: 16,
              letterSpacing: 1.5,
            }}>EARN CASH</Text>
            {[['500', '40'], ['1,500', '160'], ['5,000', '800'], ['15,000', '2,800']].map(([c, r]) => (
              <View key={c} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: cardBorder }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icons.CoinIcon size={12} color={Colors.textSecondary} />
                  <Text style={{ color: Colors.textSecondary, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 13 }}>{c}</Text>
                </View>
                <Text style={{ color: Colors.emerald, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 13, fontWeight: '800' }}>₹{r}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={{
                backgroundColor: Colors.emerald + '15',
                borderWidth: 1,
                borderColor: Colors.emerald + '30',
                paddingVertical: 14,
                borderRadius: 8,
                alignItems: 'center',
                marginTop: 16,
              }}
              onPress={() => go('cash')}
            >
              <Text style={{ color: Colors.emerald, fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontWeight: '900', fontSize: 12, letterSpacing: 1.5 }}>WITHDRAW FUNDS</Text>
            </TouchableOpacity>
          </View>

          {/* Live Stats */}
          <View
            {...(isWeb && { dataSet: { card: '' } })}
            style={{
              marginTop: 16,
              padding: 20,
              borderRadius: 12,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: cardBorder,
            }}
          >
            <Text style={{
              color: Colors.textMuted,
              fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined,
              fontWeight: '800',
              fontSize: 10,
              letterSpacing: 2,
              marginBottom: 16,
            }}>LIVE STATS</Text>
            {[
              { label: 'Total Played', value: Math.floor((user?.xp ?? 0) / 10), color: Colors.textPrimary },
              { label: 'Best Streak', value: user?.streak ?? 0, color: Colors.orange },
              { label: 'Win Rate', value: '—', color: Colors.emerald },
            ].map((s) => (
              <View key={s.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                <Text style={{ color: Colors.textSecondary, fontFamily: isWeb ? '"Space Grotesk", sans-serif' : undefined, fontSize: 13 }}>{s.label}</Text>
                <Text style={{ color: s.color, fontFamily: isWeb ? '"JetBrains Mono", monospace' : undefined, fontSize: 14, fontWeight: '800' }}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
