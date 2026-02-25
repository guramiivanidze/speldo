'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getMe, getStoredToken, setStoredToken } from '@/lib/api';

interface User {
  id: number;
  username: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  clearAuth: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only try to get user if there's a stored token
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    
    getMe()
      .then(setUser)
      .catch(() => {
        setUser(null);
        setStoredToken(null); // Clear invalid token
      })
      .finally(() => setLoading(false));
  }, []);

  const clearAuth = () => {
    setUser(null);
    setStoredToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
