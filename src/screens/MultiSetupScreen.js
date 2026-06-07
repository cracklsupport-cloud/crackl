import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Platform, Animated,
} from 'react-native';
import Colors from '../theme/colors';
import { useResponsive } from '../theme/breakpoints';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';
import { getAuthToken } from '../utils/authSession';

const isWeb = Platform.OS === 'web';
const mono    = isWeb ? '"JetBrains Mono", monospace' : undefined;
const grotesk = isWeb ? '"Space Grotesk", sans-serif' : undefined;

const OPERATION_OPTIONS = [
  { key: 'mcq', label: 'STANDARD QUEUE', icon: Icons.ActivityIcon, color: Colors.cyan, description: 'Classic multiple-choice decryption', coop: true },
  { key: 'type', label: 'BRAIN BLAST', icon: Icons.ZapIcon, color: Colors.gold, description: 'Manual answer entry with higher pressure', coop: true },
  { key: 'ranked', label: 'ECLIPSE LEVEL', icon: Icons.CrosshairIcon, color: Colors.purple, description: 'Rank-scaled arena difficulty', coop: true },
  { key: 'gauntlet', label: 'GAUNTLET', icon: Icons.AlertTriangleIcon, color: Colors.rose, description: 'Sequential survival riddles', coop: true },
  { key: 'chain', label: 'THE CHAIN', icon: Icons.LinkIcon, color: Colors.emerald, description: 'Linked-node progression flow', coop: true },
  { key: 'wager', label: 'BLIND WAGER', icon: Icons.EyeOffIcon, color: Colors.orange, description: 'Blind-stake riddle pool for versus rooms', coop: false },
  { key: 'bounty', label: 'BOUNTY BOARD', icon: Icons.FlameIcon, color: Colors.fuchsia, description: 'High-reward contract riddles', coop: true },
];
const ROOM_WAGER_PRESETS = [25, 50, 100, 250, 500];
const MIN_ROOM_WAGER = 10;

function parseStake(value) {
  return Math.max(0, parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0);
}

/* ─── Corner Brackets (identical to Dashboard) ─── */
function CornerBrackets({ color = 'rgba(255,255,255,0.18)' }) {
  const s = { position: 'absolute', width: 14, height: 14, borderColor: color, zIndex: 20 };
  return (
    <>
      <View style={{ ...s, top: 10, left: 10, borderTopWidth: 2, borderLeftWidth: 2 }} />
      <View style={{ ...s, top: 10, right: 10, borderTopWidth: 2, borderRightWidth: 2 }} />
      <View style={{ ...s, bottom: 10, left: 10, borderBottomWidth: 2, borderLeftWidth: 2 }} />
      <View style={{ ...s, bottom: 10, right: 10, borderBottomWidth: 2, borderRightWidth: 2 }} />
    </>
  );
}

/* ─── Section Label (identical style to dashboard) ─── */
function SectionLabel({ icon: IconComp, label, accentColor = Colors.textMuted }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      {IconComp && <IconComp size={12} color={accentColor} />}
      <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 2.1 }}>
        {label}
      </Text>
    </View>
  );
}

