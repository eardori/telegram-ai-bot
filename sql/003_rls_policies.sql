-- =============================================================================
-- Row Level Security (RLS) Policies
-- Version: 1.0.0
-- Description: Security policies to protect data access in multi-tenant environment
-- Created: 2025-09-10
-- Dependencies: 001_initial_schema.sql, 002_indexes.sql
-- =============================================================================

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

-- Enable RLS on all tables that contain sensitive data
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- CREATE SECURITY ROLES
-- =============================================================================

-- Bot service role (for the application)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bot_service') THEN
        CREATE ROLE bot_service;
    END IF;
END
$$;

-- Analytics role (for reporting and analytics)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics') THEN
        CREATE ROLE analytics;
    END IF;
END
$$;

-- Admin role (for administrative tasks)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bot_admin') THEN
        CREATE ROLE bot_admin;
    END IF;
END
$$;

-- =============================================================================
-- UTILITY FUNCTIONS FOR RLS
-- =============================================================================

-- Function to check if current user is bot service
CREATE OR REPLACE FUNCTION is_bot_service()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_user = 'bot_service' OR 
           pg_has_role(current_user, 'bot_service', 'member');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_bot_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_user = 'bot_admin' OR 
           pg_has_role(current_user, 'bot_admin', 'member') OR
           current_user = 'postgres';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is analytics
CREATE OR REPLACE FUNCTION is_analytics()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_user = 'analytics' OR 
           pg_has_role(current_user, 'analytics', 'member') OR
           is_bot_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's accessible chat IDs (if implementing per-chat access)
CREATE OR REPLACE FUNCTION get_accessible_chat_ids()
RETURNS BIGINT[] AS $$
BEGIN
    -- For now, return all chat IDs for bot service and admin
    -- This can be customized based on specific access requirements
    IF is_bot_service() OR is_bot_admin() THEN
        RETURN ARRAY(SELECT chat_id FROM chat_groups);
    ELSE
        RETURN ARRAY[]::BIGINT[];
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_bot_service() IS 'Check if current user has bot service privileges';
COMMENT ON FUNCTION is_bot_admin() IS 'Check if current user has admin privileges';
COMMENT ON FUNCTION is_analytics() IS 'Check if current user has analytics privileges';

-- =============================================================================
-- CHAT GROUPS POLICIES
-- =============================================================================

-- Bot service can manage all chat groups
CREATE POLICY chat_groups_bot_service ON chat_groups
    FOR ALL TO bot_service
    USING (true)
    WITH CHECK (true);

-- Analytics can read all chat groups
CREATE POLICY chat_groups_analytics_read ON chat_groups
    FOR SELECT TO analytics
    USING (true);

-- Admins have full access
CREATE POLICY chat_groups_admin_access ON chat_groups
    FOR ALL TO bot_admin
    USING (true)
    WITH CHECK (true);

COMMENT ON POLICY chat_groups_bot_service ON chat_groups IS 'Bot service full access to chat groups';
COMMENT ON POLICY chat_groups_analytics_read ON chat_groups IS 'Analytics read-only access to chat groups';

-- =============================================================================
-- MESSAGES POLICIES
-- =============================================================================

-- Bot service can manage all messages
CREATE POLICY messages_bot_service ON messages
    FOR ALL TO bot_service
    USING (true)
    WITH CHECK (true);

-- Analytics can read all messages (for analysis)
CREATE POLICY messages_analytics_read ON messages
    FOR SELECT TO analytics
    USING (true);

-- Admin full access
CREATE POLICY messages_admin_access ON messages
    FOR ALL TO bot_admin
    USING (true)
    WITH CHECK (true);

-- Optional: Users can only see messages from chats they participate in
-- (This would require additional user session management)
/*
CREATE POLICY messages_user_chat_access ON messages
    FOR SELECT TO authenticated
    USING (
        chat_id IN (
            SELECT chat_id FROM user_chat_memberships 
            WHERE user_id = auth.uid()
        )
    );
*/

