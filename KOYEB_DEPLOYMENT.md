# 🚀 Koyeb Deployment Guide

## Prerequisites

1. **GitHub Account** - To host your code
2. **Koyeb Account** - Sign up at https://www.koyeb.com (free tier available)
3. **Upstash Redis** - Get free Redis at https://upstash.com
4. **Cloudflare Turnstile** (Optional) - Get keys at https://dash.cloudflare.com

## Step 1: Prepare Your Repository

### 1.1 Create GitHub Repository

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - VidNinja Providers API"

# Create repository on GitHub (via web interface)
# Then add remote and push
git remote add origin https://github.com/YOUR_USERNAME/vidninja-api.git
git branch -M main
git push -u origin main
```

### 1.2 Verify Required Files

Make sure these files exist in your repo:
- ✅ `Dockerfile` - Docker configuration
- ✅ `.dockerignore` - Files to exclude from build
- ✅ `package.json` - Dependencies
- ✅ `pnpm-lock.yaml` - Lock file
- ✅ `src/` - Source code
- ✅ `.env.example` - Environment template

## Step 2: Set Up Upstash Redis

### 2.1 Create Redis Database

1. Go to https://console.upstash.com/
2. Click **"Create Database"**
3. Choose:
   - **Name:** vidninja-cache
   - **Region:** Choose closest to your users
   - **Type:** Regional (free tier)
4. Click **"Create"**

### 2.2 Get Redis Credentials

1. Click on your database
2. Copy these values:
   - **UPSTASH_REDIS_REST_URL** - `https://xxx.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN** - Long token string

## Step 3: Deploy to Koyeb

### 3.1 Create Koyeb Account

1. Go to https://app.koyeb.com/
2. Sign up (free tier available)
3. Verify your email

### 3.2 Create New App

1. Click **"Create App"**
2. Choose **"GitHub"** as source
3. Connect your GitHub account
4. Select your repository: `vidninja-api`
5. Choose branch: `main`

### 3.3 Configure Build

**Builder:** Docker

**Dockerfile:** `Dockerfile` (auto-detected)

**Port:** `3000`

### 3.4 Set Environment Variables

Click **"Environment Variables"** and add:

```env
# Required
API_KEY=your-secure-random-key-here
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token-here

# Security
ALLOWED_DOMAINS=your-frontend-domain.com,app.yourdomain.com

# Cloudflare (Optional)
CLOUDFLARE_MODE=false
CLOUDFLARE_STRICT=false
CLOUDFLARE_TURNSTILE_ENABLED=false
CLOUDFLARE_TURNSTILE_SITE_KEY=your-site-key
CLOUDFLARE_TURNSTILE_SECRET_KEY=your-secret-key
```

**Generate secure API_KEY:**
```bash
# On Linux/Mac
openssl rand -hex 32

# On Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### 3.5 Configure Instance

**Instance Type:** Free (or choose based on needs)

**Regions:** Choose closest to your users

**Scaling:** 
- Min instances: 1
- Max instances: 1 (free tier)

### 3.6 Deploy

1. Click **"Deploy"**
2. Wait 5-10 minutes for build
3. Watch build logs for errors

## Step 4: Verify Deployment

### 4.1 Get Your URL

After deployment, you'll get a URL like:
```
https://your-app-name.koyeb.app
```

### 4.2 Test Endpoints

**Test Status (Public):**
```bash
curl https://your-app-name.koyeb.app/status
```

**Test Sources (Requires API Key):**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  https://your-app-name.koyeb.app/sources
```

