import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import Colors from '../theme/colors';
import { BACKEND } from '../utils/api';
import Icons from '../components/Icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RiddleContent from '../components/RiddleContent';

const mono = Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'Share Tech Mono';
const display = 'Chakra Petch';

const MODE_META = {
  mcq: { label: 'STANDARD QUEUE', accent: Colors.cyan, desc: 'Classic multiple-choice decryption.' },
  type: { label: 'BRAIN BLAST', accent: Colors.gold, desc: 'Manual answer entry with higher pressure.' },
  ranked: { label: 'ECLIPSE LEVEL', accent: Colors.purple, desc: 'Rank-scaled arena difficulty.' },
  gauntlet: { label: 'GAUNTLET', accent: Colors.rose, desc: 'Sequential survival riddles.' },
  chain: { label: 'THE CHAIN', accent: Colors.emerald, desc: 'Linked-node progression flow.' },
  wager: { label: 'BLIND WAGER', accent: Colors.orange, desc: 'Blind-stake room sequence.' },
  bounty: { label: 'BOUNTY BOARD', accent: Colors.fuchsia, desc: 'High-reward contract riddles.' },
};

function statCard(label, value, accent = Colors.textPrimary) {
  return (
    <View key={label} style={{ flexGrow: 1, minWidth: 120, padding: 12, borderRadius: 10, backgroundColor: 'rgba(15,15,26,0.55)', borderWidth: 1, borderColor: Colors.borderDefault }}>
      <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 }}>{label}</Text>
      <Text style={{ color: accent, fontFamily: display, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }}>{value}</Text>
    </View>
  );
}