COMMENT ON POLICY messages_bot_service ON messages IS 'Bot service full access to messages';
COMMENT ON POLICY messages_analytics_read ON messages IS 'Analytics read-only access for analysis';

-- =============================================================================
-- SUMMARIES POLICIES
-- =============================================================================

-- Bot service can manage all summaries
CREATE POLICY summaries_bot_service ON summaries
    FOR ALL TO bot_service
    USING (true)
    WITH CHECK (true);

-- Analytics can read all summaries
CREATE POLICY summaries_analytics_read ON summaries
    FOR SELECT TO analytics
    USING (true);

-- Admin full access
CREATE POLICY summaries_admin_access ON summaries
    FOR ALL TO bot_admin
    USING (true)
    WITH CHECK (true);

COMMENT ON POLICY summaries_bot_service ON summaries IS 'Bot service full access to summaries';

-- =============================================================================
-- GENERATED IMAGES POLICIES
-- =============================================================================

-- Bot service can manage all generated images
CREATE POLICY generated_images_bot_service ON generated_images
    FOR ALL TO bot_service
    USING (true)
    WITH CHECK (true);

-- Analytics can read all image generation data
CREATE POLICY generated_images_analytics_read ON generated_images
    FOR SELECT TO analytics
    USING (true);

-- Admin full access
CREATE POLICY generated_images_admin_access ON generated_images
    FOR ALL TO bot_admin
    USING (true)
    WITH CHECK (true);

-- Users can see their own generated images across all chats
CREATE POLICY generated_images_user_own ON generated_images
    FOR SELECT TO authenticated
    USING (user_id = current_setting('app.user_id')::BIGINT);

COMMENT ON POLICY generated_images_bot_service ON generated_images IS 'Bot service full access to generated images';
COMMENT ON POLICY generated_images_user_own ON generated_images IS 'Users can view their own generated images';

-- =============================================================================
-- CHAT SETTINGS POLICIES
-- =============================================================================

-- Bot service can manage all chat settings
CREATE POLICY chat_settings_bot_service ON chat_settings
    FOR ALL TO bot_service
    USING (true)
    WITH CHECK (true);

-- Analytics can read settings for analysis
CREATE POLICY chat_settings_analytics_read ON chat_settings
    FOR SELECT TO analytics
    USING (true);

-- Admin full access
CREATE POLICY chat_settings_admin_access ON chat_settings
    FOR ALL TO bot_admin
    USING (true)
    WITH CHECK (true);

COMMENT ON POLICY chat_settings_bot_service ON chat_settings IS 'Bot service full access to chat settings';

-- =============================================================================
-- USER PREFERENCES POLICIES
-- =============================================================================

-- Bot service can manage all user preferences
CREATE POLICY user_preferences_bot_service ON user_preferences
    FOR ALL TO bot_service
    USING (true)
    WITH CHECK (true);

-- Analytics can read user preferences (anonymized)
CREATE POLICY user_preferences_analytics_read ON user_preferences
    FOR SELECT TO analytics
    USING (true);

-- Admin full access
CREATE POLICY user_preferences_admin_access ON user_preferences
    FOR ALL TO bot_admin
    USING (true)
    WITH CHECK (true);

-- Users can manage their own preferences
CREATE POLICY user_preferences_user_own ON user_preferences
    FOR ALL TO authenticated
    USING (user_id = current_setting('app.user_id')::BIGINT)
    WITH CHECK (user_id = current_setting('app.user_id')::BIGINT);

COMMENT ON POLICY user_preferences_bot_service ON user_preferences IS 'Bot service full access to user preferences';
COMMENT ON POLICY user_preferences_user_own ON user_preferences IS 'Users can manage their own preferences';

-- =============================================================================
-- AUDIT LOG POLICIES
-- =============================================================================

-- Bot service can write to activity log but limited read access
CREATE POLICY bot_activity_log_bot_write ON bot_activity_log
    FOR INSERT TO bot_service
    WITH CHECK (true);

CREATE POLICY bot_activity_log_bot_read ON bot_activity_log
    FOR SELECT TO bot_service
    USING (created_at >= NOW() - INTERVAL '24 hours'); -- Only recent logs

