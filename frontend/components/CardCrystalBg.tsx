'use client';

import { GemColor } from '@/types/game';

interface CardCrystalBgProps {
    bonus: GemColor;
    level: number;
}

// Color palettes for each gem type
const CRYSTAL_COLORS: Record<GemColor, {
    bgGradient: string;
    glowColor: string;
    primaryColor: string;
    secondaryColor: string;
    highlightColor: string;
    lineColor: string;
    sparkleColor: string;
}> = {
    blue: {
        bgGradient: 'linear-gradient(160deg, #0a1a3a 0%, #0d2455 25%, #0a2e6e 50%, #071d50 75%, #040e2a 100%)',
        glowColor: 'rgba(30, 120, 220, 0.35)',
        primaryColor: '#1a4a9a',
        secondaryColor: '#2a5cc0',
        highlightColor: '#4488dd',
        lineColor: '#5599ee',
        sparkleColor: '#c8e8ff',
    },
    white: {
        bgGradient: 'linear-gradient(160deg, #3a3a4a 0%, #4a4a5a 25%, #5a5a6a 50%, #4a4a5a 75%, #3a3a4a 100%)',
        glowColor: 'rgba(200, 200, 220, 0.4)',
        primaryColor: '#8888a0',
        secondaryColor: '#a0a0b8',
        highlightColor: '#d8d8e8',
        lineColor: '#c0c0d8',
        sparkleColor: '#ffffff',
    },
    green: {
        bgGradient: 'linear-gradient(160deg, #0a2a1a 0%, #0d3a25 25%, #0a4a2e 50%, #073a20 75%, #041a0e 100%)',
        glowColor: 'rgba(30, 180, 80, 0.35)',
        primaryColor: '#1a6a3a',
        secondaryColor: '#2a8c4a',
        highlightColor: '#44bb66',
        lineColor: '#55cc77',
        sparkleColor: '#c8ffd8',
    },
    red: {
        bgGradient: 'linear-gradient(160deg, #2a0a0a 0%, #3a0d0d 25%, #4a1010 50%, #3a0d0d 75%, #1a0404 100%)',
        glowColor: 'rgba(220, 50, 50, 0.35)',
        primaryColor: '#8a2a2a',
        secondaryColor: '#aa4040',
        highlightColor: '#dd5555',
        lineColor: '#ee6666',
        sparkleColor: '#ffc8c8',
    },
    black: {
        bgGradient: 'linear-gradient(160deg, #0a0a10 0%, #12121a 25%, #1a1a24 50%, #12121a 75%, #08080c 100%)',
        glowColor: 'rgba(80, 80, 100, 0.4)',
        primaryColor: '#2a2a3a',
        secondaryColor: '#3a3a4a',
        highlightColor: '#5a5a70',
        lineColor: '#6a6a80',
        sparkleColor: '#b8b8c8',
    },
};

