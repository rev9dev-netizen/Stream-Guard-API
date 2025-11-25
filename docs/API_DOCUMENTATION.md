# 📡 VidNinja Providers API Documentation

**Base URL:** `https://your-api-domain.com`

## 🔐 Authentication

All endpoints (except `/status`) require API key authentication.

**Methods:**
1. **Header (Recommended):**
   ```
   x-api-key: YOUR_API_KEY
   ```

2. **Query Parameter:**
   ```
   ?apiKey=YOUR_API_KEY
   ```

---

## 📚 Endpoints

### 1. Get Stream URL

Retrieve streaming URLs for movies or TV shows.

**Endpoint:** `GET /cdn`

**Authentication:** ✅ Required

**Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `sourceId` | string | ✅ | Provider ID | `cloudnestra` |
| `tmdbId` | string | ✅ | TMDB ID | `550` |
| `type` | string | ✅ | Media type | `movie` or `show` |
| `season` | number | ❌ | Season number (TV shows only) | `1` |
| `episode` | number | ❌ | Episode number (TV shows only) | `1` |
| `force` | boolean | ❌ | Bypass cache | `true` |

**Example Requests:**

```bash
# Movie
curl -H "x-api-key: YOUR_KEY" \
  "https://api.example.com/cdn?sourceId=cloudnestra&tmdbId=550&type=movie"

# TV Show Episode
curl -H "x-api-key: YOUR_KEY" \
  "https://api.example.com/cdn?sourceId=lookmovie&tmdbId=1399&type=show&season=1&episode=1"

# Force refresh (bypass cache)
curl -H "x-api-key: YOUR_KEY" \
  "https://api.example.com/cdn?sourceId=cloudnestra&tmdbId=550&type=movie&force=true"
```

**Response:**

```json
{
  "stream": [
    {
      "id": "vidsrc-cloudnestra-0",
      "type": "hls",
      "playlist": "https://api.example.com/s/abc123def456...",
      "headers": {},
      "proxyDepth": 2,
      "flags": [],
      "captions": []
    }
  ],
  "embeds": []
}
```

**Response Fields:**

- `stream` - Array of available streams
  - `id` - Unique stream identifier
  - `type` - Stream type (`hls` for HLS streams)
  - `playlist` - **Proxied** stream URL (use this in your player)
  - `headers` - Empty (headers handled server-side)
  - `proxyDepth` - Proxy chain depth
  - `flags` - Stream flags
  - `captions` - Available subtitles

---

### 2. List Available Sources

Get all available provider sources.

**Endpoint:** `GET /sources`

**Authentication:** ✅ Required

**Example Request:**

```bash
curl -H "x-api-key: YOUR_KEY" \
  "https://api.example.com/sources"
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

**Response Fields:**

- `id` - Provider ID (use in `/cdn` requests)
- `name` - Display name
- `type` - Provider type (`source` or `embed`)
- `rank` - Priority ranking (higher = better)

---

### 3. Provider Status

Check health status of all providers.

**Endpoint:** `GET /status`

**Authentication:** ❌ Public

**Example Request:**

```bash
curl "https://api.example.com/status"
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
    "status": "degraded",
    "responseTime": 3456,
    "uptime": 67.2
  }
}
```

**Status Values:**

- `operational` - Working normally (>80% uptime)
- `degraded` - Experiencing issues (50-80% uptime)
- `offline` - Not working (<50% uptime)
- `untested` - No requests yet

**Response Fields:**

- `status` - Provider health status
- `responseTime` - Average response time in milliseconds
- `uptime` - Success rate percentage

---

## 🎥 Using Stream URLs

### HLS Playback

The API returns **proxied HLS URLs** that hide the real source. Use them directly in any HLS player:

**JavaScript (Hls.js):**

```javascript
const hls = new Hls();
hls.loadSource('https://api.example.com/s/abc123...');
hls.attachMedia(video);
```

**HTML5 Video (Safari):**

```html
<video src="https://api.example.com/s/abc123..." controls></video>
```

**React (react-player):**

```jsx
<ReactPlayer 
  url="https://api.example.com/s/abc123..." 
  playing 
  controls 
