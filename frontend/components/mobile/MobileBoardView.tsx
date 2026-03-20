'use client';

import { useState, useEffect } from 'react';
import { Card, Noble, GemColor, TokenColor } from '@/types/game';
import { GEM_GRADIENT, TOKEN_GRADIENT, TOKEN_LABEL, LEVEL_COLOR, GEM_COLORS } from '@/lib/colors';
import { API_BASE } from '@/lib/api';
import CardZoomModal from './CardZoomModal';
import NobleZoomModal from './NobleZoomModal';
import CardCrystalBg from '../CardCrystalBg';

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
    newCardId?: number | null;  // The card that just appeared for animation
    hintCardId?: number | null;
    hintAction?: 'buy' | 'reserve' | null;
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
    newCardId = null,
    hintCardId = null,
    hintAction = null,
}: MobileBoardViewProps) {
    const [zoomedCard, setZoomedCard] = useState<Card | null>(null);
    const [zoomedNoble, setZoomedNoble] = useState<Noble | null>(null);
    const [showNoblesPanel, setShowNoblesPanel] = useState(false);

    const levels: ('3' | '2' | '1')[] = ['3', '2', '1'];

    const isPlaying = gameStatus === 'playing';

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Floating indicators on the left */}
            <div className="absolute left-2 top-40 z-30 flex flex-col gap-2">
                {/* Nobles indicator */}
                <button
                    onClick={() => setShowNoblesPanel(!showNoblesPanel)}
                    className={`
                        w-10 h-10 rounded-xl flex items-center justify-center shadow-lg
                        ${showNoblesPanel 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-slate-800/90 text-amber-400 border border-amber-500/30'}
                        transition-all active:scale-95
                    `}
                >
                    <span className="text-lg">♛</span>
                </button>
                
                {/* Bank indicator - opens token selector */}
                <button
                    onClick={() => onOpenTokenSelector()}
                    className={`
                        w-10 h-10 rounded-xl flex items-center justify-center shadow-lg
                        bg-slate-800/90 text-indigo-400 border border-indigo-500/30
                        transition-all active:scale-95
                    `}
                >
                    <span className="text-lg">💎</span>
                </button>
            </div>

            {/* Nobles Slide-in Panel */}
            <div 
                className={`
                    absolute inset-x-0 top-0 z-20 bg-slate-900/95 backdrop-blur-sm
                    border-b border-amber-500/30 shadow-lg
                    transition-transform duration-300 ease-out
                    ${showNoblesPanel ? 'translate-y-0' : '-translate-y-full'}
                `}
            >
                <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-amber-400 text-sm">♛</span>
                            <span className="text-xs text-slate-300 font-semibold">Nobles</span>
                        </div>
                        <button 
                            onClick={() => setShowNoblesPanel(false)}
                            className="text-slate-400 p-1"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {nobles.map((nid) => {
                            const noble = noblesData[String(nid)];
                            if (!noble) return null;
                            const nobleImage = getNobleImageUrl(noble);
                            return (
                                <button
                                    key={nid}
                                    className="shrink-0 w-24 h-16 rounded-lg overflow-hidden border border-amber-500/30 relative transition-transform active:scale-95"
                                    onClick={() => { setZoomedNoble(noble); setShowNoblesPanel(false); }}
                                >
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
            </div>

            {/* Card Tiers - Full height now */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0">
                {levels.map((level) => (
                    <div key={level} className="bg-slate-800/50 rounded-xl p-2">
                        {/* Tier header */}
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className={`w-2 h-2 rounded-full ${LEVEL_DOT[level]}`} />
                            <span className={`text-xs font-bold ${LEVEL_COLOR[Number(level) as 1 | 2 | 3].replace('bg-', 'text-')}`}>
                                Tier {ROMAN[Number(level)]}
                            </span>
                            {(deckCounts[level] ?? 0) > 0 && (
                                <button
                                    className={`
                      ml-auto px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5
                      ${isMyTurn && canReserveMore && isPlaying
                                            ? 'bg-amber-600/80 text-white animate-pulse shadow-lg shadow-amber-500/30'
                                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'}
                    `}
                                    onClick={() => {
                                        if (isMyTurn && canReserveMore && (deckCounts[level] ?? 0) > 0 && isPlaying) {
                                            onReserveCard(undefined, Number(level));
                                        }
                                    }}
                                >
                                    <span className="text-[11px]">📥</span>
                                    Reserve from deck ({deckCounts[level]})
                                </button>
                            )}
                        </div>

                        {/* Cards - Horizontal scroll */}
                        <div className="flex gap-2 overflow-x-auto py-1 px-1 -mx-1 snap-x snap-mandatory scrollbar-hide">
                            {(visibleCards[level] || []).map((cardId) => {
                                const card = cardsData[String(cardId)];
                                if (!card) return null;
                                const affordable = canAfford(cardId);
                                const cardImage = getImageUrl(card);
                                const isNewCard = newCardId === cardId;

                                return (
                                    <button
                                        key={cardId}
                                        className={`
                      shrink-0 w-20 h-30 snap-start rounded-lg overflow-hidden relative
                      transition-transform active:scale-95
                      ${affordable ? 'ring-2 ring-emerald-400' : ''}
                      ${isNewCard ? 'new-card-appear' : ''}
                      ${hintCardId === cardId && hintAction === 'buy' ? 'hint-buy' : ''}
                      ${hintCardId === cardId && hintAction === 'reserve' ? 'hint-reserve' : ''}
                    `}
                                        onClick={() => setZoomedCard(card)}
                                    >
                                        {/* Background: image or crystal */}
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
                                            <div className="absolute inset-0">
                                                <CardCrystalBg bonus={card.bonus} level={card.level as 1 | 2 | 3} />
                                            </div>
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
