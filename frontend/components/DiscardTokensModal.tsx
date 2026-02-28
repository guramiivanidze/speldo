'use client';

import { useState, useEffect } from 'react';
import { TokenColor } from '@/types/game';
import { TOKEN_GRADIENT, TOKEN_TEXT, TOKEN_LABEL, GEM_COLORS } from '@/lib/colors';

interface DiscardTokensModalProps {
  playerTokens: Record<TokenColor, number>;
  discardCount: number;
  onDiscard: (tokens: Record<string, number>) => void;
  onCancel?: () => void;
}

const ALL_TOKEN_COLORS: TokenColor[] = [...GEM_COLORS, 'gold'];

export default function DiscardTokensModal({
  playerTokens,
  discardCount,
  onDiscard,
  onCancel,
}: DiscardTokensModalProps) {
  const [selectedToDiscard, setSelectedToDiscard] = useState<Record<TokenColor, number>>({
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0,
    gold: 0,
  });

  // Reset when discardCount changes
  useEffect(() => {
    setSelectedToDiscard({
      white: 0,
      blue: 0,
      green: 0,
      red: 0,
      black: 0,
      gold: 0,
    });
  }, [discardCount]);

  const totalSelected = Object.values(selectedToDiscard).reduce((sum, c) => sum + c, 0);
  const canConfirm = totalSelected === discardCount;

  function handleIncrement(color: TokenColor) {
    if (totalSelected >= discardCount) return;
    if (selectedToDiscard[color] >= (playerTokens[color] || 0)) return;
    setSelectedToDiscard((prev) => ({ ...prev, [color]: prev[color] + 1 }));
  }

  function handleDecrement(color: TokenColor) {
    if (selectedToDiscard[color] <= 0) return;
    setSelectedToDiscard((prev) => ({ ...prev, [color]: prev[color] - 1 }));
  }

  function handleConfirm() {
    if (!canConfirm) return;
    // Filter out zero values
    const toDiscard: Record<string, number> = {};
    for (const [color, count] of Object.entries(selectedToDiscard)) {
      if (count > 0) toDiscard[color] = count;
    }
    onDiscard(toDiscard);
  }

  // Get colors with tokens
  const colorsWithTokens = ALL_TOKEN_COLORS.filter((c) => (playerTokens[c] || 0) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-white/20">
        <h2 className="text-xl font-bold text-amber-300 mb-2 text-center">
          Return Tokens
        </h2>
        <p className="text-slate-300 text-sm text-center mb-4">
          You have more than 10 tokens. Return <span className="text-amber-400 font-bold">{discardCount}</span> token{discardCount > 1 ? 's' : ''}.
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {colorsWithTokens.map((color) => {
            const have = playerTokens[color] || 0;
            const selected = selectedToDiscard[color];
            const canAdd = totalSelected < discardCount && selected < have;
            const canRemove = selected > 0;

            return (
              <div
                key={color}
                className="flex items-center justify-between bg-slate-800/60 rounded-lg px-4 py-2"
              >
                {/* Token chip */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white/30"
                    style={{ background: TOKEN_GRADIENT[color] }}
                  >
                    <span className={`text-lg font-bold ${TOKEN_TEXT[color]}`}>
                      {have}
                    </span>
                  </div>
                  <span className="text-slate-200 text-sm">{TOKEN_LABEL[color]}</span>
                </div>

                {/* +/- controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDecrement(color)}
                    disabled={!canRemove}
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all ${
                      canRemove
                        ? 'bg-red-500 hover:bg-red-400 text-white'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-amber-300 font-bold">
                    {selected}
                  </span>
                  <button
                    onClick={() => handleIncrement(color)}
                    disabled={!canAdd}
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all ${
                      canAdd
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selection progress */}
        <div className="text-center mb-4">
          <span className={`text-sm ${canConfirm ? 'text-emerald-400' : 'text-slate-400'}`}>
            Selected: {totalSelected} / {discardCount}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-lg font-bold transition-all bg-slate-600 hover:bg-slate-500 text-slate-200"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`${onCancel ? 'flex-1' : 'w-full'} py-3 rounded-lg font-bold transition-all ${
              canConfirm
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            Confirm Return
          </button>
        </div>
      </div>
    </div>
  );
}
