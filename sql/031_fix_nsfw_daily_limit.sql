-- ============================================
-- Fix NSFW Daily Limit NULL Handling
-- ============================================
-- Purpose: Add COALESCE to handle NULL nsfw_daily_limit values
-- Issue: Users with NULL nsfw_daily_limit get incorrectly blocked (0 < NULL = false)
-- Solution: Use COALESCE to default to 5 if NULL
-- Created: 2025-01-10

-- ============================================
-- Step 1: Fix check_nsfw_daily_limit function
-- ============================================

DROP FUNCTION IF EXISTS check_nsfw_daily_limit(BIGINT);

CREATE OR REPLACE FUNCTION check_nsfw_daily_limit(
    p_user_id BIGINT
) RETURNS TABLE(
    can_use BOOLEAN,
    remaining_count INTEGER,
    daily_limit INTEGER,
    used_today INTEGER
) AS $$
DECLARE
    v_user_limit INTEGER;
    v_is_vip BOOLEAN;
    v_used_today INTEGER;
BEGIN
    -- Get user limits and VIP status
    SELECT
        COALESCE(u.nsfw_daily_limit, 5),  -- ✅ NULL 방어 추가!
        COALESCE(s.is_active, false) as is_vip
    INTO v_user_limit, v_is_vip
    FROM users u
    LEFT JOIN subscriptions s ON u.id = s.user_id
        AND s.status = 'active'
        AND s.end_date > NOW()
    WHERE u.id = p_user_id;

    -- VIP users have no limit
    IF v_is_vip THEN
        RETURN QUERY SELECT
            true as can_use,
            999999 as remaining_count,
            999999 as daily_limit,
            0 as used_today;
        RETURN;
    END IF;

    -- Count today's usage
    SELECT COUNT(*)
    INTO v_used_today
    FROM nsfw_usage_log
    WHERE user_id = p_user_id
        AND created_at >= CURRENT_DATE
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
        AND success = true;

    -- Return result with NULL-safe comparison
    RETURN QUERY SELECT
        (v_used_today < COALESCE(v_user_limit, 5)) as can_use,  -- ✅ 추가 방어
        GREATEST(0, COALESCE(v_user_limit, 5) - v_used_today) as remaining_count,
        COALESCE(v_user_limit, 5) as daily_limit,
        v_used_today as used_today;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_nsfw_daily_limit IS 'Check if user can use NSFW features (daily limit) - NULL-safe version';

-- ============================================
-- Step 2: Update existing NULL values to 5
-- ============================================

UPDATE users
SET nsfw_daily_limit = 5
WHERE nsfw_daily_limit IS NULL;

-- ============================================
-- Verification Queries
-- ============================================

-- Check if any users still have NULL nsfw_daily_limit
-- SELECT COUNT(*) as null_count FROM users WHERE nsfw_daily_limit IS NULL;

-- Test the function with your user ID
-- SELECT * FROM check_nsfw_daily_limit(139680303);

-- Expected output:
-- can_use | remaining_count | daily_limit | used_today
-- --------+-----------------+-------------+-----------
-- true    | 5               | 5           | 0
