# Providers Backend - Movie Streaming Platform

A production-ready backend microservice for streaming provider management, proxy rotation, and watch-together synchronization functionality.

## 🎯 Features

### Provider Management

- **Multiple Streaming Providers**: Support for VidNest, VidSrc, and other streaming providers
- **Embed URLs**: Generate iframe embed URLs for streaming content
- **Provider Health Monitoring**: Check provider status and availability
- **Provider Caching**: 6-hour TTL caching for improved performance

### Proxy Rotation

- **Automatic Proxy Rotation**: Bypass geographic and rate-limit restrictions
- **Proxy Health Monitoring**: Detect and mark broken proxies automatically
- **Dynamic Proxy Management**: Add/remove proxies with health checks
- **Proxy Caching**: Redis-based proxy health status caching

### Watch Together (WebSocket)

- **Real-time Synchronization**: Synchronized media playback between multiple users
- **Room Management**: Create, join, and leave rooms with Redis persistence
- **Playback Controls**: Admin controls playback, others follow in sync
- **WebSocket Events**: `create_room`, `join_room`, `playback_action`, `update_time`, `leave_room`

### Security & Performance

- **Internal Authentication**: Secure backend-to-backend communication
- **Rate Limiting**: 100 requests per minute per IP
- **CORS Configuration**: Configurable for frontend domains
- **Input Sanitization**: All inputs are sanitized for security
- **Redis Integration**: For room management and caching

## 🚀 Deployment on Railway

### Prerequisites

- Railway account (free tier available)
- Redis instance (can use Railway's free tier)
- TMDB API key
- Trakt API keys (optional)

### Step 1: Deploy Providers Backend

1. **Clone and setup the Providers Backend:**

   ```bash
   cd providers-backend
   npm install
   npm run build
   ```

2. **Create Railway service:**

   ```bash
   railway init
   railway up
   ```

3. **Set environment variables in Railway dashboard:**

   ```
   INTERNAL_API_KEY=your-secure-internal-api-key-here
   REDIS_URL=your-redis-url
   TMDB_API_KEY=your-tmdb-api-key
   CORS_ORIGIN=https://your-main-backend.railway.app,http://localhost:3000
   ```

4. **Deploy:**
   ```bash
   railway deploy
   ```

### Step 2: Update Main Backend

1. **Add provider routes to your main backend:**

   - Copy `src/routes/providers.ts` to your main backend
   - Update `src/server.ts` to include the providers routes
   - Add environment variables to your main backend

2. **Set environment variables in Railway dashboard for main backend:**
   ```
   PROVIDERS_BACKEND_URL=https://your-providers-backend.railway.app
   INTERNAL_API_KEY=your-secure-internal-api-key-here
   ```

### Step 3: Configure CORS

1. **In Providers Backend:**

   - Set `CORS_ORIGIN` to include your main backend URL

2. **In Main Backend:**
   - Ensure CORS allows your frontend domain

## 🔧 API Integration

### Main Backend Routes (Available after integration)

```bash
# Get provider embed URL (requires authentication)
GET /providers/vidnest/666243

# Get supported providers list (requires authentication)
GET /providers/list

# Check provider status (requires authentication)
GET /providers/status/vidnest
```

### Internal API Routes (Providers Backend)

```bash
# Get provider embed URL (requires x-internal-key header)
GET /providers/vidnest/666243

# Get supported providers list (requires x-internal-key header)
GET /providers/list

# Check provider status (requires x-internal-key header)
GET /providers/status/vidnest

# Health check
GET /health

# Swagger documentation
GET /docs
```

## 🎬 Provider Configuration

### Supported Providers

- **VidNest**: `https://vidnest.fun/movie/{id}`
- **VidSrc**: `https://vidsrc.to/embed/{id}`
- **Custom providers**: Easily extendable

### Adding New Providers

1. **Update `src/services/providerService.ts`:**

   ```typescript
   const providers = {
     vidnest: {
       name: "VidNest",
       baseUrl: "https://vidnest.fun/movie",
       iframeTemplate: (id: string) => `https://vidnest.fun/movie/${id}`,
       healthCheckUrl: "https://vidnest.fun/health",
     },
     // Add your new provider here
   };
   ```

2. **Update provider types in `src/types/index.ts`:**

## 🔄 Proxy Configuration

### Environment Variables

```bash
# Comma-separated list of proxy URLs
PROXY_URLS=http://proxy1.example.com:8080,http://proxy2.example.com:8080

# Proxy rotation interval in milliseconds (default: 300000)
PROXY_ROTATION_INTERVAL=300000
```

### Dynamic Proxy Management

```typescript
// Add proxy
await proxyService.addProxy("http://new-proxy.example.com:8080");

// Remove proxy
await proxyService.removeProxy("http://new-proxy.example.com:8080");

// Check proxy health
const healthStatus = await proxyService.checkProxyHealth(
  "http://proxy.example.com:8080"
);
```

## 👥 Watch Together Configuration

### WebSocket Events

```typescript
// Create room
{
  event: 'create_room',
  data: { movieId: '666243', adminId: 'user123' }
}

// Join room
{
  event: 'join_room',
  data: { roomId: 'room123', userId: 'user456' }
}

// Playback action
{
  event: 'playback_action',
  data: { roomId: 'room123', action: 'play', userId: 'user123' }
}

// Update time
{
  event: 'update_time',
  data: { roomId: 'room123', currentTime: 120.5, userId: 'user123' }
}

// Leave room
{
  event: 'leave_room',
  data: { roomId: 'room123', userId: 'user456' }
}
```

## 🔒 Security Configuration

### Internal Authentication

All `/providers` routes require the `x-internal-key` header:

```bash
curl -H "x-internal-key: your-secure-internal-api-key-here" \
     https://your-providers-backend.railway.app/providers/list
```

### Rate Limiting

- 100 requests per minute per IP
- Internal API calls are exempt from rate limiting
- Configurable via environment variables

## 📊 Monitoring & Logging

### Health Checks

- `/health` endpoint for service health monitoring
- Railway health checks configured automatically
- Redis connection monitoring

### Logging

- Structured logging with timestamps
- Error tracking with context
- Request/response logging
- Configurable log levels

## 🚀 Development

### Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## 🤝 Integration with Main Backend

The Providers Backend is designed to work seamlessly with your existing main backend:

1. **Secure Communication**: Uses internal API key authentication
2. **Shared Redis**: Both services can use the same Redis instance
3. **Consistent APIs**: Follows the same patterns as your existing routes
4. **Error Handling**: Structured error responses compatible with your frontend

### Environment Variables for Main Backend

```bash
# URL of your Providers Backend service
PROVIDERS_BACKEND_URL=https://your-providers-backend.railway.app

# Internal API key for backend-to-backend communication
INTERNAL_API_KEY=your-secure-internal-api-key-here
```

## 📚 Documentation

- **Swagger UI**: Available at `/docs` when running the service
- **API Documentation**: Comprehensive OpenAPI/Swagger documentation
- **TypeScript Types**: Full type definitions for all interfaces

## 🛠️ Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `CORS_ORIGIN` is properly configured
2. **Redis Connection**: Verify Redis URL and credentials
3. **Proxy Issues**: Check proxy URLs and health status
4. **Rate Limiting**: Monitor request rates and adjust limits

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:

- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation
