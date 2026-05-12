import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Switch, Platform, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import RiddleContent from '../components/RiddleContent';

// On web, Alert.alert confirmation dialogs don't work — use browser confirm
const confirm = (title, msg, onConfirm) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${msg}`)) onConfirm();
  } else {
    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm }
    ]);
  }
};
import { CONFIG } from '../../config';

const MODES = ['mcq', 'type', 'arena', 'daily', 'gauntlet', 'chain', 'wager', 'bounty'];
const MODE_LABELS = {
  mcq: 'Standard Queue',
  type: 'Brain Blast',
  arena: 'Arena / Ranked',
  daily: 'Daily Drop',
  gauntlet: 'Gauntlet',
  chain: 'Chain',
  wager: 'Blind Wager',
  bounty: 'Bounty'
};
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const DIFF_COLORS = { Easy: '#00FF9D', Medium: '#FFC800', Hard: '#FF0055' };
const TIERS = [1, 2, 3, 4, 5];
const TIER_LABELS = {
  1: 'Rookie',
  2: 'Field Agent',
  3: 'Senior Agent',
  4: 'Elite',
  5: 'Shadow'
};
const defaultTierForDifficulty = (difficulty) => difficulty === 'Hard' ? 5 : difficulty === 'Medium' ? 3 : 1;

// ─── Styles ────────────────────────────────────────────────────────────────
const S = {
  bg: '#07070F',
  card: { backgroundColor: 'rgba(15,15,26,0.8)', borderRadius: 12, borderWidth: 1, borderColor: '#1F1F35', padding: 16, marginBottom: 12 },
  title: { color: '#fff', fontFamily: 'Chakra Petch', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  label: { color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  value: { color: '#fff', fontFamily: 'Chakra Petch', fontSize: 16, fontWeight: '700' },
  input: { backgroundColor: '#0F0F1A', borderWidth: 1, borderColor: '#1F1F35', borderRadius: 8, color: '#fff', fontFamily: 'Chakra Petch', fontSize: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  btn: (color = '#7C3AED') => ({ backgroundColor: color, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }),
  btnText: { color: '#fff', fontFamily: 'Chakra Petch', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  tab: (active) => ({ flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: active ? '#7C3AED' : 'transparent' }),
  tabText: (active) => ({ color: active ? '#fff' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }),
  divider: { height: 1, backgroundColor: '#1F1F35', marginVertical: 16 },
  pill: (color) => ({ backgroundColor: color + '22', borderWidth: 1, borderColor: color + '66', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }),
  pillText: (color) => ({ color, fontFamily: 'Share Tech Mono', fontSize: 10, fontWeight: '700' }),
};

// ─── Login Gate ─────────────────────────────────────────────────────────────
function LoginGate({ onAuth, go }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);

  const tryLogin = async () => {
    if (!key.trim()) return Alert.alert('Enter your admin key first');
    setLoading(true);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/stats`, {
        headers: { 'x-admin-secret': key.trim() }
      });
      const data = await res.json();
      if (data.success) {
        onAuth(key.trim(), data);
      } else {
        Alert.alert('Wrong Key', 'That admin key is incorrect.');
      }
    } catch {
      Alert.alert('Cannot connect', 'Make sure the server is running.');
    }
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: S.bg, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <Text style={{ fontSize: 40, marginBottom: 16 }}>🔐</Text>
      <Text style={[S.title, { marginBottom: 8, textAlign: 'center' }]}>Admin Panel</Text>
      <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 12, textAlign: 'center', marginBottom: 32 }}>
        Enter your admin key to continue
      </Text>
      <View style={{ width: '100%', maxWidth: 360 }}>
        <TextInput
          style={[S.input, { marginBottom: 16 }]}
          placeholder="Admin key"
          placeholderTextColor="#374151"
          secureTextEntry
          value={key}
          onChangeText={setKey}
          onSubmitEditing={tryLogin}
        />
        <TouchableOpacity style={S.btn()} onPress={tryLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={S.btnText}>ENTER</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => go('home')}>
          <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 12 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Tab 1: Overview ────────────────────────────────────────────────────────
