'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getWebSocketToken } from '@/lib/api';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export interface GameInvitationNotification {
  type: 'game_invitation';
  invitation_id: number;
  game_code: string;
  from_user_id: number;
  from_username: string;
  max_players: number;
  current_players: number;
}

export interface InvitationExpiredNotification {
  type: 'invitation_expired';
  invitation_id: number;
  reason: string;
}

export type NotificationMessage = GameInvitationNotification | InvitationExpiredNotification;

interface UseNotificationsOptions {
  onGameInvitation?: (invitation: GameInvitationNotification) => void;
  onInvitationExpired?: (data: InvitationExpiredNotification) => void;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const optionsRef = useRef(options);
  
  // Keep options ref updated
  optionsRef.current = options;

  const connect = useCallback(async () => {
    if (!shouldReconnectRef.current) return;

    try {
      const token = await getWebSocketToken();
      if (!shouldReconnectRef.current) return;
      
      const ws = new WebSocket(`${WS_BASE}/ws/notifications/?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        const msg: NotificationMessage = JSON.parse(event.data);
        
        if (msg.type === 'game_invitation') {
          optionsRef.current.onGameInvitation?.(msg);
        } else if (msg.type === 'invitation_expired') {
          optionsRef.current.onInvitationExpired?.(msg);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        
        // Auto-reconnect with exponential backoff
        if (shouldReconnectRef.current) {
          const delays = [1000, 2000, 4000, 8000, 16000];
          const delay = delays[Math.min(reconnectAttemptRef.current, delays.length - 1)];
          reconnectAttemptRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        // onclose will handle reconnection
      };
    } catch (err) {
      // Retry on error
      if (shouldReconnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { connected, disconnect };
}
