from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Season(models.Model):
    """Competitive seasons for ranked play."""
    name = models.CharField(max_length=100)  # e.g., "Season 1"
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.name} ({'Active' if self.is_active else 'Inactive'})"

    @classmethod
    def get_current_season(cls):
        """Get the currently active season."""
        return cls.objects.filter(is_active=True).first()

    def save(self, *args, **kwargs):
        # Ensure only one season is active at a time
        if self.is_active:
            Season.objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)


class Player(models.Model):
    """Player profile for competitive play."""
    DIVISION_BRONZE = 'Bronze'
    DIVISION_SILVER = 'Silver'
    DIVISION_GOLD = 'Gold'
    DIVISION_PLATINUM = 'Platinum'
    DIVISION_DIAMOND = 'Diamond'
    DIVISION_MASTER = 'Master'
    DIVISION_GRANDMASTER = 'Grandmaster'
    
    DIVISION_CHOICES = [
        (DIVISION_BRONZE, 'Bronze'),
        (DIVISION_SILVER, 'Silver'),
        (DIVISION_GOLD, 'Gold'),
        (DIVISION_PLATINUM, 'Platinum'),
        (DIVISION_DIAMOND, 'Diamond'),
        (DIVISION_MASTER, 'Master'),
        (DIVISION_GRANDMASTER, 'Grandmaster'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='player_profile')
    rating = models.IntegerField(default=1000)
    division = models.CharField(max_length=20, choices=DIVISION_CHOICES, default=DIVISION_BRONZE)
    ranked_games_played = models.IntegerField(default=0)
    ranked_wins = models.IntegerField(default=0)
    ranked_losses = models.IntegerField(default=0)
    season = models.ForeignKey(Season, on_delete=models.SET_NULL, null=True, blank=True, related_name='players')
    is_premium = models.BooleanField(default=False)
    peak_rating = models.IntegerField(default=1000)  # Highest rating achieved
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-rating']

    def __str__(self):
        return f"{self.user.username} ({self.rating} - {self.division})"

    @property
    def win_rate(self):
        """Calculate win rate as a percentage."""
        if self.ranked_games_played == 0:
            return 0.0
        return round((self.ranked_wins / self.ranked_games_played) * 100, 1)

    def update_division(self):
        """Update division based on current rating."""
        old_division = self.division
        self.division = self.calculate_division(self.rating)
        return old_division != self.division

    @staticmethod
    def calculate_division(rating):
        """Calculate division from rating."""
        if rating >= 2000:
            return Player.DIVISION_GRANDMASTER
        elif rating >= 1800:
            return Player.DIVISION_MASTER
        elif rating >= 1600:
            return Player.DIVISION_DIAMOND
        elif rating >= 1400:
            return Player.DIVISION_PLATINUM
        elif rating >= 1200:
            return Player.DIVISION_GOLD
        elif rating >= 1000:
            return Player.DIVISION_SILVER
        else:
            return Player.DIVISION_BRONZE

    def update_stats_after_match(self, won, rating_change):
        """Update player stats after a ranked match."""
        self.rating += rating_change
        self.ranked_games_played += 1
        
        if won:
            self.ranked_wins += 1
        else:
            self.ranked_losses += 1
        
        # Track peak rating
        if self.rating > self.peak_rating:
            self.peak_rating = self.rating
        
        # Update division
        self.update_division()
        self.save()


class Match(models.Model):
    """Record of a competitive match."""
    player1 = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='matches_as_p1')
    player2 = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='matches_as_p2')
    winner = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True, related_name='won_matches')
    game = models.ForeignKey('game.Game', on_delete=models.SET_NULL, null=True, blank=True, related_name='ranked_match')
    is_ranked = models.BooleanField(default=True)
    rating_change_p1 = models.IntegerField(default=0)
    rating_change_p2 = models.IntegerField(default=0)
    p1_rating_before = models.IntegerField(default=0)  # Track rating at match time
    p2_rating_before = models.IntegerField(default=0)
    season = models.ForeignKey(Season, on_delete=models.SET_NULL, null=True, blank=True, related_name='matches')
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Matches'

    def __str__(self):
        return f"{self.player1.user.username} vs {self.player2.user.username}"

    def finalize(self, winner_player):
        """Finalize the match with results and calculate rating changes."""
        from .elo import calculate_elo_change
        
        self.winner = winner_player
        self.finished_at = timezone.now()
        
        if self.is_ranked:
            # Store ratings before change
            self.p1_rating_before = self.player1.rating
            self.p2_rating_before = self.player2.rating
            
            # Calculate ELO changes
            p1_won = winner_player == self.player1
            self.rating_change_p1, self.rating_change_p2 = calculate_elo_change(
                self.player1.rating,
                self.player2.rating,
                p1_won
            )
            
            # Update player stats
            self.player1.update_stats_after_match(p1_won, self.rating_change_p1)
            self.player2.update_stats_after_match(not p1_won, self.rating_change_p2)
        
        self.save()


