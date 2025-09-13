-- =============================================================================
-- Initial Data and Seed Data
-- Version: 1.0.0
-- Description: Initial configuration data and sample records for development
-- Created: 2025-09-10
-- Dependencies: 001_initial_schema.sql, 002_indexes.sql, 003_rls_policies.sql, 004_functions.sql
-- =============================================================================

-- =============================================================================
-- DEFAULT CONFIGURATION DATA
-- =============================================================================

-- Insert default system settings (if you need global settings table later)
-- This demonstrates the concept of system-wide defaults

-- Default LLM provider configurations
INSERT INTO bot_activity_log (
    activity_type,
    activity_description,
    status,
    request_data
) VALUES 
(
    'system_config',
    'Default LLM provider configurations loaded',
    'success',
    '{
        "providers": {
            "openai": {
                "models": ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"],
                "default_model": "gpt-3.5-turbo",
                "max_tokens": 4096,
                "temperature": 0.7
            },
            "claude": {
                "models": ["claude-3-haiku", "claude-3-sonnet", "claude-3-opus"],
                "default_model": "claude-3-sonnet",
                "max_tokens": 4096,
                "temperature": 0.7
            },
            "dalle": {
                "models": ["dall-e-2", "dall-e-3"],
                "default_model": "dall-e-3",
                "sizes": ["1024x1024", "1792x1024", "1024x1792"]
            }
        }
    }'::jsonb
);

-- =============================================================================
-- SAMPLE DEVELOPMENT DATA
-- =============================================================================
-- Note: This section is for development/testing only
-- Remove or modify for production deployment

-- Sample chat group for development testing
INSERT INTO chat_groups (
    chat_id,
    chat_title,
    chat_type,
    is_active,
    bot_added_at,
    last_activity,
    member_count
) VALUES 
(
    -1001234567890, -- Negative ID typical for Telegram groups
    'AI Bot Test Group',
    'supergroup',
    true,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 hour',
    25
),
(
    -1001234567891,
    'Development Team Chat',
    'supergroup', 
    true,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '30 minutes',
    12
),
(
    123456789, -- Positive ID for private chat
    'Bot Admin',
    'private',
    true,
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '5 minutes',
    1
) ON CONFLICT (chat_id) DO NOTHING;

-- Default chat settings for sample groups
INSERT INTO chat_settings (
    chat_id,
    summary_enabled,
    summary_interval_hours,
    summary_min_messages,
    language_code,
    timezone,
    image_generation_enabled,
    default_image_style,
    max_images_per_hour,
    preferred_llm_provider,
    max_tokens_per_summary,
    content_filter_enabled,
    nsfw_filter_enabled,
    admin_only_commands
) VALUES 
(
    -1001234567890,
    true,
    6, -- Summarize every 6 hours
    15, -- Need at least 15 messages
    'en',
    'UTC',
    true,
    'realistic',
    5,
    'openai',
    500,
    true,
    true,
    false
),
(
    -1001234567891,
    true,
    12, -- Summarize every 12 hours
    20,
    'en',
    'America/New_York',
    true,
    'artistic',
    3,
    'claude',
    400,
    true,
    true,
    true -- Only admins can use commands
),
(
    123456789,
    false, -- No auto-summary for private chats
    24,
    5,
    'en',
    'UTC',
    true,
    'realistic',
    10,
    'openai',
    300,
    false,
    false,
    false
) ON CONFLICT (chat_id) DO NOTHING;

