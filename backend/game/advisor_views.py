"""
Advisor API views.

Two separate permission levels:
  - AdminAdvisorToggleView / AdminAdvisorHintView  → staff-only (IsAdminUser)
  - PlayerAdvisorHintView                          → authenticated player

The advisor flag NEVER appears in any game-state API response.
"""
import logging

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AdvisorConfig, Game  # AdvisorConfig kept for admin endpoints
from .advisor.splendor_advisor import get_advised_move

log = logging.getLogger('game.advisor')


# ──────────────────────────────────────────────────────────
# Shared helper
# ──────────────────────────────────────────────────────────

def _resolve_game(identifier):
    """Look up a Game by 6-char code or UUID string."""
    identifier = str(identifier).strip()
    if len(identifier) == 6:
        return get_object_or_404(Game, code=identifier.upper())
    return get_object_or_404(Game, id=identifier)


def _players_data(game):
    """Return players as a list of dicts, ordered by turn order."""
    return [
        {
            'tokens': p.tokens,
            'purchased_card_ids': p.purchased_card_ids,
            'reserved_card_ids': p.reserved_card_ids,
            'noble_ids': p.noble_ids,
            'prestige_points': p.prestige_points,
            'user_id': p.user_id,
            'username': p.user.username,
        }
        for p in game.players.select_related('user').order_by('order')
    ]


def _game_data(game):
    return {
        'tokens_in_bank': game.tokens_in_bank,
        'visible_cards': game.visible_cards,
        'decks': game.decks,
        'available_nobles': game.available_nobles,
    }


def _compute_advice(game, advised_player_index):
    gd = _game_data(game)
    pd = _players_data(game)
    return get_advised_move(gd, pd, advised_player_index)


# ──────────────────────────────────────────────────────────
# Admin: toggle advisor for a player
# ──────────────────────────────────────────────────────────

class AdminAdvisorToggleView(APIView):
    """POST /api/admin/advisor/toggle"""
    permission_classes = [IsAdminUser]

    def post(self, request):
        game_id = request.data.get('gameId') or request.data.get('game_id')
        if not game_id:
            return Response({'error': 'gameId required'}, status=400)

        try:
            game = _resolve_game(game_id)
        except Exception:
            return Response({'error': 'Game not found'}, status=404)

        player_index = int(request.data.get('playerIndex', request.data.get('player_index', 0)))
        enabled = bool(request.data.get('enabled', True))

        # Validate player index
        player_count = game.players.count()
        if player_index < 0 or player_index >= player_count:
            return Response(
                {'error': f'playerIndex must be 0-{player_count - 1}'}, status=400
            )

        cfg, _ = AdvisorConfig.objects.get_or_create(game=game)
        cfg.enabled = enabled
        cfg.advised_player_index = player_index
        cfg.save()

        log.info(
            'Admin %s %s advisor for game %s player %d',
            request.user.username,
            'enabled' if enabled else 'disabled',
            game.code,
            player_index,
        )

        # Return player info for confirmation
        players = list(game.players.select_related('user').order_by('order'))
        advised_username = players[player_index].user.username if players else '?'

        return Response({
            'status': 'ok',
            'game_code': game.code,
            'enabled': cfg.enabled,
            'advised_player_index': cfg.advised_player_index,
            'advised_username': advised_username,
        })


# ──────────────────────────────────────────────────────────
# Admin: get current hint (admin debugging)
# ──────────────────────────────────────────────────────────

class AdminAdvisorHintView(APIView):
    """GET /api/admin/advisor/hint?gameId=X"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        game_id = request.query_params.get('gameId') or request.query_params.get('game_id')
        if not game_id:
            return Response({'error': 'gameId required'}, status=400)

        try:
            game = _resolve_game(game_id)
        except Exception:
            return Response({'error': 'Game not found'}, status=404)

        try:
            cfg = game.advisor_config
        except AdvisorConfig.DoesNotExist:
            return Response({'error': 'Advisor not configured for this game'}, status=404)

        if not cfg.enabled:
            return Response({'error': 'Advisor is disabled'}, status=400)

        if game.status != Game.STATUS_PLAYING:
            return Response({'error': 'Game is not active', 'status': game.status}, status=400)

        try:
            advice = _compute_advice(game, cfg.advised_player_index)
            log.info(
                'Admin hint: game=%s player=%d action=%s confidence=%.2f',
                game.code, cfg.advised_player_index,
                advice.get('action'), advice.get('confidence', 0),
            )
            return Response({
                'game_code': game.code,
                'advised_player_index': cfg.advised_player_index,
                'current_player_index': game.current_player_index,
                'advice': advice,
            })
        except Exception as exc:
            log.exception('Advisor error game=%s: %s', game.code, exc)
            return Response({'error': 'Advisor computation failed', 'detail': str(exc)}, status=500)


# ──────────────────────────────────────────────────────────
# Player: poll for own hint
# ──────────────────────────────────────────────────────────

class PlayerAdvisorHintView(APIView):
    """
    GET /api/advisor/hint?gameCode=X

    Active when the requesting user has advisor_enabled=True on their profile.
    Returns {enabled: false} silently for all other users.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        game_code = (
            request.query_params.get('gameCode')
            or request.query_params.get('game_code')
        )
        if not game_code:
            return Response({'error': 'gameCode required'}, status=400)

        # Check user's profile flag — primary source of truth
        try:
            advisor_on = request.user.profile.advisor_enabled
        except Exception:
            advisor_on = False

        if not advisor_on:
            return Response({'enabled': False})

        game = get_object_or_404(Game, code=game_code.upper())

        # Find this user's player slot in the game
        players = list(game.players.select_related('user').order_by('order'))
        my_index = next(
            (i for i, p in enumerate(players) if p.user_id == request.user.id),
            None,
        )
        if my_index is None:
            return Response({'enabled': False})

        if game.status != Game.STATUS_PLAYING:
            return Response({'enabled': True, 'game_status': game.status})

        try:
            advice = _compute_advice(game, my_index)
            return Response({
                'enabled': True,
                'is_your_turn': game.current_player_index == my_index,
                'current_player_index': game.current_player_index,
                'advice': advice,
            })
        except Exception as exc:
            log.exception('Player advisor error game=%s: %s', game.code, exc)
            return Response({'enabled': True, 'error': 'Advisor temporarily unavailable'})
