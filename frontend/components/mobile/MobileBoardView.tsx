'use client';

import { useState } from 'react';
import { Card, Noble, GemColor, TokenColor } from '@/types/game';
import { GEM_GRADIENT, TOKEN_GRADIENT, TOKEN_LABEL, LEVEL_COLOR, GEM_COLORS } from '@/lib/colors';
import { API_BASE } from '@/lib/api';
import CardZoomModal from './CardZoomModal';
import NobleZoomModal from './NobleZoomModal';

function getImageUrl(card: Card): string | null {
    if (card.background_image) {
        if (card.background_image.startsWith('http')) return card.background_image;
        return `${API_BASE}${card.background_image}`;
    }
    return null; // Return null to show color gradient instead
}

function getNobleImageUrl(noble: Noble): string | null {
    if (noble.background_image) {
        if (noble.background_image.startsWith('http')) return noble.background_image;
        return `${API_BASE}${noble.background_image}`;
    }
    return null;
}

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
    const [zoomedNoble, setZoomedNoble] = useState<Noble | null>(null);
    const levels: ('3' | '2' | '1')[] = ['3', '2', '1'];

    const isPlaying = gameStatus === 'playing';

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Token Bank - Compact */}
            <div className="shrink-0 px-2 py-1.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <button
                        className={`
                            px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold
                            ${isMyTurn && isPlaying
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                                : 'bg-slate-800 text-slate-400 cursor-not-allowed'}
                        `}
                        onClick={isMyTurn && isPlaying ? onOpenTokenSelector : undefined}
                        disabled={!isMyTurn || !isPlaying}
                    >
                        <span>💎</span>
                        <span>Take</span>
                    </button>

                    {/* Bank preview */}
                    <div className="flex gap-1.5 flex-1 justify-center">
                        {GEM_COLORS.map((color) => (
                            <div
                                key={color}
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shadow-sm
                                    ${color === 'white' ? 'text-slate-800' : ''}`}
                                style={{ background: TOKEN_GRADIENT[color] }}
                            >
                                {tokensInBank[color] ?? 0}
                            </div>
                        ))}
                        <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shadow-sm text-slate-900"
                            style={{ background: TOKEN_GRADIENT.gold }}
                        >
                            {tokensInBank.gold ?? 0}
                        </div>
                    </div>
                </div>
            </div>

            {/* Nobles Row - Horizontal Scroll */}
            <div className="shrink-0 px-2 py-1.5 border-b border-white/10">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-amber-400 text-sm">♛</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Nobles</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                    {nobles.map((nid) => {
                        const noble = noblesData[String(nid)];
                        if (!noble) return null;
                        const nobleImage = getNobleImageUrl(noble);
                        return (
                            <button
                                key={nid}
                                className="shrink-0 w-24 h-16 snap-start rounded-lg overflow-hidden border border-amber-500/30 relative transition-transform active:scale-95"
                                onClick={() => setZoomedNoble(noble)}
                            >
                                {/* Background: image or gradient */}
                                {nobleImage ? (
                                    <>
                                        <div
                                            className="absolute inset-0 bg-cover bg-center"
                                            style={{ backgroundImage: `url(${nobleImage})` }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-amber-950/80 to-transparent" />
                                    </>
                                ) : (
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-950 to-slate-900" />
                                )}
                                {/* Content */}
                                <div className="relative z-10 h-full p-2 flex flex-col justify-between">
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
                                                        className="w-2 h-3 rounded-0"
                                                        style={{ background: GEM_GRADIENT[color] }}
                                                    />
                                                    <span className="text-[8px] font-bold text-white">{req}</span>
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

            {/* Card Tiers - Vertical scroll, horizontal per tier */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0">
                {levels.map((level) => (
                    <div key={level} className="bg-slate-800/50 rounded-xl p-2">
                        {/* Tier header */}
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className={`w-2 h-2 rounded-full ${LEVEL_DOT[level]}`} />
                            <span className={`text-xs font-bold ${LEVEL_COLOR[Number(level) as 1 | 2 | 3].replace('bg-', 'text-')}`}>
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
                                const cardImage = getImageUrl(card);

                                return (
                                    <button
                                        key={cardId}
                                        className={`
                      shrink-0 w-20 h-30 snap-start rounded-lg overflow-hidden relative
                      transition-transform active:scale-95
                      ${affordable ? 'ring-2 ring-emerald-400' : ''}
                    `}
                                        onClick={() => setZoomedCard(card)}
                                    >
                                        {/* Background: image or color gradient */}
                                        {cardImage ? (
                                            <>
                                                <div
                                                    className="absolute inset-0 bg-cover bg-center"
                                                    style={{ backgroundImage: `url(${cardImage})` }}
                                                />
                                                <div
                                                    className="absolute inset-0"
                                                    style={{ background: GEM_GRADIENT[card.bonus], opacity: 0.5 }}
                                                />
                                            </>
                                        ) : (
                                            <div
                                                className="absolute inset-0"
                                                style={{ background: GEM_GRADIENT[card.bonus] }}
                                            />
                                        )}
                                        <div className="h-full flex flex-col justify-between p-1.5 relative z-10">
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
                                                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold
                                                                ${color === 'white' ? 'text-slate-800' : ''}`}
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

            {/* Noble Zoom Modal */}
            {zoomedNoble && (
                <NobleZoomModal
                    noble={zoomedNoble}
                    onClose={() => setZoomedNoble(null)}
                />
            )}
        </div>
    );
}