-- Sample user preferences
INSERT INTO user_preferences (
    user_id,
    username,
    first_name,
    last_name,
    language_code,
    timezone,
    mention_notifications,
    summary_notifications,
    allow_data_collection,
    share_usage_stats,
    default_image_style,
    prefer_private_images,
    daily_image_limit,
    daily_summary_limit,
    total_images_generated,
    total_summaries_requested,
    last_active_at
) VALUES 
(
    987654321,
    'alice_dev',
    'Alice',
    'Developer',
    'en',
    'UTC',
    true,
    true,
    true,
    false,
    'realistic',
    false,
    15,
    10,
    0,
    0,
    NOW() - INTERVAL '30 minutes'
),
(
    876543210,
    'bob_tester',
    'Bob',
    'Tester',
    'en',
    'America/Los_Angeles',
    true,
    false, -- Doesn't want summary notifications
    true,
    true, -- Shares usage stats
    'cartoon',
    true, -- Prefers private images
    8,
    5,
    0,
    0,
    NOW() - INTERVAL '2 hours'
),
(
    765432109,
    'charlie_admin',
    'Charlie',
    'Admin',
    'en',
    'Europe/London',
    true,
    true,
    true,
    true,
    'artistic',
    false,
    20,
    15,
    0,
    0,
    NOW() - INTERVAL '5 minutes'
) ON CONFLICT (user_id) DO NOTHING;

-- Sample messages for testing (recent enough to be considered for summary)
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
    is_processed,
    is_bot_command
) VALUES 
-- Test Group Messages
(
    -1001234567890,
    101,
    987654321,
    'alice_dev',
    'Alice',
    'Developer',
    'Hey everyone! Just finished implementing the new summary feature. Ready for testing!',
    'text',
    NOW() - INTERVAL '2 hours',
    false,
    false
),
(
    -1001234567890,
    102,
    876543210,
    'bob_tester',
    'Bob',
    'Tester',
    'Awesome! I can help test it. What should I focus on?',
    'text',
    NOW() - INTERVAL '1 hour 50 minutes',
    false,
    false
),
(
    -1001234567890,
    103,
    765432109,
    'charlie_admin',
    'Charlie',
    'Admin',
    '/summary',
    'text',
    NOW() - INTERVAL '1 hour 45 minutes',
    false,
    true
),
(
    -1001234567890,
    104,
    987654321,
    'alice_dev',
    'Alice',
    'Developer',
    'The bot should generate summaries automatically every 6 hours, but you can also trigger them manually with /summary',
    'text',
    NOW() - INTERVAL '1 hour 40 minutes',
    false,
    false
),
(
    -1001234567890,
    105,
    876543210,
    'bob_tester',
    'Bob',
    'Tester',
    'Got it! Let me test the image generation too. /image cute robot mascot',
    'text',
    NOW() - INTERVAL '1 hour 30 minutes',
    false,
    true
),
-- Development Team Chat Messages
(
    -1001234567891,
    201,
    765432109,
    'charlie_admin',
    'Charlie',
    'Admin',
    'Morning team! Today we need to finalize the database schema and test the RLS policies.',
    'text',
    NOW() - INTERVAL '3 hours',
    false,
    false
),
(
    -1001234567891,
    202,
    987654321,
    'alice_dev',
    'Alice',
    'Developer',
    'I have been working on the API integration. The OpenAI and Claude APIs are both connected now.',
    'text',
    NOW() - INTERVAL '2 hours 30 minutes',
    false,
    false
),
(
    -1001234567891,
    203,
    876543210,
    'bob_tester',
    'Bob',
    'Tester',
    'Performance testing looks good so far. The indexes are working well.',
    'text',
    NOW() - INTERVAL '2 hours',
    false,
    false
),
-- Private Chat Message
(
    123456789,
    301,
    765432109,
    'charlie_admin',
    'Charlie',
    'Admin',
    '/help',
    'text',
    NOW() - INTERVAL '10 minutes',
    false,
    true
) ON CONFLICT (chat_id, message_id) DO NOTHING;

