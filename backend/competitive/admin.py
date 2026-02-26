from django.contrib import admin
from .models import Season, Player, Match, LeaderboardCache, MatchmakingQueue


@admin.register(Season)
class SeasonAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_date', 'end_date', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name']
    ordering = ['-start_date']


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ['user', 'rating', 'division', 'ranked_games_played', 'ranked_wins', 'ranked_losses', 'is_premium', 'season']
    list_filter = ['division', 'is_premium', 'season']
    search_fields = ['user__username']
    ordering = ['-rating']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['id', 'player1', 'player2', 'winner', 'is_ranked', 'rating_change_p1', 'rating_change_p2', 'created_at']
    list_filter = ['is_ranked', 'season', 'created_at']
    search_fields = ['player1__user__username', 'player2__user__username']
    ordering = ['-created_at']
    readonly_fields = ['p1_rating_before', 'p2_rating_before', 'finished_at']


@admin.register(LeaderboardCache)
class LeaderboardCacheAdmin(admin.ModelAdmin):
    list_display = ['rank', 'player', 'rating', 'division', 'games_played', 'wins', 'losses', 'season']
    list_filter = ['division', 'season']
    search_fields = ['player__user__username']
    ordering = ['rank']
    
    actions = ['refresh_leaderboard']
    
    @admin.action(description='Refresh leaderboard cache')
    def refresh_leaderboard(self, request, queryset):
        LeaderboardCache.refresh_leaderboard()
        self.message_user(request, "Leaderboard cache refreshed.")


@admin.register(MatchmakingQueue)
class MatchmakingQueueAdmin(admin.ModelAdmin):
    list_display = ['player', 'rating_at_queue', 'search_range', 'joined_at']
    ordering = ['joined_at']