function OverviewTab({ adminKey, initialStats }) {
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);
  const [maintenanceOn, setMaintenanceOn] = useState(initialStats?.maintenanceMode || false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('We are updating the vault. Back soon!');
  const [togglingMaint, setTogglingMaint] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/stats`, { headers: { 'x-admin-secret': adminKey } });
      const data = await res.json();
      if (data.success) { setStats(data); setMaintenanceOn(data.maintenanceMode); }
    } catch {}
    setLoading(false);
  }, [adminKey]);

  const toggleMaintenance = () => {
    const next = !maintenanceOn;
    const title = next ? 'Turn ON Maintenance?' : 'Turn OFF Maintenance?';
    const msg = next
      ? 'All players will see a "Vault Updating" screen. You can still use the admin panel.'
      : 'The app will become live again for all players.';
    confirm(title, msg, async () => {
      setTogglingMaint(true);
      try {
        await fetch(`${CONFIG.BACKEND_URL}/admin/maintenance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminKey },
          body: JSON.stringify({ on: next, message: maintenanceMsg })
        });
        setMaintenanceOn(next);
      } catch { Alert.alert('Error', 'Could not toggle maintenance mode.'); }
      setTogglingMaint(false);
    });
  };

  if (!stats) return <ActivityIndicator color="#7C3AED" style={{ marginTop: 40 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>

      {/* Maintenance Toggle */}
      <View style={[S.card, { borderColor: maintenanceOn ? '#FF0055' : '#1F1F35' }]}>
        <Text style={[S.label, { marginBottom: 0 }]}>App Status</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <View>
            <Text style={[S.value, { color: maintenanceOn ? '#FF0055' : '#00FF9D' }]}>
              {maintenanceOn ? '🔴  Under Maintenance' : '🟢  Live for Players'}
            </Text>
            <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 4 }}>
              {maintenanceOn ? 'Players see a "Back Soon" screen' : 'Players can play normally'}
            </Text>
          </View>
          {togglingMaint
            ? <ActivityIndicator color="#7C3AED" />
            : <Switch value={maintenanceOn} onValueChange={toggleMaintenance} trackColor={{ false: '#1F1F35', true: '#FF0055' }} thumbColor="#fff" />
          }
        </View>
        {maintenanceOn && (
          <TextInput
            style={[S.input, { marginTop: 10, marginBottom: 0 }]}
            placeholder="Message to show players..."
            placeholderTextColor="#374151"
            value={maintenanceMsg}
            onChangeText={setMaintenanceMsg}
          />
        )}
      </View>

      {/* Quick Numbers */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={[S.card, { flex: 1, marginBottom: 0, alignItems: 'center' }]}>
          <Text style={[S.label, { marginBottom: 4, textAlign: 'center' }]}>Total Riddles</Text>
          <Text style={{ color: '#7C3AED', fontSize: 28, fontWeight: '900', fontFamily: 'Chakra Petch' }}>{stats.totalRiddles ?? '—'}</Text>
        </View>
        <View style={[S.card, { flex: 1, marginBottom: 0, alignItems: 'center' }]}>
          <Text style={[S.label, { marginBottom: 4, textAlign: 'center' }]}>Sent Today</Text>
          <Text style={{ color: '#FFC800', fontSize: 28, fontWeight: '900', fontFamily: 'Chakra Petch' }}>{stats.servedToday ?? '—'}</Text>
        </View>
        <View style={[S.card, { flex: 1, marginBottom: 0, alignItems: 'center' }]}>
          <Text style={[S.label, { marginBottom: 4, textAlign: 'center' }]}>Active Users</Text>
          <Text style={{ color: '#00FF9D', fontSize: 28, fontWeight: '900', fontFamily: 'Chakra Petch' }}>{stats.activeUsers24h ?? '—'}</Text>
        </View>
      </View>

      {/* Riddles per Mode */}
      <View style={S.card}>
        <Text style={[S.label, { marginBottom: 12 }]}>Riddles by Game Mode</Text>
        {MODES.map(m => (
          <View key={m} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1F1F35' }}>
            <Text style={{ color: '#D1D5DB', fontFamily: 'Chakra Petch', fontSize: 14 }}>{MODE_LABELS[m]}</Text>
            <Text style={{ color: '#fff', fontFamily: 'Share Tech Mono', fontSize: 14, fontWeight: '700' }}>{stats.byMode?.[m] ?? 0}</Text>
          </View>
        ))}
      </View>

      {/* Low Stock Warnings */}
      {stats.lowStockAlerts?.length > 0 && (
        <View style={[S.card, { borderColor: '#FF005566' }]}>
          <Text style={[S.label, { color: '#FF0055', marginBottom: 10 }]}>⚠️  Riddles Running Low</Text>
          {stats.lowStockAlerts.map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: '#FCA5A5', fontFamily: 'Chakra Petch', fontSize: 13 }}>
                {MODE_LABELS[a.mode]} — {a.difficulty}
              </Text>
              <Text style={{ color: '#FF0055', fontFamily: 'Share Tech Mono', fontWeight: '700' }}>
                {a.count} left
              </Text>
            </View>
          ))}
          <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 8 }}>
            Add more riddles to keep the game running smoothly
          </Text>
        </View>
      )}

      <TouchableOpacity style={S.btn('#1F1F35')} onPress={refresh} disabled={loading}>
        {loading ? <ActivityIndicator color="#7C3AED" /> : <Text style={[S.btnText, { color: '#7C3AED' }]}>REFRESH STATS</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Riddle Format Types ────────────────────────────────────────────────────
const RIDDLE_TYPES = [
  { id: 'text', label: 'Text Only', icon: '📝', desc: 'Classic text riddle' },
  { id: 'image_text', label: 'Image + Text', icon: '🖼️', desc: 'Image with text overlay' },
  { id: 'image_only', label: 'Image Only', icon: '🎨', desc: 'Visual puzzle' },
  { id: 'audio_text', label: 'Audio + Text', icon: '🎧', desc: 'Sound clue with answer field' },
  { id: 'video_text', label: 'Video + Text', icon: '🎬', desc: 'Motion clue with answer field' },
  { id: 'interactive', label: 'Interactive', icon: '🧩', desc: 'Hosted HTML/JSON puzzle asset' },
];

const MEDIA_TYPES = ['image_text', 'image_only', 'audio_text', 'video_text', 'interactive'];
const MEDIA_ACCEPT = 'image/*,audio/*,video/*,.html,.htm,.json,.txt,.js';
const MEDIA_COPY = {
  image_text: { noun: 'IMAGE', hint: 'PNG, JPG, WEBP, GIF · Max 25MB' },
  image_only: { noun: 'IMAGE', hint: 'PNG, JPG, WEBP, GIF · Max 25MB' },
  audio_text: { noun: 'AUDIO', hint: 'MP3, WAV, M4A, OGG · Max 25MB' },
  video_text: { noun: 'VIDEO', hint: 'MP4, WEBM, MOV · Max 25MB' },
  interactive: { noun: 'INTERACTIVE ASSET', hint: 'HTML, JSON, TXT, JS · Max 25MB' },
};

function mediaKindForRiddleType(type) {
  if (type === 'audio_text') return 'audio';
  if (type === 'video_text') return 'video';
  if (type === 'interactive') return 'embed';
  return 'image';
}

function previewKindForRiddleType(type) {
  const kind = mediaKindForRiddleType(type);
  return kind === 'embed' ? 'interactive' : kind;
}

function mediaIcon(type) {
  if (type === 'audio') return '🎧';
  if (type === 'video') return '🎬';
  if (type === 'embed') return '🧩';
  if (type === 'image') return '🖼️';
  return '📝';
}

function mediaLabel(type) {
  if (type === 'audio') return 'AUDIO CLUE';
  if (type === 'video') return 'VIDEO CLUE';
  if (type === 'embed') return 'INTERACTIVE CLUE';
  if (type === 'image') return 'IMAGE CLUE';
  return 'TEXT';
}

const PHONE_W = 375;
const PHONE_H = 667;
const PREVIEW_SCALE = 0.58;

// ─── Drag & Drop Canvas Element ──────────────────────────────────────────────
function CanvasElement({ el, isSelected, onSelect, onDragEnd, onResize, scale }) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragStart = React.useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const resizeStart = React.useRef({ mx: 0, my: 0, ow: 0, oh: 0 });

  if (Platform.OS !== 'web') return null;

  const handleMouseDown = (e) => {
    e.stopPropagation();
    onSelect(el.id);
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: el.x, oy: el.y };
    const onMove = (ev) => {
      const dx = (ev.clientX - dragStart.current.mx) / scale;
      const dy = (ev.clientY - dragStart.current.my) / scale;
      const nx = Math.max(0, Math.min(PHONE_W - el.width, Math.round(dragStart.current.ox + dx)));
      const ny = Math.max(0, Math.min(PHONE_H - el.height, Math.round(dragStart.current.oy + dy)));
      onDragEnd(el.id, nx, ny);
    };
    const onUp = () => { setDragging(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleResizeDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    resizeStart.current = { mx: e.clientX, my: e.clientY, ow: el.width, oh: el.height };
    const onMove = (ev) => {
      const dw = (ev.clientX - resizeStart.current.mx) / scale;
      const dh = (ev.clientY - resizeStart.current.my) / scale;
      const nw = Math.max(40, Math.round(resizeStart.current.ow + dw));
      const nh = Math.max(20, Math.round(resizeStart.current.oh + dh));
      onResize(el.id, nw, nh);
    };
    const onUp = () => { setResizing(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const isMedia = ['image', 'audio', 'video', 'embed'].includes(el.type);
  const border = isSelected ? '2px solid #7C3AED' : '1px dashed rgba(124,58,237,0.3)';

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: el.x * scale,
        top: el.y * scale,
        width: el.width * scale,
        height: el.height * scale,
        border,
        borderRadius: (el.borderRadius || 0) * scale,
        cursor: dragging ? 'grabbing' : 'grab',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: el.textAlign === 'center' ? 'center' : 'flex-start',
        justifyContent: 'center',
        overflow: 'hidden',
        zIndex: isSelected ? 20 : 10,
        boxShadow: isSelected ? '0 0 12px rgba(124,58,237,0.3)' : 'none',
        transition: dragging || resizing ? 'none' : 'box-shadow 0.2s ease',
        userSelect: 'none',
      }}
    >
      {el.type === 'image' ? (
        el.src ? (
          <img
            src={el.src}
            alt="riddle"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: (el.borderRadius || 0) * scale, pointerEvents: 'none', opacity: el.opacity ?? 1 }}
            draggable={false}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: (el.borderRadius || 0) * scale }}>
            <span style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10 * scale }}>IMAGE</span>
          </div>
        )
      ) : isMedia ? (
        <div style={{
          width: '100%',
          height: '100%',
          background: el.type === 'audio'
            ? 'linear-gradient(135deg, rgba(0,255,157,0.12), rgba(10,10,20,0.92))'
            : el.type === 'video'
              ? 'linear-gradient(135deg, rgba(255,200,0,0.12), rgba(10,10,20,0.92))'
              : 'linear-gradient(135deg, rgba(124,58,237,0.16), rgba(10,10,20,0.92))',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: (el.borderRadius || 0) * scale,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5 * scale,
          opacity: el.opacity ?? 1,
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 22 * scale }}>{mediaIcon(el.type)}</span>
          <span style={{ color: '#d1d5db', fontFamily: 'Share Tech Mono', fontSize: 8 * scale, fontWeight: 800, letterSpacing: 1.2 }}>
            {mediaLabel(el.type)}
          </span>
          <span style={{ color: el.src ? '#00FF9D' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 6.5 * scale, letterSpacing: 0.8 }}>
            {el.src ? 'MEDIA LOCKED' : 'UPLOAD REQUIRED'}
          </span>
        </div>
      ) : (
        <span
          style={{
            color: el.color || '#e2e8f0',
            fontFamily: el.fontFamily === 'serif' ? '"Cormorant Garamond", serif' : el.fontFamily === 'mono' ? '"JetBrains Mono", monospace' : '"Chakra Petch", sans-serif',
            fontSize: (el.fontSize || 16) * scale,
            fontWeight: el.fontWeight || '700',
            lineHeight: 1.5,
            textAlign: el.textAlign || 'center',
            width: '100%',
            padding: 4 * scale,
            wordBreak: 'break-word',
            pointerEvents: 'none',
          }}
        >
          {el.content || 'Text'}
        </span>
      )}
      {/* Resize handle */}
      {isSelected && (
        <div
          onMouseDown={handleResizeDown}
          style={{
            position: 'absolute', right: -4, bottom: -4, width: 10, height: 10,
            backgroundColor: '#7C3AED', borderRadius: 2, cursor: 'nwse-resize',
            border: '1px solid #07070F',
          }}
        />
      )}
    </div>
  );
}

