'use client';

import { useState, useEffect } from 'react';
import { getGameHistory, API_BASE } from '@/lib/api';
import { TOKEN_GRADIENT, TOKEN_TEXT, TOKEN_LABEL, GEM_GRADIENT, GEM_COLORS, CARD_GRADIENT, LEVEL_COLOR } from '@/lib/colors';
import type { GemColor, TokenColor } from '@/types/game';

interface CardData {
  id: number;
  level: number;
  bonus: string;
  points: number;
  cost?: Record<string, number>;
  background_image?: string;
}

interface NobleData {
  id: number;
  points: number;
  requirements?: Record<string, number>;
  name?: string;
  background_image?: string;
}

interface HistoryAction {
  turn_number: number;
  round_number: number;
  player: {
    id: number;
    username: string;
    order: number;
  };
  action_type: string;
  action_data: {
    colors?: string[];
    card_id?: number;
    noble_id?: number;
    takes?: Record<string, number>;
    returns?: Record<string, number>;
    // Token tracking for take_tokens
    bank_before?: Record<string, number>;
    bank_after?: Record<string, number>;
    player_tokens_before?: Record<string, number>;
    player_tokens_after?: Record<string, number>;
    // Token tracking for buy_card
    tokens_spent?: Record<string, number>;
    from_reserved?: boolean;
    // Gold tracking for reserve_card
    gold_received?: boolean;
    bank_gold_before?: number;
    bank_gold_after?: number;
    from_deck?: boolean;
    level?: number;
  };
  // Card and noble are at root level, not inside action_data
  card?: CardData;
  noble?: NobleData;
  prestige_points_after: number;
  created_at: string;
}

interface PlayerResult {
  player: {
    id: number;
    username: string;
    order: number;
  };
  prestige_points: number;
  is_winner: boolean;
  purchased_cards: CardData[];
  reserved_cards: CardData[];
  nobles: NobleData[];
  bonuses: Record<string, number>;
  total_cards: number;
}

interface GameHistoryData {
  game: {
    code: string;
    status: string;
    winner_username: string | null;
    total_turns: number;
    created_at: string;
    finished_at: string | null;
  };
  players: Array<{
    id: number;
    username: string;
    order: number;
  }>;
  history: HistoryAction[];
  results: PlayerResult[];
}

interface GameHistoryProps {
  gameCode: string;
  onClose?: () => void;
  inline?: boolean;
}

const ACTION_ICONS: Record<string, string> = {
  take_tokens: '🪙',
  buy_card: '✓',
  reserve_card: '📌',
  noble_visit: '👑',
};

const ACTION_LABELS: Record<string, string> = {
  take_tokens: 'Took Tokens',
  buy_card: 'Purchased',
  reserve_card: 'Reserved',
  noble_visit: 'Noble Visit',
};

// Action type specific styling
const ACTION_STYLES: Record<string, { bg: string; border: string; iconBg: string }> = {
  take_tokens: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    iconBg: 'bg-yellow-500/20 text-yellow-400',
  },
  buy_card: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/20 text-emerald-400',
  },
  reserve_card: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    iconBg: 'bg-blue-500/20 text-blue-400',
  },
  noble_visit: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    iconBg: 'bg-amber-500/20 text-amber-400',
  },
};

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };

