# 🔐 Cloudflare Turnstile Setup Guide

## What is Cloudflare Turnstile?

Cloudflare Turnstile is a CAPTCHA alternative that protects your API from bots without annoying users. It's **free** and much better than traditional CAPTCHAs.

## Step 1: Get Turnstile Keys

### 1. Go to Cloudflare Dashboard
Visit: https://dash.cloudflare.com/

### 2. Navigate to Turnstile
- Click on your account
- Go to **Turnstile** in the sidebar
- Or visit: `https://dash.cloudflare.com/?to=/:account/turnstile`

### 3. Create a Site
- Click **"Add Site"**
- **Site Name:** VidNinja API
- **Domain:** `your-koyeb-domain.koyeb.app` (or your custom domain)
- **Widget Mode:** Choose one:
  - **Managed** (Recommended) - Automatic challenge level
  - **Non-Interactive** - Invisible, runs in background
  - **Invisible** - No visible widget

### 4. Copy Your Keys
You'll get two keys:
- **Site Key** (Public) - Used in frontend
- **Secret Key** (Private) - Used in backend

## Step 2: Configure Environment Variables

Add to your `.env` file:

```env
CLOUDFLARE_TURNSTILE_ENABLED=true
CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAA...
CLOUDFLARE_TURNSTILE_SECRET_KEY=0x4AAA...
```

## Step 3: Frontend Integration

### For Your Frontend App

Add Turnstile widget to your frontend:

```html
<!-- Add Turnstile script -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

<!-- Add widget where you want the challenge -->
<div class="cf-turnstile" 
     data-sitekey="YOUR_SITE_KEY"
     data-callback="onTurnstileSuccess">
</div>

<script>
function onTurnstileSuccess(token) {
  // Token is automatically generated
  // Use it in your API requests
  console.log('Turnstile token:', token);
}
</script>
```

### Making API Requests with Turnstile

**Method 1: Header (Recommended)**
```javascript
const token = getTurnstileToken(); // From widget

fetch('https://your-api.com/cdn?sourceId=cloudnestra&tmdbId=550&type=movie', {
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'cf-turnstile-token': token
  }
});
```

**Method 2: Query Parameter**
```javascript
const token = getTurnstileToken();

fetch(`https://your-api.com/cdn?sourceId=cloudnestra&tmdbId=550&type=movie&turnstileToken=${token}`, {
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
});
```

## Step 4: Update test-api.html

Add Turnstile to your test page:

```html
<head>
  <!-- Add Turnstile script -->
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>

<body>
  <!-- Add widget in controls panel -->
  <div class="form-group">
    <label>Security Challenge</label>
    <div class="cf-turnstile" 
         data-sitekey="YOUR_SITE_KEY"
         data-callback="onTurnstileSuccess">
    </div>
  </div>

  <script>
    let turnstileToken = '';

    function onTurnstileSuccess(token) {
      turnstileToken = token;
      console.log('Turnstile verified!');
    }

    // Update testCDN function to include token
    async function testCDN() {
      const response = await fetch(url, {
        headers: {
          'x-api-key': apiKey,
          'cf-turnstile-token': turnstileToken
        }
      });
      // ...
    }
  </script>
</body>
```

## How It Works

### For Allowed Domains (ALLOWED_DOMAINS)

1. **Without Token:** ✅ Allowed (trusted domain)
2. **With Valid Token:** ✅ Allowed
3. **With Invalid Token:** ❌ Blocked

### For Other Domains

1. **Without Token:** ❌ Blocked - "Challenge required"
2. **With Valid Token:** ✅ Allowed
3. **With Invalid Token:** ❌ Blocked

## Security Levels

### Managed Mode (Recommended)
- Automatically adjusts difficulty
- Shows challenge only when suspicious
- Best user experience

### Non-Interactive Mode
- Runs in background
- No user interaction needed
- Invisible to users

### Invisible Mode
- Completely hidden
- Verifies automatically
- Best for APIs

## Testing

### Test with Valid Token

```bash
# Get token from Turnstile widget first
curl -H "x-api-key: YOUR_KEY" \
     -H "cf-turnstile-token: TOKEN_FROM_WIDGET" \
     "https://your-api.com/cdn?sourceId=cloudnestra&tmdbId=550&type=movie"
```

### Test without Token (Should Fail)

```bash
curl -H "x-api-key: YOUR_KEY" \
     "https://your-api.com/cdn?sourceId=cloudnestra&tmdbId=550&type=movie"
```

Expected Response:
```json
{
  "error": "Challenge required",
  "message": "Please complete the security challenge"
}
```

## Error Responses

### Missing Token (403)
```json
{
  "error": "Challenge required",
  "message": "Please complete the security challenge"
}
```

### Invalid Token (403)
```json
{
  "error": "Invalid challenge response"
}
```

### Verification Failed (500)
```json
{
  "error": "Challenge verification failed"
}
```

## Production Deployment

### 1. Set Environment Variables on Koyeb

```env
CLOUDFLARE_TURNSTILE_ENABLED=true
CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAA...
CLOUDFLARE_TURNSTILE_SECRET_KEY=0x4AAA...
ALLOWED_DOMAINS=yourdomain.com,app.yourdomain.com
```

### 2. Update Frontend

Add Turnstile widget to all pages that call the API.

### 3. Test Thoroughly

- Test with valid tokens
- Test without tokens
- Test from allowed domains
- Test from unauthorized domains

## Benefits

✅ **Blocks Bots** - Automated scrapers can't pass  
✅ **Allows Humans** - Legitimate users pass easily  
✅ **Whitelisted Domains** - Your frontend works seamlessly  
✅ **Free** - No cost for Cloudflare Turnstile  
✅ **Better than CAPTCHA** - No annoying puzzles  
✅ **Privacy-Friendly** - No tracking or data collection  

## Monitoring

Watch server logs for Turnstile activity:

```
[TURNSTILE] Allowed domain without token: https://yourdomain.com
[TURNSTILE] Invalid token from: 192.168.1.1
[TURNSTILE] Missing token from: 203.0.113.0
[TURNSTILE] Verification failed: ['invalid-input-response']
```

## Troubleshooting

### "Secret key not configured"
- Add `CLOUDFLARE_TURNSTILE_SECRET_KEY` to `.env`

### "Invalid challenge response"
- Token expired (valid for 5 minutes)
- Token already used
- Wrong secret key

### "Challenge required"
- Frontend didn't send token
- Token missing from request

## Summary

With Cloudflare Turnstile enabled:

1. **Your Frontend** → Passes automatically (whitelisted domain)
2. **Bots/Scrapers** → Blocked (no valid token)
3. **Legitimate Users** → Complete simple challenge
4. **API Abuse** → Prevented

This makes your API **extremely difficult to scrape** while keeping it accessible to your legitimate users! 🛡️

---

**Next Steps:**
1. Get Turnstile keys from Cloudflare
2. Add to `.env`
3. Update frontend with widget
4. Deploy and test!
