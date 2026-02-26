'use client';

import { useState, useEffect } from 'react';
import { Division, DIVISION_CONFIG } from '@/types/competitive';
import DivisionBadge from './DivisionBadge';

interface RatingChangeDisplayProps {
  oldRating: number;
  newRating: number;
  oldDivision: Division;
  newDivision: Division;
  won: boolean;
  onComplete?: () => void;
}

export default function RatingChangeDisplay({
  oldRating,
  newRating,
  oldDivision,
  newDivision,
  won,
  onComplete,
}: RatingChangeDisplayProps) {
  const [animatedRating, setAnimatedRating] = useState(oldRating);
  const [showDivisionChange, setShowDivisionChange] = useState(false);
  const [phase, setPhase] = useState<'rating' | 'division' | 'complete'>('rating');
  
  const ratingChange = newRating - oldRating;
  const divisionChanged = oldDivision !== newDivision;
  const promoted = divisionChanged && newRating > oldRating;
  
  // Animate rating counter
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;
    const increment = (newRating - oldRating) / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setAnimatedRating(newRating);
        clearInterval(timer);
        
        // Move to division phase after rating animation
        setTimeout(() => {
          if (divisionChanged) {
            setShowDivisionChange(true);
            setPhase('division');
            setTimeout(() => {
              setPhase('complete');
              onComplete?.();
            }, 2000);
          } else {
            setPhase('complete');
            onComplete?.();
          }
        }, 500);
      } else {
        setAnimatedRating(Math.round(oldRating + increment * currentStep));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [oldRating, newRating, divisionChanged, onComplete]);

  const config = DIVISION_CONFIG[newDivision];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="max-w-md w-full mx-4">
        {/* Result Header */}
        <div className="text-center mb-8">
          <div className={`text-6xl mb-4 ${won ? 'animate-bounce' : ''}`}>
            {won ? '🏆' : '😔'}
          </div>
          <h2 className={`text-3xl font-bold ${won ? 'text-yellow-400' : 'text-slate-400'}`}>
            {won ? 'VICTORY!' : 'DEFEAT'}
          </h2>
        </div>

        {/* Rating Card */}
        <div className="glass rounded-2xl p-8 border border-white/10 text-center">
          {/* Rating Animation */}
          <div className="mb-6">
            <div className="text-sm text-slate-400 mb-2">Rating</div>
            <div className="flex items-center justify-center gap-4">
              <span className="text-2xl text-slate-500">{oldRating}</span>
              <span className="text-2xl text-slate-500">→</span>
              <span 
                className="text-5xl font-bold transition-all duration-300"
                style={{ color: config.color }}
              >
                {animatedRating}
              </span>
            </div>
            
            {/* Rating Change Badge */}
            <div className={`
              inline-flex items-center gap-1 mt-4 px-4 py-2 rounded-full text-xl font-bold
              ${ratingChange >= 0 
                ? 'bg-green-900/30 text-green-400' 
                : 'bg-red-900/30 text-red-400'
              }
            `}>
              {ratingChange >= 0 ? '▲' : '▼'}
              {ratingChange >= 0 ? '+' : ''}{ratingChange}
            </div>
          </div>

          {/* Division Change Animation */}
          {showDivisionChange && divisionChanged && (
            <div className={`
              mt-8 p-6 rounded-xl transition-all duration-500
              ${promoted 
                ? 'bg-gradient-to-r from-yellow-900/30 via-yellow-800/30 to-yellow-900/30 border border-yellow-500/30' 
                : 'bg-slate-800/50 border border-slate-600/30'
              }
            `}>
              {promoted ? (
                <>
                  <div className="text-yellow-400 text-lg font-bold mb-4 animate-pulse">
                    🎉 PROMOTED! 🎉
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <DivisionBadge division={oldDivision} size="lg" />
                    <span className="text-2xl text-yellow-400 animate-pulse">→</span>
                    <div className="relative">
                      <DivisionBadge division={newDivision} size="lg" />
                      <div className="absolute inset-0 animate-ping opacity-50">
                        <DivisionBadge division={newDivision} size="lg" />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-slate-400 text-lg font-bold mb-4">
                    Division Changed
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <DivisionBadge division={oldDivision} size="lg" />
                    <span className="text-2xl text-slate-500">→</span>
                    <DivisionBadge division={newDivision} size="lg" />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Current Division */}
          {!showDivisionChange && (
            <div className="mt-6">
              <div className="text-sm text-slate-400 mb-2">Division</div>
              <DivisionBadge division={phase === 'complete' ? newDivision : oldDivision} size="lg" />
            </div>
          )}
        </div>

        {/* Continue Button */}
        {phase === 'complete' && (
          <div className="text-center mt-6 animate-fade-in">
            <button
              onClick={onComplete}
              className="
                px-8 py-3 rounded-xl font-semibold
                bg-indigo-600 hover:bg-indigo-500
                text-white transition-all
              "
            >
              Continue
            </button>
          </div>
        )}
      </div>

      {/* Confetti particles for promotion */}
      {showDivisionChange && promoted && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                backgroundColor: ['#ffd700', '#ff6b6b', '#4ecdc4', '#a78bfa', '#f472b6'][i % 5],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
