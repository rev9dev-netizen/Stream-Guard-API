# Stream Guard Cloudflare Worker

This Cloudflare Worker decrypts encrypted URLs and proxies requests to your Stream Guard API.

## Setup

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Test Locally

```bash
npm run dev
```

The worker will run on `http://localhost:8787`

### 3. Deploy to Cloudflare

```bash
# Login to Cloudflare (first time only)
npx wrangler login

# Deploy worker
npm run deploy
```

After deployment, you'll get a URL like:
```
https://stream-guard-proxy.your-username.workers.dev
```

### 4. Update API Configuration

Copy the worker URL and add it to your `.env` file:

```env
WORKER_URL=https://stream-guard-proxy.your-username.workers.dev
```

Restart your API server for changes to take effect.

## How It Works

1. API encrypts URLs and returns worker URLs:
   ```
   https://worker.dev/{encryptedPath}
   ```

2. Worker receives request, decrypts path to get actual API URL

3. Worker proxies request to API

4. API returns encrypted playlist/segment

5. Worker forwards response to client

## Security

- **Client sees**: Only worker URLs (encrypted gibberish)
- **Worker decrypts**: Gets actual API URLs
- **API protects**: CDN URLs still encrypted in tokens with IP/UA binding

Even if someone views worker source code, they cannot:
- Access CDN URLs directly (encrypted in server-side tokens)
- Share tokens (IP/UA bound)
- Bypass rate limits

## Testing

Test the worker with a sample encrypted URL:

```bash
# Encode a test URL
echo -n "http://localhost:3000/test" | base64

# Test decryption
curl https://your-worker.workers.dev/{encoded-url}
```

## Custom Domain (Optional)

To use your own domain:

1. Add domain in Cloudflare dashboard
2. Update `wrangler.toml`:
   ```toml
   route = "https://stream.yourdomain.com/*"
   ```
3. Deploy again: `npm run deploy`
