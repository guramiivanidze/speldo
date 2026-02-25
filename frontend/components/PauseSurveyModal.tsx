'use client';

import { useEffect, useState } from 'react';

interface PauseSurveyModalProps {
  leftUsername: string;
  pauseRemainingSeconds: number | null;
  myVote: 'wait' | 'end' | null;
  allVotes: Record<string, 'wait' | 'end'>;
  players: { id: number; username: string; is_online: boolean }[];
  onVote: (vote: 'wait' | 'end') => void;
}

export default function PauseSurveyModal({
  leftUsername,
  pauseRemainingSeconds,
  myVote,
  allVotes,
  players,
  onVote,
}: PauseSurveyModalProps) {
  const [remainingTime, setRemainingTime] = useState(pauseRemainingSeconds || 0);

  // Countdown timer
  useEffect(() => {
    if (pauseRemainingSeconds !== null) {
      setRemainingTime(pauseRemainingSeconds);
    }
  }, [pauseRemainingSeconds]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTime((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const onlinePlayers = players.filter((p) => p.is_online);
  const votedCount = Object.keys(allVotes).length;
  const waitVotes = Object.values(allVotes).filter((v) => v === 'wait').length;
  const endVotes = Object.values(allVotes).filter((v) => v === 'end').length;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">⏸️</div>
          <h2 className="text-xl font-bold text-slate-100">Game Paused</h2>
          <p className="text-slate-400 text-sm mt-1">
            <span className="text-amber-400 font-semibold">{leftUsername}</span> has left the game
          </p>
        </div>

        {/* Timer */}
        <div className="bg-slate-800/60 rounded-xl px-4 py-3 mb-6 text-center">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
            Time remaining to rejoin
          </p>
          <span className="text-3xl font-mono font-bold text-amber-400">
            {formatTime(remainingTime)}
          </span>
        </div>

        {/* Vote Buttons */}
        {!myVote ? (
          <div className="space-y-3 mb-6">
            <p className="text-sm text-slate-300 text-center mb-4">
              What would you like to do?
            </p>
            <button
              onClick={() => onVote('wait')}
              className="w-full py-3 rounded-xl font-bold text-sm
                bg-gradient-to-r from-emerald-600 to-teal-600
                hover:from-emerald-500 hover:to-teal-500
                text-white shadow-lg transition-all active:scale-[.98]"
            >
              Wait for Player
            </button>
            <button
              onClick={() => onVote('end')}
              className="w-full py-3 rounded-xl font-bold text-sm
                bg-gradient-to-r from-red-600 to-rose-600
                hover:from-red-500 hover:to-rose-500
                text-white shadow-lg transition-all active:scale-[.98]"
            >
              End Game
            </button>
          </div>
        ) : (
          <div className="bg-slate-800/60 rounded-xl px-4 py-4 mb-6 text-center">
            <p className="text-sm text-slate-400">
              You voted to{' '}
              <span className={myVote === 'wait' ? 'text-emerald-400' : 'text-red-400'}>
                {myVote === 'wait' ? 'wait' : 'end the game'}
              </span>
            </p>
          </div>
        )}

        {/* Vote Status */}
        <div className="border-t border-slate-700 pt-4">
          <p className="text-xs text-slate-500 text-center mb-3">
            Votes: {votedCount} / {onlinePlayers.length} players
          </p>
          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-400">Wait: {waitVotes}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-slate-400">End: {endVotes}</span>
            </div>
          </div>
          
          {/* Player votes list */}
          <div className="mt-4 space-y-1">
            {onlinePlayers.map((p) => {
              const vote = allVotes[String(p.id)];
              return (
                <div key={p.id} className="flex items-center justify-between px-3 py-1.5 bg-slate-800/40 rounded-lg">
                  <span className="text-xs text-slate-300">{p.username}</span>
                  {vote ? (
                    <span className={`text-xs font-semibold ${vote === 'wait' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {vote === 'wait' ? '⏳ Wait' : '🚫 End'}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Voting...</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Info text */}
        <p className="text-[10px] text-slate-500 text-center mt-4">
          If all players vote to wait, you will be asked again in 1 minute.
          <br />
          If any player votes to end, the game will end.
        </p>
      </div>
    </div>
  );
}
