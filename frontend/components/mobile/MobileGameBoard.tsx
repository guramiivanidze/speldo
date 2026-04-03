'use client';

import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
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
import NobleChoiceModal from '../NobleChoiceModal';
import ActionNotification from '../ActionNotification';
import GameChat from '../GameChat';
import TurnTimer from '../TurnTimer';
import { useAdvisor } from '@/hooks/useAdvisor';
import { AdvisorHint } from '../AdvisorHint';
import { ReservationAnimation } from '../ReservationAnimation';
import { Card } from '@/types/game';

type MobileTab = 'board' | 'me' | 'opponents' | 'chat';

interface MobileGameBoardProps {
  gameState: GameState;
  myUserId: number;
  onTakeTokens: (colors: string[]) => void;
  onReserveCard: (cardId?: number, level?: number) => void;
  onBuyCard: (cardId: number) => void;
  onDiscardTokens: (tokens: Record<string, number>) => void;
  onChooseNoble: (nobleId: number) => void;
  onCancelPendingDiscard?: () => void;
  onCheckTurnTimeout?: () => void;
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
  onChooseNoble,
  onCancelPendingDiscard,
  onCheckTurnTimeout,
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

  // Check if I need to choose a noble
  const pendingNobleChoice = gameState.pending_noble_choice || [];
  const showNobleChoiceModal = pendingNobleChoice.length > 0 && isMyTurn;

  const { cards_data, nobles_data, visible_cards, deck_counts, tokens_in_bank, available_nobles } = gameState;

  // Get eligible nobles for modal
  const eligibleNobles = pendingNobleChoice.map(id => nobles_data[String(id)]).filter(Boolean);

  // AI advisor
  const advisor = useAdvisor({
    gameCode: gameState.code,
    isMyTurn,
    enabled: gameState.status === 'playing',
  });
  const advice = advisor.active ? advisor.advice : null;
  const hintCardId: number | null =
    advice?.action === 'buy_card' ? (advice.card_id ?? null) :
    advice?.action === 'reserve_card' && typeof advice.reserve_card_id === 'number' ? advice.reserve_card_id :
    null;
  const hintCardAction: 'buy' | 'reserve' | null =
    advice?.action === 'buy_card' ? 'buy' :
    advice?.action === 'reserve_card' ? 'reserve' :
    null;
  const hintGemColors: string[] =
    advice?.action === 'take_gems' && advice.gems
      ? Object.entries(advice.gems).flatMap(([c, n]) => Array(n as number).fill(c))
      : [];

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

  // Reservation animation state
  const prevReserveTurnRef = useRef<number>(0);
  const [reservationAnim, setReservationAnim] = useState<{ card: Card; username: string; rect: { left: number; top: number; width: number; height: number } | null } | null>(null);

  // Capture card DOM positions after every render
  const cardPositionsRef = useRef<Record<string, { left: number; top: number; width: number; height: number }>>({});
  useLayoutEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-card-id]').forEach(el => {
      const id = el.dataset.cardId!;
      const r = el.getBoundingClientRect();
      cardPositionsRef.current[id] = { left: r.left, top: r.top, width: r.width, height: r.height };
    });
  });

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

  // Trigger reservation animation when a card is reserved from visible board
  useEffect(() => {
    const lastAction = gameState.last_action;
    if (
      lastAction?.type === 'reserve_card' &&
      !lastAction.data.from_deck &&
      lastAction.turn_number > prevReserveTurnRef.current
    ) {
      prevReserveTurnRef.current = lastAction.turn_number;
      const card = cards_data[String(lastAction.data.card_id)];
      if (card) {
        const rect = cardPositionsRef.current[String(lastAction.data.card_id)] ?? null;
        setReservationAnim({ card, username: lastAction.player_username, rect });
      }
    }
  }, [gameState.last_action?.turn_number, gameState.last_action?.type, cards_data]);

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
      {/* Turn Banner with Timer */}
      <div className="flex items-center justify-between px-2">
        <div className="flex-1">
          <MobileTurnBanner
            players={gameState.players}
            currentPlayerIndex={gameState.current_player_index}
            myUserId={myUserId}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {gameState.timer_enabled && gameState.status === 'playing' && currentPlayer && (
            <TurnTimer
              currentPlayerIndex={gameState.current_player_index}
              onTimeout={onCheckTurnTimeout || (() => {})}
              isMyTurn={isMyTurn}
              currentPlayerName={currentPlayer.username}
            />
          )}
        </div>
      </div>

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
            hintCardId={hintCardId}
            hintCardAction={hintCardAction}
            hintGemColors={hintGemColors}
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
          hintColors={hintGemColors}
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

      {/* Noble Choice Modal */}
      {showNobleChoiceModal && eligibleNobles.length > 0 && (
        <NobleChoiceModal
          eligibleNobles={eligibleNobles}
          onChoose={onChooseNoble}
        />
      )}

      {/* Action Notification Toast - fixed position, doesn't affect layout */}
      {showNotification && gameState.last_action && (
        <ActionNotification lastAction={gameState.last_action} myUserId={myUserId} />
      )}

      {/* AI Advisor panel — floats above the bottom nav */}
      {advisor.active && advice && (
        <div className="fixed bottom-20 right-3 z-40 w-60">
          <AdvisorHint advice={advice} isYourTurn={advisor.isYourTurn} cardsData={cards_data} floating={false} />
        </div>
      )}

      {/* Reservation animation overlay */}
      {reservationAnim && (
        <ReservationAnimation
          card={reservationAnim.card}
          username={reservationAnim.username}
          rect={reservationAnim.rect}
          onDone={() => setReservationAnim(null)}
        />
      )}
    </div>
  );
}
