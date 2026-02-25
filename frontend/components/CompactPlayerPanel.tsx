'use client';

import { PlayerState, Card, Noble } from '@/types/game';
import { GEM_COLORS, GEM_DOT_STYLE, TOKEN_GRADIENT } from '@/lib/colors';

interface CompactPlayerPanelProps {
    player: PlayerState;
    isCurrentTurn: boolean;
    isMe: boolean;
    cardsData: Record<string, Card>;
    position: 'top' | 'left' | 'right' | 'bottom';
}

export default function CompactPlayerPanel({
    player,
    isCurrentTurn,
    isMe,
    cardsData,
    position,
}: CompactPlayerPanelProps) {
    const bonuses: Record<string, number> = {};
    for (const cid of player.purchased_card_ids) {
        const card = cardsData[String(cid)];
        if (card) bonuses[card.bonus] = (bonuses[card.bonus] || 0) + 1;
    }

    const totalTokens = Object.values(player.tokens).reduce((a, b) => a + b, 0);
    const totalBonuses = Object.values(bonuses).reduce((a, b) => a + b, 0);
    const initials = player.username.slice(0, 2).toUpperCase();

    const isVertical = position === 'left' || position === 'right';

    return (
        <div
            className={`
        glass rounded-lg p-2.5 transition-all duration-200
        ${isCurrentTurn ? 'border-2 border-amber-500/80 turn-pulse' : 'border border-white/10'}
        ${isVertical ? 'w-full' : ''}
      `}
        >
            {/* Header - Name + Avatar */}
            <div className={`flex items-center gap-2 ${isVertical ? 'flex-col' : ''}`}>
                {/* Avatar */}
                <div
                    className={`
            rounded-full flex items-center justify-center font-black shrink-0 shadow-md
            ${isVertical ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'}
          `}
                    style={{ background: isMe ? 'linear-gradient(135deg,#6366f1,#4338ca)' : 'linear-gradient(135deg,#475569,#1e293b)' }}
                >
                    {initials}
                </div>

                <div className={`flex-1 min-w-0 ${isVertical ? 'text-center w-full' : ''}`}>
                    <div className={`flex items-center gap-1 ${isVertical ? 'justify-center' : ''}`}>
                        {isCurrentTurn && <span className="text-amber-400 text-xs">▶</span>}
                        <span className="font-bold text-xs text-slate-100 truncate">
                            {player.username}
                        </span>
                        {isMe && (
                            <span className="text-[8px] bg-indigo-500/30 text-indigo-300 rounded px-1 font-semibold">
                                you
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Key Stats Row - Points, Coins, Reserved */}
            <div className={`mt-2 flex gap-2 ${isVertical ? 'flex-wrap justify-center' : 'justify-between'}`}>
                {/* Points */}
                <div className="flex items-center gap-1 bg-amber-500/10 rounded-md px-2 py-1">
                    <span className="text-amber-400 text-xs">★</span>
                    <span className="text-sm font-black gold-text">{player.prestige_points}</span>
                    <span className="text-[9px] text-slate-500">/15</span>
                </div>

               

                {/* Reserved Cards */}
                <div className="flex items-center gap-1 bg-indigo-500/15 rounded-md px-2 py-1">
                    <span className="text-indigo-400 text-xs">◈</span>
                    <span className="text-sm font-bold text-indigo-300">{player.reserved_card_ids.length}</span>
                    <span className="text-[9px] text-slate-500">/3</span>
                </div>
            </div>

            {/* Tokens Detail Row */}
            {totalTokens > 0 && (
                <div className={`mt-2 flex gap-1 ${isVertical ? 'flex-wrap justify-center' : ''}`}>
                    {GEM_COLORS.map((color) => {
                        const count = player.tokens[color] || 0;
                        if (count === 0) return null;
                        return (
                            <div
                                key={color}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm"
                                style={{ background: TOKEN_GRADIENT[color] }}
                            >
                                {count}
                            </div>
                        );
                    })}
                    {(player.tokens.gold || 0) > 0 && (
                        <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm text-slate-900"
                            style={{ background: TOKEN_GRADIENT.gold }}
                        >
                            {player.tokens.gold}
                        </div>
                    )}
                </div>
            )}

            {/* Bonuses row */}
            <div className={`mt-2 flex gap-1.5 ${isVertical ? 'flex-wrap justify-center' : ''}`}>
                {GEM_COLORS.map((color) => {
                    const count = bonuses[color] || 0;
                    return (
                        <div key={color} className="flex items-center gap-0.5">
                            <div
                                className="gem-orb"
                                style={{ width: 10, height: 10, background: GEM_DOT_STYLE[color] }}
                            />
                            <span className={`text-[9px] font-bold ${count > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                                {count}
                            </span>
                        </div>
                    );
                })}
                {totalBonuses > 0 && (
                    <span className="text-[9px] text-slate-500 ml-1">({totalBonuses} cards)</span>
                )}
            </div>

            {/* Nobles */}
            {player.noble_ids.length > 0 && (
                <div className={`mt-2 flex items-center gap-1 ${isVertical ? 'justify-center' : ''}`}>
                    <span className="text-[9px] text-slate-500">Nobles:</span>
                    {player.noble_ids.map((nid) => (
                        <div key={nid} className="text-amber-400 text-sm">♛</div>
                    ))}
                </div>
            )}
        </div>
    );
}
