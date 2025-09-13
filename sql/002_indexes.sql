-- =============================================================================
-- Database Indexes for Performance Optimization
-- Version: 1.0.0
-- Description: Creates indexes to optimize query performance for Telegram bot
-- Created: 2025-09-10
-- Dependencies: 001_initial_schema.sql
-- =============================================================================

-- =============================================================================
-- MESSAGES TABLE INDEXES
-- =============================================================================

-- Primary lookup indexes for message queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_chat_id_timestamp 
ON messages (chat_id, timestamp DESC);
COMMENT ON INDEX idx_messages_chat_id_timestamp IS 'Fast lookup for messages by chat ordered by time';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_chat_id_processed 
ON messages (chat_id, is_processed, timestamp) 
WHERE NOT is_processed;
COMMENT ON INDEX idx_messages_chat_id_processed IS 'Optimizes finding unprocessed messages for summarization';

-- User activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_user_id_timestamp 
ON messages (user_id, timestamp DESC);
COMMENT ON INDEX idx_messages_user_id_timestamp IS 'User message history lookup';

-- Message type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_chat_type_timestamp 
ON messages (chat_id, message_type, timestamp DESC);
COMMENT ON INDEX idx_messages_chat_type_timestamp IS 'Filter messages by type (text, photo, etc.)';

-- Bot command optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_bot_commands 
ON messages (chat_id, is_bot_command, timestamp DESC) 
WHERE is_bot_command = true;
COMMENT ON INDEX idx_messages_bot_commands IS 'Quick access to bot command messages';

-- Full-text search on message content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_content_fts 
ON messages USING gin(to_tsvector('english', content));
COMMENT ON INDEX idx_messages_content_fts IS 'Full-text search on message content';

-- Recent messages optimization (commonly queried)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_recent 
ON messages (timestamp DESC) 
WHERE timestamp >= NOW() - INTERVAL '30 days';
COMMENT ON INDEX idx_messages_recent IS 'Optimizes queries for recent messages';

-- =============================================================================
-- SUMMARIES TABLE INDEXES
-- =============================================================================

-- Chat summaries lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_chat_id_created 
ON summaries (chat_id, created_at DESC);
COMMENT ON INDEX idx_summaries_chat_id_created IS 'Latest summaries per chat';

-- Time period coverage index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_time_period 
ON summaries (chat_id, start_time, end_time);
COMMENT ON INDEX idx_summaries_time_period IS 'Finding summaries by time period coverage';

-- Status monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_status 
ON summaries (status, created_at DESC) 
WHERE status IN ('pending', 'processing', 'failed');
COMMENT ON INDEX idx_summaries_status IS 'Monitor pending or failed summaries';

-- LLM provider analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_llm_provider 
ON summaries (llm_provider, created_at DESC) 
WHERE llm_provider IS NOT NULL;
COMMENT ON INDEX idx_summaries_llm_provider IS 'Analytics on LLM provider usage';

-- Full-text search on summaries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_content_fts 
ON summaries USING gin(to_tsvector('english', summary_text));
COMMENT ON INDEX idx_summaries_content_fts IS 'Full-text search on summary content';

-- =============================================================================
-- GENERATED IMAGES TABLE INDEXES
-- =============================================================================

-- Image history per chat
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_images_chat_created 
ON generated_images (chat_id, created_at DESC);
COMMENT ON INDEX idx_generated_images_chat_created IS 'Image generation history per chat';

-- User image history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_images_user_created 
ON generated_images (user_id, created_at DESC);
COMMENT ON INDEX idx_generated_images_user_created IS 'User image generation history';

-- API provider analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_images_provider 
ON generated_images (api_provider, created_at DESC);
COMMENT ON INDEX idx_generated_images_provider IS 'Analytics on image generation API usage';

-- Status monitoring for failed generations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_images_status 
ON generated_images (status, created_at DESC) 
WHERE status IN ('pending', 'generating', 'failed');
COMMENT ON INDEX idx_generated_images_status IS 'Monitor image generation status';

