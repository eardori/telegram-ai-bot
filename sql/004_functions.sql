-- =============================================================================
-- Database Functions and Stored Procedures
-- Version: 1.0.0
-- Description: Utility functions for Telegram bot operations
-- Created: 2025-09-10
-- Dependencies: 001_initial_schema.sql, 002_indexes.sql, 003_rls_policies.sql
-- =============================================================================

-- =============================================================================
-- MESSAGE PROCESSING FUNCTIONS
-- =============================================================================

-- Function to get unprocessed messages for summary generation
CREATE OR REPLACE FUNCTION get_unprocessed_messages(
    target_chat_id BIGINT,
    since_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    message_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
    id UUID,
    message_id INTEGER,
    user_id BIGINT,
    username VARCHAR(255),
    content TEXT,
    timestamp TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.message_id,
        m.user_id,
        m.username,
        m.content,
        m.timestamp
    FROM messages m
    WHERE m.chat_id = target_chat_id
    AND NOT m.is_processed
    AND NOT m.is_bot_command
    AND m.message_type = 'text'
    AND (since_time IS NULL OR m.timestamp >= since_time)
    ORDER BY m.timestamp ASC
    LIMIT message_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_unprocessed_messages(BIGINT, TIMESTAMP WITH TIME ZONE, INTEGER) IS 'Get unprocessed messages ready for summarization';

-- Function to mark messages as processed
CREATE OR REPLACE FUNCTION mark_messages_processed(
    target_chat_id BIGINT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE messages 
    SET is_processed = true
    WHERE chat_id = target_chat_id
    AND timestamp BETWEEN start_time AND end_time
    AND NOT is_processed
    AND NOT is_bot_command;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Log the processing
    INSERT INTO bot_activity_log (
        chat_id,
        activity_type,
        activity_description,
        status
    ) VALUES (
        target_chat_id,
        'messages_processed',
        format('Marked %s messages as processed', updated_count),
        'success'
    );
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_messages_processed(BIGINT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Mark messages as processed after summarization';

-- Function to get message statistics for a chat
CREATE OR REPLACE FUNCTION get_chat_message_stats(
    target_chat_id BIGINT,
    days_back INTEGER DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    start_date TIMESTAMP WITH TIME ZONE;
BEGIN
    start_date := NOW() - INTERVAL '1 day' * days_back;
    
    SELECT json_build_object(
        'total_messages', COUNT(*),
        'unique_users', COUNT(DISTINCT user_id),
        'processed_messages', COUNT(*) FILTER (WHERE is_processed),
        'unprocessed_messages', COUNT(*) FILTER (WHERE NOT is_processed),
        'bot_commands', COUNT(*) FILTER (WHERE is_bot_command),
        'text_messages', COUNT(*) FILTER (WHERE message_type = 'text'),
        'media_messages', COUNT(*) FILTER (WHERE message_type != 'text'),
        'messages_per_day', ROUND(COUNT(*)::DECIMAL / days_back, 2),
        'most_active_user', (
            SELECT json_build_object(
                'user_id', user_id,
                'username', username,
                'message_count', COUNT(*)
            )
            FROM messages m2
            WHERE m2.chat_id = target_chat_id
            AND m2.timestamp >= start_date
            AND NOT m2.is_bot_command
            GROUP BY user_id, username
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ),
        'peak_hour', (
            SELECT EXTRACT(HOUR FROM timestamp) as hour
            FROM messages m3
            WHERE m3.chat_id = target_chat_id
            AND m3.timestamp >= start_date
            GROUP BY EXTRACT(HOUR FROM timestamp)
            ORDER BY COUNT(*) DESC
            LIMIT 1
        )
    ) INTO result
    FROM messages m
    WHERE m.chat_id = target_chat_id
    AND m.timestamp >= start_date;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_chat_message_stats(BIGINT, INTEGER) IS 'Get comprehensive message statistics for a chat';

-- =============================================================================
-- SUMMARY GENERATION FUNCTIONS
-- =============================================================================

-- Function to create a new summary
CREATE OR REPLACE FUNCTION create_summary(
    target_chat_id BIGINT,
    summary_content TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    message_count INTEGER,
    llm_provider VARCHAR(100) DEFAULT NULL,
    llm_model VARCHAR(100) DEFAULT NULL,
    prompt_tokens INTEGER DEFAULT NULL,
    completion_tokens INTEGER DEFAULT NULL,
    processing_time_ms INTEGER DEFAULT NULL,
    confidence_score DECIMAL(3,2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    summary_id UUID;
BEGIN
    INSERT INTO summaries (
        chat_id,
        summary_text,
        start_time,
        end_time,
        message_count,
        llm_provider,
        llm_model,
        prompt_tokens,
        completion_tokens,
        processing_time_ms,
        confidence_score,
        summary_type,
        status
    ) VALUES (
        target_chat_id,
        summary_content,
        start_time,
        end_time,
        message_count,
        llm_provider,
        llm_model,
        prompt_tokens,
        completion_tokens,
        processing_time_ms,
        confidence_score,
        'auto',
        'completed'
    ) RETURNING id INTO summary_id;
    
    -- Update chat settings with last summary time
    UPDATE chat_settings 
    SET last_summary_at = NOW()
    WHERE chat_id = target_chat_id;
    
    -- Log the summary creation
    INSERT INTO bot_activity_log (
        chat_id,
        activity_type,
        activity_description,
        status,
        duration_ms
    ) VALUES (
        target_chat_id,
        'summary_created',
        format('Summary created covering %s messages', message_count),
        'success',
        processing_time_ms
    );
    
    RETURN summary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_summary IS 'Create a new summary with full metadata';

-- Function to get chats that need summarization
CREATE OR REPLACE FUNCTION get_chats_needing_summary()
RETURNS TABLE (
    chat_id BIGINT,
    chat_title VARCHAR(255),
    summary_interval_hours INTEGER,
    last_summary_at TIMESTAMP WITH TIME ZONE,
    unprocessed_message_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cg.chat_id,
        cg.chat_title,
        cs.summary_interval_hours,
        cs.last_summary_at,
        COUNT(m.id) as unprocessed_message_count
    FROM chat_groups cg
    JOIN chat_settings cs ON cg.chat_id = cs.chat_id
    LEFT JOIN messages m ON cg.chat_id = m.chat_id 
        AND NOT m.is_processed 
        AND NOT m.is_bot_command
        AND m.message_type = 'text'
    WHERE cg.is_active = true
    AND cs.summary_enabled = true
    AND (
        cs.last_summary_at IS NULL OR 
        cs.last_summary_at <= NOW() - INTERVAL '1 hour' * cs.summary_interval_hours
    )
    GROUP BY cg.chat_id, cg.chat_title, cs.summary_interval_hours, cs.last_summary_at
    HAVING COUNT(m.id) >= COALESCE(cs.summary_min_messages, 10);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_chats_needing_summary() IS 'Find chats that need automatic summarization';

-- =============================================================================
-- IMAGE GENERATION FUNCTIONS
-- =============================================================================

-- Function to create image generation record
CREATE OR REPLACE FUNCTION create_image_generation(
    target_chat_id BIGINT,
    target_user_id BIGINT,
    username VARCHAR(255),
    prompt TEXT,
    negative_prompt TEXT DEFAULT NULL,
    style VARCHAR(100) DEFAULT 'realistic',
    api_provider VARCHAR(100) DEFAULT 'dalle',
    api_model VARCHAR(100) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    image_id UUID;
BEGIN
    INSERT INTO generated_images (
        chat_id,
        user_id,
        username,
        prompt,
        negative_prompt,
        style,
        api_provider,
        api_model,
        status
    ) VALUES (
        target_chat_id,
        target_user_id,
        username,
        prompt,
        negative_prompt,
        style,
        api_provider,
        api_model,
        'pending'
    ) RETURNING id INTO image_id;
    
    -- Log the generation request
    INSERT INTO bot_activity_log (
        chat_id,
        user_id,
        activity_type,
        activity_description,
        status
    ) VALUES (
        target_chat_id,
        target_user_id,
        'image_generation_requested',
        format('Image generation requested: %s', LEFT(prompt, 100)),
        'success'
    );
    
    RETURN image_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_image_generation IS 'Create a new image generation request';

-- Function to update image generation with results
CREATE OR REPLACE FUNCTION update_image_generation(
    image_id UUID,
    image_url VARCHAR(1000) DEFAULT NULL,
    image_file_id VARCHAR(500) DEFAULT NULL,
    width INTEGER DEFAULT NULL,
    height INTEGER DEFAULT NULL,
    file_size INTEGER DEFAULT NULL,
    generation_time_ms INTEGER DEFAULT NULL,
    cost_usd DECIMAL(10,6) DEFAULT NULL,
    error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    new_status VARCHAR(50);
BEGIN
    -- Determine status based on whether we have an image URL
    IF image_url IS NOT NULL THEN
        new_status := 'completed';
    ELSE
        new_status := 'failed';
    END IF;
    
    UPDATE generated_images
    SET 
        image_url = COALESCE(update_image_generation.image_url, generated_images.image_url),
        image_file_id = COALESCE(update_image_generation.image_file_id, generated_images.image_file_id),
        width = COALESCE(update_image_generation.width, generated_images.width),
        height = COALESCE(update_image_generation.height, generated_images.height),
        file_size = COALESCE(update_image_generation.file_size, generated_images.file_size),
        generation_time_ms = COALESCE(update_image_generation.generation_time_ms, generated_images.generation_time_ms),
        cost_usd = COALESCE(update_image_generation.cost_usd, generated_images.cost_usd),
        error_message = COALESCE(update_image_generation.error_message, generated_images.error_message),
        status = new_status
    WHERE id = image_id;
    
    -- Log the completion
    INSERT INTO bot_activity_log (
        activity_type,
        activity_description,
        status,
        duration_ms
    ) VALUES (
        'image_generation_completed',
        format('Image generation %s: %s', new_status, image_id),
        CASE WHEN new_status = 'completed' THEN 'success' ELSE 'error' END,
        generation_time_ms
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_image_generation IS 'Update image generation record with results';

-- Function to check user rate limits for image generation
CREATE OR REPLACE FUNCTION check_image_rate_limit(
    target_user_id BIGINT,
    hours_window INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
    images_count INTEGER;
    max_allowed INTEGER;
    result JSON;
BEGIN
    -- Get user's hourly limit (default from preferences or chat settings)
    SELECT COALESCE(up.daily_image_limit / 24, 5) INTO max_allowed
    FROM user_preferences up
    WHERE up.user_id = target_user_id;
    
    -- If no user preferences, use default
    IF max_allowed IS NULL THEN
        max_allowed := 5;
    END IF;
    
    -- Count images in the time window
    SELECT COUNT(*) INTO images_count
    FROM generated_images
    WHERE user_id = target_user_id
    AND created_at >= NOW() - INTERVAL '1 hour' * hours_window
    AND status = 'completed';
    
    SELECT json_build_object(
        'allowed', images_count < max_allowed,
        'current_count', images_count,
        'max_allowed', max_allowed,
        'reset_time', NOW() + INTERVAL '1 hour' * hours_window,
        'remaining', GREATEST(0, max_allowed - images_count)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_image_rate_limit(BIGINT, INTEGER) IS 'Check if user has exceeded image generation rate limit';

-- =============================================================================
-- ANALYTICS AND REPORTING FUNCTIONS
-- =============================================================================

-- Function to get API usage summary
CREATE OR REPLACE FUNCTION get_api_usage_summary(
    days_back INTEGER DEFAULT 30,
    provider_filter VARCHAR(100) DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    start_date TIMESTAMP WITH TIME ZONE;
BEGIN
    start_date := NOW() - INTERVAL '1 day' * days_back;
    
    SELECT json_build_object(
        'period_days', days_back,
        'total_requests', COUNT(*),
        'successful_requests', COUNT(*) FILTER (WHERE status = 'success'),
        'failed_requests', COUNT(*) FILTER (WHERE status = 'error'),
        'total_cost_usd', ROUND(SUM(total_cost_usd)::NUMERIC, 4),
        'total_tokens', SUM(total_tokens),
        'avg_request_duration_ms', ROUND(AVG(request_duration_ms)),
        'providers', json_agg(DISTINCT provider ORDER BY provider),
        'daily_breakdown', (
            SELECT json_agg(
                json_build_object(
                    'date', DATE(created_at),
                    'requests', COUNT(*),
                    'cost_usd', ROUND(SUM(total_cost_usd)::NUMERIC, 4),
                    'tokens', SUM(total_tokens)
                ) ORDER BY DATE(created_at)
            )
            FROM api_usage au2
            WHERE au2.created_at >= start_date
            AND (provider_filter IS NULL OR au2.provider = provider_filter)
            GROUP BY DATE(created_at)
        )
    ) INTO result
    FROM api_usage au
    WHERE au.created_at >= start_date
    AND (provider_filter IS NULL OR au.provider = provider_filter);
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_api_usage_summary(INTEGER, VARCHAR) IS 'Get comprehensive API usage and cost analysis';

-- Function to get bot performance metrics
CREATE OR REPLACE FUNCTION get_bot_performance_metrics(
    days_back INTEGER DEFAULT 7
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    start_date TIMESTAMP WITH TIME ZONE;
BEGIN
    start_date := NOW() - INTERVAL '1 day' * days_back;
    
    SELECT json_build_object(
        'active_chats', (
            SELECT COUNT(DISTINCT chat_id)
            FROM messages
            WHERE timestamp >= start_date
        ),
        'total_messages_processed', (
            SELECT COUNT(*)
            FROM messages
            WHERE timestamp >= start_date
        ),
        'summaries_generated', (
            SELECT COUNT(*)
            FROM summaries
            WHERE created_at >= start_date
        ),
        'images_generated', (
            SELECT COUNT(*)
            FROM generated_images
            WHERE created_at >= start_date
            AND status = 'completed'
        ),
        'avg_summary_generation_time_ms', (
            SELECT ROUND(AVG(processing_time_ms))
            FROM summaries
            WHERE created_at >= start_date
            AND processing_time_ms IS NOT NULL
        ),
        'avg_image_generation_time_ms', (
            SELECT ROUND(AVG(generation_time_ms))
            FROM generated_images
            WHERE created_at >= start_date
            AND generation_time_ms IS NOT NULL
        ),
        'error_rate', (
            SELECT ROUND(
                COUNT(*) FILTER (WHERE status IN ('error', 'warning'))::DECIMAL / 
                NULLIF(COUNT(*), 0) * 100, 2
            )
            FROM bot_activity_log
            WHERE created_at >= start_date
        ),
        'most_active_chat', (
            SELECT json_build_object(
                'chat_id', m.chat_id,
                'chat_title', cg.chat_title,
                'message_count', COUNT(*)
            )
            FROM messages m
            JOIN chat_groups cg ON m.chat_id = cg.chat_id
            WHERE m.timestamp >= start_date
            GROUP BY m.chat_id, cg.chat_title
            ORDER BY COUNT(*) DESC
            LIMIT 1
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_bot_performance_metrics(INTEGER) IS 'Get comprehensive bot performance metrics';

-- =============================================================================
-- MAINTENANCE AND UTILITY FUNCTIONS
-- =============================================================================

-- Function to get database health metrics
CREATE OR REPLACE FUNCTION get_database_health()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'table_sizes', (
            SELECT json_object_agg(
                table_name,
                pg_size_pretty(pg_total_relation_size(table_name::regclass))
            )
            FROM (
                SELECT tablename as table_name
                FROM pg_tables 
                WHERE schemaname = 'public'
                AND tablename IN ('messages', 'summaries', 'generated_images', 
                                'bot_activity_log', 'api_usage')
            ) tables
        ),
        'total_records', (
            SELECT json_build_object(
                'messages', (SELECT COUNT(*) FROM messages),
                'summaries', (SELECT COUNT(*) FROM summaries),
                'generated_images', (SELECT COUNT(*) FROM generated_images),
                'chat_groups', (SELECT COUNT(*) FROM chat_groups),
                'users', (SELECT COUNT(DISTINCT user_id) FROM messages)
            )
        ),
        'recent_activity', (
            SELECT json_build_object(
                'messages_last_hour', (
                    SELECT COUNT(*) FROM messages 
                    WHERE timestamp >= NOW() - INTERVAL '1 hour'
                ),
                'summaries_last_day', (
                    SELECT COUNT(*) FROM summaries 
                    WHERE created_at >= NOW() - INTERVAL '1 day'
                ),
                'images_last_day', (
                    SELECT COUNT(*) FROM generated_images 
                    WHERE created_at >= NOW() - INTERVAL '1 day'
                ),
                'errors_last_hour', (
                    SELECT COUNT(*) FROM bot_activity_log 
                    WHERE created_at >= NOW() - INTERVAL '1 hour'
                    AND status = 'error'
                )
            )
        ),
        'index_usage', (
            SELECT json_agg(
                json_build_object(
                    'index_name', indexrelname,
                    'table_name', tablename,
                    'size', pg_size_pretty(pg_relation_size(indexrelid)),
                    'scans', idx_scan,
                    'tuples_read', idx_tup_read
                ) ORDER BY idx_scan DESC
            )
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
            LIMIT 10
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_database_health() IS 'Get comprehensive database health and performance metrics';

-- Function to vacuum and analyze tables
CREATE OR REPLACE FUNCTION maintenance_vacuum_analyze()
RETURNS TEXT AS $$
DECLARE
    table_name TEXT;
    tables_processed INTEGER := 0;
    result_message TEXT;
BEGIN
    -- Only allow maintenance by admin
    IF NOT is_bot_admin() THEN
        RAISE EXCEPTION 'Insufficient privileges for maintenance operations';
    END IF;
    
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename IN (
            'messages', 'summaries', 'generated_images', 
            'chat_groups', 'chat_settings', 'user_preferences',
            'bot_activity_log', 'api_usage'
        )
    LOOP
        EXECUTE format('VACUUM ANALYZE %I', table_name);
        tables_processed := tables_processed + 1;
    END LOOP;
    
    result_message := format('Maintenance completed on %s tables', tables_processed);
    
    -- Log maintenance activity
    INSERT INTO bot_activity_log (
        activity_type,
        activity_description,
        status
    ) VALUES (
        'maintenance_vacuum',
        result_message,
        'success'
    );
    
    RETURN result_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION maintenance_vacuum_analyze() IS 'Perform vacuum and analyze on key tables';

-- =============================================================================
-- WEBHOOK AND INTEGRATION FUNCTIONS
-- =============================================================================

-- Function to validate and store incoming webhook data
CREATE OR REPLACE FUNCTION process_telegram_message(
    webhook_data JSONB
)
RETURNS JSON AS $$
DECLARE
    chat_data JSONB;
    message_data JSONB;
    user_data JSONB;
    chat_id BIGINT;
    message_id INTEGER;
    user_id BIGINT;
    result JSON;
    new_message_id UUID;
BEGIN
    -- Extract data from webhook payload
    message_data := webhook_data->'message';
    chat_data := message_data->'chat';
    user_data := message_data->'from';
    
    -- Validate required fields
    IF chat_data IS NULL OR message_data IS NULL OR user_data IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid webhook data structure');
    END IF;
    
    chat_id := (chat_data->>'id')::BIGINT;
    message_id := (message_data->>'message_id')::INTEGER;
    user_id := (user_data->>'id')::BIGINT;
    
    -- Ensure chat group exists
    INSERT INTO chat_groups (
        chat_id, 
        chat_title, 
        chat_type,
        last_activity
    ) VALUES (
        chat_id,
        COALESCE(chat_data->>'title', chat_data->>'first_name', 'Unknown'),
        COALESCE(chat_data->>'type', 'private'),
        NOW()
    ) ON CONFLICT (chat_id) DO UPDATE SET
        last_activity = NOW(),
        chat_title = COALESCE(EXCLUDED.chat_title, chat_groups.chat_title);
    
    -- Ensure chat settings exist
    INSERT INTO chat_settings (chat_id) VALUES (chat_id)
    ON CONFLICT (chat_id) DO NOTHING;
    
    -- Store the message
    INSERT INTO messages (
        chat_id,
        message_id,
        user_id,
        username,
        user_first_name,
        user_last_name,
        content,
        message_type,
        timestamp,
        is_bot_command
    ) VALUES (
        chat_id,
        message_id,
        user_id,
        user_data->>'username',
        user_data->>'first_name',
        user_data->>'last_name',
        COALESCE(message_data->>'text', '[non-text message]'),
        CASE 
            WHEN message_data ? 'text' THEN 'text'
            WHEN message_data ? 'photo' THEN 'photo'
            WHEN message_data ? 'video' THEN 'video'
            WHEN message_data ? 'document' THEN 'document'
            WHEN message_data ? 'audio' THEN 'audio'
            WHEN message_data ? 'voice' THEN 'voice'
            WHEN message_data ? 'sticker' THEN 'sticker'
            ELSE 'unknown'
        END,
        TO_TIMESTAMP((message_data->>'date')::INTEGER),
        COALESCE(message_data->>'text', '') LIKE '/%'
    ) RETURNING id INTO new_message_id
    ON CONFLICT (chat_id, message_id) DO NOTHING;
    
    -- Update user preferences if needed
    INSERT INTO user_preferences (
        user_id,
        username,
        first_name,
        last_name,
        last_active_at
    ) VALUES (
        user_id,
        user_data->>'username',
        user_data->>'first_name',
        user_data->>'last_name',
        NOW()
    ) ON CONFLICT (user_id) DO UPDATE SET
        username = COALESCE(EXCLUDED.username, user_preferences.username),
        first_name = COALESCE(EXCLUDED.first_name, user_preferences.first_name),
        last_name = COALESCE(EXCLUDED.last_name, user_preferences.last_name),
        last_active_at = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message_id', new_message_id,
        'chat_id', chat_id,
        'user_id', user_id,
        'is_bot_command', COALESCE(message_data->>'text', '') LIKE '/%'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error
        INSERT INTO bot_activity_log (
            chat_id,
            user_id,
            activity_type,
            activity_description,
            status,
            error_message
        ) VALUES (
            chat_id,
            user_id,
            'webhook_processing_error',
            'Failed to process Telegram webhook',
            'error',
            SQLERRM
        );
        
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_telegram_message(JSONB) IS 'Process incoming Telegram webhook messages';

-- =============================================================================
-- SCHEDULER FUNCTIONS
-- =============================================================================

-- Function to be called by cron job for automatic summaries
CREATE OR REPLACE FUNCTION run_scheduled_summaries()
RETURNS JSON AS $$
DECLARE
    chat_record RECORD;
    summary_count INTEGER := 0;
    error_count INTEGER := 0;
    result JSON;
BEGIN
    -- Process each chat that needs summarization
    FOR chat_record IN SELECT * FROM get_chats_needing_summary() LOOP
        BEGIN
            -- Log that we're attempting to summarize this chat
            INSERT INTO bot_activity_log (
                chat_id,
                activity_type,
                activity_description,
                status
            ) VALUES (
                chat_record.chat_id,
                'scheduled_summary_trigger',
                format('Triggered automatic summary for chat %s (%s unprocessed messages)', 
                       chat_record.chat_title, chat_record.unprocessed_message_count),
                'success'
            );
            
            summary_count := summary_count + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                error_count := error_count + 1;
                
                INSERT INTO bot_activity_log (
                    chat_id,
                    activity_type,
                    activity_description,
                    status,
                    error_message
                ) VALUES (
                    chat_record.chat_id,
                    'scheduled_summary_error',
                    'Failed to trigger scheduled summary',
                    'error',
                    SQLERRM
                );
        END;
    END LOOP;
    
    SELECT json_build_object(
        'summary_triggers', summary_count,
        'errors', error_count,
        'timestamp', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION run_scheduled_summaries() IS 'Process scheduled summary generation for all eligible chats';

-- =============================================================================
-- GRANT PERMISSIONS FOR NEW FUNCTIONS
-- =============================================================================

-- Grant execute permissions to appropriate roles
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bot_service;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bot_admin;

-- Analytics gets limited access to read-only functions
GRANT EXECUTE ON FUNCTION get_chat_message_stats(BIGINT, INTEGER) TO analytics;
GRANT EXECUTE ON FUNCTION get_api_usage_summary(INTEGER, VARCHAR) TO analytics;
GRANT EXECUTE ON FUNCTION get_bot_performance_metrics(INTEGER) TO analytics;
GRANT EXECUTE ON FUNCTION get_database_health() TO analytics;

-- Log function setup completion
INSERT INTO bot_activity_log (
    activity_type,
    activity_description,
    status
) VALUES (
    'functions_setup',
    'Database functions and stored procedures created successfully',
    'success'
);