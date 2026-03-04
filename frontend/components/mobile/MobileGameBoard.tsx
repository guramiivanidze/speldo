'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
import ActionNotification from '../ActionNotification';
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

  // Compute player's card bonuses
  const playerBonuses = useMemo(() => {
    if (!me) return undefined;
    const bonuses: Record<GemColor, number> = { white: 0, blue: 0, green: 0, red: 0, black: 0 };
    for (const cid of me.purchased_card_ids) {
      const c = cards_data[String(cid)];
      if (c && c.bonus in bonuses) {
        bonuses[c.bonus as GemColor] += 1;
      }
    }
    return bonuses;
  }, [me, cards_data]);
  
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

  // Track the new card for animation (only for buy/reserve actions)
  const prevTurnNumberRef = useRef<number>(0);
  const [newCardId, setNewCardId] = useState<number | null>(null);

  // Track action notification visibility (temporary, 3 seconds)
  const [showNotification, setShowNotification] = useState(false);
  const lastNotifiedTurnRef = useRef<number>(0);

  // Show notification when opponent makes a move
  useEffect(() => {
    const lastAction = gameState.last_action;
    if (lastAction && lastAction.turn_number > lastNotifiedTurnRef.current && lastAction.player_id !== myUserId) {
      lastNotifiedTurnRef.current = lastAction.turn_number;
      setShowNotification(true);
    }
  }, [gameState.last_action?.turn_number, gameState.last_action?.player_id, myUserId]);

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (!showNotification) return;
    
    const timeout = setTimeout(() => {
      setShowNotification(false);
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [showNotification]);

  // Detect the new card when a card is bought or reserved (not for take_tokens)
  useEffect(() => {
    const currentTurn = gameState.total_turns || 0;
    const lastAction = gameState.last_action;
    
    // Only animate for buy_card or reserve_card actions
    if (currentTurn > prevTurnNumberRef.current && lastAction) {
      const actionType = lastAction.type;
      
      // Only trigger animation for buy_card or reserve_card (from visible, not from deck/reserved)
      if (actionType === 'buy_card' || actionType === 'reserve_card') {
        const actionData = lastAction.data;
        
        // For reserve_card from deck, there's no new visible card (it goes to hand)
        // For reserve_card from visible OR buy_card from visible, a new card appears
        const fromDeck = actionData?.from_deck;
        const fromReserved = actionData?.from_reserved;
        
        // Only animate if the card was taken from visible (triggers refill)
        if (!fromDeck && !fromReserved) {
          // Get the new_card_id from the action data
          const newId = actionData?.new_card_id;
          
          if (newId) {
            setNewCardId(newId);
          }
          // Clear the animation after it completes (match the 1.8s animation duration + buffer)
          const timeout = setTimeout(() => {
            setNewCardId(null);
          }, 2000);
          
          prevTurnNumberRef.current = currentTurn;
          return () => clearTimeout(timeout);
        }
      }
    }
    
    // Update turn ref for non-animation actions
    prevTurnNumberRef.current = currentTurn;
  }, [gameState.total_turns, gameState.last_action]);

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
        players={gameState.players}
        currentPlayerIndex={gameState.current_player_index}
        myUserId={myUserId}
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
            newCardId={newCardId}
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
          playerTokens={me?.tokens}
          playerBonuses={playerBonuses}
          selectedTokens={selectedTokens}
          onSelectToken={handleTokenClick}
          onConfirm={handleConfirmTokens}
          onCancel={handleCancelTokens}
          disabledColors={disabledTokenColors}
          viewOnly={!isMyTurn || gameState.status !== 'playing'}
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

      {/* Action Notification Toast - fixed position, doesn't affect layout */}
      {showNotification && gameState.last_action && (
        <ActionNotification lastAction={gameState.last_action} myUserId={myUserId} />
      )}
    </div>
  );
}
