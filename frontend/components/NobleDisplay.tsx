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
          {/* Points badge - top right */}
          <div className="flex justify-end">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center font-black text-xs text-amber-900 shadow-md border border-amber-200/50">
              {noble.points}
            </div>
          </div>
          
          {/* Requirements - bottom */}
          <div className="flex gap-1 justify-center flex-wrap">
            {GEM_COLORS.map((color) => {
              const req = noble.requirements[color];
              if (!req) return null;
              return (
                <div
                  key={color}
                  className="flex items-center gap-0.5 bg-black/40 rounded px-1 py-0.5"
                >
                  <div
                    className="border border-white/30 shadow-sm"
                    style={{ width: 10, height: 10, background: GEM_DOT_STYLE[color] }}
                  />
                  <span className="text-[9px] font-bold text-white">{req}</span>
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
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 flex items-center justify-center font-black text-sm text-amber-900 shadow-lg border-2 border-amber-200/50">
            {noble.points}
          </div>
        </div>

        {/* Bottom - Requirements */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-1.5">
          <div className="flex gap-1.5 justify-center flex-wrap">
            {GEM_COLORS.map((color) => {
              const req = noble.requirements[color];
              if (!req) return null;
              return (
                <div
                  key={color}
                  className="flex items-center gap-0.5"
                >
                  <div
                    className="shadow-sm border border-white/30"
                    style={{ width: 12, height: 12, background: GEM_DOT_STYLE[color] }}
                  />
                  <span className="text-[10px] font-bold text-amber-100">{req}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
