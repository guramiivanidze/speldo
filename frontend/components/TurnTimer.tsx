'use client';

import { useState, useEffect, useRef } from 'react';

interface TurnTimerProps {
  /** Current player index - timer resets when this changes */
  currentPlayerIndex: number;
  /** Called when timer reaches 0 */
  onTimeout: () => void;
  /** Whether it's my turn */
  isMyTurn: boolean;
  /** Current player's username */
  currentPlayerName: string;
}

export default function TurnTimer({
  currentPlayerIndex,
  onTimeout,
  isMyTurn,
  currentPlayerName,
}: TurnTimerProps) {
  const [seconds, setSeconds] = useState(40);
  const prevPlayerIndexRef = useRef(currentPlayerIndex);
  const onTimeoutRef = useRef(onTimeout);

  // Keep onTimeout ref updated
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // Reset timer ONLY when turn changes (player index changes)
  useEffect(() => {
    if (currentPlayerIndex !== prevPlayerIndexRef.current) {
      prevPlayerIndexRef.current = currentPlayerIndex;
      setSeconds(40);
    }
  }, [currentPlayerIndex]);

  // Countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 0) {
          onTimeoutRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const isWarning = seconds <= 10;
  const isCritical = seconds <= 5;

  return (
    <div className={`
      flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm font-semibold
      transition-all duration-300
      ${isCritical 
        ? 'bg-red-600/30 border border-red-500/50 text-red-300 animate-pulse' 
        : isWarning 
          ? 'bg-amber-600/30 border border-amber-500/50 text-amber-300' 
          : 'bg-slate-700/50 border border-slate-600/50 text-slate-300'
      }
    `}>
      <svg 
        className={`w-4 h-4 ${isCritical ? 'animate-spin' : ''}`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
      
      <span className={isCritical ? 'text-base' : ''}>{seconds}s</span>
      
      {isMyTurn ? (
        <span className="text-xs text-emerald-400">Your turn</span>
      ) : (
        <span className="text-xs opacity-70 truncate max-w-[80px]">
          {currentPlayerName}
        </span>
      )}
    </div>
  );
}
