'use client';

import { useState } from 'react';
import { Card, Noble, GemColor, TokenColor } from '@/types/game';
import { GEM_GRADIENT, TOKEN_GRADIENT, TOKEN_LABEL, LEVEL_COLOR, GEM_COLORS } from '@/lib/colors';
import CardZoomModal from './CardZoomModal';

interface MobileBoardViewProps {
  visibleCards: Record<string, number[]>;
  deckCounts: Record<string, number>;
  cardsData: Record<string, Card>;
  nobles: number[];
  noblesData: Record<string, Noble>;
  tokensInBank: Record<TokenColor, number>;
  isMyTurn: boolean;
  canAfford: (cardId: number) => boolean;
  canReserveMore: boolean;
  gameStatus: string;
  onBuyCard: (cardId: number) => void;
  onReserveCard: (cardId?: number, level?: number) => void;
  onOpenTokenSelector: () => void;
  selectedTokens: TokenColor[];
}

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };
const LEVEL_DOT: Record<string, string> = { '3': 'bg-red-400', '2': 'bg-yellow-400', '1': 'bg-emerald-400' };

export default function MobileBoardView({
  visibleCards,
  deckCounts,
  cardsData,
  nobles,
  noblesData,
  tokensInBank,
  isMyTurn,
  canAfford,
  canReserveMore,
  gameStatus,
  onBuyCard,
  onReserveCard,
  onOpenTokenSelector,
  selectedTokens,
}: MobileBoardViewProps) {
  const [zoomedCard, setZoomedCard] = useState<Card | null>(null);
  const levels: ('3' | '2' | '1')[] = ['3', '2', '1'];

  const isPlaying = gameStatus === 'playing';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Nobles Row - Horizontal Scroll */}
      <div className="shrink-0 p-2 border-b border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-amber-400 text-sm">♛</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Nobles</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          {nobles.map((nid) => {
            const noble = noblesData[String(nid)];
            if (!noble) return null;
            return (
              <div
                key={nid}
                className="shrink-0 w-24 h-16 snap-start rounded-lg overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-950 to-slate-900 p-2 flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <span className="text-amber-400 text-xs">♛</span>
                  <div className="bg-amber-500 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {noble.points}
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {GEM_COLORS.map((color) => {
                    const req = noble.requirements[color];
                    if (!req) return null;
                    return (
                      <div
                        key={color}
                        className="flex items-center gap-0.5 bg-black/40 rounded px-1 py-0.5"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: GEM_GRADIENT[color] }}
                        />
                        <span className="text-[8px] font-bold text-white">{req}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Token Bank Button */}
      <div className="shrink-0 p-2 border-b border-white/10">
        <button
          className={`
            w-full py-3 rounded-xl flex items-center justify-center gap-3
            ${isMyTurn && isPlaying
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
              : 'bg-slate-800 text-slate-400 cursor-not-allowed'}
          `}
          onClick={isMyTurn && isPlaying ? onOpenTokenSelector : undefined}
          disabled={!isMyTurn || !isPlaying}
        >
          <span className="text-lg">💎</span>
          <span className="font-bold">Take Tokens</span>
          <div className="flex gap-1">
            {GEM_COLORS.slice(0, 3).map((color) => (
              <div
                key={color}
                className="w-4 h-4 rounded-full opacity-80"
                style={{ background: TOKEN_GRADIENT[color] }}
              />
            ))}
          </div>
        </button>
        
        {/* Bank preview */}
        <div className="flex justify-center gap-2 mt-2">
          {GEM_COLORS.map((color) => (
            <div key={color} className="flex flex-col items-center">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm"
                style={{ background: TOKEN_GRADIENT[color] }}
              >
                {tokensInBank[color] ?? 0}
              </div>
            </div>
          ))}
          <div className="flex flex-col items-center">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm text-slate-900"
              style={{ background: TOKEN_GRADIENT.gold }}
            >
              {tokensInBank.gold ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Card Tiers - Vertical scroll, horizontal per tier */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {levels.map((level) => (
          <div key={level} className="bg-slate-800/50 rounded-xl p-2">
            {/* Tier header */}
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${LEVEL_DOT[level]}`} />
              <span className={`text-xs font-bold ${LEVEL_COLOR[Number(level) as 1|2|3].replace('bg-', 'text-')}`}>
                Tier {ROMAN[Number(level)]}
              </span>
              <button
                className={`
                  ml-auto px-2 py-0.5 rounded text-[9px] font-bold
                  ${isMyTurn && canReserveMore && (deckCounts[level] ?? 0) > 0 && isPlaying
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'}
                `}
                onClick={() => {
                  if (isMyTurn && canReserveMore && (deckCounts[level] ?? 0) > 0 && isPlaying) {
                    onReserveCard(undefined, Number(level));
                  }
                }}
              >
                Deck: {deckCounts[level] ?? 0}
              </button>
            </div>

            {/* Cards - Horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
              {(visibleCards[level] || []).map((cardId) => {
                const card = cardsData[String(cardId)];
                if (!card) return null;
                const affordable = canAfford(cardId);
                
                return (
                  <button
                    key={cardId}
                    className={`
                      shrink-0 w-20 h-28 snap-start rounded-lg overflow-hidden
                      transition-transform active:scale-95
                      ${affordable ? 'ring-2 ring-emerald-400' : ''}
                    `}
                    style={{ background: GEM_GRADIENT[card.bonus] }}
                    onClick={() => setZoomedCard(card)}
                  >
                    <div className="h-full flex flex-col justify-between p-1.5 bg-black/20">
                      {/* Points & Level */}
                      <div className="flex justify-between items-start">
                        <div className={`text-[8px] font-bold px-1 py-0.5 rounded ${LEVEL_COLOR[card.level]}`}>
                          {ROMAN[card.level]}
                        </div>
                        {card.points > 0 && (
                          <div className="bg-amber-400 text-amber-900 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {card.points}
                          </div>
                        )}
                      </div>
                      
                      {/* Gem bonus */}
                      <div className="flex justify-center">
                        <div
                          className="w-6 h-6 rounded-full shadow-lg"
                          style={{ background: GEM_GRADIENT[card.bonus] }}
                        />
                      </div>
                      
                      {/* Cost */}
                      <div className="flex gap-0.5 flex-wrap justify-center">
                        {GEM_COLORS.map((color) => {
                          const cost = card.cost[color as GemColor];
                          if (!cost) return null;
                          return (
                            <div
                              key={color}
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                              style={{ background: GEM_GRADIENT[color] }}
                            >
                              {cost}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Card Zoom Modal */}
      {zoomedCard && (
        <CardZoomModal
          card={zoomedCard}
          onClose={() => setZoomedCard(null)}
          onBuy={isMyTurn && isPlaying ? () => onBuyCard(zoomedCard.id) : undefined}
          onReserve={isMyTurn && isPlaying ? () => onReserveCard(zoomedCard.id) : undefined}
          canBuy={isMyTurn && canAfford(zoomedCard.id) && isPlaying}
          canReserve={isMyTurn && canReserveMore && isPlaying}
        />
      )}
    </div>
  );
}
