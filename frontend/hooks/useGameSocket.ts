'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, WebSocketMessage } from '@/types/game';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export function useGameSocket(gameCode: string | null) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!gameCode) return;

    const ws = new WebSocket(`${WS_BASE}/ws/game/${gameCode}/`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const msg: WebSocketMessage = JSON.parse(event.data);
      if (msg.type === 'game_state' && msg.state) {
        setGameState(msg.state);
        setError(null);
      } else if (msg.type === 'error') {
        setError(msg.message || 'Unknown error');
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError('WebSocket connection error');

    return () => ws.close();
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

  return {
    gameState,
    error,
    connected,
    takeTokens,
    discardTokens,
    reserveCard,
    buyCard,
    chooseNoble,
    clearError: () => setError(null),
  };
}
