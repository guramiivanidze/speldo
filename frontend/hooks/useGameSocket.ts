'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, WebSocketMessage } from '@/types/game';
import { getWebSocketToken } from '@/lib/api';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export interface PauseEvent {
  type: 'player_left' | 'game_resumed' | 'game_ended_vote' | 'game_ended_all_left' | 'all_voted_wait' | 'pause_timeout';
  leftUserId?: number;
  leftUsername?: string;
  rejoinedUserId?: number;
  rejoinedUsername?: string;
}

export function useGameSocket(gameCode: string | null) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [pauseEvent, setPauseEvent] = useState<PauseEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!gameCode) return;

    let ws: WebSocket | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        const token = await getWebSocketToken();
        if (cancelled) return;
        
        ws = new WebSocket(`${WS_BASE}/ws/game/${gameCode}/?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);

        ws.onmessage = (event) => {
          const msg: WebSocketMessage = JSON.parse(event.data);
          
          if (msg.type === 'game_state' && msg.state) {
            setGameState(msg.state);
            setError(null);
          } else if (msg.type === 'error') {
            setError(msg.message || 'Unknown error');
          } else if (msg.type === 'player_left_survey') {
            setPauseEvent({
              type: 'player_left',
              leftUserId: msg.left_user_id,
              leftUsername: msg.left_username,
            });
          } else if (msg.type === 'game_resumed') {
            setPauseEvent({
              type: 'game_resumed',
              rejoinedUserId: msg.user_id,
              rejoinedUsername: msg.username,
            });
          } else if (msg.type === 'game_ended_by_vote') {
            setPauseEvent({ type: 'game_ended_vote' });
          } else if (msg.type === 'game_ended_all_left') {
            setPauseEvent({ type: 'game_ended_all_left' });
          } else if (msg.type === 'all_voted_wait') {
            setPauseEvent({ type: 'all_voted_wait' });
          } else if (msg.type === 'pause_timeout_ended') {
            setPauseEvent({ type: 'pause_timeout' });
          }
        };

        ws.onclose = () => setConnected(false);
        ws.onerror = () => setError('WebSocket connection error');
      } catch (err) {
        setError('Failed to connect to game server');
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (ws) ws.close();
    };
  }, [gameCode]);

  const sendAction = useCallback((action: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, payload }));
    }
  }, []);

  const takeTokens = useCallback((colors: string[]) => {
    sendAction('take_tokens', { colors });
  }, [sendAction]);

  const discardTokens = useCallback((tokens: Record<string, number>) => {
    sendAction('discard_tokens', { tokens });
  }, [sendAction]);

  const reserveCard = useCallback((cardId?: number, level?: number) => {
    sendAction('reserve_card', { card_id: cardId, level });
  }, [sendAction]);

  const buyCard = useCallback((cardId: number) => {
    sendAction('buy_card', { card_id: cardId });
  }, [sendAction]);

  const chooseNoble = useCallback((nobleId: number) => {
    sendAction('choose_noble', { noble_id: nobleId });
  }, [sendAction]);

  const leaveGame = useCallback(() => {
    sendAction('leave_game', {});
  }, [sendAction]);

  const voteResponse = useCallback((vote: 'wait' | 'end') => {
    sendAction('vote_response', { vote });
  }, [sendAction]);

  // Request fresh game state (triggers pause checks on backend)
  const refreshState = useCallback(() => {
    sendAction('refresh_state', {});
  }, [sendAction]);

  return {
    gameState,
    error,
    connected,
    pauseEvent,
    takeTokens,
    discardTokens,
    reserveCard,
    buyCard,
    chooseNoble,
    leaveGame,
    voteResponse,
    refreshState,
    clearError: () => setError(null),
    clearPauseEvent: () => setPauseEvent(null),
  };
}
