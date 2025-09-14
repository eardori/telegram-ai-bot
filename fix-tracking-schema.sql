-- =============================================================================
-- Fix Missing Columns in Tracking Schema
-- Adds the missing columns that are causing tracking system failures
-- =============================================================================

-- Add missing columns to user_chat_tracking table
ALTER TABLE user_chat_tracking
ADD COLUMN IF NOT EXISTS tracking_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tracking_stopped_at TIMESTAMPTZ;

-- Add missing columns to tracking_sessions table
ALTER TABLE tracking_sessions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS username TEXT;

-- Update any existing tracking_sessions that don't have expires_at set
UPDATE tracking_sessions
SET expires_at = started_at + INTERVAL '7 days'
WHERE expires_at IS NULL;

-- Verify the columns were added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_chat_tracking'
        AND column_name = 'tracking_stopped_at'
    ) THEN
        RAISE NOTICE '✅ tracking_stopped_at column added to user_chat_tracking';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tracking_sessions'
        AND column_name = 'expires_at'
    ) THEN
        RAISE NOTICE '✅ expires_at column added to tracking_sessions';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tracking_sessions'
        AND column_name = 'first_name'
    ) THEN
        RAISE NOTICE '✅ first_name, last_name, username columns added to tracking_sessions';
    END IF;

    RAISE NOTICE '🎉 Tracking schema fix completed!';
END $$;