// ─── Phone Preview Frame ─────────────────────────────────────────────────────
function PhonePreview({ elements, selectedId, onSelect, onDragEnd, onResize, question, difficulty, mediaUrl }) {
  const scale = PREVIEW_SCALE;
  const frameW = PHONE_W * scale;
  const frameH = PHONE_H * scale;
  const diffCol = difficulty === 'Easy' ? '#00FF9D' : difficulty === 'Medium' ? '#FFC800' : '#FF0055';

  if (Platform.OS !== 'web') return null;

  return (
    <div style={{
      position: 'relative',
      width: frameW + 24,
      flexShrink: 0,
    }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 12px' }}>
        <span style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' }}>Live Preview</span>
        <span style={{ color: '#4B5563', fontFamily: 'Share Tech Mono', fontSize: 8 }}>{PHONE_W}×{PHONE_H}</span>
      </div>
      {/* Phone outer shell */}
      <div style={{
        width: frameW + 24,
        padding: '28px 12px 16px',
        background: 'linear-gradient(145deg, #1a1a2e 0%, #0a0a14 100%)',
        borderRadius: 32,
        border: '2px solid #2a2a40',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        position: 'relative',
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          width: 80, height: 6, borderRadius: 4,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.04)',
        }} />
        {/* Phone screen */}
        <div style={{
          width: frameW,
          height: frameH,
          backgroundColor: '#050508',
          borderRadius: 8,
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Status bar / top HUD */}
          <div style={{
            height: 28 * scale,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `0 ${8 * scale}px`,
            backgroundColor: 'rgba(5,5,8,0.98)',
            borderBottom: '1px solid rgba(0,255,208,0.12)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 * scale }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 6 * scale, color: '#64748b', fontWeight: 700, letterSpacing: 1 }}>ABORT</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 * scale }}>
              <div style={{ width: 3 * scale, height: 3 * scale, borderRadius: '50%', backgroundColor: '#00ffd0' }} />
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 6 * scale, color: '#00ffd0', fontWeight: 800, letterSpacing: 1.5 }}>QUICK CRACK</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 * scale, padding: `${2 * scale}px ${5 * scale}px`, borderRadius: 3 * scale, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(251,191,36,0.1)' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 7 * scale, color: '#fbbf24', fontWeight: 800 }}>💰 250</span>
            </div>
          </div>

          {/* HudFrame content area */}
          <div style={{
            margin: `${8 * scale}px ${6 * scale}px`,
            border: '1px solid rgba(0,255,208,0.12)',
            borderRadius: 4 * scale,
            position: 'relative',
            flex: 1,
            minHeight: (frameH - 60 * scale),
          }}>
            {/* HUD corner accents */}
            {['tl', 'tr', 'bl', 'br'].map(pos => (
              <div key={pos} style={{
                position: 'absolute', width: 10 * scale, height: 10 * scale, zIndex: 20,
                ...(pos.includes('t') ? { top: 0 } : { bottom: 0 }),
                ...(pos.includes('l') ? { left: 0 } : { right: 0 }),
                borderColor: 'rgba(0,255,208,0.25)',
                borderStyle: 'solid',
                borderWidth: 0,
                ...(pos.includes('t') ? { borderTopWidth: 1.5 } : { borderBottomWidth: 1.5 }),
                ...(pos.includes('l') ? { borderLeftWidth: 1.5 } : { borderRightWidth: 1.5 }),
              }} />
            ))}

            {/* Header inside HudFrame */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: `${6 * scale}px ${8 * scale}px`,
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 * scale }}>
                <div style={{ width: 3 * scale, height: 3 * scale, borderRadius: '50%', backgroundColor: '#00ffd0' }} />
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 5.5 * scale, color: '#4b5563', letterSpacing: 1.5 }}>ENCRYPTED CHANNEL</span>
              </div>
              <div style={{ display: 'flex', gap: 4 * scale }}>
                <div style={{ padding: `${2 * scale}px ${5 * scale}px`, borderRadius: 3 * scale, backgroundColor: diffCol + '12', border: `1px solid ${diffCol}30` }}>
                  <span style={{ color: diffCol, fontFamily: '"JetBrains Mono", monospace', fontSize: 5.5 * scale, fontWeight: 800, letterSpacing: 0.5 }}>{difficulty}</span>
                </div>
              </div>
            </div>

            {/* Draggable elements zone */}
            <div
              onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}
              style={{
                position: 'relative',
                width: frameW - 12 * scale,
                height: frameH - 100 * scale,
                overflow: 'hidden',
              }}
            >
              {elements.map(el => (
                <CanvasElement
                  key={el.id}
                  el={el}
                  isSelected={selectedId === el.id}
                  onSelect={onSelect}
                  onDragEnd={onDragEnd}
                  onResize={onResize}
                  scale={scale}
                />
              ))}

              {/* Center guide lines (dashed) */}
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, borderLeft: '1px dashed rgba(124,58,237,0.1)', pointerEvents: 'none', zIndex: 1 }} />
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, borderTop: '1px dashed rgba(124,58,237,0.1)', pointerEvents: 'none', zIndex: 1 }} />
            </div>
          </div>

          {/* Bottom status bar */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 16 * scale,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `0 ${6 * scale}px`,
            backgroundColor: 'rgba(5,5,8,0.98)',
            borderTop: '1px solid rgba(0,255,208,0.12)',
          }}>
            <span style={{ color: '#333', fontFamily: '"JetBrains Mono", monospace', fontSize: 5 * scale, letterSpacing: 0.5 }}>ID: RDL_???</span>
            <span style={{ color: '#333', fontFamily: '"JetBrains Mono", monospace', fontSize: 5 * scale, letterSpacing: 0.5 }}>CRACKL v1.0</span>
          </div>
        </div>
      </div>
      {/* Click instruction */}
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <span style={{ color: '#4B5563', fontFamily: 'Share Tech Mono', fontSize: 9 }}>Click to select · Drag to move · Corner to resize</span>
      </div>
    </div>
  );
}

function MediaPreviewBox({ url, kind, height = 132 }) {
  if (!url) return null;

  if (Platform.OS === 'web') {
    if (kind === 'image') {
      return (
        <div style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden', marginBottom: 8, backgroundColor: '#0A0A14' }}>
          <img src={url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
        </div>
      );
    }
    if (kind === 'audio') {
      return (
        <div style={{ width: '100%', borderRadius: 8, padding: 14, marginBottom: 8, backgroundColor: '#0A0A14', border: '1px solid #1F1F35' }}>
          <div style={{ color: '#00FF9D', fontFamily: 'Share Tech Mono', fontSize: 10, letterSpacing: 1, marginBottom: 10 }}>AUDIO PREVIEW</div>
          <audio controls src={url} style={{ width: '100%' }} />
        </div>
      );
    }
    if (kind === 'video') {
      return (
        <div style={{ width: '100%', height: 190, borderRadius: 8, overflow: 'hidden', marginBottom: 8, backgroundColor: '#0A0A14', border: '1px solid #1F1F35' }}>
          <video controls src={url} style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }} />
        </div>
      );
    }
    return (
      <div style={{ width: '100%', height: 170, borderRadius: 8, overflow: 'hidden', marginBottom: 8, backgroundColor: '#0A0A14', border: '1px solid #1F1F35' }}>
        <iframe title="Interactive asset preview" src={url} sandbox="allow-scripts allow-forms" style={{ width: '100%', height: '100%', border: 0, backgroundColor: '#050508' }} />
      </div>
    );
  }

  if (kind === 'image') {
    return (
      <View style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden', marginBottom: 8, backgroundColor: '#0A0A14' }}>
        <Image source={{ uri: url }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      </View>
    );
  }

  return (
    <View style={{ width: '100%', minHeight: 82, borderRadius: 8, marginBottom: 8, backgroundColor: '#0A0A14', borderWidth: 1, borderColor: '#1F1F35', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11, letterSpacing: 1 }}>
        {kind.toUpperCase()} UPLOADED
      </Text>
    </View>
  );
}