-- Sample summary (showing what a completed summary looks like)
INSERT INTO summaries (
    chat_id,
    summary_text,
    summary_type,
    start_time,
    end_time,
    message_count,
    llm_provider,
    llm_model,
    prompt_tokens,
    completion_tokens,
    processing_time_ms,
    confidence_score,
    status
) VALUES (
    -1001234567890,
    'The team discussed the implementation of the new summary feature. Alice completed the development and Bob offered to help with testing. The bot can generate summaries automatically every 6 hours or manually with the /summary command. Bob also tested the image generation feature with a request for a "cute robot mascot".',
    'manual',
    NOW() - INTERVAL '2 hours 10 minutes',
    NOW() - INTERVAL '1 hour 25 minutes',
    4,
    'openai',
    'gpt-3.5-turbo',
    150,
    85,
    1250,
    0.92,
    'completed'
) ON CONFLICT DO NOTHING;

-- Sample generated image record
INSERT INTO generated_images (
    chat_id,
    user_id,
    username,
    prompt,
    style,
    api_provider,
    api_model,
    image_url,
    width,
    height,
    file_size,
    generation_time_ms,
    cost_usd,
    status
) VALUES (
    -1001234567890,
    876543210,
    'bob_tester',
    'cute robot mascot',
    'realistic',
    'dalle',
    'dall-e-3',
    'https://example.com/generated-image-url',
    1024,
    1024,
    245760, -- ~240KB
    8500,
    0.040000,
    'completed'
) ON CONFLICT DO NOTHING;

-- =============================================================================
-- API USAGE SAMPLE DATA (for cost tracking demonstration)
-- =============================================================================

INSERT INTO api_usage (
    provider,
    api_endpoint,
    model_used,
    input_tokens,
    output_tokens,
    total_tokens,
    cost_per_token,
    total_cost_usd,
    request_duration_ms,
    chat_id,
    user_id,
    activity_type,
    status
) VALUES 
-- OpenAI summary generation
(
    'openai',
    'chat/completions',
    'gpt-3.5-turbo',
    150,
    85,
    235,
    0.000002, -- $0.000002 per token for GPT-3.5-turbo
    0.000470,
    1250,
    -1001234567890,
    987654321,
    'summary',
    'success'
),
-- DALL-E image generation
(
    'dalle',
    'images/generations',
    'dall-e-3',
    NULL, -- Images don't use tokens
    NULL,
    NULL,
    NULL,
    0.040000, -- $0.04 per 1024x1024 image
    8500,
    -1001234567890,
    876543210,
    'image_generation',
    'success'
),
-- Claude API test
(
    'claude',
    'messages',
    'claude-3-sonnet',
    200,
    120,
    320,
    0.000003, -- Higher cost per token for Claude
    0.000960,
    2100,
    -1001234567891,
    765432109,
    'summary',
    'success'
);

-- =============================================================================
-- ACTIVITY LOG SAMPLE DATA
-- =============================================================================

INSERT INTO bot_activity_log (
    chat_id,
    user_id,
    activity_type,
    activity_description,
    status,
    duration_ms,
    request_data,
    response_data
) VALUES 
(
    -1001234567890,
    NULL,
    'bot_started',
    'Telegram bot started and webhook configured',
    'success',
    NULL,
    '{"webhook_url": "https://your-bot.netlify.app/.netlify/functions/webhook"}'::jsonb,
    '{"ok": true, "description": "Webhook was set"}'::jsonb
),
(
    -1001234567890,
    987654321,
    'message_received',
    'Text message received and processed',
    'success',
    45,
    '{"message_type": "text", "content_length": 87}'::jsonb,
    '{"stored": true, "message_id": "uuid-here"}'::jsonb
),
(
    -1001234567890,
    876543210,
    'image_generation_requested',
    'User requested image generation: cute robot mascot',
    'success',
    NULL,
    '{"prompt": "cute robot mascot", "style": "realistic"}'::jsonb,
    NULL
),
(
    NULL,
    NULL,
    'scheduled_task',
    'Automatic summary generation check completed',
    'success',
    156,
    '{"chats_checked": 3, "summaries_needed": 0}'::jsonb,
    '{"processed": 0, "skipped": 3}'::jsonb
);

-- =============================================================================
-- DEVELOPMENT UTILITIES
-- =============================================================================

