from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Season, Player, Match, MatchPlayer, LeaderboardCache


class SeasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Season
        fields = ['id', 'name', 'start_date', 'end_date', 'is_active']


class PlayerSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    win_rate = serializers.FloatField(read_only=True)
    points_to_next_division = serializers.SerializerMethodField()
    next_division = serializers.SerializerMethodField()
    
    class Meta:
        model = Player
        fields = [
            'id', 'username', 'rating', 'division', 'ranked_games_played',
            'ranked_wins', 'ranked_losses', 'win_rate', 'peak_rating',
            'is_premium', 'points_to_next_division', 'next_division',
            'created_at'
        ]
    
    def get_points_to_next_division(self, obj):
        from .elo import get_rating_to_next_division
        _, points = get_rating_to_next_division(obj.rating)
        return points
    
    def get_next_division(self, obj):
        from .elo import get_rating_to_next_division
        division, _ = get_rating_to_next_division(obj.rating)
        return division


class PlayerPublicSerializer(serializers.ModelSerializer):
    """Public player info (for opponents, leaderboards)."""
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Player
        fields = ['id', 'username', 'rating', 'division', 'ranked_games_played', 'ranked_wins']


class MatchPlayerSerializer(serializers.ModelSerializer):
    """Serializer for a player's participation in a match."""
    username = serializers.CharField(source='player.user.username', read_only=True)
    player_id = serializers.IntegerField(source='player.id', read_only=True)
    current_rating = serializers.IntegerField(source='player.rating', read_only=True)
    division = serializers.CharField(source='player.division', read_only=True)
    rating_after = serializers.IntegerField(read_only=True)
    division_before = serializers.SerializerMethodField()
    division_after = serializers.SerializerMethodField()
    
    class Meta:
        model = MatchPlayer
        fields = [
            'player_id', 'username', 'placement', 'rating_before', 
            'rating_change', 'rating_after', 'division', 
            'division_before', 'division_after', 'current_rating'
        ]
    
    def _get_division_for_rating(self, rating):
        from .elo import get_division_for_rating
        return get_division_for_rating(rating)
    
    def get_division_before(self, obj):
        return self._get_division_for_rating(obj.rating_before)
    
    def get_division_after(self, obj):
        return self._get_division_for_rating(obj.rating_after)


class MatchSerializer(serializers.ModelSerializer):
    """Serializer for multiplayer matches."""
    players = MatchPlayerSerializer(source='match_players', many=True, read_only=True)
    winner_username = serializers.SerializerMethodField()
    game_code = serializers.CharField(source='game.code', read_only=True)
    
    # Legacy 2-player compatibility fields
    player1 = PlayerPublicSerializer(read_only=True)
    player2 = PlayerPublicSerializer(read_only=True)
    player1_username = serializers.SerializerMethodField()
    player2_username = serializers.SerializerMethodField()
    player1_rating_before = serializers.SerializerMethodField()
    player2_rating_before = serializers.SerializerMethodField()
    player1_rating_after = serializers.SerializerMethodField()
    player2_rating_after = serializers.SerializerMethodField()
    player1_division_before = serializers.SerializerMethodField()
    player2_division_before = serializers.SerializerMethodField()
    player1_division_after = serializers.SerializerMethodField()
    player2_division_after = serializers.SerializerMethodField()
    rating_change_p1 = serializers.SerializerMethodField()
    rating_change_p2 = serializers.SerializerMethodField()
    
    class Meta:
        model = Match
        fields = [
            'id', 'player_count', 'players', 'winner_username', 'game_code',
            'is_ranked', 'created_at', 'finished_at',
            # Legacy fields for 2-player compatibility
            'player1', 'player2', 'player1_username', 'player2_username',
            'player1_rating_before', 'player2_rating_before',
            'player1_rating_after', 'player2_rating_after',
            'player1_division_before', 'player2_division_before',
            'player1_division_after', 'player2_division_after',
            'rating_change_p1', 'rating_change_p2',
        ]
    
    def _get_match_player(self, obj, index):
        """Get match player by index (0 = first, 1 = second, etc.)"""
        match_players = list(obj.match_players.order_by('id'))
        return match_players[index] if index < len(match_players) else None
    
    def _get_division_for_rating(self, rating):
        from .elo import get_division_for_rating
        return get_division_for_rating(rating)
    
    def get_winner_username(self, obj):
        return obj.winner.user.username if obj.winner else None
    
    def get_player1_username(self, obj):
        mp = self._get_match_player(obj, 0)
        return mp.player.user.username if mp else None
    
    def get_player2_username(self, obj):
        mp = self._get_match_player(obj, 1)
        return mp.player.user.username if mp else None
    
    def get_player1_rating_before(self, obj):
        mp = self._get_match_player(obj, 0)
        return mp.rating_before if mp else 0
    
    def get_player2_rating_before(self, obj):
        mp = self._get_match_player(obj, 1)
        return mp.rating_before if mp else 0
    
    def get_player1_rating_after(self, obj):
        mp = self._get_match_player(obj, 0)
        return mp.rating_after if mp else 0
    
    def get_player2_rating_after(self, obj):
        mp = self._get_match_player(obj, 1)
        return mp.rating_after if mp else 0
    
    def get_player1_division_before(self, obj):
        mp = self._get_match_player(obj, 0)
        return self._get_division_for_rating(mp.rating_before) if mp else None
    
    def get_player2_division_before(self, obj):
        mp = self._get_match_player(obj, 1)
        return self._get_division_for_rating(mp.rating_before) if mp else None
    
    def get_player1_division_after(self, obj):
        mp = self._get_match_player(obj, 0)
        return self._get_division_for_rating(mp.rating_after) if mp else None
    
    def get_player2_division_after(self, obj):
        mp = self._get_match_player(obj, 1)
        return self._get_division_for_rating(mp.rating_after) if mp else None
    
    def get_rating_change_p1(self, obj):
        mp = self._get_match_player(obj, 0)
        return mp.rating_change if mp else 0
    
    def get_rating_change_p2(self, obj):
        mp = self._get_match_player(obj, 1)
        return mp.rating_change if mp else 0


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='player.user.username', read_only=True)
    player_id = serializers.IntegerField(source='player.id', read_only=True)
    
    class Meta:
        model = LeaderboardCache
        fields = [
            'rank', 'player_id', 'username', 'rating', 'division',
            'games_played', 'wins', 'losses'
        ]


class MatchmakingStatusSerializer(serializers.Serializer):
    in_queue = serializers.BooleanField()
    wait_time_seconds = serializers.IntegerField(required=False)
    search_range = serializers.IntegerField(required=False)
    rating = serializers.IntegerField(required=False)
    player_count = serializers.IntegerField(required=False)
