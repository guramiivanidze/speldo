'use client';

import { useState } from 'react';
import { AdvisedMove } from '@/lib/api';
import { Card } from '@/types/game';

// ── Colour helpers ────────────────────────────────────────

const GEM_COLORS: Record<string, string> = {
  white: '#e2e8f0',
  blue:  '#60a5fa',
  green: '#34d399',
  red:   '#f87171',
  black: '#6b7280',
  gold:  '#fbbf24',
};

function GemPip({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full border border-white/30 mx-0.5"
      style={{ background: GEM_COLORS[color] ?? '#888' }}
    />
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const barColor =
    pct >= 80 ? '#34d399' :
    pct >= 55 ? '#fbbf24' :
                '#f87171';
  return (
    <div className="flex items-center gap-1.5 text-xs text-white/60">
      <span>Confidence</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span style={{ color: barColor }}>{pct}%</span>
    </div>
  );
}

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };

function CardLabel({ card }: { card: Card }) {
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="text-white/50">Tier {ROMAN[card.level]}</span>
      <GemPip color={card.bonus} />
      {card.points > 0 && (
        <span className="bg-amber-400 text-amber-900 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
          {card.points}
        </span>
      )}
    </span>
  );
}

// ── Move label ────────────────────────────────────────────

function MoveLabel({ advice, cardsData }: { advice: AdvisedMove; cardsData?: Record<string, Card> }) {
  if (advice.action === 'take_gems' && advice.gems) {
    const entries = Object.entries(advice.gems).filter(([, n]) => n > 0);
    const discardEntries = advice.discard_gems
      ? Object.entries(advice.discard_gems).filter(([, n]) => n > 0)
      : [];
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-white/70 text-xs">Take:</span>
          {entries.map(([color, count]) =>
            Array.from({ length: count as number }, (_, i) => (
              <GemPip key={`${color}-${i}`} color={color} />
            ))
          )}
        </div>
        {discardEntries.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-red-400 text-xs font-semibold">Return:</span>
            {discardEntries.map(([color, count]) =>
              Array.from({ length: count as number }, (_, i) => (
                <GemPip key={`discard-${color}-${i}`} color={color} />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  if (advice.action === 'buy_card') {
    const card = advice.card_id != null ? cardsData?.[String(advice.card_id)] : undefined;
    return (
      <span className="flex items-center gap-1.5 text-xs text-white/70">
        Buy
        {card ? <CardLabel card={card} /> : <span className="text-white/50">card</span>}
      </span>
    );
  }

  if (advice.action === 'reserve_card') {
    if (
      typeof advice.reserve_card_id === 'string' &&
      advice.reserve_card_id.startsWith('deck_tier')
    ) {
      const tier = advice.reserve_card_id.replace('deck_tier', '');
      return (
        <span className="text-xs text-white/70">
          Reserve <span className="text-white/80">Tier {ROMAN[Number(tier)]} deck</span>
        </span>
      );
    }
    const card =
      advice.reserve_card_id != null
        ? cardsData?.[String(advice.reserve_card_id)]
        : undefined;
    return (
      <span className="flex items-center gap-1.5 text-xs text-white/70">
        Reserve
        {card ? <CardLabel card={card} /> : <span className="text-white/50">card</span>}
      </span>
    );
  }

  return null;
}

// ── Strategy panel ────────────────────────────────────────

function StrategyPanel({ strategy }: { strategy: AdvisedMove['strategy'] }) {
  const isUrgent = strategy.biggestThreat.startsWith('URGENT');
  return (
    <div className="mt-2 space-y-1 text-xs">
      <div className="flex gap-1">
        <span className="text-white/40 shrink-0">Goal:</span>
        <span className="text-white/80">{strategy.currentGoal}</span>
      </div>
      <div className="flex gap-1">
        <span className="text-white/40 shrink-0">Threat:</span>
        <span className={isUrgent ? 'text-red-400 font-semibold' : 'text-white/80'}>
          {strategy.biggestThreat}
        </span>
      </div>
      <div className="flex gap-1">
        <span className="text-white/40 shrink-0">Next:</span>
        <span className="text-white/80">{strategy.nextTurnPlan}</span>
      </div>
      {strategy.turnsToWin > 0 && strategy.turnsToWin < 20 && (
        <div className="flex gap-1">
          <span className="text-white/40 shrink-0">~Turns to win:</span>
          <span className="text-white/80">{strategy.turnsToWin}</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────

interface AdvisorHintProps {
  advice: AdvisedMove;
  isYourTurn: boolean;
  cardsData?: Record<string, Card>;
  /** When false, renders inline (no fixed positioning) — caller controls placement */
  floating?: boolean;
}

export function AdvisorHint({ advice, isYourTurn, cardsData, floating = true }: AdvisorHintProps) {
  const [expanded, setExpanded] = useState(true);
  const [showStrategy, setShowStrategy] = useState(false);

  const pulseClass = isYourTurn ? 'ring-1 ring-emerald-400/60' : 'ring-1 ring-white/10';

  return (
    <div
      className={`
        ${floating ? 'fixed bottom-24 right-4 z-40' : ''}
        w-full rounded-xl
        bg-gray-900/95 backdrop-blur-sm
        shadow-2xl shadow-black/50
        ${pulseClass}
        transition-all duration-300
      `}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-t-xl
                   hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-lg leading-none">🧠</span>
          <span className="text-xs font-semibold text-white/90 tracking-wide">
            AI Advisor
          </span>
          {isYourTurn && (
            <span className="ml-1 text-xs text-emerald-400 font-medium">
              • Your turn
            </span>
          )}
        </div>
        <span className="text-white/40 text-xs">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Recommended action badge */}
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1.5">
            <span className="text-lg leading-none">
              {advice.action === 'take_gems'    ? '💎' :
               advice.action === 'buy_card'     ? '🃏' :
                                                  '🔒'}
            </span>
            <MoveLabel advice={advice} cardsData={cardsData} />
          </div>

          {/* Discard notice for reserve (gaining gold pushes over 10) */}
          {advice.action === 'reserve_card' && advice.discard_gems &&
           Object.values(advice.discard_gems).some(n => (n ?? 0) > 0) && (
            <div className="flex items-center gap-1 flex-wrap bg-red-500/10 rounded-lg px-2 py-1">
              <span className="text-red-400 text-xs font-semibold">Return:</span>
              {Object.entries(advice.discard_gems)
                .filter(([, n]) => (n ?? 0) > 0)
                .map(([color, count]) =>
                  Array.from({ length: count as number }, (_, i) => (
                    <GemPip key={`rd-${color}-${i}`} color={color} />
                  ))
                )}
            </div>
          )}

          {/* Reasoning */}
          <p className="text-xs text-white/75 leading-relaxed">
            {advice.reasoning}
          </p>

          {/* Confidence bar */}
          <ConfidenceBar value={advice.confidence} />

          {/* Alternative move */}
          {advice.alternative_move && (
            <div className="text-xs text-white/40 border-t border-white/5 pt-1.5">
              Alt:{' '}
              <span className="text-white/60">
                {advice.alternative_move.action === 'take_gems' ? 'take different gems' :
                 advice.alternative_move.action === 'buy_card'  ? `buy card #${advice.alternative_move.card_id}` :
                 'reserve a card'}
              </span>
            </div>
          )}

          {/* Strategy toggle */}
          <button
            onClick={() => setShowStrategy(v => !v)}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            {showStrategy ? '▾ Hide strategy' : '▸ Show strategy'}
          </button>

          {showStrategy && <StrategyPanel strategy={advice.strategy} />}
        </div>
      )}
    </div>
  );
}
