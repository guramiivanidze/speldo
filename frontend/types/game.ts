export type GemColor = 'white' | 'blue' | 'green' | 'red' | 'black';
export type TokenColor = GemColor | 'gold';

export interface Card {
  id: number;
  level: 1 | 2 | 3;
  bonus: GemColor;
  points: number;
  cost: Record<GemColor, number>;
  background_image?: string;
}

export interface Noble {
  id: number;
  points: number;
  requirements: Record<GemColor, number>;
  background_image?: string;
  name?: string;
}

export interface PlayerState {
  id: number;
  username: string;
  order: number;
  tokens: Record<TokenColor, number>;
  purchased_card_ids: number[];
  reserved_card_ids: number[];
  noble_ids: number[];
  prestige_points: number;
  is_online: boolean;
}

export interface GameState {
  game_id: string;
  code: string;
  status: 'waiting' | 'playing' | 'paused' | 'finished';
  max_players: number;
  current_player_index: number;
  tokens_in_bank: Record<TokenColor, number>;
  visible_cards: Record<string, number[]>;
  deck_counts: Record<string, number>;
  available_nobles: number[];
  players: PlayerState[];
  winner_id: number | null;
  cards_data: Record<string, Card>;
  nobles_data: Record<string, Noble>;
  // Pause/leave state
  is_paused: boolean;
  pause_remaining_seconds: number | null;
  left_player_id: number | null;
  player_votes: Record<string, 'wait' | 'end'>;
  // Token discard state
  pending_discard: boolean;
  pending_discard_count: number;
}

export interface WebSocketMessage {
  type: 'game_state' | 'error' | 'player_left_survey' | 'game_resumed' | 'player_rejoined' | 'game_ended_by_vote' | 'game_ended_all_left' | 'all_voted_wait' | 'pause_timeout_ended' | 'waiting_room_closed' | 'player_left_waiting' | 'chat_message';
  state?: GameState;
  message?: string;
  left_user_id?: number;
  left_username?: string;
  user_id?: number;
  username?: string;
  timestamp?: string;
}
