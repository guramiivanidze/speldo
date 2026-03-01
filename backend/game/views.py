import random
from datetime import timedelta
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Game, GamePlayer, GameAction
from .game_logic import (
    generate_code, initial_bank,
    initial_decks_and_nobles,
    get_card, get_noble,
)
from .consumers import serialize_game_state


class GameListCreateView(APIView):
    def get(self, request):
        # Clean up stale waiting games (older than 1 hour with no players)
        stale_cutoff = timezone.now() - timedelta(hours=1)
        stale_games = Game.objects.filter(
            status=Game.STATUS_WAITING,
            created_at__lt=stale_cutoff
        )
        for game in stale_games:
            if game.players.count() == 0:
                game.delete()
        
        # Return only games that have at least one player
        games = Game.objects.filter(status=Game.STATUS_WAITING).order_by('-created_at')
        data = [
            {
                'id': str(g.id),
                'code': g.code,
                'player_count': g.players.count(),
                'max_players': g.max_players,
            }
            for g in games
            if g.players.count() > 0  # Only show games with players
        ]
        return Response(data)

    def post(self, request):
        max_players = request.data.get('max_players', 4)
        if max_players not in [2, 3, 4]:
            return Response({'error': 'max_players must be 2, 3, or 4.'}, status=400)

        code = generate_code()
        while Game.objects.filter(code=code).exists():
            code = generate_code()

        game = Game.objects.create(code=code, max_players=max_players)
        GamePlayer.objects.create(
            game=game, user=request.user, order=0,
            tokens={c: 0 for c in ['white', 'blue', 'green', 'red', 'black', 'gold']},
        )
        return Response({'id': str(game.id), 'code': game.code}, status=201)


class GameJoinView(APIView):
    def post(self, request, code):
        game = get_object_or_404(Game, code=code)
        if game.status != Game.STATUS_WAITING:
            return Response({'error': 'Game already started or finished.'}, status=400)
        if game.players.filter(user=request.user).exists():
            return Response({'error': 'Already in this game.'}, status=400)
        count = game.players.count()
        if count >= game.max_players:
            return Response({'error': 'Game is full.'}, status=400)

        GamePlayer.objects.create(
            game=game, user=request.user, order=count,
            tokens={c: 0 for c in ['white', 'blue', 'green', 'red', 'black', 'gold']},
        )

        # Broadcast updated game state to all connected players
        players_with_users = list(game.players.select_related('user').order_by('order'))
        state = serialize_game_state(game, players_with_users)
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'game_{code}',
            {
                'type': 'game_state_update',
                'state': state,
            }
        )

        return Response({'message': 'Joined successfully.'})


class GameStartView(APIView):
    def post(self, request, code):
        game = get_object_or_404(Game, code=code)
        if game.status != Game.STATUS_WAITING:
            return Response({'error': 'Game already started.'}, status=400)
        players = list(game.players.order_by('order'))
        if not any(p.user == request.user for p in players):
            return Response({'error': 'Not in this game.'}, status=403)
        if len(players) < 2:
            return Response({'error': 'Need at least 2 players.'}, status=400)

        player_count = len(players)
        bank = initial_bank(player_count)
        decks, visible, nobles = initial_decks_and_nobles(player_count)

        game.tokens_in_bank = bank
        game.decks = decks
        game.visible_cards = visible
        game.available_nobles = nobles
        game.current_player_index = random.randint(0, player_count - 1)
        game.status = Game.STATUS_PLAYING
        game.save()

        # Broadcast game state to all connected players
        players_with_users = list(game.players.select_related('user').order_by('order'))
        state = serialize_game_state(game, players_with_users)
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'game_{code}',
            {
                'type': 'game_state_update',
                'state': state,
            }
        )

        return Response({'message': 'Game started.'})


class GameStateView(APIView):
    def get(self, request, code):
        game = get_object_or_404(Game, code=code)
        players = list(game.players.select_related('user').order_by('order'))
        if not any(p.user == request.user for p in players):
            return Response({'error': 'Not in this game.'}, status=403)
        state = serialize_game_state(game, players)
        return Response(state)


class MyGamesView(APIView):
    def get(self, request):
        game_players = (
            GamePlayer.objects.filter(user=request.user)
            .select_related('game')
            .order_by('-game__created_at')
        )
        data = []
        for gp in game_players:
            g = gp.game
            data.append({
                'id': str(g.id),
                'code': g.code,
                'status': g.status,
                'player_count': g.players.count(),
                'max_players': g.max_players,
                'prestige_points': gp.prestige_points,
            })
        return Response(data)


