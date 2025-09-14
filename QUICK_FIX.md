# 🚨 URGENT FIX REQUIRED

## Problem
- Netlify free tier has a **hard 10-second timeout limit**
- Image generation takes 20-30 seconds
- Bot times out before completing the request

## Solution Options

### Option 1: Upgrade Netlify Plan
- Upgrade to Netlify Pro ($19/month) for 26-second timeout
- This would allow image generation to complete

### Option 2: Use Background Functions (Netlify Functions)
- Requires Netlify Functions Background (paid feature)

### Option 3: Deploy to Different Platform
- **Vercel**: 10 seconds on free tier, 60 seconds on Pro
- **Railway**: No function timeout limits
- **Render**: 15 minutes timeout on free tier
- **Fly.io**: Configurable timeouts

### Option 4: Use Queue System
- Return immediately with "processing" message
- Process image generation asynchronously
- Send result via Telegram API directly (not through webhook)

## Immediate Actions

1. **Apply Database Fixes First**:
```bash
# Run this on Supabase SQL Editor
-- Copy contents from apply-urgent-fixes.sql
```

2. **Consider Platform Migration**:
   - **Render** seems best for free tier with long timeouts
   - **Railway** also good but requires credit card

3. **Temporary Workaround**:
   - Reduce image quality/size to speed up generation
   - Use smaller models if available

## Database Fix (Run Immediately)

```sql
-- Add missing columns
ALTER TABLE tracked_messages
ADD COLUMN IF NOT EXISTS contains_media BOOLEAN DEFAULT FALSE;

-- Create missing table
CREATE TABLE IF NOT EXISTS prompt_usage_analytics (
    id BIGSERIAL PRIMARY KEY,
    prompt_id BIGINT REFERENCES prompts(id) ON DELETE CASCADE,
    user_id BIGINT,
    chat_id BIGINT,
    template_variables_used JSONB,
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add other missing columns
ALTER TABLE user_chat_tracking
ADD COLUMN IF NOT EXISTS tracking_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tracking_stopped_at TIMESTAMPTZ;

ALTER TABLE tracking_sessions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS username TEXT;
```