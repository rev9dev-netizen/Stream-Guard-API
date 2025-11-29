# TMDB Proxy Worker - Local Development

This Cloudflare Worker acts as a proxy for TMDB API requests to bypass ISP blocking.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd cloudflare-tmdb-proxy/worker
pnpm install
```

### 2. Start Worker Locally
```bash
pnpm dev
# or
npx wrangler dev --local --port 8788
```

The worker will run on `http://localhost:8788`

### 3. Configure API Server

Add to your `.env`:
```env
TMDB_PROXY_URL=http://localhost:8788
```

## 📡 How It Works

**Without Proxy (Blocked):**
```
API Server → https://api.themoviedb.org/3/movie/550 ❌ (ISP blocked)
```

**With Proxy (Working):**
```
API Server → http://localhost:8788/movie/550 → Cloudflare Worker → TMDB API ✅
```

## 🧪 Testing

Test the worker directly:
```bash
# Get movie details
curl "http://localhost:8788/movie/550?api_key=YOUR_KEY"

# Get TV show
curl "http://localhost:8788/tv/1399?api_key=YOUR_KEY"
```

## 🚢 Production Deployment

### 1. Deploy Worker
```bash
npx wrangler deploy
```

### 2. Update API Server

Update `.env` with your deployed worker URL:
```env
TMDB_PROXY_URL=https://tmdb-proxy.YOUR_SUBDOMAIN.workers.dev
```

## 🔒 Security

- Worker adds CORS headers automatically
- Forwards Authorization headers to TMDB
- No data is stored or logged
- Acts as a transparent proxy

## 📝 URL Format

**Worker URL Format:**
```
http://localhost:8788/{tmdb-path}?{query-params}
```

**Examples:**
- `/movie/550` → Movie details
- `/tv/1399` → TV show details
- `/tv/1399/season/1/episode/1` → Episode details

The worker automatically forwards all query parameters and headers to TMDB.
