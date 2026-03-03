'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useGameHeader } from '@/contexts/GameHeaderContext';
import { useAuth } from '@/contexts/AuthContext';
import { getPendingFriendRequests, logout } from '@/lib/api';

export default function Header() {
  const { headerState } = useGameHeader();
  const { showLeaveButton, gameCode, connected, onLeaveGame } = headerState;
  const { user, clearAuth } = useAuth();
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  // Fetch friend requests once when logged in (on page load/refresh)
  useEffect(() => {
    if (!user) {
      setFriendRequestCount(0);
      return;
    }

    const checkFriendRequests = async () => {
      try {
        const data = await getPendingFriendRequests();
        setFriendRequestCount(data.count || 0);
      } catch {
        // Silently fail
      }
    };

    checkFriendRequests();
  }, [user]);

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
            <Link href="/profile" className="text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors relative">
              My Profile
              {friendRequestCount > 0 && (
                <span className="absolute -top-1 -right-3 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] text-white items-center justify-center font-bold">
                    {friendRequestCount > 9 ? '9+' : friendRequestCount}
                  </span>
                </span>
              )}
            </Link>
          </nav>
        )}
      </div>

      {/* Right side - game controls */}
      <div className="flex items-center gap-3">
        {/* Mobile friend notification - only show when not in game */}
        {user && !gameCode && friendRequestCount > 0 && (
          <Link 
            href="/profile" 
            className="sm:hidden relative p-2"
            title={`${friendRequestCount} friend request${friendRequestCount > 1 ? 's' : ''}`}
          >
            <span className="text-lg">👥</span>
            <span className="absolute top-0 right-0 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] text-white items-center justify-center font-bold">
                {friendRequestCount > 9 ? '9+' : friendRequestCount}
              </span>
            </span>
          </Link>
        )}
        
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
        
        {/* Sign out - desktop only, when not in a game */}
        {user && !gameCode && (
          <button
            className="hidden lg:block px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-400 transition-colors"
            onClick={async () => { await logout(); clearAuth(); }}
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}
