'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useGameHeader } from '@/contexts/GameHeaderContext';
import { useGameSocket } from '@/hooks/useGameSocket';
import { startGame, getMatchByGame } from '@/lib/api';
import GameBoard from '@/components/GameBoard';
import PauseSurveyModal from '@/components/PauseSurveyModal';
import RatingChangeDisplay from '@/components/RatingChangeDisplay';
import type { Match, Division } from '@/types/competitive';

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
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const { setHeaderState, clearHeaderState } = useGameHeader();
  
  // Ranked match state
  const [rankedMatch, setRankedMatch] = useState<Match | null>(null);
  const [showRatingChange, setShowRatingChange] = useState(false);

  const {
    gameState,
    error,
    connected,
    pauseEvent,
    takeTokens,
    discardTokens,
    reserveCard,
    buyCard,
    leaveGame,
    voteResponse,
    cancelPendingDiscard,
    refreshState,
    clearError,
    clearPauseEvent,
  } = useGameSocket(user ? code : null);

  // Set up header with Leave button when in game
  const handleLeaveClick = useCallback(() => {
    // For waiting rooms, leave immediately without confirmation
    if (gameState?.status === 'waiting') {
      leaveGame();
      router.push('/');
    } else {
      setShowLeaveConfirm(true);
    }
  }, [gameState?.status, leaveGame, router]);

  useEffect(() => {
    if (gameState?.status === 'playing' || gameState?.status === 'paused' || gameState?.status === 'waiting') {
      setHeaderState({
        showLeaveButton: true,
        gameCode: code,
        connected,
        onLeaveGame: handleLeaveClick,
      });
    } else {
      setHeaderState({
        showLeaveButton: false,
        gameCode: code,
        connected,
        onLeaveGame: null,
      });
    }
  }, [gameState?.status, code, connected, setHeaderState, handleLeaveClick]);

  // Clear header state on unmount
  useEffect(() => {
    return () => clearHeaderState();
  }, [clearHeaderState]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Periodic refresh when game is paused to update timer and check for new surveys
  useEffect(() => {
    if (gameState?.status !== 'paused') return;
    
    const interval = setInterval(() => {
      refreshState();
    }, 5000); // Refresh every 5 seconds when paused
    
    return () => clearInterval(interval);
  }, [gameState?.status, refreshState]);

  // Handle pause events
  useEffect(() => {
    if (!pauseEvent) return;
    
    if (pauseEvent.type === 'player_left') {
      setNotification(`${pauseEvent.leftUsername} has left the game. Game paused.`);
      setTimeout(() => setNotification(null), 5000);
      // Refresh state to ensure we have the latest paused state
      refreshState();
      clearPauseEvent();
    } else if (pauseEvent.type === 'game_resumed') {
      setNotification(`${pauseEvent.rejoinedUsername} has rejoined! Game resumed.`);
      setTimeout(() => setNotification(null), 3000);
      clearPauseEvent();
    } else if (pauseEvent.type === 'player_rejoined') {
      setNotification(`${pauseEvent.rejoinedUsername} has rejoined! Waiting for other players...`);
      setTimeout(() => setNotification(null), 4000);
      clearPauseEvent();
    } else if (pauseEvent.type === 'game_ended_vote') {
      setNotification('Game ended by vote.');
      clearPauseEvent();
    } else if (pauseEvent.type === 'game_ended_all_left') {
      setNotification('All players left. Game ended.');
      clearPauseEvent();
    } else if (pauseEvent.type === 'all_voted_wait') {
      setNotification('All players voted to wait. Survey will appear again in 1 minute.');
      setTimeout(() => setNotification(null), 3000);
      clearPauseEvent();
    } else if (pauseEvent.type === 'pause_timeout') {
      setNotification('Pause timeout expired. Game ended.');
      clearPauseEvent();
    } else if (pauseEvent.type === 'waiting_room_closed') {
      setNotification('Room closed.');
      clearPauseEvent();
      router.push('/');
    } else if (pauseEvent.type === 'player_left_waiting') {
      setNotification(`${pauseEvent.leftUsername} left the room.`);
      setTimeout(() => setNotification(null), 3000);
      refreshState();
      clearPauseEvent();
    }
  }, [pauseEvent, clearPauseEvent, refreshState, router]);

  // Check for ranked match result when game finishes
  useEffect(() => {
    if (gameState?.status === 'finished' && gameState.game_id && !rankedMatch) {
      getMatchByGame(gameState.game_id)
        .then((match) => {
          setRankedMatch(match);
          setShowRatingChange(true);
        })
        .catch(() => {
          // Not a ranked game, ignore
        });
    }
  }, [gameState?.status, gameState?.game_id, rankedMatch]);

  async function handleStart() {
    setStartError('');
    try {
      await startGame(code);
    } catch (err: unknown) {
      setStartError(err instanceof Error ? err.message : 'Error starting game');
    }
  }

  function handleLeaveGame() {
    setIsLeaving(true);
    setShowLeaveConfirm(false);
    leaveGame();
    router.push('/');
  }

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <GemSpinner />
      </div>
    );
  }

  // Get user's current vote
  const myVote = gameState?.player_votes?.[String(user.id)] || null;

  // Active game - full viewport, no container
  if (gameState?.status === 'playing' || gameState?.status === 'paused') {
    return (
      <div className="fixed inset-0 top-[53px]">
        {/* Notification toast */}
        {notification && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-40 
                          px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 
                          rounded-lg text-emerald-300 text-sm">
            {notification}
          </div>
        )}

        {/* Error floating */}
        {error && (
          <div className="absolute top-2 right-2 z-30 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <span>{error}</span>
            <button onClick={clearError} className="text-red-400 hover:text-red-200 font-bold">✕</button>
          </div>
        )}

        {/* Leave confirmation modal - higher z-index to show above pause modal */}
        {showLeaveConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
              <h2 className="text-lg font-bold text-slate-100 mb-2">Leave Game?</h2>
              <p className="text-slate-400 text-sm mb-6">
                The game will be paused for 5 minutes. Other players can vote to end the game or wait for you to rejoin.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm
                    bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all"
                >
                  Stay
                </button>
                <button
                  onClick={handleLeaveGame}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm
                    bg-red-600 hover:bg-red-500 text-white transition-all"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pause survey modal */}
        {gameState?.status === 'paused' && !isLeaving && (
          <PauseSurveyModal
            pauseRemainingSeconds={gameState.pause_remaining_seconds}
            myVote={myVote as 'wait' | 'end' | null}
            allVotes={gameState.player_votes}
            players={gameState.players}
            onVote={voteResponse}
          />
        )}

        <div className="absolute inset-0 z-0">
          <GameBoard
            gameState={gameState}
            myUserId={user.id}
            onTakeTokens={takeTokens}
            onReserveCard={reserveCard}
            onBuyCard={buyCard}
            onDiscardTokens={discardTokens}
            onCancelPendingDiscard={cancelPendingDiscard}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4">

      {/* ── Top bar ───────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        
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
              {gameState.players.length}/{gameState.max_players} players joined
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

            {/* Start button - only show when room is full */}
            {gameState.players.length === gameState.max_players && (
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

            {/* Waiting for more players message */}
            {gameState.players.length < gameState.max_players && (
              <div className="text-center py-3 text-slate-400 text-sm">
                Waiting for {gameState.max_players - gameState.players.length} more player{gameState.max_players - gameState.players.length > 1 ? 's' : ''}...
              </div>
            )}

            {/* Back to lobby button */}
            <button
              className="
                mt-4 w-full py-2.5 rounded-xl font-semibold text-sm
                bg-slate-700/50 hover:bg-slate-600/50
                border border-slate-600/50
                text-slate-300 transition-all active:scale-[.98]
              "
              onClick={handleLeaveGame}
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* ── Finished game ─────────────────────────────── */}
      {gameState?.status === 'finished' && (
        <div className="flex flex-col gap-6">

          {/* Ranked Rating Change Display */}
          {showRatingChange && rankedMatch && user && (() => {
            const isPlayer1 = rankedMatch.player1_username === user.username;
            const oldRating = (isPlayer1 ? rankedMatch.player1_rating_before : rankedMatch.player2_rating_before) ?? 1000;
            const newRating = (isPlayer1 ? rankedMatch.player1_rating_after : rankedMatch.player2_rating_after) ?? 1000;
            const oldDivision = (isPlayer1 ? rankedMatch.player1_division_before : rankedMatch.player2_division_before) as Division;
            const newDivision = (isPlayer1 ? rankedMatch.player1_division_after : rankedMatch.player2_division_after) as Division;
            const won = rankedMatch.winner_username === user.username;
            
            return (
              <RatingChangeDisplay
                oldRating={oldRating}
                newRating={newRating}
                oldDivision={oldDivision}
                newDivision={newDivision}
                won={won}
                onComplete={() => setShowRatingChange(false)}
              />
            );
          })()}

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
            onDiscardTokens={() => {}}
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
