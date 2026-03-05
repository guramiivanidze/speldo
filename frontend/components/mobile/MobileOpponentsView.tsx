'use client';

import { PlayerState, Card, Noble } from '@/types/game';
import { GEM_GRADIENT, TOKEN_GRADIENT, GEM_COLORS } from '@/lib/colors';

// Distinct accent colors for each opponent position
const OPPONENT_ACCENTS = [
  { bg: 'from-blue-600/20 to-blue-900/30', border: 'border-blue-500/40', accent: '#3b82f6' },
  { bg: 'from-rose-600/20 to-rose-900/30', border: 'border-rose-500/40', accent: '#f43f5e' },
  { bg: 'from-emerald-600/20 to-emerald-900/30', border: 'border-emerald-500/40', accent: '#10b981' },
];

interface MobileOpponentsViewProps {
  opponents: PlayerState[];
  currentPlayerId: number;
  cardsData: Record<string, Card>;
  noblesData: Record<string, Noble>;
}

interface OpponentCardProps {
  player: PlayerState;
  isCurrentTurn: boolean;
  cardsData: Record<string, Card>;
  noblesData: Record<string, Noble>;
  accentStyle: typeof OPPONENT_ACCENTS[0];
}

function OpponentCard({
  player,
  isCurrentTurn,
  cardsData,
  noblesData,
  accentStyle,
}: OpponentCardProps) {
  // Calculate bonuses from purchased cards
  const bonuses: Record<string, number> = {};
  for (const cid of player.purchased_card_ids) {
    const card = cardsData[String(cid)];
    if (card) bonuses[card.bonus] = (bonuses[card.bonus] || 0) + 1;
  }

  const totalTokens = Object.values(player.tokens).reduce((a, b) => a + b, 0);
  const initials = player.username.slice(0, 2).toUpperCase();

  return (
    <div
      className={`
        bg-gradient-to-br ${accentStyle.bg} rounded-xl border ${accentStyle.border}
        overflow-hidden transition-all
        ${isCurrentTurn ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-400/20' : ''}
      `}
    >
      {/* Header with avatar, name, and points */}
      <div className="p-3 flex items-center gap-3">
        {/* Avatar with accent border */}
        <div className="relative shrink-0">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-base font-black shadow-md border-2"
            style={{ 
              background: `linear-gradient(135deg, ${accentStyle.accent}40, ${accentStyle.accent}20)`,
              borderColor: accentStyle.accent
            }}
          >
            {initials}
          </div>
          {isCurrentTurn && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center animate-pulse">
              <span className="text-[10px]">▶</span>
            </div>
          )}
        </div>

        {/* Name & Status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white truncate">{player.username}</span>
            {!player.is_online && (
              <span className="text-[8px] bg-red-500/80 text-white px-1.5 py-0.5 rounded-full shrink-0">OFF</span>
            )}
          </div>
        </div>

        {/* Points - prominent */}
        <div className="text-center shrink-0 px-2">
          <div className="text-2xl font-black gold-text">{player.prestige_points}</div>
          <div className="text-[9px] text-slate-500 -mt-1">pts</div>
        </div>
      </div>

      {/* Resources section */}
      <div className="px-3 pb-3 space-y-2">
        {/* Tokens row */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase w-12 shrink-0">Tokens</span>
          <div className="flex gap-1 flex-wrap">
            {[...GEM_COLORS, 'gold' as const].map((color) => {
              const count = player.tokens[color] || 0;
              return (
                <div
                  key={color}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm
                    ${count === 0 ? 'opacity-30' : ''}
                    ${color === 'white' ? 'text-slate-800' : ''}
                    ${color === 'gold' ? 'text-slate-900' : ''}`}
                  style={{ background: TOKEN_GRADIENT[color] }}
                >
                  {count}
                </div>
              );
            })}
            <span className="text-[10px] text-slate-500 ml-1 self-center">({totalTokens})</span>
          </div>
        </div>

        {/* Bonuses row */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase w-12 shrink-0">Cards</span>
          <div className="flex gap-1">
            {GEM_COLORS.map((color) => {
              const count = bonuses[color] || 0;
              return (
                <div
                  key={color}
                  className={`w-6 h-6 rounded shadow-sm flex items-center justify-center ${count === 0 ? 'opacity-30' : ''}`}
                  style={{ background: GEM_GRADIENT[color] }}
                >
                  <span className="text-[10px] font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total Power row */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-400 uppercase w-12 shrink-0 font-semibold">Total</span>
          <div className="flex gap-1">
            {GEM_COLORS.map((color) => {
              const total = (player.tokens[color] || 0) + (bonuses[color] || 0);
              return (
                <div
                  key={color}
                  className={`w-6 h-6 rounded-full flex items-center justify-center ring-1 ring-amber-500/30 ${total === 0 ? 'opacity-30' : ''}`}
                  style={{ background: GEM_GRADIENT[color] }}
                >
                  <span className={`text-[10px] font-bold ${color === 'white' ? 'text-slate-800' : ''}`}>{total}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reserved & Nobles row */}
        <div className="flex items-center gap-3">
          {/* Reserved */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">📌</span>
            <div className="flex gap-0.5">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-5 rounded-sm ${
                    idx < player.reserved_card_ids.length
                      ? 'bg-slate-600 border border-slate-500'
                      : 'bg-slate-800/50 border border-slate-700/50'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Nobles */}
          {player.noble_ids.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-amber-400 text-sm">♛</span>
              <div className="flex gap-0.5">
                {player.noble_ids.map((nid) => {
                  const noble = noblesData[String(nid)];
                  return (
                    <div
                      key={nid}
                      className="w-5 h-5 rounded bg-gradient-to-br from-amber-700 to-amber-900 border border-amber-500/40 flex items-center justify-center"
                    >
                      <span className="text-amber-300 text-[9px] font-bold">{noble?.points || '?'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MobileOpponentsView({
  opponents,
  currentPlayerId,
  cardsData,
  noblesData,
}: MobileOpponentsViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {opponents.map((opponent, index) => (
        <OpponentCard
          key={opponent.id}
          player={opponent}
          isCurrentTurn={opponent.id === currentPlayerId}
          cardsData={cardsData}
          noblesData={noblesData}
          accentStyle={OPPONENT_ACCENTS[index % OPPONENT_ACCENTS.length]}
        />
      ))}

      {opponents.length === 0 && (
        <div className="text-center text-slate-400 py-8">
          No opponents yet
        </div>
      )}
    </div>
  );
}
