/**
 * CRACKL Design System — Typography
 */

const Typography = {
  // Display / Logo
  display: {
    fontWeight: '900',
    letterSpacing: 8,
    textTransform: 'uppercase',
  },
  // Headings
  heading: {
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  // Riddle Text — serif italic feel
  riddle: {
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 34,
  },
  // Body
  body: {
    fontWeight: '500',
    fontSize: 14,
  },
  // Labels / Tags
  label: {
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  // Monospace for ciphers / codes
  mono: {
    fontFamily: 'monospace',
    letterSpacing: 6,
  },

  // Preset sizes
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    display: 34,
    hero: 48,
  },
};

export default Typography;
