'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useGameSocket } from '@/hooks/useGameSocket';
import { startGame } from '@/lib/api';
import GameBoard from '@/components/GameBoard';

const GEM_COLORS_HEX = ['#f1f5f9', '#3b82f6', '#10b981', '#ef4444', '#475569', '#fde047'];

interface PageProps {
  params: Promise<{ code: string }>;
}

function GemSpinner() {
  return (
    <div className="flex gap-1.5">
      {GEM_COLORS_HEX.map((c, i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-full animate-bounce"
          style={{ background: c, animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

export default function GamePage({ params }: PageProps) {
  const { code } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [startError, setStartError] = useState('');

  const {
    gameState,
    error,
    connected,
    takeTokens,
    reserveCard,
    buyCard,
    clearError,
  } = useGameSocket(user ? code : null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  async function handleStart() {
    setStartError('');
    try {
      await startGame(code);
    } catch (err: unknown) {
      setStartError(err instanceof Error ? err.message : 'Error starting game');
    }
  }

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <GemSpinner />
      </div>
    );
  }

  // Active game - full viewport, no container
  if (gameState?.status === 'playing') {
    return (
      <div className="fixed inset-0">
        {/* Floating top bar */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-slate-700/50">
          <button
            className="text-xs text-slate-500 hover:text-indigo-300 transition-colors font-semibold"
            onClick={() => router.push('/')}
          >
            ← Exit
          </button>
          <div className="h-3 w-px bg-slate-700" />
          <span className="font-mono font-bold text-slate-300 text-xs">{code}</span>
          <div
            className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
          />
        </div>
        
        {/* Error floating */}
        {error && (
          <div className="absolute top-2 right-2 z-10 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <span>{error}</span>
            <button onClick={clearError} className="text-red-400 hover:text-red-200 font-bold">✕</button>
          </div>
        )}

        <GameBoard
          gameState={gameState}
          myUserId={user.id}
          onTakeTokens={takeTokens}
          onReserveCard={reserveCard}
          onBuyCard={buyCard}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4">

      {/* ── Top bar ───────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          className="text-xs text-slate-500 hover:text-indigo-300 transition-colors font-semibold"
          onClick={() => router.push('/')}
        >
          ← Lobby
        </button>
        <div className="h-4 w-px bg-slate-700" />
        <span className="font-mono font-black text-slate-100 tracking-widest text-sm">{code}</span>
        <div
          className={`w-2 h-2 rounded-full transition-colors ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
          title={connected ? 'Connected' : 'Disconnected'}
        />
        {!connected && (
          <span className="text-[10px] text-red-400 font-semibold">Reconnecting...</span>
        )}
      </div>

      {/* ── Error banner ──────────────────────────────── */}
      {(error || startError) && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error || startError}</span>
          <button
            className="text-red-400 hover:text-red-200 transition-colors ml-4 font-bold text-base leading-none"
            onClick={() => { clearError(); setStartError(''); }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Waiting lobby ─────────────────────────────── */}
      {gameState?.status === 'waiting' && (
        <div className="flex flex-col items-center">
          <div className="glass rounded-2xl p-8 w-full max-w-md border border-white/8 text-center">

            {/* Gem loading animation */}
            <div className="flex justify-center mb-6">
              <GemSpinner />
            </div>

            <h3 className="text-xl font-black text-slate-100 mb-1">
              Waiting for players
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              {gameState.players.length < 2
                ? 'Need at least 2 players to start'
                : `${gameState.players.length} player${gameState.players.length > 1 ? 's' : ''} ready`}
            </p>

            {/* Player chips */}
            <div className="flex gap-2 justify-center flex-wrap mb-6">
              {gameState.players.map((p) => {
                const initials = p.username.slice(0, 2).toUpperCase();
                const isMe = p.id === user.id;
                return (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-700/60">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                      style={{
                        background: isMe
                          ? 'linear-gradient(135deg,#6366f1,#4338ca)'
                          : 'linear-gradient(135deg,#475569,#1e293b)',
                      }}
                    >
                      {initials}
                    </div>
                    <span className="text-xs font-semibold text-slate-200">{p.username}</span>
                    {isMe && (
                      <span className="text-[9px] bg-indigo-500/30 text-indigo-300 rounded-full px-1.5 font-semibold">
                        you
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Share code */}
            <div className="px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/40 mb-6">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Share code</p>
              <span className="font-mono font-black text-2xl gold-text tracking-[0.3em]">{code}</span>
            </div>

            {/* Start button */}
            {gameState.players.length >= 2 && (
              <button
                className="
                  w-full py-3 rounded-xl font-black text-base
                  bg-gradient-to-r from-emerald-600 to-teal-600
                  hover:from-emerald-500 hover:to-teal-500
                  text-white shadow-lg transition-all active:scale-[.98]
                "
                onClick={handleStart}
              >
                Start Game
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Finished game ─────────────────────────────── */}
      {gameState?.status === 'finished' && (
        <div className="flex flex-col gap-6">

          {/* Trophy banner */}
          <div className="glass rounded-2xl p-8 border border-amber-500/20 text-center">
            <div className="text-4xl mb-3">♛</div>
            <h3 className="text-2xl font-black gold-text mb-1">Game Over</h3>

            {gameState.winner_id && (() => {
              const winner = gameState.players.find(p => p.id === gameState.winner_id);
              return winner ? (
                <p className="text-slate-400 text-sm mb-6">
                  <span className="font-bold text-amber-300">{winner.username}</span> wins with{' '}
                  <span className="font-bold text-slate-100">{winner.prestige_points}</span> prestige points
                </p>
              ) : null;
            })()}

            {/* Leaderboard */}
            <div className="flex flex-col gap-2 mb-6">
              {[...gameState.players]
                .sort((a, b) => b.prestige_points - a.prestige_points)
                .map((p, rank) => {
                  const isWinner = p.id === gameState.winner_id;
                  const isMe = p.id === user.id;
                  const initials = p.username.slice(0, 2).toUpperCase();
                  const rankEmoji = ['♛', '②', '③', '④'][rank] ?? '—';
                  return (
                    <div
                      key={p.id}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl
                        ${isWinner
                          ? 'bg-amber-500/15 border border-amber-500/40'
                          : 'bg-slate-800/50 border border-slate-700/40'}
                      `}
                    >
                      <span className={`text-base w-5 text-center shrink-0 ${isWinner ? 'text-amber-400' : 'text-slate-500'}`}>
                        {rankEmoji}
                      </span>

                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                        style={{
                          background: isMe
                            ? 'linear-gradient(135deg,#6366f1,#4338ca)'
                            : 'linear-gradient(135deg,#475569,#1e293b)',
                        }}
                      >
                        {initials}
                      </div>

                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold text-sm ${isWinner ? 'text-amber-200' : 'text-slate-100'}`}>
                            {p.username}
                          </span>
                          {isMe && (
                            <span className="text-[9px] bg-indigo-500/30 text-indigo-300 rounded-full px-1.5 py-0.5 font-semibold">
                              you
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {p.purchased_card_ids.length} cards · {p.noble_ids.length} nobles
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className={`text-xl font-black ${isWinner ? 'gold-text' : 'text-slate-300'}`}>
                          {p.prestige_points}
                        </span>
                        <span className="text-[10px] text-slate-500 block">pts</span>
                      </div>
                    </div>
                  );
                })}
            </div>

            <button
              className="
                px-8 py-2.5 rounded-xl font-bold text-sm
                bg-gradient-to-r from-indigo-600 to-violet-600
                hover:from-indigo-500 hover:to-violet-500
                text-white shadow-lg transition-all active:scale-[.98]
              "
              onClick={() => router.push('/')}
            >
              Back to Lobby
            </button>
          </div>

          {/* Final board read-only */}
          <GameBoard
            gameState={gameState}
            myUserId={user.id}
            onTakeTokens={() => {}}
            onReserveCard={() => {}}
            onBuyCard={() => {}}
          />
        </div>
      )}

      {/* ── Connecting states ─────────────────────────── */}
      {!gameState && connected && (
        <div className="flex flex-col items-center gap-3 mt-20">
          <GemSpinner />
          <span className="text-slate-500 text-sm">Loading game state...</span>
        </div>
      )}
      {!gameState && !connected && (
        <div className="flex flex-col items-center gap-3 mt-20">
          <GemSpinner />
          <span className="text-slate-500 text-sm">Connecting to game...</span>
        </div>
      )}
    </div>
  );
}
