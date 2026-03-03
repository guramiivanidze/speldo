'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, GemColor, TokenColor } from '@/types/game';
import { GEM_COLORS } from '@/lib/colors';
import { ChatMessage } from '@/hooks/useGameSocket';

import MobileTurnBanner from './MobileTurnBanner';
import MobileNavTabs from './MobileNavTabs';
import MobileBoardView from './MobileBoardView';
import MobilePlayerView from './MobilePlayerView';
import MobileOpponentsView from './MobileOpponentsView';
import MobileTokenSelector from './MobileTokenSelector';
import DiscardTokensModal from '../DiscardTokensModal';
import GameChat from '../GameChat';

type MobileTab = 'board' | 'me' | 'opponents' | 'chat';

interface MobileGameBoardProps {
  gameState: GameState;
  myUserId: number;
  onTakeTokens: (colors: string[]) => void;
  onReserveCard: (cardId?: number, level?: number) => void;
  onBuyCard: (cardId: number) => void;
  onDiscardTokens: (tokens: Record<string, number>) => void;
  onCancelPendingDiscard?: () => void;
  chatMessages?: ChatMessage[];
  onSendChat?: (message: string) => void;
}

export default function MobileGameBoard({
  gameState,
  myUserId,
  onTakeTokens,
  onReserveCard,
  onBuyCard,
  onDiscardTokens,
  onCancelPendingDiscard,
  chatMessages = [],
  onSendChat,
}: MobileGameBoardProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>('board');
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<TokenColor[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const lastSeenChatCountRef = useRef(0);

  const currentPlayer = gameState.players[gameState.current_player_index];
  const isMyTurn = currentPlayer?.id === myUserId;
  const me = gameState.players.find((p) => p.id === myUserId);
  const opponents = gameState.players.filter((p) => p.id !== myUserId);
  const canReserveMore = me ? me.reserved_card_ids.length < 3 : false;

  // Check if I need to discard tokens
  const showDiscardModal = gameState.pending_discard && isMyTurn && me;

  const { cards_data, nobles_data, visible_cards, deck_counts, tokens_in_bank, available_nobles } = gameState;

  // Compute which cards I can afford
  const canAfford = useCallback((cardId: number): boolean => {
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
  }, [me, cards_data]);

  // Check if any reserved card is affordable
  const hasAffordableReserved = me?.reserved_card_ids.some((cid) => canAfford(cid)) ?? false;
  
  // Track if user has seen the affordable reserved card (visited Me tab)
  const [hasSeenAffordable, setHasSeenAffordable] = useState(false);
  const prevAffordableRef = useRef(hasAffordableReserved);
  
  // Reset "seen" state when a NEW reserved card becomes affordable
  useEffect(() => {
    if (hasAffordableReserved && !prevAffordableRef.current) {
      // A reserved card just became affordable - start flashing
      setHasSeenAffordable(false);
    }
    prevAffordableRef.current = hasAffordableReserved;
  }, [hasAffordableReserved]);
  
  // Stop flashing when user visits Me tab
  useEffect(() => {
    if (activeTab === 'me' && hasAffordableReserved) {
      setHasSeenAffordable(true);
    }
  }, [activeTab, hasAffordableReserved]);
  
  const shouldFlashMeTab = hasAffordableReserved && !hasSeenAffordable;

  // Track unread chat messages
  useEffect(() => {
    if (activeTab === 'chat') {
      // Reset unread count when viewing chat
      setUnreadChatCount(0);
      lastSeenChatCountRef.current = chatMessages.length;
    } else {
      // Count new messages since last seen
      const newMessages = chatMessages.length - lastSeenChatCountRef.current;
      if (newMessages > 0) {
        setUnreadChatCount(newMessages);
      }
    }
  }, [activeTab, chatMessages.length, chatMessages]);

  // Token selection logic
  const hasTwoSameColor = selectedTokens.length === 2 && selectedTokens[0] === selectedTokens[1];
  const selectedSameColor = hasTwoSameColor ? selectedTokens[0] : null;
  
  const disabledTokenColors: TokenColor[] = hasTwoSameColor
    ? (['white', 'blue', 'green', 'red', 'black', 'gold'] as TokenColor[]).filter(c => c !== selectedSameColor)
    : ['gold'];

  function handleTokenClick(color: TokenColor) {
    if (color === 'gold') return;
    const gem = color as GemColor;
    setSelectedTokens((prev) => {
      const uniqueColors = new Set(prev);
      const isAllSameColor = uniqueColors.size === 1 && prev.length === 2 && prev[0] === gem;
      
      if (isAllSameColor) return [];
      if (prev.length === 2 && prev[0] === prev[1] && prev[0] !== gem) return prev;
      if (prev.includes(gem) && uniqueColors.size > 1) return prev.filter(c => c !== gem);
      if (prev.length === 1 && prev[0] === gem && tokens_in_bank[gem] >= 4) return [gem, gem];
      if (prev.length < 3 && !prev.includes(gem)) return [...prev, gem];
      if (prev.length === 3) return [gem];
      return prev;
    });
  }

  function handleConfirmTokens() {
    if (selectedTokens.length > 0) {
      onTakeTokens(selectedTokens);
      setSelectedTokens([]);
      setShowTokenSelector(false);
    }
  }

  function handleCancelTokens() {
    setSelectedTokens([]);
    setShowTokenSelector(false);
  }

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-4">
      {/* Turn Banner */}
      <MobileTurnBanner
        isMyTurn={isMyTurn}
        currentPlayerName={currentPlayer?.username || 'Unknown'}
        myUsername={me?.username || 'You'}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'board' && (
          <MobileBoardView
            visibleCards={visible_cards}
            deckCounts={deck_counts}
            cardsData={cards_data}
            nobles={available_nobles}
            noblesData={nobles_data}
            tokensInBank={tokens_in_bank}
            isMyTurn={isMyTurn}
            canAfford={canAfford}
            canReserveMore={canReserveMore}
            gameStatus={gameState.status}
            onBuyCard={onBuyCard}
            onReserveCard={onReserveCard}
            onOpenTokenSelector={() => setShowTokenSelector(true)}
            selectedTokens={selectedTokens}
          />
        )}
        
        {activeTab === 'me' && me && (
          <MobilePlayerView
            player={me}
            cardsData={cards_data}
            noblesData={nobles_data}
            isMyTurn={isMyTurn}
            gameStatus={gameState.status}
            canAfford={canAfford}
            onBuyReservedCard={onBuyCard}
          />
        )}
        
        {activeTab === 'opponents' && (
          <MobileOpponentsView
            opponents={opponents}
            currentPlayerId={currentPlayer?.id || 0}
            cardsData={cards_data}
            noblesData={nobles_data}
          />
        )}

        {activeTab === 'chat' && onSendChat && (
          <GameChat
            messages={chatMessages}
            onSendMessage={onSendChat}
            myUserId={myUserId}
            isOpen={true}
            onClose={() => setActiveTab('board')}
            compact
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <MobileNavTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        opponentCount={opponents.length}
        flashMeTab={shouldFlashMeTab}
        showChat={!!onSendChat}
        unreadChatCount={unreadChatCount}
      />

      {/* Token Selector Modal */}
      {showTokenSelector && (
        <MobileTokenSelector
          tokensInBank={tokens_in_bank}
          selectedTokens={selectedTokens}
          onSelectToken={handleTokenClick}
          onConfirm={handleConfirmTokens}
          onCancel={handleCancelTokens}
          disabledColors={disabledTokenColors}
        />
      )}

      {/* Discard Tokens Modal */}
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
