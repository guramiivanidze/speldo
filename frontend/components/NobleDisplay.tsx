'use client';

import { Noble } from '@/types/game';
import { GEM_COLORS, GEM_DOT_STYLE } from '@/lib/colors';

interface NobleDisplayProps {
  noble: Noble;
  compact?: boolean;
}

// Noble portrait images - elegant royal/historical themed backgrounds
const NOBLE_IMAGES: string[] = [
  'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=200&h=300&fit=crop', // Royal texture
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=300&fit=crop', // Portrait style
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=300&fit=crop', // Noble portrait
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=300&fit=crop', // Elegant figure
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=300&fit=crop', // Royal person
];

export default function NobleDisplay({ noble, compact = false }: NobleDisplayProps) {
  // Use noble id to pick consistent image
  const imageIndex = noble.id % NOBLE_IMAGES.length;
  const bgImage = NOBLE_IMAGES[imageIndex];

  if (compact) {
    return (
      <div
        className="relative rounded-xl overflow-hidden border border-amber-500/50 shadow-lg group h-full w-full"
      >
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
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
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
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
