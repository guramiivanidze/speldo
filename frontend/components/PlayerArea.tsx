'use client';

import { PlayerState, Card, Noble } from '@/types/game';
import CardDisplay from './CardDisplay';
import NobleDisplay from './NobleDisplay';
import { TokenRow } from './TokenDisplay';
import { GEM_COLORS, GEM_DOT_STYLE, TOKEN_GRADIENT } from '@/lib/colors';

interface PlayerAreaProps {
  player: PlayerState;
  isCurrentTurn: boolean;
  isMe: boolean;
  cardsData: Record<string, Card>;
  noblesData: Record<string, Noble>;
  onBuyReserved?: (cardId: number) => void;
}

export default function PlayerArea({
  player,
  isCurrentTurn,
  isMe,
  cardsData,
  noblesData,
  onBuyReserved,
}: PlayerAreaProps) {
  const bonuses: Record<string, number> = {};
  for (const cid of player.purchased_card_ids) {
    const card = cardsData[String(cid)];
    if (card) bonuses[card.bonus] = (bonuses[card.bonus] || 0) + 1;
  }

  const totalTokens = Object.values(player.tokens).reduce((a, b) => a + b, 0);
  const progressPct = Math.min((player.prestige_points / 15) * 100, 100);
  const initials = player.username.slice(0, 2).toUpperCase();

  const hasReserved = isMe && player.reserved_card_ids.length > 0;

  return (
    <div
      className={`
        glass rounded-xl p-3 transition-all duration-200
        ${isCurrentTurn
          ? 'border-4 border-amber-500 turn-pulse'
          : 'border border-white/5'}
      `}
    >
      <div className={hasReserved ? 'flex gap-4' : ''}>
        {/* Left side - Main player info */}
        <div className={hasReserved ? 'flex-1' : ''}>
          {/* ── Header ─────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-3">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-md"
          style={{ background: isMe ? 'linear-gradient(135deg,#6366f1,#4338ca)' : 'linear-gradient(135deg,#475569,#1e293b)' }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isCurrentTurn && (
              <span className="text-amber-400 text-xs leading-none">▶</span>
            )}
            <span className="font-bold text-sm text-slate-100 truncate">
              {player.username}
            </span>
            {isMe && (
              <span className="text-[9px] bg-indigo-500/30 text-indigo-300 rounded-full px-1.5 py-0.5 font-semibold shrink-0">
                you
              </span>
            )}
          </div>

          {/* Progress bar to 15 */}
          <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg,#6366f1,#f5c518)',
              }}
            />
          </div>
        </div>

        {/* Points badge */}
        <div className="shrink-0 flex flex-col items-center">
          <span className="text-xl font-black gold-text leading-none">
            {player.prestige_points}
          </span>
          <span className="text-[8px] text-slate-500 font-semibold">/15</span>
        </div>
      </div>

      {/* ── Tokens ─────────────────────────────────── */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            Tokens
          </span>
          <span className="text-[10px] text-slate-400 font-bold">{totalTokens}/10</span>
        </div>
        <TokenRow tokens={player.tokens} size="sm" showLabel={false} />
      </div>

      {/* ── Bonuses ────────────────────────────────── */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            Bonuses
          </span>
          <span className="text-[10px] text-slate-400 font-bold">
            {player.purchased_card_ids.length} cards
          </span>
        </div>
        <div className="flex gap-3">
          {GEM_COLORS.map((color) => {
            const count = bonuses[color] || 0;
            return (
              <div key={color} className="flex flex-col items-center gap-1">
                <div
                  className="rounded-sm shadow-md border border-white/20"
                  style={{ width: 22, height: 22, background: GEM_DOT_STYLE[color] }}
                />
                <span className={`text-xs font-black ${count > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

          {/* ── Nobles ─────────────────────────────────── */}
          {player.noble_ids.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1.5">
                Nobles
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {player.noble_ids.map((nid) => {
                  const noble = noblesData[String(nid)];
                  return noble ? <NobleDisplay key={nid} noble={noble} compact /> : null;
                })}
              </div>
            </div>
          )}

          {/* ── Other player reserved count ─────────────── */}
          {!isMe && player.reserved_card_ids.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-3 h-3 rounded border border-slate-600 bg-slate-700 flex items-center justify-center">
                <span className="text-[7px] text-slate-400">?</span>
              </div>
              <span className="text-[10px] text-slate-500">
                {player.reserved_card_ids.length} reserved card{player.reserved_card_ids.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Right side - Reserved cards (always visible) */}
        {hasReserved && (
          <div className="shrink-0 border-l border-white/10 pl-4 flex flex-col">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">
              Reserved ({player.reserved_card_ids.length}/3)
            </span>
            <div className="flex gap-2">
              {player.reserved_card_ids.map((cid) => {
                const card = cardsData[String(cid)];
                if (!card) return null;
                return (
                  <div key={cid} className="w-20 h-28">
                    <CardDisplay
                      card={card}
                      onBuy={onBuyReserved ? () => onBuyReserved(cid) : undefined}
                      canBuy={!!onBuyReserved}
                      showActions={!!onBuyReserved}
                      compact
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
