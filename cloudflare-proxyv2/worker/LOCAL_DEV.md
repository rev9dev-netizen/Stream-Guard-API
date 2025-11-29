# Stream Guard Proxy Worker - Local Development

## Quick Start for Local Testing

### 1. Install Dependencies
```bash
cd cloudflare-proxyv2/worker
npm install
```

### 2. Run the Worker Locally
```bash
npx wrangler dev --local --port 8787
```

**Important:** The `--local` flag is **required** to allow the worker to access `localhost:3000` (your API server).

### 3. Update Your Test Page

In your `test-api.html` or frontend, use the local worker URL:
```
http://localhost:8787
```

Instead of:
```
https://stream-guard-proxy.swasthikshetty101.workers.dev
```

## How It Works

### Local Development Mode
- Worker runs on `http://localhost:8787`
- Can access `http://localhost:3000` (your API)
- Adds proper headers (`Referer`, `Origin`) to pass domain validation
- Enhanced logging for debugging

### Production Mode
- Worker runs on Cloudflare's edge network
- Proxies to your deployed API (not localhost)
- Update the `Referer` and `Origin` headers in `src/index.ts` to match your production domain

## Testing the Setup

1. **Start your API server:**
   ```bash
   pnpm start:server:dev
   ```
   (Should be running on `http://localhost:3000`)

2. **Start the worker in another terminal:**
   ```bash
   cd cloudflare-proxyv2/worker
   npx wrangler dev --local --port 8787
   ```

3. **Test the worker health:**
   ```bash
   curl http://localhost:8787/health
   ```
   Should return: `Stream Guard Worker - OK (Local Dev Mode)`

4. **Open your test page:**
   ```
   http://localhost:3000/test
   ```

## Troubleshooting

### Error: "Worker cannot access localhost"
- Make sure you're using the `--local` flag
- Without `--local`, the worker runs in Cloudflare's sandbox and cannot access localhost

### Error: 403 Forbidden from API
- The worker now sends `Referer: http://localhost:3000` header
- Make sure `localhost:3000` is in your `ALLOWED_DOMAINS` environment variable

### Error: Connection refused
- Make sure your API server is running on port 3000
- Check that both services are running simultaneously

## Deployment to Production

When deploying to production:

1. Update the headers in `src/index.ts` to use your production domain:
   ```typescript
   'Referer': 'https://your-production-domain.com',
   'Origin': 'https://your-production-domain.com',
   ```

2. Deploy the worker:
   ```bash
   npx wrangler deploy
   ```

3. Update your frontend to use the production worker URL:
   ```
   https://stream-guard-proxy.swasthikshetty101.workers.dev
   ```
