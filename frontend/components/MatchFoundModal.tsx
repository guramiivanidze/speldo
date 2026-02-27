'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MatchFoundData, DIVISION_CONFIG, OpponentInfo } from '@/types/competitive';
import DivisionBadge from './DivisionBadge';

interface MatchFoundModalProps {
  matchData: MatchFoundData;
  onClose?: () => void;
}

export default function MatchFoundModal({ matchData, onClose }: MatchFoundModalProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  
  const { opponent, opponents, game_code, player_count } = matchData;
  
  // Get list of opponents (support both legacy single opponent and new multiplayer)
  const allOpponents: OpponentInfo[] = opponents || (opponent ? [opponent] : []);
  const isMultiplayer = allOpponents.length > 1;

  // Countdown and auto-redirect
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(`/game/${game_code}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [game_code, router]);

  const handleJoinNow = () => {
    router.push(`/game/${game_code}`);
  };

  const renderOpponent = (opp: OpponentInfo, index: number) => {
    const config = DIVISION_CONFIG[opp.division];
    return (
      <div key={index} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-xl">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
          style={{ 
            backgroundColor: config.bgColor,
            border: `2px solid ${config.color}`,
          }}
        >
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-100 truncate">{opp.username}</div>
          <div className="flex items-center gap-2 mt-1">
            <DivisionBadge division={opp.division} size="sm" />
            <span className="text-sm" style={{ color: config.color }}>{opp.rating}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="max-w-md w-full mx-4 animate-fade-in">
        {/* Match Found Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-4 animate-bounce">⚔️</div>
          <h2 className="text-3xl font-bold text-yellow-400 animate-pulse">
            MATCH FOUND!
          </h2>
          {isMultiplayer && (
            <p className="text-slate-400 mt-2">{player_count || allOpponents.length + 1}-Player Ranked Match</p>
          )}
        </div>

        {/* Opponents Card */}
        <div className="glass rounded-2xl p-6 border border-yellow-500/30">
          <div className="text-center text-sm text-slate-400 mb-4">
            {isMultiplayer ? 'Your Opponents' : 'Your Opponent'}
          </div>
          
          {isMultiplayer ? (
            // Multiplayer: show list of opponents
            <div className="space-y-3">
              {allOpponents.map((opp, i) => renderOpponent(opp, i))}
            </div>
          ) : allOpponents[0] ? (
            // Single opponent: original detailed view
            (() => {
              const config = DIVISION_CONFIG[allOpponents[0].division];
              return (
                <div className="flex items-center justify-center gap-6">
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center text-4xl animate-glow-pulse"
                    style={{ 
                      backgroundColor: config.bgColor,
                      border: `3px solid ${config.color}`,
                    }}
                  >
                    {config.icon}
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-bold text-slate-100 mb-2">
                      {allOpponents[0].username}
                    </div>
                    <DivisionBadge division={allOpponents[0].division} size="md" />
                    <div className="mt-2 text-lg font-semibold" style={{ color: config.color }}>
                      {allOpponents[0].rating} Rating
                    </div>
                  </div>
                </div>
              );
            })()
          ) : null}

          {/* VS Decoration */}
          <div className="my-6 flex items-center justify-center">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
            <span className="px-4 text-2xl font-bold text-slate-500">VS</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
          </div>

          {/* Countdown */}
          <div className="text-center">
            <div className="text-slate-400 text-sm mb-2">Game starts in</div>
            <div className="text-4xl font-bold text-yellow-400">{countdown}</div>
          </div>

          {/* Join Now Button */}
          <button
            onClick={handleJoinNow}
            className="
              w-full mt-6 py-3 rounded-xl font-semibold
              bg-gradient-to-r from-indigo-600 to-purple-600
              hover:from-indigo-500 hover:to-purple-500
              text-white transition-all
            "
          >
            Join Now
          </button>
        </div>

        {/* Game Code */}
        <div className="text-center mt-4 text-sm text-slate-500">
          Game Code: <span className="font-mono text-slate-400">{game_code}</span>
        </div>
      </div>
    </div>
  );
}
