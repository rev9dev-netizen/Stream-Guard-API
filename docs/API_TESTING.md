# API Testing Guide

## Prerequisites
- Server running on `http://localhost:3000`
- API Key: `dev-secret-key` (from `.env`)

## Test Endpoints

### 1. List Available Sources
```bash
curl -X GET "http://localhost:3000/sources" -H "x-api-key: your-secret-api-key"
```

Expected Response:
```json
[
  {
    "id": "cloudnestra",
    "name": "Cloudnestra",
    "rank": 180,
    "type": "source",
    "mediaTypes": ["movie", "show"]
  }
]
```

### 2. Test Status Endpoint
```bash
curl -X GET "http://localhost:3000/status" -H "x-api-key: dev-secret-key"
```

Expected Response:
```json
{}
```
(Empty initially, will populate as you make requests)

### 2. Test CDN Endpoint - Movie
```bash
curl -X GET "http://localhost:3000/cdn?sourceId=cloudnestra&tmdbId=653346&type=movie" -H "x-api-key: your-secret-api-key"
```

### 3. Test CDN Endpoint - TV Show
```bash
curl -X GET "http://localhost:3000/cdn?sourceId=cloudnestra&tmdbId=94997&type=show&season=1&episode=1" -H "x-api-key: your-secret-api-key"
```

### 4. Test Cache Bypass
```bash
curl -X GET "http://localhost:3000/cdn?sourceId=cloudnestra&tmdbId=653346&type=movie&force=true" -H "x-api-key: your-secret-api-key"
```

### 5. Test Unauthorized Access (should fail)
```bash
curl -X GET "http://localhost:3000/cdn?sourceId=cloudnestra&tmdbId=653346&type=movie"
```

Expected Response:
```json
{"error":"Unauthorized: Invalid API Key"}
```

## Using PowerShell (Windows)

### Status Check
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/status" -Headers @{"x-api-key"="dev-secret-key"}
```

### Get Stream URL
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/cdn?sourceId=vidsrc-cloudnestra&tmdbId=653346&type=movie" -Headers @{"x-api-key"="dev-secret-key"}
```

## Response Format

Successful CDN response:
```json
{
  "stream": [
    {
      "id": "vidsrc-cloudnestra-0",
      "type": "hls",
      "playlist": "https://tmstr2.shadowlandschronicles.com/pl/...",
      "headers": {
        "referer": "https://cloudnestra.com/",
        "origin": "https://cloudnestra.com"
      },
      "proxyDepth": 2,
      "flags": [],
      "captions": []
    }
  ],
  "embeds": []
}
```
