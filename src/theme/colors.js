/**
 * CRACKL Design System — Color Palette
 * Philosophy: "Inside a secret intelligence agency at 2AM"
 */

const Colors = {
  // ─── Backgrounds ───
  bgBase:       '#07070F',
  cardSurface:  '#0F0F1A',
  cardSurface2: '#13131F',
  borderDefault:'#1E1E35',

  // ─── Brand Accents ───
  purple:       '#7C3AED',
  purpleLight:  '#A78BFA',
  purpleBg:     'rgba(124,58,237,0.15)',

  // ─── Mode Accents ───
  cyan:         '#22D3EE',
  cyanLight:    '#67E8F9',
  cyanBg:       'rgba(34,211,238,0.15)',

  gold:         '#F59E0B',
  goldLight:    '#FCD34D',
  goldBg:       'rgba(245,158,11,0.15)',

  emerald:      '#10B981',
  emeraldBg:    'rgba(16,185,129,0.15)',

  rose:         '#EF4444',
  roseBg:       'rgba(239,68,68,0.15)',

  fuchsia:      '#D946EF',
  fuchsiaBg:    'rgba(217,70,239,0.15)',

  orange:       '#F97316',
  orangeBg:     'rgba(249,115,22,0.15)',

  indigo:       '#6366F1',
  indigoBg:     'rgba(99,102,241,0.15)',

  amber:        '#F59E0B',
  amberBg:      'rgba(245,158,11,0.15)',

  // ─── Text ───
  textPrimary:  '#F8FAFC',
  textSecondary:'#94A3B8',
  textMuted:    '#475569',

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
  glassBorder:  'rgba(255,255,255,0.08)',
};

// Glow presets for shadowColor usage
Colors.glow = {
  purple: { shadowColor: '#7C3AED', shadowOffset:{width:0,height:0}, shadowOpacity:0.4, shadowRadius:30, elevation:8 },
  cyan:   { shadowColor: '#22D3EE', shadowOffset:{width:0,height:0}, shadowOpacity:0.4, shadowRadius:30, elevation:8 },
  gold:   { shadowColor: '#F59E0B', shadowOffset:{width:0,height:0}, shadowOpacity:0.3, shadowRadius:20, elevation:6 },
  red:    { shadowColor: '#EF4444', shadowOffset:{width:0,height:0}, shadowOpacity:0.5, shadowRadius:40, elevation:10 },
  indigo: { shadowColor: '#6366F1', shadowOffset:{width:0,height:0}, shadowOpacity:0.3, shadowRadius:20, elevation:6 },
  fuchsia:{ shadowColor: '#D946EF', shadowOffset:{width:0,height:0}, shadowOpacity:0.3, shadowRadius:20, elevation:6 },
  orange: { shadowColor: '#F97316', shadowOffset:{width:0,height:0}, shadowOpacity:0.3, shadowRadius:20, elevation:6 },
};

export default Colors;
