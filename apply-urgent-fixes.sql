-- URGENT DATABASE FIXES
-- Run this immediately on Supabase to fix bot functionality

-- 1. Add missing column to tracked_messages
ALTER TABLE tracked_messages
ADD COLUMN IF NOT EXISTS contains_media BOOLEAN DEFAULT FALSE;

-- 2. Create prompt_usage_analytics table (renamed from prompt_usage)
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

-- 3. Add missing columns to tracking tables
ALTER TABLE user_chat_tracking
ADD COLUMN IF NOT EXISTS tracking_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tracking_stopped_at TIMESTAMPTZ;

ALTER TABLE tracking_sessions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS username TEXT;

-- 4. Verify prompts exist
SELECT prompt_name, prompt_type, is_active
FROM prompts
WHERE prompt_name LIKE 'dobby_%';

-- If no results, run fix-prompts.sql file