class GameHistoryView(APIView):
    """Get the complete history of a finished game."""
    
    def get(self, request, code):
        game = get_object_or_404(Game, code=code)
        players = list(game.players.select_related('user').order_by('order'))
        
        # Allow viewing history if user was in the game or if game is finished
        is_player = any(p.user == request.user for p in players)
        if not is_player and game.status != Game.STATUS_FINISHED:
            return Response({'error': 'Not authorized to view this game.'}, status=403)
        
        # Get all actions for this game
        actions = list(game.actions.select_related('player', 'player__user').order_by('turn_number'))
        
        # Serialize actions with card/noble details
        history = []
        for action in actions:
            action_entry = {
                'turn_number': action.turn_number,
                'round_number': action.round_number,
                'player': {
                    'id': action.player.user.id,
                    'username': action.player.user.username,
                    'order': action.player.order,
                },
                'action_type': action.action_type,
                'action_data': action.action_data,
                'prestige_points_after': action.prestige_points_after,
                'created_at': action.created_at.isoformat(),
            }
            
            # Add card details if relevant
            if action.action_type in ['buy_card', 'reserve_card']:
                card_id = action.action_data.get('card_id')
                if card_id:
                    card = get_card(card_id)
                    if card:
                        action_entry['card'] = {
                            'id': card_id,
                            'level': card['level'],
                            'bonus': card['bonus'],
                            'points': card['points'],
                            'cost': card['cost'],
                            'background_image': card.get('background_image', ''),
                        }
            
            # Add noble details if relevant
            noble_id = action.action_data.get('noble_id')
            if noble_id:
                noble = get_noble(noble_id)
                if noble:
                    action_entry['noble'] = {
                        'id': noble_id,
                        'points': noble['points'],
                        'requirements': noble['requirements'],
                        'background_image': noble.get('background_image', ''),
                        'name': noble.get('name', ''),
                    }
            
            history.append(action_entry)
        
        # Serialize player final results
        results = []
        for gp in sorted(players, key=lambda p: (-p.prestige_points, len(p.purchased_card_ids))):
            # Get purchased card details
            purchased_cards = []
            for card_id in gp.purchased_card_ids:
                card = get_card(card_id)
                if card:
                    purchased_cards.append({
                        'id': card_id,
                        'level': card['level'],
                        'bonus': card['bonus'],
                        'points': card['points'],
                        'cost': card['cost'],
                        'background_image': card.get('background_image', ''),
                    })
            
            # Get reserved card details
            reserved_cards = []
            for card_id in gp.reserved_card_ids:
                card = get_card(card_id)
                if card:
                    reserved_cards.append({
                        'id': card_id,
                        'level': card['level'],
                        'bonus': card['bonus'],
                        'points': card['points'],
                        'cost': card['cost'],
                        'background_image': card.get('background_image', ''),
                    })
            
            # Get noble details
            nobles = []
            for noble_id in gp.noble_ids:
                noble = get_noble(noble_id)
                if noble:
                    nobles.append({
                        'id': noble_id,
                        'points': noble['points'],
                        'background_image': noble.get('background_image', ''),
                        'name': noble.get('name', ''),
                    })
            
            # Count bonuses (cards per color)
            bonuses = {'white': 0, 'blue': 0, 'green': 0, 'red': 0, 'black': 0}
            for card in purchased_cards:
                bonuses[card['bonus']] = bonuses.get(card['bonus'], 0) + 1
            
            results.append({
                'player': {
                    'id': gp.user.id,
                    'username': gp.user.username,
                    'order': gp.order,
                },
                'prestige_points': gp.prestige_points,
                'purchased_cards': purchased_cards,
                'reserved_cards': reserved_cards,
                'nobles': nobles,
                'bonuses': bonuses,
                'total_cards': len(purchased_cards),
                'is_winner': game.winner and game.winner.id == gp.user.id,
            })
        
        return Response({
            'game': {
                'id': str(game.id),
                'code': game.code,
                'status': game.status,
                'created_at': game.created_at.isoformat(),
                'total_turns': game.current_turn_number,
                'winner': {
                    'id': game.winner.id,
                    'username': game.winner.username,
                } if game.winner else None,
            },
            'players': [
                {
                    'id': p.user.id,
                    'username': p.user.username,
                    'order': p.order,
                }
                for p in players
            ],
            'history': history,
            'results': results,
        })