// ─── Element Inspector Panel ─────────────────────────────────────────────────
function ElementInspector({ el, onChange, onDelete }) {
  if (!el) return (
    <View style={[S.card, { borderColor: '#1F1F35', opacity: 0.5 }]}>
      <Text style={[S.label, { textAlign: 'center', marginBottom: 0 }]}>Select an element on the preview to edit its properties</Text>
    </View>
  );

  const isMedia = ['image', 'audio', 'video', 'embed'].includes(el.type);
  const typeLabel = el.type === 'text' ? '📝 TEXT ELEMENT' : `${mediaIcon(el.type)} ${mediaLabel(el.type)}`;

  return (
    <View style={[S.card, { borderColor: '#7C3AED44' }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={[S.label, { color: '#7C3AED', marginBottom: 0 }]}>
          {typeLabel} — {el.id}
        </Text>
        <TouchableOpacity onPress={() => onDelete(el.id)}>
          <Text style={{ color: '#FF0055', fontFamily: 'Share Tech Mono', fontSize: 10 }}>DELETE</Text>
        </TouchableOpacity>
      </View>

      {/* Position */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={[S.label, { fontSize: 9 }]}>X</Text>
          <TextInput style={[S.input, { marginBottom: 0, paddingVertical: 6 }]} keyboardType="numeric"
            value={String(el.x)} onChangeText={(v) => onChange(el.id, { x: parseInt(v) || 0 })} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[S.label, { fontSize: 9 }]}>Y</Text>
          <TextInput style={[S.input, { marginBottom: 0, paddingVertical: 6 }]} keyboardType="numeric"
            value={String(el.y)} onChangeText={(v) => onChange(el.id, { y: parseInt(v) || 0 })} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[S.label, { fontSize: 9 }]}>W</Text>
          <TextInput style={[S.input, { marginBottom: 0, paddingVertical: 6 }]} keyboardType="numeric"
            value={String(el.width)} onChangeText={(v) => onChange(el.id, { width: parseInt(v) || 40 })} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[S.label, { fontSize: 9 }]}>H</Text>
          <TextInput style={[S.input, { marginBottom: 0, paddingVertical: 6 }]} keyboardType="numeric"
            value={String(el.height)} onChangeText={(v) => onChange(el.id, { height: parseInt(v) || 20 })} />
        </View>
      </View>

      {!isMedia && (
        <>
          {/* Font size */}
          <Text style={[S.label, { fontSize: 9, marginTop: 8 }]}>Font Size</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            {[14, 16, 20, 24, 28, 32].map(s => (
              <TouchableOpacity key={s} onPress={() => onChange(el.id, { fontSize: s })}
                style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: el.fontSize === s ? '#7C3AED33' : '#0F0F1A', borderWidth: 1, borderColor: el.fontSize === s ? '#7C3AED' : '#1F1F35' }}>
                <Text style={{ color: el.fontSize === s ? '#C4B5FD' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10 }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Font family */}
          <Text style={[S.label, { fontSize: 9 }]}>Font</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            {[{ id: 'serif', label: 'Serif' }, { id: 'sans', label: 'Sans' }, { id: 'mono', label: 'Mono' }].map(f => (
              <TouchableOpacity key={f.id} onPress={() => onChange(el.id, { fontFamily: f.id })}
                style={{ flex: 1, paddingVertical: 6, borderRadius: 4, alignItems: 'center', backgroundColor: el.fontFamily === f.id ? '#7C3AED33' : '#0F0F1A', borderWidth: 1, borderColor: el.fontFamily === f.id ? '#7C3AED' : '#1F1F35' }}>
                <Text style={{ color: el.fontFamily === f.id ? '#C4B5FD' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10 }}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Color */}
          <Text style={[S.label, { fontSize: 9 }]}>Color</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            {['#e2e8f0', '#00ffd0', '#fbbf24', '#a78bfa', '#f43f5e', '#64748b'].map(c => (
              <TouchableOpacity key={c} onPress={() => onChange(el.id, { color: c })}
                style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c, borderWidth: 2, borderColor: el.color === c ? '#fff' : 'transparent' }} />
            ))}
          </View>
          {/* Alignment */}
          <Text style={[S.label, { fontSize: 9 }]}>Align</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {['left', 'center', 'right'].map(a => (
              <TouchableOpacity key={a} onPress={() => onChange(el.id, { textAlign: a })}
                style={{ flex: 1, paddingVertical: 6, borderRadius: 4, alignItems: 'center', backgroundColor: el.textAlign === a ? '#7C3AED33' : '#0F0F1A', borderWidth: 1, borderColor: el.textAlign === a ? '#7C3AED' : '#1F1F35' }}>
                <Text style={{ color: el.textAlign === a ? '#C4B5FD' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10 }}>{a.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {isMedia && (
        <>
          <Text style={[S.label, { fontSize: 9, marginTop: 8 }]}>Border Radius</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            {[0, 4, 8, 12, 50].map(r => (
              <TouchableOpacity key={r} onPress={() => onChange(el.id, { borderRadius: r })}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: el.borderRadius === r ? '#7C3AED33' : '#0F0F1A', borderWidth: 1, borderColor: el.borderRadius === r ? '#7C3AED' : '#1F1F35' }}>
                <Text style={{ color: el.borderRadius === r ? '#C4B5FD' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10 }}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[S.label, { fontSize: 9 }]}>Opacity</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[0.3, 0.5, 0.7, 0.85, 1].map(o => (
              <TouchableOpacity key={o} onPress={() => onChange(el.id, { opacity: o })}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: (el.opacity ?? 1) === o ? '#7C3AED33' : '#0F0F1A', borderWidth: 1, borderColor: (el.opacity ?? 1) === o ? '#7C3AED' : '#1F1F35' }}>
                <Text style={{ color: (el.opacity ?? 1) === o ? '#C4B5FD' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10 }}>{Math.round(o * 100)}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ─── Tab 2: Riddle Studio ───────────────────────────────────────────────────
function RiddleStudioTab({ adminKey }) {
  const [studioMode, setStudioMode] = useState('studio'); // 'studio' | 'bulk'
  const [loading, setLoading] = useState(false);

  // Riddle fields
  const [riddleType, setRiddleType] = useState('text');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [gameMode, setGameMode] = useState('arena');
  const [difficulty, setDifficulty] = useState('Medium');
  const [difficultyTier, setDifficultyTier] = useState('3');
  const [hint, setHint] = useState('');
  const [funFact, setFunFact] = useState('');
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [panicTime, setPanicTime] = useState('');

  // Media
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploadedMediaKind, setUploadedMediaKind] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Layout elements
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showFields, setShowFields] = useState(true);

  // Bulk
  const [bulkJson, setBulkJson] = useState('');
  const [bulkResult, setBulkResult] = useState(null);

  // Success toast (web non-blocking)
  const [successToast, setSuccessToast] = useState('');
  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3500);
  };

  // Initialize default elements when riddle type changes
  useEffect(() => {
    if (riddleType === 'text') {
      setElements([
        { id: 'question-text', type: 'text', content: question || 'Your riddle question here...', x: 12, y: 20, width: 335, height: 110, fontSize: 22, color: '#e2e8f0', fontFamily: 'serif', fontWeight: '700', textAlign: 'center' },
      ]);
    } else if (riddleType === 'image_text') {
      setElements([
        { id: 'riddle-image', type: 'image', src: mediaUrl || '', x: 20, y: 10, width: 320, height: 200, borderRadius: 8, opacity: 1 },
        { id: 'question-text', type: 'text', content: question || 'Your riddle question here...', x: 12, y: 220, width: 335, height: 100, fontSize: 20, color: '#e2e8f0', fontFamily: 'serif', fontWeight: '700', textAlign: 'center' },
      ]);
    } else if (riddleType === 'image_only') {
      setElements([
        { id: 'riddle-image', type: 'image', src: mediaUrl || '', x: 12, y: 10, width: 340, height: 340, borderRadius: 8, opacity: 1 },
      ]);
    } else if (riddleType === 'audio_text') {
      setElements([
        { id: 'riddle-audio', type: 'audio', src: mediaUrl || '', x: 20, y: 20, width: 335, height: 82, borderRadius: 8, opacity: 1 },
        { id: 'question-text', type: 'text', content: question || 'Listen closely. What is the answer?', x: 12, y: 126, width: 335, height: 110, fontSize: 20, color: '#e2e8f0', fontFamily: 'serif', fontWeight: '700', textAlign: 'center' },
      ]);
    } else if (riddleType === 'video_text') {
      setElements([
        { id: 'riddle-video', type: 'video', src: mediaUrl || '', x: 20, y: 12, width: 335, height: 190, borderRadius: 8, opacity: 1 },
        { id: 'question-text', type: 'text', content: question || 'Watch the clue. What is the answer?', x: 12, y: 220, width: 335, height: 105, fontSize: 20, color: '#e2e8f0', fontFamily: 'serif', fontWeight: '700', textAlign: 'center' },
      ]);
    } else if (riddleType === 'interactive') {
      setElements([
        { id: 'interactive-clue', type: 'embed', src: mediaUrl || '', x: 12, y: 12, width: 350, height: 320, borderRadius: 8, opacity: 1 },
      ]);
    }
    setSelectedId(null);
  }, [riddleType]);

  // Sync question text to canvas element
  useEffect(() => {
    setElements(prev => prev.map(el =>
      el.id === 'question-text' ? { ...el, content: question || 'Your riddle question here...' } : el
    ));
  }, [question]);

  // Sync media URL to every media element so preview and user screens stay in lock-step.
  useEffect(() => {
    setElements(prev => prev.map(el =>
      ['image', 'audio', 'video', 'embed'].includes(el.type) ? { ...el, src: mediaUrl } : el
    ));
  }, [mediaUrl]);

  const handleDragEnd = useCallback((id, nx, ny) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, x: nx, y: ny } : el));
  }, []);

  const handleResize = useCallback((id, nw, nh) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, width: nw, height: nh } : el));
  }, []);

  const handleElementChange = useCallback((id, changes) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...changes } : el));
  }, []);

  const handleElementDelete = useCallback((id) => {
    setElements(prev => prev.filter(el => el.id !== id));
    setSelectedId(null);
  }, []);

  const addTextElement = () => {
    const id = `text-${Date.now()}`;
    setElements(prev => [...prev, { id, type: 'text', content: 'New text', x: 50, y: 150, width: 260, height: 60, fontSize: 16, color: '#e2e8f0', fontFamily: 'sans', fontWeight: '600', textAlign: 'center' }]);
    setSelectedId(id);
  };

  const addMediaElement = () => {
    const type = mediaKindForRiddleType(riddleType);
    const id = `${type}-${Date.now()}`;
    const defaults = type === 'audio'
      ? { width: 280, height: 82, y: 120 }
      : type === 'video'
        ? { width: 300, height: 190, y: 80 }
        : type === 'embed'
          ? { width: 320, height: 250, y: 60 }
          : { width: 260, height: 180, y: 100 };
    setElements(prev => [...prev, { id, type, src: mediaUrl || '', x: 45, y: defaults.y, width: defaults.width, height: defaults.height, borderRadius: 8, opacity: 1 }]);
    setSelectedId(id);
  };

  const uploadAdminFile = async (file, fallbackName = 'admin-media') => {
    if (!file) return;
    setUploading(true);
    setUploadProgress('Uploading...');
    try {
      const formData = new FormData();
      if (file.uri) formData.append('file', file);
      else formData.append('file', file, file.name || fallbackName);

      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/upload`, {
        method: 'POST',
        headers: { 'x-admin-secret': adminKey },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setMediaUrl(data.url);
        setUploadedMediaKind(data.mediaKind || previewKindForRiddleType(riddleType));
        setUploadProgress(`✓ ${data.mediaKind || previewKindForRiddleType(riddleType)} uploaded`);
      } else {
        setUploadProgress('✗ ' + (data.error || 'Failed'));
      }
    } catch (err) {
      setUploadProgress('✗ ' + err.message);
    }
    setUploading(false);
  };

  const handleWebUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = MEDIA_ACCEPT;
    input.onchange = () => uploadAdminFile(input.files?.[0]);
    input.click();
  };

  // Upload media
  const handleUpload = async () => {
    if (Platform.OS === 'web') {
      handleWebUploadClick();
      return;
    }

    if (riddleType === 'audio_text' || riddleType === 'interactive') {
      Alert.alert('Use Web Admin', 'Audio and interactive assets are supported from the web admin studio.');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Denied', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: riddleType === 'video_text' ? ['videos'] : ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      try {
        await uploadAdminFile({
          uri: asset.uri,
          name: asset.fileName || (riddleType === 'video_text' ? 'upload.mp4' : 'upload.jpg'),
          type: asset.mimeType || (riddleType === 'video_text' ? 'video/mp4' : 'image/jpeg'),
        });
      } catch (err) {
        setUploadProgress('✗ ' + err.message);
      }
    }
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  const resetAll = () => {
    setQuestion(''); setAnswer(''); setHint(''); setFunFact('');
    setExplanation(''); setOptions(''); setFamilyId(''); setPanicTime('');
    setIsOnboarding(false); setMediaUrl(''); setRiddleType('text');
    setDifficulty('Medium'); setDifficultyTier('3');
    setUploadedMediaKind(''); setUploadProgress(''); setSelectedId(null);
  };

  const submitRiddle = async () => {
    const questionOptional = riddleType === 'image_only' || riddleType === 'interactive';
    const mediaCopy = MEDIA_COPY[riddleType] || MEDIA_COPY.image_text;
    if (!question.trim() && !questionOptional) return Alert.alert('Missing Fields', 'Question is required for this riddle type.');
    if (!answer.trim()) return Alert.alert('Missing Fields', 'Answer is required.');
    if (MEDIA_TYPES.includes(riddleType) && !mediaUrl) return Alert.alert('Missing Media', `Please upload a ${mediaCopy.noun.toLowerCase()} for this riddle type.`);

    setLoading(true);
    try {
      const layoutConfig = {
        canvas: { width: PHONE_W, height: PHONE_H },
        elements: elements.map(el => ({ ...el })),
      };

      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/riddle/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminKey },
        body: JSON.stringify({
          riddles: [{
            question: question.trim() || (riddleType === 'image_only' ? '[Visual Riddle]' : '[Interactive Riddle]'),
            answer: answer.trim(),
            game_mode: gameMode,
            difficulty,
            difficulty_tier: Math.max(1, Math.min(5, parseInt(difficultyTier, 10) || defaultTierForDifficulty(difficulty))),
            hint: hint.trim() || null,
            fun_fact: funFact.trim() || null,
            explanation: explanation.trim() || null,
            options: options.trim() ? options.split(',').map(s => s.trim()) : null,
            family_id: familyId.trim() || null,
            is_onboarding: isOnboarding,
            panic_time: panicTime ? parseInt(panicTime) : null,
            riddle_type: riddleType,
            media_url: mediaUrl || null,
            layout_config: elements.length > 0 ? layoutConfig : null,
          }]
        })
      });
      const data = await res.json();
      if (data.success && data.added > 0) {
        if (Platform.OS === 'web') {
          showToast(`✓ Riddle published to ${gameMode} / ${difficulty}`);
        } else {
          Alert.alert('Saved!', 'Riddle published successfully.');
        }
        resetAll();
      } else {
        const err = data.results?.[0]?.error || data.error || 'Something went wrong';
        Alert.alert('Error', err);
      }
    } catch (e) { Alert.alert('Error', e.message); }
    setLoading(false);
  };

  const submitBulk = async () => {
    let parsed;
    try { parsed = JSON.parse(bulkJson); }
    catch { return Alert.alert('Bad Format', 'Must be a valid JSON array.'); }
    if (!Array.isArray(parsed)) return Alert.alert('Bad Format', 'Must be a JSON array (starts with [)');
    setLoading(true);
    setBulkResult(null);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/riddle/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminKey },
        body: JSON.stringify({ riddles: parsed })
      });
      const data = await res.json();
      setBulkResult(data);
      if (data.success) setBulkJson('');
    } catch (e) { Alert.alert('Error', e.message); }
    setLoading(false);
  };

  const isWeb = Platform.OS === 'web';
  const requiresMedia = MEDIA_TYPES.includes(riddleType);
  const mediaCopy = MEDIA_COPY[riddleType] || MEDIA_COPY.image_text;
  const previewKind = uploadedMediaKind || previewKindForRiddleType(riddleType);

  return (
    <View style={{ flex: 1 }}>
      {/* Mode Switch */}
      <View style={{ flexDirection: 'row', backgroundColor: '#0F0F1A', margin: 12, marginBottom: 0, borderRadius: 8, padding: 4 }}>
        {[{ id: 'studio', label: '🎨 RIDDLE STUDIO' }, { id: 'bulk', label: '📋 BULK UPLOAD' }].map(m => (
          <TouchableOpacity key={m.id} onPress={() => setStudioMode(m.id)} style={{ flex: 1, paddingVertical: 10, borderRadius: 6, backgroundColor: studioMode === m.id ? '#7C3AED' : 'transparent', alignItems: 'center' }}>
            <Text style={{ color: studioMode === m.id ? '#fff' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 11, letterSpacing: 1 }}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Success Toast (web) */}
      {Platform.OS === 'web' && successToast ? (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, backgroundColor: '#00FF9D22', border: '1px solid #00FF9D66', borderRadius: 12, padding: '12px 20px', fontFamily: 'Share Tech Mono', fontSize: 13, color: '#00FF9D', pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,255,157,0.15)', letterSpacing: 1 }}>
          {successToast}
        </div>
      ) : null}

      {studioMode === 'studio' ? (

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 12 }}>
          {/* Two-panel layout for web */}
          {isWeb ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {/* LEFT PANEL: Form controls */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Format Selector */}
                <View style={[S.card, { borderColor: '#7C3AED33' }]}>
                  <Text style={[S.label, { color: '#7C3AED', marginBottom: 10 }]}>Riddle Format</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {RIDDLE_TYPES.map(t => (
                      <TouchableOpacity key={t.id} onPress={() => { if (t.id !== riddleType) { setMediaUrl(''); setUploadedMediaKind(''); setUploadProgress(''); } setRiddleType(t.id); }}
                        style={{
                          flexGrow: 1, flexBasis: 128, minWidth: 118, padding: 12, borderRadius: 10, alignItems: 'center',
                          backgroundColor: riddleType === t.id ? '#7C3AED15' : '#0A0A14',
                          borderWidth: 1.5, borderColor: riddleType === t.id ? '#7C3AED' : '#1F1F35',
                        }}>
                        <Text style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</Text>
                        <Text style={{ color: riddleType === t.id ? '#C4B5FD' : '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 10, fontWeight: '700', textAlign: 'center' }}>{t.label}</Text>
                        <Text style={{ color: '#4B5563', fontFamily: 'Share Tech Mono', fontSize: 8, marginTop: 3, textAlign: 'center' }}>{t.desc}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Media Upload */}
                {requiresMedia && (
                  <View style={[S.card, { borderColor: mediaUrl ? '#00FF9D44' : '#FFC80044' }]}>
                    <Text style={[S.label, { color: mediaUrl ? '#00FF9D' : '#FFC800' }]}>
                      {mediaUrl ? `✓ ${mediaCopy.noun} UPLOADED` : `⬆ UPLOAD ${mediaCopy.noun}`} <Text style={{ color: '#FF0055' }}>*</Text>
                    </Text>
                    {mediaUrl ? (
                      <View>
                        <MediaPreviewBox url={mediaUrl} kind={previewKind} />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity style={[S.btn('#1F1F35'), { flex: 1, marginBottom: 0 }]} onPress={handleUpload}>
                            <Text style={[S.btnText, { color: '#9CA3AF' }]}>REPLACE</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[S.btn('#FF005522'), { flex: 1, marginBottom: 0 }]} onPress={() => { setMediaUrl(''); setUploadedMediaKind(''); setUploadProgress(''); }}>
                            <Text style={[S.btnText, { color: '#FF0055' }]}>REMOVE</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : Platform.OS === 'web' ? (
                      <div
                        onClick={!uploading ? handleUpload : undefined}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.backgroundColor = '#7C3AED0A'; }}
                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#1F1F35'; e.currentTarget.style.backgroundColor = '#0A0A14'; }}
                        onDrop={async (e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#1F1F35';
                          e.currentTarget.style.backgroundColor = '#0A0A14';
                          const file = e.dataTransfer.files[0];
                          uploadAdminFile(file);
                        }}
                        style={{ padding: 24, borderRadius: 8, border: '2px dashed #1F1F35', alignItems: 'center', backgroundColor: '#0A0A14', cursor: uploading ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.2s ease' }}
                      >
                        {uploading
                          ? <div style={{ color: '#7C3AED', fontFamily: 'Share Tech Mono', fontSize: 12 }}>UPLOADING...</div>
                          : <>
                              <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                              <div style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11 }}>Click to browse or drag &amp; drop</div>
                              <div style={{ color: '#4B5563', fontFamily: 'Share Tech Mono', fontSize: 9, marginTop: 4 }}>{mediaCopy.hint}</div>
                            </>
                        }
                      </div>
                    ) : (
                      <TouchableOpacity onPress={handleUpload} disabled={uploading}
                        style={{ padding: 24, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: '#1F1F35', alignItems: 'center', backgroundColor: '#0A0A14' }}
                      >
                        {uploading
                          ? <ActivityIndicator color="#7C3AED" />
                          : <>
                              <Text style={{ fontSize: 28, marginBottom: 8 }}>📁</Text>
                              <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11 }}>Tap to browse</Text>
                              <Text style={{ color: '#4B5563', fontFamily: 'Share Tech Mono', fontSize: 9, marginTop: 4 }}>{mediaCopy.hint}</Text>
                            </>
                        }
                      </TouchableOpacity>
                    )}
                    {uploadProgress ? (
                      <Text style={{ color: uploadProgress.startsWith('✓') ? '#00FF9D' : uploadProgress.startsWith('✗') ? '#FF0055' : '#FFC800', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 6 }}>{uploadProgress}</Text>
                    ) : null}
                  </View>
                )}

                {/* Canvas Element Controls */}
                <View style={[S.card, { borderColor: '#1F1F35' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[S.label, { marginBottom: 0 }]}>Layout Elements ({elements.length})</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity onPress={addTextElement} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#7C3AED22', borderWidth: 1, borderColor: '#7C3AED44' }}>
                        <Text style={{ color: '#C4B5FD', fontFamily: 'Share Tech Mono', fontSize: 9 }}>+ TEXT</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={addMediaElement} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#00FF9D11', borderWidth: 1, borderColor: '#00FF9D33' }}>
                        <Text style={{ color: '#00FF9D', fontFamily: 'Share Tech Mono', fontSize: 9 }}>+ MEDIA</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {elements.map(el => (
                    <TouchableOpacity key={el.id} onPress={() => setSelectedId(el.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, backgroundColor: selectedId === el.id ? '#7C3AED15' : 'transparent', marginBottom: 2 }}>
                      <Text style={{ fontSize: 12 }}>{mediaIcon(el.type)}</Text>
                      <Text style={{ color: selectedId === el.id ? '#C4B5FD' : '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 10, flex: 1 }} numberOfLines={1}>{el.id}</Text>
                      <Text style={{ color: '#4B5563', fontFamily: 'Share Tech Mono', fontSize: 9 }}>{el.x},{el.y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Element Inspector */}
                <ElementInspector el={selectedElement} onChange={handleElementChange} onDelete={handleElementDelete} />

                {/* Collapsible fields section */}
                <TouchableOpacity onPress={() => setShowFields(!showFields)}
                  style={[S.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: showFields ? 0 : 12, borderRadius: showFields ? 12 : 12 }]}>
                  <Text style={[S.label, { marginBottom: 0 }]}>Riddle Data Fields</Text>
                  <Text style={{ color: '#6B7280', fontSize: 16 }}>{showFields ? '▾' : '▸'}</Text>
                </TouchableOpacity>

                {showFields && (
                  <View style={{ marginBottom: 12 }}>
                    {/* Game Mode */}
                    <Text style={[S.label, { marginTop: 12 }]}>Game Mode</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {MODES.map(m => (
                          <TouchableOpacity key={m} onPress={() => setGameMode(m)}
                            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: gameMode === m ? '#7C3AED' : '#0F0F1A', borderWidth: 1, borderColor: gameMode === m ? '#7C3AED' : '#1F1F35' }}>
                            <Text style={{ color: gameMode === m ? '#fff' : '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11 }}>{MODE_LABELS[m]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Difficulty */}
                    <Text style={S.label}>Difficulty</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      {DIFFICULTIES.map(d => (
                        <TouchableOpacity key={d} onPress={() => { setDifficulty(d); setDifficultyTier(String(defaultTierForDifficulty(d))); }}
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: difficulty === d ? DIFF_COLORS[d] + '33' : '#0F0F1A', borderWidth: 1, borderColor: difficulty === d ? DIFF_COLORS[d] : '#1F1F35', alignItems: 'center' }}>
                          <Text style={{ color: difficulty === d ? DIFF_COLORS[d] : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '700' }}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={S.label}>RDE Difficulty Tier</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                      {TIERS.map(tier => (
                        <TouchableOpacity key={tier} onPress={() => setDifficultyTier(String(tier))}
                          style={{ flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: difficultyTier === String(tier) ? '#00FFD014' : '#0F0F1A', borderWidth: 1, borderColor: difficultyTier === String(tier) ? '#00FFD0' : '#1F1F35', alignItems: 'center' }}>
                          <Text style={{ color: difficultyTier === String(tier) ? '#00FFD0' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '900' }}>T{tier}</Text>
                          <Text style={{ color: '#4B5563', fontFamily: 'Share Tech Mono', fontSize: 8, marginTop: 2 }} numberOfLines={1}>{TIER_LABELS[tier]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={{ color: '#4B5563', fontFamily: 'Share Tech Mono', fontSize: 9, marginBottom: 10, marginTop: -6, lineHeight: 14 }}>
                      RDE uses this tier for onboarding, progression, ranked scaling, and multiplayer queues.
                    </Text>

                    {/* Question */}
                    <Text style={S.label}>Question {!['image_only', 'interactive'].includes(riddleType) && <Text style={{ color: '#FF0055' }}>*</Text>}</Text>
                    <TextInput style={[S.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Type the riddle here..." placeholderTextColor="#374151" multiline value={question} onChangeText={setQuestion} />

                    {/* Answer */}
                    <Text style={S.label}>Answer <Text style={{ color: '#FF0055' }}>*</Text></Text>
                    <TextInput style={S.input} placeholder="The exact answer" placeholderTextColor="#374151" value={answer} onChangeText={setAnswer} />

                    {/* Optional */}
                    <Text style={S.label}>Hint (optional)</Text>
                    <TextInput style={S.input} placeholder="A helpful clue..." placeholderTextColor="#374151" value={hint} onChangeText={setHint} />

                    <Text style={S.label}>Fun Fact (optional)</Text>
                    <TextInput style={S.input} placeholder="Interesting fact..." placeholderTextColor="#374151" value={funFact} onChangeText={setFunFact} />

                    <Text style={S.label}>Explanation (optional)</Text>
                    <TextInput style={S.input} placeholder="Why is the answer correct?" placeholderTextColor="#374151" value={explanation} onChangeText={setExplanation} />

                    <Text style={S.label}>MCQ Options (optional, comma-separated)</Text>
                    <TextInput style={S.input} placeholder="Option A, Option B, Option C, Option D" placeholderTextColor="#374151" value={options} onChangeText={setOptions} />

                    <Text style={S.label}>Variant Group ID (optional)</Text>
                    <TextInput style={S.input} placeholder="e.g. speed-distance-1" placeholderTextColor="#374151" value={familyId} onChangeText={setFamilyId} />

                    <Text style={S.label}>Custom Timer (seconds, optional)</Text>
                    <TextInput style={S.input} placeholder="e.g. 45" placeholderTextColor="#374151" keyboardType="numeric" value={panicTime} onChangeText={setPanicTime} />
                    <Text style={{ color: '#4B5563', fontFamily: 'Share Tech Mono', fontSize: 9, marginBottom: 10, marginTop: -6, lineHeight: 14 }}>
                      Overrides the countdown for this riddle in all modes. Used by Panic Mode.
                    </Text>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1F1F35', marginTop: 4 }}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ color: '#D1D5DB', fontFamily: 'Chakra Petch', fontSize: 14, fontWeight: '700' }}>Show to New Players First</Text>
                        <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 2 }}>For onboarding riddles</Text>
                      </View>
                      <Switch value={isOnboarding} onValueChange={setIsOnboarding} trackColor={{ false: '#1F1F35', true: '#7C3AED' }} thumbColor="#fff" />
                    </View>
                  </View>
                )}

                {/* Save Button */}
                <TouchableOpacity style={[S.btn('#7C3AED'), { marginTop: 8 }]} onPress={submitRiddle} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={S.btnText}>PUBLISH RIDDLE</Text>
                      <Text style={{ fontSize: 14 }}>🚀</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </div>

              {/* RIGHT PANEL: Live Preview */}
              <PhonePreview
                elements={elements}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDragEnd={handleDragEnd}
                onResize={handleResize}
                question={question}
                difficulty={difficulty}
                mediaUrl={mediaUrl}
              />
            </div>
          ) : (
            /* Mobile: stacked layout (no drag/drop, form only) */
            <>
              {/* Format Selector */}
              <View style={[S.card, { borderColor: '#7C3AED33' }]}>
                <Text style={[S.label, { color: '#7C3AED', marginBottom: 10 }]}>Riddle Format</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {RIDDLE_TYPES.map(t => (
                    <TouchableOpacity key={t.id} onPress={() => { if (t.id !== riddleType) { setMediaUrl(''); setUploadedMediaKind(''); setUploadProgress(''); } setRiddleType(t.id); }}
                      style={{ flexGrow: 1, flexBasis: 96, minWidth: 92, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: riddleType === t.id ? '#7C3AED15' : '#0A0A14', borderWidth: 1, borderColor: riddleType === t.id ? '#7C3AED' : '#1F1F35' }}>
                      <Text style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</Text>
                      <Text style={{ color: riddleType === t.id ? '#C4B5FD' : '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 9, fontWeight: '700', textAlign: 'center' }}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Media Upload */}
              {requiresMedia && (
                <View style={[S.card, { borderColor: mediaUrl ? '#00FF9D44' : '#FFC80044', marginTop: 10 }]}>
                  <Text style={[S.label, { color: mediaUrl ? '#00FF9D' : '#FFC800' }]}>
                    {mediaUrl ? `✓ ${mediaCopy.noun} UPLOADED` : `⬆ UPLOAD ${mediaCopy.noun}`} <Text style={{ color: '#FF0055' }}>*</Text>
                  </Text>
                  {mediaUrl ? (
                    <View>
                      <MediaPreviewBox url={mediaUrl} kind={previewKind} />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={[S.btn('#1F1F35'), { flex: 1, marginBottom: 0 }]} onPress={handleUpload}>
                          <Text style={[S.btnText, { color: '#9CA3AF' }]}>REPLACE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[S.btn('#FF005522'), { flex: 1, marginBottom: 0 }]} onPress={() => { setMediaUrl(''); setUploadedMediaKind(''); setUploadProgress(''); }}>
                          <Text style={[S.btnText, { color: '#FF0055' }]}>REMOVE</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={handleUpload} disabled={uploading}
                      style={{ padding: 24, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: '#1F1F35', alignItems: 'center', backgroundColor: '#0A0A14' }}>
                      {uploading
                          ? <ActivityIndicator color="#7C3AED" />
                          : <>
                              <Text style={{ fontSize: 28, marginBottom: 8 }}>📁</Text>
                              <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11 }}>Tap to choose media</Text>
                              <Text style={{ color: '#4B5563', fontFamily: 'Share Tech Mono', fontSize: 9, marginTop: 4 }}>{mediaCopy.hint}</Text>
                            </>
                      }
                    </TouchableOpacity>
                  )}
                  {uploadProgress ? (
                    <Text style={{ color: uploadProgress.startsWith('✓') ? '#00FF9D' : uploadProgress.startsWith('✗') ? '#FF0055' : '#FFC800', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 6 }}>{uploadProgress}</Text>
                  ) : null}
                </View>
              )}

              {/* Game Mode */}
              <Text style={S.label}>Game Mode</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {MODES.map(m => (
                    <TouchableOpacity key={m} onPress={() => setGameMode(m)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: gameMode === m ? '#7C3AED' : '#0F0F1A', borderWidth: 1, borderColor: gameMode === m ? '#7C3AED' : '#1F1F35' }}>
                      <Text style={{ color: gameMode === m ? '#fff' : '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11 }}>{MODE_LABELS[m]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={S.label}>Difficulty</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                {DIFFICULTIES.map(d => (
                  <TouchableOpacity key={d} onPress={() => { setDifficulty(d); setDifficultyTier(String(defaultTierForDifficulty(d))); }}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: difficulty === d ? DIFF_COLORS[d] + '33' : '#0F0F1A', borderWidth: 1, borderColor: difficulty === d ? DIFF_COLORS[d] : '#1F1F35', alignItems: 'center' }}>
                    <Text style={{ color: difficulty === d ? DIFF_COLORS[d] : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '700' }}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={S.label}>RDE Difficulty Tier</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                {TIERS.map(tier => (
                  <TouchableOpacity key={tier} onPress={() => setDifficultyTier(String(tier))}
                    style={{ flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: difficultyTier === String(tier) ? '#00FFD014' : '#0F0F1A', borderWidth: 1, borderColor: difficultyTier === String(tier) ? '#00FFD0' : '#1F1F35', alignItems: 'center' }}>
                    <Text style={{ color: difficultyTier === String(tier) ? '#00FFD0' : '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '900' }}>T{tier}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={S.label}>Question {!['image_only', 'interactive'].includes(riddleType) && <Text style={{ color: '#FF0055' }}>*</Text>}</Text>
              <TextInput style={[S.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Type the riddle here..." placeholderTextColor="#374151" multiline value={question} onChangeText={setQuestion} />

              <Text style={S.label}>Answer <Text style={{ color: '#FF0055' }}>*</Text></Text>
              <TextInput style={S.input} placeholder="The exact answer" placeholderTextColor="#374151" value={answer} onChangeText={setAnswer} />

              <Text style={S.label}>Hint (optional)</Text>
              <TextInput style={S.input} placeholder="A helpful clue..." placeholderTextColor="#374151" value={hint} onChangeText={setHint} />

              <Text style={S.label}>Fun Fact (optional)</Text>
              <TextInput style={S.input} placeholder="Interesting fact..." placeholderTextColor="#374151" value={funFact} onChangeText={setFunFact} />

              <Text style={S.label}>Explanation (optional)</Text>
              <TextInput style={S.input} placeholder="Why is the answer correct?" placeholderTextColor="#374151" value={explanation} onChangeText={setExplanation} />

              <Text style={S.label}>MCQ Options (comma-separated, optional)</Text>
              <TextInput style={S.input} placeholder="A, B, C, D" placeholderTextColor="#374151" value={options} onChangeText={setOptions} />

              <Text style={S.label}>Variant Group ID (optional)</Text>
              <TextInput style={S.input} placeholder="e.g. speed-distance-1" placeholderTextColor="#374151" value={familyId} onChangeText={setFamilyId} />

              <Text style={S.label}>Custom Timer (seconds, optional)</Text>
              <TextInput style={S.input} placeholder="e.g. 45" placeholderTextColor="#374151" keyboardType="numeric" value={panicTime} onChangeText={setPanicTime} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1F1F35', marginTop: 4 }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ color: '#D1D5DB', fontFamily: 'Chakra Petch', fontSize: 14, fontWeight: '700' }}>Show to New Players First</Text>
                  <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 2 }}>For onboarding riddles</Text>
                </View>
                <Switch value={isOnboarding} onValueChange={setIsOnboarding} trackColor={{ false: '#1F1F35', true: '#7C3AED' }} thumbColor="#fff" />
              </View>

              <TouchableOpacity style={[S.btn('#7C3AED'), { marginTop: 8 }]} onPress={submitRiddle} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>PUBLISH RIDDLE 🚀</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      ) : (
        /* Bulk Upload (unchanged) */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          <View style={[S.card, { borderColor: '#1F1F3566' }]}>
            <Text style={[S.label, { color: '#7C3AED' }]}>Required fields per riddle</Text>
            <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11, lineHeight: 18 }}>
              {"question, answer, game_mode, difficulty\n\nOptional: hint, fun_fact, explanation,\noptions (array), family_id, is_onboarding,\npanic_time, riddle_type, media_url, layout_config"}
            </Text>
            <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 8 }}>
              {"game_mode: mcq | type | arena | daily | gauntlet | chain | wager | bounty\ndifficulty: Easy | Medium | Hard\nriddle_type: text | image_text | image_only | audio_text | video_text | interactive"}
            </Text>
          </View>

          <Text style={S.label}>Paste your riddles here (JSON array)</Text>
          <TextInput
            style={[S.input, { height: 200, textAlignVertical: 'top', fontFamily: 'Share Tech Mono', fontSize: 12 }]}
            placeholder={'[\n  {\n    "question": "What has hands but cannot clap?",\n    "answer": "A clock",\n    "game_mode": "arena",\n    "difficulty": "Easy"\n  }\n]'}
            placeholderTextColor="#374151"
            multiline
            value={bulkJson}
            onChangeText={setBulkJson}
          />

          <TouchableOpacity style={S.btn('#7C3AED')} onPress={submitBulk} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.btnText}>UPLOAD ALL</Text>}
          </TouchableOpacity>

          {bulkResult && (
            <View style={[S.card, { borderColor: bulkResult.failed > 0 ? '#FF005566' : '#00FF9D66' }]}>
              <Text style={[S.label, { marginBottom: 8 }]}>Upload Report</Text>
              <Text style={{ color: '#00FF9D', fontFamily: 'Chakra Petch', fontWeight: '700' }}>✓ Saved: {bulkResult.added}</Text>
              {bulkResult.failed > 0 && <Text style={{ color: '#FF0055', fontFamily: 'Chakra Petch', fontWeight: '700' }}>✗ Failed: {bulkResult.failed}</Text>}
              {bulkResult.results?.filter(r => !r.success).map((r, i) => (
                <Text key={i} style={{ color: '#FCA5A5', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 4 }}>
                  Row {r.index + 1}: {r.error}
                </Text>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Tab 3: Manage Riddles ───────────────────────────────────────────────────
function ManageTab({ adminKey }) {
  const [riddles, setRiddles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('all');
  const [filterDiff, setFilterDiff] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [previewRiddle, setPreviewRiddle] = useState(null);
  const LIMIT = 20;

  const fetchRiddles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (filterMode !== 'all') params.set('mode', filterMode);
      if (filterDiff !== 'all') params.set('difficulty', filterDiff);
      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/riddles?${params}`, { headers: { 'x-admin-secret': adminKey } });
      const data = await res.json();
      if (data.success) { setRiddles(data.riddles || []); setTotal(data.total || 0); }
    } catch {}
    setLoading(false);
  }, [adminKey, filterMode, filterDiff, page]);

  useEffect(() => { fetchRiddles(); }, [fetchRiddles]);

  const deleteRiddle = (id) => {
    confirm('Delete Riddle?', 'This cannot be undone.', async () => {
      try {
        await fetch(`${CONFIG.BACKEND_URL}/admin/riddle/${id}`, { method: 'DELETE', headers: { 'x-admin-secret': adminKey } });
        fetchRiddles();
      } catch { Alert.alert('Error', 'Could not delete.'); }
    });
  };

  const toggleActive = async (riddle) => {
    try {
      await fetch(`${CONFIG.BACKEND_URL}/admin/riddle/${riddle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminKey },
        body: JSON.stringify({ is_active: !riddle.is_active })
      });
      fetchRiddles();
    } catch { Alert.alert('Error', 'Could not update.'); }
  };

  const renderMediaChip = (riddle) => {
    const kind = previewKindForRiddleType(riddle.riddle_type || 'text');
    if (!riddle.media_url) return null;
    return (
      <View style={S.pill('#00FF9D')}>
        <Text style={S.pillText('#00FF9D')}>{kind.toUpperCase()} CLUE</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Filters */}
      <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#1F1F35' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => { setFilterMode('all'); setPage(1); }}
              style={[S.pill(filterMode === 'all' ? '#7C3AED' : '#6B7280'), { marginRight: 2 }]}>
              <Text style={S.pillText(filterMode === 'all' ? '#C4B5FD' : '#9CA3AF')}>All Modes</Text>
            </TouchableOpacity>
            {MODES.map(m => (
              <TouchableOpacity key={m} onPress={() => { setFilterMode(m); setPage(1); }} style={S.pill(filterMode === m ? '#7C3AED' : '#6B7280')}>
                <Text style={S.pillText(filterMode === m ? '#C4B5FD' : '#9CA3AF')}>{MODE_LABELS[m]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {['all', ...DIFFICULTIES].map(d => (
            <TouchableOpacity key={d} onPress={() => { setFilterDiff(d); setPage(1); }}
              style={S.pill(d === 'all' ? (filterDiff === d ? '#7C3AED' : '#6B7280') : (filterDiff === d ? DIFF_COLORS[d] : '#6B7280'))}>
              <Text style={S.pillText(d === 'all' ? (filterDiff === d ? '#C4B5FD' : '#9CA3AF') : (filterDiff === d ? DIFF_COLORS[d] : '#9CA3AF'))}>
                {d === 'all' ? 'All Levels' : d}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 6 }}>
          Showing {riddles.length} of {total} riddles
        </Text>
      </View>

      {loading
        ? <ActivityIndicator color="#7C3AED" style={{ marginTop: 40 }} />
        : (
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            {riddles.length === 0
              ? <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', textAlign: 'center', marginTop: 40 }}>No riddles found</Text>
              : riddles.map(r => (
                <View key={r.id} style={[S.card, { borderColor: DIFF_COLORS[r.difficulty] + '44', opacity: r.is_active ? 1 : 0.5 }]}>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                    <View style={S.pill(DIFF_COLORS[r.difficulty])}>
                      <Text style={S.pillText(DIFF_COLORS[r.difficulty])}>{r.difficulty}</Text>
                    </View>
                    <View style={S.pill('#00FFD0')}>
                      <Text style={S.pillText('#00FFD0')}>TIER {r.difficulty_tier || defaultTierForDifficulty(r.difficulty)}</Text>
                    </View>
                    <View style={S.pill('#7C3AED')}>
                      <Text style={S.pillText('#C4B5FD')}>{MODE_LABELS[r.game_mode] || r.game_mode}</Text>
                    </View>
                    {r.is_onboarding && (
                      <View style={S.pill('#00FF9D')}>
                        <Text style={S.pillText('#00FF9D')}>New Players</Text>
                      </View>
                    )}
                    {renderMediaChip(r)}
                    {!r.is_active && (
                      <View style={S.pill('#FF0055')}>
                        <Text style={S.pillText('#FF0055')}>Hidden</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    {r.media_url ? (
                      <View style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', backgroundColor: '#0A0A14', borderWidth: 1, borderColor: '#1F1F35', alignItems: 'center', justifyContent: 'center' }}>
                        {previewKindForRiddleType(r.riddle_type || 'text') === 'image' ? (
                          <Image source={{ uri: r.media_url }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Text style={{ color: '#00FF9D', fontFamily: 'Share Tech Mono', fontSize: 10, fontWeight: '900', textAlign: 'center' }}>
                            {previewKindForRiddleType(r.riddle_type || 'text').toUpperCase()}
                          </Text>
                        )}
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#D1D5DB', fontFamily: 'Chakra Petch', fontSize: 14, marginBottom: 4, lineHeight: 20 }} numberOfLines={3}>{r.question}</Text>
                      <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11 }}>Answer: {r.answer}</Text>
                      {r.times_served > 0 && <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginTop: 2 }}>Sent to {r.times_served} player{r.times_served !== 1 ? 's' : ''}</Text>}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => setPreviewRiddle(r)}>
                      <Text style={{ color: '#00FF9D', fontFamily: 'Share Tech Mono', fontSize: 11 }}>
                        Preview Player View
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleActive(r)}>
                      <Text style={{ color: r.is_active ? '#FFC800' : '#00FF9D', fontFamily: 'Share Tech Mono', fontSize: 11 }}>
                        {r.is_active ? 'Hide Riddle' : 'Show Riddle'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteRiddle(r.id)}>
                      <Text style={{ color: '#FF0055', fontFamily: 'Share Tech Mono', fontSize: 11 }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            }
            {/* Pagination */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8 }}>
              {page > 1 && (
                <TouchableOpacity onPress={() => setPage(p => p - 1)} style={[S.btn('#1F1F35'), { marginBottom: 0, paddingHorizontal: 20 }]}>
                  <Text style={[S.btnText, { color: '#9CA3AF' }]}>← Prev</Text>
                </TouchableOpacity>
              )}
              {riddles.length === LIMIT && (
                <TouchableOpacity onPress={() => setPage(p => p + 1)} style={[S.btn('#1F1F35'), { marginBottom: 0, paddingHorizontal: 20 }]}>
                  <Text style={[S.btnText, { color: '#9CA3AF' }]}>Next →</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )
      }
      {previewRiddle ? (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.76)', padding: 16, justifyContent: 'center', zIndex: 100 }}>
          <View style={{ maxWidth: 720, width: '100%', alignSelf: 'center', maxHeight: '90%', borderRadius: 12, backgroundColor: '#07070F', borderWidth: 1, borderColor: '#7C3AED66', overflow: 'hidden' }}>
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: '#1F1F35', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[S.label, { marginBottom: 4, color: '#00FF9D' }]}>Player-Screen Preview</Text>
                <Text style={{ color: '#D1D5DB', fontFamily: 'Chakra Petch', fontSize: 16, fontWeight: '900' }}>{MODE_LABELS[previewRiddle.game_mode] || previewRiddle.game_mode}</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewRiddle(null)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1F1F35' }}>
                <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '900' }}>CLOSE</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: '#00FFD033', backgroundColor: 'rgba(15,15,26,0.75)', padding: 18, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <Text style={{ color: '#00FFD0', fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }}>ENCRYPTED CHANNEL</Text>
                  <Text style={{ color: DIFF_COLORS[previewRiddle.difficulty] || '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11, fontWeight: '900' }}>{previewRiddle.difficulty}</Text>
                </View>
                <RiddleContent riddle={previewRiddle} accent="#00FFD0" questionStyle={{ fontSize: 24, lineHeight: 34 }} />
              </View>
              {Array.isArray(previewRiddle.options) && previewRiddle.options.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {previewRiddle.options.map((option, index) => (
                    <View key={`${option}_${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, backgroundColor: '#0F0F1A', borderWidth: 1, borderColor: '#1F1F35' }}>
                      <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 13, fontWeight: '900', width: 24 }}>{['A', 'B', 'C', 'D'][index] || '?'}</Text>
                      <Text style={{ color: '#D1D5DB', fontFamily: 'Chakra Petch', fontSize: 15, fontWeight: '700', flex: 1 }}>{option}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#1F1F35', backgroundColor: '#0F0F1A' }}>
                  <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 11, marginBottom: 6 }}>ANSWER FIELD PREVIEW</Text>
                  <Text style={{ color: '#D1D5DB', fontFamily: 'Chakra Petch', fontSize: 15 }}>Player types their response here.</Text>
                </View>
              )}
              <View style={{ marginTop: 14, padding: 12, borderRadius: 8, backgroundColor: '#0F0F1A', borderWidth: 1, borderColor: '#1F1F35' }}>
                <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginBottom: 6 }}>ADMIN ONLY</Text>
                <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11 }}>Correct answer: {previewRiddle.answer}</Text>
                {previewRiddle.explanation ? <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 11, marginTop: 6 }}>Explanation: {previewRiddle.explanation}</Text> : null}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ─── Tab 4: Riddle Stock ─────────────────────────────────────────────────────
