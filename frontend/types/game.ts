export type GemColor = 'white' | 'blue' | 'green' | 'red' | 'black';
export type TokenColor = GemColor | 'gold';

export interface Card {
  id: number;
  level: 1 | 2 | 3;
  bonus: GemColor;
  points: number;
  cost: Record<GemColor, number>;
}

export interface Noble {
  id: number;
  points: number;
  requirements: Record<GemColor, number>;
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
}

export interface GameState {
  game_id: string;
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  current_player_index: number;
  tokens_in_bank: Record<TokenColor, number>;
  visible_cards: Record<string, number[]>;
  deck_counts: Record<string, number>;
  available_nobles: number[];
  players: PlayerState[];
  winner_id: number | null;
  cards_data: Record<string, Card>;
  nobles_data: Record<string, Noble>;
}

export interface WebSocketMessage {
  type: 'game_state' | 'error';
  state?: GameState;
  message?: string;
}
