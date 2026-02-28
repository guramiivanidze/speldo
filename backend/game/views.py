import random
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Game, GamePlayer
from .game_logic import (
    generate_code, initial_bank,
    initial_decks_and_nobles,
)
from .consumers import serialize_game_state


class GameListCreateView(APIView):
    def get(self, request):
        games = Game.objects.filter(status=Game.STATUS_WAITING).order_by('-created_at')
        data = [
            {
                'id': str(g.id),
                'code': g.code,
                'player_count': g.players.count(),
                'max_players': g.max_players,
            }
            for g in games
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