class LeaderboardCache(models.Model):
    """Cached leaderboard snapshot for performance."""
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='leaderboard_entries')
    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name='leaderboard_entries')
    rank = models.IntegerField()
    rating = models.IntegerField()
    division = models.CharField(max_length=20)
    games_played = models.IntegerField()
    wins = models.IntegerField()
    losses = models.IntegerField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['rank']
        unique_together = ['player', 'season']
        verbose_name_plural = 'Leaderboard cache entries'

    def __str__(self):
        return f"#{self.rank} - {self.player.user.username} ({self.rating})"

    @classmethod
    def refresh_leaderboard(cls, season=None):
        """Refresh the leaderboard cache for a season."""
        if season is None:
            season = Season.get_current_season()
        
        if not season:
            return
        
        # Get all players in this season, ordered by rating
        players = Player.objects.filter(
            season=season,
            ranked_games_played__gt=0  # Only include players who have played
        ).order_by('-rating', '-ranked_wins')
        
        # Clear old cache for this season
        cls.objects.filter(season=season).delete()
        
        # Create new cache entries
        entries = []
        for rank, player in enumerate(players, start=1):
            entries.append(cls(
                player=player,
                season=season,
                rank=rank,
                rating=player.rating,
                division=player.division,
                games_played=player.ranked_games_played,
                wins=player.ranked_wins,
                losses=player.ranked_losses,
            ))
        
        cls.objects.bulk_create(entries)


class MatchmakingQueue(models.Model):
    """Queue for players waiting for ranked matches."""
    player = models.OneToOneField(Player, on_delete=models.CASCADE, related_name='queue_entry')
    rating_at_queue = models.IntegerField()  # Rating when joined queue
    search_range = models.IntegerField(default=50)  # Current search range
    joined_at = models.DateTimeField(auto_now_add=True)
    last_expanded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.player.user.username} in queue (±{self.search_range})"

    def expand_search_range(self, max_range=500):
        """Expand the search range for finding opponents."""
        if self.search_range < max_range:
            self.search_range = min(self.search_range + 50, max_range)
            self.last_expanded_at = timezone.now()
            self.save()

    def find_opponent(self):
        """Find a suitable opponent in the queue."""
        # Look for players within rating range
        min_rating = self.rating_at_queue - self.search_range
        max_rating = self.rating_at_queue + self.search_range
        
        potential_opponents = MatchmakingQueue.objects.filter(
            rating_at_queue__gte=min_rating,
            rating_at_queue__lte=max_rating
        ).exclude(player=self.player).order_by('joined_at')
        
        # Find opponent whose range also includes us
        for opponent_entry in potential_opponents:
            opponent_min = opponent_entry.rating_at_queue - opponent_entry.search_range
            opponent_max = opponent_entry.rating_at_queue + opponent_entry.search_range
            
            if opponent_min <= self.rating_at_queue <= opponent_max:
                return opponent_entry
        
        return None
