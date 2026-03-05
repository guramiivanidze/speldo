'use client';

import { useState } from 'react';
import { PlayerState, Card } from '@/types/game';
import { TokenRow } from './TokenDisplay';
import { GEM_COLORS, GEM_DOT_STYLE, GEM_GRADIENT, TOKEN_GRADIENT, TOKEN_TEXT } from '@/lib/colors';
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
  const totalBonuses = Object.values(bonuses).reduce((a, b) => a + b, 0);
  const initials = player.username.slice(0, 2).toUpperCase();

  const hasReserved = isMe && player.reserved_card_ids.length > 0;
  
  // Check if any reserved card can be bought
  const canBuyAnyReserved = hasReserved && player.reserved_card_ids.some(
    (cid) => canAffordCard ? canAffordCard(cid) : false
  );

  return (
    <div
      className={`
        rounded-xl p-3 transition-all duration-200
        bg-gradient-to-br from-slate-800/90 via-slate-900/95 to-slate-950/90
        backdrop-blur-sm shadow-xl
        ${isCurrentTurn
          ? 'ring-2 ring-amber-400/80 shadow-amber-500/20'
          : 'border border-white/10'}
      `}
    >
      <div className="flex gap-4 items-stretch">
        {/* Left Section - Identity & Stats */}
        <div className="flex items-center gap-3">
          {/* Avatar with turn indicator */}
          <div className="relative">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-lg"
              style={{ background: isMe ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)' : 'linear-gradient(135deg, #475569 0%, #334155 50%, #1e293b 100%)' }}
            >
              {initials}
            </div>
            {isCurrentTurn && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-amber-900 text-[8px] font-black">▶</span>
              </div>
            )}
          </div>

          {/* Name & You badge */}
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-sm text-white">{player.username}</span>
            {isMe && (
              <span className="text-[9px] bg-indigo-500/40 text-indigo-200 rounded px-1.5 py-0.5 font-semibold w-fit">
                YOU
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />

        {/* Center Section - Key Stats */}
        <div className="flex items-center gap-3">
          {/* Prestige Points - Highlighted */}
          <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-amber-400">{player.prestige_points}</span>
              <span className="text-[10px] text-amber-500/70 font-semibold">/15</span>
            </div>
            <span className="text-[8px] text-amber-400/70 uppercase tracking-wider font-semibold">Points</span>
          </div>

          {/* Token Count */}
          <div className={`flex flex-col items-center px-2 py-1 rounded-lg ${totalTokens >= 10 ? 'bg-red-500/20 border border-red-500/40' : 'bg-slate-700/30 border border-slate-600/30'}`}>
            <div className="flex items-baseline gap-0.5">
              <span className={`text-lg font-bold ${totalTokens >= 10 ? 'text-red-400' : 'text-slate-300'}`}>{totalTokens}</span>
              <span className="text-[10px] text-slate-500 font-medium">/10</span>
            </div>
            <span className="text-[8px] text-slate-500 uppercase tracking-wider">Gems</span>
          </div>

          {/* Cards Count */}
          <div className="flex flex-col items-center px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
            <span className="text-lg font-bold text-emerald-400">{totalBonuses}</span>
            <span className="text-[8px] text-emerald-500/70 uppercase tracking-wider">Cards</span>
          </div>

          {/* Nobles */}
          {player.noble_ids.length > 0 && (
            <div className="flex flex-col items-center px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30">
              <span className="text-lg font-bold text-amber-400">{player.noble_ids.length}</span>
              <span className="text-[8px] text-amber-500/70 uppercase tracking-wider">Noble</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />

        {/* Right Section - Resources Detail */}
        <div className="flex-1 flex flex-col justify-center gap-1.5">
          {/* Tokens Row */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-500 w-12 shrink-0">Tokens</span>
            <div className="flex gap-1">
              {GEM_COLORS.map((color) => {
                const count = player.tokens[color] || 0;
                return (
                  <div
                    key={color}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm transition-all ${count > 0 ? 'scale-100' : 'scale-90 opacity-40'} ${TOKEN_TEXT[color]}`}
                    style={{ background: TOKEN_GRADIENT[color] }}
                  >
                    {count}
                  </div>
                );
              })}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm transition-all ${(player.tokens.gold || 0) > 0 ? 'scale-100' : 'scale-90 opacity-40'} text-amber-900`}
                style={{ background: TOKEN_GRADIENT.gold }}
              >
                {player.tokens.gold || 0}
              </div>
            </div>
          </div>

          {/* Bonuses Row */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-slate-500 w-12 shrink-0">Bonus</span>
            <div className="flex gap-1">
              {GEM_COLORS.map((color) => {
                const count = bonuses[color] || 0;
                return (
                  <div key={color} className={`flex items-center justify-center transition-all ${count > 0 ? 'opacity-100' : 'opacity-40'}`}>
                    <div
                      className="w-5 h-6 rounded shadow-sm border border-white/20 flex items-center justify-center"
                      style={{ background: GEM_DOT_STYLE[color] }}
                    >
                      <span className="text-[10px] font-black text-white drop-shadow">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Power Row */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-amber-400 w-12 shrink-0 font-semibold">Total</span>
            <div className="flex gap-1">
              {GEM_COLORS.map((color) => {
                const total = (player.tokens[color] || 0) + (bonuses[color] || 0);
                return (
                  <div
                    key={color}
                    className={`w-6 h-6 rounded-full flex items-center justify-center ring-1 ring-amber-500/30 transition-all ${total > 0 ? 'scale-100' : 'scale-90 opacity-40'}`}
                    style={{ background: GEM_GRADIENT[color] }}
                  >
                    <span className={`text-[10px] font-bold ${color === 'white' ? 'text-slate-800' : ''}`}>{total}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* Reserved Cards Button */}
        {hasReserved && (
          <>
            <div className="w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            <button
              onClick={() => setShowReservedModal(true)}
              className={`
                shrink-0 flex items-center gap-3 px-4 py-2 rounded-xl transition-all
                ${canBuyAnyReserved 
                  ? 'bg-gradient-to-br from-emerald-500/25 to-emerald-600/15 border border-emerald-400/40 hover:border-emerald-400/60 shadow-lg shadow-emerald-500/10' 
                  : 'bg-gradient-to-br from-indigo-500/15 to-indigo-600/10 border border-indigo-400/30 hover:border-indigo-400/50'}
              `}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${canBuyAnyReserved ? 'bg-emerald-500/30' : 'bg-indigo-500/20'}`}>
                <span className={`text-2xl font-black ${canBuyAnyReserved ? 'text-emerald-400' : 'text-indigo-400'}`}>
                  {player.reserved_card_ids.length}
                </span>
              </div>
              <div className="flex flex-col items-start">
                <span className={`text-xs font-bold uppercase tracking-wide ${canBuyAnyReserved ? 'text-emerald-300' : 'text-indigo-300'}`}>
                  Reserved
                </span>
                {canBuyAnyReserved ? (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    Can buy now
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">Click to view</span>
                )}
              </div>
            </button>
          </>
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