**Test Stream:**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://your-app-name.koyeb.app/cdn?sourceId=cloudnestra&tmdbId=550&type=movie"
```

**Test UI:**
```
https://your-app-name.koyeb.app/test
```

## Step 5: Configure Custom Domain (Optional)

### 5.1 Add Domain in Koyeb

1. Go to your app settings
2. Click **"Domains"**
3. Click **"Add Domain"**
4. Enter your domain: `api.yourdomain.com`

### 5.2 Update DNS

Add CNAME record in your DNS provider:

```
Type: CNAME
Name: api
Value: your-app-name.koyeb.app
TTL: 3600
```

### 5.3 Update Environment Variables

Update `ALLOWED_DOMAINS`:
```env
ALLOWED_DOMAINS=yourdomain.com,app.yourdomain.com
```

## Step 6: Enable Cloudflare Protection (Recommended)

### 6.1 Add Site to Cloudflare

1. Go to https://dash.cloudflare.com/
2. Click **"Add Site"**
3. Enter your domain
4. Choose free plan
5. Update nameservers at your domain registrar

### 6.2 Configure Cloudflare

**SSL/TLS:** Full (Strict)

**Security Level:** Medium or High

**Bot Fight Mode:** Enabled

**DDoS Protection:** Enabled

### 6.3 Enable Turnstile (Optional)

1. Go to Turnstile section
2. Create site
3. Copy Site Key and Secret Key
4. Update Koyeb environment variables:

```env
CLOUDFLARE_TURNSTILE_ENABLED=true
CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAA...
CLOUDFLARE_TURNSTILE_SECRET_KEY=0x4AAA...
```

### 6.4 Enable Cloudflare Validation

```env
CLOUDFLARE_MODE=true
CLOUDFLARE_STRICT=true
```

## Troubleshooting

### Build Fails

**Check build logs:**
1. Go to your app in Koyeb
2. Click **"Deployments"**
3. Click on failed deployment
4. Check logs for errors

**Common issues:**
- Missing dependencies in `package.json`
- Syntax errors in code
- Missing environment variables

### App Crashes

**Check runtime logs:**
1. Go to your app
2. Click **"Logs"**
3. Look for error messages

**Common issues:**
- Invalid Redis credentials
- Missing API_KEY
- Port not set to 3000

### Redis Connection Fails

**Verify credentials:**
```bash
# Test Redis connection
curl -X POST https://your-redis.upstash.io/get/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Check:**
- URL format: `https://xxx.upstash.io` (no trailing slash)
- Token is correct
- Database is active

### Streams Don't Play

**Check:**
1. API key is correct
2. `ALLOWED_DOMAINS` includes your frontend domain
3. CORS is enabled (already configured)
4. Cloudflare isn't blocking requests

## Updating Your App

### Push Updates to GitHub

```bash
# Make changes
git add .
git commit -m "Update: description of changes"
git push origin main
```

Koyeb will automatically rebuild and redeploy!

### Manual Redeploy

1. Go to your app in Koyeb
2. Click **"Redeploy"**
3. Wait for build to complete

## Monitoring

### View Logs

```bash
# In Koyeb dashboard
App → Logs → Real-time logs
```

### Monitor Performance

```bash
# In Koyeb dashboard
App → Metrics → CPU, Memory, Network
```

### Check Redis Usage

```bash
# In Upstash dashboard
Database → Metrics → Commands, Memory
```

## Cost Estimate

### Free Tier (Koyeb)
- ✅ 1 service
- ✅ 512MB RAM
- ✅ 2GB storage
- ✅ Enough for testing/small projects

### Paid Tier (if needed)
- **Nano:** $5.50/month - 1GB RAM
- **Micro:** $11/month - 2GB RAM
- **Small:** $22/month - 4GB RAM

### Upstash Redis
- **Free:** 10,000 commands/day
- **Pay-as-you-go:** $0.20 per 100K commands

## Security Checklist

Before going live:

- [ ] Strong `API_KEY` set (32+ characters)
- [ ] `ALLOWED_DOMAINS` configured
- [ ] Upstash Redis credentials valid
- [ ] Cloudflare enabled (recommended)
- [ ] Turnstile enabled (recommended)
- [ ] Custom domain configured
- [ ] HTTPS enabled (automatic with Koyeb)
- [ ] Rate limiting active (built-in)
- [ ] Test all endpoints
- [ ] Monitor logs for errors

## Summary

**Deployment Steps:**
1. ✅ Push code to GitHub
2. ✅ Create Upstash Redis
3. ✅ Deploy to Koyeb
4. ✅ Set environment variables
5. ✅ Test endpoints
6. ✅ Configure custom domain (optional)
7. ✅ Enable Cloudflare (recommended)

**Your API will be live at:**
```
https://your-app-name.koyeb.app
```

With:
- ✅ Automatic HTTPS
- ✅ Auto-scaling
- ✅ Zero-downtime deployments
- ✅ Automatic restarts
- ✅ Built-in monitoring
- ✅ Free tier available

🚀 **Ready for production!**
