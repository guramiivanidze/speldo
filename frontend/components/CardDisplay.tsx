'use client';

import { Card, GemColor } from '@/types/game';
import {
  CARD_GRADIENT, CARD_TEXT, GEM_GRADIENT, COST_CHIP,
  GEM_COLORS, LEVEL_COLOR, TOKEN_LABEL,
} from '@/lib/colors';

interface CardDisplayProps {
  card: Card;
  onBuy?: () => void;
  onReserve?: () => void;
  canBuy?: boolean;
  canReserve?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };

// Real gem images for card backgrounds
const GEM_IMAGES: Record<string, string> = {
  white: 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&w=400', // Diamond/crystal
  blue: 'https://images.pexels.com/photos/1458867/pexels-photo-1458867.jpeg?auto=compress&w=400', // Blue gem
  green: 'https://images.pexels.com/photos/1573236/pexels-photo-1573236.jpeg?auto=compress&w=400', // Green gem
  red: 'https://images.pexels.com/photos/4040567/pexels-photo-4040567.jpeg?auto=compress&w=400', // Red crystal
  black: 'https://images.pexels.com/photos/2166456/pexels-photo-2166456.jpeg?auto=compress&w=400', // Black stone
};

export default function CardDisplay({
  card,
  onBuy,
  onReserve,
  canBuy = false,
  canReserve = false,
  showActions = false,
  compact = false,
}: CardDisplayProps) {
  const textCls = CARD_TEXT[card.bonus];
  const costColors = GEM_COLORS.filter((color) => card.cost[color as GemColor]);

  return (
    <div
      className={`
        dev-card group relative rounded-xl overflow-hidden
        h-full w-full
        ${canBuy ? 'afford-glow' : ''}
        cursor-default shadow-lg
      `}
      style={{ background: CARD_GRADIENT[card.bonus] }}
    >
      {/* Background gem image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${GEM_IMAGES[card.bonus]})` }}
      />

      {/* Gradient overlay for readability */}
      <div
        className="absolute inset-0"
        style={{ background: `${CARD_GRADIENT[card.bonus]}`, opacity: 0.7 }}
      />

      {/* Main content - horizontal layout */}
      <div className="h-full flex relative z-10">

        {/* Left section - Level + Gem */}
        <div className="flex flex-col items-center justify-between py-2 px-2 w-1/3">
          {/* Level badge */}
          <div className={`
            text-[9px] font-black tracking-wider leading-none
            px-1.5 py-0.5 rounded-full text-slate-900
            ${LEVEL_COLOR[card.level as 1 | 2 | 3]}
          `}>
            {ROMAN[card.level]}
          </div>

          {/* Gem orb */}
          <div
            className="gem-orb shrink-0"
            style={{
              width: compact ? 28 : 40,
              height: compact ? 28 : 40,
              background: GEM_GRADIENT[card.bonus],
            }}
          />

          {/* Gem label */}
          <span className={`text-[7px] font-semibold uppercase tracking-wide opacity-60 ${textCls}`}>
            {TOKEN_LABEL[card.bonus]}
          </span>
        </div>

        {/* Right section - Points + Cost */}
        <div className="flex-1 flex flex-col justify-between py-2 pr-2">
          {/* Points (top right) - Golden circle badge */}
          <div className="flex justify-end">
            {card.points > 0 ? (
              <div 
                className="w-7 h-7 rounded-full flex items-center justify-center
                           font-black text-sm text-amber-900 drop-shadow-lg
                           border-2 border-amber-300 shadow-inner"
                style={{
                  background: 'linear-gradient(135deg, #fde047 0%, #fbbf24 50%, #f59e0b 100%)',
                }}
              >
                {card.points}
              </div>
            ) : <div className="w-7 h-7" />}
          </div>

          {/* Cost circles (bottom right) */}
          <div className="flex flex-wrap gap-1 justify-end">
            {costColors.map((color) => {
              const c = card.cost[color as GemColor];
              if (!c) return null;
              return (
                <div
                  key={color}
                  className={`w-5 h-5 rounded-full flex items-center justify-center
                             text-[10px] font-bold shadow-sm border border-white/30
                             ${COST_CHIP[color as GemColor]}`}
                >
                  {c}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Hover action overlay ─────────────────── */}
      {showActions && (
        <div className="
          absolute inset-0 flex flex-col items-center justify-center gap-1.5
          bg-black/55 backdrop-blur-[3px] rounded-xl
          opacity-0 hover:opacity-100 transition-opacity duration-150
          z-20
        ">
          {onBuy && (
            <button
              className={`
                px-4 py-1 rounded-lg text-[10px] font-bold shadow-lg tracking-wide
                transition-all active:scale-95
                ${canBuy
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'}
              `}
              onClick={(e) => {
                e.stopPropagation();
                if (canBuy) onBuy();
              }}
            >
              Buy
            </button>
          )}
          {onReserve && (
            <button
              className={`
                px-4 py-1 rounded-lg text-[10px] font-bold shadow-lg tracking-wide
                transition-all active:scale-95
                ${canReserve
                  ? 'bg-amber-500 hover:bg-amber-400 text-white'
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'}
              `}
              onClick={(e) => { e.stopPropagation(); if (canReserve) onReserve(); }}
            >
              Reserve
            </button>
          )}
        </div>
      )}
    </div>
  );
}