export default function CardCrystalBg({ bonus, level }: CardCrystalBgProps) {
    const colors = CRYSTAL_COLORS[bonus] || CRYSTAL_COLORS.white;
    const uid = `${bonus}_${level}`;

    return (
        <div className="absolute inset-0 overflow-hidden">
            {/* Deep gradient background */}
            <div
                className="absolute inset-0"
                style={{ background: colors.bgGradient }}
            />

            {/* Radial glow */}
            <div
                className="absolute inset-0"
                style={{
                    background: `
            radial-gradient(ellipse 60% 70% at 50% 55%, ${colors.glowColor} 0%, transparent 70%),
            radial-gradient(ellipse 30% 30% at 30% 25%, ${colors.glowColor} 0%, transparent 60%),
            radial-gradient(ellipse 25% 25% at 75% 70%, ${colors.glowColor} 0%, transparent 60%)
          `
                }}
            />

            {/* SVG Crystal Art */}
            <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 260 380"
                preserveAspectRatio="xMidYMid slice"
            >
                <defs>
                    <linearGradient id={`sapphireGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={colors.primaryColor} stopOpacity="0.5" />
                        <stop offset="50%" stopColor={colors.secondaryColor} stopOpacity="0.8" />
                        <stop offset="100%" stopColor={colors.primaryColor} stopOpacity="0.4" />
                    </linearGradient>
                    <linearGradient id={`faceLight_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={colors.sparkleColor} stopOpacity="0.7" />
                        <stop offset="100%" stopColor={colors.secondaryColor} stopOpacity="0.1" />
                    </linearGradient>
                    <linearGradient id={`faceDark_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={colors.primaryColor} stopOpacity="0.9" />
                        <stop offset="100%" stopColor={colors.secondaryColor} stopOpacity="0.5" />
                    </linearGradient>
                    <radialGradient id={`gemCore_${uid}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={colors.sparkleColor} stopOpacity="0.9" />
                        <stop offset="40%" stopColor={colors.highlightColor} stopOpacity="0.7" />
                        <stop offset="100%" stopColor={colors.primaryColor} stopOpacity="0.2" />
                    </radialGradient>
                    <filter id={`glow_${uid}`}>
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <filter id={`softglow_${uid}`}>
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                {/* Background geometric crystal shapes */}
                <polygon points="30,310 130,60 230,310" fill={`url(#sapphireGrad_${uid})`} opacity="0.25" />
                <polygon points="0,200 130,80 260,200 260,380 0,380" fill={`url(#faceDark_${uid})`} opacity="0.3" />

                {/* Crystal structure lines */}
                <line x1="130" y1="70" x2="30" y2="210" stroke={colors.lineColor} strokeWidth="0.5" opacity="0.4" />
                <line x1="130" y1="70" x2="230" y2="210" stroke={colors.lineColor} strokeWidth="0.5" opacity="0.4" />
                <line x1="30" y1="210" x2="230" y2="210" stroke={colors.lineColor} strokeWidth="0.5" opacity="0.4" />
                <line x1="130" y1="70" x2="130" y2="310" stroke={colors.sparkleColor} strokeWidth="0.5" opacity="0.35" />
                <line x1="30" y1="210" x2="130" y2="310" stroke={colors.lineColor} strokeWidth="0.5" opacity="0.4" />
                <line x1="230" y1="210" x2="130" y2="310" stroke={colors.lineColor} strokeWidth="0.5" opacity="0.4" />

                {/* Secondary crystal layer */}
                <line x1="80" y1="140" x2="180" y2="140" stroke={colors.secondaryColor} strokeWidth="0.4" opacity="0.3" />
                <line x1="80" y1="140" x2="30" y2="210" stroke={colors.secondaryColor} strokeWidth="0.4" opacity="0.3" />
                <line x1="180" y1="140" x2="230" y2="210" stroke={colors.secondaryColor} strokeWidth="0.4" opacity="0.3" />
                <line x1="80" y1="140" x2="130" y2="310" stroke={colors.secondaryColor} strokeWidth="0.3" opacity="0.25" />
                <line x1="180" y1="140" x2="130" y2="310" stroke={colors.secondaryColor} strokeWidth="0.3" opacity="0.25" />

                {/* Main crystal gem faces */}
                {/* Top face (brightest) */}
                <polygon points="130,88 180,140 80,140" fill={`url(#faceLight_${uid})`} filter={`url(#glow_${uid})`} />
                {/* Left upper face */}
                <polygon points="130,88 80,140 50,185" fill={colors.primaryColor} opacity="0.85" />
                {/* Right upper face */}
                <polygon points="130,88 180,140 210,185" fill={colors.secondaryColor} opacity="0.7" />
                {/* Left lower face */}
                <polygon points="50,185 80,140 130,270" fill={colors.primaryColor} opacity="0.9" />
                {/* Right lower face */}
                <polygon points="210,185 180,140 130,270" fill={colors.secondaryColor} opacity="0.75" />
                {/* Bottom face */}
                <polygon points="50,185 130,270 210,185" fill={colors.primaryColor} opacity="0.95" />

                {/* Inner gem highlight */}
                <polygon points="130,95 170,135 130,175 90,135" fill={`url(#gemCore_${uid})`} filter={`url(#softglow_${uid})`} opacity="0.6" />

                {/* Gem sparkle points */}
                <g filter={`url(#glow_${uid})`} opacity="0.9">
                    <line x1="130" y1="78" x2="130" y2="98" stroke={colors.sparkleColor} strokeWidth="2" />
                    <line x1="120" y1="88" x2="140" y2="88" stroke={colors.sparkleColor} strokeWidth="2" />
                    <line x1="123" y1="81" x2="137" y2="95" stroke={colors.lineColor} strokeWidth="1" />
                    <line x1="137" y1="81" x2="123" y2="95" stroke={colors.lineColor} strokeWidth="1" />
                </g>

                {/* Smaller background crystals */}
                <g opacity="0.35">
                    <polygon points="35,120 55,95 75,120 55,145" fill={colors.secondaryColor} />
                    <line x1="55" y1="95" x2="55" y2="145" stroke={colors.sparkleColor} strokeWidth="0.5" />
                    <line x1="35" y1="120" x2="75" y2="120" stroke={colors.sparkleColor} strokeWidth="0.5" />
                </g>
                <g opacity="0.3">
                    <polygon points="195,155 210,135 225,155 210,175" fill={colors.primaryColor} />
                    <line x1="210" y1="135" x2="210" y2="175" stroke={colors.sparkleColor} strokeWidth="0.5" />
                    <line x1="195" y1="155" x2="225" y2="155" stroke={colors.sparkleColor} strokeWidth="0.5" />
                </g>
                <g opacity="0.25">
                    <polygon points="40,250 55,232 70,250 55,268" fill={colors.primaryColor} />
                    <line x1="55" y1="232" x2="55" y2="268" stroke={colors.lineColor} strokeWidth="0.4" />
                </g>
                <g opacity="0.25">
                    <polygon points="190,250 205,232 220,250 205,268" fill={colors.primaryColor} />
                    <line x1="205" y1="232" x2="205" y2="268" stroke={colors.lineColor} strokeWidth="0.4" />
                </g>

                {/* Fine sparkle dust */}
                <g opacity="0.6" fill={colors.sparkleColor}>
                    <circle cx="72" cy="100" r="1.5" />
                    <circle cx="195" cy="125" r="1" />
                    <circle cx="48" cy="175" r="1" />
                    <circle cx="218" cy="200" r="1.5" />
                    <circle cx="100" cy="280" r="1" />
                    <circle cx="165" cy="290" r="1.2" />
                    <circle cx="28" cy="230" r="0.8" />
                    <circle cx="238" cy="168" r="0.8" />
                </g>

                {/* Level indicator dots */}
                {level >= 1 && <circle cx="224" cy="24" r="5" fill={colors.secondaryColor} stroke={colors.sparkleColor} strokeWidth="1" />}
                {level >= 2 && <circle cx="210" cy="24" r="5" fill={colors.secondaryColor} stroke={colors.sparkleColor} strokeWidth="1" />}
                {level >= 3 && <circle cx="196" cy="24" r="5" fill={colors.secondaryColor} stroke={colors.sparkleColor} strokeWidth="1" />}

                {/* Ornamental corner filigree */}
                <path d="M 8,8 Q 18,8 18,18" fill="none" stroke={colors.lineColor} strokeWidth="0.8" opacity="0.5" />
                <path d="M 8,8 L 8,2 L 14,2" fill="none" stroke={colors.lineColor} strokeWidth="0.8" opacity="0.5" />
                <path d="M 252,8 Q 242,8 242,18" fill="none" stroke={colors.lineColor} strokeWidth="0.8" opacity="0.5" />
                <path d="M 252,8 L 252,2 L 246,2" fill="none" stroke={colors.lineColor} strokeWidth="0.8" opacity="0.5" />
                <path d="M 8,372 Q 18,372 18,362" fill="none" stroke={colors.lineColor} strokeWidth="0.8" opacity="0.5" />
                <path d="M 8,372 L 8,378 L 14,378" fill="none" stroke={colors.lineColor} strokeWidth="0.8" opacity="0.5" />
                <path d="M 252,372 Q 242,372 242,362" fill="none" stroke={colors.lineColor} strokeWidth="0.8" opacity="0.5" />
                <path d="M 252,372 L 252,378 L 246,378" fill="none" stroke={colors.lineColor} strokeWidth="0.8" opacity="0.5" />

                {/* Border frame */}
                <rect x="2" y="2" width="256" height="376" rx="14" ry="14"
                    fill="none" stroke={colors.secondaryColor} strokeWidth="1.5" opacity="0.6" />
                <rect x="5" y="5" width="250" height="370" rx="12" ry="12"
                    fill="none" stroke={colors.lineColor} strokeWidth="0.5" opacity="0.3" />
            </svg>

            {/* Shimmer animation overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden crystal-shimmer" />
        </div>
    );
}
