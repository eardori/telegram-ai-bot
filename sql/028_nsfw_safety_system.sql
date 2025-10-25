-- ============================================
-- NSFW Safety System
-- ============================================
-- Purpose: Age verification, consent tracking, and usage limits for NSFW features
-- Created: 2025-01-10
-- Related: Phase 1 of NSFW implementation

-- ============================================
-- 1. Add NSFW fields to users table
-- ============================================

-- Add columns for NSFW consent and settings
ALTER TABLE users
ADD COLUMN IF NOT EXISTS nsfw_consent_given BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS nsfw_consent_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS nsfw_age_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS nsfw_daily_limit INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS nsfw_enabled BOOLEAN DEFAULT true;

-- Add index for quick NSFW consent lookups
CREATE INDEX IF NOT EXISTS idx_users_nsfw_consent
ON users(nsfw_consent_given, nsfw_enabled)
WHERE nsfw_consent_given = true;

COMMENT ON COLUMN users.nsfw_consent_given IS 'User has consented to use NSFW features';
COMMENT ON COLUMN users.nsfw_consent_date IS 'When user gave NSFW consent';
COMMENT ON COLUMN users.nsfw_age_verified IS 'User verified they are 19+ years old';
COMMENT ON COLUMN users.nsfw_daily_limit IS 'Daily NSFW generation limit (free users)';
COMMENT ON COLUMN users.nsfw_enabled IS 'NSFW features enabled for this user (admin can disable)';

-- ============================================
-- 2. NSFW Usage Tracking Table
-- ============================================

CREATE TABLE IF NOT EXISTS nsfw_usage_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_key TEXT NOT NULL,
    prompt TEXT,

    -- Result tracking
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    generation_time_ms INTEGER,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    CONSTRAINT fk_nsfw_template
        FOREIGN KEY (template_key)
        REFERENCES prompt_templates(template_key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nsfw_usage_user_date
ON nsfw_usage_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nsfw_usage_template
ON nsfw_usage_log(template_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nsfw_usage_date
ON nsfw_usage_log(created_at DESC);

COMMENT ON TABLE nsfw_usage_log IS 'Tracks all NSFW feature usage for monitoring and limits';

-- ============================================
-- 3. Daily Usage Tracking View
-- ============================================

CREATE OR REPLACE VIEW v_nsfw_daily_usage AS
SELECT
    user_id,
    DATE(created_at) as usage_date,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE success = true) as successful_requests,
    COUNT(*) FILTER (WHERE success = false) as failed_requests,
    AVG(generation_time_ms) FILTER (WHERE success = true) as avg_generation_time_ms
FROM nsfw_usage_log
GROUP BY user_id, DATE(created_at);

COMMENT ON VIEW v_nsfw_daily_usage IS 'Daily NSFW usage statistics per user';

-- ============================================
-- 4. Function: Check NSFW Daily Limit
-- ============================================

-- Drop existing function if it exists (to allow return type change)
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
        u.nsfw_daily_limit,
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

    -- Return result
    RETURN QUERY SELECT
        (v_used_today < v_user_limit) as can_use,
        GREATEST(0, v_user_limit - v_used_today) as remaining_count,
        v_user_limit as daily_limit,
        v_used_today as used_today;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_nsfw_daily_limit IS 'Check if user can use NSFW features (daily limit)';

-- ============================================
-- 5. Function: Record NSFW Usage
-- ============================================

CREATE OR REPLACE FUNCTION record_nsfw_usage(
    p_user_id BIGINT,
    p_template_key TEXT,
    p_prompt TEXT,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL,
    p_generation_time_ms INTEGER DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_log_id BIGINT;
BEGIN
    INSERT INTO nsfw_usage_log (
        user_id,
        template_key,
        prompt,
        success,
        error_message,
        generation_time_ms
    ) VALUES (
        p_user_id,
        p_template_key,
        p_prompt,
        p_success,
        p_error_message,
        p_generation_time_ms
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_nsfw_usage IS 'Record NSFW feature usage for tracking and limits';

-- ============================================
-- 6. Admin View: NSFW Statistics
-- ============================================

CREATE OR REPLACE VIEW v_nsfw_admin_stats AS
SELECT
    -- Overall stats
    COUNT(DISTINCT user_id) as total_nsfw_users,
    COUNT(*) as total_nsfw_requests,
    COUNT(*) FILTER (WHERE success = true) as successful_requests,
    COUNT(*) FILTER (WHERE success = false) as failed_requests,
    ROUND(AVG(generation_time_ms) FILTER (WHERE success = true), 2) as avg_generation_time_ms,

    -- Today's stats
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as requests_today,
    COUNT(DISTINCT user_id) FILTER (WHERE created_at >= CURRENT_DATE) as active_users_today,

    -- Last 7 days
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as requests_last_7d,
    COUNT(DISTINCT user_id) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as active_users_last_7d
FROM nsfw_usage_log;

COMMENT ON VIEW v_nsfw_admin_stats IS 'Admin dashboard for NSFW feature statistics';

-- ============================================
-- 7. Popular NSFW Templates View
-- ============================================

CREATE OR REPLACE VIEW v_nsfw_popular_templates AS
SELECT
    nul.template_key,
    pt.template_name_ko,
    pt.template_name_en,
    pt.category,
    COUNT(*) as usage_count,
    COUNT(DISTINCT nul.user_id) as unique_users,
    ROUND(AVG(generation_time_ms) FILTER (WHERE success = true), 2) as avg_time_ms,
    ROUND(100.0 * COUNT(*) FILTER (WHERE success = true) / COUNT(*), 2) as success_rate
FROM nsfw_usage_log nul
JOIN prompt_templates pt ON nul.template_key = pt.template_key
WHERE nul.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY nul.template_key, pt.template_name_ko, pt.template_name_en, pt.category
ORDER BY usage_count DESC;

COMMENT ON VIEW v_nsfw_popular_templates IS 'Most popular NSFW templates in last 30 days';

-- ============================================
-- 8. Function: Grant NSFW Consent
-- ============================================

CREATE OR REPLACE FUNCTION grant_nsfw_consent(
    p_user_id BIGINT,
    p_age_verified BOOLEAN DEFAULT true
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users
    SET
        nsfw_consent_given = true,
        nsfw_consent_date = NOW(),
        nsfw_age_verified = p_age_verified,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION grant_nsfw_consent IS 'Grant NSFW consent for a user after age verification';

-- ============================================
-- 9. Function: Revoke NSFW Access (Admin)
-- ============================================

CREATE OR REPLACE FUNCTION revoke_nsfw_access(
    p_user_id BIGINT,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users
    SET
        nsfw_enabled = false,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log the revocation (if we have an admin_actions table)
    -- INSERT INTO admin_actions (action_type, target_user_id, reason)
    -- VALUES ('revoke_nsfw', p_user_id, p_reason);

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION revoke_nsfw_access IS 'Revoke NSFW access for a user (admin action)';

-- ============================================
-- 10. Sample Data & Testing
-- ============================================

-- Example: Check if specific user can use NSFW
-- SELECT * FROM check_nsfw_daily_limit(139680303);

-- Example: Record usage
-- SELECT record_nsfw_usage(139680303, 'nsfw_template_1', 'test prompt', true, NULL, 15000);

-- Example: View admin stats
-- SELECT * FROM v_nsfw_admin_stats;

-- Example: Grant consent
-- SELECT grant_nsfw_consent(139680303, true);

-- ============================================
-- End of NSFW Safety System Schema
-- ============================================
