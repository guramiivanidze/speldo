from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Season, Player, Match, LeaderboardCache


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


class MatchSerializer(serializers.ModelSerializer):
    player1 = PlayerPublicSerializer(read_only=True)
    player2 = PlayerPublicSerializer(read_only=True)
    winner = PlayerPublicSerializer(read_only=True)
    game_code = serializers.CharField(source='game.code', read_only=True)
    
    # Computed fields for rating display
    player1_username = serializers.SerializerMethodField()
    player2_username = serializers.SerializerMethodField()
    winner_username = serializers.SerializerMethodField()
    player1_rating_before = serializers.IntegerField(source='p1_rating_before')
    player2_rating_before = serializers.IntegerField(source='p2_rating_before')
    player1_rating_after = serializers.SerializerMethodField()
    player2_rating_after = serializers.SerializerMethodField()
    player1_division_before = serializers.SerializerMethodField()
    player2_division_before = serializers.SerializerMethodField()
    player1_division_after = serializers.SerializerMethodField()
    player2_division_after = serializers.SerializerMethodField()
    
    class Meta:
        model = Match
        fields = [
            'id', 'player1', 'player2', 'winner', 'game_code',
            'is_ranked', 'rating_change_p1', 'rating_change_p2',
            'p1_rating_before', 'p2_rating_before',
            'player1_username', 'player2_username', 'winner_username',
            'player1_rating_before', 'player2_rating_before',
            'player1_rating_after', 'player2_rating_after',
            'player1_division_before', 'player2_division_before',
            'player1_division_after', 'player2_division_after',
            'created_at', 'finished_at'
        ]
    
    def _get_division_for_rating(self, rating):
        from .elo import get_division_for_rating
        return get_division_for_rating(rating)
    
    def get_player1_username(self, obj):
        return obj.player1.user.username
    
    def get_player2_username(self, obj):
        return obj.player2.user.username
    
    def get_winner_username(self, obj):
        return obj.winner.user.username if obj.winner else None
    
    def get_player1_rating_after(self, obj):
        return obj.p1_rating_before + obj.rating_change_p1
    
    def get_player2_rating_after(self, obj):
        return obj.p2_rating_before + obj.rating_change_p2
    
    def get_player1_division_before(self, obj):
        return self._get_division_for_rating(obj.p1_rating_before)
    
    def get_player2_division_before(self, obj):
        return self._get_division_for_rating(obj.p2_rating_before)
    
    def get_player1_division_after(self, obj):
        return self._get_division_for_rating(obj.p1_rating_before + obj.rating_change_p1)
    
    def get_player2_division_after(self, obj):
        return self._get_division_for_rating(obj.p2_rating_before + obj.rating_change_p2)


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
