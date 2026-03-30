'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdvisedMove, AdvisorHintResponse, getAdvisorHint } from '@/lib/api';

const POLL_INTERVAL_YOUR_TURN = 4000;  // ms — fast poll when it's your turn
const POLL_INTERVAL_WAITING   = 10000; // ms — slow poll while waiting

interface UseAdvisorOptions {
  gameCode: string | null;
  isMyTurn: boolean;
  enabled?: boolean; // external opt-out (e.g. game finished)
}

interface AdvisorState {
  active: boolean;       // advisor is enabled for this player
  advice: AdvisedMove | null;
  isYourTurn: boolean;
  loading: boolean;
  error: string | null;
}

export function useAdvisor({ gameCode, isMyTurn, enabled = true }: UseAdvisorOptions): AdvisorState {
  const [active, setActive] = useState(false);
  const [advice, setAdvice] = useState<AdvisedMove | null>(null);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    if (!gameCode || !mountedRef.current) return;

    try {
      const res: AdvisorHintResponse = await getAdvisorHint(gameCode);

      if (!mountedRef.current) return;

      if (!res.enabled) {
        setActive(false);
        setAdvice(null);
        return;
      }

      setActive(true);
      setIsYourTurn(res.is_your_turn ?? false);

      if (res.advice) {
        setAdvice(res.advice);
        setError(null);
      } else if (res.error) {
        setError(res.error);
      }
    } catch {
      // Silently ignore network errors — advisor is non-critical
      if (mountedRef.current) setError(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [gameCode]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled || !gameCode) {
      setActive(false);
      setAdvice(null);
      return;
    }

    // Immediate first poll
    setLoading(true);
    poll();

    const interval = isMyTurn ? POLL_INTERVAL_YOUR_TURN : POLL_INTERVAL_WAITING;
    timerRef.current = setInterval(poll, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, gameCode, isMyTurn, poll]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { active, advice, isYourTurn, loading, error };
}
