/**
 * CRACKL v5 — Atmospheric Effects
 * 
 * Glow orbs, smoke wisps, vignette, emergency bar.
 * All purely decorative, pointer-events: none.
 */
import React from 'react';
import { View, Platform, Animated } from 'react-native';
import Colors from '../theme/colors';

/* ─── GLOW ORB ─── */
export function GlowOrb({ color = '#7C3AED', size = 400, top, left, right, bottom, opacity = 0.08 }) {
  if (Platform.OS !== 'web') return null;
  return (
    <div
      className="glow-orb"
      style={{
        width: size, height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        top, left, right, bottom, opacity,
      }}
    />
  );
}

/* ─── SMOKE WISP (CSS animated) ─── */
export function SmokeWisp({ color = 'rgba(255,0,0,0.04)', index = 0 }) {
  if (Platform.OS !== 'web') return null;
  const delay = index * 1.2;
  const left = `${15 + index * 14}%`;
  const size = 100 + index * 30;
  return (
    <div style={{
      position: 'fixed', bottom: 0, left,
      width: size, height: size, borderRadius: '50%',
      background: color,
      pointerEvents: 'none', zIndex: 2,
      animation: `smokeRise ${5 + index}s ease-in-out ${delay}s infinite`,
    }} />
  );
}

/* ─── VIGNETTE ─── */
export function Vignette() {
  if (Platform.OS !== 'web') return null;
  return <div className="vignette" />;
}

/* ─── EMERGENCY BAR ─── */
export function EmergencyBar() {
  if (Platform.OS !== 'web') return null;
  return <div className="emergency-bar" />;
}

/* ─── TACTICAL GRID ─── */
export function TacticalGrid({ panicMode = false }) {
  if (Platform.OS !== 'web') return null;
  const lineColor = panicMode ? 'rgba(255,60,60,0.08)' : 'rgba(124,58,237,0.012)';
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: `
        repeating-linear-gradient(0deg,
          ${lineColor} 0px, transparent 1px,
          transparent 60px, ${lineColor} 61px),
        repeating-linear-gradient(90deg,
          ${lineColor} 0px, transparent 1px,
          transparent 60px, ${lineColor} 61px)`,
    }} />
  );
}

/* ─── FILM GRAIN OVERLAY (for specific cards) ─── */
export function FilmGrainOverlay() {
  if (Platform.OS !== 'web') return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: 'inherit',
      zIndex: 1, pointerEvents: 'none', opacity: 0.03,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundSize: '128px 128px',
    }} />
  );
}

export default {
  GlowOrb, SmokeWisp, Vignette, EmergencyBar, TacticalGrid, FilmGrainOverlay,
};
