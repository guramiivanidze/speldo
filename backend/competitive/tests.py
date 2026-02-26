from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from .models import Season, Player, Match, MatchmakingQueue, LeaderboardCache
from .elo import (
    calculate_expected_score, calculate_new_rating, calculate_elo_change,
    get_k_factor, calculate_elo_change_dynamic, get_division, get_rating_to_next_division
)
from .matchmaking import MatchmakingService, get_or_create_player


class EloCalculationTests(TestCase):
    """Tests for ELO rating calculations."""
    
    def test_expected_score_equal_ratings(self):
        """Equal ratings should give 0.5 expected score."""
        expected = calculate_expected_score(1500, 1500)
        self.assertAlmostEqual(expected, 0.5, places=4)
    
    def test_expected_score_higher_rating(self):
        """Higher rated player should have > 0.5 expected score."""
        expected = calculate_expected_score(1600, 1400)
        self.assertGreater(expected, 0.5)
        self.assertLess(expected, 1.0)
    
    def test_expected_score_lower_rating(self):
        """Lower rated player should have < 0.5 expected score."""
        expected = calculate_expected_score(1400, 1600)
        self.assertLess(expected, 0.5)
        self.assertGreater(expected, 0.0)
    
    def test_new_rating_win(self):
        """Winner should gain rating."""
        new_rating = calculate_new_rating(1500, 1500, won=True, k_factor=32)
        self.assertGreater(new_rating, 1500)
    
    def test_new_rating_loss(self):
        """Loser should lose rating."""
        new_rating = calculate_new_rating(1500, 1500, won=False, k_factor=32)
        self.assertLess(new_rating, 1500)
    
    def test_elo_change_symmetric(self):
        """Rating changes should be roughly symmetric."""
        p1_change, p2_change = calculate_elo_change(1500, 1500, player1_won=True)
        # Winner gains approximately what loser loses
        self.assertAlmostEqual(p1_change, -p2_change, delta=1)
        self.assertGreater(p1_change, 0)
        self.assertLess(p2_change, 0)
    
    def test_upset_win_bigger_gain(self):
        """Lower rated player beating higher rated should gain more."""
        # Lower rated beats higher
        p1_change_upset, _ = calculate_elo_change(1300, 1700, player1_won=True)
        # Equal rating win
        p1_change_normal, _ = calculate_elo_change(1500, 1500, player1_won=True)
        
        self.assertGreater(p1_change_upset, p1_change_normal)
    
    def test_k_factor_new_player(self):
        """New players should have higher K-factor."""
        k = get_k_factor(games_played=5, rating=1000)
        self.assertEqual(k, 40)
    
    def test_k_factor_experienced_player(self):
        """Experienced players should have standard K-factor."""
        k = get_k_factor(games_played=50, rating=1400)
        self.assertEqual(k, 32)
    
    def test_k_factor_high_rated(self):
        """High rated players should have lower K-factor."""
        k = get_k_factor(games_played=100, rating=2100)
        self.assertEqual(k, 16)


class DivisionTests(TestCase):
    """Tests for division calculations."""
    
    def test_division_bronze(self):
        self.assertEqual(get_division(800), 'Bronze')
        self.assertEqual(get_division(999), 'Bronze')
    
    def test_division_silver(self):
        self.assertEqual(get_division(1000), 'Silver')
        self.assertEqual(get_division(1199), 'Silver')
    
    def test_division_gold(self):
        self.assertEqual(get_division(1200), 'Gold')
        self.assertEqual(get_division(1399), 'Gold')
    
    def test_division_platinum(self):
        self.assertEqual(get_division(1400), 'Platinum')
    
    def test_division_diamond(self):
        self.assertEqual(get_division(1600), 'Diamond')
    
    def test_division_master(self):
        self.assertEqual(get_division(1800), 'Master')
    
    def test_division_grandmaster(self):
        self.assertEqual(get_division(2000), 'Grandmaster')
        self.assertEqual(get_division(2500), 'Grandmaster')
    
    def test_rating_to_next_division(self):
        next_div, points = get_rating_to_next_division(1150)
        self.assertEqual(next_div, 'Gold')
        self.assertEqual(points, 50)  # 1200 - 1150 = 50


