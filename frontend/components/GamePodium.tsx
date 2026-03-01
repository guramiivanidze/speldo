'use client';

import { useState, useEffect, useMemo } from 'react';

interface Player {
  id: number;
  username: string;
  prestige_points: number;
  purchased_card_ids: number[];
  noble_ids: number[];
}

interface GamePodiumProps {
  players: Player[];
  winnerId: number | null;
  currentUserId: number;
}

// Firework particle
interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  vx: number;
  vy: number;
  life: number;
  delay: number;
}

const FIREWORK_COLORS = [
  '#fde047', // yellow
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // purple
  '#3b82f6', // blue
  '#22d3ee', // cyan
  '#10b981', // green
];

const PODIUM_COLORS = {
  1: {
    bg: 'linear-gradient(180deg, #fde047 0%, #d97706 100%)',
    border: 'border-yellow-400',
    text: 'text-yellow-900',
    shadow: 'shadow-yellow-500/50',
    glow: 'shadow-[0_0_30px_rgba(253,224,71,0.5)]',
  },
  2: {
    bg: 'linear-gradient(180deg, #cbd5e1 0%, #64748b 100%)',
    border: 'border-slate-300',
    text: 'text-slate-800',
    shadow: 'shadow-slate-400/50',
    glow: '',
  },
  3: {
    bg: 'linear-gradient(180deg, #d97706 0%, #92400e 100%)',
    border: 'border-amber-600',
    text: 'text-amber-900',
    shadow: 'shadow-amber-600/50',
    glow: '',
  },
};

