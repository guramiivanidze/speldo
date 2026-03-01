'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/types/game';
import CardDisplay from './CardDisplay';

interface ReservedCardsModalProps {
  reservedCardIds: number[];
  cardsData: Record<string, Card>;
  onBuyCard?: (cardId: number) => void;
  canAffordCard?: (cardId: number) => boolean;
  onClose: () => void;
}

export default function ReservedCardsModal({
  reservedCardIds,
  cardsData,
  onBuyCard,
  canAffordCard,
  onClose,
}: ReservedCardsModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 bg-slate-900 rounded-2xl p-6 max-w-lg w-full mx-4 border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-indigo-400">◈</span>
            Reserved Cards
            <span className="text-sm text-slate-400 font-normal">
              ({reservedCardIds.length}/3)
            </span>
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Cards */}
        {reservedCardIds.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            No reserved cards
          </div>
        ) : (
          <div className="flex gap-3 justify-center flex-wrap">
            {reservedCardIds.map((cid) => {
              const card = cardsData[String(cid)];
              if (!card) return null;
              const affordable = canAffordCard ? canAffordCard(cid) : false;
              return (
                <div key={cid} className="w-24 h-32">
                  <CardDisplay
                    card={card}
                    onBuy={onBuyCard ? () => { onBuyCard(cid); onClose(); } : undefined}
                    canBuy={!!onBuyCard && affordable}
                    showActions={!!onBuyCard}
                    compact
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}