/>
```

### Important Notes

1. **No Headers Required** - The proxy handles all headers server-side
2. **CORS Enabled** - Works from any domain
3. **Time-Limited** - Tokens expire after 4 hours
4. **Single-Use** - Each request generates fresh tokens
5. **Cached** - Results cached for 4 hours (use `force=true` to bypass)

---

## 🔍 Finding TMDB IDs

TMDB IDs are required for all content requests.

**Methods:**

1. **TMDB Website:**
   - Visit https://www.themoviedb.org/
   - Search for your content
   - ID is in the URL: `themoviedb.org/movie/550` → ID is `550`

2. **TMDB API:**
   ```bash
   # Search by title
   curl "https://api.themoviedb.org/3/search/movie?api_key=YOUR_TMDB_KEY&query=Fight+Club"
   ```

3. **Popular IDs:**
   - Fight Club: `550`
   - Inception: `27205`
   - The Matrix: `603`
   - Breaking Bad: `1396`
   - Game of Thrones: `1399`

---

## 📊 Response Codes

| Code | Status | Description |
|------|--------|-------------|
| `200` | Success | Stream found and returned |
| `401` | Unauthorized | Invalid or missing API key |
| `404` | Not Found | Stream not found or unavailable |
| `500` | Server Error | Internal error during scraping |

---

## ⚠️ Error Handling

**Error Response Format:**

```json
{
  "error": "Error message here"
}
```

**Common Errors:**

1. **"Unauthorized"**
   - Missing or invalid API key
   - Solution: Check your API key

2. **"Couldn't find a stream"**
   - Content not available on this provider
   - Solution: Try different `sourceId` or check `/status`

3. **"Not found"**
   - Invalid TMDB ID or content doesn't exist
   - Solution: Verify TMDB ID

---

## 💡 Best Practices

### 1. Provider Selection

Check `/status` endpoint to choose best provider:

```javascript
const status = await fetch('https://api.example.com/status');
const providers = await status.json();

// Find operational provider
const bestProvider = Object.entries(providers)
  .filter(([_, data]) => data.status === 'operational')
  .sort((a, b) => b[1].uptime - a[1].uptime)[0];

console.log('Best provider:', bestProvider[0]);
```

### 2. Fallback Strategy

Try multiple providers if first fails:

```javascript
const providers = ['cloudnestra', 'lookmovie', 'vidsrc'];

for (const provider of providers) {
  try {
    const response = await fetch(
      `https://api.example.com/cdn?sourceId=${provider}&tmdbId=550&type=movie`,
      { headers: { 'x-api-key': 'YOUR_KEY' } }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.stream?.length > 0) {
        return data.stream[0].playlist;
      }
    }
  } catch (error) {
    continue; // Try next provider
  }
}
```

### 3. Caching

- Results are cached for 4 hours
- Use `force=true` only when necessary
- Reduces load on source providers

### 4. Rate Limiting

- Be respectful with request frequency
- Cache results on your end when possible
- Don't spam the API

---

## 🌐 Integration Examples

### JavaScript/TypeScript

```typescript
interface StreamResponse {
  stream: Array<{
    id: string;
    type: string;
    playlist: string;
    headers: Record<string, string>;
  }>;
}

async function getStream(tmdbId: string, type: 'movie' | 'show'): Promise<string | null> {
  const response = await fetch(
    `https://api.example.com/cdn?sourceId=cloudnestra&tmdbId=${tmdbId}&type=${type}`,
    {
      headers: {
        'x-api-key': process.env.API_KEY!
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch stream');
  }

  const data: StreamResponse = await response.json();
  return data.stream[0]?.playlist || null;
}
```

### Python

```python
import requests

def get_stream(tmdb_id: str, media_type: str) -> str:
    response = requests.get(
        f"https://api.example.com/cdn",
        params={
            "sourceId": "cloudnestra",
            "tmdbId": tmdb_id,
            "type": media_type
        },
        headers={
            "x-api-key": "YOUR_API_KEY"
        }
    )
    
    response.raise_for_status()
    data = response.json()
    
    return data["stream"][0]["playlist"]
```

### PHP

```php
<?php
function getStream($tmdbId, $type) {
    $url = "https://api.example.com/cdn?" . http_build_query([
        'sourceId' => 'cloudnestra',
        'tmdbId' => $tmdbId,
        'type' => $type
    ]);
    
    $options = [
        'http' => [
            'header' => "x-api-key: YOUR_API_KEY\r\n"
        ]
    ];
    
    $context = stream_context_create($options);
    $response = file_get_contents($url, false, $context);
    $data = json_decode($response, true);
    
    return $data['stream'][0]['playlist'];
}
?>
```

---

## 🔒 Security

### Stream URL Protection

- All source URLs are **completely hidden**
- Proxied through server with obfuscated tokens
- Headers injected server-side
- Tokens expire after use
- No way to reverse-engineer source

### API Key Security

- **Never expose** your API key in client-side code
- Use environment variables
- Rotate keys periodically
- Use server-side proxy for client apps

---

## 📞 Support

**Issues?**
- Check `/status` endpoint for provider health
- Verify TMDB ID is correct
- Try different provider
- Check API key is valid

**Rate Limits:**
- No hard limits currently
- Please be reasonable with requests
- Cache results when possible

---

## 📝 Changelog

### v1.0.0
- Initial API release
- Stream proxy with URL obfuscation
- Redis caching (4-hour TTL)
- Provider status monitoring
- Multi-provider support

---

**API Version:** 1.0.0  
**Last Updated:** 2025-11-25  
**Base URL:** `https://your-api-domain.com`
