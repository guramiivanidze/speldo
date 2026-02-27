'use client';

import { Noble, GemColor } from '@/types/game';
import { GEM_GRADIENT, GEM_COLORS } from '@/lib/colors';

interface NobleZoomModalProps {
    noble: Noble;
    onClose: () => void;
}

export default function NobleZoomModal({
    noble,
    onClose,
}: NobleZoomModalProps) {
    const requirementColors = GEM_COLORS.filter((color) => noble.requirements[color as GemColor]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-gradient-to-br from-amber-950 via-slate-800 to-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-amber-500/30"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Noble Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <span className="text-amber-400 text-2xl">♛</span>
                        <span className="text-amber-300 font-bold text-lg">Noble</span>
                    </div>

                    {/* Close button */}
                    <button
                        className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>

                {/* Points */}
                <div className="flex items-center gap-2 mb-6">
                    <span className="text-slate-400 text-sm">Prestige Points:</span>
                    <div className="relative flex items-center justify-center">
                        <svg viewBox="0 0 32 28" className="w-14 h-12" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}>
                            <defs>
                                <linearGradient id="crownGradNoble" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#fde047" />
                                    <stop offset="50%" stopColor="#fbbf24" />
                                    <stop offset="100%" stopColor="#f59e0b" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M2 24 L6 10 L10 16 L16 4 L22 16 L26 10 L30 24 Z"
                                fill="url(#crownGradNoble)"
                                stroke="#fcd34d"
                                strokeWidth="1.5"
                            />
                            <circle cx="6" cy="9" r="2.5" fill="#fcd34d" />
                            <circle cx="16" cy="3" r="2.5" fill="#fcd34d" />
                            <circle cx="26" cy="9" r="2.5" fill="#fcd34d" />
                        </svg>
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[35%] text-amber-900 font-black text-xl">
                            {noble.points}
                        </span>
                    </div>
                </div>

                {/* Requirements */}
                <div className="mb-4">
                    <span className="text-slate-400 text-sm block mb-3">Card Bonuses Required:</span>
                    <div className="flex gap-3 flex-wrap">
                        {requirementColors.map((color) => {
                            const req = noble.requirements[color as GemColor];
                            if (!req) return null;
                            return (
                                <div
                                    key={color}
                                    className="flex items-center gap-2 bg-black/40 rounded-lg px-3 py-2"
                                >
                                    <div
                                        className="w-8 h-8 rounded shadow-lg"
                                        style={{ background: GEM_GRADIENT[color as GemColor] }}
                                    />
                                    <span className="text-white font-bold text-lg">{req}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Info text */}
                <p className="text-slate-500 text-xs mt-4 text-center">
                    Nobles visit you automatically when you have the required card bonuses.
                </p>
            </div>
        </div>
    );
}
