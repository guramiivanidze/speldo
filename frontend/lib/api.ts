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

// Auth configuration
export interface AuthConfig {
  email_verification_enabled: boolean;
}

export async function getAuthConfig(): Promise<AuthConfig> {
  return apiFetch('/api/auth/config/');
}

// Email verification
export interface SendVerificationResponse {
  message: string;
  verification_token: string;
}

export async function sendVerificationCode(email: string): Promise<SendVerificationResponse> {
  return apiFetch('/api/auth/send-verification/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyCode(email: string, code: string, verificationToken: string) {
  return apiFetch('/api/auth/verify-code/', {
    method: 'POST',
    body: JSON.stringify({ email, code, verification_token: verificationToken }),
  });
}

export async function register(
  username: string,
  email: string,
  password: string,
  verificationToken: string,
  verificationCode: string
) {
  const data = await apiFetch('/api/auth/register/', {
    method: 'POST',
    body: JSON.stringify({
      username,
      email,
      password,
      verification_token: verificationToken,
      verification_code: verificationCode,
    }),
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

// Cache ws token to avoid duplicate requests
let wsTokenCache: { token: string; expires: number } | null = null;
let wsTokenPromise: Promise<string> | null = null;
// Forward declaration for friend requests cache (defined later)
let _clearFriendRequestsCache: (() => void) | null = null;

function clearWsTokenCache() {
  wsTokenCache = null;
  wsTokenPromise = null;
}

function clearAllCaches() {
  clearWsTokenCache();
  if (_clearFriendRequestsCache) _clearFriendRequestsCache();
}

export async function logout() {
  try {
    await apiFetch('/api/auth/logout/', { method: 'POST' });
  } catch {
    // Ignore errors on logout
  }
  setStoredToken(null);
  clearAllCaches();
  return { message: 'Logged out.' };
}

export async function getMe() {
  return apiFetch('/api/auth/me/');
}

export async function getWebSocketToken(): Promise<string> {
  // Return cached token if still valid (with 30s buffer)
  if (wsTokenCache && wsTokenCache.expires > Date.now() + 30000) {
    return wsTokenCache.token;
  }
  
  // If a request is already in flight, wait for it
  if (wsTokenPromise) {
    return wsTokenPromise;
  }
  
  // Make the request and cache it
  wsTokenPromise = (async () => {
    try {
      const data = await apiFetch('/api/auth/ws-token/');
      // Cache for 5 minutes
      wsTokenCache = { token: data.token, expires: Date.now() + 5 * 60 * 1000 };
      return data.token;
    } finally {
      wsTokenPromise = null;
    }
  })();
  
  return wsTokenPromise;
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

export async function getUserGameHistory(page = 1, perPage = 20) {
  return apiFetch(`/api/games/history/?page=${page}&per_page=${perPage}`);
}

export interface CasualStats {
  total_games: number;
  wins: number;
  losses: number;
  win_rate: number;
}

export async function getCasualStats(): Promise<CasualStats> {
  return apiFetch('/api/games/casual-stats/');
}

// ─── Game Invitations API ──────────────────────────────

export interface GameFriend {
  id: number;
  username: string;
  is_in_game: boolean;
  invitation_status: 'pending' | 'accepted' | 'declined' | 'expired' | null;
  can_invite: boolean;
}

export interface GameInvitation {
  id: number;
  game_code: string;
  from_user_id: number;
  from_username: string;
  max_players: number;
  current_players: number;
  created_at: string;
}

export async function getGameFriends(code: string): Promise<{ 
  friends: GameFriend[]; 
  game_code: string; 
  slots_available: number; 
}> {
  return apiFetch(`/api/games/${code}/friends/`);
}

export async function sendGameInvitation(code: string, friendId: number): Promise<{
  message: string;
  invitation_id: number;
}> {
  return apiFetch(`/api/games/${code}/invite/`, {
    method: 'POST',
    body: JSON.stringify({ friend_id: friendId }),
  });
}

export async function respondToGameInvitation(invitationId: number, action: 'accept' | 'decline'): Promise<{
  message: string;
  game_code?: string;
}> {
  return apiFetch(`/api/games/invitation/${invitationId}/${action}/`, { method: 'POST' });
}

export async function getPendingGameInvitations(): Promise<{
  invitations: GameInvitation[];
  count: number;
}> {
  return apiFetch('/api/games/invitations/');
}

// ─── Friends API ───────────────────────────────────────

export interface FriendRequest {
  id: number;
  from_username: string;
  created_at: string;
}

export interface Friend {
  id: number;
  username: string;
  since: string;
}

export interface FriendWithStats {
  id: number;
  username: string;
  since: string;
  casual_wins: number;
}

export async function sendFriendRequest(nickname: string) {
  return apiFetch('/api/auth/friend-request/', {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  });
}

// Cache friend requests to avoid duplicate calls on initial page load
let friendRequestsCache: { data: { requests: FriendRequest[]; count: number }; expires: number } | null = null;
let friendRequestsPromise: Promise<{ requests: FriendRequest[]; count: number }> | null = null;

export async function getPendingFriendRequests(forceRefresh = false): Promise<{ requests: FriendRequest[]; count: number }> {
  // Return cached data if still valid (10 second cache for initial load dedup)
  if (!forceRefresh && friendRequestsCache && friendRequestsCache.expires > Date.now()) {
    return friendRequestsCache.data;
  }
  
  // If a request is already in flight, wait for it
  if (friendRequestsPromise) {
    return friendRequestsPromise;
  }
  
  friendRequestsPromise = (async () => {
    try {
      const data = await apiFetch('/api/auth/friend-requests/');
      friendRequestsCache = { data, expires: Date.now() + 10000 }; // 10 second cache
      return data;
    } finally {
      friendRequestsPromise = null;
    }
  })();
  
  return friendRequestsPromise;
}

export function invalidateFriendRequestsCache() {
  friendRequestsCache = null;
}

// Register the clear function for logout
_clearFriendRequestsCache = invalidateFriendRequestsCache;

export async function respondToFriendRequest(requestId: number, action: 'accept' | 'reject') {
  const result = await apiFetch(`/api/auth/friend-request/${requestId}/${action}/`, { method: 'POST' });
  invalidateFriendRequestsCache();
  return result;
}

export async function getFriendsList(): Promise<{ friends: Friend[]; count: number }> {
  return apiFetch('/api/auth/friends/');
}

export async function getFriendsWithStats(): Promise<{ friends: FriendWithStats[]; count: number }> {
  return apiFetch('/api/auth/friends/with-stats/');
}

export async function removeFriend(friendId: number) {
  return apiFetch(`/api/auth/friends/${friendId}/remove/`, { method: 'POST' });
}

// ─── Profile Change API ────────────────────────────────

export async function sendEmailChangeCode(newEmail: string): Promise<{ message: string; verification_token: string }> {
  return apiFetch('/api/auth/send-email-change-code/', {
    method: 'POST',
    body: JSON.stringify({ new_email: newEmail }),
  });
}

export async function changeEmail(newEmail: string, verificationToken: string, verificationCode: string) {
  return apiFetch('/api/auth/change-email/', {
    method: 'POST',
    body: JSON.stringify({
      new_email: newEmail,
      verification_token: verificationToken,
      verification_code: verificationCode,
    }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch('/api/auth/change-password/', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
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
