# 🎬 VidNinja Providers API

A powerful Node.js Express API for scraping and streaming video content from multiple providers with built-in caching, authentication, and stream proxying capabilities.

## ✨ Features

- 🔐 **API Key Authentication** - Secure endpoints with API key validation
- 💾 **Redis Caching** - Upstash Redis integration with 4-hour TTL
- 🎭 **Stream Proxy** - Complete URL obfuscation to hide source providers
- 📊 **Provider Status API** - Real-time health monitoring for all sources
- 🌐 **CORS Enabled** - Ready for cross-origin requests
- 🎥 **Multi-Provider Support** - Scrapes from multiple video sources
- 🔄 **Dynamic Source Loading** - Auto-discovers available providers
- 🧪 **Built-in Test UI** - Interactive web interface for testing

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- pnpm (recommended) or npm
- Upstash Redis account (free tier available)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd providers-vidninja-production

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000

# API Authentication
API_KEY=your-secure-api-key-here

# Upstash Redis (Required for caching)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### Running the Server

```bash
# Development mode
pnpm start:server

# CLI mode (for testing scrapers)
pnpm cli
```

The server will start on `http://localhost:3000`

## 📡 API Endpoints

### 1. Get Stream URL

**Endpoint:** `GET /cdn`

**Authentication:** Required (API Key)

**Query Parameters:**
- `sourceId` (optional) - Provider Codename (e.g., `iron`, `alpha`) or leave empty for **Auto-select**
- `tmdbId` (required) - TMDB ID of the content
- `type` (required) - Media type: `movie` or `show`
- `season` (optional) - Season number (for TV shows)
- `episode` (optional) - Episode number (for TV shows)
- `force` (optional) - Set to `true` to bypass cache

**Headers:**
- `x-api-key: YOUR_API_KEY` or use query param `?apiKey=YOUR_API_KEY`

**Example Request (Auto-select):**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3000/cdn?tmdbId=550&type=movie"
```

**Example Request (Specific Source):**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3000/cdn?sourceId=iron&tmdbId=550&type=movie"
```

**Response:**
```json
{
  "source": "iron",
  "stream": [
    {
      "id": "iron-0",
      "type": "hls",
      "playlist": "http://localhost:3000/s/abc123def456...",
      "headers": {},
      "proxyDepth": 2,
      "flags": [],
      "captions": []
    }
  ],
  "embeds": []
}
```

### 2. List Available Sources

**Endpoint:** `GET /sources`

**Authentication:** Required (API Key)

**Example Request:**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3000/sources"
```

**Response:**
```json
[
  {
    "id": "cloudnestra",
    "name": "Cloudnestra",
    "type": "source",
    "rank": 200
  },
  {
    "id": "lookmovie",
    "name": "LookMovie",
    "type": "source",
    "rank": 140
  }
]
```

### 3. Provider Status

**Endpoint:** `GET /status`

**Authentication:** Public (No API key required)

**Example Request:**
```bash
curl "http://localhost:3000/status"
```

**Response:**
```json
{
  "cloudnestra": {
    "status": "operational",
    "responseTime": 1234,
    "uptime": 95.5
  },
  "lookmovie": {
    "status": "untested",
    "responseTime": 0,
    "uptime": 0
  }
}
```

**Status Values:**
- `operational` - Working normally (>80% uptime)
- `degraded` - Experiencing issues (50-80% uptime)
- `offline` - Not working (<50% uptime)
- `untested` - No requests yet

### 4. Stream Proxy Endpoints

**Master Playlist:** `GET /s/:token`

**Segment Proxy:** `GET /s/:token/chunk/:segmentToken`

These endpoints are automatically used when you request a stream. The real source URLs are completely hidden and stored in Redis.

### 5. Test UI

**Endpoint:** `GET /test`

**Authentication:** None

Access the interactive test interface at `http://localhost:3000/test`

Features:
- Select provider and content
- Get stream URLs
- Built-in video player
- View provider status
- Test API functionality

## 🔒 Security Features

### Stream URL Obfuscation

All stream URLs are proxied through the server to hide the real source:

**Original URL:**
```
https://real-cdn.com/video/segment-1.ts
```

**Proxied URL:**
```
http://localhost:3000/s/abc123.../chunk/xyz789...
```

Benefits:
- ✅ Source URLs completely hidden
- ✅ Headers managed server-side
- ✅ Single-use tokens (fresh for each request)
- ✅ Time-limited access (1-hour TTL on segments)
- ✅ No query parameters exposing real URLs

### Cloudflare Bypass

The server uses `puppeteer-extra` with stealth plugin to bypass Cloudflare protection:

- Headless Chrome with stealth mode
- Random delays to appear human-like
- Extended timeout for challenges
- Network idle detection

## 🧪 Testing

### Using the CLI

```bash
pnpm cli
```

Interactive prompts will guide you through:
1. Select fetcher mode (native/simple/proxy)
2. Choose a source provider
3. Enter TMDB ID
4. Select media type
5. View scraped results

### Using the Test UI

