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

from .models import Game, GamePlayer
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
    for gp in players:
        player_tokens = gp.tokens if isinstance(gp.tokens, dict) else {}
        if gp.order == game.current_player_index:
            current_player_tokens = player_tokens
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

    # Build cards_data and nobles_data from database
    cards_data = {str(c['id']): c for c in get_all_cards()}
    nobles_data = {str(n['id']): n for n in get_all_nobles()}

    # Check if current player needs to discard tokens (has >10)
    current_player_token_count = sum(current_player_tokens.values()) if current_player_tokens else 0
    pending_discard = current_player_token_count > 10
    pending_discard_count = max(0, current_player_token_count - 10) if pending_discard else 0

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
        # Token discard state
        'pending_discard': pending_discard,
        'pending_discard_count': pending_discard_count,
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
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

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
        """Handle player leaving the game - pause for others."""
        @database_sync_to_async
        def _db():
            from django.db import transaction
            try:
                with transaction.atomic():
                    game = Game.objects.select_for_update().get(code=self.game_code)
                    player = game.players.filter(user=self.user).first()
                    
                    if not player:
                        return "You are not in this game."
                    
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
                    
                    if online_players == 0:
                        # All players left - end game
                        game.status = Game.STATUS_FINISHED
                        players = list(game.players.select_related('user').all())
                        finalize_ranked_match(game, players)
                        game.save()
                        return 'game_ended'
                    
                    # If game is already paused, just update state and notify
                    if game.status == Game.STATUS_PAUSED:
                        game.save()
                        return {'additional_leave': True, 'user_id': self.user.id, 'username': self.user.username}
                    
                    # Pause the game (first player leaving)
                    game.status = Game.STATUS_PAUSED
                    game.paused_at = timezone.now()
                    game.pause_expires_at = timezone.now() + timedelta(minutes=PAUSE_TIMEOUT_MINUTES)
                    game.left_player_id = self.user.id
                    game.player_votes = {}
                    game.last_survey_at = timezone.now()
                    game.save()
                    
                    return {'paused': True, 'user_id': self.user.id, 'username': self.user.username}
            except Game.DoesNotExist:
                return "Game not found."

        result = await _db()
        
        if isinstance(result, str):
            if result == 'game_ended':
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'game_ended_all_left'}
                )
            else:
                await self.send_error(result)
        elif isinstance(result, dict) and (result.get('paused') or result.get('additional_leave')):
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

    async def send_game_state(self):
        # First check pause status
        await self.check_pause_status()
        
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
            if len(eligible_nobles) == 1:
                gd2, pd2 = apply_noble_visit(game_data, player_data, eligible_nobles[0])
                game.tokens_in_bank = gd2['tokens_in_bank']
                game.visible_cards = gd2['visible_cards']
                game.decks = gd2['decks']
                game.available_nobles = gd2['available_nobles']
                current_gp.noble_ids = pd2['noble_ids']
                current_gp.prestige_points = pd2['prestige_points']
                player_data = pd2
                game_data = gd2
            elif len(eligible_nobles) > 1:
                # Need player to choose - handled separately
                # For now still auto-pick first (TODO: add choose_noble flow)
                pass

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
                trigger_order = game.last_round_triggered_by
                if current_gp.order == (trigger_order - 1) % len(players):
                    # Last player has gone
                    winner_data = determine_winner(all_player_data, trigger_order)
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
                    
                    # Only advance turn if player doesn't need to discard
                    if not needs_discard:
                        current_gp.pending_action_data = None
                        self._post_action(game, current_gp, players, new_gd, new_pd)
                    else:
                        # Save pending action data for cancel support
                        current_gp.pending_action_data = {
                            'type': 'take_tokens',
                            'colors': colors,
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
                        current_gp.pending_action_data = None
                        self._post_action(game, current_gp, players, new_gd, new_pd)
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
                    
                    # Only advance turn if player doesn't need to discard
                    if not needs_discard:
                        current_gp.pending_action_data = None
                        self._post_action(game, current_gp, players, new_gd, new_pd)
                    else:
                        # Determine if gold was received (compare before/after gold)
                        gold_before = player_data['tokens'].get('gold', 0)
                        gold_after = new_pd['tokens'].get('gold', 0)
                        gold_received = gold_after > gold_before
                        
                        # Determine the card's level
                        reserved_card = get_card(reserved_id)
                        card_level = reserved_card['level'] if reserved_card else None
                        
                        # Save pending action data for cancel support
                        current_gp.pending_action_data = {
                            'type': 'reserve',
                            'card_id': reserved_id,
                            'gold_received': gold_received,
                            'level': card_level,
                            'from_visible': card_id is not None,  # True if card_id was provided
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

                    # Log after buy (before noble check)
                    logger.info(
                        "[BUY_CARD] Game=%s User=%s | AFTER_BUY | PrestigePoints=%d | Bank=%s | PlayerTokens=%s (total=%d) | PurchasedCount=%d",
                        self.game_code, self.user.username,
                        new_pd['prestige_points'],
                        new_gd['tokens_in_bank'], new_pd['tokens'],
                        sum(new_pd['tokens'].values()),
                        len(new_pd['purchased_card_ids'])
                    )

                    # Check noble visits
                    eligible = check_nobles(new_gd, new_pd)
                    if len(eligible) == 1:
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

                    self._save_state(game, current_gp, new_gd, new_pd)
                    self._post_action(game, current_gp, players, new_gd, new_pd)
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
                    game_data = self._game_data_from_game(game)
                    player_data = self._player_data_from_gp(current_gp)

                    eligible = check_nobles(game_data, player_data)
                    if noble_id not in eligible:
                        return "Not eligible for that noble."

                    new_gd, new_pd = apply_noble_visit(game_data, player_data, noble_id)
                    self._save_state(game, current_gp, new_gd, new_pd)
                    self._post_action(game, current_gp, players, new_gd, new_pd)
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

    def _post_action(self, game, current_gp, players, game_data, player_data):
        """Check end condition and advance turn."""
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
            trigger_order = game.last_round_triggered_by
            last_player_order = (trigger_order - 1) % len(players)
            if current_gp.order == last_player_order or len(players) == 1:
                winner_data = determine_winner(all_player_data, trigger_order)
                winner_gp = next(gp for gp in players if gp.order == winner_data['order'])
                game.status = Game.STATUS_FINISHED
                game.winner = winner_gp.user
                finalize_ranked_match(game, players)

        game.current_player_index = (game.current_player_index + 1) % len(players)
        game.save()
        current_gp.save()
