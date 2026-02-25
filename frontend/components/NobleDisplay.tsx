'use client';

import { Noble } from '@/types/game';
import { GEM_COLORS, GEM_DOT_STYLE } from '@/lib/colors';

interface NobleDisplayProps {
  noble: Noble;
  compact?: boolean;
}

export default function NobleDisplay({ noble, compact = false }: NobleDisplayProps) {
  if (compact) {
    return (
      <div
        className="noble-tile rounded-lg flex flex-col items-center gap-1 border border-amber-500/40"
        style={{ width: 58, padding: '6px 4px' }}
      >
        {/* Points */}
        <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center font-black text-xs text-amber-900 shadow-md">
          {noble.points}
        </div>
        {/* Requirements */}
        <div className="flex flex-col gap-0.5 w-full px-1">
          {GEM_COLORS.map((color) => {
            const req = noble.requirements[color];
            if (!req) return null;
            return (
              <div key={color} className="flex items-center justify-between">
                <div
                  className="gem-orb"
                  style={{ width: 10, height: 10, background: GEM_DOT_STYLE[color], flexShrink: 0 }}
                />
                <span className="text-[9px] font-bold text-amber-200">{req}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="noble-tile rounded-xl flex flex-col border border-amber-500/30"
      style={{ width: 88, padding: '10px 8px' }}
    >
      {/* Crown + points */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-amber-400 text-base leading-none">♛</span>
        <div className="
          w-7 h-7 rounded-full
          bg-gradient-to-br from-amber-300 to-amber-600
          flex items-center justify-center
          font-black text-sm text-amber-900
          shadow-md
        ">
          {noble.points}
        </div>
      </div>

      {/* Separator */}
      <div className="w-full h-px bg-amber-500/20 mb-2" />

      {/* Requirements */}
      <div className="flex flex-col gap-1">
        {GEM_COLORS.map((color) => {
          const req = noble.requirements[color];
          if (!req) return null;
          return (
            <div key={color} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className="gem-orb shrink-0"
                  style={{ width: 12, height: 12, background: GEM_DOT_STYLE[color] }}
                />
              </div>
              <div className="flex gap-0.5">
                {[...Array(req)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-sm"
                    style={{ width: 7, height: 7, background: GEM_DOT_STYLE[color], opacity: 0.85 }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
