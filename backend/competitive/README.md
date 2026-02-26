# Competitive System Guide

A complete ranked matchmaking and ELO rating system for Splendor.

## Table of Contents
- [Quick Start](#quick-start)
- [Database Models](#database-models)
- [ELO Rating System](#elo-rating-system)
- [Divisions](#divisions)
- [Matchmaking](#matchmaking)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Management Commands](#management-commands)
- [Integration Guide](#integration-guide)

---

## Quick Start

### 1. Create a Season
```bash
python manage.py create_season "Season 1" --days 90 --start-now --activate
```

### 2. Start Matchmaking Processor
```bash
python manage.py process_matchmaking --continuous
```

### 3. Players Can Now Queue
Players join the ranked queue via API or WebSocket, get matched, and play!

---

## Database Models

### Season
Competitive seasons control when ranked play is available.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Season name (e.g., "Season 1") |
| `start_date` | datetime | When the season begins |
| `end_date` | datetime | When the season ends |
| `is_active` | boolean | Only one season can be active |

### Player
Extended user profile for competitive play.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `user` | FK(User) | - | Django user reference |
| `rating` | int | 1000 | ELO rating |
| `division` | string | Bronze | Current division |
| `ranked_games_played` | int | 0 | Total ranked games |
| `ranked_wins` | int | 0 | Total wins |
| `ranked_losses` | int | 0 | Total losses |
| `peak_rating` | int | 1000 | Highest rating achieved |
| `is_premium` | bool | False | Premium subscription status |
| `season` | FK(Season) | - | Current season |

### Match
Record of a competitive match.

| Field | Type | Description |
|-------|------|-------------|
| `player1` | FK(Player) | First player |
| `player2` | FK(Player) | Second player |
| `winner` | FK(Player) | Match winner |
| `game` | FK(Game) | Associated game |
| `is_ranked` | bool | Whether match affects rating |
| `rating_change_p1` | int | Rating change for player 1 |
| `rating_change_p2` | int | Rating change for player 2 |
| `p1_rating_before` | int | P1's rating before match |
| `p2_rating_before` | int | P2's rating before match |
| `season` | FK(Season) | Season this match belongs to |

### LeaderboardCache
Precomputed ranking for fast leaderboard queries.

| Field | Type | Description |
|-------|------|-------------|
| `player` | FK(Player) | Player reference |
| `season` | FK(Season) | Season reference |
| `rank` | int | Leaderboard position |
| `rating` | int | Cached rating |
| `division` | string | Cached division |
| `games_played` | int | Cached games count |
| `wins` | int | Cached wins |
| `losses` | int | Cached losses |

---

## ELO Rating System

### Formula

**Expected Score:**
```
E = 1 / (1 + 10^((OpponentRating - PlayerRating) / 400))
```

**New Rating:**
```
NewRating = OldRating + K × (ActualScore - ExpectedScore)
```

Where:
- Win = 1.0
- Loss = 0.0

### K-Factor (Rating Volatility)

| Condition | K-Factor | Purpose |
|-----------|----------|---------|
| Games < 30 | 40 | Faster placement for new players |
| Rating ≥ 2000 | 16 | Stability for top players |
| Default | 32 | Standard volatility |

### Example Calculations

**Equal Rating Match (1500 vs 1500):**
- Expected score: 0.5 for both
- Winner gains: +16 points
- Loser loses: -16 points

**Upset Win (1300 beats 1700):**
- Lower player expected: ~0.09
- Winner gains: ~+29 points
- Loser loses: ~-29 points

**Favored Win (1700 beats 1300):**
- Higher player expected: ~0.91
- Winner gains: ~+3 points
- Loser loses: ~-3 points

---

## Divisions

| Division | Rating Range | Icon Suggestion |
|----------|--------------|-----------------|
| Grandmaster | 2000+ | 🏆 |
| Master | 1800 - 1999 | 💎 |
| Diamond | 1600 - 1799 | 💠 |
| Platinum | 1400 - 1599 | 🥈 |
| Gold | 1200 - 1399 | 🥇 |
| Silver | 1000 - 1199 | ⚪ |
| Bronze | 0 - 999 | 🥉 |

Division is automatically updated after each match based on new rating.

---

## Matchmaking

### How It Works

1. **Player joins queue** → Added to `MatchmakingQueue` with current rating
2. **Search for opponent** → Look for players within rating range
3. **Range expansion** → Every 10 seconds, expand search by ±50 (max ±500)
4. **Match found** → Create `Match` + `Game`, notify both players via WebSocket
5. **Queue cleanup** → Remove both players from queue

### Rating Range Logic

```
Initial: ±50 rating
After 10s: ±100
After 20s: ±150
After 30s: ±200
...
Maximum: ±500
```

### Queue Entry Requirements

- Active season must exist
- Player not already in queue
- Player not in an active ranked game
- (Optional) Premium subscription check

---

## API Reference

### Season

#### Get Current Season
```
GET /api/competitive/season/
```
Response:
```json
{
  "id": 1,
  "name": "Season 1",
  "start_date": "2026-02-01T00:00:00Z",
  "end_date": "2026-05-01T00:00:00Z",
  "is_active": true
}
```

### Player Profile

#### Get My Profile
```
GET /api/competitive/profile/
Authorization: Token <token>
```
Response:
```json
{
  "id": 1,
  "username": "player1",
  "rating": 1250,
  "division": "Gold",
  "ranked_games_played": 25,
  "ranked_wins": 15,
  "ranked_losses": 10,
  "win_rate": 60.0,
  "peak_rating": 1280,
  "is_premium": false,
  "points_to_next_division": 150,
  "next_division": "Platinum"
}
```

#### Get Player Profile
```
GET /api/competitive/profile/<username>/
```

### Leaderboard

#### Get Leaderboard
```
GET /api/competitive/leaderboard/?page=1&per_page=50
```
Response:
```json
{
  "season": {...},
  "total": 500,
  "page": 1,
  "per_page": 50,
  "entries": [
    {
      "rank": 1,
      "player_id": 42,
      "username": "champion",
      "rating": 2150,
      "division": "Grandmaster",
      "games_played": 100,
      "wins": 75,
      "losses": 25
    }
  ]
}
```

#### Get Leaderboard by Division
```
GET /api/competitive/leaderboard/diamond/
```

### Matchmaking

#### Join Queue
```
POST /api/competitive/matchmaking/join/
Authorization: Token <token>
```
Response (queued):
```json
{
  "success": true,
  "message": "Added to queue. Searching for opponent..."
}
```
Response (match found immediately):
```json
{
  "success": true,
  "message": "Match found!",
  "match": {
    "id": 1,
    "player1": {...},
    "player2": {...},
    "game_code": "ABC123"
  }
}
```

#### Leave Queue
```
POST /api/competitive/matchmaking/leave/
Authorization: Token <token>
```

#### Get Queue Status
```
GET /api/competitive/matchmaking/status/
Authorization: Token <token>
```
Response:
```json
{
  "in_queue": true,
  "wait_time_seconds": 45,
  "search_range": 100,
  "rating": 1250
}
```

### Match History

#### Get My Matches
```
GET /api/competitive/matches/?page=1&per_page=20
Authorization: Token <token>
```

#### Get Match Details
```
GET /api/competitive/matches/<match_id>/
```

### Info

#### Get Division Info
```
GET /api/competitive/divisions/
```
Response:
```json
{
  "divisions": [
    {"name": "Grandmaster", "min_rating": 2000, "max_rating": null},
    {"name": "Master", "min_rating": 1800, "max_rating": 1999},
    {"name": "Diamond", "min_rating": 1600, "max_rating": 1799},
    ...
  ]
}
```

---

## WebSocket Events

### Connect
```
ws://localhost:8000/ws/matchmaking/
```

### Client → Server Messages

#### Join Queue
```json
{"action": "join_queue"}
```

#### Leave Queue
```json
{"action": "leave_queue"}
```

#### Get Status
```json
{"action": "get_status"}
```

### Server → Client Messages

#### Queue Status
```json
{
  "type": "queue_status",
  "in_queue": true,
  "wait_time_seconds": 30,
  "search_range": 100
}
```

#### Match Found
```json
{
  "type": "match_found",
  "game_code": "ABC123",
  "opponent": {
    "username": "rival",
    "rating": 1280,
    "division": "Gold"
  }
}
```

#### Queue Update
```json
{
  "type": "queue_update",
  "wait_time_seconds": 45,
  "search_range": 150,
  "players_in_queue": 12
}
```

---

## Management Commands

### Create Season
```bash
# Create a new season
python manage.py create_season "Season 1" --days 90 --start-now --activate

# Options:
#   --days N        Duration in days (default: 90)
#   --start-now     Start immediately (default: start tomorrow)
#   --activate      Make this the active season
```

### Process Matchmaking
```bash
# Run once
python manage.py process_matchmaking

# Run continuously (for development/small scale)
python manage.py process_matchmaking --continuous --interval 5
```

For production, use Celery Beat or a cron job to call `process_matchmaking` every few seconds.

---

## Integration Guide

### Finalizing a Ranked Match

When a game finishes, call `match.finalize()`:

```python
from competitive.models import Match

# When game ends
match = Match.objects.get(game=game)
winner_player = match.player1 if game.winner == match.player1.user else match.player2
match.finalize(winner_player)
```

This will:
1. Set the winner
2. Calculate ELO changes
3. Update both players' ratings
4. Update divisions if needed
5. Record the finish time

### Creating Player Profiles

Player profiles are created automatically:

```python
from competitive.matchmaking import get_or_create_player

player = get_or_create_player(user)
```

### Frontend Integration Example

```typescript
// Join ranked queue via WebSocket
const ws = new WebSocket('ws://localhost:8000/ws/matchmaking/');

ws.onopen = () => {
  ws.send(JSON.stringify({ action: 'join_queue' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'match_found') {
    // Redirect to game
    window.location.href = `/game/${data.game_code}`;
  }
  
  if (data.type === 'queue_status') {
    // Update UI with wait time, etc.
    updateQueueUI(data);
  }
};
```

### Refreshing Leaderboard Cache

```python
from competitive.models import LeaderboardCache

# Refresh leaderboard (call periodically, e.g., every 5 minutes)
LeaderboardCache.refresh_leaderboard()
```

---

## Testing

Run all competitive tests:
```bash
python manage.py test competitive
```

Run specific test class:
```bash
python manage.py test competitive.tests.EloCalculationTests
```
