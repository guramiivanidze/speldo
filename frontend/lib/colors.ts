import { GemColor, TokenColor } from '@/types/game';

export const GEM_COLORS: GemColor[] = ['white', 'blue', 'green', 'red', 'black'];

// Token chip background gradients (inline style)
export const TOKEN_GRADIENT: Record<TokenColor, string> = {
  white: 'linear-gradient(145deg, #f1f5f9, #cbd5e1)',
  blue:  'linear-gradient(145deg, #3b82f6, #1d4ed8)',
  green: 'linear-gradient(145deg, #10b981, #065f46)',
  red:   'linear-gradient(145deg, #ef4444, #991b1b)',
  black: 'linear-gradient(145deg, #475569, #1e293b)',
  gold:  'linear-gradient(145deg, #fde047, #d97706)',
};

export const TOKEN_TEXT: Record<TokenColor, string> = {
  white: 'text-slate-700',
  blue:  'text-white',
  green: 'text-white',
  red:   'text-white',
  black: 'text-slate-200',
  gold:  'text-amber-900',
};

export const TOKEN_LABEL: Record<TokenColor, string> = {
  white: 'Diamond',
  blue:  'Sapphire',
  green: 'Emerald',
  red:   'Ruby',
  black: 'Onyx',
  gold:  'Gold',
};

export const TOKEN_SYMBOL: Record<TokenColor, string> = {
  white: '◆',
  blue:  '◆',
  green: '◆',
  red:   '◆',
  black: '◆',
  gold:  '★',
};

// Card gradient backgrounds (inline style)
export const CARD_GRADIENT: Record<GemColor, string> = {
  white: 'linear-gradient(160deg, #e2e8f0 0%, #94a3b8 100%)',
  blue:  'linear-gradient(160deg, #1e3a8a 0%, #0f172a 100%)',
  green: 'linear-gradient(160deg, #065f46 0%, #022c22 100%)',
  red:   'linear-gradient(160deg, #7f1d1d 0%, #1c0a0a 100%)',
  black: 'linear-gradient(160deg, #374151 0%, #0f172a 100%)',
};

// Card text color based on background brightness
export const CARD_TEXT: Record<GemColor, string> = {
  white: 'text-slate-800',
  blue:  'text-slate-100',
  green: 'text-slate-100',
  red:   'text-slate-100',
  black: 'text-slate-100',
};

// Gem orb background (for card center gem)
export const GEM_GRADIENT: Record<GemColor, string> = {
  white: 'linear-gradient(135deg, #f8fafc, #94a3b8)',
  blue:  'linear-gradient(135deg, #60a5fa, #1e40af)',
  green: 'linear-gradient(135deg, #34d399, #065f46)',
  red:   'linear-gradient(135deg, #f87171, #7f1d1d)',
  black: 'linear-gradient(135deg, #6b7280, #111827)',
};

// Cost gem pill colors (Tailwind classes for small cost chips)
export const COST_CHIP: Record<GemColor, string> = {
  white: 'bg-slate-200 text-slate-700 border border-slate-300',
  blue:  'bg-blue-600 text-white border border-blue-400',
  green: 'bg-emerald-600 text-white border border-emerald-400',
  red:   'bg-red-600 text-white border border-red-400',
  black: 'bg-slate-700 text-slate-200 border border-slate-500',
};

// Level badge colors
export const LEVEL_COLOR: Record<1|2|3, string> = {
  1: 'bg-emerald-400',
  2: 'bg-yellow-400',
  3: 'bg-red-400',
};

// Small gem dot for bonus display
export const GEM_DOT_STYLE: Record<GemColor, string> = {
  white: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
  blue:  'linear-gradient(135deg, #60a5fa, #1d4ed8)',
  green: 'linear-gradient(135deg, #34d399, #065f46)',
  red:   'linear-gradient(135deg, #f87171, #991b1b)',
  black: 'linear-gradient(135deg, #6b7280, #1e293b)',
};