/* ─── Option Pill ─── */
function Pill({ label, icon: IconComp, active, accentColor, description, onPress, wide = false }) {
  const [hovered, setHovered] = useState(false);
  const isActive = active;
  const col = accentColor;
  return (
    <TouchableOpacity
      onPress={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      activeOpacity={0.75}
      style={[{
        flex: wide ? 1 : 0,
        paddingHorizontal: wide ? 20 : 16,
        paddingVertical: wide ? 18 : 13,
        borderRadius: 12,
        backgroundColor: isActive ? col + '14' : hovered ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)',
        borderWidth: 1.5,
        borderColor: isActive ? col + '60' : hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
        flexDirection: 'row', alignItems: 'center', gap: 10, position: 'relative', overflow: 'hidden',
      }, isWeb ? {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: isActive ? `0 0 18px ${col}20` : 'none',
      } : {}]}
    >
      {/* Active indicator line */}
      {isActive && (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: col, borderTopRightRadius: 2, borderBottomRightRadius: 2 }} />
      )}
      {IconComp && <IconComp size={15} color={isActive ? col : Colors.textMuted} />}
      <View style={{ flex: 1 }}>
        <Text style={{
          color: isActive ? col : Colors.textPrimary,
          fontFamily: 'Chakra Petch', fontWeight: '700',
          fontSize: 13, letterSpacing: 0.6,
        }}>{label}</Text>
        {description ? (
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, letterSpacing: 0.3, marginTop: 2, lineHeight: 16 }}>
            {description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/* ─── Number Selector ─── */
function NumPill({ value, active, accentColor, onPress }) {
  const [hovered, setHovered] = useState(false);
  const col = accentColor;
  return (
    <TouchableOpacity
      onPress={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      activeOpacity={0.75}
      style={[{
        width: 52, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? col + '14' : hovered ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)',
        borderWidth: 1.5,
        borderColor: active ? col + '60' : hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
      }, isWeb ? {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: active ? `0 0 14px ${col}25` : 'none',
      } : {}]}
    >
      <Text style={{ color: active ? col : Colors.textSecondary, fontFamily: mono, fontWeight: '900', fontSize: 13 }}>{value}</Text>
    </TouchableOpacity>
  );
}

function StakeChip({ value, active, disabled, onPress }) {
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      activeOpacity={0.75}
      style={[{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 8,
        backgroundColor: active ? Colors.gold+'16' : hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        borderWidth: 1.5,
        borderColor: active ? Colors.gold+'70' : 'rgba(255,255,255,0.08)',
        opacity: disabled ? 0.35 : 1,
      }, isWeb ? {
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: active ? `0 0 16px ${Colors.gold}22` : 'none',
      } : {}]}
    >
      <Icons.IntelIcon size={13} color={active ? Colors.gold : Colors.textMuted} />
      <Text style={{ color: active ? Colors.gold : Colors.textSecondary, fontFamily: mono, fontWeight: '900', fontSize: 12 }}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function MultiSetupScreen({ user, go, setRoom }) {
  const { isMobile, isPhone, isWide } = useResponsive();

  const [tab, setTab]       = useState('create');
  const [code, setCode]     = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');
  const [cfg, setCfg] = useState({
    engagement: 'versus',   // 'versus' | 'coop'
    mode:       'mcq',
    timed:      false,
    timeLimit:  null,
    maxPlayers: 4,
    wagerAmount: '',
  });

  const tickerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(tickerAnim, { toValue: -1200, duration: 22000, useNativeDriver: Platform.OS !== 'web' })
    ).start();
  }, []);

  async function getAuthHeaders() {
    const token = await getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  /* ── API Calls ── */
  async function createRoom() {
    setErr('');
    const preparedCfg = {
      ...cfg,
      timed: cfg.timed === 'panic' ? 'panic' : false,
      timeLimit: null,
      wagerAmount: (cfg.engagement === 'versus' && cfg.mode === 'wager') ? parseStake(cfg.wagerAmount) : 0,
    };
    if (preparedCfg.engagement === 'versus' && preparedCfg.mode === 'wager' && preparedCfg.wagerAmount < MIN_ROOM_WAGER) {
      setErr(`Blind Wager rooms need at least ${MIN_ROOM_WAGER} Intel per operative.`);
      return;
    }
    if (preparedCfg.engagement === 'versus' && preparedCfg.wagerAmount > 0 && balance < preparedCfg.wagerAmount) {
      setErr(`You need at least ${preparedCfg.wagerAmount} Intel to open this wagered showdown.`);
      return;
    }
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND}/room/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ hostName: user.username, ...preparedCfg }),
      });
      const data = await res.json();
      if (data.success) {
        setRoom({ id: data.roomId, isHost: true, cfg: preparedCfg });
        go('room');
      } else {
        setErr(data.error || 'Failed to create room.');
      }
    } catch {
      setErr('Network connection failed. Check your server.');
    }
    setLoading(false);
  }

  async function joinRoom() {
    if (!code.trim()) { setErr('Enter a session code first.'); return; }
    setErr('');
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND}/room/join`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ roomId: code.trim().toUpperCase(), username: user.username }),
      });
      const data = await res.json();
      if (data.success) {
        const joinedRoomTimeLimit = data.room.time_limit ?? null;
        const joinedPanic = joinedRoomTimeLimit === -1;
        setRoom({
          id: code.trim().toUpperCase(),
          isHost: false,
          cfg: {
            engagement: data.room.engagement || 'versus',
            mode: data.room.mode || 'mcq',
            timed: joinedPanic ? 'panic' : false,
            timeLimit: null,
            maxPlayers: data.room.max_players || 4,
            wagerAmount: data.room.wager_amount || data.wagerAmount || 0,
          },
        });
        go('room');
      } else {
        setErr(data.error || 'Failed to join room.');
      }
    } catch {
      setErr('Connection error. Server may be offline.');
    }
    setLoading(false);
  }

  /* ── Derived ── */
  const engagementColor = cfg.engagement === 'coop' ? Colors.emerald : Colors.rose;
  const availableOperations = OPERATION_OPTIONS.filter((option) => cfg.engagement === 'versus' || option.coop);
  const isBlindWagerSetup = cfg.engagement === 'versus' && cfg.mode === 'wager';
  const selectedWager = isBlindWagerSetup ? parseStake(cfg.wagerAmount) : 0;
  const balance = Math.max(0, parseInt(user?.coins, 10) || 0);
  const projectedPot = selectedWager * Math.max(2, parseInt(cfg.maxPlayers, 10) || 2);
  const wagerNeedsAttention = isBlindWagerSetup && (selectedWager < MIN_ROOM_WAGER || selectedWager > balance);

  function setEngagement(nextEngagement) {
    setCfg((prev) => {
      const fallbackMode = nextEngagement === 'coop' && prev.mode === 'wager' ? 'mcq' : prev.mode;
      return {
        ...prev,
        engagement: nextEngagement,
        mode: fallbackMode,
        wagerAmount: nextEngagement === 'coop' || fallbackMode !== 'wager' ? '' : prev.wagerAmount,
      };
    });
  }

  /* ─── Topbar ─── */
  function Topbar() {
    return (
      <View style={[{
        height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: isPhone ? 10 : (isMobile ? 16 : 28),
        borderBottomWidth: 1, borderColor: Colors.borderDefault,
        backgroundColor: 'rgba(9,9,11,0.92)', zIndex: 100,
      }, isWeb ? { backdropFilter: 'blur(24px)', position: 'sticky', top: 0 } : {}]}>
        {/* Abort */}
        <TouchableOpacity
          onPress={() => go('home')}
          style={[{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingVertical: 8, paddingHorizontal: 14,
            borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.35)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }, isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}]}
        >
          <Icons.ChevronLeftIcon size={12} color={Colors.textSecondary} />
          <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontWeight: '800', fontSize: 11, letterSpacing: 2 }}>ABORT</Text>
        </TouchableOpacity>

        {/* Title */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icons.SwordsIcon size={16} color={Colors.purple} />
          <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 15, letterSpacing: 2.5, textTransform: 'uppercase' }}>
            WAR ROOM
          </Text>
        </View>

        {/* Ticker hint / spacer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.emerald }} />
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 10, letterSpacing: 1.2 }}>
            {isMobile ? '' : 'NETWORK ACTIVE'}

          </Text>
        </View>
      </View>
    );
  }

  /* ─── Create Form ─── */
  function CreateForm() {
    return (
      <View style={{ gap: 0 }}>

        {/* ── ENGAGEMENT TYPE ── */}
        <View style={[{
          borderRadius: 14, padding: 20, overflow: 'hidden', position: 'relative',
          backgroundColor: 'rgba(255,255,255,0.015)',
          borderWidth: 1, borderColor: engagementColor + '40',
          marginBottom: 20,
        }, isWeb ? { backdropFilter: 'blur(12px)', boxShadow: `inset 0 0 40px ${engagementColor}08` } : {}]}>
          <CornerBrackets color={engagementColor + '45'} />
          <SectionLabel icon={Icons.UsersIcon} label="ENGAGEMENT TYPE" accentColor={engagementColor} />
          <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: isPhone ? 8 : 10 }}>
            <Pill
              wide
              label="DEAD HEAT"
              icon={Icons.CrosshairIcon}
              description="First to crack it wins"
              active={cfg.engagement === 'versus'}
              accentColor={Colors.rose}
              onPress={() => setEngagement('versus')}
            />
            <Pill
              wide
              label="ALLIED OPS"
              icon={Icons.LinkIcon}
              description="Solve together as a unit"
              active={cfg.engagement === 'coop'}
              accentColor={Colors.emerald}
              onPress={() => setEngagement('coop')}
            />
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />

        {/* ── OPERATION TYPE + TIME PROTOCOL ── */}
        <View style={{ flexDirection: isWide ? 'row' : 'column', gap: isWide ? 0 : 20, marginBottom: 20 }}>

          {/* OPERATION TYPE */}
          <View style={{ flex: 1, paddingRight: isWide ? 24 : 0 }}>
            <SectionLabel icon={Icons.SearchIcon} label="OPERATION TYPE" />
            <View style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
              backgroundColor: 'rgba(0,0,0,0.18)',
              maxHeight: isPhone ? 320 : 390,
              overflow: 'hidden',
            }}>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 10, gap: 10 }}
              >
                {availableOperations.map((option) => (
                  <Pill
                    key={option.key}
                    wide
                    label={option.label}
                    icon={option.icon}
                    description={option.description}
                    active={cfg.mode === option.key}
                    accentColor={option.color}
                    onPress={() => setCfg({ ...cfg, mode: option.key, wagerAmount: option.key === 'wager' ? (cfg.wagerAmount || '50') : '' })}
                  />
                ))}
              </ScrollView>
            </View>
            {cfg.engagement === 'coop' ? (
              <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, lineHeight: 18, letterSpacing: 0.4, marginTop: 12 }}>
                Allied Ops excludes Blind Wager and Cold Case. Everything else can run as a cooperative breach.
              </Text>
            ) : null}
          </View>

          {/* Vertical divider — wide only */}
          {isWide && (
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 0 }} />
          )}

          {/* TIME PROTOCOL */}
          <View style={{ flex: 1, paddingLeft: isWide ? 24 : 0 }}>
            <SectionLabel icon={Icons.ClockIcon} label="TIME PROTOCOL" />
            <View style={{ gap: 10 }}>
              <Pill
                wide
                label="PANIC MODE"
                icon={Icons.TargetIcon}
                description={cfg.timed === 'panic' ? 'Admin timer is armed for this room.' : 'Enable the global admin timer for every player.'}
                active={cfg.timed === 'panic'}
                accentColor={Colors.rose}
                onPress={() => setCfg({ ...cfg, timed: cfg.timed === 'panic' ? false : 'panic', timeLimit: null })}
              />
            </View>
            <Text style={{ color: cfg.timed === 'panic' ? Colors.rose : Colors.textMuted, fontFamily: mono, fontSize: 11, lineHeight: 18, letterSpacing: 0.5, marginTop: 12 }}>
              {cfg.timed === 'panic'
                ? 'Panic is active. The admin-configured countdown will arm for every operative.'
                : 'Leave Panic off and the room runs with no timer at all.'}
            </Text>
          </View>

        </View>

        {isBlindWagerSetup ? (
          <View style={[{
            borderRadius: 14,
            padding: isPhone ? 14 : 18,
            overflow: 'hidden',
            position: 'relative',
            borderWidth: 1.5,
            borderColor: wagerNeedsAttention ? Colors.rose+'65' : Colors.gold+'55',
            backgroundColor: wagerNeedsAttention ? Colors.rose+'08' : Colors.gold+'08',
            marginBottom: 20,
          }, isWeb ? {
            backdropFilter: 'blur(14px)',
            boxShadow: wagerNeedsAttention ? `inset 0 0 42px ${Colors.rose}12` : `inset 0 0 42px ${Colors.gold}12`,
          } : {}]}>
            <CornerBrackets color={(wagerNeedsAttention ? Colors.rose : Colors.gold) + '55'} />
            <View style={{ flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: 16, alignItems: isMobile ? 'stretch' : 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <SectionLabel icon={Icons.IntelIcon} label="BLIND WAGER BUY-IN" accentColor={Colors.gold} />
                <Text style={{ color: Colors.textPrimary, fontFamily: 'Chakra Petch', fontSize: isPhone ? 17 : 19, fontWeight: '900', letterSpacing: 0.8 }}>
                  Same stake for every operative.
                </Text>
                <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: isPhone ? 11 : 12, lineHeight: 19, marginTop: 8 }}>
                  The host sets one room-wide stake. When the round launches, every player escrows that Intel. First correct solver takes the full pot. If nobody solves, everyone is refunded.
                </Text>
              </View>
              <View style={{ minWidth: isMobile ? '100%' : 250, gap: 10 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ROOM_WAGER_PRESETS.map((value) => (
                    <StakeChip
                      key={value}
                      value={value}
                      active={selectedWager === value}
                      disabled={value > balance}
                      onPress={() => setCfg({ ...cfg, wagerAmount: String(value) })}
                    />
                  ))}
                </View>
                <TextInput
                  value={selectedWager ? String(selectedWager) : ''}
                  onChangeText={(value) => setCfg({ ...cfg, wagerAmount: String(parseStake(value) || '') })}
                  keyboardType="numeric"
                  placeholder="Custom Intel per operative"
                  placeholderTextColor={Colors.textMuted}
                  style={[{
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: wagerNeedsAttention ? Colors.rose+'80' : Colors.gold+'55',
                    backgroundColor: 'rgba(0,0,0,0.38)',
                    color: Colors.textPrimary,
                    fontFamily: mono,
                    fontSize: 16,
                    fontWeight: '900',
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                  }, isWeb ? { outlineStyle: 'none' } : {}]}
                />
              </View>
            </View>

            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10, marginTop: 16 }}>
              {[
                ['STAKE EACH', selectedWager ? `${selectedWager} INTEL` : '--', selectedWager >= MIN_ROOM_WAGER ? Colors.gold : Colors.rose],
                ['PROJECTED POT', selectedWager ? `${projectedPot} INTEL` : '--', Colors.emerald],
                ['YOUR BALANCE', `${balance} INTEL`, balance >= selectedWager ? Colors.cyan : Colors.rose],
              ].map(([label, value, color]) => (
                <View key={label} style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.25)', padding: 12 }}>
                  <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 10, letterSpacing: 1.4 }}>{label}</Text>
                  <Text style={{ color, fontFamily: mono, fontSize: 15, fontWeight: '900', marginTop: 5 }}>{value}</Text>
                </View>
              ))}
            </View>

            <Text style={{ color: wagerNeedsAttention ? Colors.rose : Colors.textMuted, fontFamily: mono, fontSize: 11, lineHeight: 18, marginTop: 12 }}>
              {selectedWager < MIN_ROOM_WAGER
                ? `Enter at least ${MIN_ROOM_WAGER} Intel to arm Blind Wager.`
                : selectedWager > balance
                  ? `Your balance cannot cover ${selectedWager} Intel. Lower the stake or add Intel first.`
                  : `Ready: every operative must cover ${selectedWager} Intel before the host can launch.`}
            </Text>
          </View>
        ) : null}

        {/* ── Divider ── */}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />

        {/* ── SQUAD SIZE ── */}
        <View style={{ marginBottom: 28 }}>
          <View>
            <SectionLabel icon={Icons.UsersIcon} label="SQUAD SIZE" accentColor={Colors.fuchsia} />
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {[2, 3, 4, 5].map(v => (
                <NumPill key={v} value={String(v)} active={cfg.maxPlayers === v} accentColor={Colors.fuchsia}
                  onPress={() => setCfg({ ...cfg, maxPlayers: v })} />
              ))}
            </View>
            <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, lineHeight: 18, letterSpacing: 0.4, marginTop: 10 }}>
              {isBlindWagerSetup
                ? 'The buy-in panel above handles the stake. Squad size controls the projected pot.'
                : cfg.engagement === 'coop'
                  ? 'Allied Ops clears together. No Blind Wager, no Cold Case, no extra stake panel.'
                  : 'Dead Heat runs head-to-head or in a small free-for-all.'}
            </Text>
          </View>
        </View>

        {/* ── LAUNCH OPERATION CTA ── */}
        <TouchableOpacity
          onPress={createRoom}
          disabled={loading || wagerNeedsAttention}
          style={[{
            backgroundColor: wagerNeedsAttention ? 'rgba(255,255,255,0.14)' : '#fff',
            paddingVertical: 18, borderRadius: 12,
            flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
            opacity: loading ? 0.5 : 1,
          }, isWeb ? {
            cursor: wagerNeedsAttention ? 'not-allowed' : 'pointer',
            transition: 'all 0.25s ease',
            boxShadow: wagerNeedsAttention ? 'none' : '0 4px 24px rgba(255,255,255,0.12)',
          } : {}]}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <>
                <Icons.TerminalIcon size={16} color={wagerNeedsAttention ? Colors.textMuted : '#000'} />
                <Text style={{ color: wagerNeedsAttention ? Colors.textMuted : '#000', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 2 }}>
                  {isBlindWagerSetup ? 'LOCK BUY-IN & LAUNCH' : 'LAUNCH OPERATION'}
                </Text>
                <Icons.ChevronRightIcon size={16} color={wagerNeedsAttention ? Colors.textMuted : '#000'} />
              </>
          }
        </TouchableOpacity>
        {!!err && (
          <Text style={{ color: '#f43f5e', fontFamily: mono, fontSize: 11, textAlign: 'center', marginTop: 10, letterSpacing: 0.5 }}>
            {err}
          </Text>
        )}

      </View>
    );
  }

  /* ─── Infiltrate (Join) Form ─── */
  function JoinForm() {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24, gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icons.LockIcon size={14} color={Colors.cyan} />
          <Text style={{ color: Colors.cyan, fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>
            SESSION CIPHER
          </Text>
        </View>

        <Text style={{ color: Colors.textSecondary, fontFamily: grotesk, fontSize: 15, textAlign: 'center', maxWidth: 380, lineHeight: 22 }}>
          Enter the 6-character cipher from your host to join their operation.
        </Text>

        <TextInput
          style={[{
            width: '100%', maxWidth: 440,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderWidth: 2,
            borderColor: code.length === 6 ? Colors.cyan : 'rgba(255,255,255,0.08)',
            borderRadius: isPhone ? 12 : 16,
            textAlign: 'center',
            fontFamily: mono,
            fontSize: isPhone ? 24 : 38, fontWeight: '900',
            letterSpacing: isPhone ? 8 : 16, color: Colors.cyan,
            paddingVertical: isPhone ? 18 : 28, marginTop: 8,
          }, isWeb ? {
            outlineStyle: 'none',
            transition: 'all 0.3s ease',
            boxShadow: code.length === 6 ? `0 0 24px ${Colors.cyan}30` : 'none',
          } : {}]}
          placeholder="XXXXXX"
          placeholderTextColor="rgba(255,255,255,0.08)"
          value={code}
          onChangeText={t => setCode(t.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
        />

        {/* Code character progress */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: -8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 24, height: 3, borderRadius: 2,
                backgroundColor: i < code.length ? Colors.cyan : 'rgba(255,255,255,0.08)',
                ...(isWeb ? { transition: 'background-color 0.2s ease' } : {}),
              }}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={joinRoom}
          disabled={loading || code.length < 6}
          style={[{
            width: '100%', maxWidth: 440,
            paddingVertical: 18, borderRadius: 12,
            flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
            marginTop: 8,
            backgroundColor: code.length === 6 ? Colors.cyan : 'rgba(255,255,255,0.04)',
            borderWidth: 1,
            borderColor: code.length === 6 ? Colors.cyan + '80' : 'rgba(255,255,255,0.08)',
            opacity: (loading || code.length < 6) ? 0.5 : 1,
          }, isWeb && code.length === 6 ? {
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            boxShadow: `0 0 24px ${Colors.cyan}35`,
          } : {}]}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <>
                <Icons.LinkIcon size={16} color={code.length === 6 ? '#000' : Colors.textMuted} />
                <Text style={{
                  color: code.length === 6 ? '#000' : Colors.textSecondary,
                  fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 2,
                }}>
                  ESTABLISH LINK
                </Text>
              </>
          }
        </TouchableOpacity>
        {!!err && (
          <Text style={{ color: '#f43f5e', fontFamily: mono, fontSize: 11, textAlign: 'center', marginTop: 10, letterSpacing: 0.5 }}>
            {err}
          </Text>
        )}
      </View>
    );
  }

  /* ─── Main Render ─── */
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgBase }}>

      {/* Ambient glow */}
      {isWeb && (
        <View style={{
          position: 'absolute', top: '10%', left: '30%',
          width: 600, height: 500, borderRadius: 300,
          backgroundColor: Colors.purple, opacity: 0.04,
          filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0,
        }} />
      )}

      <Topbar />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          maxWidth: 1000,
          alignSelf: 'center',
          width: '100%',
          paddingHorizontal: isPhone ? 10 : (isMobile ? 14 : 32),
          paddingTop: 36,
          paddingBottom: 80,
          gap: 0,
        }}
      >
        {/* ── Ticker ── */}
        <View style={{
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
          borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.3)',
          overflow: 'hidden', marginBottom: 28,
          paddingVertical: 6,
        }}>
          <Animated.View style={{ transform: [{ translateX: tickerAnim }], flexDirection: 'row', width: 3600 }}>
            <Text style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 2.8 }}>
              {'/// DEAD HEAT - FIRST OPERATIVE TO CRACK IT WINS /// ALLIED OPS - SOLVE AS A UNIT /// WAR ROOM IS LIVE /// PRIVATE SESSIONS AVAILABLE /// SELECT YOUR ENGAGEMENT TYPE AND DECRYPT /// '.repeat(6)}
            </Text>
          </Animated.View>
        </View>

        {/* ── Session Type Tabs ── */}
        <View style={{ flexDirection: 'row', gap: isPhone ? 8 : 12, marginBottom: isPhone ? 18 : 28 }}>
          {[
            { key: 'create', label: isPhone ? 'DECRYPT' : 'DECRYPT SESSION', icon: Icons.PlusIcon, color: Colors.purple },
            { key: 'join',   label: 'INFILTRATE',     icon: Icons.TargetIcon, color: Colors.cyan },
          ].map(({ key, label, icon: IconComp, color }) => {
            const active = tab === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setTab(key)}
                style={[{
                  flex: 1, paddingVertical: isPhone ? 12 : 18,
                  borderRadius: isPhone ? 10 : 14,
                  flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
                  backgroundColor: active ? color + '14' : 'rgba(255,255,255,0.02)',
                  borderWidth: 1.5,
                  borderColor: active ? color + '60' : 'rgba(255,255,255,0.06)',
                  position: 'relative', overflow: 'hidden',
                }, isWeb ? {
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: active ? `0 0 24px ${color}20` : 'none',
                } : {}]}
              >
                {/* Bottom accent line when active */}
                {active && (
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: color }} />
                )}
                <IconComp size={16} color={active ? color : Colors.textMuted} />
                <Text style={{
                  color: active ? color : Colors.textSecondary,
                  fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 13, letterSpacing: 1.5,
                }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Main Card ── */}
        <View style={[{
          borderRadius: isPhone ? 16 : 24, padding: isPhone ? 14 : (isMobile ? 20 : 32),
          backgroundColor: 'rgba(12,12,16,0.85)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
          position: 'relative', overflow: 'hidden',
        }, isWeb ? {
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        } : {}]}>
          <CornerBrackets />

          {tab === 'create' ? <CreateForm /> : <JoinForm />}

        </View>

      </ScrollView>
    </View>
  );
}