export default function GamePodium({ players, winnerId, currentUserId }: GamePodiumProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showFireworks, setShowFireworks] = useState(true);

  // Sort players by score
  const rankedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (b.prestige_points !== a.prestige_points) {
        return b.prestige_points - a.prestige_points;
      }
      // Tiebreaker: fewer cards
      return a.purchased_card_ids.length - b.purchased_card_ids.length;
    });
  }, [players]);

  // Generate fireworks on mount
  useEffect(() => {
    if (!showFireworks) return;

    const createBurst = (centerX: number, centerY: number, delay: number) => {
      const newParticles: Particle[] = [];
      const particleCount = 12 + Math.floor(Math.random() * 8);
      
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.3;
        const speed = 2 + Math.random() * 3;
        newParticles.push({
          id: Date.now() + i + Math.random(),
          x: centerX,
          y: centerY,
          color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
          size: 3 + Math.random() * 4,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          delay,
        });
      }
      return newParticles;
    };

    // Initial bursts at different positions
    const allParticles: Particle[] = [
      ...createBurst(50, 30, 0),
      ...createBurst(80, 20, 200),
      ...createBurst(20, 25, 400),
      ...createBurst(65, 35, 600),
      ...createBurst(35, 25, 800),
    ];

    setParticles(prev => [...prev, ...allParticles]);

    // Additional bursts periodically
    const interval = setInterval(() => {
      const x = 20 + Math.random() * 60;
      const y = 15 + Math.random() * 30;
      setParticles(prev => [...prev, ...createBurst(x, y, 0)]);
    }, 1500);

    // Stop fireworks after 8 seconds
    const timeout = setTimeout(() => {
      setShowFireworks(false);
      clearInterval(interval);
    }, 8000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [showFireworks]);

  // Animate particles
  useEffect(() => {
    if (particles.length === 0) return;

    const animate = () => {
      setParticles(prev => 
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx * 0.5,
            y: p.y + p.vy * 0.5 + 0.1, // gravity
            vy: p.vy + 0.08,
            life: p.life - 0.02,
          }))
          .filter(p => p.life > 0)
      );
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [particles]);

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '👑';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  // Podium layout: 2nd - 1st - 3rd for top 3, or 2nd - 1st for 2 players
  const podiumOrder = rankedPlayers.slice(0, 3);
  const restPlayers = rankedPlayers.slice(3);
  
  // Reorder for visual: [2nd, 1st, 3rd] so 1st place is in center (tallest)
  const visualOrder = podiumOrder.length >= 3 
    ? [podiumOrder[1], podiumOrder[0], podiumOrder[2]]
    : podiumOrder.length === 2
      ? [podiumOrder[1], podiumOrder[0]]  // 2nd on left, 1st on right
      : podiumOrder;
  const podiumHeights = podiumOrder.length >= 3 
    ? [80, 100, 60] 
    : podiumOrder.length === 2 
      ? [80, 100]
      : [100];
  const actualRanks = podiumOrder.length >= 3 
    ? [2, 1, 3] 
    : podiumOrder.length === 2 
      ? [2, 1]
      : [1];

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Fireworks layer */}
      {showFireworks && particles.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {particles.map(p => (
            p.delay <= 0 && (
              <div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  opacity: p.life,
                  boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )
          ))}
        </div>
      )}

      {/* Podium section */}
      <div className="glass rounded-2xl p-6 border border-slate-700">
        <h4 className="text-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">
          Final Standings
        </h4>

        {/* 3D Podium */}
        <div className="flex items-end justify-center gap-2 mb-6" style={{ minHeight: 180 }}>
          {visualOrder.map((player, visualIndex) => {
            const rank = actualRanks[visualIndex];
            const height = podiumHeights[visualIndex];
            const isWinner = rank === 1;
            const isMe = player.id === currentUserId;
            const style = PODIUM_COLORS[rank as 1 | 2 | 3] || PODIUM_COLORS[3];
            const initials = player.username.slice(0, 2).toUpperCase();

            return (
              <div
                key={player.id}
                className={`flex flex-col items-center transition-all duration-500 ${isWinner ? 'scale-110' : ''}`}
                style={{ 
                  animationDelay: `${visualIndex * 150}ms`,
                }}
              >
                {/* Player info - above podium */}
                <div className={`mb-2 text-center ${isWinner ? 'animate-bounce' : ''}`}>
                  <div className="text-2xl mb-1">{getRankEmoji(rank)}</div>
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black shadow-lg mb-1 ${style.glow}`}
                    style={{ 
                      background: isMe 
                        ? 'linear-gradient(135deg, #6366f1, #4338ca)' 
                        : 'linear-gradient(135deg, #475569, #1e293b)',
                      border: isMe ? '2px solid #818cf8' : '2px solid transparent',
                    }}
                  >
                    {initials}
                  </div>
                  <div className={`text-xs font-bold truncate max-w-[80px] ${isWinner ? 'text-amber-300' : 'text-slate-300'}`}>
                    {player.username}
                  </div>
                  {isMe && (
                    <span className="text-[9px] bg-indigo-500/30 text-indigo-300 rounded-full px-1.5 py-0.5 font-semibold">
                      you
                    </span>
                  )}
                </div>

                {/* Podium block */}
                <div
                  className={`w-20 rounded-t-lg flex flex-col items-center justify-start pt-3 shadow-xl transition-all duration-700 ${style.border} border-2 border-b-0`}
                  style={{ 
                    height,
                    background: style.bg,
                  }}
                >
                  <span className={`text-2xl font-black ${style.text}`}>
                    {player.prestige_points}
                  </span>
                  <span className={`text-[10px] font-bold ${style.text} opacity-70`}>
                    pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4th place and beyond */}
        {restPlayers.length > 0 && (
          <div className="border-t border-slate-700 pt-4 mt-2">
            <div className="flex flex-wrap justify-center gap-3">
              {restPlayers.map((player, idx) => {
                const rank = idx + 4;
                const isMe = player.id === currentUserId;
                const initials = player.username.slice(0, 2).toUpperCase();
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      isMe ? 'bg-indigo-500/20 border border-indigo-500/40' : 'bg-slate-800/50 border border-slate-700/40'
                    }`}
                  >
                    <span className="text-slate-500 font-bold text-sm">#{rank}</span>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
                      style={{ 
                        background: isMe 
                          ? 'linear-gradient(135deg, #6366f1, #4338ca)' 
                          : 'linear-gradient(135deg, #475569, #1e293b)',
                      }}
                    >
                      {initials}
                    </div>
                    <span className={`text-sm font-medium ${isMe ? 'text-indigo-300' : 'text-slate-300'}`}>
                      {player.username}
                    </span>
                    <span className="text-sm font-bold text-slate-400">
                      {player.prestige_points}pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
