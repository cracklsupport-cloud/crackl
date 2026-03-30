/**
 * CRACKL Design System — Color Palette
 * Philosophy: "Competitive intelligence — sharp, dark, alive"
 */

const Colors = {
  // ─── Backgrounds ───
  bgBase:       '#09090B',   // zinc-950 — near black, not pure black
  cardSurface:  '#111115',   // just above base
  cardSurface2: '#18181C',   // elevated surface
  borderDefault:'rgba(255,255,255,0.07)',  // near-invisible — minimal dark

  // ─── Brand Accents ───
  purple:       '#8B5CF6',   // violet-500 — slightly brighter for minimal
  purpleLight:  '#C4B5FD',   // violet-300
  purpleBg:     'rgba(139,92,246,0.10)',

  // ─── Mode Accents ───
  cyan:         '#22D3EE',
  cyanLight:    '#67E8F9',
  cyanBg:       'rgba(34,211,238,0.10)',

  gold:         '#F59E0B',
  goldLight:    '#FCD34D',
  goldBg:       'rgba(245,158,11,0.10)',

  emerald:      '#10B981',
  emeraldBg:    'rgba(16,185,129,0.10)',

  rose:         '#F43F5E',
  roseBg:       'rgba(244,63,94,0.10)',

  fuchsia:      '#D946EF',
  fuchsiaBg:    'rgba(217,70,239,0.10)',

  orange:       '#F97316',
  orangeBg:     'rgba(249,115,22,0.10)',

  indigo:       '#6366F1',
  indigoBg:     'rgba(99,102,241,0.10)',

  amber:        '#F59E0B',
  amberBg:      'rgba(245,158,11,0.10)',

  // ─── Text ───
  textPrimary:  '#FAFAFA',   // zinc-50
  textSecondary:'#A1A1AA',   // zinc-400
  textMuted:    '#52525B',   // zinc-600

  // ─── Panic Mode ───
  panicRed:     '#FF0000',
  panicDark:    '#1A0000',
  panicBg:      '#0D0000',
  smokeRed:     'rgba(255,0,0,0.15)',
  emergencyGlow:'#FF3333',

  // ─── Utility ───
  white:        '#FFFFFF',
  black:        '#000000',
  transparent:  'transparent',

  // ─── Glass ───
  glassBg:      'rgba(255,255,255,0.03)',
  glassBorder:  'rgba(255,255,255,0.07)',
};

// Subtle glows — used sparingly, one per screen
Colors.glow = {
  purple: { shadowColor: '#8B5CF6', shadowOffset:{width:0,height:0}, shadowOpacity:0.25, shadowRadius:24, elevation:6 },
  cyan:   { shadowColor: '#22D3EE', shadowOffset:{width:0,height:0}, shadowOpacity:0.25, shadowRadius:24, elevation:6 },
  gold:   { shadowColor: '#F59E0B', shadowOffset:{width:0,height:0}, shadowOpacity:0.20, shadowRadius:16, elevation:5 },
  red:    { shadowColor: '#F43F5E', shadowOffset:{width:0,height:0}, shadowOpacity:0.35, shadowRadius:32, elevation:8 },
  indigo: { shadowColor: '#6366F1', shadowOffset:{width:0,height:0}, shadowOpacity:0.20, shadowRadius:16, elevation:5 },
  fuchsia:{ shadowColor: '#D946EF', shadowOffset:{width:0,height:0}, shadowOpacity:0.20, shadowRadius:16, elevation:5 },
  orange: { shadowColor: '#F97316', shadowOffset:{width:0,height:0}, shadowOpacity:0.20, shadowRadius:16, elevation:5 },
};

export default Colors;