-- Analytics can read all activity logs
CREATE POLICY bot_activity_log_analytics_read ON bot_activity_log
    FOR SELECT TO analytics
    USING (true);

-- Admin full access
CREATE POLICY bot_activity_log_admin_access ON bot_activity_log
    FOR ALL TO bot_admin
    USING (true)
    WITH CHECK (true);

COMMENT ON POLICY bot_activity_log_bot_write ON bot_activity_log IS 'Bot service can write activity logs';
COMMENT ON POLICY bot_activity_log_bot_read ON bot_activity_log IS 'Bot service limited read access to recent logs';

-- =============================================================================
-- API USAGE POLICIES
-- =============================================================================

-- Bot service can manage API usage records
CREATE POLICY api_usage_bot_service ON api_usage
    FOR ALL TO bot_service
    USING (true)
    WITH CHECK (true);

-- Analytics can read all API usage data
CREATE POLICY api_usage_analytics_read ON api_usage
    FOR SELECT TO analytics
    USING (true);

-- Admin full access
CREATE POLICY api_usage_admin_access ON api_usage
    FOR ALL TO bot_admin
    USING (true)
    WITH CHECK (true);

COMMENT ON POLICY api_usage_bot_service ON api_usage IS 'Bot service full access to API usage tracking';

-- =============================================================================
-- GRANT PERMISSIONS TO ROLES
-- =============================================================================

-- Bot service permissions
GRANT CONNECT ON DATABASE postgres TO bot_service;
GRANT USAGE ON SCHEMA public TO bot_service;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bot_service;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bot_service;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bot_service;

-- Analytics permissions (read-only)
GRANT CONNECT ON DATABASE postgres TO analytics;
GRANT USAGE ON SCHEMA public TO analytics;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO analytics;
GRANT EXECUTE ON FUNCTION is_analytics() TO analytics;

-- Admin permissions (full access)
GRANT CONNECT ON DATABASE postgres TO bot_admin;
GRANT USAGE ON SCHEMA public TO bot_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bot_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bot_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bot_admin;

-- =============================================================================
-- PRIVACY AND COMPLIANCE FUNCTIONS
-- =============================================================================

