'use client';

import { useState } from 'react';
import { GameState, GemColor, TokenColor } from '@/types/game';
import CardDisplay from './CardDisplay';
import NobleDisplay from './NobleDisplay';
import { TokenRow } from './TokenDisplay';
import CompactPlayerPanel from './CompactPlayerPanel';
import PlayerArea from './PlayerArea';
import DiscardTokensModal from './DiscardTokensModal';
import { GEM_COLORS, TOKEN_LABEL } from '@/lib/colors';
import useIsMobile from '@/hooks/useIsMobile';
import MobileGameBoard from './mobile/MobileGameBoard';

interface GameBoardProps {
  gameState: GameState;
  myUserId: number;
  onTakeTokens: (colors: string[]) => void;
  onReserveCard: (cardId?: number, level?: number) => void;
  onBuyCard: (cardId: number) => void;
  onDiscardTokens: (tokens: Record<string, number>) => void;
  onCancelPendingDiscard?: () => void;
}

const LEVEL_DOT: Record<string, string> = { '3': 'bg-red-400', '2': 'bg-yellow-400', '1': 'bg-emerald-400' };

export default function GameBoard({
  gameState,
  myUserId,
  onTakeTokens,
  onReserveCard,
  onBuyCard,
  onDiscardTokens,
  onCancelPendingDiscard,
}: GameBoardProps) {
  const isMobile = useIsMobile();
  const [selectedTokens, setSelectedTokens] = useState<TokenColor[]>([]);

  // Render mobile layout
  if (isMobile) {
    return (
      <MobileGameBoard
        gameState={gameState}
        myUserId={myUserId}
        onTakeTokens={onTakeTokens}
        onReserveCard={onReserveCard}
        onBuyCard={onBuyCard}
        onDiscardTokens={onDiscardTokens}
        onCancelPendingDiscard={onCancelPendingDiscard}
      />
    );
  }

  // Don't highlight current player when game is finished
  const isGameActive = gameState.status === 'playing' || gameState.status === 'paused';
  const currentPlayer = isGameActive ? gameState.players[gameState.current_player_index] : null;
  const isMyTurn = currentPlayer?.id === myUserId;
  const me = gameState.players.find((p) => p.id === myUserId);
  const canReserveMore = me ? me.reserved_card_ids.length < 3 : false;

  // Check if I need to discard tokens (pending_discard is true and it's my turn)
  const showDiscardModal = gameState.pending_discard && isMyTurn && me;

  const { cards_data, nobles_data, visible_cards, deck_counts, tokens_in_bank, available_nobles } = gameState;

  // Find my index in the player order
  const myIndex = gameState.players.findIndex(p => p.id === myUserId);
  const totalPlayers = gameState.players.length;

  // Position opponents around the table in clockwise order from my perspective:
  // - Left: next player (plays after me)
  // - Top: player across (in 4-player game)
  // - Right: previous player (plays before me)
  const getSeatedOpponents = () => {
    if (myIndex === -1 || totalPlayers <= 1) return { left: null, top: null, right: null };
    
    if (totalPlayers === 2) {
      // 2 players: opponent is across (top)
      const opponentIndex = (myIndex + 1) % 2;
      return { left: null, top: gameState.players[opponentIndex], right: null };
    }
    
    if (totalPlayers === 3) {
      // 3 players: next player on left, previous player on right
      const leftIndex = (myIndex + 1) % 3;
      const rightIndex = (myIndex + 2) % 3;
      return { 
        left: gameState.players[leftIndex], 
        top: null, 
        right: gameState.players[rightIndex] 
      };
    }
    
    if (totalPlayers === 4) {
      // 4 players: next on left, across on top, previous on right
      const leftIndex = (myIndex + 1) % 4;
      const topIndex = (myIndex + 2) % 4;
      const rightIndex = (myIndex + 3) % 4;
      return { 
        left: gameState.players[leftIndex], 
        top: gameState.players[topIndex], 
        right: gameState.players[rightIndex] 
      };
    }
    
    return { left: null, top: null, right: null };
  };

  const seatedOpponents = getSeatedOpponents();

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

  // Check if 2 same-color tokens are selected
  const hasTwoSameColor = selectedTokens.length === 2 && selectedTokens[0] === selectedTokens[1];
  const selectedSameColor = hasTwoSameColor ? selectedTokens[0] : null;

  // Compute disabled colors: when 2 same-color selected, disable all other colors
  const disabledTokenColors: TokenColor[] = hasTwoSameColor
    ? (['white', 'blue', 'green', 'red', 'black', 'gold'] as TokenColor[]).filter(c => c !== selectedSameColor)
    : ['gold'];

  // Count selections per color for display
  const selectionCounts: Partial<Record<TokenColor, number>> = {};
  for (const t of selectedTokens) {
    selectionCounts[t] = (selectionCounts[t] || 0) + 1;
  }

  function handleTokenClick(color: TokenColor) {
    if (!isMyTurn || color === 'gold') return;
    const gem = color as GemColor;
    setSelectedTokens((prev) => {
      const countOfColor = prev.filter(c => c === gem).length;
      const uniqueColors = new Set(prev);
      const isAllSameColor = uniqueColors.size === 1 && prev.length === 2 && prev[0] === gem;
      
      // If 2 same-color selected and clicking that color again -> reset
      if (isAllSameColor) {
        return [];
      }
      
      // If 2 same-color selected (different from clicked) -> ignore (disabled)
      if (prev.length === 2 && prev[0] === prev[1] && prev[0] !== gem) {
        return prev;
      }
      
      // If clicking a color already in selection (mixed colors) -> deselect it
      if (prev.includes(gem) && uniqueColors.size > 1) {
        return prev.filter(c => c !== gem);
      }
      
      // If 1 same-color selected and clicking it again -> try to take 2 (if 4+ available)
      if (prev.length === 1 && prev[0] === gem && tokens_in_bank[gem] >= 4) {
        return [gem, gem];
      }
      
      // If trying to add a different color when we already have 1 of same color
      // and there are 4+ of that color, we could do 2 same OR continue with different
      // But if prev is 1 token and clicking different color, add it
      if (prev.length < 3 && !prev.includes(gem)) {
        return [...prev, gem];
      }
      
      // If already 3 different colors selected, start fresh with this color
      if (prev.length === 3) {
        return [gem];
      }
      
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
    <div className="h-full w-full flex flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-1">

      {/* Main Board Grid */}
      <div className="flex-1 grid grid-rows-[auto_1fr_auto] grid-cols-[auto_1fr_auto] gap-0.5 min-h-0">
        
        {/* Top-left corner */}
        <div />
        
        {/* Top opponent */}
        <div className="flex justify-center gap-2">
          {seatedOpponents.top && (
            <CompactPlayerPanel
              player={seatedOpponents.top}
              isCurrentTurn={seatedOpponents.top.id === currentPlayer?.id}
              isMe={false}
              cardsData={cards_data}
              position="top"
            />
          )}
        </div>
        
        {/* Top-right corner */}
        <div />

        {/* Left opponent (next in turn order) */}
        <div className="flex items-center justify-center w-44">
          {seatedOpponents.left && (
            <CompactPlayerPanel
              player={seatedOpponents.left}
              isCurrentTurn={seatedOpponents.left.id === currentPlayer?.id}
              isMe={false}
              cardsData={cards_data}
              position="left"
            />
          )}
        </div>

        {/* CENTER - Main Game Area */}
        <div className="glass rounded-xl p-2 flex gap-2 overflow-hidden min-h-0 min-w-0">
          
          {/* Left side - Nobles + Cards */}
          <div className="flex-1 flex flex-col gap-0.5 min-h-0 min-w-0 overflow-hidden">
            {/* Nobles - Centered */}
            <div className="flex justify-center items-center gap-2 shrink-0 flex-wrap">
              <span className="text-amber-400 text-sm">♫</span>
              <div className="flex gap-5 flex-wrap justify-center">
                {available_nobles.map((nid) => {
                  const noble = nobles_data[String(nid)];
                  if (!noble) return null;
                  return (
                    <div key={nid} className="w-44 h-20">
                      <NobleDisplay noble={noble} compact />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-white/10 shrink-0" />

            {/* Card Rows */}
            <div className="flex-1 flex flex-col gap-5 min-h-0 w-full overflow-hidden">
            {levels.map((level) => (
              <div key={level} className="flex items-stretch gap-2 w-full flex-1 min-h-0">
                {/* Deck */}
                <button
                  className={`
                    shrink-0 w-15 rounded-lg flex flex-col items-center justify-center
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
                <div className="flex-1 grid grid-cols-4 gap-6 h-full min-w-0">
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

          {/* Right side - Gem Bank (inside board) */}
          <div className="shrink-0 w-20 flex flex-col items-center justify-center gap-6 border-l border-white/10 pl-0">
            <span className="text-slate-400 text-[14px]">◈ Bank</span>
            <TokenRow
              tokens={tokens_in_bank}
              onClickToken={isMyTurn && gameState.status === 'playing' ? handleTokenClick : undefined}
              selectedTokens={selectedTokens}
              selectionCounts={selectionCounts}
              disabledColors={disabledTokenColors}
              size="md"
              showLabel={false}
              vertical
            />
            {selectedTokens.length > 0 && (
              <div className="flex flex-col items-center gap-4">
                <button
                  className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[14px] font-bold w-full"
                  onClick={confirmTakeTokens}
                >
                  Take
                </button>
                <button
                  className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[9px] font-bold w-full"
                  onClick={() => setSelectedTokens([])}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right opponent (previous in turn order) */}
        <div className="flex items-center justify-center w-44">
          {seatedOpponents.right && (
            <CompactPlayerPanel
              player={seatedOpponents.right}
              isCurrentTurn={seatedOpponents.right.id === currentPlayer?.id}
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
            <div className="w-full max-w-3xl">
              <PlayerArea
                player={me}
                isCurrentTurn={me.id === currentPlayer?.id}
                isMe={true}
                cardsData={cards_data}
                onBuyReserved={
                  isMyTurn && gameState.status === 'playing'
                    ? (cid) => onBuyCard(cid)
                    : undefined
                }
                canAffordCard={canAfford}
              />
            </div>
          )}
        </div>

        {/* Bottom-right corner */}
        <div />
      </div>

      {/* Discard tokens modal */}
      {showDiscardModal && me && (
        <DiscardTokensModal
          playerTokens={me.tokens}
          discardCount={gameState.pending_discard_count}
          onDiscard={onDiscardTokens}
          onCancel={onCancelPendingDiscard}
        />
      )}
    </div>
  );
}
