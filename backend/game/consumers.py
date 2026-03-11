"""
WebSocket consumer for Splendor game.
"""
import json
import logging
from datetime import timedelta
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from django.utils import timezone

from .models import Game, GamePlayer, GameAction
from .game_logic import (
    COLORS, get_all_cards, get_all_nobles, get_card, get_noble,
    apply_take_tokens, apply_discard_tokens,
    apply_reserve_card, apply_buy_card,
    apply_noble_visit, check_nobles,
    check_end_condition, determine_winner,
)


def finalize_ranked_match(game, players):
    """
    Finalize a ranked match when the game ends.
    
    Args:
        game: The Game object that just finished
        players: List of GamePlayer objects with prestige_points data
    """
    # Check if this game has an associated ranked match
    ranked_match = game.ranked_match.first()
    if not ranked_match:
        return  # Not a ranked game
    
    # Build placements - sort players by prestige points (desc), then by fewest cards (asc)
    sorted_players = sorted(
        players,
        key=lambda gp: (-gp.prestige_points, len(gp.purchased_card_ids or []))
    )
    
    # Convert GamePlayer objects to competitive Player objects
    from competitive.models import Player
    placements = []
    for gp in sorted_players:
        try:
            player = Player.objects.get(user=gp.user)
            placements.append(player)
        except Player.DoesNotExist:
            logger.warning(f"Player not found for user {gp.user.id} in ranked match")
            continue
    
    if placements:
        ranked_match.finalize(placements)
        logger.info(
            f"[RANKED] Finalized match {ranked_match.id} - Winner: {placements[0].user.username}"
        )

# Configure game action logger
logger = logging.getLogger('game.actions')

# Pause timeout constants
PAUSE_TIMEOUT_MINUTES = 5
SURVEY_INTERVAL_MINUTES = 1


def serialize_game_state(game, players):
    players_data = []
    current_player_tokens = {}
    current_player_pending_action = None
    for gp in players:
        player_tokens = gp.tokens if isinstance(gp.tokens, dict) else {}
        if gp.order == game.current_player_index:
            current_player_tokens = player_tokens
            current_player_pending_action = gp.pending_action_data
        players_data.append({
            'id': gp.user.id,
            'username': gp.user.username,
            'order': gp.order,
            'tokens': gp.tokens,
            'purchased_card_ids': gp.purchased_card_ids,
            'reserved_card_ids': gp.reserved_card_ids,
            'noble_ids': gp.noble_ids,
            'prestige_points': gp.prestige_points,
            'is_online': gp.is_online,
        })

    # Deck counts (hidden)
    deck_counts = {lvl: len(ids) for lvl, ids in game.decks.items()}

    # Calculate pause remaining time
    pause_remaining_seconds = None
    if game.status == Game.STATUS_PAUSED and game.pause_expires_at:
        remaining = game.pause_expires_at - timezone.now()
        pause_remaining_seconds = max(0, int(remaining.total_seconds()))

    # Calculate turn timer info (30 seconds main + 10 seconds warning) - only if timer enabled
    turn_remaining_seconds = None
    turn_warning = False
    if game.timer_enabled and game.status == Game.STATUS_PLAYING and game.turn_started_at:
        elapsed = (timezone.now() - game.turn_started_at).total_seconds()
        total_time = 40  # 30 seconds main + 10 seconds warning = 40 total
        remaining_time = total_time - elapsed
        turn_remaining_seconds = max(0, int(remaining_time))
        turn_warning = elapsed >= 30  # Warning period after 30 seconds

    # Build cards_data and nobles_data from database
    cards_data = {str(c['id']): c for c in get_all_cards()}
    nobles_data = {str(n['id']): n for n in get_all_nobles()}

    # Check if current player needs to discard tokens (has >10)
    current_player_token_count = sum(current_player_tokens.values()) if current_player_tokens else 0
    pending_discard = current_player_token_count > 10
    pending_discard_count = max(0, current_player_token_count - 10) if pending_discard else 0

    # Check if current player has pending noble choice
    pending_noble_choice = []
    if current_player_pending_action and current_player_pending_action.get('type') == 'noble_choice':
        pending_noble_choice = current_player_pending_action.get('eligible_nobles', [])

    # Get the last action for animations
    last_action = None
    last_action_obj = game.actions.order_by('-turn_number').first()
    if last_action_obj:
        last_action = {
            'type': last_action_obj.action_type,
            'player_id': last_action_obj.player.user.id,
            'player_username': last_action_obj.player.user.username,
            'turn_number': last_action_obj.turn_number,
            'data': last_action_obj.action_data,
        }

    return {
        'game_id': str(game.id),
        'code': game.code,
        'status': game.status,
        'max_players': game.max_players,
        'current_player_index': game.current_player_index,
        'tokens_in_bank': game.tokens_in_bank,
        'visible_cards': game.visible_cards,
        'deck_counts': deck_counts,
        'available_nobles': game.available_nobles,
        'players': players_data,
        'winner_id': game.winner_id,
        'cards_data': cards_data,
        'nobles_data': nobles_data,
        # Pause/leave state
        'is_paused': game.status == Game.STATUS_PAUSED,
        'pause_remaining_seconds': pause_remaining_seconds,
        'left_player_id': game.left_player_id,
        'player_votes': game.player_votes,
        # Turn timer state
        'timer_enabled': game.timer_enabled,
        'turn_remaining_seconds': turn_remaining_seconds,
        'turn_warning': turn_warning,
        # Token discard state
        'pending_discard': pending_discard,
        'pending_discard_count': pending_discard_count,
        # Noble choice state
        'pending_noble_choice': pending_noble_choice,
        # History info
        'total_turns': game.current_turn_number,
        'has_history': game.current_turn_number > 0,
        # Last action for animations
        'last_action': last_action,
    }


