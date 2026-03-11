'use client';

import { Noble } from '@/types/game';
import { GEM_COLORS, GEM_DOT_STYLE } from '@/lib/colors';
import { API_BASE } from '@/lib/api';

interface NobleChoiceModalProps {
  eligibleNobles: Noble[];
  onChoose: (nobleId: number) => void;
}

// Helper to get noble image URL
function getNobleImageUrl(noble: Noble): string | null {
  if (noble.background_image) {
    if (noble.background_image.startsWith('http')) return noble.background_image;
    return `${API_BASE}${noble.background_image}`;
  }
  return null;
}

export default function NobleChoiceModal({
  eligibleNobles,
  onChoose,
}: NobleChoiceModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl border border-amber-500/30">
        <div className="text-center mb-4">
          <span className="text-amber-400 text-3xl mb-2 block">♛</span>
          <h2 className="text-xl font-bold text-amber-300 mb-1">
            Noble Visit
          </h2>
          <p className="text-slate-300 text-sm">
            Multiple nobles wish to visit you. Choose one to receive this turn.
          </p>
        </div>

        <div className="flex gap-4 justify-center flex-wrap mb-4">
          {eligibleNobles.map((noble) => {
            const bgImage = getNobleImageUrl(noble);
            return (
              <button
                key={noble.id}
                onClick={() => onChoose(noble.id)}
                className="relative rounded-xl overflow-hidden border-2 border-amber-500/50 shadow-xl group 
                         w-32 h-40 transition-all duration-200 
                         hover:border-amber-400 hover:scale-105 hover:shadow-amber-500/30 hover:shadow-2xl
                         focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900"
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
                
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-amber-400/10" />
                
                {/* Content */}
                <div className="relative h-full flex flex-col justify-between p-2">
                  {/* Top - Crown + Points */}
                  <div className="flex items-start justify-between">
                    <span className="text-amber-400 text-sm leading-none drop-shadow-lg">♛</span>
                    <div className="relative flex items-center justify-center">
                      <svg viewBox="0 0 32 28" className="w-9 h-8" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}>
                        <defs>
                          <linearGradient id={`crownGradChoice${noble.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#fde68a" />
                            <stop offset="50%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#d97706" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M2 24 L6 10 L10 16 L16 4 L22 16 L26 10 L30 24 Z"
                          fill={`url(#crownGradChoice${noble.id})`}
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
                              className="rounded-full shadow-sm border border-white/40"
                              style={{ width: 12, height: 12, background: GEM_DOT_STYLE[color] }}
                            />
                            <span className="text-xs font-bold text-amber-100">{req}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Select label on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <span className="bg-amber-500 text-amber-950 text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    Select
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-slate-500 text-xs text-center">
          You can only claim one noble per turn. The other noble(s) may visit on future turns.
        </p>
      </div>
    </div>
  );
}
