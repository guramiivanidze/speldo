from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db.models import Q

from .models import Season, Player, Match, LeaderboardCache
from .serializers import (
    SeasonSerializer, PlayerSerializer, MatchSerializer,
    LeaderboardEntrySerializer, MatchmakingStatusSerializer
)
from .matchmaking import MatchmakingService, get_or_create_player


@api_view(['GET'])
@permission_classes([AllowAny])
def current_season(request):
    """Get the current active season."""
    season = Season.get_current_season()
    if not season:
        return Response({'detail': 'No active season.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(SeasonSerializer(season).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_profile(request):
    """Get the current user's competitive profile."""
    player = get_or_create_player(request.user)
    return Response(PlayerSerializer(player).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def player_profile(request, username):
    """Get a player's competitive profile by username."""
    try:
        player = Player.objects.select_related('user').get(user__username=username)
        return Response(PlayerSerializer(player).data)
    except Player.DoesNotExist:
        return Response({'detail': 'Player not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([AllowAny])
def leaderboard(request):
    """Get the leaderboard for the current season."""
    season = Season.get_current_season()
    if not season:
        return Response({'detail': 'No active season.'}, status=status.HTTP_404_NOT_FOUND)
    
    # Get pagination parameters
    page = int(request.query_params.get('page', 1))
    per_page = min(int(request.query_params.get('per_page', 50)), 100)
    
    # Check if cache exists and is recent
    cache_entries = LeaderboardCache.objects.filter(season=season)
    if not cache_entries.exists():
        LeaderboardCache.refresh_leaderboard(season)
        cache_entries = LeaderboardCache.objects.filter(season=season)
    
    # Paginate
    start = (page - 1) * per_page
    end = start + per_page
    entries = cache_entries[start:end]
    
    total = cache_entries.count()
    
    return Response({
        'season': SeasonSerializer(season).data,
        'total': total,
        'page': page,
        'per_page': per_page,
        'entries': LeaderboardEntrySerializer(entries, many=True).data
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def leaderboard_by_division(request, division):
    """Get leaderboard filtered by division."""
    season = Season.get_current_season()
    if not season:
        return Response({'detail': 'No active season.'}, status=status.HTTP_404_NOT_FOUND)
    
    # Validate division
    valid_divisions = [d[0] for d in Player.DIVISION_CHOICES]
    division_title = division.title()
    if division_title not in valid_divisions:
        return Response({'detail': f'Invalid division. Valid options: {valid_divisions}'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    entries = LeaderboardCache.objects.filter(season=season, division=division_title)
    return Response({
        'division': division_title,
        'entries': LeaderboardEntrySerializer(entries, many=True).data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_matchmaking(request):
    """Join the ranked matchmaking queue."""
    player = get_or_create_player(request.user)
    success, message, match = MatchmakingService.join_queue(player)
    
    response_data = {'success': success, 'message': message}
    
    if match:
        response_data['match'] = MatchSerializer(match).data
    
    return Response(response_data, status=status.HTTP_200_OK if success else status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_matchmaking(request):
    """Leave the ranked matchmaking queue."""
    player = get_or_create_player(request.user)
    success, message = MatchmakingService.leave_queue(player)
    
    return Response({'success': success, 'message': message}, 
                   status=status.HTTP_200_OK if success else status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def matchmaking_status(request):
    """Get current matchmaking queue status."""
    player = get_or_create_player(request.user)
    status_data = MatchmakingService.get_queue_status(player)
    return Response(MatchmakingStatusSerializer(status_data).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def match_history(request):
    """Get the current user's match history."""
    player = get_or_create_player(request.user)
    
    page = int(request.query_params.get('page', 1))
    per_page = min(int(request.query_params.get('per_page', 20)), 50)
    
    matches = Match.objects.filter(
        Q(player1=player) | Q(player2=player)
    ).select_related('player1__user', 'player2__user', 'winner__user', 'game')
    
    total = matches.count()
    start = (page - 1) * per_page
    end = start + per_page
    
    return Response({
        'total': total,
        'page': page,
        'per_page': per_page,
        'matches': MatchSerializer(matches[start:end], many=True).data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def match_detail(request, match_id):
    """Get details of a specific match."""
    try:
        match = Match.objects.select_related(
            'player1__user', 'player2__user', 'winner__user', 'game'
        ).get(id=match_id)
        return Response(MatchSerializer(match).data)
    except Match.DoesNotExist:
        return Response({'detail': 'Match not found.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([AllowAny])
def match_by_game(request, game_id):
    """Get match result by game ID (for showing rating changes after ranked games)."""
    try:
        match = Match.objects.select_related(
            'player1__user', 'player2__user', 'winner__user', 'game'
        ).get(game_id=game_id)
        return Response(MatchSerializer(match).data)
    except Match.DoesNotExist:
        return Response({'detail': 'No ranked match found for this game.'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([AllowAny])
def division_info(request):
    """Get information about all divisions and their rating thresholds."""
    from .elo import DIVISION_THRESHOLDS
    
    divisions = []
    sorted_divisions = sorted(DIVISION_THRESHOLDS.items(), key=lambda x: x[1], reverse=True)
    
    for division, min_rating in sorted_divisions:
        # Find max rating (next division's min - 1)
        idx = sorted_divisions.index((division, min_rating))
        max_rating = None if idx == 0 else sorted_divisions[idx - 1][1] - 1
        
        divisions.append({
            'name': division,
            'min_rating': min_rating,
            'max_rating': max_rating,
        })
    
    return Response({'divisions': divisions})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_matchmaking_queue(request):
    """
    Manually trigger queue processing (admin only).
    In production, this would be a scheduled task.
    """
    if not request.user.is_staff:
        return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
    
    matches = MatchmakingService.process_queue()
    return Response({
        'matches_created': len(matches),
        'matches': MatchSerializer(matches, many=True).data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refresh_leaderboard_cache(request):
    """Manually refresh leaderboard cache (admin only)."""
    if not request.user.is_staff:
        return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
    
    LeaderboardCache.refresh_leaderboard()
    return Response({'success': True, 'message': 'Leaderboard cache refreshed.'})