-- Prompt search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_images_prompt_fts 
ON generated_images USING gin(to_tsvector('english', prompt));
COMMENT ON INDEX idx_generated_images_prompt_fts IS 'Full-text search on image prompts';

-- Cost tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_images_cost 
ON generated_images (api_provider, created_at) 
WHERE cost_usd IS NOT NULL;
COMMENT ON INDEX idx_generated_images_cost IS 'Cost analysis for image generation';

-- =============================================================================
-- CHAT GROUPS TABLE INDEXES
-- =============================================================================

-- Active chats lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_groups_active 
ON chat_groups (is_active, last_activity DESC) 
WHERE is_active = true;
COMMENT ON INDEX idx_chat_groups_active IS 'Quick access to active chat groups';

-- Chat type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_groups_type 
ON chat_groups (chat_type, created_at DESC);
COMMENT ON INDEX idx_chat_groups_type IS 'Filter chats by type (group, supergroup, private)';

-- =============================================================================
-- CHAT SETTINGS TABLE INDEXES
-- =============================================================================

-- Summary scheduling optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_settings_summary_schedule 
ON chat_settings (summary_enabled, last_summary_at) 
WHERE summary_enabled = true;
COMMENT ON INDEX idx_chat_settings_summary_schedule IS 'Optimize summary scheduling queries';

-- Image generation settings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_settings_image_enabled 
ON chat_settings (image_generation_enabled) 
WHERE image_generation_enabled = true;
COMMENT ON INDEX idx_chat_settings_image_enabled IS 'Quick lookup for chats with image generation enabled';

-- =============================================================================
-- USER PREFERENCES TABLE INDEXES
-- =============================================================================

-- Active users lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_active 
ON user_preferences (last_active_at DESC) 
WHERE last_active_at >= NOW() - INTERVAL '30 days';
COMMENT ON INDEX idx_user_preferences_active IS 'Recently active users';

-- Data collection consent
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_data_collection 
ON user_preferences (allow_data_collection, updated_at DESC);
COMMENT ON INDEX idx_user_preferences_data_collection IS 'Users who allow data collection';

-- =============================================================================
-- AUDIT LOG TABLE INDEXES
-- =============================================================================

-- Activity monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_activity_log_type_created 
ON bot_activity_log (activity_type, created_at DESC);
COMMENT ON INDEX idx_bot_activity_log_type_created IS 'Activity monitoring by type';

-- Error tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_activity_log_errors 
ON bot_activity_log (status, created_at DESC) 
WHERE status IN ('error', 'warning');
COMMENT ON INDEX idx_bot_activity_log_errors IS 'Quick access to errors and warnings';

-- Performance monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_activity_log_performance 
ON bot_activity_log (activity_type, duration_ms) 
WHERE duration_ms IS NOT NULL;
COMMENT ON INDEX idx_bot_activity_log_performance IS 'Performance analysis by activity type';

-- Chat-specific activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_activity_log_chat 
ON bot_activity_log (chat_id, created_at DESC) 
WHERE chat_id IS NOT NULL;
COMMENT ON INDEX idx_bot_activity_log_chat IS 'Activity logs per chat';

-- =============================================================================
-- API USAGE TABLE INDEXES
-- =============================================================================

-- Cost monitoring by provider
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_provider_cost 
ON api_usage (provider, created_at DESC) 
WHERE total_cost_usd IS NOT NULL;
COMMENT ON INDEX idx_api_usage_provider_cost IS 'Cost analysis by API provider';

-- Token usage analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_tokens 
ON api_usage (provider, model_used, created_at DESC) 
WHERE total_tokens IS NOT NULL;
COMMENT ON INDEX idx_api_usage_tokens IS 'Token usage analytics by provider and model';

-- Performance monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_performance 
ON api_usage (provider, api_endpoint, request_duration_ms) 
WHERE request_duration_ms IS NOT NULL;
COMMENT ON INDEX idx_api_usage_performance IS 'API performance monitoring';

