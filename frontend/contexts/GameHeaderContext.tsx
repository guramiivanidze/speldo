'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface GameHeaderState {
  showLeaveButton: boolean;
  gameCode: string | null;
  connected: boolean;
  onLeaveGame: (() => void) | null;
}

interface GameHeaderContextType {
  headerState: GameHeaderState;
  setHeaderState: (state: Partial<GameHeaderState>) => void;
  clearHeaderState: () => void;
}

const defaultState: GameHeaderState = {
  showLeaveButton: false,
  gameCode: null,
  connected: false,
  onLeaveGame: null,
};

const GameHeaderContext = createContext<GameHeaderContextType | undefined>(undefined);

export function GameHeaderProvider({ children }: { children: ReactNode }) {
  const [headerState, setHeaderStateInternal] = useState<GameHeaderState>(defaultState);

  const setHeaderState = useCallback((state: Partial<GameHeaderState>) => {
    setHeaderStateInternal(prev => ({ ...prev, ...state }));
  }, []);

  const clearHeaderState = useCallback(() => {
    setHeaderStateInternal(defaultState);
  }, []);

  return (
    <GameHeaderContext.Provider value={{ headerState, setHeaderState, clearHeaderState }}>
      {children}
    </GameHeaderContext.Provider>
  );
}

export function useGameHeader() {
  const context = useContext(GameHeaderContext);
  if (!context) {
    throw new Error('useGameHeader must be used within GameHeaderProvider');
  }
  return context;
}
