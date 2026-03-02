export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const AUTH_TOKEN_KEY = 'speldo_auth_token';
const REMEMBER_ME_KEY = 'speldo_remember_me';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Check localStorage first (remember me), then sessionStorage
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string | null, rememberMe?: boolean) {
  if (typeof window === 'undefined') return;
  if (token) {
    // If rememberMe is explicitly passed, use it; otherwise check if we're already remembered
    const shouldRemember = rememberMe ?? localStorage.getItem(REMEMBER_ME_KEY) === 'true';
    if (shouldRemember) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    } else {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(REMEMBER_ME_KEY);
    }
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
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

export async function register(username: string, email: string, password: string) {
  const data = await apiFetch('/api/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  if (data.token) {
    setStoredToken(data.token);
  }
  return data;
}

export async function login(email: string, password: string, rememberMe: boolean = false) {
  const data = await apiFetch('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember_me: rememberMe }),
  });
  if (data.token) {
    setStoredToken(data.token, rememberMe);
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

export interface JoinGameResponse {
  message: string;
  rejoined: boolean;
  game_status: 'waiting' | 'playing' | 'finished';
  player_count: number;
  max_players: number;
}

export async function joinGame(code: string): Promise<JoinGameResponse> {
  return apiFetch(`/api/games/${code}/join/`, { method: 'POST' });
}

export async function startGame(code: string) {
  return apiFetch(`/api/games/${code}/start/`, { method: 'POST' });
}

export async function getGameState(code: string) {
  return apiFetch(`/api/games/${code}/state/`);
}

export async function getGameHistory(code: string) {
  return apiFetch(`/api/games/${code}/history/`);
}

export async function getMyGames() {
  return apiFetch('/api/games/mine/');
}

// ─── Competitive API ───────────────────────────────────

export async function getCurrentSeason() {
  return apiFetch('/api/competitive/season/');
}

export async function getMyProfile() {
  return apiFetch('/api/competitive/profile/');
}

export async function getPlayerProfile(username: string) {
  return apiFetch(`/api/competitive/profile/${username}/`);
}

export async function getLeaderboard(page = 1, perPage = 50) {
  return apiFetch(`/api/competitive/leaderboard/?page=${page}&per_page=${perPage}`);
}

export async function getLeaderboardByDivision(division: string) {
  return apiFetch(`/api/competitive/leaderboard/${division.toLowerCase()}/`);
}

export async function joinMatchmaking() {
  return apiFetch('/api/competitive/matchmaking/join/', { method: 'POST' });
}

export async function leaveMatchmaking() {
  return apiFetch('/api/competitive/matchmaking/leave/', { method: 'POST' });
}

export async function getMatchmakingStatus() {
  return apiFetch('/api/competitive/matchmaking/status/');
}

export async function getMatchHistory(page = 1, perPage = 20) {
  return apiFetch(`/api/competitive/matches/?page=${page}&per_page=${perPage}`);
}

export async function getMatchDetail(matchId: number) {
  return apiFetch(`/api/competitive/matches/${matchId}/`);
}

export async function getMatchByGame(gameId: string) {
  return apiFetch(`/api/competitive/matches/by-game/${gameId}/`);
}

export async function getDivisionInfo() {
  return apiFetch('/api/competitive/divisions/');
}
