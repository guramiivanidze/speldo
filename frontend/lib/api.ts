const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const AUTH_TOKEN_KEY = 'speldo_auth_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getStoredToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.error || 'Request failed');
  return data;
}

export async function register(username: string, password: string) {
  const data = await apiFetch('/api/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (data.token) {
    setStoredToken(data.token);
  }
  return data;
}

export async function login(username: string, password: string) {
  const data = await apiFetch('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (data.token) {
    setStoredToken(data.token);
  }
  return data;
}

export async function logout() {
  try {
    await apiFetch('/api/auth/logout/', { method: 'POST' });
  } catch {
    // Ignore errors on logout
  }
  setStoredToken(null);
  return { message: 'Logged out.' };
}

export async function getMe() {
  return apiFetch('/api/auth/me/');
}

export async function getWebSocketToken(): Promise<string> {
  const data = await apiFetch('/api/auth/ws-token/');
  return data.token;
}

export async function listGames() {
  return apiFetch('/api/games/');
}

export async function createGame(max_players: number) {
  return apiFetch('/api/games/', {
    method: 'POST',
    body: JSON.stringify({ max_players }),
  });
}

export async function joinGame(code: string) {
  return apiFetch(`/api/games/${code}/join/`, { method: 'POST' });
}

export async function startGame(code: string) {
  return apiFetch(`/api/games/${code}/start/`, { method: 'POST' });
}

export async function getGameState(code: string) {
  return apiFetch(`/api/games/${code}/state/`);
}

export async function getMyGames() {
  return apiFetch('/api/games/mine/');
}
