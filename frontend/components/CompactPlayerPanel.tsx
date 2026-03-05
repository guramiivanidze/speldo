'use client';

import { PlayerState, Card, Noble } from '@/types/game';
import { GEM_COLORS, GEM_DOT_STYLE, GEM_GRADIENT, TOKEN_GRADIENT, TOKEN_TEXT } from '@/lib/colors';

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
                rounded-xl p-2.5 transition-all duration-200 relative
                bg-gradient-to-br from-slate-800/80 via-slate-900/90 to-slate-950/80
                backdrop-blur-sm shadow-lg
                ${isCurrentTurn ? 'ring-2 ring-amber-400/80 shadow-amber-500/20' : 'border border-white/10'}
                ${isVertical ? 'w-full' : 'min-w-[260px]'}
                ${!player.is_online ? 'opacity-50' : ''}
            `}
        >
            {/* Offline indicator */}
            {!player.is_online && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                    Offline
                </div>
            )}
            
            {/* Header - Name + Avatar + Stats (horizontal for top position) */}
            {isVertical ? (
                <>
                    {/* Vertical layout for left/right */}
                    <div className="flex flex-col items-center gap-2">
                        {/* Avatar with turn indicator */}
                        <div className="relative">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-lg text-sm"
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
                        <span className="font-bold text-xs text-white text-center truncate w-full px-1">
                            {player.username}
                        </span>
                    </div>

                    {/* Prestige Points - Prominent */}
                    <div className="mt-2 flex justify-center">
                        <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-500/30">
                            <span className="text-xl font-black text-amber-400">{player.prestige_points}</span>
                            <span className="text-[7px] text-amber-400/70 uppercase tracking-wider font-semibold">Points</span>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="mt-2 flex gap-1.5 flex-wrap justify-center">
                        <div className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 ${totalTokens >= 10 ? 'bg-red-500/20 border border-red-500/30' : 'bg-slate-700/40'}`}>
                            <span className={`text-xs font-bold ${totalTokens >= 10 ? 'text-red-400' : 'text-slate-300'}`}>{totalTokens}</span>
                            <span className="text-[8px] text-slate-500">gems</span>
                        </div>
                        <div className="flex items-center gap-1 bg-emerald-500/15 rounded-md px-1.5 py-0.5">
                            <span className="text-xs font-bold text-emerald-400">{totalBonuses}</span>
                            <span className="text-[8px] text-slate-500">cards</span>
                        </div>
                        {player.reserved_card_ids.length > 0 && (
                            <div className="flex items-center gap-1 bg-indigo-500/15 rounded-md px-1.5 py-0.5">
                                <span className="text-xs font-bold text-indigo-400">{player.reserved_card_ids.length}</span>
                                <span className="text-[8px] text-slate-500">res</span>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                /* Horizontal layout for top - streamlined */
                <div className="flex items-center gap-3">
                    {/* Avatar with turn indicator */}
                    <div className="relative">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-black shadow-lg text-xs"
                            style={{ background: isMe ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)' : 'linear-gradient(135deg, #475569 0%, #334155 50%, #1e293b 100%)' }}
                        >
                            {initials}
                        </div>
                        {isCurrentTurn && (
                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center shadow">
                                <span className="text-amber-900 text-[7px] font-black">▶</span>
                            </div>
                        )}
                    </div>
                    
                    {/* Name */}
                    <span className="font-bold text-sm text-white truncate min-w-0 flex-1">
                        {player.username}
                    </span>
                    
                    {/* Prestige Points - Highlighted */}
                    <div className="flex flex-col items-center px-2 py-0.5 rounded-lg bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-500/30">
                        <span className="text-lg font-black text-amber-400">{player.prestige_points}</span>
                        <span className="text-[7px] text-amber-400/70 uppercase tracking-wider">pts</span>
                    </div>
                    
                    {/* Quick stats */}
                    <div className="flex items-center gap-1.5">
                        <div className={`flex flex-col items-center px-1.5 py-0.5 rounded ${totalTokens >= 10 ? 'bg-red-500/20' : 'bg-slate-700/40'}`}>
                            <span className={`text-sm font-bold ${totalTokens >= 10 ? 'text-red-400' : 'text-slate-300'}`}>{totalTokens}</span>
                            <span className="text-[7px] text-slate-500">gems</span>
                        </div>
                        <div className="flex flex-col items-center px-1.5 py-0.5 rounded bg-emerald-500/15">
                            <span className="text-sm font-bold text-emerald-400">{totalBonuses}</span>
                            <span className="text-[7px] text-slate-500">cards</span>
                        </div>
                        {player.reserved_card_ids.length > 0 && (
                            <div className="flex flex-col items-center px-1.5 py-0.5 rounded bg-indigo-500/15">
                                <span className="text-sm font-bold text-indigo-400">{player.reserved_card_ids.length}</span>
                                <span className="text-[7px] text-slate-500">res</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tokens & Bonuses - compact display */}
            {isVertical ? (
                <>
                    {/* Tokens */}
                    {totalTokens > 0 && (
                        <div className={`mt-2 ${totalTokens >= 10 ? 'p-1 rounded bg-red-500/10 border border-red-500/20' : ''}`}>
                            <div className="flex gap-0.5 flex-wrap justify-center">
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
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm text-amber-900"
                                        style={{ background: TOKEN_GRADIENT.gold }}
                                    >
                                        {player.tokens.gold}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Bonuses */}
                    <div className="mt-2 flex gap-1 flex-wrap justify-center">
                        {GEM_COLORS.map((color) => {
                            const count = bonuses[color] || 0;
                            return (
                                <div key={color} className={`transition-all ${count > 0 ? 'opacity-100' : 'opacity-40'}`}>
                                    <div
                                        className="w-4 h-5 rounded shadow-sm border border-white/20 flex items-center justify-center"
                                        style={{ background: GEM_DOT_STYLE[color] }}
                                    >
                                        <span className="text-[8px] font-black text-white drop-shadow">{count}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Total Power */}
                    <div className="mt-2 flex gap-0.5 flex-wrap justify-center ring-2 ring-amber-500/30 rounded">
                        {GEM_COLORS.map((color) => {
                            const total = (player.tokens[color] || 0) + (bonuses[color] || 0);
                            return (
                                <div
                                    key={color}
                                    className={`w-5 h-5 rounded-full flex items-center justify-center ring-1 ring-amber-500/30 transition-all ${total > 0 ? 'opacity-100' : 'opacity-40'}`}
                                    style={{ background: GEM_GRADIENT[color] }}
                                >
                                    <span className="text-[8px] font-bold">{total}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                /* Top position: tokens and bonuses inline */
                <div className="mt-2 flex gap-3 items-center">
                    {/* Tokens - only show if any */}
                    {totalTokens > 0 && (
                        <div className={`flex gap-0.5 ${totalTokens >= 10 ? 'p-0.5 rounded bg-red-500/10 border border-red-500/20' : ''}`}>
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
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm text-amber-900"
                                    style={{ background: TOKEN_GRADIENT.gold }}
                                >
                                    {player.tokens.gold}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Divider */}
                    {totalTokens > 0 && <div className="w-px h-4 bg-white/10" />}

                    {/* Bonuses */}
                    <div className="flex gap-0.5">
                        {GEM_COLORS.map((color) => {
                            const count = bonuses[color] || 0;
                            return (
                                <div key={color} className={`transition-all ${count > 0 ? 'opacity-100' : 'opacity-40'}`}>
                                    <div
                                        className="w-4 h-5 rounded shadow-sm border border-white/20 flex items-center justify-center"
                                        style={{ background: GEM_DOT_STYLE[color] }}
                                    >
                                        <span className="text-[8px] font-black text-white drop-shadow">{count}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Total Power */}
                    <div className="w-px h-4 bg-white/10" />
                    <div className="flex gap-0.5 px-1.5 py-0.5 rounded ring-2 ring-amber-500/40 bg-amber-500/5">
                        {GEM_COLORS.map((color) => {
                            const total = (player.tokens[color] || 0) + (bonuses[color] || 0);
                            return (
                                <div
                                    key={color}
                                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${total > 0 ? 'opacity-100' : 'opacity-40'}`}
                                    style={{ background: GEM_GRADIENT[color] }}
                                >
                                    <span className="text-[8px] font-bold">{total}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Nobles */}
                    {player.noble_ids.length > 0 && (
                        <>
                            <div className="w-px h-4 bg-white/10" />
                            <div className="flex items-center gap-0.5">
                                {player.noble_ids.map((nid) => (
                                    <span key={nid} className="text-amber-400 text-sm">♛</span>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Nobles for vertical layout */}
            {isVertical && player.noble_ids.length > 0 && (
                <div className="mt-2 flex items-center gap-1 justify-center">
                    {player.noble_ids.map((nid) => (
                        <span key={nid} className="text-amber-400 text-base">♛</span>
                    ))}
                </div>
            )}
        </div>
    );
}
