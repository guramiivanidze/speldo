# Splendor Online — Workspace Instructions

## Project Overview

Real-time multiplayer implementation of the **Splendor** board game with competitive ranked play, WebSocket synchronization, and comprehensive user management. Deployed on Render.

## Architecture

```
backend/          → Django 5 + Channels (Daphne ASGI server)
frontend/         → Next.js 16 + React 19 + Tailwind CSS 4
```

### Backend Apps

| App | Responsibility |
|-----|----------------|
| `accounts/` | Auth (signed tokens), email verification, friend system, notification WebSocket |
| `game/` | Game CRUD, Splendor game logic, real-time game WebSocket, turn timer, pause system |
| `competitive/` | ELO rating, divisions, matchmaking queue, leaderboard, ranked match records |

### Frontend Structure

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router pages (`page.tsx`, `game/[code]/page.tsx`, `leaderboard/`, `profile/`) |
| `components/` | UI components; `mobile/` subdirectory for mobile-specific variants |
| `contexts/` | React Context providers: `AuthContext`, `GameHeaderContext`, `NotificationContext` |
| `hooks/` | Custom hooks: `useGameSocket`, `useGameSounds`, `useIsMobile` |
| `lib/` | API client (`api.ts`), color constants (`colors.ts`), utilities |
| `types/` | TypeScript types: `game.ts`, `competitive.ts` |

## Tech Stack

### Backend
- **Python 3.12**, Django 5.1, Django REST Framework 3.15
- **Channels 4.2** + channels_redis for WebSocket
- **Daphne** ASGI server
- **PostgreSQL** (production) / **SQLite** (development)
- **Cloudinary** for card/noble images
- **Brevo** (sib-api-v3-sdk) for transactional email

### Frontend
- **Node 20**, Next.js 16.1, React 19.2, TypeScript 5
- **Tailwind CSS 4** (utility-first, dark theme default)
- **React Compiler** enabled (automatic memoization)
- **Geist** font via next/font

## Build & Run

### Backend
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver          # HTTP only
# or
daphne -b 0.0.0.0 -p 8000 splendor.asgi:application  # HTTP + WebSocket
```

### Frontend
```bash
cd frontend
npm install
npm run dev       # Development (localhost:3000)
npm run build     # Production build
npm run start     # Serve production build
```

### Convenience Scripts (project root)
```bash
./start_backend.sh
./start_frontend.sh
```

### Competitive System
```bash
python manage.py create_season "Season 1" --days 90 --start-now --activate
python manage.py process_matchmaking --continuous
```

## Key Conventions

### Authentication
- **REST**: Custom `SignedTokenAuthentication` (Django signing module, NOT JWT). Bearer token in `Authorization` header.
- **WebSocket**: Separate ws-token (1-hour expiry) passed as query param. Validated by `TokenAuthMiddleware`.
- Token storage: `localStorage` (remember me) or `sessionStorage`.

### Game State
- Entire game state (tokens, cards, nobles, players) stored as **JSON fields** in the `Game` model.
- Every player action → DB update → WebSocket broadcast to all players in the game group.
- All actions logged in `GameAction` for history/replay.

### WebSocket Patterns
- All consumers extend `AsyncWebsocketConsumer` with `database_sync_to_async` for DB access.
- Channel groups for broadcasting: `game_{code}`, `matchmaking_lobby_{size}`, `notifications_{user_id}`.
- Three WebSocket routes:
  - `ws/game/<game_code>/` — real-time game state
  - `ws/notifications/` — game invitations, friend events
  - `ws/matchmaking/` — queue updates, match found

### Frontend State Management
- **React Context** only (no Redux/Zustand). Three context providers nested in root layout.
- WebSocket connections managed in custom hooks with **exponential backoff reconnection** (1s → 16s).
- WS token cached for 5 minutes in `useGameSocket`.

### Styling
- Tailwind CSS utility classes everywhere. Dark theme by default.
- Token/card gradients defined in `lib/colors.ts` and applied as inline styles.
- Responsive: `useIsMobile()` hook toggles desktop vs `components/mobile/` variants.

### API Base URLs
- `NEXT_PUBLIC_API_URL` → backend HTTP (default: `http://localhost:8000`)
- `NEXT_PUBLIC_WS_URL` → backend WebSocket (default: `ws://localhost:8000`)

## Database

### Core Entities
- **User / UserProfile** — Auth, email verification
- **FriendRequest / Friendship** — Social graph
- **Game / GamePlayer / GameAction** — Game sessions and history
- **DevelopmentCard / Noble** — Card/noble definitions (admin-managed, Cloudinary images)
- **Season / Player / Match / MatchPlayer** — Competitive system
- **MatchmakingQueue / LeaderboardCache** — Queue and ranking caches

### ELO System
- Dynamic K-factor: 40 (< 30 games), 32 (standard), 16 (2000+ rating)
- Divisions: Bronze (0–999) → Silver → Gold → Platinum → Diamond → Master → Grandmaster (2000+)

## Deployment (Render)

Configured in `render.yaml`:
- **Backend**: Python 3.12, Daphne, `build.sh` runs pip install + collectstatic + migrate
- **Frontend**: Node 20, `npm run build`
- **Database**: PostgreSQL (starter plan)
- Region: Oregon

## Environment Variables

### Backend (`backend/.env`)
- `SECRET_KEY`, `DEBUG`, `DATABASE_URL`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`
- `EMAIL_VERIFICATION_ENABLED` (set `False` for local dev)

### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`

## Pitfalls & Notes

- **SQLite in dev**: No WebSocket channel layer persistence — use Redis in production.
- **CORS**: Configured for `localhost:3000` in dev; update `CORS_ALLOWED_ORIGINS` for production domains.
- **Card data**: Cards and nobles are database entries managed via Django admin + import/export. The `card_data.py` file may contain seed data.
- **Turn timer**: 40s default (30s main + 10s warning). Pause has a 5-minute timeout with player vote system.
- **Email**: Email verification can be disabled via env var for local development.