-- Update last summary times to be in the past so we can test scheduling
UPDATE chat_settings 
SET last_summary_at = NOW() - INTERVAL '7 hours'
WHERE chat_id = -1001234567890; -- This chat should need a summary

UPDATE chat_settings 
SET last_summary_at = NOW() - INTERVAL '2 hours'  
WHERE chat_id = -1001234567891; -- This chat shouldn't need one yet

-- =============================================================================
-- DATA VALIDATION AND STATISTICS
-- =============================================================================

-- Log the initial data setup
INSERT INTO bot_activity_log (
    activity_type,
    activity_description,
    status,
    request_data
) VALUES (
    'initial_data_setup',
    'Sample data and initial configuration loaded',
    'success',
    json_build_object(
        'chat_groups_created', (SELECT COUNT(*) FROM chat_groups),
        'chat_settings_created', (SELECT COUNT(*) FROM chat_settings),
        'user_preferences_created', (SELECT COUNT(*) FROM user_preferences),
        'sample_messages_created', (SELECT COUNT(*) FROM messages),
        'sample_summaries_created', (SELECT COUNT(*) FROM summaries),
        'sample_images_created', (SELECT COUNT(*) FROM generated_images),
        'api_usage_records_created', (SELECT COUNT(*) FROM api_usage)
    )::jsonb
);

-- =============================================================================
-- USEFUL DEVELOPMENT QUERIES
-- =============================================================================
-- These are stored as comments for easy reference during development

/*
-- Check which chats need summarization right now:
SELECT * FROM get_chats_needing_summary();

-- Get recent activity summary:
SELECT 
    activity_type,
    COUNT(*) as count,
    MAX(created_at) as latest
FROM bot_activity_log 
WHERE created_at >= NOW() - INTERVAL '1 day'
GROUP BY activity_type
ORDER BY count DESC;

-- Check message processing status:
SELECT 
    chat_id,
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE is_processed) as processed,
    COUNT(*) FILTER (WHERE NOT is_processed) as unprocessed,
    COUNT(*) FILTER (WHERE is_bot_command) as bot_commands
FROM messages 
GROUP BY chat_id
ORDER BY chat_id;

-- View API costs by provider:
SELECT 
    provider,
    COUNT(*) as requests,
    SUM(total_cost_usd) as total_cost,
    AVG(request_duration_ms) as avg_duration_ms
FROM api_usage 
GROUP BY provider
ORDER BY total_cost DESC;

-- Get chat activity stats:
SELECT 
    cg.chat_title,
    COUNT(m.id) as messages,
    COUNT(DISTINCT m.user_id) as unique_users,
    MAX(m.timestamp) as last_message,
    COUNT(s.id) as summaries,
    COUNT(gi.id) as images_generated
FROM chat_groups cg
LEFT JOIN messages m ON cg.chat_id = m.chat_id
LEFT JOIN summaries s ON cg.chat_id = s.chat_id  
LEFT JOIN generated_images gi ON cg.chat_id = gi.chat_id
GROUP BY cg.chat_id, cg.chat_title
ORDER BY messages DESC;
*/

-- =============================================================================
-- FINAL SETUP VERIFICATION
-- =============================================================================

-- Verify that all main tables have data
DO $$
DECLARE
    table_name TEXT;
    row_count INTEGER;
BEGIN
    FOR table_name IN VALUES ('chat_groups'), ('chat_settings'), ('user_preferences'), ('messages') LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO row_count;
        RAISE NOTICE 'Table % has % rows', table_name, row_count;
    END LOOP;
END $$;

-- Update statistics after data insertion
ANALYZE chat_groups;
ANALYZE messages;
ANALYZE summaries;
ANALYZE generated_images;
ANALYZE chat_settings;
ANALYZE user_preferences;
ANALYZE bot_activity_log;
ANALYZE api_usage;

-- Log completion
INSERT INTO bot_activity_log (
    activity_type,
    activity_description,
    status
) VALUES (
    'database_setup_complete',
    'Database schema, indexes, policies, functions, and initial data setup completed successfully',
    'success'
);