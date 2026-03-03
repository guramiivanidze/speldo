'use client';

import { useRef, useCallback, useEffect } from 'react';

type SoundType = 'takecoin' | 'reservation' | 'buycard' | 'endgame';

const SOUND_FILES: Record<SoundType, string> = {
  takecoin: '/sounds/takecoin.mp3',
  reservation: '/sounds/reservation.mp3',
  buycard: '/sounds/takeOrBuycard.mp3',
  endgame: '/sounds/endgame.mp3',
};

export function useGameSounds() {
  const audioRefs = useRef<Record<SoundType, HTMLAudioElement | null>>({
    takecoin: null,
    reservation: null,
    buycard: null,
    endgame: null,
  });

  // Preload sounds on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    Object.entries(SOUND_FILES).forEach(([key, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = 0.5;
      audioRefs.current[key as SoundType] = audio;
    });

    return () => {
      // Cleanup
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
    };
  }, []);

  const playSound = useCallback((type: SoundType) => {
    const audio = audioRefs.current[type];
    if (audio) {
      // Reset to start if already playing
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Ignore autoplay errors (user hasn't interacted with page yet)
      });
    }
  }, []);

  return {
    playTakeCoin: useCallback(() => playSound('takecoin'), [playSound]),
    playReservation: useCallback(() => playSound('reservation'), [playSound]),
    playBuyCard: useCallback(() => playSound('buycard'), [playSound]),
    playEndGame: useCallback(() => playSound('endgame'), [playSound]),
    playSound,
  };
}
