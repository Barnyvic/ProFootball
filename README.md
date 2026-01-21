# ProFootball - Real-time Football Match Center Backend

A production-ready NestJS backend API for a real-time football match center with live match data, WebSocket updates, Server-Sent Events (SSE), and chat functionality.

## Features

- **REST API** for match data retrieval
- **WebSocket** real-time updates via Socket.IO
- **SSE streaming** for match events
- **Chat rooms** with rate limiting and typing indicators
- **Match simulator** running 4 concurrent matches with realistic event generation
- **Supabase PostgreSQL** database for persistent storage
- **Redis** caching support (optional)

## Tech Stack

- **Runtime**: Node.js / Bun
- **Framework**: NestJS 11
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Socket.IO
- **Caching**: Redis (ioredis)
- **Language**: TypeScript

## Prerequisites

- Bun (recommended) or Node.js 18+
- Supabase account and project
- Redis (optional, for caching)
- bun package manager (comes with Bun)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ProFootball
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Set Up Supabase Database

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor in your Supabase dashboard
3. Run the migration script from `database/migrations/001_initial_schema.sql`
4. This will create the following tables:
   - `teams` - Team information
   - `matches` - Match data
   - `match_events` - Match events (goals, cards, etc.)
   - `chat_messages` - Chat messages

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

```env
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Match Simulation Configuration
MATCH_SIMULATION_SPEED=1
```

**Important**: Use your Supabase project URL and keys:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your anon/public key
- `SUPABASE_SERVICE_KEY`: Your service role key (keep this secret!)

### 5. Run Database Migration

The migration script creates all necessary tables, indexes, and RLS policies. Run it in your Supabase SQL Editor.

### 6. Start the Application

**Development:**
```bash
bun run start:dev
```

**Production:**
```bash
bun run build
bun run start:prod
```

The server will start on `http://localhost:3000` (or the port specified in your `.env`).

### 7. Verify Setup

Check the health endpoint:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## API Documentation

### REST Endpoints

#### Health Check
```
GET /health
```
Returns server health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get All Matches
```
GET /api/matches
```
Returns a list of all matches.

**Response:**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "id": "uuid",
        "homeTeam": {
          "id": "uuid",
          "name": "Manchester United",
          "shortName": "MUN",
          "logoUrl": null
        },
        "awayTeam": {
          "id": "uuid",
          "name": "Liverpool",
          "shortName": "LIV",
          "logoUrl": null
        },
        "homeScore": 2,
        "awayScore": 1,
        "minute": 45,
        "status": "FIRST_HALF",
        "startTime": "2024-01-01T12:00:00.000Z"
      }
    ],
    "total": 4
  }
}
```

#### Get Live Matches
```
GET /api/matches/live
```
Returns only matches that are currently live (FIRST_HALF, HALF_TIME, SECOND_HALF).

#### Get Match by ID
```
GET /api/matches/:id
```
Returns detailed match information including events and statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "homeTeam": { ... },
    "awayTeam": { ... },
    "homeScore": 2,
    "awayScore": 1,
    "minute": 45,
    "status": "FIRST_HALF",
    "startTime": "2024-01-01T12:00:00.000Z",
    "events": [
      {
        "id": "uuid",
        "type": "GOAL",
        "minute": 23,
        "team": "home",
        "player": "Marcus Rashford",
        "description": "Goal scored by Marcus Rashford",
        "timestamp": "2024-01-01T12:23:00.000Z"
      }
    ],
    "statistics": {
      "possession": { "home": 55, "away": 45 },
      "shots": { "home": 12, "away": 8 },
      "shotsOnTarget": { "home": 6, "away": 3 },
      "corners": { "home": 4, "away": 2 },
      "fouls": { "home": 7, "away": 9 },
      "yellowCards": { "home": 1, "away": 2 },
      "redCards": { "home": 0, "away": 0 }
    }
  }
}
```

### Server-Sent Events (SSE)

#### Stream Match Events
```
GET /api/matches/:id/events/stream
```
Streams real-time match events as they occur.

**Headers:**
- `Last-Event-ID` (optional): Resume from a specific event ID

**Event Types:**
- `match_event`: New match event (goal, card, etc.)
- `score_update`: Score change
- `status_change`: Match status change

**Example:**
```javascript
const eventSource = new EventSource('http://localhost:3000/api/matches/match-id/events/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};
```

### WebSocket Events

Connect to the WebSocket server at `ws://localhost:3000`.

#### Client → Server Events

**subscribe_match**
Subscribe to match updates.
```json
{
  "matchId": "uuid"
}
```

**unsubscribe_match**
Unsubscribe from match updates.
```json
{
  "matchId": "uuid"
}
```

**join_chat**
Join a match chat room.
```json
{
  "matchId": "uuid",
  "userId": "user-123",
  "username": "John Doe"
}
```

