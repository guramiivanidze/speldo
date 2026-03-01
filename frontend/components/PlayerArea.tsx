'use client';

import { useState } from 'react';
import { PlayerState, Card } from '@/types/game';
import { TokenRow } from './TokenDisplay';
import { GEM_COLORS, GEM_DOT_STYLE } from '@/lib/colors';
import ReservedCardsModal from './ReservedCardsModal';

interface PlayerAreaProps {
  player: PlayerState;
  isCurrentTurn: boolean;
  isMe: boolean;
  cardsData: Record<string, Card>;
  onBuyReserved?: (cardId: number) => void;
  canAffordCard?: (cardId: number) => boolean;
}

export default function PlayerArea({
  player,
  isCurrentTurn,
  isMe,
  cardsData,
  onBuyReserved,
  canAffordCard,
}: PlayerAreaProps) {
  const [showReservedModal, setShowReservedModal] = useState(false);

  const bonuses: Record<string, number> = {};
  for (const cid of player.purchased_card_ids) {
    const card = cardsData[String(cid)];
    if (card) bonuses[card.bonus] = (bonuses[card.bonus] || 0) + 1;
  }

  const totalTokens = Object.values(player.tokens).reduce((a, b) => a + b, 0);
  const initials = player.username.slice(0, 2).toUpperCase();

  const hasReserved = isMe && player.reserved_card_ids.length > 0;
  
  // Check if any reserved card can be bought
  const canBuyAnyReserved = hasReserved && player.reserved_card_ids.some(
    (cid) => canAffordCard ? canAffordCard(cid) : false
  );

  return (
    <div
      className={`
        glass rounded-xl p-2 transition-all duration-200
        ${isCurrentTurn
          ? 'border-4 border-amber-500 turn-pulse'
          : 'border border-white/5'}
      `}
    >
      <div className={hasReserved ? 'flex gap-3 items-center' : ''}>
        {/* Left side - Main player info */}
        <div className={hasReserved ? 'flex-1' : ''}>
          {/* ── Header with stats inline ─────────────────────────────────── */}
          <div className="flex items-center gap-3 mb-2">
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 shadow-md"
              style={{ background: isMe ? 'linear-gradient(135deg,#6366f1,#4338ca)' : 'linear-gradient(135deg,#475569,#1e293b)' }}
            >
              {initials}
            </div>

            {/* Name + Progress */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {isCurrentTurn && (
                  <span className="text-amber-400 text-xs leading-none">▶</span>
                )}
                <span className="font-bold text-sm text-slate-100 truncate">
                  {player.username}
                </span>
                {isMe && (
                  <span className="text-[8px] bg-indigo-500/30 text-indigo-300 rounded-full px-1 py-0.5 font-semibold shrink-0">
                    you
                  </span>
                )}
              </div>
            </div>

            {/* Stats inline */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Points */}
              <div className="flex items-center gap-0.5 bg-amber-500/10 rounded px-1.5 py-0.5">
                <span className="text-amber-400 text-[10px]">★</span>
                <span className="text-sm font-black gold-text">{player.prestige_points}</span>
                <span className="text-[8px] text-slate-500">/15</span>
              </div>
              {/* Tokens count */}
              <div className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 ${totalTokens >= 10 ? 'bg-red-500/20' : 'bg-slate-500/10'}`}>
                <span className={`text-[10px] ${totalTokens >= 10 ? 'text-red-400' : 'text-slate-400'}`}>●</span>
                <span className={`text-sm font-bold ${totalTokens >= 10 ? 'text-red-400' : 'text-slate-300'}`}>{totalTokens}</span>
                <span className="text-[8px] text-slate-500">/10</span>
              </div>
              {/* Cards count */}
              <div className="flex items-center gap-0.5 bg-emerald-500/10 rounded px-1.5 py-0.5">
                <span className="text-emerald-400 text-[10px]">▣</span>
                <span className="text-sm font-bold text-emerald-300">{player.purchased_card_ids.length}</span>
              </div>
              {/* Nobles */}
              {player.noble_ids.length > 0 && (
                <div className="flex items-center gap-0.5 bg-amber-500/10 rounded px-1.5 py-0.5">
                  <span className="text-amber-400 text-[10px]">♛</span>
                  <span className="text-sm font-bold text-amber-300">{player.noble_ids.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Tokens & Bonuses (side by side, compact) ─────────────────────────────────── */}
          <div className="flex gap-4">
            {/* Tokens */}
            <div className="flex-1">
              <div className={totalTokens >= 10 ? 'token-limit-warning p-0.5 -m-0.5' : ''}>
                <TokenRow tokens={player.tokens} size="xs" showLabel={false} />
              </div>
            </div>

            {/* Bonuses */}
            <div className="flex gap-2">
              {GEM_COLORS.map((color) => {
                const count = bonuses[color] || 0;
                return (
                  <div key={color} className="flex flex-col items-center gap-0.5">
                    <div
                      className="rounded-sm shadow-sm border border-white/20"
                      style={{ width: 18, height: 24, background: GEM_DOT_STYLE[color] }}
                    />
                    <span className={`text-[10px] font-black ${count > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reserved cards button */}
        {hasReserved && (
          <button
            onClick={() => setShowReservedModal(true)}
            className={`
              shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg transition-all
              ${canBuyAnyReserved 
                ? 'bg-emerald-500/20 reserved-can-buy hover:bg-emerald-500/30' 
                : 'bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20'}
            `}
          >
            <span className={`text-xl ${canBuyAnyReserved ? 'text-emerald-400' : 'text-indigo-400'}`}>◈</span>
            <div className="flex flex-col items-start">
              <span className={`text-xl font-bold ${canBuyAnyReserved ? 'text-emerald-300' : 'text-indigo-300'}`}>
                {player.reserved_card_ids.length}
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">Reserved</span>
            </div>
            {canBuyAnyReserved && (
              <div className="flex flex-col items-center ml-1">
                <span className="text-emerald-400 text-[10px] font-bold">BUY</span>
                <span className="text-emerald-400 text-xs">▶</span>
              </div>
            )}
          </button>
        )}
      </div>

      {/* Reserved Cards Modal */}
      {showReservedModal && (
        <ReservedCardsModal
          reservedCardIds={player.reserved_card_ids}
          cardsData={cardsData}
          onBuyCard={onBuyReserved}
          canAffordCard={canAffordCard}
          onClose={() => setShowReservedModal(false)}
        />
      )}
    </div>
  );
}