-- Function to anonymize user data for analytics
CREATE OR REPLACE FUNCTION anonymize_user_id(user_id BIGINT)
RETURNS TEXT AS $$
BEGIN
    -- Create a consistent hash of the user ID for analytics
    -- while maintaining anonymity
    RETURN encode(digest(user_id::text || 'telegram_bot_salt', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check data retention compliance
CREATE OR REPLACE FUNCTION should_retain_data(created_at TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN AS $$
BEGIN
    -- Keep data for 2 years by default
    -- This can be customized based on legal requirements
    RETURN created_at >= NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to delete user data (GDPR compliance)
CREATE OR REPLACE FUNCTION delete_user_data(target_user_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Only allow if called by admin or bot service
    IF NOT (is_bot_admin() OR is_bot_service()) THEN
        RAISE EXCEPTION 'Insufficient privileges to delete user data';
    END IF;
    
    -- Delete user's messages (set content to '[deleted]' instead of actual deletion)
    UPDATE messages 
    SET content = '[deleted]', 
        username = NULL,
        user_first_name = NULL,
        user_last_name = NULL
    WHERE user_id = target_user_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete user's generated images
    DELETE FROM generated_images WHERE user_id = target_user_id;
    
    -- Delete user preferences
    DELETE FROM user_preferences WHERE user_id = target_user_id;
    
    -- Log the deletion
    INSERT INTO bot_activity_log (
        activity_type,
        activity_description,
        user_id,
        status
    ) VALUES (
        'user_data_deletion',
        'User data deleted for user ID: ' || target_user_id,
        target_user_id,
        'success'
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_user_data(BIGINT) IS 'GDPR-compliant user data deletion';

-- =============================================================================
-- DATA RETENTION POLICIES
-- =============================================================================

-- Function to clean up old data automatically
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_messages INTEGER := 0;
    deleted_logs INTEGER := 0;
    deleted_api_usage INTEGER := 0;
BEGIN
    -- Only allow cleanup by admin or service account
    IF NOT (is_bot_admin() OR is_bot_service()) THEN
        RAISE EXCEPTION 'Insufficient privileges for data cleanup';
    END IF;
    
    -- Delete old bot activity logs (keep 6 months)
    DELETE FROM bot_activity_log 
    WHERE created_at < NOW() - INTERVAL '6 months';
    GET DIAGNOSTICS deleted_logs = ROW_COUNT;
    
    -- Delete old API usage records (keep 1 year for billing)
    DELETE FROM api_usage 
    WHERE created_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS deleted_api_usage = ROW_COUNT;
    
    -- Archive old messages instead of deleting (move content to archive table)
    -- For now, just mark them as archived
    UPDATE messages 
    SET content = '[archived]'
    WHERE timestamp < NOW() - INTERVAL '2 years'
    AND content != '[archived]'
    AND content != '[deleted]';
    GET DIAGNOSTICS deleted_messages = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO bot_activity_log (
        activity_type,
        activity_description,
        status
    ) VALUES (
        'data_cleanup',
        format('Cleaned up %s messages, %s logs, %s API records', 
               deleted_messages, deleted_logs, deleted_api_usage),
        'success'
    );
    
    RETURN deleted_messages + deleted_logs + deleted_api_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_data() IS 'Automated cleanup of old data for retention compliance';

-- =============================================================================
-- SECURITY MONITORING
-- =============================================================================

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    event_type TEXT,
    event_description TEXT,
    user_context TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO bot_activity_log (
        activity_type,
        activity_description,
        status,
        user_agent
    ) VALUES (
        'security_event',
        format('%s: %s', event_type, event_description),
        'warning',
        user_context
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RLS BYPASS FOR SYSTEM OPERATIONS
-- =============================================================================

-- Create a security definer function that bypasses RLS for system operations
CREATE OR REPLACE FUNCTION system_get_chat_stats(target_chat_id BIGINT)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Only allow system operations by bot service or admin
    IF NOT (is_bot_service() OR is_bot_admin()) THEN
        RAISE EXCEPTION 'Insufficient privileges for system operations';
    END IF;
    
    SELECT json_build_object(
        'chat_id', target_chat_id,
        'total_messages', COUNT(m.id),
        'unique_users', COUNT(DISTINCT m.user_id),
        'last_activity', MAX(m.timestamp),
        'total_summaries', (
            SELECT COUNT(*) FROM summaries s WHERE s.chat_id = target_chat_id
        ),
        'total_images', (
            SELECT COUNT(*) FROM generated_images gi WHERE gi.chat_id = target_chat_id
        )
    ) INTO result
    FROM messages m
    WHERE m.chat_id = target_chat_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION system_get_chat_stats(BIGINT) IS 'System function to get chat statistics bypassing RLS';

-- =============================================================================
-- FINAL SETUP
-- =============================================================================

-- Update default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bot_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analytics;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bot_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bot_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO analytics;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bot_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO bot_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO bot_admin;

-- Log RLS setup completion
INSERT INTO bot_activity_log (
    activity_type,
    activity_description,
    status
) VALUES (
    'rls_setup',
    'Row Level Security policies configured successfully',
    'success'
);

-- =============================================================================
-- RLS TESTING QUERIES (for validation)
-- =============================================================================

/*
-- Test RLS policies (run as different users):

-- As bot_service:
SET ROLE bot_service;
SELECT COUNT(*) FROM messages; -- Should return all messages
SELECT COUNT(*) FROM summaries; -- Should return all summaries

-- As analytics:
SET ROLE analytics;
SELECT COUNT(*) FROM messages; -- Should return all messages (read-only)
INSERT INTO messages (chat_id, message_id, user_id, content, timestamp) 
VALUES (1, 999, 1, 'test', NOW()); -- Should fail

-- As regular user (if implemented):
SET app.user_id = '12345';
SELECT * FROM user_preferences; -- Should only return user's own preferences

-- Reset to superuser:
RESET ROLE;
*/