'use client';

import { useState } from 'react';
import { PlayerState, Card, Noble } from '@/types/game';
import { GEM_GRADIENT, TOKEN_GRADIENT, GEM_COLORS, TOKEN_LABEL } from '@/lib/colors';

interface MobileOpponentsViewProps {
  opponents: PlayerState[];
  currentPlayerId: number;
  cardsData: Record<string, Card>;
  noblesData: Record<string, Noble>;
}

interface OpponentPanelProps {
  player: PlayerState;
  isCurrentTurn: boolean;
  cardsData: Record<string, Card>;
  noblesData: Record<string, Noble>;
  expanded: boolean;
  onToggle: () => void;
}

function OpponentPanel({
  player,
  isCurrentTurn,
  cardsData,
  noblesData,
  expanded,
  onToggle,
}: OpponentPanelProps) {
  // Calculate bonuses from purchased cards
  const bonuses: Record<string, number> = {};
  for (const cid of player.purchased_card_ids) {
    const card = cardsData[String(cid)];
    if (card) bonuses[card.bonus] = (bonuses[card.bonus] || 0) + 1;
  }

  const totalTokens = Object.values(player.tokens).reduce((a, b) => a + b, 0);
  const totalBonuses = Object.values(bonuses).reduce((a, b) => a + b, 0);
  const initials = player.username.slice(0, 2).toUpperCase();

  return (
    <div
      className={`
        bg-slate-800/50 rounded-2xl overflow-hidden transition-all
        ${isCurrentTurn ? 'ring-2 ring-amber-400' : ''}
      `}
    >
      {/* Summary header - always visible */}
      <button
        className="w-full p-4 flex items-center gap-3"
        onClick={onToggle}
      >
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black shrink-0 shadow-md"
          style={{ background: 'linear-gradient(135deg, #475569, #1e293b)' }}
        >
          {initials}
        </div>

        {/* Name & Status */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            {isCurrentTurn && <span className="text-amber-400">▶</span>}
            <span className="font-bold text-white">{player.username}</span>
            {!player.is_online && (
              <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">OFFLINE</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
            <span>🪙 {totalTokens}</span>
            <span>💎 {totalBonuses}</span>
            <span>📌 {player.reserved_card_ids.length}</span>
          </div>
        </div>

        {/* Points */}
        <div className="text-center">
          <div className="text-2xl font-black gold-text">{player.prestige_points}</div>
          <div className="text-[10px] text-slate-500">/15</div>
        </div>

        {/* Expand arrow */}
        <div className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/10">
          {/* Tokens */}
          <div className="pt-3">
            <h4 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Tokens ({totalTokens}/10)</h4>
            <div className="flex gap-2 flex-wrap">
              {[...GEM_COLORS, 'gold' as const].map((color) => {
                const count = player.tokens[color] || 0;
                if (count === 0) return null;
                return (
                  <div
                    key={color}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm"
                    style={{ background: TOKEN_GRADIENT[color] }}
                  >
                    {count}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bonuses */}
          <div>
            <h4 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Bonuses ({totalBonuses} cards)</h4>
            <div className="flex gap-2">
              {GEM_COLORS.map((color) => {
                const count = bonuses[color] || 0;
                return (
                  <div key={color} className="flex flex-col items-center">
                    <div
                      className="w-7 h-7 rounded-sm shadow-sm flex items-center justify-center"
                      style={{ background: GEM_GRADIENT[color] }}
                    >
                      <span className={`text-xs font-bold ${count > 0 ? '' : 'opacity-40'}`}>{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reserved cards info */}
          {player.reserved_card_ids.length > 0 && (
            <div>
              <h4 className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                Reserved ({player.reserved_card_ids.length}/3)
              </h4>
              <div className="flex gap-2">
                {player.reserved_card_ids.map((_, idx) => (
                  <div
                    key={idx}
                    className="w-8 h-10 rounded bg-slate-700 border border-slate-600 flex items-center justify-center"
                  >
                    <span className="text-slate-500 text-xs">?</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nobles */}
          {player.noble_ids.length > 0 && (
            <div>
              <h4 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Nobles</h4>
              <div className="flex gap-2">
                {player.noble_ids.map((nid) => {
                  const noble = noblesData[String(nid)];
                  return (
                    <div
                      key={nid}
                      className="w-10 h-10 rounded bg-gradient-to-br from-amber-900 to-amber-950 border border-amber-500/30 flex flex-col items-center justify-center"
                    >
                      <span className="text-amber-400 text-sm">♛</span>
                      <span className="text-amber-300 text-[10px] font-bold">{noble?.points || '?'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MobileOpponentsView({
  opponents,
  currentPlayerId,
  cardsData,
  noblesData,
}: MobileOpponentsViewProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <h2 className="text-lg font-bold text-white mb-2">Opponents ({opponents.length})</h2>
      
      {opponents.map((opponent) => (
        <OpponentPanel
          key={opponent.id}
          player={opponent}
          isCurrentTurn={opponent.id === currentPlayerId}
          cardsData={cardsData}
          noblesData={noblesData}
          expanded={expandedId === opponent.id}
          onToggle={() => setExpandedId(expandedId === opponent.id ? null : opponent.id)}
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
