'use client';

import { TokenColor } from '@/types/game';
import { TOKEN_GRADIENT, TOKEN_TEXT, TOKEN_LABEL, TOKEN_SYMBOL } from '@/lib/colors';

interface TokenProps {
  color: TokenColor;
  count: number;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  inactive?: boolean;
  selectionCount?: number;
}

const TOKEN_SIZES = {
  sm: { outer: 32, inner: 22, text: 11 },
  md: { outer: 44, inner: 30, text: 13 },
  lg: { outer: 54, inner: 38, text: 15 },
};

export default function Token({
  color, count, onClick, selected, disabled,
  size = 'md', inactive = false, selectionCount = 0,
}: TokenProps) {
  const s = TOKEN_SIZES[size];
  const isClickable = !!onClick && !disabled && count > 0 && !inactive;

  return (
    <button
      className={`
        token-chip rounded-full border-0 outline-none
        flex items-center justify-center relative
        font-black select-none
        ${TOKEN_TEXT[color]}
        ${selected ? 'token-selected' : ''}
        ${isClickable ? 'cursor-pointer' : 'cursor-default'}
        ${(disabled || count === 0 || inactive) ? 'opacity-40' : ''}
      `}
      style={{
        width: s.outer,
        height: s.outer,
        background: TOKEN_GRADIENT[color],
        fontSize: s.text,
      }}
      onClick={isClickable ? onClick : undefined}
      title={`${TOKEN_LABEL[color]}: ${count}`}
      disabled={disabled}
      data-inactive={inactive || undefined}
    >
      {/* Inner highlight ring */}
      <span
        className="absolute rounded-full pointer-events-none"
        style={{
          width: s.inner,
          height: s.inner,
          background: 'rgba(255,255,255,0.12)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <span className="relative z-10 leading-none">{count}</span>
      
      {/* Selection count badge */}
      {selectionCount > 0 && (
        <span
          className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold
                     rounded-full min-w-[18px] h-[18px] flex items-center justify-center
                     border-2 border-slate-900 shadow-lg z-20"
        >
          {selectionCount}
        </span>
      )}
    </button>
  );
}

interface TokenRowProps {
  tokens: Partial<Record<TokenColor, number>>;
  onClickToken?: (color: TokenColor) => void;
  selectedTokens?: TokenColor[];
  selectionCounts?: Partial<Record<TokenColor, number>>;
  disabledColors?: TokenColor[];
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  vertical?: boolean;
}

export function TokenRow({
  tokens,
  onClickToken,
  selectedTokens = [],
  selectionCounts = {},
  disabledColors = [],
  size = 'md',
  showLabel = true,
  vertical = false,
}: TokenRowProps) {
  const all: TokenColor[] = ['white', 'blue', 'green', 'red', 'black', 'gold'];
  return (
    <div className={vertical ? 'flex flex-col gap-2 items-center' : 'flex gap-2 flex-wrap items-end'}>
      {all.map((color) => {
        const count = tokens[color] ?? 0;
        return (
          <div key={color} className="flex flex-col items-center gap-1">
            <Token
              color={color}
              count={count}
              onClick={onClickToken ? () => onClickToken(color) : undefined}
              selected={selectedTokens.includes(color)}
              selectionCount={selectionCounts[color] || 0}
              disabled={disabledColors.includes(color)}
              size={size}
            />
            {showLabel && (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                {TOKEN_LABEL[color].slice(0, 3)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