**leave_chat**
Leave a match chat room.
```json
{
  "matchId": "uuid",
  "userId": "user-123"
}
```

**send_message**
Send a chat message.
```json
{
  "matchId": "uuid",
  "userId": "user-123",
  "username": "John Doe",
  "message": "Great goal!"
}
```

**typing_start**
Indicate user is typing.
```json
{
  "matchId": "uuid",
  "userId": "user-123",
  "username": "John Doe"
}
```

**typing_stop**
Stop typing indicator.
```json
{
  "matchId": "uuid",
  "userId": "user-123"
}
```

#### Server → Client Events

**connected**
Sent when client connects.
```json
{
  "socketId": "socket-id",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**subscribed**
Confirmation of match subscription.
```json
{
  "matchId": "uuid",
  "currentState": { ... }
}
```

**match_event**
New match event occurred.
```json
{
  "matchId": "uuid",
  "type": "GOAL",
  "minute": 23,
  "team": "home",
  "player": "Marcus Rashford",
  "description": "Goal scored by Marcus Rashford"
}
```

**score_update**
Score changed.
```json
{
  "matchId": "uuid",
  "homeScore": 2,
  "awayScore": 1
}
```

**status_change**
Match status changed.
```json
{
  "matchId": "uuid",
  "status": "HALF_TIME",
  "minute": 45
}
```

**chat_message**
New chat message.
```json
{
  "matchId": "uuid",
  "messageId": "uuid",
  "userId": "user-123",
  "username": "John Doe",
  "message": "Great goal!",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**user_joined**
User joined chat room.
```json
{
  "matchId": "uuid",
  "userId": "user-123",
  "username": "John Doe"
}
```

**user_left**
User left chat room.
```json
{
  "matchId": "uuid",
  "userId": "user-123",
  "username": "John Doe"
}
```

**typing_indicator**
User typing status.
```json
{
  "matchId": "uuid",
  "userId": "user-123",
  "username": "John Doe",
  "isTyping": true
}
```

**error**
Error message.
```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many messages. Please wait."
}
```

## Architecture Decisions

### Database Design

- **Normalized Schema**: Match events are stored in a separate table for better query performance and scalability
- **JSONB for Statistics**: Match statistics stored as JSONB for flexibility while maintaining queryability
- **Foreign Keys**: Proper referential integrity with cascade deletes for related data
- **Indexes**: Strategic indexes on frequently queried columns (status, match_id, timestamps)

### Real-time Communication

- **Socket.IO**: Chosen for WebSocket support with fallback options and room management
- **SSE**: Alternative streaming option for clients that prefer HTTP-based streaming
- **Event Bus**: Internal event system for decoupling services

### Data Persistence

- **Supabase**: PostgreSQL database with built-in real-time capabilities
- **Repository Pattern**: Abstraction layer for database operations
- **Async/Await**: All database operations are asynchronous for better performance

### Match Simulation

- **Configurable Speed**: Match simulation speed can be adjusted via environment variable
- **Realistic Events**: Event generation follows realistic distributions (goals, cards, substitutions)
- **Auto-restart**: Finished matches are automatically replaced with new ones

### Chat System

- **Rate Limiting**: Sliding window rate limiter prevents spam
- **Typing Indicators**: Auto-clear after timeout
- **Message History**: Limited to 100 messages per room (oldest messages are removed)
- **Room-based**: Messages are scoped to match rooms

## Known Limitations

1. **No Authentication**: Currently no user authentication system
2. **No Message Persistence Limit**: Chat messages are kept indefinitely (consider archiving)
3. **Single Instance**: Not designed for horizontal scaling (WebSocket connections are in-memory)
4. **No Match History**: Finished matches are not archived (consider adding archive table)
5. **Team Management**: Teams are seeded on startup, no admin interface for team management

## Deployment Guide

### Render / Railway / Heroku

1. **Set Environment Variables** in your hosting platform:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `PORT` (usually auto-set)
   - `NODE_ENV=production`
   - `CORS_ORIGINS` (your frontend URL)

2. **Build Command**: `npm run build`
3. **Start Command**: `npm run start:prod`

4. **Database**: Ensure your Supabase project allows connections from your hosting platform's IP addresses.

### Docker (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

## Development

### Running Tests

```bash
bun test
bun run test:e2e
```

### Linting

```bash
bun run lint
```

### Code Formatting

```bash
bun run format
```

## Project Structure

```
src/
├── modules/
│   ├── matches/          # Match data and REST endpoints
│   ├── realtime/         # WebSocket gateway
│   ├── chat/             # Chat functionality
│   └── simulator/        # Match simulation
├── shared/
│   ├── database/         # Supabase service
│   ├── cache/             # Redis service
│   ├── events/            # Event bus
│   ├── common/            # Filters, interceptors, pipes
│   └── config/            # Configuration
└── main.ts                # Application entry point
```

## License

UNLICENSED

## Support

For issues and questions, please open an issue in the repository.
