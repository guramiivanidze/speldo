'use client';

import { Card, GemColor } from '@/types/game';
import {
  CARD_GRADIENT, CARD_TEXT, GEM_GRADIENT, COST_CHIP,
  GEM_COLORS, LEVEL_COLOR, TOKEN_LABEL,
} from '@/lib/colors';
import { API_BASE } from '@/lib/api';
import CardCrystalBg from './CardCrystalBg';

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

// Helper to get full image URL (handles relative media URLs)
function getImageUrl(card: Card): string | null {
  const img = card.background_image;
  // Check for truthy AND non-empty string AND not a Cloudinary "Null" placeholder
  if (!img || img.trim() === '' || img.endsWith('/Null') || img.endsWith('/null')) {
    return null; // Show crystal background
  }
  // If it's already an absolute URL, use it directly
  if (img.startsWith('http')) {
    return img;
  }
  // Otherwise, prepend the API base URL
  return `${API_BASE}${img}`;
}

export default function CardDisplay({
  card,
  onBuy,
  onReserve,
  canBuy = false,
  canReserve = false,
  showActions = false,
  compact = false,
}: CardDisplayProps) {
  // Guard against missing card data
  const bonus = card.bonus || 'white';
  const level = card.level || 1;
  const cost = card.cost || {};
  const points = card.points || 0;
  
  const textCls = CARD_TEXT[bonus];
  const costColors = GEM_COLORS.filter((color) => cost[color as GemColor]);
  const cardImage = getImageUrl(card);

  return (
    <div
      className={`
        dev-card group relative rounded-xl overflow-hidden
        h-full w-full
        ${canBuy ? 'afford-glow' : ''}
        cursor-default shadow-lg
        hover:z-50 transition-transform hover:scale-[1.02]
      `}
      style={{ background: CARD_GRADIENT[bonus] }}
    >
      {/* Background: image or crystal art fallback */}
      {cardImage ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${cardImage})` }}
          />
          {/* Gradient overlay for readability */}
          <div
            className="absolute inset-0"
            style={{ background: CARD_GRADIENT[bonus], opacity: 0.7 }}
          />
        </>
      ) : (
        /* Crystal art fallback when no image uploaded */
        <CardCrystalBg bonus={bonus} level={level} />
      )}

      {/* Main content - horizontal layout */}
      <div className="h-full flex relative z-10">

        {/* Left section - Level + Gem */}
        <div className="flex flex-col items-center justify-between py-2 px-2 w-1/3">
          {/* Level badge */}
          <div className={`
            text-[9px] font-black tracking-wider leading-none
            px-1.5 py-0.5 rounded-full text-slate-900
            ${LEVEL_COLOR[level as 1 | 2 | 3]}
          `}>
            {ROMAN[level]}
          </div>

          {/* Gem orb */}
          <div
            className="gem-orb shrink-0"
            style={{
              width: compact ? 28 : 40,
              height: compact ? 28 : 40,
              background: GEM_GRADIENT[bonus],
            }}
          />

          {/* Gem label */}
          <span className={`text-[7px] font-semibold uppercase tracking-wide opacity-60 ${textCls}`}>
            {TOKEN_LABEL[bonus]}
          </span>
        </div>

        {/* Right section - Points + Cost */}
        <div className="flex-1 flex flex-col justify-between py-2 pr-2">
          {/* Points (top right) - Crown badge */}
          <div className="flex justify-end">
            {points > 0 ? (
              <div
                className="relative flex items-center justify-center
                           font-black text-sm text-amber-900 drop-shadow-lg"
              >
                {/* Crown shape */}
                <svg viewBox="0 0 32 28" className="w-9 h-8" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}>
                  <defs>
                    <linearGradient id="crownGradCard" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fde047" />
                      {/* <stop offset="50%" stopColor="#fbbf24" /> */}
                      {/* <stop offset="100%" stopColor="#f59e0b" /> */}
                    </linearGradient>
                  </defs>
                  <path
                    d="M2 24 L6 10 L10 16 L16 4 L22 16 L26 10 L30 24 Z"
                    fill="url(#crownGradCard)"
                  // stroke="#fcd34d"
                  // strokeWidth="1.5"
                  />
                  <circle cx="6" cy="9" r="2.5" fill="#fcd34d" />
                  <circle cx="16" cy="3" r="2.5" fill="#fcd34d" />
                  <circle cx="26" cy="9" r="2.5" fill="#fcd34d" />
                </svg>

                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[35%] text-amber-900 font-black text-sm">
                  {points}
                </span>
              </div>
            ) : <div className="w-9 h-8" />}
          </div>

          {/* Cost circles (bottom right) */}
          <div className="flex flex-wrap gap-1.5 justify-end">
            {costColors.map((color) => {
              const c = cost[color as GemColor];
              if (!c) return null;
              return (
                <div
                  key={color}
                  className={`w-6 h-6 rounded-full flex items-center justify-center
                             text-sm font-bold shadow-sm border-1 border-white/0
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
