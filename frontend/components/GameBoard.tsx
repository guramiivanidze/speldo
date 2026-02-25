'use client';

import { useState } from 'react';
import { GameState, GemColor, TokenColor } from '@/types/game';
import CardDisplay from './CardDisplay';
import NobleDisplay from './NobleDisplay';
import { TokenRow } from './TokenDisplay';
import CompactPlayerPanel from './CompactPlayerPanel';
import PlayerArea from './PlayerArea';
import { GEM_COLORS, TOKEN_LABEL } from '@/lib/colors';

interface GameBoardProps {
  gameState: GameState;
  myUserId: number;
  onTakeTokens: (colors: string[]) => void;
  onReserveCard: (cardId?: number, level?: number) => void;
  onBuyCard: (cardId: number) => void;
}

const LEVEL_DOT: Record<string, string> = { '3': 'bg-red-400', '2': 'bg-yellow-400', '1': 'bg-emerald-400' };

export default function GameBoard({
  gameState,
  myUserId,
  onTakeTokens,
  onReserveCard,
  onBuyCard,
}: GameBoardProps) {
  const [selectedTokens, setSelectedTokens] = useState<TokenColor[]>([]);

  const currentPlayer = gameState.players[gameState.current_player_index];
  const isMyTurn = currentPlayer?.id === myUserId;
  const me = gameState.players.find((p) => p.id === myUserId);
  const canReserveMore = me ? me.reserved_card_ids.length < 3 : false;

  const { cards_data, nobles_data, visible_cards, deck_counts, tokens_in_bank, available_nobles } = gameState;

  // Separate opponents from me
  const opponents = gameState.players.filter(p => p.id !== myUserId);

  // Compute which cards I can afford
  function canAfford(cardId: number): boolean {
    if (!me) return false;
    const card = cards_data[String(cardId)];
    if (!card) return false;
    const bonuses: Record<string, number> = {};
    for (const cid of me.purchased_card_ids) {
      const c = cards_data[String(cid)];
      if (c) bonuses[c.bonus] = (bonuses[c.bonus] || 0) + 1;
    }
    let goldNeeded = 0;
    for (const color of GEM_COLORS) {
      const need = Math.max(0, (card.cost[color] || 0) - (bonuses[color] || 0));
      const have = me.tokens[color] || 0;
      if (have < need) goldNeeded += need - have;
    }
    return goldNeeded <= (me.tokens.gold || 0);
  }

  function handleTokenClick(color: TokenColor) {
    if (!isMyTurn || color === 'gold') return;
    const gem = color as GemColor;
    setSelectedTokens((prev) => {
      if (prev.length === 2 && prev[0] === gem && prev[1] === gem) return [];
      if (prev.includes(gem) && new Set(prev).size > 1) return prev.filter(c => c !== gem);
      if (prev.length === 1 && prev[0] === gem && tokens_in_bank[gem] >= 4) return [gem, gem];
      if (prev.length < 3 && !prev.includes(gem)) return [...prev, gem];
      if (prev.length === 3) return [gem];
      return prev;
    });
  }

  function confirmTakeTokens() {
    if (!selectedTokens.length) return;
    onTakeTokens(selectedTokens);
    setSelectedTokens([]);
  }

  const levels: ('3' | '2' | '1')[] = ['3', '2', '1'];

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-2">
      
      {/* Status Banner - Top */}
      <div className={`
        shrink-0 rounded-lg px-3 py-1.5 flex items-center justify-between mb-2
        ${isMyTurn
          ? 'bg-amber-500/15 border border-amber-500/40'
          : 'bg-slate-800/60 border border-slate-700/50'}
      `}>
        <div className="flex items-center gap-2">
          {isMyTurn ? (
            <>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-bold text-amber-300 text-sm">Your turn</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-slate-500" />
              <span className="text-slate-400 text-sm">
                Waiting for <span className="text-slate-200 font-semibold">{currentPlayer?.username}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main Board Grid */}
      <div className="flex-1 grid grid-rows-[auto_1fr_auto] grid-cols-[auto_1fr_auto] gap-2 min-h-0">
        
        {/* Top-left corner */}
        <div />
        
        {/* Top opponent(s) */}
        <div className="flex justify-center gap-2">
          {opponents.length === 1 && (
            <CompactPlayerPanel
              player={opponents[0]}
              isCurrentTurn={opponents[0].id === currentPlayer?.id}
              isMe={false}
              cardsData={cards_data}
              position="top"
            />
          )}
          {opponents.length === 3 && opponents[1] && (
            <CompactPlayerPanel
              player={opponents[1]}
              isCurrentTurn={opponents[1].id === currentPlayer?.id}
              isMe={false}
              cardsData={cards_data}
              position="top"
            />
          )}
        </div>
        
        {/* Top-right corner */}
        <div />

        {/* Left opponent */}
        <div className="flex items-center justify-center w-32">
          {opponents.length >= 2 && opponents[0] && (
            <CompactPlayerPanel
              player={opponents[0]}
              isCurrentTurn={opponents[0].id === currentPlayer?.id}
              isMe={false}
              cardsData={cards_data}
              position="left"
            />
          )}
        </div>

        {/* CENTER - Main Game Area */}
        <div className="glass rounded-xl p-3 flex flex-col gap-2 overflow-hidden min-h-0">
          
          {/* Gem Bank - Centered */}
          <div className="flex justify-center items-center gap-2 shrink-0">
            <span className="text-slate-400 text-xs">◈</span>
            <TokenRow
              tokens={tokens_in_bank}
              onClickToken={isMyTurn && gameState.status === 'playing' ? handleTokenClick : undefined}
              selectedTokens={selectedTokens}
              size="md"
            />
            {selectedTokens.length > 0 && (
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                  onClick={confirmTakeTokens}
                >
                  Take
                </button>
                <button
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-bold"
                  onClick={() => setSelectedTokens([])}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Nobles - Centered */}
          <div className="flex justify-center items-center gap-2 shrink-0">
            <span className="text-amber-400 text-sm">♛</span>
            <div className="flex gap-2">
              {available_nobles.map((nid) => {
                const noble = nobles_data[String(nid)];
                return noble ? <NobleDisplay key={nid} noble={noble} compact /> : null;
              })}
            </div>
          </div>

          <div className="h-px bg-white/10 shrink-0" />

          {/* Card Rows */}
          <div className="flex-1 flex flex-col gap-2 min-h-0 justify-center w-full overflow-hidden">
            {levels.map((level) => (
              <div key={level} className="flex items-stretch gap-2 w-full h-[calc(33%-8px)]">
                {/* Deck */}
                <button
                  className={`
                    shrink-0 w-12 rounded-lg flex flex-col items-center justify-center
                    text-[10px] font-bold transition-all
                    ${isMyTurn && canReserveMore && (deck_counts[level] ?? 0) > 0
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer border border-slate-600'
                      : 'bg-slate-800/40 text-slate-600 cursor-default border border-slate-700/30'}
                  `}
                  onClick={() => {
                    if (isMyTurn && canReserveMore && (deck_counts[level] ?? 0) > 0) {
                      onReserveCard(undefined, Number(level));
                    }
                  }}
                >
                  <div className={`w-2 h-2 rounded-full mb-1 ${LEVEL_DOT[level]}`} />
                  <span>{deck_counts[level] ?? 0}</span>
                </button>

                {/* Cards - responsive grid */}
                <div className="flex-1 grid grid-cols-4 gap-2 h-full">
                  {(visible_cards[level] || []).map((cardId) => {
                    const card = cards_data[String(cardId)];
                    if (!card) return null;
                    const affordable = canAfford(cardId);
                    return (
                      <CardDisplay
                        key={cardId}
                        card={card}
                        onBuy={() => onBuyCard(cardId)}
                        onReserve={() => onReserveCard(cardId)}
                        canBuy={isMyTurn && affordable && gameState.status === 'playing'}
                        canReserve={isMyTurn && canReserveMore && gameState.status === 'playing'}
                        showActions={isMyTurn && gameState.status === 'playing'}
                        compact
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right opponent */}
        <div className="flex items-center justify-center w-32">
          {opponents.length >= 3 && opponents[2] && (
            <CompactPlayerPanel
              player={opponents[2]}
              isCurrentTurn={opponents[2].id === currentPlayer?.id}
              isMe={false}
              cardsData={cards_data}
              position="right"
            />
          )}
          {opponents.length === 2 && opponents[1] && (
            <CompactPlayerPanel
              player={opponents[1]}
              isCurrentTurn={opponents[1].id === currentPlayer?.id}
              isMe={false}
              cardsData={cards_data}
              position="right"
            />
          )}
        </div>

        {/* Bottom-left corner */}
        <div />

        {/* Bottom - My Player Area */}
        <div className="flex justify-center">
          {me && (
            <div className="w-full max-w-xl">
              <PlayerArea
                player={me}
                isCurrentTurn={me.id === currentPlayer?.id}
                isMe={true}
                cardsData={cards_data}
                noblesData={nobles_data}
                onBuyReserved={
                  isMyTurn && gameState.status === 'playing'
                    ? (cid) => onBuyCard(cid)
                    : undefined
                }
              />
            </div>
          )}
        </div>

        {/* Bottom-right corner */}
        <div />
      </div>
    </div>
  );
}