class PlayerModelTests(TestCase):
    """Tests for Player model."""
    
    def setUp(self):
        self.user = User.objects.create_user(username='testplayer', password='test123')
        self.player = Player.objects.create(user=self.user)
    
    def test_default_rating(self):
        self.assertEqual(self.player.rating, 1000)
    
    def test_default_division(self):
        self.assertEqual(self.player.division, 'Bronze')
    
    def test_update_division(self):
        self.player.rating = 1600
        changed = self.player.update_division()
        self.assertTrue(changed)
        self.assertEqual(self.player.division, 'Diamond')
    
    def test_win_rate(self):
        self.player.ranked_games_played = 10
        self.player.ranked_wins = 7
        self.player.ranked_losses = 3
        self.assertEqual(self.player.win_rate, 70.0)
    
    def test_win_rate_no_games(self):
        self.assertEqual(self.player.win_rate, 0.0)
    
    def test_update_stats_after_match_win(self):
        self.player.update_stats_after_match(won=True, rating_change=16)
        self.assertEqual(self.player.rating, 1016)
        self.assertEqual(self.player.ranked_games_played, 1)
        self.assertEqual(self.player.ranked_wins, 1)
        self.assertEqual(self.player.ranked_losses, 0)
        self.assertEqual(self.player.peak_rating, 1016)
    
    def test_update_stats_after_match_loss(self):
        self.player.update_stats_after_match(won=False, rating_change=-16)
        self.assertEqual(self.player.rating, 984)
        self.assertEqual(self.player.ranked_games_played, 1)
        self.assertEqual(self.player.ranked_wins, 0)
        self.assertEqual(self.player.ranked_losses, 1)


class SeasonModelTests(TestCase):
    """Tests for Season model."""
    
    def test_get_current_season(self):
        now = timezone.now()
        season = Season.objects.create(
            name='Season 1',
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=30),
            is_active=True
        )
        current = Season.get_current_season()
        self.assertEqual(current, season)
    
    def test_only_one_active_season(self):
        now = timezone.now()
        season1 = Season.objects.create(
            name='Season 1',
            start_date=now - timedelta(days=30),
            end_date=now - timedelta(days=1),
            is_active=True
        )
        season2 = Season.objects.create(
            name='Season 2',
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=30),
            is_active=True
        )
        # Refresh from DB
        season1.refresh_from_db()
        self.assertFalse(season1.is_active)
        self.assertTrue(season2.is_active)