1. Navigate to `http://localhost:3000/test`
2. Enter your API key
3. Select a source provider
4. Enter TMDB ID
5. Click "Get Stream URL"
6. Click "Play Stream" to test playback

### Using cURL

```bash
# Get stream for Fight Club (TMDB: 550)
curl -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3000/cdn?sourceId=cloudnestra&tmdbId=550&type=movie"

# Force refresh (bypass cache)
curl -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3000/cdn?sourceId=cloudnestra&tmdbId=550&type=movie&force=true"

# Get TV show episode
curl -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3000/cdn?sourceId=lookmovie&tmdbId=1399&type=show&season=1&episode=1"
```

## 🐛 Troubleshooting

### "Unauthorized" Error

**Problem:** API returns 401 Unauthorized

**Solution:**
- Verify `API_KEY` is set in `.env`
- Include API key in request header: `x-api-key: YOUR_KEY`
- Or use query parameter: `?apiKey=YOUR_KEY`

### "Couldn't find a stream" Error

**Problem:** Scraper returns no results

**Possible Causes:**
1. **Cloudflare blocking** - Provider is protected by Cloudflare
   - Solution: Wait a few minutes and try again
   - The stealth plugin helps but isn't 100% effective

2. **Invalid TMDB ID** - Content doesn't exist
   - Solution: Verify TMDB ID on themoviedb.org

3. **Provider down** - Source website is offline
   - Solution: Check `/status` endpoint or try different provider

4. **Content not available** - Provider doesn't have this content
   - Solution: Try a different source provider

### Redis Connection Issues

**Problem:** "Failed to connect to Redis"

**Solution:**
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env`
- Check Upstash dashboard for correct credentials
- Ensure Redis instance is active

### Stream Won't Play

**Problem:** Video player shows error

**Possible Causes:**
1. **Token expired** - Segment tokens expire after 1 hour
   - Solution: Get a fresh stream URL

2. **CORS issues** - Browser blocking requests
   - Solution: Ensure you're accessing via the server (not file://)
   - Use `http://localhost:3000/test` instead of opening HTML directly

3. **HLS not supported** - Browser doesn't support HLS
   - Solution: Use modern browser (Chrome, Firefox, Safari)

### Port Already in Use

**Problem:** "Port 3000 is already in use"

**Solution:**
```bash
# Change port in .env
PORT=3001

# Or kill existing process
# Windows
taskkill /F /IM node.exe

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

## 📊 Caching Strategy

### Stream URLs (by TMDB ID)

- **Key Format:** `stream:{sourceId}:{tmdbId}:{type}:{season}:{episode}`
- **TTL:** 4 hours
- **Storage:** Raw stream data with original URLs
- **Bypass:** Use `force=true` query parameter

### Stream Tokens

- **Key Format:** `stream:token:{token}`
- **TTL:** 4 hours
- **Storage:** Stream metadata (URL + headers)
- **Purpose:** Map tokens to real URLs

### Segment URLs

- **Key Format:** `segment:{token}:{segmentToken}`
- **TTL:** 1 hour
- **Storage:** Segment URL
- **Purpose:** Hide real segment URLs

## 🔧 Configuration

### Adjusting Cache TTL

Edit `src/server/redis.ts`:

```typescript
// Change from 4 hours to 2 hours
const CACHE_TTL = 2 * 60 * 60; // 2 hours in seconds
```

### Adding New Providers

Providers are auto-discovered from `src/providers/sources/`. To add a new provider:

1. Create provider directory: `src/providers/sources/myprovider/`
2. Implement scraper following existing patterns
3. Export from `index.ts`
4. Restart server - provider will appear in `/sources`

### Customizing Puppeteer

Edit `src/providers/sources/vidsrc/puppeteer-fetcher.ts`:

```typescript
// Enable visible browser for debugging
headless: false,

// Adjust timeouts
timeout: 120000, // 2 minutes
```

## 🚢 Deployment

### Docker (Recommended)

```bash
# Build image
docker build -t vidninja-api .

# Run container
docker run -p 3000:3000 \
  -e API_KEY=your-key \
  -e UPSTASH_REDIS_REST_URL=your-url \
  -e UPSTASH_REDIS_REST_TOKEN=your-token \
  vidninja-api
```

### Koyeb / Railway / Render

1. Connect your Git repository
2. Set environment variables in dashboard
3. Deploy with build command: `pnpm install`
4. Start command: `pnpm start:server`

### Environment Variables for Production

```env
PORT=3000
API_KEY=<generate-strong-key>
UPSTASH_REDIS_REST_URL=<your-redis-url>
UPSTASH_REDIS_REST_TOKEN=<your-redis-token>
NODE_ENV=production
```

## 📝 API Response Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | Success | Stream found and returned |
| 401 | Unauthorized | Invalid or missing API key |
| 404 | Not Found | Stream not found or content unavailable |
| 500 | Server Error | Internal error during scraping |

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- Built with Express.js and TypeScript
- Uses Upstash Redis for caching
- Puppeteer for Cloudflare bypass
- Hls.js for video playback

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review troubleshooting section above

---

**Made with ❤️ for the streaming community**
