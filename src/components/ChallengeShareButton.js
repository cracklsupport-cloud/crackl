import React, { useState } from 'react';
import { Platform, Share, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND } from '../utils/api';
import Icons from './Icons';

const isWeb = Platform.OS === 'web';
const mono = isWeb ? '"JetBrains Mono", monospace' : 'Share Tech Mono';

function getChallengeOrigin() {
  if (isWeb && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://crackl.app';
}

function buildChallengeUrl(linkId) {
  return `${getChallengeOrigin()}/?challengeId=${encodeURIComponent(linkId)}`;
}

function formatSeconds(value) {
  const seconds = Math.max(1, parseInt(value, 10) || 1);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

async function shareChallenge({ url, text }) {
  if (isWeb && typeof navigator !== 'undefined') {
    if (navigator.share) {
      await navigator.share({ title: 'CRACKL Challenge', text, url });
      return 'shared';
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      return 'copied';
    }
  }

  await Share.share({
    title: 'CRACKL Challenge',
    message: `${text}\n${url}`,
    url
  });
  return 'shared';
}

export default function ChallengeShareButton({
  user,
  riddle,
  targetTime,
  mode,
  accent = '#00ffd0',
  disabled = false,
  label = 'CHALLENGE A GENIUS',
  style,
  textStyle,
  onCreated
}) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function createChallenge() {
    if (busy || disabled) return;
    if (!user?.id || user.id === 'guest') {
      setStatus('SIGN IN TO CHALLENGE');
      return;
    }
    if (!riddle?.id) {
      setStatus('NODE MISSING');
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const token = await AsyncStorage.getItem('crackl_token');
      const response = await fetch(`${BACKEND}/challenge/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          challengerId: user.id,
          challengerName: user.username || 'Ghost Operative',
          riddleId: riddle.id,
          targetTime: Math.max(1, parseInt(targetTime, 10) || 1),
          wagerCoins: 0,
          mode: mode || 'challenge'
        })
      });
      const data = await response.json();
      if (!data.success) {
        setStatus((data.error || 'CHALLENGE FAILED').toUpperCase());
        return;
      }

      const url = buildChallengeUrl(data.linkId);
      const timeLabel = formatSeconds(targetTime);
      const text = `I cracked this CRACKL puzzle in ${timeLabel}. I bet you can't beat it.`;
      const shareResult = await shareChallenge({ url, text });
      setStatus(shareResult === 'copied' ? 'LINK COPIED' : 'CHALLENGE SENT');
      onCreated?.({ linkId: data.linkId, url });
    } catch {
      setStatus('SHARE FAILED');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ width: '100%' }}>
      <TouchableOpacity
        disabled={busy || disabled}
        activeOpacity={0.75}
        onPress={createChallenge}
        style={[{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          paddingVertical: 12,
          borderRadius: 4,
          backgroundColor: `${accent}0A`,
          borderWidth: 1,
          borderColor: `${accent}26`,
          opacity: busy || disabled ? 0.65 : 1
        }, isWeb ? { cursor: busy || disabled ? 'default' : 'pointer' } : {}, style]}
      >
        <Icons.LinkIcon size={11} color={accent} />
        <Text style={[{
          color: accent,
          fontFamily: mono,
          fontWeight: '900',
          fontSize: 10,
          letterSpacing: 1.8,
          textTransform: 'uppercase'
        }, textStyle]}>
          {busy ? 'CREATING LINK...' : label}
        </Text>
      </TouchableOpacity>
      {!!status && (
        <Text style={{ marginTop: 6, color: status.includes('FAILED') || status.includes('MISSING') ? '#f43f5e' : '#64748b', fontFamily: mono, fontSize: 10, textAlign: 'center', letterSpacing: 1 }}>
          {status}
        </Text>
      )}
    </View>
  );
}
