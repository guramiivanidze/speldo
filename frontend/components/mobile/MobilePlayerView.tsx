'use client';

import { useState } from 'react';
import { PlayerState, Card, Noble, GemColor } from '@/types/game';
import { GEM_GRADIENT, TOKEN_GRADIENT, GEM_COLORS, TOKEN_LABEL } from '@/lib/colors';
import { API_BASE } from '@/lib/api';
import CardZoomModal from './CardZoomModal';

// Fallback gem images
const GEM_IMAGES: Record<string, string> = {
    white: 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&w=400',
    blue: 'https://images.pexels.com/photos/1458867/pexels-photo-1458867.jpeg?auto=compress&w=400',
    green: 'https://images.pexels.com/photos/1573236/pexels-photo-1573236.jpeg?auto=compress&w=400',
    red: 'https://images.pexels.com/photos/4040567/pexels-photo-4040567.jpeg?auto=compress&w=400',
    black: 'https://images.pexels.com/photos/2166456/pexels-photo-2166456.jpeg?auto=compress&w=400',
};

function getImageUrl(card: Card): string {
    if (card.background_image) {
        if (card.background_image.startsWith('http')) return card.background_image;
        return `${API_BASE}${card.background_image}`;
    }
    return GEM_IMAGES[card.bonus];
}

interface MobilePlayerViewProps {
  player: PlayerState;
  cardsData: Record<string, Card>;
  noblesData: Record<string, Noble>;
  isMyTurn: boolean;
  gameStatus: string;
  canAfford: (cardId: number) => boolean;
  onBuyReservedCard: (cardId: number) => void;
}

export default function MobilePlayerView({
  player,
  cardsData,
  noblesData,
  isMyTurn,
  gameStatus,
  canAfford,
  onBuyReservedCard,
}: MobilePlayerViewProps) {
  const [zoomedCard, setZoomedCard] = useState<Card | null>(null);

  // Calculate bonuses from purchased cards
  const bonuses: Record<string, number> = {};
  for (const cid of player.purchased_card_ids) {
    const card = cardsData[String(cid)];
    if (card) bonuses[card.bonus] = (bonuses[card.bonus] || 0) + 1;
  }

  const totalTokens = Object.values(player.tokens).reduce((a, b) => a + b, 0);
  const progressPct = Math.min((player.prestige_points / 15) * 100, 100);
  const isPlaying = gameStatus === 'playing';

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Header - Points & Progress */}
      <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-2xl p-4 border border-indigo-500/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-white">{player.username}</h2>
            <p className="text-sm text-slate-400">Your Profile</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black gold-text">{player.prestige_points}</div>
            <div className="text-xs text-slate-400">/ 15 points</div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #6366f1, #f5c518)',
            }}
          />
        </div>
      </div>

      {/* Tokens */}
      <div className={`bg-slate-800/50 rounded-2xl p-4 ${totalTokens >= 10 ? 'ring-2 ring-red-500 animate-pulse' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white">Tokens</h3>
          <span className={`text-sm font-bold ${totalTokens >= 10 ? 'text-red-400' : 'text-slate-400'}`}>
            {totalTokens}/10
          </span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {[...GEM_COLORS, 'gold' as const].map((color) => (
            <div key={color} className="flex flex-col items-center gap-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-lg
                  ${color === 'white' ? 'text-slate-800' : ''}
                  ${color === 'gold' ? 'text-slate-900' : ''}`}
                style={{ background: TOKEN_GRADIENT[color] }}
              >
                {player.tokens[color] || 0}
              </div>
              <span className="text-[9px] text-slate-400 uppercase">{TOKEN_LABEL[color].slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bonuses */}
      <div className="bg-slate-800/50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white">Bonuses</h3>
          <span className="text-sm text-slate-400">{player.purchased_card_ids.length} cards</span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {GEM_COLORS.map((color) => (
            <div key={color} className="flex flex-col items-center gap-1">
              <div
                className="w-10 h-10 rounded-lg shadow-md flex items-center justify-center"
                style={{ background: GEM_GRADIENT[color] }}
              >
                <span className="text-lg font-black drop-shadow-lg">{bonuses[color] || 0}</span>
              </div>
              <span className="text-[9px] text-slate-400 uppercase">{color.slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reserved Cards */}
      {player.reserved_card_ids.length > 0 && (
        <div className="bg-slate-800/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white">Reserved Cards</h3>
            <span className="text-sm text-slate-400">{player.reserved_card_ids.length}/3</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {player.reserved_card_ids.map((cid) => {
              const card = cardsData[String(cid)];
              if (!card) return null;
              const affordable = canAfford(cid);
              
              return (
                <button
                  key={cid}
                  className={`
                    aspect-[3/4] rounded-xl overflow-hidden relative
                    transition-transform active:scale-95
                    ${affordable ? 'ring-2 ring-emerald-400' : ''}
                  `}
                  onClick={() => setZoomedCard(card)}
                >
                  {/* Background image */}
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${getImageUrl(card)})` }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: GEM_GRADIENT[card.bonus], opacity: 0.6 }}
                  />
                  <div className="h-full flex flex-col justify-between p-2 relative z-10">
                    <div className="flex justify-end">
                      {card.points > 0 && (
                        <div className="bg-amber-400 text-amber-900 text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center">
                          {card.points}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-center">
                      <div
                        className="w-8 h-8 rounded-full shadow-lg"
                        style={{ background: GEM_GRADIENT[card.bonus] }}
                      />
                    </div>
                    <div className="flex gap-1 flex-wrap justify-center">
                      {GEM_COLORS.map((color) => {
                        const cost = card.cost[color as GemColor];
                        if (!cost) return null;
                        return (
                          <div
                            key={color}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
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
      )}

      {/* Nobles */}
      {player.noble_ids.length > 0 && (
        <div className="bg-slate-800/50 rounded-2xl p-4">
          <h3 className="font-bold text-white mb-3">Your Nobles</h3>
          <div className="flex gap-3 flex-wrap">
            {player.noble_ids.map((nid) => {
              const noble = noblesData[String(nid)];
              if (!noble) return null;
              return (
                <div
                  key={nid}
                  className="w-16 h-16 rounded-lg bg-gradient-to-br from-amber-900 to-amber-950 border border-amber-500/30 flex flex-col items-center justify-center"
                >
                  <span className="text-amber-400 text-lg">♛</span>
                  <span className="text-amber-300 font-bold">{noble.points}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Card Zoom Modal */}
      {zoomedCard && (
        <CardZoomModal
          card={zoomedCard}
          onClose={() => setZoomedCard(null)}
          onBuy={isMyTurn && isPlaying ? () => onBuyReservedCard(zoomedCard.id) : undefined}
          canBuy={isMyTurn && canAfford(zoomedCard.id) && isPlaying}
          canReserve={false}
        />
      )}
    </div>
  );
}
