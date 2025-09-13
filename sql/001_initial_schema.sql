-- =============================================================================
-- Telegram Bot Database Schema
-- Version: 1.0.0
-- Description: Initial database schema for Telegram group chat AI bot
-- Created: 2025-09-10
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Chat Groups Table
-- Stores information about Telegram chat groups where the bot is active
CREATE TABLE chat_groups (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT UNIQUE NOT NULL, -- Telegram chat ID
    chat_title VARCHAR(255) NOT NULL,
    chat_type VARCHAR(50) NOT NULL DEFAULT 'group', -- 'group', 'supergroup', 'private'
    is_active BOOLEAN DEFAULT true,
    bot_added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    member_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_chat_type CHECK (chat_type IN ('group', 'supergroup', 'private'))
);

COMMENT ON TABLE chat_groups IS 'Telegram chat groups where the bot is active';
COMMENT ON COLUMN chat_groups.chat_id IS 'Unique Telegram chat identifier';
COMMENT ON COLUMN chat_groups.chat_type IS 'Type of chat: group, supergroup, or private';

-- Messages Table
-- Stores all messages from Telegram chats for processing and summarization
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id BIGINT NOT NULL,
    message_id INTEGER NOT NULL, -- Telegram message ID
    user_id BIGINT NOT NULL, -- Telegram user ID
    username VARCHAR(255), -- Telegram username (can be null)
    user_first_name VARCHAR(255),
    user_last_name VARCHAR(255),
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'photo', 'document', 'sticker', etc.
    reply_to_message_id INTEGER, -- If replying to another message
    forward_from_user_id BIGINT, -- If forwarded from another user
    
    -- Message metadata
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    edited_at TIMESTAMP WITH TIME ZONE, -- If message was edited
    
    -- Processing flags
    is_processed BOOLEAN DEFAULT false, -- Has been included in summary
    is_bot_command BOOLEAN DEFAULT false, -- Is a bot command message
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    FOREIGN KEY (chat_id) REFERENCES chat_groups(chat_id) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate messages
    UNIQUE(chat_id, message_id),
    
    CONSTRAINT valid_message_type CHECK (message_type IN (
        'text', 'photo', 'video', 'document', 'audio', 'voice', 
        'sticker', 'animation', 'location', 'contact', 'poll'
    ))
);

COMMENT ON TABLE messages IS 'All messages from Telegram chats stored for processing';
COMMENT ON COLUMN messages.is_processed IS 'Whether this message has been included in a summary';
COMMENT ON COLUMN messages.is_bot_command IS 'Whether this message is a bot command (starts with /)';

-- Summaries Table
-- Stores generated summaries of chat conversations
CREATE TABLE summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id BIGINT NOT NULL,
    summary_text TEXT NOT NULL,
    summary_type VARCHAR(50) DEFAULT 'auto', -- 'auto', 'manual', 'scheduled'
    
    -- Time period covered by summary
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    
    -- LLM processing info
    llm_provider VARCHAR(100), -- 'openai', 'claude', 'gemini', etc.
    llm_model VARCHAR(100), -- 'gpt-4', 'claude-3-sonnet', etc.
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    processing_time_ms INTEGER, -- Time taken to generate summary
    
    -- Quality metrics
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Status and metadata
    status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT, -- If generation failed
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (chat_id) REFERENCES chat_groups(chat_id) ON DELETE CASCADE,
    
    CONSTRAINT valid_summary_type CHECK (summary_type IN ('auto', 'manual', 'scheduled')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT valid_time_period CHECK (end_time > start_time)
);

COMMENT ON TABLE summaries IS 'Generated summaries of chat conversations';
COMMENT ON COLUMN summaries.summary_type IS 'How the summary was triggered: auto, manual, or scheduled';
COMMENT ON COLUMN summaries.confidence_score IS 'AI confidence in summary quality (0.00-1.00)';

