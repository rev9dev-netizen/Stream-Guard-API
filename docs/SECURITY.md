# 🛡️ DDoS Protection & Rate Limiting

## Overview

The VidNinja Providers API includes multiple layers of protection against DDoS attacks, bot abuse, and excessive scraping.

## Protection Layers

### 1. Rate Limiting (All Endpoints)

**Configuration:**
- **Window:** 15 minutes
- **Max Requests:** 100 per IP
- **Response:** `429 Too Many Requests`

**Behavior:**
- Tracks requests per IP address
- Resets every 15 minutes
- Skips localhost in development

### 2. Scraping Rate Limiting (/cdn endpoint)

**Configuration:**
- **Window:** 5 minutes
- **Max Requests:** 20 per IP
- **Response:** `"Too many scraping requests, please slow down."`

**Purpose:**
- Prevents aggressive scraping
- Protects source providers
- Reduces server load

### 3. Speed Limiting (Progressive Delay)

**Configuration:**
- **Window:** 15 minutes
- **Threshold:** 50 requests
- **Delay:** 500ms per request after threshold
- **Max Delay:** 5 seconds

**Behavior:**
- First 50 requests → Full speed
- Requests 51-60 → 500ms delay each
- Requests 61+ → Up to 5s delay

### 4. Cloudflare Validation

**Configuration (.env):**
```env
CLOUDFLARE_MODE=true
CLOUDFLARE_STRICT=true
```

**Modes:**

**Standard Mode** (`CLOUDFLARE_MODE=true`):
- Validates Cloudflare headers (`cf-ray`, `cf-connecting-ip`)
- Logs suspicious requests
- Allows requests through

**Strict Mode** (`CLOUDFLARE_STRICT=true`):
- Requires Cloudflare headers
- Blocks non-Cloudflare requests
- Returns `403 Access Denied`

### 5. Domain Whitelist

**Configuration (.env):**
```env
ALLOWED_DOMAINS=yourdomain.com,app.yourdomain.com
```

**Protection:**
- Only authorized domains can access streams
- Blocks direct URL access
- Prevents hotlinking

## Rate Limit Headers

When rate limited, responses include:

```
RateLimit-Limit: 100
RateLimit-Remaining: 45
RateLimit-Reset: 1700000000
Retry-After: 900
```

## Error Responses

### Rate Limit Exceeded (429)

```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

### Scraping Limit Exceeded (429)

```json
{
  "error": "Too many scraping requests, please slow down."
}
```

### Cloudflare Validation Failed (403)

```json
{
  "error": "Access denied"
}
```

## Deployment Recommendations

### Behind Cloudflare (Recommended)

1. **Enable Cloudflare Proxy** (orange cloud)
2. **Set environment variables:**
   ```env
   CLOUDFLARE_MODE=true
   CLOUDFLARE_STRICT=true
   ```
3. **Configure Cloudflare settings:**
   - Security Level: Medium or High
   - Bot Fight Mode: Enabled
   - DDoS Protection: Enabled
   - Rate Limiting: Custom rules

### Cloudflare Rate Limiting Rules

**Example Rule 1: API Protection**
```
(http.request.uri.path contains "/cdn") and 
(rate(5m) > 30)
```
Action: Block for 1 hour

**Example Rule 2: Stream Protection**
```
(http.request.uri.path contains "/s/") and 
(rate(1m) > 100)
```
Action: Challenge (CAPTCHA)

### Without Cloudflare

The built-in rate limiting provides basic protection:
- ✅ IP-based rate limiting
- ✅ Progressive speed limiting
- ✅ Endpoint-specific limits
- ❌ No DDoS mitigation
- ❌ No bot detection
- ❌ No geographic filtering

## Monitoring

### Server Logs

Watch for rate limit violations:

```
[RATE_LIMIT] IP 192.168.1.1 exceeded limit on /cdn
[SECURITY] Request without Cloudflare headers from: 203.0.113.0
[BLOCKED] Direct URL access attempt from IP: 198.51.100.0
```

### Metrics to Track

1. **Rate Limit Hits** - How often limits are triggered
2. **Blocked IPs** - IPs that hit limits frequently
3. **Cloudflare Blocks** - Non-Cloudflare request attempts
4. **Domain Violations** - Unauthorized domain access

## Adjusting Limits

### For Higher Traffic

Edit `src/server/index.ts`:

```typescript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Increase from 100 to 500
  // ...
});

const scrapingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50, // Increase from 20 to 50
  // ...
});
```

### For Stricter Protection

```typescript
const scrapingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // Only 10 requests per 10 minutes
  // ...
});
```

## Best Practices

1. **Deploy Behind Cloudflare** - Essential for production
2. **Enable Strict Mode** - Block non-Cloudflare traffic
3. **Monitor Logs** - Watch for abuse patterns
4. **Adjust Limits** - Based on legitimate usage
5. **Use API Keys** - Track usage per client
6. **Implement Caching** - Reduce scraping load
7. **Set Domain Whitelist** - Prevent unauthorized use

## Testing Rate Limits

### Test API Rate Limit

```bash
# Send 101 requests quickly
for i in {1..101}; do
  curl -H "x-api-key: YOUR_KEY" \
    "http://localhost:3000/sources"
done
```

Expected: First 100 succeed, 101st returns 429

### Test Scraping Rate Limit

```bash
# Send 21 scraping requests
for i in {1..21}; do
  curl -H "x-api-key: YOUR_KEY" \
    "http://localhost:3000/cdn?sourceId=cloudnestra&tmdbId=550&type=movie"
done
```

Expected: First 20 succeed, 21st returns 429

## Security Checklist

- [x] Rate limiting enabled
- [x] Scraping limits configured
- [x] Speed limiting active
- [x] Cloudflare validation ready
- [x] Domain whitelist configured
- [x] API key authentication
- [x] Stream URL obfuscation
- [x] Redis caching enabled

## Summary

The API now has **7 layers of protection**:

1. ✅ General rate limiting (100 req/15min)
2. ✅ Scraping rate limiting (20 req/5min)
3. ✅ Progressive speed limiting
4. ✅ Cloudflare header validation
5. ✅ Domain whitelist
6. ✅ API key authentication
7. ✅ Stream token expiration

This provides enterprise-grade protection against:
- DDoS attacks
- Bot scraping
- API abuse
- Hotlinking
- Unauthorized access
- Direct URL sharing

---

**Recommended Setup:** Deploy behind Cloudflare with strict mode enabled for maximum protection! 🛡️