export default function MultiRoomScreen({ user, go, exitToHome, room, update }) {
  const [players, setPlayers] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [riddle, setRiddle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const [allRes, setAllRes] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [displayCoins, setDisplayCoins] = useState(room.userCoins ?? user?.coins ?? 0);
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const typedRef = useRef('');
  const selectedRef = useRef(null);
  const timeLeftRef = useRef(0);
  const currentRiddleIdRef = useRef(null);

  const roomModeKey = roomData?.mode || room.cfg?.mode || 'mcq';
  const roomMode = MODE_META[roomModeKey] || MODE_META.mcq;
  const storedTimeLimit = roomData?.time_limit ?? room.cfg?.timeLimit ?? null;
  const isPanicMode = storedTimeLimit === -1 || room.cfg?.timed === 'panic';
  const roomTimed = isPanicMode || (!!storedTimeLimit && storedTimeLimit > 0);
  const engagement = roomData?.engagement || room.cfg?.engagement || 'versus';
  const engagementLabel = engagement === 'coop' ? 'ALLIED OPS' : 'DEAD HEAT';
  const status = roomData?.status || 'waiting';
  const maxPlayers = roomData?.max_players || room.cfg?.maxPlayers || 4;
  const showdownWager = Number(roomData?.wager_amount ?? room.cfg?.wagerAmount ?? 0) || 0;
  const isWageredShowdown = engagement === 'versus' && showdownWager > 0;
  const usesTypedInput = roomModeKey === 'type' || !Array.isArray(riddle?.options) || !riddle?.options?.length;
  const resolvedView = !!result && !result.pending;
  const livePanic = isPanicMode && !!riddle && !resolvedView;
  const canStart = room.isHost && players.length >= 2 && !loading;
  const canContinue = room.isHost && resolvedView && !loading && !result?.showdownComplete;
  const roundStartedWithoutPayload = !riddle && status === 'playing';

  useEffect(() => {
    pollRoom();
    pollRef.current = setInterval(pollRoom, 2500);
    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  async function getAuthHeaders() {
    const token = await AsyncStorage.getItem('crackl_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  async function pollRoom() {
    try {
      const token = await AsyncStorage.getItem('crackl_token');
      const res = await fetch(`${BACKEND}/room/${room.id}?userId=${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!data.success) return;
      setRoomData(data.room);
      setPlayers(data.players || []);
      if (typeof data.currentUserCoins === 'number') {
        setDisplayCoins(data.currentUserCoins);
      }
      if (data.currentRiddle?.id && currentRiddleIdRef.current !== data.currentRiddle.id) {
        applyRoundPayload(data.currentRiddle);
      }
      if (data.roundSummary) {
        applyResolvedSummary(data.roundSummary, data.players || [], data.currentUserCoins);
      }
    } catch {}
  }

  function tick(limitSeconds) {
    clearInterval(timerRef.current);
    const safe = Math.max(0, parseInt(limitSeconds, 10) || 0);
    setTimeLeft(safe);
    timeLeftRef.current = safe;
    if (!safe) return;
    let current = safe;
    timerRef.current = setInterval(() => {
      current -= 1;
      setTimeLeft(current);
      timeLeftRef.current = current;
      if (current <= 0) {
        clearInterval(timerRef.current);
        submitAns('__timeout__');
      }
    }, 1000);
  }

  function resetRoundState() {
    setSelected(null);
    selectedRef.current = null;
    setTyped('');
    typedRef.current = '';
    setResult(null);
    setAllRes([]);
    setErr('');
  }

  function applyRoundPayload(payload) {
    currentRiddleIdRef.current = payload.id;
    setRiddle(payload);
    resetRoundState();
    if (roomTimed && payload.timeLimit > 0) tick(payload.timeLimit);
    else {
      clearInterval(timerRef.current);
      setTimeLeft(0);
      timeLeftRef.current = 0;
    }
  }

  function buildResolvedResult(summary) {
    const iWon = summary.teamWin || summary.winnerId === user.id;
    const gaveUp = !!summary.gaveUp;
    const noWinner = !!summary.noWinner;
    const refunded = !!summary.refunded;
    const title = gaveUp
      ? 'OPERATION ABORTED'
      : summary.teamWin
        ? 'TEAM BREACH COMPLETE'
        : noWinner
          ? refunded ? 'SHOWDOWN VOIDED' : 'NO WINNER'
          : iWon
            ? 'ACCESS SECURED'
            : 'ANOTHER OPERATIVE CLEARED IT';
    const tone = gaveUp ? Colors.gold : summary.teamWin || iWon ? Colors.emerald : noWinner ? Colors.gold : Colors.rose;
    const subtitle = gaveUp
      ? 'The host killed the round and revealed the answer.'
      : summary.teamWin
        ? 'The allied squad solved it together and everyone gets paid.'
        : noWinner
          ? refunded ? 'Nobody cleared the room. The showdown stake was refunded.' : 'Nobody cleared the sequence before the round closed.'
          : iWon
            ? summary.wagerPot ? `You took the whole ${summary.wagerPot} Intel pot.` : 'You closed the round before anyone else could.'
            : `${summary.winnerName || 'Another operative'} claimed the round first.`;

    return {
      pending: false,
      title,
      tone,
      subtitle,
      correctAnswer: summary.correctAnswer,
      coinsEarned: summary.coinsEarned || 0,
      panicBonus: summary.panicBonus || 0,
      wagerPot: summary.wagerPot || 0,
      noWinner,
      refunded,
      gaveUp,
      showdownComplete: !!summary.showdownComplete,
    };
  }

  function applyResolvedSummary(summary, playerList = [], currentUserCoins = null) {
    clearInterval(timerRef.current);
    setAllRes(playerList);
    setResult(buildResolvedResult(summary));
    if (typeof currentUserCoins === 'number') {
      setDisplayCoins(currentUserCoins);
      update({ ...user, coins: currentUserCoins });
    }
  }

  async function startGame() {
    setLoading(true);
    setErr('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND}/room/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ roomId: room.id, hostId: user.id, xp: user?.xp || 0 }),
      });
      const data = await res.json();
      if (data.success) {
        if (typeof data.currentUserCoins === 'number') {
          setDisplayCoins(data.currentUserCoins);
          update({ ...user, coins: data.currentUserCoins });
        }
        applyRoundPayload(data.riddle);
      } else {
        setErr(data.error || 'Unable to start this room yet.');
      }
    } catch {
      setErr('Connection failed while starting the room.');
    }
    setLoading(false);
  }

  async function submitAns(answer) {
    if (selectedRef.current || resolvedView) return;
    clearInterval(timerRef.current);
    const finalAnswer = answer === '__timeout__'
      ? (usesTypedInput ? (typedRef.current.trim() || '__timeout__') : '__timeout__')
      : answer;
    setSelected(finalAnswer);
    selectedRef.current = finalAnswer;
    setErr('');

    try {
      const activeBudget = riddle?.timeLimit || 0;
      const elapsed = roomTimed ? Math.max(0, activeBudget - timeLeftRef.current) : 0;
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND}/room/answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ roomId: room.id, userId: user.id, userAnswer: finalAnswer, timeTaken: elapsed }),
      });
      const data = await res.json();
      if (!data.success) {
        selectedRef.current = null;
        setSelected(null);
        setErr(data.error || 'Answer could not be recorded.');
        return;
      }

      setAllRes(data.players || []);
      if (data.resolved) {
        applyResolvedSummary({
          correctAnswer: data.correctAnswer,
          coinsEarned: data.coinsEarned,
          panicBonus: data.panicBonus,
          wagerPot: data.wagerPot,
          winnerId: data.winnerId,
          winnerName: data.winnerName,
          noWinner: data.noWinner,
          refunded: data.refunded,
          teamWin: data.teamWin,
          showdownComplete: data.showdownComplete,
        }, data.players || [], data.newTotal);
        return;
      }

      setResult({
        pending: true,
        title: data.isCorrect ? 'RESPONSE LOCKED' : 'ANSWER LOGGED',
        tone: data.isCorrect ? Colors.emerald : Colors.gold,
        subtitle: engagement === 'coop'
          ? 'Waiting for the allied squad result...'
          : 'Waiting for the other operatives to finish the round...',
      });
      if (typeof data.newTotal === 'number') {
        setDisplayCoins(data.newTotal);
      }
    } catch {
      selectedRef.current = null;
      setSelected(null);
      setErr('Connection failed while recording your answer.');
    }
  }

  async function giveUp() {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND}/room/giveup`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ roomId: room.id, hostId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        applyResolvedSummary({
          gaveUp: true,
          correctAnswer: data.correctAnswer,
          refunded: data.refunded,
          showdownComplete: isWageredShowdown,
        }, players, displayCoins);
      }
    } catch {}
  }

  async function nextRiddle() {
    setLoading(true);
    setErr('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND}/room/next`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ roomId: room.id, hostId: user.id, xp: user?.xp || 0 }),
      });
      const data = await res.json();
      if (data.success) applyRoundPayload(data.riddle);
      else setErr(data.error || 'Next node could not be fetched.');
    } catch {
      setErr('Connection failed while fetching the next node.');
    }
    setLoading(false);
  }

  const topBarTone = livePanic ? Colors.rose : roomMode.accent;
  const timerLabel = isPanicMode ? 'PANIC MODE' : 'NO LIMIT';

  const lobbyStats = useMemo(() => ([
    ['STATUS', status.toUpperCase(), topBarTone],
    ['MODE', roomMode.label, roomMode.accent],
    ['TIMER', timerLabel, isPanicMode ? Colors.rose : Colors.textPrimary],
    ['FORMAT', engagementLabel, engagement === 'coop' ? Colors.emerald : Colors.rose],
  ]), [status, roomMode, timerLabel, engagementLabel, topBarTone, isPanicMode, engagement]);

  const TopBar = () => (
    <View style={{
      height: 70,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      backgroundColor: livePanic ? 'rgba(40,0,6,0.96)' : 'rgba(15,15,26,0.9)',
      borderBottomWidth: 1,
      borderColor: livePanic ? Colors.rose + '45' : Colors.borderDefault
    }}>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.bgBase, borderWidth: 1, borderColor: livePanic ? Colors.rose + '35' : Colors.borderDefault }}
        onPress={() => (exitToHome ? exitToHome() : go('home'))}
      >
        <Icons.ChevronLeftIcon size={12} color={livePanic ? Colors.rose : Colors.purpleLight} />
        <Text style={{ color: livePanic ? Colors.rose : Colors.purpleLight, fontFamily: mono, fontWeight: '800', fontSize: 13, letterSpacing: 1 }}>ABORT</Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: topBarTone, fontFamily: mono, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 }}>
          {livePanic ? 'PANIC BREACH LIVE' : roomMode.label}
        </Text>
        <Text style={{ color: Colors.textPrimary, fontFamily: display, fontSize: 16, fontWeight: '900', letterSpacing: 1.2 }}>
          ROOM {room.id}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.gold + '10', borderWidth: 1, borderColor: Colors.gold + '30' }}>
        <Icons.IntelIcon size={14} color={Colors.gold} />
        <Text style={{ color: Colors.gold, fontFamily: mono, fontWeight: '800', fontSize: 14 }}>{displayCoins ?? 0}</Text>
      </View>
    </View>
  );

  if (!riddle) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgBase }}>
        <TopBar />
        <View style={{ maxWidth: 560, alignSelf: 'center', width: '100%', padding: 28 }}>
          <View style={{ backgroundColor: 'rgba(15,15,26,0.65)', borderRadius: 16, alignItems: 'center', padding: 28, borderWidth: 1.5, borderColor: roomMode.accent + '45', marginBottom: 24 }}>
            <Text style={{ color: Colors.textSecondary, fontFamily: display, fontSize: 14, marginBottom: 10, letterSpacing: 1.2, textTransform: 'uppercase' }}>Secure Uplink Code</Text>
            <Text style={{ color: roomMode.accent, fontFamily: mono, fontSize: 42, fontWeight: '900', letterSpacing: 12 }}>{room.id}</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 12, lineHeight: 20, textAlign: 'center', marginTop: 12 }}>
              {roomMode.desc}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {lobbyStats.map(([label, value, accent]) => statCard(label, value, accent))}
          </View>

          {isPanicMode ? (
            <View style={{ backgroundColor: Colors.rose + '10', borderWidth: 1, borderColor: Colors.rose + '35', borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' }}>PANIC TIMER ENFORCED</Text>
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 6 }}>
                The admin timer arms for every operative the moment the host launches the round. Panic clears also pay bonus Intel.
              </Text>
            </View>
          ) : null}

          {isWageredShowdown ? (
            <View style={{ backgroundColor: Colors.gold + '10', borderWidth: 1, borderColor: Colors.gold + '35', borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <Text style={{ color: Colors.gold, fontFamily: mono, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' }}>SHOWDOWN STAKE ACTIVE</Text>
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 6 }}>
                Every operative must cover {showdownWager} Intel when the host launches the room. First operative to solve it takes the full pot.
              </Text>
            </View>
          ) : null}

          {err ? (
            <View style={{ backgroundColor: Colors.rose + '10', borderWidth: 1, borderColor: Colors.rose + '35', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>{err}</Text>
            </View>
          ) : null}

          {roundStartedWithoutPayload ? (
            <View style={{ backgroundColor: Colors.cyan + '08', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.cyan + '35', marginBottom: 14 }}>
              <Text style={{ color: Colors.cyan, fontFamily: display, fontWeight: '900', fontSize: 15, letterSpacing: 1.1, textAlign: 'center', marginBottom: 8 }}>ROUND IS LIVE</Text>
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
                Waiting for the current riddle payload to sync to this client.
              </Text>
            </View>
          ) : null}

          <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 12 }}>
            CONNECTED OPERATIVES ({players.length}/{maxPlayers})
          </Text>

          {players.map((player, index) => (
            <View key={`${player.user_id}_${index}`} style={{ backgroundColor: 'rgba(15,15,26,0.6)', borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderDefault }}>
              {player.user_id === roomData?.host_id ? <Icons.ShieldIcon size={20} color={Colors.gold} /> : <Icons.UserIcon size={20} color={Colors.cyan} />}
              <Text style={{ flex: 1, color: Colors.textPrimary, fontFamily: display, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 }}>
                {player.username}{player.user_id === user.id ? ' (You)' : ''}
              </Text>
              {player.user_id === roomData?.host_id ? (
                <View style={{ backgroundColor: Colors.gold + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ color: Colors.gold, fontFamily: mono, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>HOST</Text>
                </View>
              ) : null}
            </View>
          ))}

          {room.isHost ? (
            <TouchableOpacity
              style={{ backgroundColor: roomMode.accent, paddingVertical: 16, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 24, opacity: canStart ? 1 : 0.4 }}
              onPress={startGame}
              disabled={!canStart}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <>
                <Icons.TerminalIcon size={16} color="#fff" />
                <Text style={{ color: '#fff', fontFamily: display, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>
                  {players.length < 2 ? 'NEED 2 OPERATIVES' : 'INITIALIZE OPERATION'}
                </Text>
              </>}
            </TouchableOpacity>
          ) : (
            <Text style={{ color: Colors.textSecondary, fontFamily: mono, textAlign: 'center', marginTop: 28, fontSize: 13, letterSpacing: 1 }}>
              AWAITING HOST SYNCHRONIZATION...
            </Text>
          )}
        </View>
      </View>
    );
  }

  const activeTimerLimit = Math.max(1, riddle?.timeLimit || timeLeft || 1);

  return (
    <View style={{ flex: 1, backgroundColor: livePanic ? Colors.panicBg : Colors.bgBase }}>
      <TopBar />
      <ScrollView contentContainerStyle={{ maxWidth: 760, alignSelf: 'center', width: '100%', padding: 28, paddingBottom: 64 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {roomTimed && !resolvedView ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <View style={{ flex: 1, height: 5, backgroundColor: Colors.borderDefault, borderRadius: 4, overflow: 'hidden' }}>
              <View style={[{ width: `${(timeLeft / activeTimerLimit) * 100}%`, height: 5, borderRadius: 4 }, Platform.OS === 'web' && livePanic ? { backgroundImage: 'linear-gradient(to right, #5f0000, #ff2a2a)', boxShadow: '0 0 12px rgba(255,42,42,0.8)' } : { backgroundColor: livePanic || timeLeft < 10 ? Colors.rose : Colors.emerald }]} />
            </View>
            <Text style={{ color: livePanic || timeLeft < 10 ? Colors.rose : Colors.emerald, fontWeight: '900', fontSize: 24, fontFamily: mono, minWidth: 58, textAlign: 'right' }}>{timeLeft}s</Text>
          </View>
        ) : null}

        {livePanic ? (
          <View style={{ backgroundColor: Colors.rose + '12', borderColor: Colors.rose + '45', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 12, fontWeight: '900', letterSpacing: 1.3, textAlign: 'center' }}>CRITICAL BREACH ACTIVE</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 }}>
              Same operation, admin timer armed, bonus Intel on successful clears.
            </Text>
          </View>
        ) : null}

        {isWageredShowdown && !resolvedView ? (
          <View style={{ backgroundColor: Colors.gold + '10', borderColor: Colors.gold + '35', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <Text style={{ color: Colors.gold, fontFamily: mono, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' }}>ACTIVE SHOWDOWN POT</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 }}>
              Stake per operative: {showdownWager} Intel. First correct operative claims the full pot.
            </Text>
          </View>
        ) : null}

        {err ? (
          <View style={{ backgroundColor: Colors.rose + '10', borderWidth: 1, borderColor: Colors.rose + '35', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <Text style={{ color: Colors.rose, fontFamily: mono, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>{err}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {players.map((player, index) => {
            const row = allRes.find((entry) => entry.user_id === player.user_id) || player;
            return (
              <View key={`${player.user_id}_${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(15,15,26,0.5)', borderWidth: 1, borderColor: Colors.borderDefault }}>
                {player.user_id === roomData?.host_id ? <Icons.ShieldIcon size={12} color={Colors.gold} /> : <Icons.UserIcon size={12} color={Colors.cyan} />}
                <Text style={{ color: Colors.textPrimary, fontFamily: mono, fontSize: 12, fontWeight: '700' }}>{player.username}</Text>
                {row?.answered ? (row?.is_correct ? <Icons.TargetIcon size={14} color={Colors.emerald} /> : <Icons.XIcon size={14} color={Colors.rose} />) : <Icons.TimerIcon size={14} color={Colors.textMuted} />}
              </View>
            );
          })}
        </View>

        <View style={{ backgroundColor: livePanic ? 'rgba(50,0,8,0.75)' : 'rgba(15,15,26,0.6)', borderRadius: 16, padding: 28, borderWidth: 1.5, borderColor: livePanic ? Colors.rose + '55' : roomMode.accent + '35', marginBottom: 20 }}>
          <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 }}>
            {engagementLabel} // {roomMode.label}
          </Text>
          <RiddleContent riddle={riddle} accent={roomMode.accent} questionStyle={{ fontSize: 28, lineHeight: 38 }} />
        </View>

        {!usesTypedInput ? riddle.options?.map((option, index) => {
          const right = resolvedView && option === result?.correctAnswer;
          const wrong = resolvedView && option === selected && !result?.coinsEarned && !result?.teamWin;
          const picked = !resolvedView && selected === option;
          return (
            <TouchableOpacity
              key={`${option}_${index}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 12, marginBottom: 10, backgroundColor: right ? Colors.emerald + '15' : wrong ? Colors.rose + '15' : 'rgba(15,15,26,0.6)', borderWidth: 1.5, borderColor: right ? Colors.emerald + '60' : wrong ? Colors.rose + '60' : picked ? roomMode.accent + '55' : Colors.borderDefault }}
              onPress={() => !resolvedView && !selected && submitAns(option)}
              disabled={resolvedView || !!selected}
              activeOpacity={0.7}
            >
              <View style={{ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: right ? Colors.emerald : wrong ? Colors.rose : Colors.bgBase, borderWidth: 1, borderColor: right ? Colors.emerald : wrong ? Colors.rose : Colors.borderDefault }}>
                <Text style={{ color: right || wrong ? '#000' : Colors.textSecondary, fontFamily: mono, fontWeight: '900', fontSize: 16 }}>{['A', 'B', 'C', 'D'][index] || '?'}</Text>
              </View>
              <Text style={{ flex: 1, color: right ? Colors.emerald : wrong ? '#fca5a5' : Colors.textPrimary, fontFamily: display, fontSize: 17, fontWeight: '700', letterSpacing: 0.4 }}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        }) : !resolvedView ? (
          <View style={{ gap: 16 }}>
            <TextInput
              style={{ backgroundColor: 'rgba(15,15,26,0.6)', borderWidth: 1.5, borderColor: Colors.borderDefault, borderRadius: 12, padding: 20, color: Colors.textPrimary, fontFamily: mono, fontSize: 16, minHeight: 110, textAlignVertical: 'top' }}
              placeholder="Transmit your answer..."
              placeholderTextColor={Colors.textMuted}
              value={typed}
              onChangeText={(value) => { setTyped(value); typedRef.current = value; }}
              multiline
            />
            <TouchableOpacity style={{ backgroundColor: roomMode.accent, paddingVertical: 18, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, opacity: !typed.trim() ? 0.4 : 1 }} onPress={() => typed.trim() && submitAns(typed.trim())} disabled={!typed.trim()}>
              <Icons.TerminalIcon size={16} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: display, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>TRANSMIT RESPONSE</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {result?.pending ? (
          <View style={{ backgroundColor: 'rgba(15,15,26,0.8)', borderRadius: 18, padding: 28, borderWidth: 1.5, borderColor: result.tone + '50', alignItems: 'center', marginTop: 18 }}>
            <Icons.TimerIcon size={38} color={result.tone} />
            <Text style={{ color: result.tone, fontFamily: display, fontSize: 24, fontWeight: '900', marginTop: 12, letterSpacing: 1.4 }}>{result.title}</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 }}>{result.subtitle}</Text>
          </View>
        ) : null}

        {resolvedView ? (
          <View style={{ backgroundColor: 'rgba(15,15,26,0.85)', borderRadius: 18, padding: 32, borderWidth: 2, borderColor: result.tone + '55', alignItems: 'center', marginTop: 18 }}>
            {result.gaveUp ? <Icons.AlertTriangleIcon size={46} color={result.tone} /> : result.noWinner ? <Icons.TimerIcon size={46} color={result.tone} /> : <Icons.TargetIcon size={46} color={result.tone} />}
            <Text style={{ color: result.tone, fontFamily: display, fontSize: 28, fontWeight: '900', marginTop: 16, letterSpacing: 1.6, textTransform: 'uppercase', textAlign: 'center' }}>{result.title}</Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 }}>{result.subtitle}</Text>

            <View style={{ marginTop: 24, padding: 20, borderRadius: 12, backgroundColor: 'rgba(15,15,26,0.6)', borderWidth: 1, borderColor: Colors.borderDefault, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: Colors.textMuted, fontFamily: mono, fontSize: 11, marginBottom: 8, letterSpacing: 1.5, fontWeight: '700' }}>CORRECT SOLUTION</Text>
              <Text style={{ color: result.tone, fontFamily: display, fontSize: 24, fontWeight: '900', textAlign: 'center' }}>{result.correctAnswer}</Text>
            </View>

            {(result.coinsEarned > 0 || result.wagerPot > 0 || result.panicBonus > 0) ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginTop: 18 }}>
                {statCard('INTEL', `+${result.coinsEarned}`, Colors.gold)}
                {result.panicBonus > 0 ? statCard('PANIC BONUS', `+${result.panicBonus}`, Colors.rose) : null}
                {result.wagerPot > 0 ? statCard('POT', `+${result.wagerPot}`, Colors.gold) : null}
              </View>
            ) : null}

            <Text style={{ color: Colors.textSecondary, fontFamily: mono, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginTop: 24, marginBottom: 12 }}>ROUND LOGS</Text>
            {[...allRes].sort((a, b) => (b.coins_earned || 0) - (a.coins_earned || 0)).map((player, index) => (
              <View key={`${player.user_id}_${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: 'rgba(15,15,26,0.5)', borderRadius: 10, marginBottom: 8, width: '100%', borderWidth: 1, borderColor: Colors.borderDefault }}>
                <Text style={{ fontFamily: mono, fontSize: 14, width: 30, textAlign: 'center', color: index === 0 ? Colors.gold : Colors.textSecondary, fontWeight: '900' }}>#{index + 1}</Text>
                <Text style={{ flex: 1, color: Colors.textPrimary, fontFamily: display, fontSize: 16, fontWeight: '700', letterSpacing: 0.4 }}>{player.username}</Text>
                {player.is_correct ? <Icons.TargetIcon size={16} color={Colors.emerald} /> : <Icons.XIcon size={16} color={Colors.rose} />}
                <Text style={{ color: player.coins_earned > 0 ? Colors.gold : Colors.textMuted, fontFamily: mono, fontWeight: '800', fontSize: 13 }}>
                  {player.coins_earned > 0 ? `+${player.coins_earned}` : '—'}
                </Text>
              </View>
            ))}

            {canContinue ? (
              <TouchableOpacity style={{ backgroundColor: roomMode.accent, paddingVertical: 18, borderRadius: 10, alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 28, opacity: loading ? 0.5 : 1 }} onPress={nextRiddle} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <>
                  <Icons.DatabaseIcon size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontFamily: display, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>FETCH NEXT NODE</Text>
                </>}
              </TouchableOpacity>
            ) : result.showdownComplete ? (
              <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.04)', paddingVertical: 18, borderRadius: 10, alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 28, borderWidth: 1, borderColor: Colors.borderDefault }} onPress={() => (exitToHome ? exitToHome() : go('home'))}>
                <Icons.ChevronLeftIcon size={14} color={Colors.textSecondary} />
                <Text style={{ color: Colors.textPrimary, fontFamily: display, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 }}>
                  RETURN TO HUB
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: Colors.textSecondary, fontFamily: mono, textAlign: 'center', marginTop: 24, fontSize: 13, letterSpacing: 1 }}>
                AWAITING HOST COMMAND...
              </Text>
            )}
          </View>
        ) : null}

        {room.isHost && riddle && !resolvedView ? (
          <TouchableOpacity style={{ marginTop: 24, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.rose + '35', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: Colors.rose + '08' }} onPress={giveUp}>
            <Icons.AlertTriangleIcon size={14} color={Colors.rose} />
            <Text style={{ color: Colors.rose, fontFamily: mono, fontWeight: '800', fontSize: 13, letterSpacing: 1 }}>SYSTEM ABORT</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}
