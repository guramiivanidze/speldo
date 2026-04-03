'use client';

import { useEffect } from 'react';
import { Card, GemColor } from '@/types/game';
import { GEM_GRADIENT, LEVEL_COLOR, GEM_COLORS } from '@/lib/colors';
import { API_BASE } from '@/lib/api';
import CardCrystalBg from './CardCrystalBg';

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };
const ANIMATION_MS = 2200;

function getImageUrl(card: Card): string | null {
  const img = card.background_image;
  if (!img || img.trim() === '' || img.endsWith('/Null') || img.endsWith('/null')) return null;
  if (img.startsWith('http')) return img;
  return `${API_BASE}${img}`;
}

interface ReservationAnimationProps {
  card: Card;
  username: string;
  rect: { left: number; top: number; width: number; height: number } | null;
  onDone: () => void;
}

export function ReservationAnimation({ card, username, rect, onDone }: ReservationAnimationProps) {
  const cardImage = getImageUrl(card);

  useEffect(() => {
    const t = setTimeout(onDone, ANIMATION_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!rect) return null;

  return (
    <div
      className="fixed z-[60] pointer-events-none reserve-anim-inplace"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      <div
        className="absolute inset-0 rounded-xl overflow-hidden"
        style={{
          background: GEM_GRADIENT[card.bonus],
          boxShadow: 'inset 0 0 0 2px #fbbf24, 0 0 0 2px #fbbf24, 0 0 28px rgba(251,191,36,0.55)',
        }}
      >
        {/* Background */}
        {cardImage ? (
          <>
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${cardImage})` }} />
            <div className="absolute inset-0" style={{ background: GEM_GRADIENT[card.bonus], opacity: 0.45 }} />
          </>
        ) : (
          <div className="absolute inset-0">
            <CardCrystalBg bonus={card.bonus} level={card.level as 1 | 2 | 3} />
          </div>
        )}

        {/* Light scrim — keeps content readable without hiding it */}
        <div className="absolute inset-0 bg-black/25" />

        {/* Tier badge — top-left */}
        <div className={`absolute top-1.5 left-1.5 z-20 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${LEVEL_COLOR[card.level as 1 | 2 | 3]}`}>
          {ROMAN[card.level]}
        </div>

        {/* VP badge — top-right, always rendered so it's never clipped */}
        {card.points > 0 && (
          <div className="absolute top-1.5 right-1.5 z-20 bg-amber-400 text-amber-900 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow">
            {card.points}
          </div>
        )}

        {/* Bonus pip — bottom-left */}
        <div
          className="absolute bottom-7 left-1.5 z-20 w-6 h-6 rounded-full shadow border border-white/40"
          style={{ background: GEM_GRADIENT[card.bonus] }}
        />

        {/* Cost pips — bottom row */}
        <div className="absolute bottom-1.5 inset-x-1 z-20 flex gap-0.5 flex-wrap justify-center">
          {GEM_COLORS.map(color => {
            const qty = card.cost[color as GemColor];
            if (!qty) return null;
            return (
              <div
                key={color}
                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shadow"
                style={{ background: GEM_GRADIENT[color] }}
              >
                {qty}
              </div>
            );
          })}
        </div>

        {/* Reserved label — center */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-0.5">
          <span className="text-lg leading-none drop-shadow-lg">🔒</span>
          <span className="text-white font-black text-[9px] tracking-widest uppercase drop-shadow">Reserved</span>
          <span className="text-amber-300 text-[8px] truncate max-w-full px-1 text-center">{username}</span>
        </div>
      </div>
    </div>
  );
}
