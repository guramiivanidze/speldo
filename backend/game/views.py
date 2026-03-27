import random
from datetime import timedelta
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Game, GamePlayer, GameAction, GameInvitation
from .game_logic import (
    generate_code, initial_bank,
    initial_decks_and_nobles,
    get_card, get_noble,
    PLACEMENT_POINTS,
)
from .consumers import serialize_game_state
from accounts.models import Friendship


class GameListCreateView(APIView):
    def get(self, request):
        # Games are private - only joinable via code
        # Return empty list to prevent browsing open games
        return Response([])

    def post(self, request):
        max_players = request.data.get('max_players', 4)
        if max_players not in [2, 3, 4]:
            return Response({'error': 'max_players must be 2, 3, or 4.'}, status=400)
        
        timer_enabled = request.data.get('timer_enabled', False)

        code = generate_code()
        while Game.objects.filter(code=code).exists():
            code = generate_code()

        game = Game.objects.create(code=code, max_players=max_players, timer_enabled=timer_enabled)
        GamePlayer.objects.create(
            game=game, user=request.user, order=0,
            tokens={c: 0 for c in ['white', 'blue', 'green', 'red', 'black', 'gold']},
        )
        return Response({'id': str(game.id), 'code': game.code}, status=201)


class GameJoinView(APIView):
    def post(self, request, code):
        game = get_object_or_404(Game, code=code)
        
        # Check if user is already in this game (allow rejoin)
        existing_player = game.players.filter(user=request.user).first()
        if existing_player:
            # Already in the game - return success with game status info
            status_messages = {
                Game.STATUS_WAITING: 'Welcome back! Waiting for players...',
                Game.STATUS_PLAYING: 'Welcome back! The game is in progress.',
                Game.STATUS_FINISHED: 'This game has ended.',
            }
            message = status_messages.get(game.status, 'Rejoined successfully.')
            return Response({
                'message': message,
                'rejoined': True,
                'game_status': game.status,
                'player_count': game.players.count(),
                'max_players': game.max_players,
            })
        
        if game.status != Game.STATUS_WAITING:
            return Response({'error': 'Game already started or finished.'}, status=400)
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

        return Response({
            'message': 'Joined successfully!',
            'rejoined': False,
            'game_status': game.status,
            'player_count': game.players.count(),
            'max_players': game.max_players,
        })


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

        # Pick a random starting player, move them to position 0
        # Other players keep their relative join order
        player_count = len(players)
        starting_index = random.randint(0, player_count - 1)
        starting_player = players[starting_index]
        reordered = [starting_player] + [p for p in players if p != starting_player]
        
        # First, set all orders to temporary negative values to avoid unique constraint
        for i, player in enumerate(reordered):
            player.order = -(i + 1)
            player.save()
        # Now assign the final order
        for new_order, player in enumerate(reordered):
            player.order = new_order
            player.save()

        # Refresh players list to get correct order
        players = reordered

        bank = initial_bank(player_count)

        # Build per-game balancing override from model fields
        balancing_override = None
        if game.balancing_enabled is not None or game.balancing_level:
            balancing_override = {}
            if game.balancing_enabled is not None:
                balancing_override['enabled'] = game.balancing_enabled
            if game.balancing_level:
                balancing_override['level'] = game.balancing_level

        decks, visible, nobles = initial_decks_and_nobles(
            player_count, balancing_override=balancing_override
        )

        game.tokens_in_bank = bank
        game.decks = decks
        game.visible_cards = visible
        game.available_nobles = nobles
        game.current_player_index = 0  # First player in shuffled order always starts
        game.status = Game.STATUS_PLAYING
        game.turn_started_at = timezone.now()  # Start turn timer for first player
        game.save()

        # Expire all pending invitations and notify invitees
        pending_invitations = GameInvitation.objects.filter(
            game=game,
            status=GameInvitation.STATUS_PENDING
        )
        invitation_recipients = list(pending_invitations.values_list('to_user_id', 'id'))
        pending_invitations.update(status=GameInvitation.STATUS_EXPIRED)
        
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
        
        # Notify invitees that their invitations have expired
        for user_id, invitation_id in invitation_recipients:
            async_to_sync(channel_layer.group_send)(
                f'notifications_{user_id}',
                {
                    'type': 'invitation_expired',
                    'invitation_id': invitation_id,
                    'reason': 'Game has started',
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


class FriendsWaitingGamesView(APIView):
    """Get waiting games created by friends that the user can join."""
    
    def get(self, request):
        # Get friend IDs
        friend_ids = list(
            Friendship.objects.filter(user=request.user).values_list('friend_id', flat=True)
        )
        
        if not friend_ids:
            return Response({'games': []})
        
        # Get waiting games where a friend is a player AND user is NOT already in the game
        my_game_ids = set(
            GamePlayer.objects.filter(user=request.user).values_list('game_id', flat=True)
        )
        
        # Find games where friends are players with status=waiting
        friend_games = Game.objects.filter(
            status=Game.STATUS_WAITING,
            players__user_id__in=friend_ids
        ).exclude(
            id__in=my_game_ids
        ).distinct().prefetch_related('players__user')
        
        games = []
        for game in friend_games:
            players = list(game.players.all())
            # Find which friend(s) created/are in this game
            friend_names = [p.user.username for p in players if p.user_id in friend_ids]
            
            games.append({
                'code': game.code,
                'player_count': len(players),
                'max_players': game.max_players,
                'friend_names': friend_names,
                'created_at': game.created_at.isoformat(),
            })
        
        # Sort by most recent
        games.sort(key=lambda g: g['created_at'], reverse=True)
        
        return Response({'games': games})


class UserGameHistoryView(APIView):
    """Get the game history for a user showing all finished games."""
    
    def get(self, request):
        page = int(request.query_params.get('page', 1))
        per_page = min(int(request.query_params.get('per_page', 20)), 50)
        
        # Get all game players for this user in finished games
        game_players = (
            GamePlayer.objects.filter(user=request.user, game__status=Game.STATUS_FINISHED)
            .select_related('game', 'game__winner')
            .order_by('-game__created_at')
        )
        
        total = game_players.count()
        start = (page - 1) * per_page
        end = start + per_page
        
        games_data = []
        for gp in game_players[start:end]:
            game = gp.game
            
            # Get all players in this game sorted by placement (highest points first, then fewest cards)
            all_players = list(game.players.select_related('user').order_by('-prestige_points'))
            
            # Sort by prestige_points desc, then by total cards asc (fewer cards is better as tiebreaker)
            all_players.sort(key=lambda p: (-p.prestige_points, len(p.purchased_card_ids)))
            
            # Build placement info
            player_results = []
            for idx, player in enumerate(all_players):
                is_winner = game.winner and player.user.id == game.winner.id
                player_results.append({
                    'username': player.user.username,
                    'placement': idx + 1,
                    'prestige_points': player.prestige_points,
                    'total_cards': len(player.purchased_card_ids),
                    'is_winner': is_winner,
                    'is_me': player.user.id == request.user.id,
                })
            
            # Find my placement
            my_placement = next((p['placement'] for p in player_results if p['is_me']), None)
            
            games_data.append({
                'id': str(game.id),
                'code': game.code,
                'finished_at': game.created_at.isoformat(),  # Note: no finished_at field, using created_at
                'player_count': len(all_players),
                'players': player_results,
                'my_placement': my_placement,
                'my_points': gp.prestige_points,
                'won': game.winner and game.winner.id == request.user.id,
            })
        
        return Response({
            'total': total,
            'page': page,
            'per_page': per_page,
            'games': games_data,
        })


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


class CasualStatsView(APIView):
    """Get casual game stats for the current user."""
    
    def get(self, request):
        user = request.user
        
        finished_games = Game.objects.filter(
            status=Game.STATUS_FINISHED,
            players__user=user,
        ).distinct()
        
        total_games = finished_games.count()
        wins = finished_games.filter(winner=user).count()
        losses = total_games - wins
        win_rate = round((wins / total_games) * 100) if total_games > 0 else 0
        
        return Response({
            'total_games': total_games,
            'wins': wins,
            'losses': losses,
            'win_rate': win_rate,
        })


class GameFriendsListView(APIView):
    """Get friends list for game invitations."""
    
    def get(self, request, code):
        game = get_object_or_404(Game, code=code)
        
        # Verify user is in this game
        if not game.players.filter(user=request.user).exists():
            return Response({'error': 'Not in this game.'}, status=403)
        
        # Get all friends
        friendships = Friendship.objects.filter(user=request.user).select_related('friend')
        
        # Get existing invitations for this game
        sent_invitations = {
            inv.to_user_id: inv.status
            for inv in GameInvitation.objects.filter(game=game, from_user=request.user)
        }
        
        # Get players already in the game
        players_in_game = set(game.players.values_list('user_id', flat=True))
        
        friends = []
        for friendship in friendships:
            friend = friendship.friend
            
            # Check invitation status
            invitation_status = sent_invitations.get(friend.id)
            is_in_game = friend.id in players_in_game
            
            friends.append({
                'id': friend.id,
                'username': friend.username,
                'is_in_game': is_in_game,
                'invitation_status': invitation_status,
                'can_invite': not is_in_game and invitation_status is None,
            })
        
        return Response({
            'friends': friends,
            'game_code': code,
            'slots_available': game.max_players - game.players.count(),
        })


class SendGameInvitationView(APIView):
    """Send a game invitation to a friend."""
    
    def post(self, request, code):
        game = get_object_or_404(Game, code=code)
        friend_id = request.data.get('friend_id')
        
        if not friend_id:
            return Response({'error': 'friend_id is required.'}, status=400)
        
        # Verify user is in this game
        if not game.players.filter(user=request.user).exists():
            return Response({'error': 'Not in this game.'}, status=403)
        
        # Verify game is in waiting status
        if game.status != Game.STATUS_WAITING:
            return Response({'error': 'Game has already started.'}, status=400)
        
        # Verify game is not full
        if game.players.count() >= game.max_players:
            return Response({'error': 'Game is full.'}, status=400)
        
        # Verify friendship exists
        if not Friendship.objects.filter(user=request.user, friend_id=friend_id).exists():
            return Response({'error': 'Not friends with this user.'}, status=400)
        
        # Check if invitation already exists
        existing = GameInvitation.objects.filter(game=game, to_user_id=friend_id).first()
        if existing:
            if existing.status == GameInvitation.STATUS_PENDING:
                return Response({'error': 'Invitation already sent.'}, status=400)
            # Reset a declined invitation
            existing.status = GameInvitation.STATUS_PENDING
            existing.from_user = request.user
            existing.responded_at = None
            existing.save()
            invitation = existing
        else:
            invitation = GameInvitation.objects.create(
                game=game,
                from_user=request.user,
                to_user_id=friend_id,
            )
        
        # Send real-time notification via WebSocket
        channel_layer = get_channel_layer()
        from django.contrib.auth.models import User
        to_user = User.objects.get(id=friend_id)
        
        async_to_sync(channel_layer.group_send)(
            f'notifications_{friend_id}',
            {
                'type': 'game_invitation',
                'invitation_id': invitation.id,
                'game_code': game.code,
                'from_user_id': request.user.id,
                'from_username': request.user.username,
                'max_players': game.max_players,
                'current_players': game.players.count(),
            }
        )
        
        return Response({
            'message': f'Invitation sent to {to_user.username}.',
            'invitation_id': invitation.id,
        })


class RespondGameInvitationView(APIView):
    """Accept or decline a game invitation."""
    
    def post(self, request, invitation_id, action):
        if action not in ['accept', 'decline']:
            return Response({'error': 'Invalid action.'}, status=400)
        
        invitation = get_object_or_404(GameInvitation, id=invitation_id, to_user=request.user)
        
        if invitation.status != GameInvitation.STATUS_PENDING:
            return Response({'error': 'Invitation already responded to.'}, status=400)
        
        if action == 'accept':
            # Check if invitation is still valid
            if not invitation.is_valid():
                invitation.status = GameInvitation.STATUS_EXPIRED
                invitation.save()
                return Response({'error': 'Invitation is no longer valid. The game may have started or is full.'}, status=400)
            
            # Join the game
            game = invitation.game
            count = game.players.count()
            
            GamePlayer.objects.create(
                game=game,
                user=request.user,
                order=count,
                tokens={c: 0 for c in ['white', 'blue', 'green', 'red', 'black', 'gold']},
            )
            
            invitation.status = GameInvitation.STATUS_ACCEPTED
            invitation.responded_at = timezone.now()
            invitation.save()
            
            # Broadcast updated game state
            players_with_users = list(game.players.select_related('user').order_by('order'))
            state = serialize_game_state(game, players_with_users)
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'game_{game.code}',
                {
                    'type': 'game_state_update',
                    'state': state,
                }
            )
            
            return Response({
                'message': 'Invitation accepted.',
                'game_code': game.code,
            })
        else:
            invitation.status = GameInvitation.STATUS_DECLINED
            invitation.responded_at = timezone.now()
            invitation.save()
            
            return Response({'message': 'Invitation declined.'})


class PendingGameInvitationsView(APIView):
    """Get pending game invitations for the current user."""
    
    def get(self, request):
        # Get pending invitations where the game is still waiting
        invitations = GameInvitation.objects.filter(
            to_user=request.user,
            status=GameInvitation.STATUS_PENDING,
            game__status=Game.STATUS_WAITING,
        ).select_related('game', 'from_user')
        
        # Filter to only valid invitations (game not full)
        valid_invitations = []
        for inv in invitations:
            if inv.game.players.count() < inv.game.max_players:
                valid_invitations.append({
                    'id': inv.id,
                    'game_code': inv.game.code,
                    'from_user_id': inv.from_user.id,
                    'from_username': inv.from_user.username,
                    'max_players': inv.game.max_players,
                    'current_players': inv.game.players.count(),
                    'created_at': inv.created_at.isoformat(),
                })
        
        return Response({
            'invitations': valid_invitations,
            'count': len(valid_invitations),
        })


class CasualLeaderboardView(APIView):
    """Get casual game leaderboard - top 50 players by 1st place finishes."""
    permission_classes = []  # Public endpoint
    
    def get(self, request):
        from django.contrib.auth import get_user_model
        from django.db.models import Count
        from collections import defaultdict
        
        User = get_user_model()
        
        # Get player_count filter (2, 3, or 4)
        player_count_param = request.query_params.get('player_count')
        player_count = None
        if player_count_param:
            try:
                player_count = int(player_count_param)
                if player_count not in [2, 3, 4]:
                    player_count = None
            except ValueError:
                player_count = None
        
        casual_games = Game.objects.filter(
            status=Game.STATUS_FINISHED,
        ).prefetch_related('players__user')
        
        # If player_count is specified, filter by annotated count
        if player_count:
            casual_games = casual_games.annotate(
                num_players=Count('players')
            ).filter(num_players=player_count)
        
        # Determine max positions based on filter
        max_positions = player_count if player_count else 4
        
        # Track position counts for each user
        # user_id -> {1: count, 2: count, ..., 'games': count}
        default_stats = lambda: {i: 0 for i in range(1, max_positions + 1)}
        default_stats_with_games = lambda: {**{i: 0 for i in range(1, max_positions + 1)}, 'games': 0}
        user_stats = defaultdict(default_stats_with_games)
        
        for game in casual_games:
            players = list(game.players.all())
            if not players:
                continue
            
            # If filtering by player_count, skip games that don't match
            # (This is a backup check in case annotation didn't work perfectly)
            if player_count and len(players) != player_count:
                continue
            
            # Sort by prestige_points desc, then by card count asc (tiebreaker)
            players.sort(key=lambda p: (-p.prestige_points, len(p.purchased_card_ids)))
            
            # Assign positions
            for position, player in enumerate(players, start=1):
                user_id = player.user_id
                user_stats[user_id]['games'] += 1
                if position <= max_positions:
                    user_stats[user_id][position] += 1
        
        # Get user objects for those with stats
        user_ids = list(user_stats.keys())
        users_by_id = {u.id: u for u in User.objects.filter(id__in=user_ids)}
        
        # Build entries and sort by 1st places, then 2nd, etc.
        entries = []
        for user_id, stats in user_stats.items():
            user = users_by_id.get(user_id)
            if user:
                entry = {
                    'user_id': user_id,
                    'username': user.username,
                    'games': stats['games'],
                }
                # Add position counts dynamically
                for pos in range(1, max_positions + 1):
                    entry[f'pos_{pos}'] = stats[pos]
                entries.append(entry)
        
        # Sort: most 1st places, then 2nd, then 3rd, then 4th, then fewest games
        sort_keys = [f'pos_{i}' for i in range(1, max_positions + 1)]
        entries.sort(key=lambda e: tuple(-e[k] for k in sort_keys) + (e['games'],))
        
        # Take top 50 and assign ranks
        entries = entries[:50]
        for rank, entry in enumerate(entries, start=1):
            entry['rank'] = rank
            del entry['user_id']  # Don't expose user_id
        
        return Response({
            'entries': entries,
            'total': len(entries),
            'player_count': player_count,
            'max_positions': max_positions,
        })


class PointsLeaderboardView(APIView):
    """Leaderboard sorted by placement points.

    Points awarded per game:
      2-player  →  1st: 2 pt,  2nd: 0 pt
      3-player  →  1st: 3 pts, 2nd: 2 pt,  3rd: 0 pt
      4-player  →  1st: 4 pts, 2nd: 3 pts, 3rd: 1 pt, 4th: 0 pt

    Sorted by total points desc, then win_rate desc.
    """
    permission_classes = []  # Public endpoint

    def get(self, request):
        from django.contrib.auth import get_user_model
        from django.db.models import Count
        from collections import defaultdict

        User = get_user_model()

        # Optional player_count filter
        player_count_param = request.query_params.get('player_count')
        player_count_filter = None
        if player_count_param:
            try:
                v = int(player_count_param)
                if v in (2, 3, 4):
                    player_count_filter = v
            except ValueError:
                pass

        casual_games = Game.objects.filter(
            status=Game.STATUS_FINISHED,
        ).prefetch_related('players__user')

        if player_count_filter:
            casual_games = casual_games.annotate(
                num_players=Count('players')
            ).filter(num_players=player_count_filter)

        # user_id → {points, games, wins}
        user_stats = defaultdict(lambda: {'points': 0, 'games': 0, 'wins': 0})

        for game in casual_games:
            players = list(game.players.all())
            if not players:
                continue
            n = len(players)
            if player_count_filter and n != player_count_filter:
                continue

            # Sort by prestige desc, card count asc (same tiebreak as game logic)
            players.sort(key=lambda p: (-p.prestige_points, len(p.purchased_card_ids)))

            points_table = PLACEMENT_POINTS.get(n, [0] * n)
            for placement, gp in enumerate(players, start=1):
                pts = points_table[placement - 1]
                uid = gp.user_id
                user_stats[uid]['points'] += pts
                user_stats[uid]['games'] += 1
                if placement == 1:
                    user_stats[uid]['wins'] += 1

        user_ids = list(user_stats.keys())
        users_by_id = {u.id: u for u in User.objects.filter(id__in=user_ids)}

        entries = []
        for uid, stats in user_stats.items():
            user = users_by_id.get(uid)
            if not user:
                continue
            games = stats['games']
            wins = stats['wins']
            win_rate = round(100 * wins / games, 1) if games else 0.0
            entries.append({
                'user_id': uid,
                'username': user.username,
                'points': stats['points'],
                'games': games,
                'wins': wins,
                'win_rate': win_rate,
            })

        # Sort: most points first, then best win_rate
        entries.sort(key=lambda e: (-e['points'], -e['win_rate']))

        entries = entries[:50]
        for rank, entry in enumerate(entries, start=1):
            entry['rank'] = rank
            del entry['user_id']

        return Response({
            'entries': entries,
            'total': len(entries),
            'player_count': player_count_filter,
        })