-- Generated Images Table
-- Stores information about AI-generated images
CREATE TABLE generated_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    username VARCHAR(255),
    
    -- Image generation details
    prompt TEXT NOT NULL,
    negative_prompt TEXT, -- What to avoid in the image
    style VARCHAR(100), -- 'realistic', 'cartoon', 'anime', etc.
    
    -- API provider info
    api_provider VARCHAR(100) NOT NULL, -- 'dalle', 'midjourney', 'stable-diffusion', etc.
    api_model VARCHAR(100), -- Specific model used
    
    -- Image details
    image_url VARCHAR(1000), -- URL where image is stored
    image_file_id VARCHAR(500), -- Telegram file ID after upload
    width INTEGER,
    height INTEGER,
    file_size INTEGER, -- In bytes
    
    -- Generation parameters
    seed INTEGER, -- For reproducibility
    steps INTEGER, -- Number of generation steps
    cfg_scale DECIMAL(4,2), -- Classifier-free guidance scale
    
    -- Processing info
    generation_time_ms INTEGER,
    cost_usd DECIMAL(10,6), -- Cost in USD
    
    -- Status
    status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'generating', 'completed', 'failed'
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (chat_id) REFERENCES chat_groups(chat_id) ON DELETE CASCADE,
    
    CONSTRAINT valid_api_provider CHECK (api_provider IN (
        'dalle', 'dalle-2', 'dalle-3', 'midjourney', 'stable-diffusion', 
        'stable-diffusion-xl', 'firefly', 'imagen'
    )),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    CONSTRAINT valid_dimensions CHECK (
        (width IS NULL AND height IS NULL) OR (width > 0 AND height > 0)
    )
);

COMMENT ON TABLE generated_images IS 'AI-generated images and their metadata';
COMMENT ON COLUMN generated_images.cfg_scale IS 'How closely to follow the prompt (higher = more strict)';
COMMENT ON COLUMN generated_images.seed IS 'Random seed for reproducible generation';

-- Chat Settings Table
-- Stores configuration settings for each chat group
CREATE TABLE chat_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id BIGINT UNIQUE NOT NULL,
    
    -- Summary settings
    summary_enabled BOOLEAN DEFAULT true,
    summary_interval_hours INTEGER DEFAULT 6, -- How often to auto-summarize
    summary_min_messages INTEGER DEFAULT 10, -- Minimum messages needed for summary
    last_summary_at TIMESTAMP WITH TIME ZONE,
    
    -- Language settings
    language_code VARCHAR(10) DEFAULT 'en', -- ISO 639-1 language code
    timezone VARCHAR(50) DEFAULT 'UTC', -- IANA timezone identifier
    
    -- Image generation settings
    image_generation_enabled BOOLEAN DEFAULT true,
    default_image_style VARCHAR(100) DEFAULT 'realistic',
    max_images_per_hour INTEGER DEFAULT 5,
    
    -- LLM preferences
    preferred_llm_provider VARCHAR(100) DEFAULT 'openai',
    max_tokens_per_summary INTEGER DEFAULT 500,
    
    -- Content filtering
    content_filter_enabled BOOLEAN DEFAULT true,
    nsfw_filter_enabled BOOLEAN DEFAULT true,
    
    -- Admin settings
    admin_only_commands BOOLEAN DEFAULT false, -- Only admins can use commands
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (chat_id) REFERENCES chat_groups(chat_id) ON DELETE CASCADE,
    
    CONSTRAINT valid_summary_interval CHECK (summary_interval_hours BETWEEN 1 AND 168), -- 1 hour to 1 week
    CONSTRAINT valid_summary_min_messages CHECK (summary_min_messages BETWEEN 1 AND 1000),
    CONSTRAINT valid_max_images_per_hour CHECK (max_images_per_hour BETWEEN 1 AND 100),
    CONSTRAINT valid_max_tokens CHECK (max_tokens_per_summary BETWEEN 100 AND 2000)
);

COMMENT ON TABLE chat_settings IS 'Configuration settings for each chat group';
COMMENT ON COLUMN chat_settings.summary_interval_hours IS 'Hours between automatic summaries (1-168)';
COMMENT ON COLUMN chat_settings.admin_only_commands IS 'Whether only chat admins can use bot commands';

-- User Preferences Table
-- Stores individual user preferences across all chats
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    
    -- Language and locale
    language_code VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Notification preferences
    mention_notifications BOOLEAN DEFAULT true,
    summary_notifications BOOLEAN DEFAULT true,
    
    -- Privacy settings
    allow_data_collection BOOLEAN DEFAULT true,
    share_usage_stats BOOLEAN DEFAULT false,
    
    -- Image generation preferences
    default_image_style VARCHAR(100) DEFAULT 'realistic',
    prefer_private_images BOOLEAN DEFAULT false, -- Send images privately instead of to group
    
    -- Usage limits (to prevent abuse)
    daily_image_limit INTEGER DEFAULT 10,
    daily_summary_limit INTEGER DEFAULT 5,
    
    -- Usage tracking
    total_images_generated INTEGER DEFAULT 0,
    total_summaries_requested INTEGER DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_daily_limits CHECK (
        daily_image_limit BETWEEN 1 AND 100 AND 
        daily_summary_limit BETWEEN 1 AND 50
    )
);

