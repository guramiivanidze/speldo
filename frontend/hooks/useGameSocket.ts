'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, WebSocketMessage } from '@/types/game';
import { getWebSocketToken } from '@/lib/api';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

export interface PauseEvent {
  type: 'player_left' | 'game_resumed' | 'game_ended_vote' | 'game_ended_all_left' | 'all_voted_wait' | 'pause_timeout' | 'player_rejoined' | 'waiting_room_closed' | 'player_left_waiting' | 'turn_skipped';
  leftUserId?: number;
  leftUsername?: string;
  rejoinedUserId?: number;
  rejoinedUsername?: string;
  skippedUserId?: number;
  skippedUsername?: string;
}

export interface ChatMessage {
  user_id: number;
  username: string;
  message: string;
  timestamp: string;
}

export function useGameSocket(gameCode: string | null) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [pauseEvent, setPauseEvent] = useState<PauseEvent | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  const connect = useCallback(async () => {
    if (!gameCode || !shouldReconnectRef.current) return;

    try {
      const token = await getWebSocketToken();
      if (!shouldReconnectRef.current) return;
      
      const ws = new WebSocket(`${WS_BASE}/ws/game/${gameCode}/?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttemptRef.current = 0; // Reset backoff on successful connection
      };

      ws.onmessage = (event) => {
        const msg: WebSocketMessage = JSON.parse(event.data);
        
        if (msg.type === 'game_state' && msg.state) {
          setGameState(msg.state);
          setError(null);
        } else if (msg.type === 'error') {
          setError(msg.message || 'Unknown error');
          // Auto-dismiss error after 4 seconds
          setTimeout(() => setError(null), 4000);
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
        } else if (msg.type === 'player_rejoined') {
          setPauseEvent({
            type: 'player_rejoined',
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
        } else if (msg.type === 'waiting_room_closed') {
          setPauseEvent({ type: 'waiting_room_closed' });
        } else if (msg.type === 'player_left_waiting') {
          setPauseEvent({
            type: 'player_left_waiting',
            leftUserId: msg.user_id,
            leftUsername: msg.username,
          });
        } else if (msg.type === 'chat_message') {
          // Deduplicate messages by checking timestamp + user_id + message
          const userId = msg.user_id!;
          const username = msg.username!;
          const message = msg.message!;
          const timestamp = msg.timestamp!;
          setChatMessages(prev => {
            const msgKey = `${timestamp}-${userId}-${message}`;
            const isDuplicate = prev.some(
              m => `${m.timestamp}-${m.user_id}-${m.message}` === msgKey
            );
            if (isDuplicate) return prev;
            return [...prev, {
              user_id: userId,
              username,
              message,
              timestamp,
            }];
          });
        } else if (msg.type === 'turn_skipped') {
          setPauseEvent({
            type: 'turn_skipped',
            skippedUserId: msg.user_id,
            skippedUsername: msg.username,
          });
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        
        // Auto-reconnect if we should
        if (shouldReconnectRef.current) {
          const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
          reconnectAttemptRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        // onclose will handle reconnection
      };
    } catch (err) {
      setError('Failed to connect to game server');
      // Retry connection
      if (shouldReconnectRef.current) {
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
        reconnectAttemptRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    }
  }, [gameCode]);

  useEffect(() => {
    if (!gameCode) return;

    shouldReconnectRef.current = true;
    connect();

    // Handle visibility change (mobile app switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible - check connection and reconnect if needed
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          // Clear any pending reconnect
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          reconnectAttemptRef.current = 0; // Reset backoff for immediate reconnect
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      shouldReconnectRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [gameCode, connect]);

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

  // Cancel the pending action that triggered discard requirement
  const cancelPendingDiscard = useCallback(() => {
    sendAction('cancel_pending_discard', {});
  }, [sendAction]);

  // Check if current player's turn has timed out
  const checkTurnTimeout = useCallback(() => {
    sendAction('check_turn_timeout', {});
  }, [sendAction]);

  // Request fresh game state (triggers pause checks on backend)
  const refreshState = useCallback(() => {
    sendAction('refresh_state', {});
  }, [sendAction]);

  // Send chat message
  const sendChat = useCallback((message: string) => {
    sendAction('chat_message', { message });
  }, [sendAction]);

  return {
    gameState,
    error,
    connected,
    pauseEvent,
    chatMessages,
    takeTokens,
    discardTokens,
    reserveCard,
    buyCard,
    chooseNoble,
    leaveGame,
    voteResponse,
    cancelPendingDiscard,
    checkTurnTimeout,
    refreshState,
    sendChat,
    clearError: () => setError(null),
    clearPauseEvent: () => setPauseEvent(null),
    clearChat: () => setChatMessages([]),
  };
}
