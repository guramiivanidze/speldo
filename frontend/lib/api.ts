const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

let cachedCsrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  
  try {
    const res = await fetch(`${API_BASE}/api/auth/csrf/`, { credentials: 'include' });
    const data = await res.json();
    const token = data.csrfToken || '';
    cachedCsrfToken = token;
    return token;
  } catch {
    return '';
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    (options.method || 'GET').toUpperCase()
  );
  const csrfToken = isWrite ? await getCsrfToken() : '';

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(isWrite ? { 'X-CSRFToken': csrfToken } : {}),
      ...options.headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function register(username: string, password: string) {
  return apiFetch('/api/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function login(username: string, password: string) {
  return apiFetch('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  const result = await apiFetch('/api/auth/logout/', { method: 'POST' });
  cachedCsrfToken = null; // Clear cached token on logout
  return result;
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
