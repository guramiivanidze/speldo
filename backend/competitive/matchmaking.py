"""
Ranked Matchmaking System

Handles player queue management, opponent finding, and match creation.
Supports 2-4 player matches.
"""

import logging
from datetime import timedelta
from typing import Optional
from django.utils import timezone
from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Player, Season, Match, MatchPlayer, MatchmakingQueue

logger = logging.getLogger(__name__)


class MatchmakingService:
    """Service for handling ranked matchmaking."""
    
    # Search range expansion settings
    INITIAL_RANGE = 50
    EXPANSION_INTERVAL_SECONDS = 10
    EXPANSION_AMOUNT = 50
    MAX_RANGE = 500
    
    @classmethod
    def can_queue_for_ranked(cls, player: Player) -> tuple[bool, str]:
        """
        Check if a player can join the ranked queue.
        
        Returns:
            Tuple of (can_queue, reason)
        """
        # Check for active season
        season = Season.get_current_season()
        if not season:
            return False, "No active season. Ranked play is currently unavailable."
        
        # Check if season is within dates
        now = timezone.now()
        if now < season.start_date:
            return False, f"Season hasn't started yet. Starts {season.start_date}"
        if now > season.end_date:
            return False, "Current season has ended."
        
        # Check if player is already in queue
        if MatchmakingQueue.objects.filter(player=player).exists():
            return False, "You are already in the matchmaking queue."
        
        # Check if player is already in an active ranked game
        from game.models import Game
        active_game = Game.objects.filter(
            players__user=player.user,
            status__in=['waiting', 'playing'],
            ranked_match__isnull=False
        ).first()
        if active_game:
            return False, "You are already in an active ranked game."
        
        # Optional: Check premium requirement
        # Uncomment if you want ranked to be premium-only
        # if not player.is_premium:
        #     return False, "Ranked play requires a premium subscription."
        
        return True, "OK"
    
    @classmethod
    @transaction.atomic
    def join_queue(cls, player: Player, player_count: int = 2) -> tuple[bool, str, Optional[Match]]:
        """
        Add a player to the matchmaking queue.
        
        Args:
            player: The player joining the queue
            player_count: Number of players for the match (2, 3, or 4)
        
        Returns:
            Tuple of (success, message, match_if_found)
        """
        # Validate player count
        if player_count not in [2, 3, 4]:
            return False, "Player count must be 2, 3, or 4.", None
        
        can_queue, reason = cls.can_queue_for_ranked(player)
        if not can_queue:
            return False, reason, None
        
        # Ensure player is in the current season
        season = Season.get_current_season()
        if player.season != season:
            player.season = season
            player.save()
        
        # Create queue entry
        queue_entry = MatchmakingQueue.objects.create(
            player=player,
            rating_at_queue=player.rating,
            player_count_preference=player_count,
            search_range=cls.INITIAL_RANGE
        )
        
        logger.info(f"Player {player.user.username} joined ranked queue (rating: {player.rating}, {player_count}p)")
        
        # Try to find a match immediately
        opponent_entries = queue_entry.find_opponents()
        if len(opponent_entries) >= player_count - 1:
            all_entries = [queue_entry] + opponent_entries[:player_count - 1]
            match = cls._create_match(all_entries)
            return True, "Match found!", match
        
        return True, f"Added to queue. Searching for {player_count}-player match...", None
    
    @classmethod
    @transaction.atomic
    def leave_queue(cls, player: Player) -> tuple[bool, str]:
        """Remove a player from the matchmaking queue."""
        try:
            queue_entry = MatchmakingQueue.objects.get(player=player)
            queue_entry.delete()
            logger.info(f"Player {player.user.username} left ranked queue")
            return True, "Left matchmaking queue."
        except MatchmakingQueue.DoesNotExist:
            return False, "You are not in the matchmaking queue."
    
    @classmethod
    def get_queue_status(cls, player: Player) -> dict:
        """Get the current queue status for a player."""
        try:
            queue_entry = MatchmakingQueue.objects.get(player=player)
            wait_time = timezone.now() - queue_entry.joined_at
            return {
                'in_queue': True,
                'wait_time_seconds': int(wait_time.total_seconds()),
                'search_range': queue_entry.search_range,
                'rating': queue_entry.rating_at_queue,
                'player_count': queue_entry.player_count_preference,
            }
        except MatchmakingQueue.DoesNotExist:
            return {'in_queue': False}
    
    @classmethod
    @transaction.atomic
    def process_queue(cls) -> list[Match]:
        """
        Process the matchmaking queue to find matches.
        
        This should be called periodically (e.g., every few seconds).
        Supports 2-4 player matches.
        
        Returns:
            List of matches created
        """
        matches_created = []
        now = timezone.now()
        
        # Expand search ranges for players waiting too long
        waiting_entries = MatchmakingQueue.objects.filter(
            last_expanded_at__lt=now - timedelta(seconds=cls.EXPANSION_INTERVAL_SECONDS)
        )
        for entry in waiting_entries:
            entry.expand_search_range(cls.MAX_RANGE)
        
        # Find matches - process each player count preference separately
        processed_players = set()
        
        for player_count in [2, 3, 4]:
            queue_entries = list(
                MatchmakingQueue.objects.filter(
                    player_count_preference=player_count
                ).order_by('joined_at')
            )
            
            for entry in queue_entries:
                if entry.player_id in processed_players:
                    continue
                
                opponent_entries = entry.find_opponents()
                # Filter out already processed players
                opponent_entries = [e for e in opponent_entries if e.player_id not in processed_players]
                
                if len(opponent_entries) >= player_count - 1:
                    all_entries = [entry] + opponent_entries[:player_count - 1]
                    match = cls._create_match(all_entries)
                    matches_created.append(match)
                    for e in all_entries:
                        processed_players.add(e.player_id)
        
        return matches_created
    
    @classmethod
    def _create_match(cls, entries: list[MatchmakingQueue]) -> Match:
        """Create a match from queue entries (2-4 players)."""
        from game.models import Game
        import random
        import string
        
        season = Season.get_current_season()
        player_count = len(entries)
        
        # Create the match record
        match = Match.objects.create(
            player_count=player_count,
            is_ranked=True,
            season=season,
        )
        
        # Create MatchPlayer entries
        for entry in entries:
            MatchPlayer.objects.create(
                match=match,
                player=entry.player,
                rating_before=entry.player.rating,
            )
        
        # Create the game
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        while Game.objects.filter(code=code).exists():
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        game = Game.objects.create(
            code=code,
            status='waiting',
            max_players=player_count,
        )
        
        # Link match to game
        match.game = game
        match.save()
        
        # Remove all players from queue
        player_ids = [e.player_id for e in entries]
        MatchmakingQueue.objects.filter(player_id__in=player_ids).delete()
        
        player_names = ', '.join([e.player.user.username for e in entries])
        logger.info(
            f"Match created ({player_count}p): {player_names} - Game {game.code}"
        )
        
        # Notify players via WebSocket
        cls._notify_match_found(match, entries)
        
        return match
    
    @classmethod
    def _notify_match_found(cls, match: Match, entries: list[MatchmakingQueue]):
        """Notify players that a match has been found via WebSocket."""
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        
        all_players = [e.player for e in entries]
        
        for entry in entries:
            try:
                opponents = [p for p in all_players if p != entry.player]
                async_to_sync(channel_layer.group_send)(
                    f"matchmaking_{entry.player.user.id}",
                    {
                        'type': 'match_found',
                        'game_code': match.game.code,
                        'player_count': match.player_count,
                        'opponents': [
                            {
                                'username': opp.user.username,
                                'rating': opp.rating,
                                'division': opp.division,
                            }
                            for opp in opponents
                        ]
                    }
                )
            except Exception as e:
                logger.error(f"Failed to notify player {entry.player.user.username}: {e}")


def get_or_create_player(user) -> Player:
    """Get or create a player profile for a user."""
    player, created = Player.objects.get_or_create(user=user)
    
    if created:
        # Assign to current season
        season = Season.get_current_season()
        if season:
            player.season = season
            player.save()
    
    return player
