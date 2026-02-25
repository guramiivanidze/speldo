"""
WebSocket consumer for Splendor game.
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User

from .models import Game, GamePlayer
from .game_logic import (
    CARD_BY_ID, NOBLE_BY_ID, COLORS,
    apply_take_tokens, apply_discard_tokens,
    apply_reserve_card, apply_buy_card,
    apply_noble_visit, check_nobles,
    check_end_condition, determine_winner,
)


def serialize_game_state(game, players):
    players_data = []
    for gp in players:
        players_data.append({
            'id': gp.user.id,
            'username': gp.user.username,
            'order': gp.order,
            'tokens': gp.tokens,
            'purchased_card_ids': gp.purchased_card_ids,
            'reserved_card_ids': gp.reserved_card_ids,
            'noble_ids': gp.noble_ids,
            'prestige_points': gp.prestige_points,
        })

    # Deck counts (hidden)
    deck_counts = {lvl: len(ids) for lvl, ids in game.decks.items()}

    return {
        'game_id': str(game.id),
        'code': game.code,
        'status': game.status,
        'current_player_index': game.current_player_index,
        'tokens_in_bank': game.tokens_in_bank,
        'visible_cards': game.visible_cards,
        'deck_counts': deck_counts,
        'available_nobles': game.available_nobles,
        'players': players_data,
        'winner_id': game.winner_id,
        'cards_data': {str(k): v for k, v in CARD_BY_ID.items()},
        'nobles_data': {str(k): v for k, v in NOBLE_BY_ID.items()},
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
        }

        handler = handlers.get(action)
        if handler:
            await handler(payload)
        else:
            await self.send_error(f"Unknown action: {action}")

    async def send_game_state(self):
        game, players = await self.get_game_and_players()
        if game is None:
            await self.send_error("Game not found.")
            return
        state = serialize_game_state(game, players)
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'game_state_update', 'state': state}
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
                        return "Game is not in progress."
                    current_gp = self._get_current_player(game, players)
                    if current_gp is None or current_gp.user != self.user:
                        return "Not your turn."
                    game_data = self._game_data_from_game(game)
                    player_data = self._player_data_from_gp(current_gp)

                    new_gd, new_pd, error = apply_take_tokens(game_data, player_data, colors)
                    if error:
                        return error

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
                        return "Not your turn."
                    game_data = self._game_data_from_game(game)
                    player_data = self._player_data_from_gp(current_gp)

                    new_gd, new_pd, error = apply_discard_tokens(game_data, player_data, tokens_to_discard)
                    if error:
                        return error

                    self._save_state(game, current_gp, new_gd, new_pd)
                    # No turn advance on discard; waiting for more tokens
                    game.save()
                    current_gp.save()
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
                        return "Game is not in progress."
                    current_gp = self._get_current_player(game, players)
                    if current_gp is None or current_gp.user != self.user:
                        return "Not your turn."
                    game_data = self._game_data_from_game(game)
                    player_data = self._player_data_from_gp(current_gp)

                    new_gd, new_pd, reserved_id, error = apply_reserve_card(
                        game_data, player_data, card_id=card_id, level=level
                    )
                    if error:
                        return error

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

                    new_gd, new_pd, error = apply_buy_card(game_data, player_data, card_id)
                    if error:
                        return error

                    # Check noble visits
                    eligible = check_nobles(new_gd, new_pd)
                    if len(eligible) == 1:
                        new_gd, new_pd = apply_noble_visit(new_gd, new_pd, eligible[0])

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

        game.current_player_index = (game.current_player_index + 1) % len(players)
        game.save()
        current_gp.save()
