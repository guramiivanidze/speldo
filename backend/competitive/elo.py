"""
ELO Rating System Implementation

Based on the standard ELO rating system used in chess and many competitive games.
Similar to systems used in Chess.com, Valorant, etc.
"""


def calculate_expected_score(player_rating: int, opponent_rating: int) -> float:
    """
    Calculate the expected score for a player.
    
    Formula: E = 1 / (1 + 10^((OpponentRating - PlayerRating) / 400))
    
    Returns a value between 0 and 1 representing the probability of winning.
    """
    return 1.0 / (1.0 + 10 ** ((opponent_rating - player_rating) / 400.0))


def calculate_new_rating(
    current_rating: int,
    opponent_rating: int,
    won: bool,
    k_factor: int = 32
) -> int:
    """
    Calculate the new rating after a match.
    
    Formula: NewRating = OldRating + K * (ActualScore - ExpectedScore)
    
    Args:
        current_rating: Player's current rating
        opponent_rating: Opponent's rating
        won: Whether the player won
        k_factor: K-factor determines how much ratings change (default: 32)
    
    Returns:
        The new rating (rounded to integer)
    """
    expected = calculate_expected_score(current_rating, opponent_rating)
    actual = 1.0 if won else 0.0
    
    new_rating = current_rating + k_factor * (actual - expected)
    return round(new_rating)


def calculate_elo_change(
    player1_rating: int,
    player2_rating: int,
    player1_won: bool,
    k_factor: int = 32
) -> tuple[int, int]:
    """
    Calculate rating changes for both players after a match.
    
    Args:
        player1_rating: Player 1's current rating
        player2_rating: Player 2's current rating
        player1_won: Whether player 1 won
        k_factor: K-factor (default: 32)
    
    Returns:
        Tuple of (player1_change, player2_change)
    """
    p1_expected = calculate_expected_score(player1_rating, player2_rating)
    p2_expected = calculate_expected_score(player2_rating, player1_rating)
    
    p1_actual = 1.0 if player1_won else 0.0
    p2_actual = 1.0 - p1_actual
    
    p1_change = round(k_factor * (p1_actual - p1_expected))
    p2_change = round(k_factor * (p2_actual - p2_expected))
    
    return p1_change, p2_change


def get_k_factor(games_played: int, rating: int) -> int:
    """
    Get dynamic K-factor based on player experience and rating.
    
    Higher K-factor for new players allows faster adjustment.
    Lower K-factor for experienced players provides stability.
    
    Args:
        games_played: Number of ranked games played
        rating: Current rating
    
    Returns:
        K-factor value
    """
    # New players (< 30 games): Higher K-factor for faster placement
    if games_played < 30:
        return 40
    
    # High-rated players (2000+): Lower K-factor for stability
    if rating >= 2000:
        return 16
    
    # Standard players: Default K-factor
    return 32


def calculate_elo_change_dynamic(
    player1_rating: int,
    player2_rating: int,
    player1_won: bool,
    player1_games: int,
    player2_games: int
) -> tuple[int, int]:
    """
    Calculate rating changes with dynamic K-factors.
    
    Each player may have a different K-factor based on their experience.
    """
    k1 = get_k_factor(player1_games, player1_rating)
    k2 = get_k_factor(player2_games, player2_rating)
    
    p1_expected = calculate_expected_score(player1_rating, player2_rating)
    p2_expected = calculate_expected_score(player2_rating, player1_rating)
    
    p1_actual = 1.0 if player1_won else 0.0
    p2_actual = 1.0 - p1_actual
    
    p1_change = round(k1 * (p1_actual - p1_expected))
    p2_change = round(k2 * (p2_actual - p2_expected))
    
    return p1_change, p2_change


# Division thresholds (for reference)
DIVISION_THRESHOLDS = {
    'Grandmaster': 2000,
    'Master': 1800,
    'Diamond': 1600,
    'Platinum': 1400,
    'Gold': 1200,
    'Silver': 1000,
    'Bronze': 0,
}


def get_division(rating: int) -> str:
    """Get division name for a given rating."""
    for division, threshold in DIVISION_THRESHOLDS.items():
        if rating >= threshold:
            return division
    return 'Bronze'


# Alias for serializer use
def get_division_for_rating(rating: int) -> str:
    """Get division name for a given rating (alias)."""
    return get_division(rating)


def calculate_multiplayer_elo_changes(placements: list, k_factor: int = 32) -> list[int]:
    """
    Calculate ELO changes for a multiplayer match (2-4 players).
    
    Uses a placement-based scoring system:
    - 2 players: 1st = 1.0, 2nd = 0.0
    - 3 players: 1st = 1.0, 2nd = 0.5, 3rd = 0.0
    - 4 players: 1st = 1.0, 2nd = 0.67, 3rd = 0.33, 4th = 0.0
    
    Each player's expected score is calculated against all opponents,
    then averaged.
    
    Args:
        placements: List of Player objects ordered by placement (1st, 2nd, 3rd, 4th)
        k_factor: K-factor (default: 32)
    
    Returns:
        List of rating changes in the same order as placements
    """
    n = len(placements)
    if n < 2 or n > 4:
        raise ValueError("Placements must contain 2-4 players")
    
    # Get ratings
    ratings = [p.rating for p in placements]
    
    # Calculate actual scores based on placement
    # Score is normalized so total = n (averaging effect)
    if n == 2:
        actual_scores = [1.0, 0.0]
    elif n == 3:
        actual_scores = [1.0, 0.5, 0.0]
    else:  # n == 4
        actual_scores = [1.0, 0.67, 0.33, 0.0]
    
    rating_changes = []
    
    for i, player in enumerate(placements):
        # Calculate expected score against each opponent, then average
        expected_total = 0.0
        for j, opponent in enumerate(placements):
            if i != j:
                expected_total += calculate_expected_score(ratings[i], ratings[j])
        
        # Average expected score (normalized to 0-1 scale)
        expected_avg = expected_total / (n - 1)
        
        # Calculate rating change
        change = round(k_factor * (actual_scores[i] - expected_avg))
        rating_changes.append(change)
    
    return rating_changes


def get_rating_to_next_division(rating: int) -> tuple[str, int]:
    """
    Get the next division and points needed to reach it.
    
    Returns:
        Tuple of (next_division, points_needed) or (None, 0) if at max
    """
    current_division = get_division(rating)
    
    # Find next division
    divisions = list(DIVISION_THRESHOLDS.items())
    for i, (division, threshold) in enumerate(divisions):
        if division == current_division:
            if i == 0:
                # Already at Grandmaster
                return None, 0
            next_division = divisions[i - 1][0]
            next_threshold = divisions[i - 1][1]
            return next_division, next_threshold - rating
    
    return None, 0
