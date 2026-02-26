"""
Ranked Matchmaking System

Handles player queue management, opponent finding, and match creation.
"""

import logging
from datetime import timedelta
from typing import Optional
from django.utils import timezone
from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Player, Season, Match, MatchmakingQueue

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
    def join_queue(cls, player: Player) -> tuple[bool, str, Optional[Match]]:
        """
        Add a player to the matchmaking queue.
        
        Returns:
            Tuple of (success, message, match_if_found)
        """
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
            search_range=cls.INITIAL_RANGE
        )
        
        logger.info(f"Player {player.user.username} joined ranked queue (rating: {player.rating})")
        
        # Try to find a match immediately
        opponent_entry = queue_entry.find_opponent()
        if opponent_entry:
            match = cls._create_match(queue_entry, opponent_entry)
            return True, "Match found!", match
        
        return True, "Added to queue. Searching for opponent...", None
    
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
            }
        except MatchmakingQueue.DoesNotExist:
            return {'in_queue': False}
    
    @classmethod
    @transaction.atomic
    def process_queue(cls) -> list[Match]:
        """
        Process the matchmaking queue to find matches.
        
        This should be called periodically (e.g., every few seconds).
        
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
        
        # Find matches
        processed_players = set()
        queue_entries = list(MatchmakingQueue.objects.all().order_by('joined_at'))
        
        for entry in queue_entries:
            if entry.player_id in processed_players:
                continue
            
            opponent_entry = entry.find_opponent()
            if opponent_entry and opponent_entry.player_id not in processed_players:
                match = cls._create_match(entry, opponent_entry)
                matches_created.append(match)
                processed_players.add(entry.player_id)
                processed_players.add(opponent_entry.player_id)
        
        return matches_created
    
    @classmethod
    def _create_match(cls, entry1: MatchmakingQueue, entry2: MatchmakingQueue) -> Match:
        """Create a match from two queue entries."""
        from game.models import Game
        import random
        import string
        
        season = Season.get_current_season()
        
        # Create the match record
        match = Match.objects.create(
            player1=entry1.player,
            player2=entry2.player,
            is_ranked=True,
            season=season,
            p1_rating_before=entry1.player.rating,
            p2_rating_before=entry2.player.rating,
        )
        
        # Create the game
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        while Game.objects.filter(code=code).exists():
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        game = Game.objects.create(
            code=code,
            status='waiting',
            max_players=2,  # Ranked is 1v1
        )
        
        # Link match to game
        match.game = game
        match.save()
        
        # Remove both players from queue
        entry1.delete()
        entry2.delete()
        
        logger.info(
            f"Match created: {entry1.player.user.username} ({entry1.rating_at_queue}) vs "
            f"{entry2.player.user.username} ({entry2.rating_at_queue}) - Game {game.code}"
        )
        
        # Notify players via WebSocket
        cls._notify_match_found(match)
        
        return match
    
    @classmethod
    def _notify_match_found(cls, match: Match):
        """Notify players that a match has been found via WebSocket."""
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        
        for player in [match.player1, match.player2]:
            try:
                async_to_sync(channel_layer.group_send)(
                    f"matchmaking_{player.user.id}",
                    {
                        'type': 'match_found',
                        'game_code': match.game.code,
                        'opponent': {
                            'username': (match.player2 if player == match.player1 else match.player1).user.username,
                            'rating': (match.player2 if player == match.player1 else match.player1).rating,
                            'division': (match.player2 if player == match.player1 else match.player1).division,
                        }
                    }
                )
            except Exception as e:
                logger.error(f"Failed to notify player {player.user.username}: {e}")


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
