'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { register, login, logout, listGames, createGame, joinGame, getMyGames } from '@/lib/api';

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

  async function fetchGames() {
    try {
      const [open, mine] = await Promise.all([listGames(), getMyGames()]);
      setOpenGames(open);
      setMyGames(mine);
    } catch { /* ignore */ }
  }

  useEffect(() => { if (user) fetchGames(); }, [user]);

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

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
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
