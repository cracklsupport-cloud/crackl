import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Platform,
  Animated, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../theme/colors';
import { useResponsive } from '../theme/breakpoints';
import Icons from '../components/Icons';
import RiddleContent from '../components/RiddleContent';

const isWeb = Platform.OS === 'web';
const mono    = isWeb ? '"JetBrains Mono", monospace' : undefined;
const grotesk = isWeb ? '"Space Grotesk", sans-serif' : undefined;

const STORAGE_KEY = 'crackl_case_files';

/* ─── Corner Brackets ─── */
function CornerBrackets({ color = 'rgba(255,255,255,0.18)' }) {
  const s = { position: 'absolute', width: 12, height: 12, borderColor: color, zIndex: 20 };
  return (
    <>
      <View style={{ ...s, top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 }} />
      <View style={{ ...s, top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 }} />
      <View style={{ ...s, bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 }} />
      <View style={{ ...s, bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 }} />
    </>
  );
}

/* ─── Status helpers ─── */
const STATUS_META = {
  cracked:   { label: 'CRACKED',   color: Colors.emerald, icon: Icons.CheckIcon },
  forfeited: { label: 'FORFEITED', color: Colors.rose,    icon: Icons.FlagIcon },
  expired:   { label: 'EXPIRED',   color: Colors.gold,    icon: Icons.ClockIcon },
  failed:    { label: 'FAILED',    color: Colors.rose,    icon: Icons.XIcon },
};

function getOperationLabel(item) {
  const modeKey = item?.gameMode || item?.mode;
  switch (modeKey) {
    case 'mcq':
      return 'STANDARD QUEUE';
    case 'type':
      return 'BRAIN BLAST';
    case 'ranked':
      return 'ECLIPSE LEVEL';
    case 'daily':
      return item?.panicMode ? 'CRITICAL BREACH' : 'COLD CASE';
    case 'gauntlet':
      return 'GAUNTLET';
    case 'chain':
      return 'THE CHAIN';
    case 'wager':
      return 'BLIND WAGER';
    case 'bounty':
      return 'BOUNTY BOARD';
    default:
      return typeof modeKey === 'string' ? modeKey.replace(/_/g, ' ').toUpperCase() : null;
  }
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/* ─── Stat Card ─── */
function StatCard({ value, label, color = Colors.textPrimary, isPhone }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: isPhone ? 10 : 16 }}>
      <Text style={{ fontFamily: grotesk, fontSize: isPhone ? 18 : 28, fontWeight: '900', color, letterSpacing: -1 }}>{value}</Text>
      <Text style={{ fontFamily: mono, fontSize: isPhone ? 7 : 9, color: Colors.textMuted, letterSpacing: isPhone ? 1 : 2, marginTop: 4 }}>{label}</Text>
    </View>
  );
}