function StockTab({ adminKey }) {
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/admin/pool-health`, { headers: { 'x-admin-secret': adminKey } });
      const data = await res.json();
      if (data.success) setGrid({ legacy: data.grid, tierGrid: data.tierGrid });
    } catch {}
    setLoading(false);
  }, [adminKey]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const statusColor = (s) => s === 'LOW' ? '#FF0055' : s === 'WARNING' ? '#FFC800' : '#00FF9D';
  const statusLabel = (s) => s === 'LOW' ? '⚠️ LOW' : s === 'WARNING' ? '⚡ OK' : '✓ GOOD';

  if (loading) return <ActivityIndicator color="#7C3AED" style={{ marginTop: 40 }} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 10, marginBottom: 16, lineHeight: 16 }}>
        This shows how many riddles are available for each mode and level. RED means you need to add more.
      </Text>
      {MODES.map(m => (
        <View key={m} style={[S.card, { marginBottom: 8 }]}>
          <Text style={[S.label, { marginBottom: 10 }]}>{MODE_LABELS[m]}</Text>
          <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>RDE TIERS</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
            {TIERS.map(tier => {
              const cell = grid?.tierGrid?.[m]?.[tier];
              const color = statusColor(cell?.status);
              return (
                <View key={tier} style={{ flex: 1, backgroundColor: color + '11', borderWidth: 1, borderColor: color + '44', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                  <Text style={{ color, fontFamily: 'Share Tech Mono', fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>T{tier}</Text>
                  <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 18, fontWeight: '900' }}>{cell?.remaining ?? '?'}</Text>
                  <Text style={{ color, fontFamily: 'Share Tech Mono', fontSize: 8, marginTop: 4, fontWeight: '700' }}>{statusLabel(cell?.status)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={{ color: '#9CA3AF', fontFamily: 'Share Tech Mono', fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>LEGACY LABELS</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {DIFFICULTIES.map(d => {
              const cell = grid?.legacy?.[m]?.[d];
              const color = statusColor(cell?.status);
              return (
                <View key={d} style={{ flex: 1, backgroundColor: color + '11', borderWidth: 1, borderColor: color + '44', borderRadius: 8, padding: 10, alignItems: 'center' }}>
                  <Text style={{ color, fontFamily: 'Share Tech Mono', fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>{d.toUpperCase()}</Text>
                  <Text style={{ color: '#fff', fontFamily: 'Chakra Petch', fontSize: 20, fontWeight: '900' }}>{cell?.remaining ?? '?'}</Text>
                  <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 9, marginTop: 2 }}>left today</Text>
                  <Text style={{ color, fontFamily: 'Share Tech Mono', fontSize: 8, marginTop: 4, fontWeight: '700' }}>{statusLabel(cell?.status)}</Text>
                  {cell?.onboardingCount > 0 && (
                    <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 8, marginTop: 2 }}>{cell.onboardingCount} for new users</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
      <TouchableOpacity style={[S.btn('#1F1F35')]} onPress={fetch_}>
        <Text style={[S.btnText, { color: '#7C3AED' }]}>REFRESH</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function AdminDashboard({ go }) {
  const [adminKey, setAdminKey] = useState('');
  const [initialStats, setInitialStats] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const TABS = [
    { label: 'Overview', emoji: '📊' },
    { label: 'Studio', emoji: '🎨' },
    { label: 'Manage', emoji: '📋' },
    { label: 'Stock', emoji: '📦' },
  ];

  if (!adminKey) {
    return <LoginGate onAuth={(key, stats) => { setAdminKey(key); setInitialStats(stats); }} go={go} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: S.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1F1F35' }}>
        <Text style={[S.title, { fontSize: 18 }]}>Admin Panel</Text>
        <TouchableOpacity onPress={() => go('home')}>
          <Text style={{ color: '#6B7280', fontFamily: 'Share Tech Mono', fontSize: 11, letterSpacing: 1 }}>EXIT</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1F1F35' }}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={i} style={S.tab(activeTab === i)} onPress={() => setActiveTab(i)}>
            <Text style={{ fontSize: 16 }}>{t.emoji}</Text>
            <Text style={S.tabText(activeTab === i)}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 0 && <OverviewTab adminKey={adminKey} initialStats={initialStats} />}
        {activeTab === 1 && <RiddleStudioTab adminKey={adminKey} />}
        {activeTab === 2 && <ManageTab adminKey={adminKey} />}
        {activeTab === 3 && <StockTab adminKey={adminKey} />}
      </View>
    </View>
  );
}