COMMENT ON TABLE user_preferences IS 'Individual user preferences and settings';
COMMENT ON COLUMN user_preferences.allow_data_collection IS 'Whether user allows message content to be stored';

-- =============================================================================
-- AUDIT AND LOGGING TABLES
-- =============================================================================

-- Bot Activity Log
-- Tracks all bot activities for monitoring and debugging
CREATE TABLE bot_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id BIGINT,
    user_id BIGINT,
    
    -- Activity details
    activity_type VARCHAR(100) NOT NULL, -- 'message_received', 'summary_generated', 'image_created', etc.
    activity_description TEXT,
    
    -- Request/Response data (for API calls)
    request_data JSONB,
    response_data JSONB,
    
    -- Performance metrics
    duration_ms INTEGER,
    
    -- Status and error handling
    status VARCHAR(50) DEFAULT 'success', -- 'success', 'error', 'warning'
    error_code VARCHAR(100),
    error_message TEXT,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_activity_status CHECK (status IN ('success', 'error', 'warning'))
);

COMMENT ON TABLE bot_activity_log IS 'Comprehensive activity log for monitoring and debugging';
COMMENT ON COLUMN bot_activity_log.activity_type IS 'Type of activity performed by the bot';

-- API Usage Tracking
-- Tracks usage of external APIs for cost monitoring
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- API details
    provider VARCHAR(100) NOT NULL, -- 'openai', 'claude', 'dalle', etc.
    api_endpoint VARCHAR(255) NOT NULL,
    model_used VARCHAR(100),
    
    -- Usage metrics
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    
    -- Cost tracking
    cost_per_token DECIMAL(12,8), -- Very small numbers for token pricing
    total_cost_usd DECIMAL(10,6),
    
    -- Performance
    request_duration_ms INTEGER,
    
    -- Context
    chat_id BIGINT,
    user_id BIGINT,
    activity_type VARCHAR(100), -- 'summary', 'image_generation', etc.
    
    -- Status
    status VARCHAR(50) DEFAULT 'success',
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_api_status CHECK (status IN ('success', 'error', 'timeout', 'rate_limited'))
);

COMMENT ON TABLE api_usage IS 'Tracking of external API usage and costs';
COMMENT ON COLUMN api_usage.cost_per_token IS 'Cost per token in USD (very small decimal)';

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Recent Messages View
-- Easy access to recent messages with user info
CREATE VIEW recent_messages AS
SELECT 
    m.id,
    m.chat_id,
    cg.chat_title,
    m.message_id,
    m.user_id,
    m.username,
    m.user_first_name,
    m.user_last_name,
    m.content,
    m.message_type,
    m.timestamp,
    m.is_processed,
    m.is_bot_command
FROM messages m
JOIN chat_groups cg ON m.chat_id = cg.chat_id
WHERE m.timestamp >= NOW() - INTERVAL '7 days'
ORDER BY m.timestamp DESC;

COMMENT ON VIEW recent_messages IS 'Recent messages from the last 7 days with chat info';

-- Chat Activity Summary View
-- Summary of activity per chat group
CREATE VIEW chat_activity_summary AS
SELECT 
    cg.chat_id,
    cg.chat_title,
    cg.is_active,
    COUNT(m.id) as total_messages,
    COUNT(DISTINCT m.user_id) as unique_users,
    MAX(m.timestamp) as last_message_at,
    COUNT(s.id) as total_summaries,
    COUNT(gi.id) as total_images_generated
FROM chat_groups cg
LEFT JOIN messages m ON cg.chat_id = m.chat_id
LEFT JOIN summaries s ON cg.chat_id = s.chat_id
LEFT JOIN generated_images gi ON cg.chat_id = gi.chat_id
GROUP BY cg.chat_id, cg.chat_title, cg.is_active
ORDER BY last_message_at DESC NULLS LAST;

COMMENT ON VIEW chat_activity_summary IS 'Summary of activity metrics per chat group';

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_chat_groups_updated_at BEFORE UPDATE ON chat_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_settings_updated_at BEFORE UPDATE ON chat_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update last_activity on chat_groups when new message arrives
CREATE OR REPLACE FUNCTION update_chat_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_groups 
    SET last_activity = NEW.timestamp
    WHERE chat_id = NEW.chat_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_activity_on_message AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_chat_last_activity();

COMMENT ON FUNCTION update_chat_last_activity() IS 'Updates chat group last_activity when new message is received';

-- =============================================================================
-- INITIAL SETUP COMPLETE
-- =============================================================================

-- Log successful schema creation
INSERT INTO bot_activity_log (
    activity_type,
    activity_description,
    status
) VALUES (
    'schema_creation',
    'Initial database schema created successfully',
    'success'
);