'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getWebSocketToken } from '@/lib/api';
import { MatchmakingStatus, MatchFoundData, Match, LobbyPlayer } from '@/types/competitive';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export interface UseMatchmakingResult {
  status: MatchmakingStatus | null;
  matchFound: MatchFoundData | null;
  error: string | null;
  connected: boolean;
  joinQueue: (playerCount?: number) => void;
  leaveQueue: () => void;
  refreshStatus: () => void;
  clearMatchFound: () => void;
}

export function useMatchmaking(): UseMatchmakingResult {
  const [status, setStatus] = useState<MatchmakingStatus | null>(null);
  const [matchFound, setMatchFound] = useState<MatchFoundData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    try {
      const token = await getWebSocketToken();
      const ws = new WebSocket(`${WS_BASE}/ws/matchmaking/?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'queue_status':
              setStatus({
                in_queue: data.in_queue,
                wait_time_seconds: data.wait_time_seconds,
                search_range: data.search_range,
                rating: data.rating,
                player_count: data.player_count,
              });
              break;
            
            case 'queue_join_result':
              if (data.success) {
                setStatus({ in_queue: true, player_count: data.player_count, ...data });
                if (data.match) {
                  setMatchFound({
                    game_code: data.match.game?.code || data.match.game_code,
                    opponent: data.match.player2 || data.match.opponent,
                    opponents: data.match.opponents,
                    player_count: data.match.player_count || 2,
                  });
                }
              } else {
                setError(data.message);
              }
              break;
            
            case 'queue_leave_result':
              if (data.success) {
                setStatus({ in_queue: false });
              }
              break;
            
            case 'match_found':
              setMatchFound({
                game_code: data.game_code,
                opponent: data.opponent,
                opponents: data.opponents,
                player_count: data.player_count || 2,
              });
              setStatus({ in_queue: false });
              break;
            
            case 'queue_update':
              setStatus(prev => prev ? {
                ...prev,
                wait_time_seconds: data.wait_time_seconds,
                search_range: data.search_range,
              } : null);
              break;
            
            case 'lobby_update':
              setStatus(prev => prev ? {
                ...prev,
                lobby_players: data.lobby_players,
              } : null);
              break;
            
            case 'error':
              setError(data.message);
              break;
          }
        } catch (e) {
          console.error('Failed to parse matchmaking message:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Attempt reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        setError('Connection error');
      };
    } catch (err) {
      setError('Failed to connect');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((action: string, data?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, ...data }));
    }
  }, []);

  const joinQueue = useCallback((playerCount: number = 2) => {
    sendMessage('join_queue', { player_count: playerCount });
  }, [sendMessage]);

  const leaveQueue = useCallback(() => {
    sendMessage('leave_queue');
  }, [sendMessage]);

  const refreshStatus = useCallback(() => {
    sendMessage('get_status');
  }, [sendMessage]);

  const clearMatchFound = useCallback(() => {
    setMatchFound(null);
  }, []);

  return {
    status,
    matchFound,
    error,
    connected,
    joinQueue,
    leaveQueue,
    refreshStatus,
    clearMatchFound,
  };
}