export default function GameHistory({ gameCode, onClose, inline = false }: GameHistoryProps) {
  const [historyData, setHistoryData] = useState<GameHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'results'>('results');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await getGameHistory(gameCode);
        setHistoryData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [gameCode]);

  const renderTokens = (tokens: Record<string, number> | string[], prefix = '') => {
    // Handle array of colors (for take_tokens)
    if (Array.isArray(tokens)) {
      const counts: Record<string, number> = {};
      tokens.forEach(color => {
        counts[color] = (counts[color] || 0) + 1;
      });
      return renderTokens(counts, prefix);
    }
    
    // Handle object of color -> count
    const entries = Object.entries(tokens).filter(([, count]) => count > 0);
    if (entries.length === 0) return null;
    
    return (
      <span className="inline-flex items-center gap-1 ml-1">
        {prefix && <span className="text-slate-500 text-xs">{prefix}</span>}
        {entries.map(([color, count]) => (
          <span
            key={color}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold ${TOKEN_TEXT[color as TokenColor]}`}
            style={{ background: TOKEN_GRADIENT[color as TokenColor] }}
            title={TOKEN_LABEL[color as TokenColor]}
          >
            {count}
          </span>
        ))}
      </span>
    );
  };

  // Helper to get full image URL
  const getImageUrl = (img: string | undefined): string | null => {
    if (!img || img.trim() === '' || img.endsWith('/Null') || img.endsWith('/null')) {
      return null;
    }
    if (img.startsWith('http')) {
      return img;
    }
    return `${API_BASE}${img}`;
  };

  const renderCard = (card: CardData, size: 'sm' | 'md' | 'lg' = 'sm') => {
    const bonus = card.bonus as GemColor;
    const imageUrl = getImageUrl(card.background_image);
    const sizeMap = {
      sm: { w: 'w-14', h: 'h-20', text: 'text-[9px]', gem: 'w-4 h-4', level: 'text-[7px] px-1' },
      md: { w: 'w-16', h: 'h-24', text: 'text-[10px]', gem: 'w-5 h-5', level: 'text-[8px] px-1.5' },
      lg: { w: 'w-20', h: 'h-28', text: 'text-xs', gem: 'w-6 h-6', level: 'text-[9px] px-2' },
    };
    const s = sizeMap[size];
    
    return (
      <span
        className={`inline-flex flex-col ${s.w} ${s.h} rounded-lg overflow-hidden relative shadow-md`}
        style={{ background: CARD_GRADIENT[bonus] }}
      >
        {/* Background image */}
        {imageUrl && (
          <>
            <img
              src={imageUrl}
              alt={`Lv${card.level} ${bonus}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: CARD_GRADIENT[bonus], opacity: 0.65 }}
            />
          </>
        )}
        
        {/* Content */}
        <span className="relative z-10 flex flex-col h-full p-1">
          {/* Top row: Level + Points */}
          <span className="flex justify-between items-start">
            <span className={`${s.level} py-0.5 rounded-full font-black ${LEVEL_COLOR[card.level as 1 | 2 | 3]} text-slate-900`}>
              {ROMAN[card.level]}
            </span>
            {card.points > 0 && (
              <span className={`${s.text} font-black text-amber-400 drop-shadow`}>
                +{card.points}
              </span>
            )}
          </span>
          
          {/* Center: Gem */}
          <span className="flex-1 flex items-center justify-center">
            <span
              className={`${s.gem} rounded-full shadow-lg`}
              style={{ background: GEM_GRADIENT[bonus] }}
            />
          </span>
          
          {/* Bottom: Cost */}
          {card.cost && (
            <span className="flex gap-0.5 justify-center flex-wrap">
              {GEM_COLORS.filter(c => (card.cost?.[c] || 0) > 0).map(color => (
                <span
                  key={color}
                  className={`${s.text} font-bold px-1 py-0.5 rounded ${TOKEN_TEXT[color]}`}
                  style={{ background: TOKEN_GRADIENT[color], minWidth: '14px', textAlign: 'center' }}
                >
                  {card.cost?.[color]}
                </span>
              ))}
            </span>
          )}
        </span>
      </span>
    );
  };

  const renderNoble = (noble: NobleData, size: 'sm' | 'md' = 'sm') => {
    const imageUrl = getImageUrl(noble.background_image);
    const sizeCls = size === 'md' ? 'w-14 h-14' : 'w-10 h-10';
    
    return (
      <span
        className={`inline-flex flex-col items-center justify-center ${sizeCls} rounded-lg overflow-hidden relative border-2 border-amber-500/50 shadow-md`}
        style={{ background: 'linear-gradient(135deg, #451a03, #78350f)' }}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt={noble.name || 'Noble'}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <span className="relative z-10 flex flex-col items-center justify-center h-full">
          {!imageUrl && <span className="text-lg">👑</span>}
          <span className={`font-black text-amber-300 ${size === 'md' ? 'text-sm' : 'text-xs'} drop-shadow bg-black/50 px-1 rounded`}>
            +{noble.points}
          </span>
        </span>
      </span>
    );
  };

  // Display bank state in a compact format
  const renderBankSummary = (bank: Record<string, number>) => {
    const total = Object.values(bank).reduce((sum, n) => sum + n, 0);
    return (
      <span className="text-[9px] text-slate-500 ml-1" title={Object.entries(bank).filter(([,v]) => v > 0).map(([c,v]) => `${c}: ${v}`).join(', ')}>
        (Bank: {total})
      </span>
    );
  };

  // Helper to sum token values
  const sumTokens = (tokens: Record<string, number> | undefined): number => {
    if (!tokens) return 0;
    return Object.values(tokens).reduce((sum, n) => sum + (n as number), 0);
  };

  // Render token comparison (before → after) for each color
  const renderTokenComparison = (before: Record<string, number>, after: Record<string, number>) => {
    const colors = ['white', 'blue', 'green', 'red', 'black', 'gold'] as const;
    const changed = colors.filter(c => (before[c] || 0) !== (after[c] || 0));
    if (changed.length === 0) return null;
    
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        {changed.map(color => {
          const b = before[color] || 0;
          const a = after[color] || 0;
          const diff = a - b;
          return (
            <span
              key={color}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${TOKEN_TEXT[color as TokenColor]}`}
              style={{ background: TOKEN_GRADIENT[color as TokenColor] }}
              title={`${TOKEN_LABEL[color as TokenColor]}: ${b} → ${a}`}
            >
              {b}→{a}
              <span className={`text-[8px] ${diff > 0 ? 'text-green-300' : 'text-red-300'}`}>
                ({diff > 0 ? '+' : ''}{diff})
              </span>
            </span>
          );
        })}
      </span>
    );
  };

  const renderActionDetails = (action: HistoryAction) => {
    const { action_type, action_data, card, noble } = action;

    switch (action_type) {
      case 'take_tokens':
        return (
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center flex-wrap gap-1.5">
              <span className="text-[10px] text-yellow-400/70 font-medium">Took:</span>
              {action_data.takes && renderTokens(action_data.takes)}
              {action_data.returns && Object.keys(action_data.returns).length > 0 && (
                <>
                  <span className="text-slate-500 text-[10px] ml-2">Returned:</span>
                  {renderTokens(action_data.returns)}
                </>
              )}
              {action_data.colors && !action_data.takes && renderTokens(action_data.colors)}
            </span>
            {/* Token details - show individual breakdown */}
            {action_data.bank_before && action_data.bank_after && (
              <div className="flex flex-col gap-1 text-[9px] text-slate-400 bg-slate-800/30 rounded px-2 py-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500">🏦 Bank:</span>
                  {renderTokenComparison(action_data.bank_before, action_data.bank_after)}
                  <span className="text-slate-600 ml-1">
                    (Total: {sumTokens(action_data.bank_before)} → {sumTokens(action_data.bank_after)})
                  </span>
                </div>
                {action_data.player_tokens_before && action_data.player_tokens_after && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">👤 Player:</span>
                    {renderTokenComparison(action_data.player_tokens_before, action_data.player_tokens_after)}
                    <span className="text-slate-600 ml-1">
                      (Total: {sumTokens(action_data.player_tokens_before)} → {sumTokens(action_data.player_tokens_after)})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      
      case 'buy_card':
        return card ? (
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2">
              {renderCard(card)}
              <span className="text-[10px] text-emerald-400/70">✓ Purchased</span>
            </span>
            {/* Token spent details */}
            {action_data.tokens_spent && Object.keys(action_data.tokens_spent).length > 0 && (
              <div className="flex flex-col gap-1 text-[9px] text-slate-400 bg-slate-800/30 rounded px-2 py-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500">💰 Paid:</span>
                  {renderTokens(action_data.tokens_spent)}
                </div>
                {action_data.player_tokens_before && action_data.player_tokens_after && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">👤 Player:</span>
                    {renderTokenComparison(action_data.player_tokens_before, action_data.player_tokens_after)}
                    <span className="text-slate-600 ml-1">
                      (Total: {sumTokens(action_data.player_tokens_before)} → {sumTokens(action_data.player_tokens_after)})
                    </span>
                  </div>
                )}
                {action_data.bank_before && action_data.bank_after && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">🏦 Bank:</span>
                    {renderTokenComparison(action_data.bank_before, action_data.bank_after)}
                    <span className="text-slate-600 ml-1">
                      (Total: {sumTokens(action_data.bank_before)} → {sumTokens(action_data.bank_after)})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null;
      
      case 'reserve_card':
        return card ? (
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              {renderCard(card)}
              {action_data.gold_received !== false && (
                <span className="flex items-center gap-1">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: TOKEN_GRADIENT.gold }}
                  >
                    +1
                  </span>
                </span>
              )}
              <span className="text-[10px] text-blue-400/70">Reserved</span>
            </span>
            {/* Gold details */}
            {action_data.gold_received !== undefined && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-500 mt-0.5">
                {action_data.gold_received ? (
                  <span>🪙 Gold: +1 (Bank: {action_data.bank_gold_before ?? '?'} → {action_data.bank_gold_after ?? '?'})</span>
                ) : (
                  <span>🪙 No gold available</span>
                )}
              </div>
            )}
          </div>
        ) : null;
      
      case 'noble_visit':
        return noble ? (
          <span className="flex items-center gap-2">
            {renderNoble(noble)}
            <span className="text-[10px] text-amber-400/70">Noble attracted!</span>
          </span>
        ) : null;
      
      default:
        return null;
    }
  };

  const renderHistory = () => {
    if (!historyData?.history.length) {
      return (
        <div className="text-center text-slate-500 py-8">
          No action history available
        </div>
      );
    }

    // Group by round
    const rounds: Record<number, HistoryAction[]> = {};
    historyData.history.forEach(action => {
      const round = action.round_number;
      if (!rounds[round]) rounds[round] = [];
      rounds[round].push(action);
    });

    return (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {Object.entries(rounds)
          .slice()
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([round, actions]) => (
            <div key={round} className="bg-slate-800/50 rounded-xl p-3">
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
                Round {round}
              </div>
              <div className="space-y-2">
                {actions.map((action) => {
                  const style = ACTION_STYLES[action.action_type] || ACTION_STYLES.take_tokens;
                  return (
                    <div
                      key={`${action.turn_number}-${action.player.id}`}
                      className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${style.bg} ${style.border}`}
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 ${style.iconBg}`}>
                        {ACTION_ICONS[action.action_type] || '❓'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-sm text-slate-100">
                            {action.player.username}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {ACTION_LABELS[action.action_type] || action.action_type}
                          </span>
                        </div>
                        <div className="mt-1.5">
                          {renderActionDetails(action)}
                        </div>
                      </div>
                      <div className="text-right shrink-0 bg-slate-800/50 px-2 py-1 rounded">
                        <span className="text-sm font-bold text-slate-200">
                          {action.prestige_points_after}
                        </span>
                        <span className="text-[9px] text-slate-500 block">pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    );
  };

  const renderResults = () => {
    if (!historyData?.results.length) {
      return (
        <div className="text-center text-slate-500 py-8">
          No results available
        </div>
      );
    }

    return (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {[...historyData.results]
          .sort((a, b) => b.prestige_points - a.prestige_points)
          .map((player, idx) => (
            <div
              key={player.player.id}
              className={`rounded-xl p-4 ${
                player.is_winner
                  ? 'bg-amber-500/15 border border-amber-500/40'
                  : 'bg-slate-800/50 border border-slate-700/40'
              }`}
            >
              {/* Player header */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xl font-bold ${player.is_winner ? 'text-amber-400' : 'text-slate-500'}`}>
                  {['♛', '②', '③', '④'][idx] ?? '—'}
                </span>
                <span className={`font-bold text-lg ${player.is_winner ? 'text-amber-200' : 'text-slate-100'}`}>
                  {player.player.username}
                </span>
                <span className={`ml-auto text-2xl font-black ${player.is_winner ? 'gold-text' : 'text-slate-300'}`}>
                  {player.prestige_points}
                  <span className="text-[10px] text-slate-500 font-normal ml-1">pts</span>
                </span>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-400 mb-3">
                <span>{player.purchased_cards.length} cards</span>
                <span>{player.reserved_cards.length} reserved</span>
                <span>{player.nobles.length} nobles</span>
              </div>

              {/* Bonuses */}
              <div className="flex flex-wrap gap-1 mb-3">
                {GEM_COLORS.map(color => {
                  const count = player.bonuses[color] || 0;
                  if (count === 0) return null;
                  return (
                    <span
                      key={color}
                      className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-xs font-bold text-white"
                      style={{ background: GEM_GRADIENT[color] }}
                    >
                      {count}
                    </span>
                  );
                })}
              </div>

              {/* Purchased cards */}
              {player.purchased_cards.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    Purchased Cards
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {player.purchased_cards.map(card => (
                      <span key={card.id}>
                        {renderCard(card, 'md')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Reserved cards */}
              {player.reserved_cards.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    Reserved (Not Bought)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {player.reserved_cards.map(card => (
                      <span key={card.id} className="opacity-60">
                        {renderCard(card, 'md')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Nobles */}
              {player.nobles.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    Nobles Earned
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {player.nobles.map(noble => (
                      <span key={noble.id}>
                        {renderNoble(noble, 'md')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    );
  };

  // Inline mode - render directly without modal wrapper
  if (inline) {
    return (
      <div className="glass rounded-2xl border border-slate-700">
        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${
              activeTab === 'results'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-800/50'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Final Results
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${
              activeTab === 'history'
                ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-800/50'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Turn History
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-slate-600 border-t-amber-400 rounded-full" />
            </div>
          )}
          {error && (
            <div className="text-center text-red-400 py-8">
              {error}
            </div>
          )}
          {!loading && !error && historyData && (
            activeTab === 'results' ? renderResults() : renderHistory()
          )}
        </div>
      </div>
    );
  }

  // Modal mode
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-100">Game History</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
          {historyData && (
            <p className="text-sm text-slate-500 mt-1">
              {historyData.game.total_turns} turns
              {historyData.game.winner_username && (
                <> · Winner: <span className="text-amber-400">{historyData.game.winner_username}</span></>
              )}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === 'results'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Final Results
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === 'history'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Turn History
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-slate-600 border-t-amber-400 rounded-full" />
            </div>
          )}
          {error && (
            <div className="text-center text-red-400 py-8">
              {error}
            </div>
          )}
          {!loading && !error && historyData && (
            activeTab === 'results' ? renderResults() : renderHistory()
          )}
        </div>
      </div>
    </div>
  );
}
