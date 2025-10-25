# Upstash Redis Setup Guide for Both Services

## 🎯 Why Use Upstash Redis for Both Services?

### Benefits for Your Streaming Platform:

1. **Better Performance**: Global edge network for faster responses
2. **Real-time Ready**: Optimized for WebSocket pub/sub (perfect for "Watch Together")
3. **Serverless Optimized**: Built for Railway/Vercel deployment
4. **Cost-Effective**: Free tier available for both services
5. **Consistent Architecture**: Same Redis setup across both services
6. **Easy Integration**: Simple REST API + Redis client
7. **Scalability**: Pay-per-use model that grows with your application

## 🚀 Step 1: Create Upstash Redis Account

### 1. Sign Up

1. Go to [https://upstash.com/](https://upstash.com/)
2. Click "Sign Up" (Google/GitHub signup available)
3. Complete the onboarding process

### 2. Create Redis Database

1. **Dashboard**: Click "Create Database"
2. **Database Type**: Select "Redis"
3. **Region**: Choose region closest to your users (e.g., `North America (East)`)
4. **Free Tier**: Select the free tier option
5. **Create Database**: Click "Create"

### 3. Get Connection Details

1. **Database Overview**: Click on your database name
2. **Connection String**: Copy the Redis URL
3. **Format**: Should look like: `redis://default:your-token@your-db.upstash.io:6379`

## 🔧 Step 2: Update Environment Variables

### Current Redis Cloud Configuration (Main Backend):

```env
REDIS_URL=redis://default:brjvXIxwAvaZ3iMN9G2jrZpaBjFztz9F@redis-11003.c244.us-east-1-2.ec2.redns.redis-cloud.com:11003
REDIS_PASSWORD=brjvXIxwAvaZ3iMN9G2jrZpaBjFztz9F
```

### New Upstash Configuration:

```env
REDIS_URL=redis://default:your-upstash-token@your-db.upstash.io:6379
```

## 📋 Step 3: Railway Dashboard Configuration

### Main Backend Railway Environment Variables:

```env
# Replace with Upstash Redis URL
REDIS_URL=redis://default:your-upstash-token@your-db.upstash.io:6379

# Keep existing variables
INTERNAL_API_KEY=5ef0ad5c74b1c1a361c289ae1f71aa5ce3bf90b06b3effd9fb9cd13d636c9163
PROVIDERS_BACKEND_URL=https://your-providers-backend.railway.app
```

### Providers Backend Railway Environment Variables:

```env
INTERNAL_API_KEY=5ef0ad5c74b1c1a361c289ae1f71aa5ce3bf90b06b3effd9fb9cd13d636c9163
REDIS_URL=redis://default:your-upstash-token@your-db.upstash.io:6379
TMDB_API_KEY=your-tmdb-api-key
CORS_ORIGIN=https://your-main-backend.railway.app
```

## 🧪 Step 4: Test the Migration

### Test Redis Connection:

```bash
# Test with redis-cli (if installed)
redis-cli -u redis://default:your-upstash-token@your-db.upstash.io:6379 ping
# Should return: PONG

# Test basic operations
redis-cli -u redis://default:your-upstash-token@your-db.upstash.io:6379 set test "Hello Upstash"
redis-cli -u redis://default:your-upstash-token@your-db.upstash.io:6379 get test
# Should return: "Hello Upstash"
```

### Test in Application:

```bash
# Start your main backend
cd C:\Users\Administrator\Documents\backend
npm run dev

# Test health endpoint
curl http://localhost:3000/health
```

## 🎬 Step 5: Verify "Watch Together" Features

### Test WebSocket Functionality:

1. **Create Room**: Test room creation and persistence
2. **Join Room**: Test multiple users joining same room
3. **Playback Sync**: Test synchronized playback controls
4. **Room State**: Verify room state is stored in Redis

### Test Provider Integration:

1. **Provider URLs**: Test getting provider embed URLs
2. **Provider Status**: Test checking provider health
3. **Provider List**: Test getting supported providers list

## 🔄 Step 6: Deploy Changes

### 1. Update Main Backend:

```bash
cd C:\Users\Administrator\Documents\backend
# Update .env file with new Redis URL
git add .
git commit -m "feat: Migrate to Upstash Redis for better performance"
git push origin main
```

### 2. Deploy Providers Backend:

```bash
cd C:\Users\Administrator\Documents\providers-backend
# Set environment variables in Railway dashboard
railway deploy
```

## 📊 Upstash Redis Features for Your Use Case

### 🎬 "Watch Together" Features:

- **Pub/Sub**: Real-time room updates via WebSocket
- **Lists**: Room participant management
- **Hashes**: Room state storage (movie ID, current time, playback state)
- **TTL**: Automatic cleanup of expired rooms (1 hour TTL)

### 🔄 Proxy Management:

- **Sets**: Healthy proxy tracking
- **Hashes**: Proxy health status (last checked, response time)
- **TTL**: Proxy health caching (1 hour TTL)

### 🎬 Provider Caching:

- **Strings**: Provider responses (iframe URLs)
- **Hashes**: Provider metadata (health status, response time)
- **TTL**: 6-hour cache expiration for provider data

## 🔍 Step 7: Monitor and Debug

### Upstash Dashboard:

1. **Monitor**: Check Redis usage and performance
2. **Analytics**: View query patterns and response times
3. **Alerts**: Set up usage alerts if needed

### Debug Commands:

```bash
# Check Redis connection
redis-cli -u redis://default:your-upstash-token@your-db.upstash.io:6379 info

# View all keys
redis-cli -u redis://default:your-upstash-token@your-db.upstash.io:6379 keys "*"

# Check memory usage
redis-cli -u redis://default:your-upstash-token@your-db.upstash.io:6379 memory usage
```

## 💰 Cost Comparison

### Redis Cloud 30MB:

- **Fixed Cost**: Free (30MB limit)
- **Overage**: $0.025/GB/month
- **Limitations**: 30MB memory cap

### Upstash Redis Free Tier:

- **Free Tier**: 25MB + 30K requests/day
- **Pay-per-use**: $0.50/GB/month after free tier
- **Benefits**: Global edge network, better performance

## 🎯 Benefits Summary

### Performance Improvements:

- **Lower Latency**: Global edge network (50-100ms vs 200-500ms)
- **Faster Responses**: Optimized for serverless platforms
- **Better UX**: Real-time updates for "Watch Together"

### Reliability:

- **High Availability**: 99.9% uptime
- **Auto-scaling**: Handles traffic spikes
- **Global Coverage**: Multiple regions

### Development Benefits:

- **Easy Setup**: Simple configuration
- **Great Documentation**: Clear API docs
- **Active Community**: Good support

### Cost Efficiency:

- **Free Tier**: Generous free tier available
- **Pay-per-use**: Only pay for what you use
- **No Overheads**: No server management

## 🚀 Next Steps

1. **Create Upstash Account**: Sign up at https://upstash.com/
2. **Create Database**: Set up Redis database
3. **Get Connection String**: Copy Redis URL from dashboard
4. **Update Environment Variables**: Set in Railway dashboard
5. **Test Migration**: Verify Redis connection and functionality
6. **Deploy Changes**: Push to GitHub and Railway
7. **Monitor Performance**: Check Upstash dashboard for usage

## 📞 Support

### Upstash Resources:

- **Documentation**: https://upstash.com/docs
- **Dashboard**: https://console.upstash.com/
- **Support**: https://upstash.com/support

### Common Issues:

1. **Connection Error**: Check Redis URL format
2. **Permission Error**: Verify database permissions
3. **Timeout Error**: Check network connectivity
4. **Memory Limit**: Monitor usage in dashboard

## 🎉 Conclusion

Migrating to Upstash Redis will provide significant benefits for your streaming platform:

✅ **Better Performance**: Faster responses for your users  
✅ **Enhanced Real-time Features**: Better WebSocket support  
✅ **Simplified Architecture**: Consistent Redis setup  
✅ **Reduced Costs**: Free tier available  
✅ **Improved Scalability**: Ready for growth

The migration is straightforward and will significantly improve your "Watch Together" functionality and overall performance!