/* ─── Filter Pill ─── */
function FilterPill({ label, active, color, onPress, count }) {
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableOpacity
      onPress={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      activeOpacity={0.75}
      style={[{
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
        backgroundColor: active ? color + '14' : hovered ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)',
        borderWidth: 1,
        borderColor: active ? color + '50' : 'rgba(255,255,255,0.06)',
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]}
    >
      <Text style={{
        fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 1,
        color: active ? color : Colors.textSecondary,
      }}>{label}</Text>
      {count != null && (
        <View style={{
          backgroundColor: active ? color + '25' : 'rgba(255,255,255,0.06)',
          paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
        }}>
          <Text style={{ fontFamily: mono, fontSize: 9, fontWeight: '800', color: active ? color : Colors.textMuted }}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ─── Case Card ─── */
function CaseCard({ item, index, onView, isPhone }) {
  const [hovered, setHovered] = useState(false);
  const meta = STATUS_META[item.status] || STATUS_META.failed;
  return (
    <TouchableOpacity
      onPress={() => onView(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      activeOpacity={0.8}
      style={[{
        borderRadius: isPhone ? 10 : 16, padding: isPhone ? 14 : 20, overflow: 'hidden', position: 'relative',
        backgroundColor: hovered ? 'rgba(255,255,255,0.035)' : 'rgba(10,10,12,0.6)',
        borderWidth: 1, borderColor: hovered ? meta.color + '30' : 'rgba(255,255,255,0.07)',
      }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease', backdropFilter: 'blur(12px)' } : {}]}
    >
      {/* Top row: case number + status + time */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPhone ? 10 : 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPhone ? 6 : 10 }}>
          <Text style={{ fontFamily: mono, fontSize: isPhone ? 9 : 11, color: Colors.textMuted, letterSpacing: 1 }}>#{String(index + 1).padStart(3, '0')}</Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingHorizontal: isPhone ? 6 : 10, paddingVertical: isPhone ? 3 : 4, borderRadius: 6,
            backgroundColor: meta.color + '12', borderWidth: 1, borderColor: meta.color + '30',
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.color }} />
            <Text style={{ fontFamily: mono, fontSize: isPhone ? 8 : 9, fontWeight: '800', color: meta.color, letterSpacing: 1 }}>{meta.label}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPhone ? 6 : 12 }}>
          {item.intelEarned !== 0 && (
            <Text style={{
              fontFamily: mono, fontSize: isPhone ? 10 : 12, fontWeight: '900',
              color: item.intelEarned > 0 ? Colors.emerald : Colors.rose,
            }}>
              {item.intelEarned > 0 ? '+' : ''}{item.intelEarned}{isPhone ? '' : ' INTEL'}
            </Text>
          )}
          <Text style={{ fontFamily: mono, fontSize: isPhone ? 9 : 10, color: Colors.textMuted }}>{timeAgo(item.timestamp)}</Text>
        </View>
      </View>

      {/* Question preview */}
      {item.media_url ? (
        <View style={{ alignSelf: 'flex-start', marginBottom: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: Colors.cyan + '10', borderWidth: 1, borderColor: Colors.cyan + '25' }}>
          <Text style={{ fontFamily: mono, fontSize: 8, color: Colors.cyan, letterSpacing: 1 }}>MEDIA CLUE</Text>
        </View>
      ) : null}
      <Text
        numberOfLines={2}
        style={{ fontFamily: grotesk, fontSize: isPhone ? 13 : 15, color: Colors.textPrimary, lineHeight: isPhone ? 19 : 22, marginBottom: isPhone ? 10 : 14 }}
      >
        {item.question}
      </Text>

      {/* Bottom row: meta tags */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {getOperationLabel(item) && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            <Text style={{ fontFamily: mono, fontSize: 9, color: Colors.textMuted, letterSpacing: 1 }}>{getOperationLabel(item)}</Text>
          </View>
        )}
        {item.timeTaken != null && item.status !== 'forfeited' && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            <Text style={{ fontFamily: mono, fontSize: 9, color: Colors.textMuted, letterSpacing: 1 }}>{item.timeTaken}s</Text>
          </View>
        )}
        {item.rating && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: Colors.purple + '10', borderWidth: 1, borderColor: Colors.purple + '25' }}>
            <Text style={{ fontFamily: mono, fontSize: 9, color: Colors.purpleLight, letterSpacing: 1 }}>RATED: {item.rating.toUpperCase()}</Text>
          </View>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* View action */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[{
            fontFamily: mono, fontSize: 10, fontWeight: '800', letterSpacing: 1,
            color: hovered ? '#fff' : Colors.textMuted,
          }, isWeb ? { transition: 'color 0.2s ease' } : {}]}>VIEW</Text>
          <Icons.ChevronRightIcon size={10} color={hovered ? '#fff' : Colors.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ─── View Answer Modal ─── */
function CaseModal({ item, onClose, onTryAgain }) {
  if (!item) return null;
  const meta = STATUS_META[item.status] || STATUS_META.failed;

  return (
    <View style={[{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.75)',
    }, isWeb ? { backdropFilter: 'blur(8px)' } : {}]}>
      <TouchableOpacity style={{ position: 'absolute', inset: 0 }} onPress={onClose} activeOpacity={1} />

      <View style={[{
        width: '90%', maxWidth: 520, borderRadius: 24, padding: 28,
        backgroundColor: 'rgba(12,12,16,0.95)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        position: 'relative', overflow: 'hidden', zIndex: 201,
      }, isWeb ? { backdropFilter: 'blur(24px)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' } : {}]}>
        <CornerBrackets color={meta.color + '50'} />

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icons.TerminalIcon size={14} color={meta.color} />
            <Text style={{ fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, color: meta.color, letterSpacing: 1.5 }}>
              CASE DECLASSIFIED
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[{
            width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
          }, isWeb ? { cursor: 'pointer' } : {}]}>
            <Icons.XIcon size={14} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* The Riddle */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontFamily: mono, fontSize: 9, color: Colors.textMuted, letterSpacing: 2, marginBottom: 8 }}>THE RIDDLE</Text>
          <RiddleContent
            riddle={item}
            accent={meta.color}
            questionStyle={{ fontFamily: grotesk, fontSize: 16, lineHeight: 24 }}
          />
        </View>

        {/* User's Answer */}
        {item.userAnswer && item.status !== 'forfeited' && (
          <View style={{
            marginBottom: 16, padding: 14, borderRadius: 10,
            backgroundColor: item.status === 'cracked' ? Colors.emerald + '08' : Colors.rose + '08',
            borderWidth: 1, borderColor: item.status === 'cracked' ? Colors.emerald + '25' : Colors.rose + '25',
          }}>
            <Text style={{ fontFamily: mono, fontSize: 9, color: Colors.textMuted, letterSpacing: 2, marginBottom: 6 }}>YOUR ANSWER</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {item.status === 'cracked'
                ? <Icons.CheckIcon size={14} color={Colors.emerald} />
                : <Icons.XIcon size={14} color={Colors.rose} />
              }
              <Text style={{
                fontFamily: 'Chakra Petch', fontSize: 16, fontWeight: '700',
                color: item.status === 'cracked' ? Colors.emerald : Colors.rose,
              }}>{item.userAnswer}</Text>
            </View>
          </View>
        )}

        {item.status === 'forfeited' && (
          <View style={{
            marginBottom: 16, padding: 14, borderRadius: 10,
            backgroundColor: Colors.rose + '08', borderWidth: 1, borderColor: Colors.rose + '25',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icons.FlagIcon size={14} color={Colors.rose} />
              <Text style={{ fontFamily: mono, fontSize: 11, fontWeight: '800', color: Colors.rose, letterSpacing: 1 }}>MISSION FORFEITED</Text>
            </View>
          </View>
        )}

        {/* Correct Answer */}
        <View style={{
          marginBottom: 20, padding: 14, borderRadius: 10,
          backgroundColor: Colors.emerald + '08', borderWidth: 1, borderColor: Colors.emerald + '25',
        }}>
          <Text style={{ fontFamily: mono, fontSize: 9, color: Colors.textMuted, letterSpacing: 2, marginBottom: 6 }}>CORRECT ANSWER</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icons.CheckIcon size={14} color={Colors.emerald} />
            <Text style={{ fontFamily: 'Chakra Petch', fontSize: 16, fontWeight: '700', color: Colors.emerald }}>{item.correctAnswer}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
          <View style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center' }}>
            <Text style={{ fontFamily: mono, fontSize: 9, color: Colors.textMuted, letterSpacing: 1, marginBottom: 4 }}>INTEL</Text>
            <Text style={{
              fontFamily: grotesk, fontSize: 18, fontWeight: '900',
              color: item.intelEarned > 0 ? Colors.emerald : item.intelEarned < 0 ? Colors.rose : Colors.textMuted,
            }}>{item.intelEarned > 0 ? '+' : ''}{item.intelEarned}</Text>
          </View>
          <View style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center' }}>
            <Text style={{ fontFamily: mono, fontSize: 9, color: Colors.textMuted, letterSpacing: 1, marginBottom: 4 }}>TIME</Text>
            <Text style={{ fontFamily: grotesk, fontSize: 18, fontWeight: '900', color: Colors.textPrimary }}>
              {item.status === 'forfeited' ? '--' : item.status === 'expired' ? 'EXPIRED' : `${item.timeTaken}s`}
            </Text>
          </View>
        </View>

        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          style={[{
            paddingVertical: 14, borderRadius: 10, alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
          }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]}
        >
          <Text style={{ fontFamily: mono, fontSize: 11, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 2 }}>CLOSE FILE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════ */
export default function CaseFilesPage({ user, go }) {
  const { isMobile, isPhone } = useResponsive();

  const [cases, setCases]           = useState([]);
  const [filter, setFilter]         = useState('all');
  const [sortNewest, setSortNewest] = useState(true);
  const [viewCase, setViewCase]     = useState(null);

  useEffect(() => { loadCases(); }, []);

  async function loadCases() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setCases(JSON.parse(raw));
    } catch {}
  }

  /* ── Derived data ── */
  const total     = cases.length;
  const cracked   = cases.filter(c => c.status === 'cracked').length;
  const forfeited = cases.filter(c => c.status === 'forfeited').length;
  const failed    = cases.filter(c => c.status === 'failed' || c.status === 'expired').length;
  const crackRate = total > 0 ? Math.round((cracked / total) * 100) + '%' : '--';

  const filteredCases = cases
    .filter(c => {
      if (filter === 'all') return true;
      if (filter === 'cracked') return c.status === 'cracked';
      if (filter === 'unsolved') return c.status === 'failed' || c.status === 'expired';
      if (filter === 'forfeited') return c.status === 'forfeited';
      return true;
    })
    .sort((a, b) => sortNewest ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);

  /* ── Empty State ── */
  if (total === 0) {
    return (
      <ScrollView contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <View style={[{
          padding: 40, borderRadius: 24, alignItems: 'center',
          backgroundColor: 'rgba(10,10,12,0.6)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
          maxWidth: 420, width: '100%',
        }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}>
          <CornerBrackets />
          <Icons.ArchiveIcon size={48} color={Colors.textMuted} />
          <Text style={{ fontFamily: grotesk, fontSize: 20, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 2, marginTop: 20, textAlign: 'center' }}>
            NO CASES ON RECORD
          </Text>
          <Text style={{ fontFamily: mono, fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 20 }}>
            Complete your first operation to{'\n'}start building your case files.
          </Text>
          <TouchableOpacity
            onPress={() => go('home')}
            style={[{
              marginTop: 28, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 10,
              backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8,
            }, isWeb ? { cursor: 'pointer' } : {}]}
          >
            <Text style={{ fontFamily: 'Chakra Petch', fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 2 }}>ENTER THE HUB</Text>
            <Icons.ChevronRightIcon size={14} color="#000" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: isMobile ? (isPhone ? 8 : 12) : 0, paddingBottom: 80, gap: isPhone ? 14 : 20 }}
      >
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPhone ? 8 : 12 }}>
            <View style={{ width: 4, height: 24, borderRadius: 2, backgroundColor: Colors.purple }} />
            <Text style={{ fontFamily: grotesk, fontSize: isPhone ? 16 : 22, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 2, textTransform: 'uppercase' }}>Case Files</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icons.ArchiveIcon size={12} color={Colors.textMuted} />
            <Text style={{ fontFamily: mono, fontSize: isPhone ? 9 : 10, color: Colors.textMuted, letterSpacing: 1 }}>
              {total} CASES
            </Text>
          </View>
        </View>

        {/* ── Stats Bar ── */}
        <View style={[{
          flexDirection: 'row', borderRadius: isPhone ? 10 : 16,
          backgroundColor: 'rgba(10,10,12,0.6)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
          overflow: 'hidden',
        }, isWeb ? { backdropFilter: 'blur(20px)' } : {}]}>
          <StatCard value={total} label="TOTAL CASES" isPhone={isPhone} />
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <StatCard value={cracked} label="CRACKED" color={Colors.emerald} isPhone={isPhone} />
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <StatCard value={forfeited + failed} label="UNSOLVED" color={Colors.rose} isPhone={isPhone} />
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <StatCard value={crackRate} label="CRACK RATE" color={Colors.cyan} isPhone={isPhone} />
        </View>

        {/* ── Filter Bar ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <FilterPill label="ALL" active={filter === 'all'} color={Colors.purple} count={total} onPress={() => setFilter('all')} />
            <FilterPill label="CRACKED" active={filter === 'cracked'} color={Colors.emerald} count={cracked} onPress={() => setFilter('cracked')} />
            <FilterPill label="UNSOLVED" active={filter === 'unsolved'} color={Colors.gold} count={failed} onPress={() => setFilter('unsolved')} />
            <FilterPill label="FORFEITED" active={filter === 'forfeited'} color={Colors.rose} count={forfeited} onPress={() => setFilter('forfeited')} />
          </View>
          <TouchableOpacity
            onPress={() => setSortNewest(!sortNewest)}
            style={[{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
            }, isWeb ? { cursor: 'pointer' } : {}]}
          >
            <Icons.ClockIcon size={10} color={Colors.textMuted} />
            <Text style={{ fontFamily: mono, fontSize: 10, color: Colors.textSecondary, letterSpacing: 1 }}>
              {sortNewest ? 'NEWEST' : 'OLDEST'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Case List ── */}
        <View style={{ gap: 12 }}>
          {filteredCases.map((item, i) => (
            <CaseCard
              key={item.timestamp + '-' + i}
              item={item}
              index={total - (sortNewest ? i : filteredCases.length - 1 - i)}
              onView={setViewCase}
              isPhone={isPhone}
            />
          ))}
          {filteredCases.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontFamily: mono, fontSize: 12, color: Colors.textMuted, letterSpacing: 2 }}>NO MATCHING CASES</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Case Modal ── */}
      {viewCase && (
        <CaseModal
          item={viewCase}
          onClose={() => setViewCase(null)}
        />
      )}
    </View>
  );
}
