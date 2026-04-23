import type { CreativePhase } from '@/shared/types';

export interface PhaseColor {
  accent: string;
  accentRgb: string;
  bg: string;
  border: string;
}

export const PHASE_COLORS: Record<CreativePhase, PhaseColor> = {
  explore:   { accent: '#6B9EF7', accentRgb: '107,158,247', bg: 'rgba(107,158,247,0.12)', border: 'rgba(107,158,247,0.4)' },
  structure: { accent: '#5CC98B', accentRgb: '92,201,139',  bg: 'rgba(92,201,139,0.12)',  border: 'rgba(92,201,139,0.4)'  },
  write:     { accent: '#F0A05A', accentRgb: '240,160,90',  bg: 'rgba(240,160,90,0.12)',  border: 'rgba(240,160,90,0.4)'  },
  revise:    { accent: '#A78BFA', accentRgb: '167,139,250', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.4)' },
};
