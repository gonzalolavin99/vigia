// Colores de la app. La esfera usa uno por estado para que se entienda de lejos qué está haciendo Vigía.
export const colors = {
  bg: '#0b1120',
  card: '#151e32',
  cardBorder: '#1f2a44',
  text: '#f1f5f9',
  muted: '#94a3b8',
  faint: '#64748b',
  accent: '#2dd4bf',
  danger: '#f87171',
  dangerBg: '#7f1d1d',
};

export type OrbMode = 'off' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'ringing';

export const orbColors: Record<OrbMode, string> = {
  off: '#475569',
  idle: '#2dd4bf',
  listening: '#38bdf8',
  thinking: '#a78bfa',
  speaking: '#34d399',
  ringing: '#f87171',
};

export const orbLabels: Record<OrbMode, string> = {
  off: 'Escucha detenida',
  idle: 'Di «Alfred»',
  listening: 'Te escucho…',
  thinking: 'Pensando…',
  speaking: 'Respondiendo',
  ringing: 'Sonando · di «para»',
};
