// Competitive system types

export type Division = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master' | 'Grandmaster';

export interface Season {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface PlayerProfile {
  id: number;
  username: string;
  rating: number;
  division: Division;
  ranked_games_played: number;
  ranked_wins: number;
  ranked_losses: number;
  win_rate: number;
  peak_rating: number;
  is_premium: boolean;
  points_to_next_division: number;
  next_division: Division | null;
  created_at: string;
}

export interface PlayerPublic {
  id: number;
  username: string;
  rating: number;
  division: Division;
  ranked_games_played: number;
  ranked_wins: number;
}

export interface MatchPlayer {
  player_id: number;
  username: string;
  placement: number | null;
  rating_before: number;
  rating_change: number;
  rating_after: number;
  division: Division;
  division_before: Division;
  division_after: Division;
  current_rating: number;
}

export interface Match {
  id: number;
  player_count: number;
  players: MatchPlayer[];
  winner_username: string | null;
  game_code: string | null;
  is_ranked: boolean;
  created_at: string;
  finished_at: string | null;
  // Legacy 2-player compatibility fields
  player1?: PlayerPublic;
  player2?: PlayerPublic;
  rating_change_p1?: number;
  rating_change_p2?: number;
  player1_username?: string;
  player2_username?: string;
  player1_rating_before?: number;
  player2_rating_before?: number;
  player1_rating_after?: number;
  player2_rating_after?: number;
  player1_division_before?: Division;
  player2_division_before?: Division;
  player1_division_after?: Division;
  player2_division_after?: Division;
}

export interface LeaderboardEntry {
  rank: number;
  player_id: number;
  username: string;
  rating: number;
  division: Division;
  games_played: number;
  wins: number;
  losses: number;
}

export interface LeaderboardResponse {
  season: Season;
  total: number;
  page: number;
  per_page: number;
  entries: LeaderboardEntry[];
}

export interface MatchmakingStatus {
  in_queue: boolean;
  wait_time_seconds?: number;
  search_range?: number;
  rating?: number;
  player_count?: number;
}

export interface OpponentInfo {
  username: string;
  rating: number;
  division: Division;
}

export interface MatchFoundData {
  game_code: string;
  player_count: number;
  opponents: OpponentInfo[];
  // Legacy single opponent for 2-player matches
  opponent?: OpponentInfo;
}

export interface DivisionInfo {
  name: Division;
  min_rating: number;
  max_rating: number | null;
}

// Division colors and icons
export const DIVISION_CONFIG: Record<Division, { color: string; bgColor: string; icon: string }> = {
  Bronze: { color: '#cd7f32', bgColor: 'rgba(205, 127, 50, 0.15)', icon: '🥉' },
  Silver: { color: '#c0c0c0', bgColor: 'rgba(192, 192, 192, 0.15)', icon: '⚪' },
  Gold: { color: '#ffd700', bgColor: 'rgba(255, 215, 0, 0.15)', icon: '🥇' },
  Platinum: { color: '#e5e4e2', bgColor: 'rgba(229, 228, 226, 0.15)', icon: '🥈' },
  Diamond: { color: '#b9f2ff', bgColor: 'rgba(185, 242, 255, 0.15)', icon: '💠' },
  Master: { color: '#9b59b6', bgColor: 'rgba(155, 89, 182, 0.15)', icon: '💎' },
  Grandmaster: { color: '#e74c3c', bgColor: 'rgba(231, 76, 60, 0.15)', icon: '🏆' },
};

// Rating thresholds (for progress bars)
export const DIVISION_THRESHOLDS: Record<Division, number> = {
  Bronze: 0,
  Silver: 1000,
  Gold: 1200,
  Platinum: 1400,
  Diamond: 1600,
  Master: 1800,
  Grandmaster: 2000,
};
