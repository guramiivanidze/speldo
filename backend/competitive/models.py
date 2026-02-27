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
    """Record of a competitive match (supports 2-4 players)."""
    game = models.ForeignKey('game.Game', on_delete=models.SET_NULL, null=True, blank=True, related_name='ranked_match')
    player_count = models.IntegerField(default=2)  # 2, 3, or 4 players
    winner = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True, related_name='won_matches')
    is_ranked = models.BooleanField(default=True)
    season = models.ForeignKey(Season, on_delete=models.SET_NULL, null=True, blank=True, related_name='matches')
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Matches'

    def __str__(self):
        players = self.match_players.all()
        names = [mp.player.user.username for mp in players]
        return ' vs '.join(names) if names else f'Match #{self.id}'

    def get_players(self):
        """Get all players in this match."""
        return [mp.player for mp in self.match_players.select_related('player__user').all()]

    def get_match_player(self, player):
        """Get the MatchPlayer entry for a specific player."""
        return self.match_players.filter(player=player).first()

    def finalize(self, placements):
        """
        Finalize the match with results and calculate rating changes.
        
        Args:
            placements: List of Player objects ordered by placement (1st, 2nd, 3rd, 4th)
        """
        from .elo import calculate_multiplayer_elo_changes
        
        self.finished_at = timezone.now()
        
        if placements:
            self.winner = placements[0]  # 1st place is the winner
        
        if self.is_ranked and placements:
            # Get all match players
            match_players = {mp.player.id: mp for mp in self.match_players.all()}
            
            # Store ratings before change
            ratings_before = {p.id: p.rating for p in placements}
            for mp in match_players.values():
                mp.rating_before = mp.player.rating
            
            # Calculate ELO changes based on placements
            rating_changes = calculate_multiplayer_elo_changes(placements)
            
            # Update each player
            for i, player in enumerate(placements):
                mp = match_players[player.id]
                mp.placement = i + 1
                mp.rating_change = rating_changes[i]
                mp.save()
                
                # Win = 1st place, Loss = not 1st place
                won = (i == 0)
                player.update_stats_after_match(won, rating_changes[i])
        
        self.save()

    # Legacy compatibility properties for 2-player matches
    @property
    def player1(self):
        mp = self.match_players.order_by('id').first()
        return mp.player if mp else None
    
    @property
    def player2(self):
        mp = self.match_players.order_by('id')[1:2].first()
        return mp.player if mp else None
    
    @property
    def rating_change_p1(self):
        mp = self.match_players.order_by('id').first()
        return mp.rating_change if mp else 0
    
    @property
    def rating_change_p2(self):
        mp = self.match_players.order_by('id')[1:2].first()
        return mp.rating_change if mp else 0
    
    @property
    def p1_rating_before(self):
        mp = self.match_players.order_by('id').first()
        return mp.rating_before if mp else 0
    
    @property
    def p2_rating_before(self):
        mp = self.match_players.order_by('id')[1:2].first()
        return mp.rating_before if mp else 0


class MatchPlayer(models.Model):
    """A player's participation in a match (supports multiplayer)."""
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='match_players')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='match_participations')
    placement = models.IntegerField(null=True, blank=True)  # 1 = 1st place, 2 = 2nd, etc.
    rating_before = models.IntegerField(default=0)
    rating_change = models.IntegerField(default=0)
    
    class Meta:
        unique_together = ['match', 'player']
        ordering = ['placement']
    
    def __str__(self):
        return f"{self.player.user.username} in Match #{self.match.id}"
    
    @property
    def rating_after(self):
        return self.rating_before + self.rating_change


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
    player_count_preference = models.IntegerField(default=2)  # 2, 3, or 4 players
    search_range = models.IntegerField(default=50)  # Current search range
    joined_at = models.DateTimeField(auto_now_add=True)
    last_expanded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.player.user.username} in queue ({self.player_count_preference}p, ±{self.search_range})"

    def expand_search_range(self, max_range=500):
        """Expand the search range for finding opponents."""
        if self.search_range < max_range:
            self.search_range = min(self.search_range + 50, max_range)
            self.last_expanded_at = timezone.now()
            self.save()

    def find_opponents(self):
        """Find suitable opponents in the queue for multiplayer match."""
        # Look for players within rating range with same player count preference
        min_rating = self.rating_at_queue - self.search_range
        max_rating = self.rating_at_queue + self.search_range
        
        potential_opponents = MatchmakingQueue.objects.filter(
            player_count_preference=self.player_count_preference,
            rating_at_queue__gte=min_rating,
            rating_at_queue__lte=max_rating
        ).exclude(player=self.player).order_by('joined_at')
        
        # Find opponents whose range also includes us
        valid_opponents = []
        for opponent_entry in potential_opponents:
            opponent_min = opponent_entry.rating_at_queue - opponent_entry.search_range
            opponent_max = opponent_entry.rating_at_queue + opponent_entry.search_range
            
            if opponent_min <= self.rating_at_queue <= opponent_max:
                valid_opponents.append(opponent_entry)
                if len(valid_opponents) >= self.player_count_preference - 1:
                    break  # Found enough opponents
        
        # Return opponents only if we have enough for the match
        if len(valid_opponents) >= self.player_count_preference - 1:
            return valid_opponents[:self.player_count_preference - 1]
        
        return []
    
    # Legacy compatibility
    def find_opponent(self):
        """Find a single opponent (for 2-player matches)."""
        opponents = self.find_opponents()
        return opponents[0] if opponents else None
