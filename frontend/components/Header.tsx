'use client';

import Link from 'next/link';
import { useGameHeader } from '@/contexts/GameHeaderContext';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { headerState } = useGameHeader();
  const { showLeaveButton, gameCode, connected, onLeaveGame } = headerState;
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-[#0b0f1a]/80 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center gap-3">
        {/* Gem row accent */}
        <div className="flex gap-1">
          {['#f1f5f9','#3b82f6','#10b981','#ef4444','#475569','#fde047'].map((c, i) => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ background: c, opacity: .8 }} />
          ))}
        </div>
        <Link href="/" className="text-base font-black tracking-widest uppercase gold-text hover:opacity-80 transition-opacity">
          Splendor
        </Link>
        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider hidden sm:block">
          Online
        </span>
        
        {/* Navigation links - show when logged in and not in a game */}
        {user && !gameCode && (
          <nav className="hidden sm:flex items-center gap-4 ml-6">
            <Link href="/leaderboard" className="text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors">
              Leaderboard
            </Link>
            <Link href="/profile" className="text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors">
              My Profile
            </Link>
          </nav>
        )}
      </div>

      {/* Right side - game controls */}
      <div className="flex items-center gap-3">
        {gameCode && (
          <>
            <span className="font-mono font-bold text-slate-300 text-xs">{gameCode}</span>
            <div
              className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
              title={connected ? 'Connected' : 'Disconnected'}
            />
          </>
        )}
        
        {showLeaveButton && onLeaveGame && (
          <button
            className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-400 text-xs font-semibold rounded-lg transition-all"
            onClick={onLeaveGame}
          >
            Leave Game
          </button>
        )}
      </div>
    </header>
  );
}