class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.game_code = self.scope['url_route']['kwargs']['game_code']
        self.room_group_name = f'game_{self.game_code}'
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        
        # Handle rejoin - mark player as online
        await self.handle_rejoin()
        await self.send_game_state()

    async def disconnect(self, close_code):
        # Mark player as offline for waiting games (don't delete - they might come back)
        await self._mark_offline_waiting_game()
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def _mark_offline_waiting_game(self):
        """Mark player as offline in waiting game (but don't remove them)."""
        @database_sync_to_async
        def _db():
            try:
                game = Game.objects.get(code=self.game_code)
                if game.status != Game.STATUS_WAITING:
                    return None
                player = game.players.filter(user=self.user).first()
                if player:
                    player.is_online = False
                    player.save(update_fields=['is_online'])
                    return {'user_id': self.user.id, 'username': self.user.username}
                return None
            except Game.DoesNotExist:
                return None
        
        result = await _db()
        
        # Notify others in waiting room about temporary disconnect
        if result:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'player_temporarily_offline',
                    'user_id': result['user_id'],
                    'username': result['username'],
                }
            )

    async def _cleanup_waiting_game(self):
        """Remove player from waiting game - called on explicit leave action."""
        @database_sync_to_async
        def _db():
            from django.db import transaction
            from .models import GameInvitation
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    
                    # Only clean up waiting games
                    if game.status != Game.STATUS_WAITING:
                        return None
                    
                    player = game.players.filter(user=self.user).first()
                    if not player:
                        return None
                    
                    player.delete()
                    remaining_players = game.players.count()
                    
                    if remaining_players == 0:
                        # No players left - expire all pending invitations
                        pending_invitations = GameInvitation.objects.filter(
                            game=game,
                            status=GameInvitation.STATUS_PENDING
                        )
                        invitation_recipients = list(pending_invitations.values_list('to_user_id', 'id'))
                        pending_invitations.update(status=GameInvitation.STATUS_EXPIRED)
                        
                        # Delete the game
                        game.delete()
                        return {'waiting_room_closed': True, 'expired_invitations': invitation_recipients}
                    return {'left_waiting_room': True, 'user_id': self.user.id, 'username': self.user.username}
            except Game.DoesNotExist:
                return None
        
        result = await _db()
        
        if isinstance(result, dict):
            if result.get('waiting_room_closed'):
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'waiting_room_closed'}
                )
                # Notify invitees that their invitations have expired
                for user_id, invitation_id in result.get('expired_invitations', []):
                    await self.channel_layer.group_send(
                        f'notifications_{user_id}',
                        {
                            'type': 'invitation_expired',
                            'invitation_id': invitation_id,
                            'reason': 'Room was closed',
                        }
                    )
            elif result.get('left_waiting_room'):
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'player_left_waiting',
                        'user_id': result['user_id'],
                        'username': result['username'],
                    }
                )

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')
        payload = data.get('payload', {})

        handlers = {
            'take_tokens': self.handle_take_tokens,
            'discard_tokens': self.handle_discard_tokens,
            'reserve_card': self.handle_reserve_card,
            'buy_card': self.handle_buy_card,
            'choose_noble': self.handle_choose_noble,
            'leave_game': self.handle_leave_game,
            'vote_response': self.handle_vote_response,
            'refresh_state': self.handle_refresh_state,
            'cancel_pending_discard': self.handle_cancel_pending_discard,
            'chat_message': self.handle_chat_message,
            'check_turn_timeout': self.handle_check_turn_timeout,
        }

        handler = handlers.get(action)
        if handler:
            await handler(payload)
        else:
            await self.send_error(f"Unknown action: {action}")

    async def handle_rejoin(self):
        """Mark player as online when they reconnect."""
        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    player = game.players.filter(user=self.user).first()
                    if player:
                        was_offline = not player.is_online
                        player.is_online = True
                        player.left_at = None
                        player.save()
                        
                        # Handle waiting game rejoin
                        if game.status == Game.STATUS_WAITING:
                            return 'waiting_online' if was_offline else None
                        
                        # Check if pause has expired
                        if game.status == Game.STATUS_PAUSED and game.pause_expires_at:
                            if timezone.now() > game.pause_expires_at:
                                # Pause expired - end the game
                                game.status = Game.STATUS_FINISHED
                                players = list(game.players.select_related('user').all())
                                finalize_ranked_match(game, players)
                                game.save()
                                return 'timeout_ended'
                        
                        # If game was paused, check if all players are now online
                        if game.status == Game.STATUS_PAUSED:
                            offline_count = game.players.filter(is_online=False).count()
                            if offline_count == 0:
                                # All players are back - resume game
                                game.status = Game.STATUS_PLAYING
                                game.paused_at = None
                                game.pause_expires_at = None
                                game.left_player_id = None
                                game.player_votes = {}
                                game.last_survey_at = None
                                game.save()
                                return 'resumed'
                            # Some players still offline - just notify about rejoin
                            return 'player_rejoined' if was_offline else None
                        return 'online' if was_offline else None
                    return None
            except Game.DoesNotExist:
                return None

        result = await _db()
        if result == 'timeout_ended':
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'pause_timeout_ended'}
            )
            await self.send_game_state()
        elif result == 'resumed':
            # Notify all players the game has resumed
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'game_resumed', 'user_id': self.user.id, 'username': self.user.username}
            )
            await self.send_game_state()
        elif result == 'player_rejoined':
            # A player rejoined but others are still offline - notify and update state
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'player_rejoined', 'user_id': self.user.id, 'username': self.user.username}
            )
            await self.send_game_state()
        elif result == 'waiting_online':
            # Player came back online in waiting room - notify all
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'player_back_online', 'user_id': self.user.id, 'username': self.user.username}
            )
        elif result == 'online':
            await self.send_game_state()

    async def pause_timeout_ended(self, event):
        await self.send(text_data=json.dumps({
            'type': 'pause_timeout_ended',
        }))

    async def game_resumed(self, event):
        # Send the resume notification
        await self.send(text_data=json.dumps({
            'type': 'game_resumed',
            'user_id': event['user_id'],
            'username': event['username'],
        }))
        # Each consumer sends the updated game state to their client
        game, players = await self.get_game_and_players()
        if game:
            @database_sync_to_async
            def _serialize():
                return serialize_game_state(game, players)
            
            state = await _serialize()
            await self.send(text_data=json.dumps({
                'type': 'game_state',
                'state': state,
            }))

    async def player_rejoined(self, event):
        # Send notification that a player rejoined (but game still paused)
        await self.send(text_data=json.dumps({
            'type': 'player_rejoined',
            'user_id': event['user_id'],
            'username': event['username'],
        }))
        # Update game state for all clients
        game, players = await self.get_game_and_players()
        if game:
            @database_sync_to_async
            def _serialize():
                return serialize_game_state(game, players)
            
            state = await _serialize()
            await self.send(text_data=json.dumps({
                'type': 'game_state',
                'state': state,
            }))

    async def handle_leave_game(self, payload):
        """Handle player leaving the game - pause for others or close waiting room."""
        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    player = game.players.filter(user=self.user).first()
                    
                    if not player:
                        return "You are not in this game."
                    
                    # Handle leaving a waiting game
                    if game.status == Game.STATUS_WAITING:
                        player.delete()
                        remaining_players = game.players.count()
                        if remaining_players == 0:
                            # No players left - delete the game
                            game.delete()
                            return {'waiting_room_closed': True}
                        return {'left_waiting_room': True, 'user_id': self.user.id, 'username': self.user.username}
                    
                    if game.status not in [Game.STATUS_PLAYING, Game.STATUS_PAUSED]:
                        return "Game is not in progress."
                    
                    # Mark player as offline
                    player.is_online = False
                    player.left_at = timezone.now()
                    player.save()
                    
                    # Remove this player's vote if they had one
                    votes = dict(game.player_votes)
                    if str(self.user.id) in votes:
                        del votes[str(self.user.id)]
                        game.player_votes = votes
                    
                    # Check if all players have left
                    online_players = game.players.filter(is_online=True).count()
                    
                    # If game is already paused, just update state and notify
                    if game.status == Game.STATUS_PAUSED:
                        game.save()
                        # If all players offline, just keep the pause timer running
                        if online_players == 0:
                            return {'all_left': True, 'user_id': self.user.id, 'username': self.user.username}
                        return {'additional_leave': True, 'user_id': self.user.id, 'username': self.user.username}
                    
                    # Pause the game (first player leaving)
                    game.status = Game.STATUS_PAUSED
                    game.paused_at = timezone.now()
                    game.pause_expires_at = timezone.now() + timedelta(minutes=PAUSE_TIMEOUT_MINUTES)
                    game.left_player_id = self.user.id
                    game.player_votes = {}
                    game.last_survey_at = timezone.now()
                    game.save()
                    
                    # If all players left at the same time, just pause with timeout
                    if online_players == 0:
                        return {'all_left': True, 'user_id': self.user.id, 'username': self.user.username}
                    
                    return {'paused': True, 'user_id': self.user.id, 'username': self.user.username}
            except Game.DoesNotExist:
                return "Game not found."

        result = await _db()
        
        if isinstance(result, str):
            await self.send_error(result)
        elif isinstance(result, dict):
            if result.get('waiting_room_closed'):
                # Game was deleted, notify anyone still connected
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'waiting_room_closed'}
                )
            elif result.get('left_waiting_room'):
                # Player left waiting room, notify others and update state
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'player_left_waiting',
                        'user_id': result['user_id'],
                        'username': result['username'],
                    }
                )
            elif result.get('all_left'):
                # All players left - game is paused with timeout, just send state update
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'all_players_left'}
                )
            elif result.get('paused') or result.get('additional_leave'):
                # Notify all players about pause and show survey
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'player_left_survey',
                        'left_user_id': result['user_id'],
                        'left_username': result['username'],
                    }
                )
                await self.send_game_state()

    async def waiting_room_closed(self, event):
        """Notify that the waiting room was closed (all players left)."""
        await self.send(text_data=json.dumps({
            'type': 'waiting_room_closed',
        }))

    async def player_left_waiting(self, event):
        """Notify that a player left the waiting room."""
        await self.send(text_data=json.dumps({
            'type': 'player_left_waiting',
            'user_id': event['user_id'],
            'username': event['username'],
        }))
        # Send updated game state to remaining players
        game, players = await self.get_game_and_players()
        if game:
            @database_sync_to_async
            def _serialize():
                return serialize_game_state(game, players)
            
            state = await _serialize()
            await self.send(text_data=json.dumps({
                'type': 'game_state',
                'state': state,
            }))

    async def player_temporarily_offline(self, event):
        """Notify that a player went temporarily offline in waiting room."""
        await self.send(text_data=json.dumps({
            'type': 'player_temporarily_offline',
            'user_id': event['user_id'],
            'username': event['username'],
        }))
        # Send updated game state with player's offline status
        game, players = await self.get_game_and_players()
        if game:
            @database_sync_to_async
            def _serialize():
                return serialize_game_state(game, players)
            
            state = await _serialize()
            await self.send(text_data=json.dumps({
                'type': 'game_state',
                'state': state,
            }))

    async def player_back_online(self, event):
        """Notify that a player came back online in waiting room."""
        await self.send(text_data=json.dumps({
            'type': 'player_back_online',
            'user_id': event['user_id'],
            'username': event['username'],
        }))
        # Send updated game state with player's online status
        game, players = await self.get_game_and_players()
        if game:
            @database_sync_to_async
            def _serialize():
                return serialize_game_state(game, players)
            
            state = await _serialize()
            await self.send(text_data=json.dumps({
                'type': 'game_state',
                'state': state,
            }))

    async def player_left_survey(self, event):
        # Send the survey notification
        await self.send(text_data=json.dumps({
            'type': 'player_left_survey',
            'left_user_id': event['left_user_id'],
            'left_username': event['left_username'],
        }))
        # Each consumer sends the updated game state to their client
        game, players = await self.get_game_and_players()
        if game:
            @database_sync_to_async
            def _serialize():
                return serialize_game_state(game, players)
            
            state = await _serialize()
            await self.send(text_data=json.dumps({
                'type': 'game_state',
                'state': state,
            }))

    async def game_ended_all_left(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_ended_all_left',
        }))

    async def all_players_left(self, event):
        """Notify that all players have left - game will auto-close after timeout."""
        await self.send(text_data=json.dumps({
            'type': 'all_players_left',
        }))

    async def handle_vote_response(self, payload):
        """Handle vote for end game or wait."""
        vote = payload.get('vote')  # 'wait' or 'end'
        
        if vote not in ['wait', 'end']:
            await self.send_error("Invalid vote. Must be 'wait' or 'end'.")
            return

        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    
                    if game.status != Game.STATUS_PAUSED:
                        return "Game is not paused."
                    
                    player = game.players.filter(user=self.user).first()
                    if not player or not player.is_online:
                        return "You are not an active player."
                    
                    # Record vote
                    votes = dict(game.player_votes)
                    votes[str(self.user.id)] = vote
                    game.player_votes = votes
                    game.save()
                    
                    # Check if all online players have voted
                    online_players = game.players.filter(is_online=True)
                    online_ids = set(str(p.user.id) for p in online_players)
                    voted_ids = set(votes.keys())
                    
                    if online_ids == voted_ids:
                        # All online players have voted
                        end_votes = sum(1 for v in votes.values() if v == 'end')
                        
                        if end_votes > 0:
                            # At least one player wants to end - end the game
                            game.status = Game.STATUS_FINISHED
                            players = list(game.players.select_related('user').all())
                            finalize_ranked_match(game, players)
                            game.save()
                            return 'game_ended_by_vote'
                        else:
                            # All voted to wait - reset votes for next survey
                            game.player_votes = {}
                            game.last_survey_at = timezone.now()
                            game.save()
                            return 'all_wait'
                    
                    return 'vote_recorded'
            except Game.DoesNotExist:
                return "Game not found."

        result = await _db()
        
        if result == 'game_ended_by_vote':
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'game_ended_by_vote'}
            )
            await self.send_game_state()
        elif result == 'all_wait':
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'all_voted_wait'}
            )
            await self.send_game_state()
        elif result == 'vote_recorded':
            await self.send_game_state()
        else:
            await self.send_error(result)

    async def game_ended_by_vote(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_ended_by_vote',
        }))

    async def all_voted_wait(self, event):
        await self.send(text_data=json.dumps({
            'type': 'all_voted_wait',
        }))

    async def handle_refresh_state(self, payload):
        """Handle refresh state request - just sends current game state."""
        await self.send_game_state()

    async def handle_check_turn_timeout(self, payload):
        """Check if current player's turn has timed out and skip if so."""
        # Just trigger a game state send which will check and handle timeout
        await self.send_game_state()

    async def turn_skipped(self, event):
        """Notify that a player's turn was skipped due to timeout."""
        await self.send(text_data=json.dumps({
            'type': 'turn_skipped',
            'user_id': event['user_id'],
            'username': event['username'],
        }))

    async def handle_chat_message(self, payload):
        """Handle chat message from a player."""
        message = payload.get('message', '').strip()
        if not message:
            return
        
        # Limit message length
        message = message[:200]
        
        # Broadcast to all players in the game
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'user_id': self.user.id,
                'username': self.user.username,
                'message': message,
                'timestamp': timezone.now().isoformat(),
            }
        )

    async def chat_message(self, event):
        """Receive chat message from channel layer and send to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'user_id': event['user_id'],
            'username': event['username'],
            'message': event['message'],
            'timestamp': event['timestamp'],
        }))

    async def send_game_state(self):
        # First check pause status
        await self.check_pause_status()
        
        # Check if current turn has timed out and skip if needed
        await self._check_and_skip_timeout()
        
        game, players = await self.get_game_and_players()
        if game is None:
            await self.send_error("Game not found.")
            return
        
        @database_sync_to_async
        def _serialize():
            return serialize_game_state(game, players)
        
        state = await _serialize()
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'game_state_update', 'state': state}
        )
    
    async def _check_and_skip_timeout(self):
        """Check if current player's turn has timed out and skip if so. Silent helper."""
        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    players = list(game.players.select_related('user').order_by('order'))
                    
                    if game.status != Game.STATUS_PLAYING:
                        return None, None
                    
                    # Only skip turns if timer is enabled for this game
                    if not game.timer_enabled:
                        return None, None
                    
                    if not game.turn_started_at:
                        return None, None
                    
                    # Check if 40 seconds have passed
                    elapsed = (timezone.now() - game.turn_started_at).total_seconds()
                    if elapsed < 40:
                        return None, None
                    
                    current_gp = players[game.current_player_index]
                    skipped_username = current_gp.user.username
                    skipped_user_id = current_gp.user.id
                    
                    if current_gp.pending_action_data:
                        current_gp.pending_action_data = None
                        current_gp.save()
                    
                    game.current_player_index = (game.current_player_index + 1) % len(players)
                    game.turn_started_at = timezone.now()
                    game.save()
                    
                    return skipped_username, skipped_user_id
            except Game.DoesNotExist:
                return None, None
        
        skipped_username, skipped_user_id = await _db()
        
        if skipped_username:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'turn_skipped',
                    'user_id': skipped_user_id,
                    'username': skipped_username,
                }
            )

    async def check_pause_status(self):
        """Check if pause has timed out or if it's time for a new survey."""
        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    
                    if game.status != Game.STATUS_PAUSED:
                        return None
                    
                    now = timezone.now()
                    
                    # Check if pause has expired
                    if game.pause_expires_at and now > game.pause_expires_at:
                        game.status = Game.STATUS_FINISHED
                        players = list(game.players.select_related('user').all())
                        finalize_ranked_match(game, players)
                        game.save()
                        return 'timeout_ended'
                    
                    # Check if it's time for a new survey (1 minute since last survey)
                    # Only if all online players have voted to wait
                    if game.last_survey_at:
                        time_since_survey = now - game.last_survey_at
                        if time_since_survey.total_seconds() >= 60:  # 1 minute
                            online_players = list(game.players.filter(is_online=True))
                            online_ids = set(str(p.user.id) for p in online_players)
                            voted_ids = set(game.player_votes.keys())
                            
                            # All online players have voted and all voted wait
                            if online_ids == voted_ids:
                                all_wait = all(v == 'wait' for v in game.player_votes.values())
                                if all_wait:
                                    # Reset votes for new survey
                                    game.player_votes = {}
                                    game.last_survey_at = now
                                    game.save()
                                    return 'new_survey'
                    
                    return None
            except Game.DoesNotExist:
                return None
        
        result = await _db()
        if result == 'timeout_ended':
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'pause_timeout_ended'}
            )
        elif result == 'new_survey':
            # Trigger new survey for all players
            game, players = await self.get_game_and_players()
            if game and game.left_player_id:
                left_player = next((p for p in players if p.user.id == game.left_player_id), None)
                if left_player:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'player_left_survey',
                            'left_user_id': left_player.user.id,
                            'left_username': left_player.user.username,
                        }
                    )

    async def game_state_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_state',
            'state': event['state'],
        }))

    async def send_error(self, message):
        await self.send(text_data=json.dumps({'type': 'error', 'message': message}))

    @database_sync_to_async
    def get_game_and_players(self):
        try:
            game = Game.objects.get(code=self.game_code)
            players = list(game.players.select_related('user').order_by('order'))
            return game, players
        except Game.DoesNotExist:
            return None, None

    def _get_current_player(self, game, players):
        if game.current_player_index < len(players):
            return players[game.current_player_index]
        return None

    def _player_data_from_gp(self, gp):
        return {
            'tokens': dict(gp.tokens),
            'purchased_card_ids': list(gp.purchased_card_ids),
            'reserved_card_ids': list(gp.reserved_card_ids),
            'noble_ids': list(gp.noble_ids),
            'prestige_points': gp.prestige_points,
        }

    def _game_data_from_game(self, game):
        return {
            'tokens_in_bank': dict(game.tokens_in_bank),
            'visible_cards': {k: list(v) for k, v in game.visible_cards.items()},
            'decks': {k: list(v) for k, v in game.decks.items()},
            'available_nobles': list(game.available_nobles),
        }

    @database_sync_to_async
    def _handle_action_db(self, action_fn, **kwargs):
        """Generic DB handler. action_fn returns (game_data, player_data, extra, error)."""
        from django.db import transaction
        try:
            game = Game.objects.select_for_update().get(code=self.game_code)
            players = list(game.players.select_related('user').order_by('order'))

            if game.status != Game.STATUS_PLAYING:
                return "Game is not in progress."

            current_gp = self._get_current_player(game, players)
            if current_gp is None or current_gp.user != self.user:
                return "Not your turn."

            game_data = self._game_data_from_game(game)
            player_data = self._player_data_from_gp(current_gp)

            result = action_fn(game_data, player_data, **kwargs)
            if isinstance(result, str):
                return result  # error

            game_data, player_data, error = result
            if error:
                return error

            # Apply to DB
            game.tokens_in_bank = game_data['tokens_in_bank']
            game.visible_cards = game_data['visible_cards']
            game.decks = game_data['decks']
            game.available_nobles = game_data['available_nobles']

            current_gp.tokens = player_data['tokens']
            current_gp.purchased_card_ids = player_data['purchased_card_ids']
            current_gp.reserved_card_ids = player_data['reserved_card_ids']
            current_gp.noble_ids = player_data['noble_ids']
            current_gp.prestige_points = player_data['prestige_points']

            # Check noble visits (auto-assign if only one eligible, else return choices)
            eligible_nobles = check_nobles(game_data, player_data)
            if len(eligible_nobles) >= 1:
                # Auto-pick first noble (TODO: add choose_noble flow for multiple)
                gd2, pd2 = apply_noble_visit(game_data, player_data, eligible_nobles[0])
                game.tokens_in_bank = gd2['tokens_in_bank']
                game.visible_cards = gd2['visible_cards']
                game.decks = gd2['decks']
                game.available_nobles = gd2['available_nobles']
                current_gp.noble_ids = pd2['noble_ids']
                current_gp.prestige_points = pd2['prestige_points']
                player_data = pd2
                game_data = gd2

            # Check end condition
            all_player_data = []
            for gp in players:
                if gp.user == self.user:
                    all_player_data.append({
                        'prestige_points': player_data['prestige_points'],
                        'purchased_card_ids': player_data['purchased_card_ids'],
                        'order': gp.order,
                    })
                else:
                    all_player_data.append({
                        'prestige_points': gp.prestige_points,
                        'purchased_card_ids': gp.purchased_card_ids,
                        'order': gp.order,
                    })

            trigger = check_end_condition(all_player_data)
            if trigger and game.last_round_triggered_by is None:
                game.last_round_triggered_by = trigger['order']

            # Advance turn
            if game.last_round_triggered_by is not None:
                # Check if round is complete
                # In Splendor, rounds go 0 → 1 → 2 → ... → n-1 → 0
                # Round ends when the last player (order = n-1) has played
                if current_gp.order == len(players) - 1:
                    # Last player in round has gone - game ends
                    winner_data = determine_winner(all_player_data, game.last_round_triggered_by)
                    winner_gp = next(gp for gp in players if gp.order == winner_data['order'])
                    game.status = Game.STATUS_FINISHED
                    game.winner = winner_gp.user
                    finalize_ranked_match(game, players)

            game.current_player_index = (game.current_player_index + 1) % len(players)
            game.save()
            current_gp.save()
            return None  # no error
        except Game.DoesNotExist:
            return "Game not found."

    async def handle_take_tokens(self, payload):
        colors = payload.get('colors', [])

        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    players = list(game.players.select_related('user').order_by('order'))
                    if game.status != Game.STATUS_PLAYING:
                        return "Game is not in progress.", False
                    current_gp = self._get_current_player(game, players)
                    if current_gp is None or current_gp.user != self.user:
                        return "Not your turn.", False
                    game_data = self._game_data_from_game(game)
                    player_data = self._player_data_from_gp(current_gp)

                    # Log before action
                    logger.info(
                        "[TAKE_TOKENS] Game=%s User=%s | BEFORE | Colors=%s | Bank=%s | PlayerTokens=%s (total=%d)",
                        self.game_code, self.user.username, colors,
                        game_data['tokens_in_bank'], player_data['tokens'],
                        sum(player_data['tokens'].values())
                    )

                    new_gd, new_pd, error, needs_discard = apply_take_tokens(game_data, player_data, colors)
                    if error:
                        logger.warning("[TAKE_TOKENS] Game=%s User=%s | ERROR: %s", self.game_code, self.user.username, error)
                        return error, False

                    # Log after action
                    logger.info(
                        "[TAKE_TOKENS] Game=%s User=%s | AFTER | Bank=%s | PlayerTokens=%s (total=%d) | NeedsDiscard=%s",
                        self.game_code, self.user.username,
                        new_gd['tokens_in_bank'], new_pd['tokens'],
                        sum(new_pd['tokens'].values()), needs_discard
                    )

                    self._save_state(game, current_gp, new_gd, new_pd)
                    
                    action_info = {
                        'colors': colors,
                        'bank_before': game_data['tokens_in_bank'].copy(),
                        'bank_after': new_gd['tokens_in_bank'].copy(),
                        'player_tokens_before': player_data['tokens'].copy(),
                        'player_tokens_after': new_pd['tokens'].copy(),
                    }
                    
                    # Only advance turn if player doesn't need to discard
                    if not needs_discard:
                        current_gp.pending_action_data = None
                        self._post_action(game, current_gp, players, new_gd, new_pd,
                                          action_type='take_tokens', action_data=action_info)
                    else:
                        # Save pending action data for cancel support and later recording
                        # Include full token data for history tracking
                        current_gp.pending_action_data = {
                            'type': 'take_tokens',
                            'colors': colors,
                            'bank_before': game_data['tokens_in_bank'].copy(),
                            'bank_after': new_gd['tokens_in_bank'].copy(),
                            'player_tokens_before': player_data['tokens'].copy(),
                            'player_tokens_after': new_pd['tokens'].copy(),
                        }
                        game.save()
                        current_gp.save()
                    
                    return None, needs_discard
            except Game.DoesNotExist:
                return "Game not found.", False

        error, needs_discard = await _db()
        if error:
            await self.send_error(error)
        else:
            await self.send_game_state()

    async def handle_discard_tokens(self, payload):
        tokens_to_discard = payload.get('tokens', {})

        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    players = list(game.players.select_related('user').order_by('order'))
                    current_gp = self._get_current_player(game, players)
                    if current_gp is None or current_gp.user != self.user:
                        return "Not your turn.", True
                    game_data = self._game_data_from_game(game)
                    player_data = self._player_data_from_gp(current_gp)

                    new_gd, new_pd, error, still_needs_discard = apply_discard_tokens(game_data, player_data, tokens_to_discard)
                    if error:
                        return error, True

                    self._save_state(game, current_gp, new_gd, new_pd)
                    
                    # Advance turn only when player is at or below 10 tokens
                    if not still_needs_discard:
                        # Retrieve the original action from pending_action_data
                        pending = current_gp.pending_action_data
                        action_type = pending.get('type') if pending else None
                        action_info = None
                        if action_type == 'take_tokens':
                            action_info = {
                                'colors': pending.get('colors', []),
                                'bank_before': pending.get('bank_before'),
                                'bank_after': pending.get('bank_after'),
                                'player_tokens_before': pending.get('player_tokens_before'),
                                'player_tokens_after': pending.get('player_tokens_after'),
                            }
                        elif action_type == 'reserve_card':
                            action_info = {
                                'card_id': pending.get('card_id'),
                                'from_deck': pending.get('from_deck', False),
                                'level': pending.get('level'),
                                'gold_received': pending.get('gold_received'),
                                'bank_gold_before': pending.get('bank_gold_before'),
                                'bank_gold_after': pending.get('bank_gold_after'),
                            }
                        
                        current_gp.pending_action_data = None
                        self._post_action(game, current_gp, players, new_gd, new_pd,
                                          action_type=action_type, action_data=action_info)
                    else:
                        game.save()
                        current_gp.save()
                    
                    return None, still_needs_discard
            except Game.DoesNotExist:
                return "Game not found.", True

        error, still_needs_discard = await _db()
        if error:
            await self.send_error(error)
        else:
            await self.send_game_state()

    async def handle_cancel_pending_discard(self, payload):
        """Cancel the pending action that triggered the discard requirement."""
        from .game_logic import apply_cancel_pending_discard

        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    players = list(game.players.select_related('user').order_by('order'))
                    if game.status != Game.STATUS_PLAYING:
                        return "Game is not in progress."
                    current_gp = self._get_current_player(game, players)
                    if current_gp is None or current_gp.user != self.user:
                        return "Not your turn."
                    
                    pending_data = current_gp.pending_action_data
                    if not pending_data:
                        return "No pending action to cancel."
                    
                    game_data = self._game_data_from_game(game)
                    player_data = self._player_data_from_gp(current_gp)

                    logger.info(
                        "[CANCEL_PENDING] Game=%s User=%s | PendingAction=%s",
                        self.game_code, self.user.username, pending_data
                    )

                    new_gd, new_pd, error = apply_cancel_pending_discard(
                        game_data, player_data, pending_data
                    )
                    if error:
                        logger.warning("[CANCEL_PENDING] Game=%s User=%s | ERROR: %s", self.game_code, self.user.username, error)
                        return error

                    # Update game state
                    game.tokens_in_bank = new_gd['tokens_in_bank']
                    game.visible_cards = new_gd['visible_cards']
                    game.decks = new_gd['decks']  # Restore deck if replacement card was put back
                    
                    # Update player state
                    current_gp.tokens = new_pd['tokens']
                    current_gp.reserved_card_ids = new_pd['reserved_card_ids']
                    current_gp.pending_action_data = None
                    
                    # Don't advance turn - player's turn was never "completed"
                    game.save()
                    current_gp.save()
                    
                    logger.info(
                        "[CANCEL_PENDING] Game=%s User=%s | SUCCESS | PlayerTokens=%s (total=%d) | Reserved=%s",
                        self.game_code, self.user.username,
                        new_pd['tokens'], sum(new_pd['tokens'].values()),
                        new_pd['reserved_card_ids']
                    )
                    
                    return None
            except Game.DoesNotExist:
                return "Game not found."

        error = await _db()
        if error:
            await self.send_error(error)
        else:
            await self.send_game_state()

    async def handle_reserve_card(self, payload):
        card_id = payload.get('card_id')
        level = payload.get('level')

        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    players = list(game.players.select_related('user').order_by('order'))
                    if game.status != Game.STATUS_PLAYING:
                        return "Game is not in progress.", False
                    current_gp = self._get_current_player(game, players)
                    if current_gp is None or current_gp.user != self.user:
                        return "Not your turn.", False
                    game_data = self._game_data_from_game(game)
                    player_data = self._player_data_from_gp(current_gp)

                    # Log before action
                    logger.info(
                        "[RESERVE_CARD] Game=%s User=%s | BEFORE | CardID=%s Level=%s | BankGold=%d | PlayerGold=%d | PlayerTokens=%s (total=%d) | Reserved=%s",
                        self.game_code, self.user.username, card_id, level,
                        game_data['tokens_in_bank'].get('gold', 0),
                        player_data['tokens'].get('gold', 0),
                        player_data['tokens'], sum(player_data['tokens'].values()),
                        player_data['reserved_card_ids']
                    )

                    new_gd, new_pd, reserved_id, error, needs_discard = apply_reserve_card(
                        game_data, player_data, card_id=card_id, level=level
                    )
                    if error:
                        logger.warning("[RESERVE_CARD] Game=%s User=%s | ERROR: %s", self.game_code, self.user.username, error)
                        return error, False

                    # Log after action
                    logger.info(
                        "[RESERVE_CARD] Game=%s User=%s | AFTER | ReservedCardID=%s | BankGold=%d | PlayerGold=%d | PlayerTokens=%s (total=%d) | Reserved=%s | NeedsDiscard=%s",
                        self.game_code, self.user.username, reserved_id,
                        new_gd['tokens_in_bank'].get('gold', 0),
                        new_pd['tokens'].get('gold', 0),
                        new_pd['tokens'], sum(new_pd['tokens'].values()),
                        new_pd['reserved_card_ids'], needs_discard
                    )

                    self._save_state(game, current_gp, new_gd, new_pd)
                    
                    # Determine if it came from deck or visible
                    from_deck = card_id is None
                    
                    # Detect the new card that was drawn to replace the reserved card (only for visible cards)
                    new_card_id = None
                    if not from_deck:
                        for lvl in ['1', '2', '3']:
                            old_cards = game_data['visible_cards'].get(lvl, [])
                            new_cards = new_gd['visible_cards'].get(lvl, [])
                            for cid in new_cards:
                                if cid not in old_cards:
                                    new_card_id = cid
                                    break
                            if new_card_id:
                                break
                    
                    # Determine if gold was received
                    gold_before = player_data['tokens'].get('gold', 0)
                    gold_after = new_pd['tokens'].get('gold', 0)
                    gold_received = gold_after > gold_before
                    
                    action_info = {
                        'card_id': reserved_id,
                        'from_deck': from_deck,
                        'level': level if from_deck else None,
                        'gold_received': gold_received,
                        'new_card_id': new_card_id,  # The new card drawn to replace the reserved card
                        'bank_gold_before': game_data['tokens_in_bank'].get('gold', 0),
                        'bank_gold_after': new_gd['tokens_in_bank'].get('gold', 0),
                    }
                    
                    # Only advance turn if player doesn't need to discard
                    if not needs_discard:
                        current_gp.pending_action_data = None
                        self._post_action(game, current_gp, players, new_gd, new_pd,
                                          action_type='reserve_card', action_data=action_info)
                    else:
                        # Determine the card's level
                        reserved_card = get_card(reserved_id)
                        card_level = reserved_card['level'] if reserved_card else None
                        
                        # Save pending action data for cancel support
                        current_gp.pending_action_data = {
                            'type': 'reserve_card',
                            'card_id': reserved_id,
                            'gold_received': gold_received,
                            'level': card_level,
                            'from_deck': from_deck,
                            'new_card_id': new_card_id,  # The new card drawn to replace the reserved card
                            'bank_gold_before': game_data['tokens_in_bank'].get('gold', 0),
                            'bank_gold_after': new_gd['tokens_in_bank'].get('gold', 0),
                        }
                        game.save()
                        current_gp.save()
                    
                    return None, needs_discard
            except Game.DoesNotExist:
                return "Game not found.", False

        error, needs_discard = await _db()
        if error:
            await self.send_error(error)
        else:
            await self.send_game_state()

    async def handle_buy_card(self, payload):
        card_id = payload.get('card_id')

        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    players = list(game.players.select_related('user').order_by('order'))
                    if game.status != Game.STATUS_PLAYING:
                        return "Game is not in progress."
                    current_gp = self._get_current_player(game, players)
                    if current_gp is None or current_gp.user != self.user:
                        return "Not your turn."
                    game_data = self._game_data_from_game(game)
                    player_data = self._player_data_from_gp(current_gp)

                    # Get card info for logging
                    card = get_card(card_id)
                    card_points = card['points'] if card else 0
                    card_bonus = card['bonus'] if card else 'unknown'

                    # Log before action
                    logger.info(
                        "[BUY_CARD] Game=%s User=%s | BEFORE | CardID=%s (points=%d, bonus=%s) | PrestigePoints=%d | Bank=%s | PlayerTokens=%s (total=%d) | PurchasedCount=%d",
                        self.game_code, self.user.username, card_id, card_points, card_bonus,
                        player_data['prestige_points'],
                        game_data['tokens_in_bank'], player_data['tokens'],
                        sum(player_data['tokens'].values()),
                        len(player_data['purchased_card_ids'])
                    )

                    new_gd, new_pd, error = apply_buy_card(game_data, player_data, card_id)
                    if error:
                        logger.warning("[BUY_CARD] Game=%s User=%s | ERROR: %s", self.game_code, self.user.username, error)
                        return error

                    # Detect the new card that was drawn to replace the bought card
                    new_card_id = None
                    if card_id not in player_data['reserved_card_ids']:
                        # Card was from visible, find the new card that appeared
                        for lvl in ['1', '2', '3']:
                            old_cards = game_data['visible_cards'].get(lvl, [])
                            new_cards = new_gd['visible_cards'].get(lvl, [])
                            for cid in new_cards:
                                if cid not in old_cards:
                                    new_card_id = cid
                                    break
                            if new_card_id:
                                break

                    # Log after buy (before noble check)
                    logger.info(
                        "[BUY_CARD] Game=%s User=%s | AFTER_BUY | PrestigePoints=%d | Bank=%s | PlayerTokens=%s (total=%d) | PurchasedCount=%d",
                        self.game_code, self.user.username,
                        new_pd['prestige_points'],
                        new_gd['tokens_in_bank'], new_pd['tokens'],
                        sum(new_pd['tokens'].values()),
                        len(new_pd['purchased_card_ids'])
                    )

                    # Determine if card was from reserved
                    from_reserved = card_id in player_data['reserved_card_ids']
                    
                    # Calculate tokens spent
                    tokens_spent = {}
                    for color in ['white', 'blue', 'green', 'red', 'black', 'gold']:
                        diff = player_data['tokens'].get(color, 0) - new_pd['tokens'].get(color, 0)
                        if diff > 0:
                            tokens_spent[color] = diff

                    # Check noble visits
                    noble_visited_id = None
                    eligible = check_nobles(new_gd, new_pd)
                    
                    if len(eligible) == 1:
                        # Auto-award single eligible noble
                        noble_visited_id = eligible[0]
                        noble = get_noble(eligible[0])
                        logger.info(
                            "[BUY_CARD] Game=%s User=%s | NOBLE_VISIT | NobleID=%s (points=%d) | PrestigeBefore=%d",
                            self.game_code, self.user.username, eligible[0],
                            noble['points'] if noble else 0, new_pd['prestige_points']
                        )
                        new_gd, new_pd = apply_noble_visit(new_gd, new_pd, eligible[0])
                        logger.info(
                            "[BUY_CARD] Game=%s User=%s | AFTER_NOBLE | PrestigePoints=%d",
                            self.game_code, self.user.username, new_pd['prestige_points']
                        )
                    elif len(eligible) >= 2:
                        # Multiple nobles eligible - player must choose
                        logger.info(
                            "[BUY_CARD] Game=%s User=%s | MULTIPLE_NOBLES | Eligible=%s | Must choose",
                            self.game_code, self.user.username, eligible
                        )
                        # Save pending action for noble choice
                        current_gp.pending_action_data = {
                            'type': 'noble_choice',
                            'eligible_nobles': eligible,
                            'buy_card_action': {
                                'card_id': card_id,
                                'from_reserved': from_reserved,
                                'tokens_spent': tokens_spent,
                                'new_card_id': new_card_id,
                                'player_tokens_before': player_data['tokens'].copy(),
                                'player_tokens_after': new_pd['tokens'].copy(),
                                'bank_before': game_data['tokens_in_bank'].copy(),
                                'bank_after': new_gd['tokens_in_bank'].copy(),
                            }
                        }
                        self._save_state(game, current_gp, new_gd, new_pd)
                        game.save()
                        current_gp.save()
                        return None  # Don't advance turn - wait for noble choice
                    
                    action_info = {
                        'card_id': card_id,
                        'from_reserved': from_reserved,
                        'tokens_spent': tokens_spent,
                        'noble_id': noble_visited_id,  # None if no noble was claimed
                        'new_card_id': new_card_id,  # The new card drawn to replace the bought card
                        'player_tokens_before': player_data['tokens'].copy(),
                        'player_tokens_after': new_pd['tokens'].copy(),
                        'bank_before': game_data['tokens_in_bank'].copy(),
                        'bank_after': new_gd['tokens_in_bank'].copy(),
                    }

                    self._save_state(game, current_gp, new_gd, new_pd)
                    self._post_action(game, current_gp, players, new_gd, new_pd,
                                      action_type='buy_card', action_data=action_info)
                    return None
            except Game.DoesNotExist:
                return "Game not found."

        error = await _db()
        if error:
            await self.send_error(error)
        else:
            await self.send_game_state()

    async def handle_choose_noble(self, payload):
        noble_id = payload.get('noble_id')

        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    players = list(game.players.select_related('user').order_by('order'))
                    current_gp = self._get_current_player(game, players)
                    if current_gp is None or current_gp.user != self.user:
                        return "Not your turn."
                    
                    # Check if there's a pending noble choice
                    pending = current_gp.pending_action_data
                    if not pending or pending.get('type') != 'noble_choice':
                        return "No pending noble choice."
                    
                    eligible = pending.get('eligible_nobles', [])
                    if noble_id not in eligible:
                        return "Not eligible for that noble."
                    
                    game_data = self._game_data_from_game(game)
                    player_data = self._player_data_from_gp(current_gp)

                    # Apply the noble visit
                    noble = get_noble(noble_id)
                    logger.info(
                        "[CHOOSE_NOBLE] Game=%s User=%s | NobleID=%s (points=%d) | PrestigeBefore=%d",
                        self.game_code, self.user.username, noble_id,
                        noble['points'] if noble else 0, player_data['prestige_points']
                    )
                    new_gd, new_pd = apply_noble_visit(game_data, player_data, noble_id)
                    logger.info(
                        "[CHOOSE_NOBLE] Game=%s User=%s | AFTER_NOBLE | PrestigePoints=%d",
                        self.game_code, self.user.username, new_pd['prestige_points']
                    )
                    
                    # Build action info from the original buy_card action + chosen noble
                    buy_card_action = pending.get('buy_card_action', {})
                    action_info = {
                        'card_id': buy_card_action.get('card_id'),
                        'from_reserved': buy_card_action.get('from_reserved', False),
                        'tokens_spent': buy_card_action.get('tokens_spent', {}),
                        'noble_id': noble_id,  # The chosen noble
                        'new_card_id': buy_card_action.get('new_card_id'),
                        'player_tokens_before': buy_card_action.get('player_tokens_before', {}),
                        'player_tokens_after': buy_card_action.get('player_tokens_after', {}),
                        'bank_before': buy_card_action.get('bank_before', {}),
                        'bank_after': buy_card_action.get('bank_after', {}),
                    }
                    
                    # Clear pending action
                    current_gp.pending_action_data = None
                    
                    self._save_state(game, current_gp, new_gd, new_pd)
                    self._post_action(game, current_gp, players, new_gd, new_pd,
                                      action_type='buy_card', action_data=action_info)
                    return None
            except Game.DoesNotExist:
                return "Game not found."

        error = await _db()
        if error:
            await self.send_error(error)
        else:
            await self.send_game_state()

    def _save_state(self, game, current_gp, game_data, player_data):
        game.tokens_in_bank = game_data['tokens_in_bank']
        game.visible_cards = game_data['visible_cards']
        game.decks = game_data['decks']
        game.available_nobles = game_data['available_nobles']
        current_gp.tokens = player_data['tokens']
        current_gp.purchased_card_ids = player_data['purchased_card_ids']
        current_gp.reserved_card_ids = player_data['reserved_card_ids']
        current_gp.noble_ids = player_data['noble_ids']
        current_gp.prestige_points = player_data['prestige_points']

    def _post_action(self, game, current_gp, players, game_data, player_data, action_type=None, action_data=None):
        """Record action history, check end condition and advance turn."""
        # Record the action in history
        if action_type and action_data is not None:
            game.current_turn_number += 1
            num_players = len(players)
            round_number = ((game.current_turn_number - 1) // num_players) + 1
            
            GameAction.objects.create(
                game=game,
                player=current_gp,
                turn_number=game.current_turn_number,
                round_number=round_number,
                action_type=action_type,
                action_data=action_data,
                prestige_points_after=player_data['prestige_points'],
            )
        
        all_player_data = []
        for gp in players:
            if gp.pk == current_gp.pk:
                all_player_data.append({
                    'prestige_points': player_data['prestige_points'],
                    'purchased_card_ids': player_data['purchased_card_ids'],
                    'order': gp.order,
                })
            else:
                all_player_data.append({
                    'prestige_points': gp.prestige_points,
                    'purchased_card_ids': gp.purchased_card_ids,
                    'order': gp.order,
                })

        trigger = check_end_condition(all_player_data)
        if trigger and game.last_round_triggered_by is None:
            game.last_round_triggered_by = trigger['order']

        if game.last_round_triggered_by is not None:
            # Game ends when the last player in turn order finishes theirturn
            # This ensures everyone gets equal turns in the final round
            last_player_order = len(players) - 1
            if current_gp.order == last_player_order or len(players) == 1:
                winner_data = determine_winner(all_player_data, game.last_round_triggered_by)
                winner_gp = next(gp for gp in players if gp.order == winner_data['order'])
                game.status = Game.STATUS_FINISHED
                game.winner = winner_gp.user
                finalize_ranked_match(game, players)

        game.current_player_index = (game.current_player_index + 1) % len(players)
        # Reset turn timer for next player
        if game.status == Game.STATUS_PLAYING:
            game.turn_started_at = timezone.now()
        game.save()
        current_gp.save()
