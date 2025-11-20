# Providers Backend

A production-ready microservice for streaming provider management, watch-together functionality, and real-time synchronization with comprehensive monitoring and analytics.

## 🚀 Features

### Core Services

- **Provider Management**: VidNest, VidSrc streaming provider support with embed URL generation
- **Watch Together**: Real-time synchronized media playback with WebSocket rooms
- **Authentication**: Supabase JWT authentication with middleware
- **Rate Limiting**: Redis-based distributed rate limiting
- **Caching**: Redis caching for providers, rooms, and performance data

### Monitoring & Analytics

- **Better Uptime**: 24/7 health monitoring (50 monitors free)
- **OneSignal**: Push notifications (20M/month free)
- **PostHog**: User analytics and event tracking (free tier)
- **Sentry**: Error tracking and performance monitoring (free tier)
- **Performance Monitoring**: Real-time API and system metrics

### External Integrations

- **Supabase**: Database and authentication
- **Redis (Upstash)**: Caching and rate limiting (10K commands/day free)
- **TMDB**: Movie/TV metadata
- **Trakt**: Additional content data
- **Cloudflare**: CDN and security

## 📡 API Endpoints

### Provider Management

```bash
GET  /providers/list              # List supported providers
GET  /providers/:provider/:id     # Get embed URL for content
GET  /providers/stats             # Provider usage statistics
```

### Watch Together (Requires Auth)

```bash
POST /watch-together/rooms        # Create room
POST /rooms/:roomId/join          # Join room
POST /rooms/:roomId/leave         # Leave room
GET  /rooms/:roomId               # Get room info
GET  /rooms                       # List all rooms
GET  /stats                       # Watch together statistics
```

### Notifications

```bash
POST /notifications/register-device  # Register device for push
POST /notifications/test/:userId     # Test notification
GET  /notifications/stats            # Notification statistics
```

### Monitoring

```bash
GET  /health                       # Service health check
GET  /security/status              # Security configuration
GET  /api/config                   # API configuration
```

## 🛠️ Setup & Installation

### Prerequisites

- Node.js 18+
- Railway account (free)
- Upstash Redis (free tier)
- TMDB API key
- Supabase project

### Local Development

```bash
npm install
cp .env.example .env  # Configure environment variables
npm run dev          # Start development server
```

### Environment Variables

```bash
# Core
NODE_ENV=development
PORT=3001
INTERNAL_API_KEY=your-secure-key

# Database & Cache
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# APIs
TMDB_API_KEY=your-tmdb-key
ONESIGNAL_APP_ID=your-onesignal-id
ONESIGNAL_REST_API_KEY=your-onesignal-key

# Monitoring (Optional)
SENTRY_DSN=your-sentry-dsn
POSTHOG_API_KEY=your-posthog-key
BETTER_UPTIME_API_KEY=your-betteruptime-key
```

### Deployment

```bash
railway init
railway up
# Set environment variables in Railway dashboard
railway deploy
```

## 🔗 Architecture

This backend serves as a microservice that integrates with the main movie streaming backend:

- **Main Backend**: Content discovery, user management, movie/TV data
- **Providers Backend**: Streaming providers, watch-together, real-time features

## 📊 Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Fastify
- **Database**: Supabase PostgreSQL
- **Cache**: Upstash Redis
- **Auth**: Supabase JWT
- **WebSocket**: Socket.IO
- **Monitoring**: Better Uptime, Sentry, PostHog
- **Notifications**: OneSignal

## 📈 Performance & Monitoring

- **Health Checks**: `/health` endpoint with comprehensive service monitoring
- **Rate Limiting**: Redis-based distributed rate limiting
- **Caching**: TTL-based caching for providers and rooms
- **Analytics**: PostHog event tracking and user behavior analysis
- **Error Tracking**: Sentry integration with performance monitoring

## 🔒 Security

- Supabase JWT authentication for protected routes
- Internal API key authentication for backend-to-backend communication
- Rate limiting and request sanitization
- CORS and security headers via Helmet.js

## 📝 License

MIT License
