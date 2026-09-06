// ============================================================
//  Cabine En Ligne — Design System
//  Palette + espacements + ombres + helpers
// ============================================================

export const colors = {
  primary: '#7B1FA2',
  primaryDark: '#5E1488',
  primaryDeep: '#4A0E66',
  primaryLight: '#9C27B0',
  primarySoft: '#F3E7F7',
  primarySoft2: '#EBDCFF',

  bg: '#F3F0F7',
  card: '#FFFFFF',

  text: '#241B35',
  textSoft: '#4A4358',
  muted: '#8B87A0',
  muted2: '#B6B2C4',

  border: '#ECE7F2',

  success: '#21A35B',
  successBg: '#E7F6EC',
  warn: '#F5A623',
  warnBg: '#FDF3E3',
  danger: '#E23B4E',
  dangerBg: '#FBE9EB',

  white: '#FFFFFF',
  black: '#0A0A0A',

  wave: '#012B5B',      // Wave deep navy
  waveAccent: '#00C6FF',// Wave cyan accent

  green: '#27AE60',
  gray: '#E9E6EF',
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const font = {
  h1: 26,
  h2: 22,
  h3: 18,
  body: 15,
  sm: 13,
  xs: 11,
};

export const shadow = {
  card: {
    shadowColor: '#5E1488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
};

// French formatting for XOF amounts  ->  "15 000 XOF"
export const xof = (n) =>
  `${Number(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF`;
