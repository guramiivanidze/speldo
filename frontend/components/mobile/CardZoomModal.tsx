'use client';

import { Card, GemColor } from '@/types/game';
import { GEM_GRADIENT, COST_CHIP, TOKEN_LABEL, LEVEL_COLOR, GEM_COLORS } from '@/lib/colors';
import { API_BASE } from '@/lib/api';

interface CardZoomModalProps {
  card: Card;
  onClose: () => void;
  onBuy?: () => void;
  onReserve?: () => void;
  canBuy?: boolean;
  canReserve?: boolean;
}

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };

function getImageUrl(card: Card): string | null {
  if (card.background_image) {
    if (card.background_image.startsWith('http')) return card.background_image;
    return `${API_BASE}${card.background_image}`;
  }
  return null; // Return null to show color gradient instead
}

export default function CardZoomModal({
  card,
  onClose,
  onBuy,
  onReserve,
  canBuy = false,
  canReserve = false,
}: CardZoomModalProps) {
  const costColors = GEM_COLORS.filter((color) => card.cost[color as GemColor]);
  const cardImage = getImageUrl(card);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/10 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background: Image or Color Gradient */}
        {cardImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${cardImage})` }}
          />
        ) : (
          <div
            className="absolute inset-0 opacity-30"
            style={{ background: GEM_GRADIENT[card.bonus] }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-800" />
        
        {/* Content */}
        <div className="relative z-10">
        {/* Card Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Level badge */}
            <div className={`
              text-sm font-black tracking-wider px-3 py-1 rounded-full text-slate-900
              ${LEVEL_COLOR[card.level as 1 | 2 | 3]}
            `}>
              Level {ROMAN[card.level]}
            </div>
            
            {/* Gem bonus */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full shadow-lg"
                style={{ background: GEM_GRADIENT[card.bonus] }}
              />
              <span className="text-white font-semibold capitalize">{card.bonus}</span>
            </div>
          </div>

          {/* Close button */}
          <button
            className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Points */}
        {card.points > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-slate-400 text-sm">Points:</span>
            <div className="relative flex items-center justify-center">
              <svg viewBox="0 0 32 28" className="w-12 h-10" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}>
                <defs>
                  <linearGradient id="crownGradModal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fde047" />
                    <stop offset="50%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <path
                  d="M2 24 L6 10 L10 16 L16 4 L22 16 L26 10 L30 24 Z"
                  fill="url(#crownGradModal)"
                  stroke="#fcd34d"
                  strokeWidth="1.5"
                />
                <circle cx="6" cy="9" r="2.5" fill="#fcd34d" />
                <circle cx="16" cy="3" r="2.5" fill="#fcd34d" />
                <circle cx="26" cy="9" r="2.5" fill="#fcd34d" />
              </svg>
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[35%] text-amber-900 font-black text-lg">
                {card.points}
              </span>
            </div>
          </div>
        )}

        {/* Cost */}
        <div className="mb-6">
          <span className="text-slate-400 text-sm block mb-2">Cost:</span>
          <div className="flex gap-3 flex-wrap">
            {costColors.map((color) => {
              const cost = card.cost[color as GemColor];
              if (!cost) return null;
              return (
                <div
                  key={color}
                  className={`w-12 h-12 rounded-full flex items-center justify-center
                             text-xl font-bold shadow-lg border-2 border-white/30
                             ${COST_CHIP[color as GemColor]}`}
                >
                  {cost}
                </div>
              );
            })}
            {costColors.length === 0 && (
              <span className="text-slate-500 text-sm">Free</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {onBuy && (
            <button
              className={`
                flex-1 py-3 rounded-xl text-base font-bold shadow-lg
                transition-all active:scale-95
                ${canBuy
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'}
              `}
              onClick={() => {
                if (canBuy) {
                  onBuy();
                  onClose();
                }
              }}
              disabled={!canBuy}
            >
              {canBuy ? '💎 Buy Card' : 'Cannot Afford'}
            </button>
          )}
          {onReserve && (
            <button
              className={`
                flex-1 py-3 rounded-xl text-base font-bold shadow-lg
                transition-all active:scale-95
                ${canReserve
                  ? 'bg-amber-500 hover:bg-amber-400 text-white'
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'}
              `}
              onClick={() => {
                if (canReserve) {
                  onReserve();
                  onClose();
                }
              }}
              disabled={!canReserve}
            >
              {canReserve ? '📌 Reserve' : 'Max Reserved'}
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
