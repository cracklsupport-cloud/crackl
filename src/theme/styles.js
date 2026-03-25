/**
 * CRACKL Design System — Shared Styles
 * Glass morphism, glow cards, buttons, layout rules
 */
import { StyleSheet, Platform } from 'react-native';
import Colors from './colors';

const SharedStyles = StyleSheet.create({
  // ─── Layouts ───
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  // ─── Screen Container ───
  screen: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 34,
  },
  scrollContent: {
    paddingBottom: 80,
  },

  // ─── Glass Morphism Card ───
  glassCard: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 24,
    padding: 18,
    ...Colors.glow.purple,
    shadowOpacity: 0.08,
  },

  // ─── Surface Cards ───
  surfaceCard: {
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: 22,
    padding: 18,
  },
  surfaceCard2: {
    backgroundColor: Colors.cardSurface2,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: 22,
    padding: 18,
  },

  // ─── Buttons ───
  btnPrimary: {
    backgroundColor: Colors.purple,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Colors.glow.purple,
  },
  btnPrimaryText: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 1,
  },

  // ─── Inputs ───
  input: {
    backgroundColor: Colors.cardSurface,
    borderWidth: 1.5,
    borderColor: Colors.borderDefault,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputFocus: {
    borderColor: Colors.purple,
    ...Colors.glow.purple,
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },

  // ─── Tag Pills ───
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  tagPillText: {
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // ─── Section Title ───
  sectionLabel: {
    color: Colors.textMuted,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 14,
    marginTop: 20,
  },

  // ─── Text Presets ───
  textPrimary: { color: Colors.textPrimary },
  textSecondary: { color: Colors.textSecondary },
  textMuted: { color: Colors.textMuted },

  // ─── Divider ───
  divider: {
    height: 1,
    backgroundColor: Colors.borderDefault,
    marginVertical: 16,
  },
});

export default SharedStyles;
