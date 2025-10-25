# Cloudflare Workers Proxy Setup Guide

## 📋 Overview

This proxy bypasses Cloudflare's blocking of Render.com IP addresses when accessing the Replicate API.

**Architecture:**
```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Render.com │ ───► │ Cloudflare Worker│ ───► │  Replicate  │
│   (Bot)     │      │    (Proxy)       │      │     API     │
└─────────────┘      └──────────────────┘      └─────────────┘
 54.x.x.x            Cloudflare Edge IP        ✅ Not blocked
 ❌ Blocked           ✅ Trusted by CF
```

---

## 🚀 Step 1: Deploy Cloudflare Worker

### 1.1. Create Cloudflare Account
1. Go to [https://dash.cloudflare.com/](https://dash.cloudflare.com/)
2. Sign up or log in
3. Navigate to **Workers & Pages**

### 1.2. Create New Worker
1. Click **Create Application**
2. Choose **Create Worker**
3. Name: `replicate-proxy` (or any name)
4. Click **Deploy**

### 1.3. Edit Worker Code
1. After deployment, click **Edit Code**
2. Delete the default code
3. Copy the entire contents of `cloudflare-worker/replicate-proxy.js`
4. Paste into the worker editor
5. Click **Save and Deploy**

### 1.4. Set Environment Variable
1. Go to **Settings** → **Variables**
2. Add **Environment Variable**:
   - **Name**: `PROXY_SECRET_KEY`
   - **Value**: Generate a strong random string (e.g., `openssl rand -hex 32`)
   - **Type**: Secret (encrypted)
3. Click **Save**

### 1.5. Copy Worker URL
1. Go back to worker overview
2. Copy the worker URL (e.g., `https://replicate-proxy.your-username.workers.dev`)
3. **Save this URL** - you'll need it for Render.com

**Example Worker URL:**
```
https://replicate-proxy.kevindori.workers.dev
```

---

## 🔧 Step 2: Configure Render.com Environment Variables

### 2.1. Go to Render Dashboard
1. Open [https://dashboard.render.com/](https://dashboard.render.com/)
2. Select your bot service (`bot-telegram`)
3. Go to **Environment** tab

### 2.2. Add Proxy Variables
Add these two new environment variables:

| Key | Value | Example |
|-----|-------|---------|
| `REPLICATE_PROXY_URL` | Your Cloudflare Worker URL | `https://replicate-proxy.kevindori.workers.dev` |
| `REPLICATE_PROXY_AUTH` | Same secret key from Step 1.4 | `abc123def456...` |

### 2.3. Save and Redeploy
1. Click **Save Changes**
2. Render will automatically redeploy (takes 2-3 minutes)
3. Watch the logs for: `✅ Replicate service initialized with Cloudflare Workers proxy`

---

## 🧪 Step 3: Test the Proxy

### 3.1. Use Telegram Bot
1. Open Telegram
2. Find `@MultifulDobi_bot`
3. Send admin command: `/test_replicate`
4. Wait for result (up to 30 seconds)

### 3.2. Expected Success Output
```
✅ Replicate API 테스트 성공!
🎯 결과:
• 생성 시간: 12.34초
• 이미지 URL: ✅ 생성됨
• 서버: Render.com
• Cloudflare: ✅ 차단 해제됨
```

### 3.3. Check Render Logs
Look for these log messages:
```
✅ Replicate service initialized with Cloudflare Workers proxy
🔄 Proxying request: https://api.replicate.com/v1/predictions...
✅ NSFW image generated successfully
```

### 3.4. Check Cloudflare Worker Logs
1. Go to Cloudflare Dashboard → Workers
2. Click on `replicate-proxy`
3. Go to **Logs** (Real-time Logs)
4. You should see:
   ```
   Proxying POST https://api.replicate.com/v1/predictions
   ```

---

## 🔍 Troubleshooting

### Issue 1: Still Getting 403 Forbidden

**Possible Causes:**
1. Worker URL incorrect in Render.com
2. Secret key mismatch between Cloudflare and Render
3. Worker not deployed

**Solution:**
```bash
# Check Render logs for:
✅ Replicate service initialized with Cloudflare Workers proxy

# If you see:
✅ Replicate service initialized with direct connection
# → Proxy variables not set correctly
```

### Issue 2: 401 Unauthorized from Proxy

**Cause:** `X-Proxy-Auth` header doesn't match `PROXY_SECRET_KEY`

**Solution:**
1. Verify both secrets are identical
2. Regenerate secret and update both places
3. Redeploy Render service

### Issue 3: Worker Not Responding

**Cause:** Worker not deployed or crashed

**Solution:**
1. Check Cloudflare Worker logs
2. Test worker directly:
   ```bash
   curl -H "X-Proxy-Auth: YOUR_SECRET" \
     "https://your-worker.workers.dev?target=https://api.replicate.com/v1/predictions"
   ```
3. Expected: 401 (need valid API token) or 200

---

## 📊 Monitoring

### Cloudflare Dashboard
- **Requests**: See request count and success rate
- **Logs**: Real-time request/response logs
- **Errors**: Track any worker errors

### Render Dashboard
- **Logs**: Check for proxy initialization message
- **Metrics**: Monitor API latency (should be similar to before)

### Expected Metrics
- **Latency increase**: ~50-100ms (Cloudflare edge routing)
- **Success rate**: Should match direct connection (~99%)
- **Cost**: FREE (Cloudflare Workers free tier: 100K requests/day)

---

## 💰 Costs

### Cloudflare Workers Free Tier
- **Requests**: 100,000 per day
- **CPU Time**: 10ms per request
- **Cost**: $0

**Our Usage:**
- ~1,000 Replicate API calls/day (estimate)
- Well within free tier limits

### Paid Plan (if needed)
- **$5/month**: 10 million requests
- Only needed if exceeding 100K requests/day

---

## 🔒 Security

### Authentication
- Secret key (`PROXY_SECRET_KEY`) required for all requests
- Only your bot can access the proxy

### Restrictions
- Only allows `api.replicate.com` domain
- All other domains are blocked (403 Forbidden)

### Headers
- `X-Proxy-Auth` is removed before forwarding to Replicate
- Standard security headers added

---

## 🔄 Fallback Behavior

The bot automatically falls back to direct connection if proxy variables are not set:

```typescript
// Proxy configured:
REPLICATE_PROXY_URL=https://...
REPLICATE_PROXY_AUTH=abc123
// → Uses proxy

// Proxy NOT configured:
// → Uses direct connection (may fail with 403)
```

This allows gradual rollout and easy rollback if needed.

---

## 📝 Checklist

- [ ] Cloudflare Worker created
- [ ] Worker code deployed from `cloudflare-worker/replicate-proxy.js`
- [ ] `PROXY_SECRET_KEY` environment variable set
- [ ] Worker URL copied
- [ ] `REPLICATE_PROXY_URL` added to Render.com
- [ ] `REPLICATE_PROXY_AUTH` added to Render.com
- [ ] Render service redeployed
- [ ] `/test_replicate` command successful
- [ ] Cloudflare Worker logs show requests
- [ ] Render logs show proxy initialization

---

## 🎯 Success Criteria

You'll know the proxy is working when:

1. ✅ Render logs: `Replicate service initialized with Cloudflare Workers proxy`
2. ✅ Test command: `/test_replicate` returns success
3. ✅ Cloudflare logs: Shows proxied requests
4. ✅ No more 403 Forbidden errors from Replicate API

---

## 📞 Support

If you still encounter issues after following this guide:

1. **Discord**: Post in Replicate Discord #help channel
2. **Email**: support@replicate.com (include Worker URL and error details)
3. **Render**: support@render.com (if Worker setup fails)

---

*Last updated: 2025-01-10*
*Related files:*
- `cloudflare-worker/replicate-proxy.js` - Worker code
- `src/services/replicate-service.ts` - Bot integration
- `docs/RENDER_NSFW_API_ISSUE.md` - Original issue documentation
