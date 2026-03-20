/**
 * CRACKL v5 — Panic Mode Cinematic Orchestrator
 *
 * 3-second sequence: BWAAAAM thud, haptic, screen shake, chromatic sweep,
 * red vignette, hazard borders, heartbeat pulse. Red smoke handled by ParticleField.
 */
import React, { useEffect, useRef } from 'react';
import { Platform, Vibration } from 'react-native';

function playBwamSound() {
  if (Platform.OS !== 'web' || !window.AudioContext) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // Low-frequency "BWAAAAM" thud (Inception-style)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.2);
    osc.frequency.exponentialRampToValueAtTime(18, now + 0.5);

    filter.type = 'lowpass';
    filter.frequency.value = 120;

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (_) {}
}

function triggerHaptic() {
  if (Platform.OS === 'web' && navigator.vibrate) {
    navigator.vibrate([0, 80, 40, 80, 40, 120]);
  } else if (Platform.OS !== 'web') {
    Vibration.vibrate([0, 80, 40, 80, 40, 120]);
  }
}

export function runPanicActivationSequence(onComplete) {
  if (Platform.OS !== 'web') {
    triggerHaptic();
    playBwamSound();
    onComplete();
    return;
  }

  // 1. Immediate: sound + haptic
  triggerHaptic();
  playBwamSound();

  // 2. Lock UI, add shake class (on html so whole page shakes)
  document.documentElement.classList.add('panic-activating');
  document.body.classList.add('panic-activating');

  // 3. Chromatic aberration flash
  const flash = document.createElement('div');
  flash.className = 'chromatic-flash-overlay';
  flash.style.cssText = `
    position: fixed; inset: 0; z-index: 99998; pointer-events: none;
    background: linear-gradient(90deg,
      rgba(255,0,0,0.12) 0%, transparent 30%,
      transparent 70%, rgba(0,200,255,0.08) 100%);
    animation: chromaticSweepOverlay 350ms ease-out forwards;
  `;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes chromaticSweepOverlay {
      0% { opacity: 0; }
      20% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(flash);
  setTimeout(() => {
    flash.remove();
    style.remove();
  }, 400);

  // 4. Remove shake, apply full panic state after sequence
  setTimeout(() => {
    document.body.classList.remove('panic-activating');
    document.documentElement.classList.remove('panic-activating');
    document.documentElement.classList.add('panic-active');

    // Ensure panic vignette overlay exists
    let vignette = document.getElementById('panic-vignette');
    if (!vignette) {
      vignette = document.createElement('div');
      vignette.id = 'panic-vignette';
      vignette.className = 'panic-vignette-overlay';
      document.body.appendChild(vignette);
    }

    onComplete();
  }, 2800);
}

export function runPanicDeactivation() {
  if (Platform.OS !== 'web') return;
  document.documentElement.classList.remove('panic-active');
  document.body.classList.remove('panic-activating');
  document.documentElement.classList.remove('panic-activating');
  const v = document.getElementById('panic-vignette');
  if (v) v.remove();
}

/**
 * Syncs DOM panic state with React panicMode.
 * Call from HomeShell when panicMode changes.
 */
export function usePanicSync(panicMode) {
  const prevRef = useRef(null);
  const isFirst = prevRef.current === null;
  prevRef.current = panicMode;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Sync on mount (e.g. returning to home with panic on) and when panicMode changes
    if (panicMode) {
      document.documentElement.classList.add('panic-active');
      let vignette = document.getElementById('panic-vignette');
      if (!vignette) {
        vignette = document.createElement('div');
        vignette.id = 'panic-vignette';
        vignette.className = 'panic-vignette-overlay';
        document.body.appendChild(vignette);
      }
    } else {
      runPanicDeactivation();
    }
  }, [panicMode]);
  return null;
}

export default { runPanicActivationSequence, runPanicDeactivation, usePanicSync };
