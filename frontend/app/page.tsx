'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { register, login, logout, listGames, createGame, joinGame, getMyGames, getMyProfile, getCurrentSeason } from '@/lib/api';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import type { PlayerProfile, Season } from '@/types/competitive';
import DivisionBadge from '@/components/DivisionBadge';
import MatchFoundModal from '@/components/MatchFoundModal';

interface GameInfo {
  id: string;
  code: string;
  player_count: number;
  max_players: number;
  status?: string;
}

const GEM_COLORS_HEX = ['#f1f5f9', '#3b82f6', '#10b981', '#ef4444', '#475569', '#fde047'];

export default function Home() {
  const { user, loading, setUser, clearAuth } = useAuth();
  const router = useRouter();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [openGames, setOpenGames] = useState<GameInfo[]>([]);
  const [myGames, setMyGames] = useState<GameInfo[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [actionError, setActionError] = useState('');
  
  // Competitive state
  const [rankedProfile, setRankedProfile] = useState<PlayerProfile | null>(null);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [rankedPlayerCount, setRankedPlayerCount] = useState(2);
  
  // Matchmaking
  const { 
    status: matchmakingStatus, 
    matchFound, 
    error: matchmakingError, 
    connected: matchmakingConnected,
    joinQueue, 
    leaveQueue,
    clearMatchFound
  } = useMatchmaking();

  async function fetchGames() {
    try {
      const [open, mine] = await Promise.all([listGames(), getMyGames()]);
      setOpenGames(open);
      setMyGames(mine);
    } catch { /* ignore */ }
  }
  
  async function fetchCompetitiveData() {
    try {
      const [profile, season] = await Promise.all([
        getMyProfile().catch(() => null),
        getCurrentSeason().catch(() => null)
      ]);
      setRankedProfile(profile);
      setCurrentSeason(season);
    } catch { /* ignore */ }
  }

  useEffect(() => { 
    if (user) {
      fetchGames();
      fetchCompetitiveData();
    }
  }, [user]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const fn = authMode === 'login' ? login : register;
      const u = await fn(username, password);
      setUser(u);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Error');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCreate() {
    setActionError('');
    try {
      const game = await createGame(maxPlayers);
      router.push(`/game/${game.code}`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleJoin() {
    setActionError('');
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    try {
      await joinGame(code);
      router.push(`/game/${code}`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="flex gap-1.5">
          {GEM_COLORS_HEX.map((c, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full animate-bounce"
              style={{ background: c, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Auth screen ──────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="flex gap-2 justify-center mb-4">
            {GEM_COLORS_HEX.map((c, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full shadow-lg"
                style={{
                  background: c,
                  boxShadow: `0 0 12px ${c}88`,
                }}
              />
            ))}
          </div>
          <h1 className="text-4xl font-black gold-text mb-2 tracking-wide">SPLENDOR</h1>
          <p className="text-slate-400 text-sm">The Renaissance gem trading game, online</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 w-full max-w-sm border border-white/8">
          <div className="flex gap-1 mb-6 p-1 bg-slate-800/60 rounded-lg">
            {(['login', 'register'] as const).map((mode) => (
              <button
                key={mode}
                className={`
                  flex-1 py-1.5 rounded-md text-sm font-semibold transition-all
                  ${authMode === mode
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'}
                `}
                onClick={() => setAuthMode(mode)}
              >
                {mode === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth} className="flex flex-col gap-3">
            <input
              className="
                w-full px-4 py-2.5 rounded-xl
                bg-slate-800 border border-slate-700
                text-slate-100 placeholder-slate-500
                focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
                transition-colors text-sm
              "
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
            <input
              type="password"
              className="
                w-full px-4 py-2.5 rounded-xl
                bg-slate-800 border border-slate-700
                text-slate-100 placeholder-slate-500
                focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
                transition-colors text-sm
              "
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
            />

            {authError && (
              <div className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="
                w-full py-2.5 rounded-xl font-bold text-sm
                bg-gradient-to-r from-indigo-600 to-indigo-500
                hover:from-indigo-500 hover:to-indigo-400
                text-white shadow-lg transition-all active:scale-[.98]
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {authLoading ? '...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Lobby ────────────────────────────────────────────
  const statusColor: Record<string, string> = {
    playing: 'bg-emerald-400',
    waiting: 'bg-amber-400',
    finished: 'bg-slate-500',
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Welcome bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black text-slate-100">
            Welcome back, <span className="gold-text">{user.username}</span>
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Ready to trade gems?</p>
        </div>
        <button
          className="text-xs text-slate-500 hover:text-red-400 transition-colors font-semibold underline underline-offset-2"
          onClick={async () => { await logout(); clearAuth(); }}
        >
          Sign out
        </button>
      </div>

      {actionError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
          {actionError}
        </div>
      )}

      {/* Casual Play Section */}
      <div className="mb-8">
        <h3 className="font-bold text-slate-300 flex items-center gap-2 mb-4">
          <span className="text-lg">🎮</span> Casual Play
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Create */}
          <div className="glass rounded-2xl p-6 border border-white/5">
            <h3 className="font-bold text-slate-200 mb-1">New Game</h3>
            <p className="text-slate-500 text-xs mb-4">Create a room and invite friends</p>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-400">Players:</span>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                className={`
                  w-9 h-9 rounded-xl text-sm font-bold transition-all active:scale-95
                  ${maxPlayers === n
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'}
                `}
                onClick={() => setMaxPlayers(n)}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            className="
              w-full py-2.5 rounded-xl font-bold text-sm
              bg-gradient-to-r from-indigo-600 to-violet-600
              hover:from-indigo-500 hover:to-violet-500
              text-white shadow-lg transition-all active:scale-[.98]
            "
            onClick={handleCreate}
          >
            Create Room
          </button>
        </div>

        {/* Join */}
        <div className="glass rounded-2xl p-6 border border-white/5">
          <h3 className="font-bold text-slate-200 mb-1">Join by Code</h3>
          <p className="text-slate-500 text-xs mb-4">Enter a 6-character room code</p>

          <div className="flex gap-2">
            <input
              className="
                flex-1 px-4 py-2.5 rounded-xl text-center
                bg-slate-800 border border-slate-700
                text-slate-100 placeholder-slate-600
                text-sm font-mono font-bold uppercase tracking-widest
                focus:outline-none focus:border-indigo-500
                transition-colors
              "
              placeholder="XXXXXX"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button
              className="
                px-5 py-2.5 rounded-xl font-bold text-sm
                bg-emerald-600 hover:bg-emerald-500
                text-white transition-all active:scale-95
              "
              onClick={handleJoin}
            >
              Join
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Ranked Play Section */}
      <div className="glass rounded-2xl p-6 border border-amber-500/20 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-amber-300 flex items-center gap-2">
              <span className="text-lg">⚔️</span> Ranked Play
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              {currentSeason ? `Season: ${currentSeason.name}` : 'Compete for rating and climb the leaderboard'}
            </p>
          </div>
          {rankedProfile && (
            <div className="flex items-center gap-3">
              <DivisionBadge division={rankedProfile.division} size="md" />
              <div className="text-right">
                <div className="text-lg font-bold text-slate-100">{rankedProfile.rating}</div>
                <div className="text-[10px] text-slate-500">Rating</div>
              </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {rankedProfile ? (
            <>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-emerald-400">{rankedProfile.ranked_wins}</div>
                <div className="text-[10px] text-slate-500">Wins</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-red-400">{rankedProfile.ranked_losses}</div>
                <div className="text-[10px] text-slate-500">Losses</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-slate-300">{rankedProfile.win_rate.toFixed(0)}%</div>
                <div className="text-[10px] text-slate-500">Win Rate</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-amber-400">{rankedProfile.peak_rating}</div>
                <div className="text-[10px] text-slate-500">Peak</div>
              </div>
            </>
          ) : (
            <div className="col-span-4 text-center py-4 text-slate-500 text-sm">
              Play ranked games to start tracking your stats!
            </div>
          )}
        </div>
        
        {/* Find Match Button */}
        <div className="mb-4">
          {/* Player Count Selector */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-slate-400">Players:</span>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                disabled={matchmakingStatus?.in_queue}
                className={`
                  w-9 h-9 rounded-xl text-sm font-bold transition-all active:scale-95
                  ${rankedPlayerCount === n
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/25'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                onClick={() => setRankedPlayerCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
          {matchmakingStatus?.in_queue ? (
            <div className="bg-slate-800/80 rounded-xl p-4 border border-amber-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-300 font-semibold text-sm">
                    Searching for {(matchmakingStatus.player_count || rankedPlayerCount) - 1} opponent{(matchmakingStatus.player_count || rankedPlayerCount) > 2 ? 's' : ''}...
                  </span>
                </div>
                <span className="text-slate-500 text-xs">
                  {matchmakingStatus.wait_time_seconds ? `${Math.floor(matchmakingStatus.wait_time_seconds / 60)}:${String(matchmakingStatus.wait_time_seconds % 60).padStart(2, '0')}` : '0:00'}
                </span>
              </div>
              
              {/* Lobby Players Display */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400">
                    Players in lobby ({matchmakingStatus.lobby_players?.length || 1}/{matchmakingStatus.player_count || rankedPlayerCount})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {matchmakingStatus.lobby_players?.map((player, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-1.5 border border-slate-600/50"
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold text-white">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-200 font-medium">{player.username}</span>
                      <span className="text-[10px] text-slate-500">{player.rating}</span>
                    </div>
                  ))}
                  {/* Empty slots */}
                  {Array.from({ length: (matchmakingStatus.player_count || rankedPlayerCount) - (matchmakingStatus.lobby_players?.length || 1) }).map((_, idx) => (
                    <div 
                      key={`empty-${idx}`}
                      className="flex items-center gap-2 bg-slate-800/30 rounded-lg px-3 py-1.5 border border-dashed border-slate-700"
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-700/50 flex items-center justify-center">
                        <span className="text-slate-500 text-xs">?</span>
                      </div>
                      <span className="text-xs text-slate-500 italic">Waiting...</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="text-[10px] text-slate-500 mb-3">
                {(matchmakingStatus.player_count || rankedPlayerCount)}-player match &bull; Search range: ±{matchmakingStatus.search_range || 50} rating
              </div>
              <button
                onClick={leaveQueue}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-400 transition-all"
              >
                Cancel Search
              </button>
            </div>
          ) : (
            <button
              onClick={() => joinQueue(rankedPlayerCount)}
              disabled={!currentSeason}
              className="
                w-full py-4 rounded-xl font-black text-base
                bg-gradient-to-r from-amber-600 via-orange-500 to-red-500
                hover:from-amber-500 hover:via-orange-400 hover:to-red-400
                text-white shadow-lg shadow-orange-500/25
                transition-all active:scale-[.98]
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {currentSeason ? `⚔️ Find ${rankedPlayerCount}-Player Ranked Match` : 'No Active Season'}
            </button>
          )}
          {matchmakingError && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
              {matchmakingError}
            </div>
          )}
        </div>
        
        <div className="flex gap-3">
          <Link
            href="/profile"
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-center bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all"
          >
            View Profile
          </Link>
          <Link
            href="/leaderboard"
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-center bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all"
          >
            Leaderboard
          </Link>
        </div>
      </div>
      
      {/* Match Found Modal */}
      {matchFound && (
        <MatchFoundModal
          matchData={matchFound}
          onClose={clearMatchFound}
        />
      )}

      {/* Open games */}
      {openGames.length > 0 && (
        <div className="glass rounded-2xl p-5 border border-white/5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-200 text-sm">Open Games</h3>
            <button
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold uppercase tracking-wider"
              onClick={fetchGames}
            >
              Refresh
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {openGames.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-slate-100 tracking-widest">{g.code}</span>
                  <span className="text-xs text-slate-500">{g.player_count}/{g.max_players} players</span>
                </div>
                <button
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 transition-colors"
                  onClick={async () => {
                    try { await joinGame(g.code); } catch { /* already joined */ }
                    router.push(`/game/${g.code}`);
                  }}
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My games */}
      {myGames.length > 0 && (
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="font-bold text-slate-200 text-sm mb-4">My Games</h3>
          <div className="flex flex-col gap-2">
            {myGames.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-slate-100 tracking-widest">{g.code}</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${statusColor[g.status || 'waiting'] || 'bg-slate-500'}`} />
                    <span className="text-xs text-slate-400 capitalize">{g.status}</span>
                  </div>
                  <span className="text-xs text-slate-600">{g.player_count}/{g.max_players}</span>
                </div>
                <button
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                  onClick={() => router.push(`/game/${g.code}`)}
                >
                  {g.status === 'playing' ? 'Rejoin' : 'View'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