class MatchmakingTests(TestCase):
    """Tests for matchmaking system."""
    
    def setUp(self):
        # Create active season
        now = timezone.now()
        self.season = Season.objects.create(
            name='Test Season',
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=30),
            is_active=True
        )
        
        # Create users and players
        self.user1 = User.objects.create_user(username='player1', password='test123')
        self.user2 = User.objects.create_user(username='player2', password='test123')
        self.player1 = get_or_create_player(self.user1)
        self.player2 = get_or_create_player(self.user2)
    
    def test_can_queue_for_ranked(self):
        can_queue, reason = MatchmakingService.can_queue_for_ranked(self.player1)
        self.assertTrue(can_queue)
        self.assertEqual(reason, "OK")
    
    def test_cannot_queue_no_season(self):
        self.season.is_active = False
        self.season.save()
        can_queue, reason = MatchmakingService.can_queue_for_ranked(self.player1)
        self.assertFalse(can_queue)
        self.assertIn("No active season", reason)
    
    def test_join_queue(self):
        success, message, match = MatchmakingService.join_queue(self.player1)
        self.assertTrue(success)
        self.assertTrue(MatchmakingQueue.objects.filter(player=self.player1).exists())
    
    def test_cannot_join_queue_twice(self):
        MatchmakingService.join_queue(self.player1)
        success, message, _ = MatchmakingService.join_queue(self.player1)
        self.assertFalse(success)
        self.assertIn("already in the matchmaking queue", message)
    
    def test_leave_queue(self):
        MatchmakingService.join_queue(self.player1)
        success, message = MatchmakingService.leave_queue(self.player1)
        self.assertTrue(success)
        self.assertFalse(MatchmakingQueue.objects.filter(player=self.player1).exists())
    
    def test_find_opponent(self):
        # Both players have similar rating (1000)
        MatchmakingService.join_queue(self.player1)
        success, message, match = MatchmakingService.join_queue(self.player2)
        
        # Should find a match immediately
        self.assertTrue(success)
        self.assertIsNotNone(match)
        # Both players should be in the match (order may vary)
        players_in_match = {match.player1, match.player2}
        self.assertIn(self.player1, players_in_match)
        self.assertIn(self.player2, players_in_match)
        
        # Queue should be empty
        self.assertEqual(MatchmakingQueue.objects.count(), 0)
    
    def test_no_match_rating_too_different(self):
        # Set very different ratings
        self.player2.rating = 2000
        self.player2.save()
        
        MatchmakingService.join_queue(self.player1)
        success, message, match = MatchmakingService.join_queue(self.player2)
        
        # No immediate match
        self.assertTrue(success)
        self.assertIsNone(match)
        
        # Both still in queue
        self.assertEqual(MatchmakingQueue.objects.count(), 2)
    
    def test_search_range_expansion(self):
        entry = MatchmakingQueue.objects.create(
            player=self.player1,
            rating_at_queue=1000,
            search_range=50
        )
        entry.expand_search_range()
        entry.refresh_from_db()
        self.assertEqual(entry.search_range, 100)
    
    def test_process_queue_creates_match(self):
        # Set similar ratings
        self.player2.rating = 1050
        self.player2.save()
        
        # Add to queue
        MatchmakingQueue.objects.create(player=self.player1, rating_at_queue=1000, search_range=100)
        MatchmakingQueue.objects.create(player=self.player2, rating_at_queue=1050, search_range=100)
        
        matches = MatchmakingService.process_queue()
        self.assertEqual(len(matches), 1)


class MatchModelTests(TestCase):
    """Tests for Match model."""
    
    def setUp(self):
        now = timezone.now()
        self.season = Season.objects.create(
            name='Test Season',
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=30),
            is_active=True
        )
        
        self.user1 = User.objects.create_user(username='player1', password='test123')
        self.user2 = User.objects.create_user(username='player2', password='test123')
        self.player1 = Player.objects.create(user=self.user1, rating=1500)
        self.player2 = Player.objects.create(user=self.user2, rating=1500)
    
    def test_finalize_match(self):
        match = Match.objects.create(
            player1=self.player1,
            player2=self.player2,
            is_ranked=True,
            season=self.season
        )
        
        match.finalize(winner_player=self.player1)
        
        self.assertEqual(match.winner, self.player1)
        self.assertIsNotNone(match.finished_at)
        self.assertGreater(match.rating_change_p1, 0)
        self.assertLess(match.rating_change_p2, 0)
        
        # Player ratings should be updated
        self.player1.refresh_from_db()
        self.player2.refresh_from_db()
        self.assertGreater(self.player1.rating, 1500)
        self.assertLess(self.player2.rating, 1500)


class LeaderboardCacheTests(TestCase):
    """Tests for leaderboard caching."""
    
    def setUp(self):
        now = timezone.now()
        self.season = Season.objects.create(
            name='Test Season',
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=30),
            is_active=True
        )
    
    def test_refresh_leaderboard(self):
        # Create players with games played
        for i in range(5):
            user = User.objects.create_user(username=f'player{i}', password='test123')
            Player.objects.create(
                user=user,
                rating=1000 + (i * 100),
                ranked_games_played=10,
                ranked_wins=5,
                ranked_losses=5,
                season=self.season
            )
        
        LeaderboardCache.refresh_leaderboard(self.season)
        
        entries = LeaderboardCache.objects.filter(season=self.season)
        self.assertEqual(entries.count(), 5)
        
        # Check ordering
        self.assertEqual(entries[0].rank, 1)
        self.assertEqual(entries[0].rating, 1400)  # Highest rating