-- Error tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_errors 
ON api_usage (provider, status, created_at DESC) 
WHERE status != 'success';
COMMENT ON INDEX idx_api_usage_errors IS 'API error monitoring';

-- Daily usage rollups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_daily 
ON api_usage (provider, DATE(created_at), total_cost_usd) 
WHERE total_cost_usd IS NOT NULL;
COMMENT ON INDEX idx_api_usage_daily IS 'Daily cost rollup optimization';

-- =============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- =============================================================================

-- Messages for summary generation (unprocessed messages in time range)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_summary_candidates 
ON messages (chat_id, is_processed, timestamp, is_bot_command) 
WHERE NOT is_processed AND NOT is_bot_command;
COMMENT ON INDEX idx_messages_summary_candidates IS 'Optimizes finding messages ready for summarization';

-- User activity analysis (messages per user per chat)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_user_chat_activity 
ON messages (chat_id, user_id, timestamp DESC) 
WHERE NOT is_bot_command;
COMMENT ON INDEX idx_messages_user_chat_activity IS 'User activity analysis per chat';

-- Recent image generations per user (rate limiting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_images_rate_limiting 
ON generated_images (user_id, created_at DESC) 
WHERE created_at >= NOW() - INTERVAL '1 day' AND status = 'completed';
COMMENT ON INDEX idx_generated_images_rate_limiting IS 'Rate limiting for image generation per user';

-- Summary generation scheduling
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_summary_schedule 
ON chat_settings (summary_enabled, summary_interval_hours, last_summary_at) 
WHERE summary_enabled = true;
COMMENT ON INDEX idx_chat_summary_schedule IS 'Optimizes summary scheduling logic';

-- =============================================================================
-- PARTIAL INDEXES FOR STORAGE EFFICIENCY
-- =============================================================================

-- Only index recent data for frequently accessed tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_recent_30d 
ON messages (chat_id, timestamp DESC) 
WHERE timestamp >= NOW() - INTERVAL '30 days';
COMMENT ON INDEX idx_messages_recent_30d IS 'Optimizes recent message queries';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_summaries_recent_90d 
ON summaries (chat_id, created_at DESC) 
WHERE created_at >= NOW() - INTERVAL '90 days';
COMMENT ON INDEX idx_summaries_recent_90d IS 'Recent summaries optimization';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_images_recent_30d 
ON generated_images (chat_id, user_id, created_at DESC) 
WHERE created_at >= NOW() - INTERVAL '30 days';
COMMENT ON INDEX idx_generated_images_recent_30d IS 'Recent image generations optimization';

-- =============================================================================
-- STATISTICS UPDATE
-- =============================================================================

-- Update table statistics to help query planner
ANALYZE chat_groups;
ANALYZE messages;
ANALYZE summaries;
ANALYZE generated_images;
ANALYZE chat_settings;
ANALYZE user_preferences;
ANALYZE bot_activity_log;
ANALYZE api_usage;

-- =============================================================================
-- INDEX MAINTENANCE NOTES
-- =============================================================================

/*
Index Maintenance Best Practices:

1. Monitor index usage:
   SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
   FROM pg_stat_user_indexes 
   WHERE schemaname = 'public' 
   ORDER BY idx_tup_read DESC;

2. Check index sizes:
   SELECT schemaname, tablename, indexname, 
          pg_size_pretty(pg_relation_size(indexrelid)) as size
   FROM pg_stat_user_indexes 
   WHERE schemaname = 'public'
   ORDER BY pg_relation_size(indexrelid) DESC;

3. Unused indexes (run after some usage):
   SELECT schemaname, tablename, indexname, idx_tup_read
   FROM pg_stat_user_indexes 
   WHERE schemaname = 'public' AND idx_tup_read = 0
   ORDER BY pg_relation_size(indexrelid) DESC;

4. Reindex periodically for heavily updated tables:
   REINDEX TABLE messages;
   REINDEX TABLE summaries;

5. Consider dropping unused indexes:
   -- Only after confirming they're truly unused
   -- DROP INDEX IF EXISTS unused_index_name;
*/