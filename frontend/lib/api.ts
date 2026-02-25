const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

async function ensureCsrf() {
  // Trigger a GET request so Django sets the csrftoken cookie
  if (!getCsrfToken()) {
    await fetch(`${API_BASE}/api/auth/me/`, { credentials: 'include' }).catch(() => {});
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    (options.method || 'GET').toUpperCase()
  );
  if (isWrite) await ensureCsrf();

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(isWrite ? { 'X-CSRFToken': getCsrfToken() } : {}),
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
  return apiFetch('/api/auth/logout/', { method: 'POST' });
}

export async function getMe() {
  return apiFetch('/api/auth/me/');
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
