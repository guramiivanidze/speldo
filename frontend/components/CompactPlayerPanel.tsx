'use client';

import { PlayerState, Card, Noble } from '@/types/game';
import { GEM_COLORS, GEM_DOT_STYLE, TOKEN_GRADIENT, TOKEN_TEXT } from '@/lib/colors';

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
        glass rounded-lg p-2.5 transition-all duration-200 relative
        ${isCurrentTurn ? 'border-4 border-amber-500 turn-pulse' : 'border border-white/10'}
        ${isVertical ? 'w-full' : 'min-w-[280px]'}
        ${!player.is_online ? 'opacity-60' : ''}
      `}
        >
            {/* Offline indicator */}
            {!player.is_online && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-md">
                    OFFLINE
                </div>
            )}
            
            {/* Header - Name + Avatar + Stats (horizontal for top position) */}
            {isVertical ? (
                <>
                    {/* Vertical layout for left/right */}
                    <div className="flex items-center gap-2 flex-col">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 shadow-md text-sm"
                            style={{ background: isMe ? 'linear-gradient(135deg,#6366f1,#4338ca)' : 'linear-gradient(135deg,#475569,#1e293b)' }}
                        >
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0 text-center w-full">
                            <div className="flex items-center gap-1 justify-center">
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
                    {/* Stats row for vertical */}
                    <div className="mt-2 flex gap-2 flex-wrap justify-center">
                        <div className="flex items-center gap-1 bg-amber-500/10 rounded-md px-2 py-1">
                            <span className="text-amber-400 text-xs">★</span>
                            <span className="text-sm font-black gold-text">{player.prestige_points}</span>
                            <span className="text-[9px] text-slate-500">/15</span>
                        </div>
                        <div className="flex items-center gap-1 bg-emerald-500/10 rounded-md px-2 py-1">
                            <span className="text-emerald-400 text-xs">▣</span>
                            <span className="text-sm font-bold text-emerald-300">{player.purchased_card_ids.length}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-indigo-500/15 rounded-md px-2 py-1">
                            <span className="text-indigo-400 text-xs">◈</span>
                            <span className="text-sm font-bold text-indigo-300">{player.reserved_card_ids.length}</span>
                            <span className="text-[9px] text-slate-500">/3</span>
                        </div>
                    </div>
                </>
            ) : (
                /* Horizontal layout for top - name and stats on same line */
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0 shadow-md text-xs"
                        style={{ background: isMe ? 'linear-gradient(135deg,#6366f1,#4338ca)' : 'linear-gradient(135deg,#475569,#1e293b)' }}
                    >
                        {initials}
                    </div>
                    
                    {/* Name */}
                    <div className="flex items-center gap-1 min-w-0">
                        {isCurrentTurn && <span className="text-amber-400 text-xs">▶</span>}
                        <span className="font-bold text-sm text-slate-100 truncate">
                            {player.username}
                        </span>
                        {isMe && (
                            <span className="text-[8px] bg-indigo-500/30 text-indigo-300 rounded px-1 font-semibold">
                                you
                            </span>
                        )}
                    </div>
                    
                    {/* Stats inline */}
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="flex items-center gap-0.5 bg-amber-500/10 rounded px-1.5 py-0.5">
                            <span className="text-amber-400 text-[10px]">★</span>
                            <span className="text-sm font-black gold-text">{player.prestige_points}</span>
                        </div>
                        <div className="flex items-center gap-0.5 bg-emerald-500/10 rounded px-1.5 py-0.5">
                            <span className="text-emerald-400 text-[10px]">▣</span>
                            <span className="text-sm font-bold text-emerald-300">{player.purchased_card_ids.length}</span>
                        </div>
                        <div className="flex items-center gap-0.5 bg-indigo-500/15 rounded px-1.5 py-0.5">
                            <span className="text-indigo-400 text-[10px]">◈</span>
                            <span className="text-sm font-bold text-indigo-300">{player.reserved_card_ids.length}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tokens & Bonuses - side by side for top, stacked for left/right */}
            {isVertical ? (
                <>
                    {/* Tokens Detail Row */}
                    {totalTokens > 0 && (
                        <div className={`mt-2 ${totalTokens >= 10 ? 'token-limit-warning p-1' : ''}`}>
                            <div className="flex gap-1 flex-wrap justify-center">
                                {GEM_COLORS.map((color) => {
                                    const count = player.tokens[color] || 0;
                                    if (count === 0) return null;
                                    return (
                                        <div
                                            key={color}
                                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm ${TOKEN_TEXT[color]}`}
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
                        </div>
                    )}

                    {/* Bonuses row */}
                    <div className="mt-2 flex gap-2 flex-wrap justify-center">
                        {GEM_COLORS.map((color) => {
                            const count = bonuses[color] || 0;
                            return (
                                <div key={color} className="flex flex-col items-center gap-0.5">
                                    <div
                                        className="rounded-sm shadow-sm border border-white/20"
                                        style={{ width: 16, height: 20, background: GEM_DOT_STYLE[color] }}
                                    />
                                    <span className={`text-[10px] font-bold ${count > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                /* Top position: tokens and bonuses side by side */
                <div className="mt-2 flex gap-4">
                    {/* Tokens */}
                    {totalTokens > 0 && (
                        <div className={`flex-1 ${totalTokens >= 10 ? 'token-limit-warning p-1' : ''}`}>
                            <div className="flex gap-1">
                                {GEM_COLORS.map((color) => {
                                    const count = player.tokens[color] || 0;
                                    if (count === 0) return null;
                                    return (
                                        <div
                                            key={color}
                                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm ${TOKEN_TEXT[color]}`}
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
                        </div>
                    )}

                    {/* Bonuses */}
                    <div className="flex gap-2">
                        {GEM_COLORS.map((color) => {
                            const count = bonuses[color] || 0;
                            return (
                                <div key={color} className="flex flex-col items-center gap-0.5">
                                    <div
                                        className="rounded-sm shadow-sm border border-white/20"
                                        style={{ width: 16, height: 20, background: GEM_DOT_STYLE[color] }}
                                    />
                                    <span className={`text-[10px] font-bold ${count > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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
