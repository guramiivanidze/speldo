'use client';

import { TokenColor, GemColor } from '@/types/game';
import { TOKEN_GRADIENT, TOKEN_LABEL, GEM_COLORS } from '@/lib/colors';

interface MobileTokenSelectorProps {
  tokensInBank: Record<TokenColor, number>;
  selectedTokens: TokenColor[];
  onSelectToken: (color: TokenColor) => void;
  onConfirm: () => void;
  onCancel: () => void;
  disabledColors: TokenColor[];
}

export default function MobileTokenSelector({
  tokensInBank,
  selectedTokens,
  onSelectToken,
  onConfirm,
  onCancel,
  disabledColors,
}: MobileTokenSelectorProps) {
  // Count selections per color
  const selectionCounts: Partial<Record<TokenColor, number>> = {};
  for (const t of selectedTokens) {
    selectionCounts[t] = (selectionCounts[t] || 0) + 1;
  }

  const hasTwoSameColor = selectedTokens.length === 2 && selectedTokens[0] === selectedTokens[1];
  
  // Determine valid action text
  const getActionText = () => {
    if (selectedTokens.length === 0) return 'Select tokens';
    if (hasTwoSameColor) return `Take 2 ${selectedTokens[0]} tokens`;
    return `Take ${selectedTokens.length} different tokens`;
  };

  const canConfirm = selectedTokens.length > 0 && (
    selectedTokens.length === 3 ||
    (selectedTokens.length === 2 && hasTwoSameColor) ||
    (selectedTokens.length === 1) ||
    (selectedTokens.length === 2 && !hasTwoSameColor)
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Select Tokens</h2>
          <button
            className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>
        <p className="text-slate-400 text-sm mt-1">{getActionText()}</p>
      </div>

      {/* Rules reminder */}
      <div className="px-4 py-2 bg-slate-800/50 text-xs text-slate-400">
        <p>• Take 3 different colors OR</p>
        <p>• Take 2 of same color (if 4+ available)</p>
      </div>

      {/* Token grid */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="grid grid-cols-3 gap-4">
          {GEM_COLORS.map((color) => {
            const count = tokensInBank[color] ?? 0;
            const selected = selectionCounts[color] || 0;
            const disabled = disabledColors.includes(color) || count === 0;
            const canTakeTwo = count >= 4;

            return (
              <button
                key={color}
                className={`
                  w-20 h-20 rounded-2xl flex flex-col items-center justify-center gap-1
                  transition-all active:scale-95 relative
                  ${disabled 
                    ? 'opacity-40 cursor-not-allowed' 
                    : 'cursor-pointer hover:scale-105'}
                  ${selected > 0 
                    ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900' 
                    : ''}
                  ${color === 'white' ? 'text-slate-800' : ''}
                `}
                style={{ background: TOKEN_GRADIENT[color] }}
                onClick={() => !disabled && onSelectToken(color)}
                disabled={disabled}
              >
                <span className="text-2xl font-black drop-shadow-lg">
                  {count}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {TOKEN_LABEL[color]}
                </span>

                {/* Selection badge */}
                {selected > 0 && (
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 border-slate-900 shadow-lg">
                    {selected}
                  </div>
                )}

                {/* Can take 2 indicator */}
                {canTakeTwo && selected === 0 && !disabled && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500/80 text-[8px] text-white font-bold px-1.5 py-0.5 rounded-full">
                    ×2
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected tokens preview */}
      {selectedTokens.length > 0 && (
        <div className="px-4 py-3 bg-slate-800/80 border-t border-white/10">
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-slate-400">Taking:</span>
            <div className="flex gap-1">
              {selectedTokens.map((color, idx) => (
                <div
                  key={idx}
                  className="w-8 h-8 rounded-full shadow-lg"
                  style={{ background: TOKEN_GRADIENT[color] }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="p-4 flex gap-3 bg-slate-900 border-t border-white/10">
        <button
          className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className={`
            flex-1 py-3 rounded-xl font-bold transition-all
            ${canConfirm
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
              : 'bg-slate-600 text-slate-400 cursor-not-allowed'}
          `}
          onClick={canConfirm ? onConfirm : undefined}
          disabled={!canConfirm}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
