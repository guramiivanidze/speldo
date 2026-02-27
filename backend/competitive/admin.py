from django.contrib import admin
from .models import Season, Player, Match, MatchPlayer, LeaderboardCache, MatchmakingQueue


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


class MatchPlayerInline(admin.TabularInline):
    model = MatchPlayer
    extra = 0
    readonly_fields = ['player', 'placement', 'rating_before', 'rating_change']
    can_delete = False


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['id', 'player_count', 'get_players', 'winner', 'is_ranked', 'created_at']
    list_filter = ['is_ranked', 'player_count', 'season', 'created_at']
    search_fields = ['match_players__player__user__username']
    ordering = ['-created_at']
    readonly_fields = ['finished_at']
    inlines = [MatchPlayerInline]
    
    def get_players(self, obj):
        players = obj.match_players.all()
        return ', '.join([mp.player.user.username for mp in players])
    get_players.short_description = 'Players'


@admin.register(MatchPlayer)
class MatchPlayerAdmin(admin.ModelAdmin):
    list_display = ['match', 'player', 'placement', 'rating_before', 'rating_change']
    list_filter = ['placement']
    search_fields = ['player__user__username']


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
    list_display = ['player', 'rating_at_queue', 'player_count_preference', 'search_range', 'joined_at']
    list_filter = ['player_count_preference']
    ordering = ['joined_at']
