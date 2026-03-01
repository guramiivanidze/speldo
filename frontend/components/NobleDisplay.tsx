'use client';

import { Noble } from '@/types/game';
import { GEM_COLORS, GEM_DOT_STYLE } from '@/lib/colors';
import { API_BASE } from '@/lib/api';

interface NobleDisplayProps {
  noble: Noble;
  compact?: boolean;
  mini?: boolean;
}

// Helper to get noble image URL
function getNobleImageUrl(noble: Noble): string | null {
  if (noble.background_image) {
    if (noble.background_image.startsWith('http')) return noble.background_image;
    return `${API_BASE}${noble.background_image}`;
  }
  // Return null to show amber gradient instead
  return null;
}

export default function NobleDisplay({ noble, compact = false, mini = false }: NobleDisplayProps) {
  const bgImage = getNobleImageUrl(noble);

  // Mini version - small square badge showing just points
  if (mini) {
    return (
      <div
        className="relative rounded-lg overflow-hidden border border-amber-500/60 shadow-md h-full w-full"
        title={`Noble: ${noble.points} points`}
      >
        {/* Background: image or amber gradient */}
        {bgImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900" />
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30" />
        
        {/* Crown + Points centered */}
        <div className="relative h-full flex items-center justify-center">
          <div className="flex flex-col items-center">
            <span className="text-amber-300 text-xs leading-none drop-shadow">♛</span>
            <span className="text-white font-black text-sm leading-none drop-shadow-md">
              {noble.points}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className="relative rounded-xl overflow-hidden border border-amber-500/50 shadow-lg group h-full w-full"
      >
        {/* Background: image or amber gradient */}
        {bgImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-700 via-amber-800 to-amber-950" />
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-amber-950/90 via-amber-900/50 to-amber-800/30" />
        
        {/* Content */}
        <div className="relative h-full flex flex-col justify-between p-1.5">
          {/* Points badge - top right - Crown shape */}
          <div className="flex justify-end">
            <div className="relative flex items-center justify-center">
              <svg viewBox="0 0 32 28" className="w-7 h-6" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
                <defs>
                  <linearGradient id="crownGradNobleCompact" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fcd34d" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <path
                  d="M2 24 L6 10 L10 16 L16 4 L22 16 L26 10 L30 24 Z"
                  fill="url(#crownGradNobleCompact)"
                  stroke="#fde047"
                  strokeWidth="1"
                />
                <circle cx="6" cy="9" r="2" fill="#fde047" />
                <circle cx="16" cy="3" r="2" fill="#fde047" />
                <circle cx="26" cy="9" r="2" fill="#fde047" />
              </svg>
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[35%] text-amber-900 font-black text-[10px]">
                {noble.points}
              </span>
            </div>
          </div>
          
          {/* Requirements - bottom */}
          <div className="flex gap-1.5 justify-center flex-wrap">
            {GEM_COLORS.map((color) => {
              const req = noble.requirements[color];
              if (!req) return null;
              return (
                <div
                  key={color}
                  className="flex items-center gap-1 bg-black/50 rounded-md px-1.5 py-1"
                >
                  <div
                    className=" rounded border border-white/0 shadow-sm"
                    style={{ width: 14, height: 17, background: GEM_DOT_STYLE[color] }}
                  />
                  <span className="text-xs font-bold text-white">{req}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-amber-500/40 shadow-xl group h-full w-full"
    >
      {/* Background: image or amber gradient */}
      {bgImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-700 via-amber-800 to-amber-950" />
      )}
      {/* Elegant overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-amber-950/95 via-amber-900/60 to-transparent" />
      
      {/* Gold border effect */}
      <div className="absolute inset-0 border-2 border-amber-400/20 rounded-xl" />
      
      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-2">
        {/* Top - Crown + Points */}
        <div className="flex items-start justify-between">
          <span className="text-amber-400 text-sm leading-none drop-shadow-lg">♛</span>
          <div className="relative flex items-center justify-center">
            <svg viewBox="0 0 32 28" className="w-9 h-8" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}>
              <defs>
                <linearGradient id="crownGradNobleFull" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="50%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
              <path
                d="M2 24 L6 10 L10 16 L16 4 L22 16 L26 10 L30 24 Z"
                fill="url(#crownGradNobleFull)"
                stroke="#fcd34d"
                strokeWidth="1.5"
              />
              <circle cx="6" cy="9" r="2.5" fill="#fcd34d" />
              <circle cx="16" cy="3" r="2.5" fill="#fcd34d" />
              <circle cx="26" cy="9" r="2.5" fill="#fcd34d" />
            </svg>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[35%] text-amber-900 font-black text-sm">
              {noble.points}
            </span>
          </div>
        </div>

        {/* Bottom - Requirements */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2">
          <div className="flex gap-2 justify-center flex-wrap">
            {GEM_COLORS.map((color) => {
              const req = noble.requirements[color];
              if (!req) return null;
              return (
                <div
                  key={color}
                  className="flex items-center gap-1"
                >
                  <div
                    className="rounded-full shadow-sm border-2 border-white/40"
                    style={{ width: 16, height: 16, background: GEM_DOT_STYLE[color] }}
                  />
                  <span className="text-sm font-bold text-amber-100">{req}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
