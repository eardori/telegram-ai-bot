-- =============================================================================
-- Chat Tracking and Summarization Schema
-- Version: 1.0.0
-- Description: Database schema for chat tracking and conversation summarization
-- Created: 2025-09-13
-- =============================================================================

-- User Chat Tracking Table
-- Stores per-user tracking status for each chat
CREATE TABLE user_chat_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL, -- Telegram user ID
    chat_id BIGINT NOT NULL, -- Telegram chat ID
    
    -- Tracking status
    is_tracking BOOLEAN DEFAULT false,
    tracking_started_at TIMESTAMP WITH TIME ZONE,
    tracking_stopped_at TIMESTAMP WITH TIME ZONE,
    
    -- User information
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    
    -- Tracking preferences
    auto_summary_enabled BOOLEAN DEFAULT true, -- Whether to auto-summarize after tracking stops
    summary_language VARCHAR(10) DEFAULT 'ko', -- Language for summaries
    
    -- Statistics
    total_tracking_sessions INTEGER DEFAULT 0,
    total_messages_tracked INTEGER DEFAULT 0,
    total_summaries_generated INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    FOREIGN KEY (chat_id) REFERENCES chat_groups(chat_id) ON DELETE CASCADE,
    
    -- Unique constraint - one tracking status per user per chat
    UNIQUE(user_id, chat_id)
);

COMMENT ON TABLE user_chat_tracking IS 'Per-user conversation tracking status for each chat';
COMMENT ON COLUMN user_chat_tracking.is_tracking IS 'Whether user is currently tracking messages in this chat';
COMMENT ON COLUMN user_chat_tracking.auto_summary_enabled IS 'Whether to automatically generate summary when tracking stops';

-- Tracked Messages Table
-- Stores messages collected during active tracking sessions
CREATE TABLE tracked_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_session_id UUID NOT NULL, -- Links to tracking session
    
    -- Message details
    chat_id BIGINT NOT NULL,
    message_id INTEGER NOT NULL, -- Telegram message ID
    user_id BIGINT NOT NULL, -- Message author
    username VARCHAR(255),
    user_first_name VARCHAR(255),
    user_last_name VARCHAR(255),
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    
    -- Message context
    reply_to_message_id INTEGER,
    reply_to_content TEXT, -- Content of replied message for context
    thread_id INTEGER, -- For threaded conversations
    
    -- Temporal information
    message_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    tracking_recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Message processing flags
    is_bot_message BOOLEAN DEFAULT false, -- Message from bot itself
    is_command BOOLEAN DEFAULT false, -- Bot command message
    is_edited BOOLEAN DEFAULT false, -- Was message edited after tracking
    is_forwarded BOOLEAN DEFAULT false, -- Was message forwarded
    
    -- Content analysis flags (for filtering)
    is_meaningful BOOLEAN DEFAULT true, -- Contains meaningful content (not just emoji/short responses)
    contains_question BOOLEAN DEFAULT false, -- Contains a question
    contains_url BOOLEAN DEFAULT false, -- Contains URLs
    contains_media BOOLEAN DEFAULT false, -- Contains media files
    
    -- Foreign key constraints
    FOREIGN KEY (chat_id) REFERENCES chat_groups(chat_id) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate messages in same session
    UNIQUE(tracking_session_id, chat_id, message_id)
);

COMMENT ON TABLE tracked_messages IS 'Messages collected during active tracking sessions';
COMMENT ON COLUMN tracked_messages.is_meaningful IS 'Whether message contains substantial content worth including in summary';
COMMENT ON COLUMN tracked_messages.tracking_session_id IS 'UUID linking this message to specific tracking session';

-- Tracking Sessions Table
-- Groups tracked messages into sessions with metadata
CREATE TABLE tracking_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL, -- User who started tracking
    chat_id BIGINT NOT NULL,
    
    -- Session details
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN ended_at IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
            ELSE NULL
        END
    ) STORED,
    
    -- Session statistics
    total_messages_collected INTEGER DEFAULT 0,
    meaningful_messages_collected INTEGER DEFAULT 0, -- Only messages marked as meaningful
    unique_participants INTEGER DEFAULT 0, -- Number of different users who sent messages
    
    -- Session status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'stopped', 'summarized', 'expired'
    
    -- Auto-cleanup settings
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'), -- Auto-cleanup after 7 days
    
    -- Summary information (if generated)
    summary_generated BOOLEAN DEFAULT false,
    summary_generated_at TIMESTAMP WITH TIME ZONE,
    summary_id UUID, -- Reference to generated summary
    
    -- User context
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    FOREIGN KEY (chat_id) REFERENCES chat_groups(chat_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, chat_id) REFERENCES user_chat_tracking(user_id, chat_id) ON DELETE CASCADE,
    
    CONSTRAINT valid_tracking_status CHECK (status IN ('active', 'stopped', 'summarized', 'expired')),
    CONSTRAINT valid_session_times CHECK (
        (ended_at IS NULL) OR (ended_at > started_at)
    )
);

COMMENT ON TABLE tracking_sessions IS 'Individual tracking sessions with metadata and statistics';
COMMENT ON COLUMN tracking_sessions.meaningful_messages_collected IS 'Count of messages marked as meaningful content';
COMMENT ON COLUMN tracking_sessions.expires_at IS 'When to automatically clean up this session data';

-- Add foreign key reference from tracked_messages to tracking_sessions
ALTER TABLE tracked_messages 
ADD CONSTRAINT fk_tracked_messages_session 
FOREIGN KEY (tracking_session_id) REFERENCES tracking_sessions(id) ON DELETE CASCADE;

-- Conversation Summaries Table (Enhanced)
-- Extends existing summaries table for tracking-based summaries
CREATE TABLE conversation_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_session_id UUID NOT NULL, -- Links to specific tracking session
    chat_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL, -- User who requested/triggered the summary
    
    -- Summary content
    summary_text TEXT NOT NULL,
    summary_language VARCHAR(10) DEFAULT 'ko',
    
    -- Summary metadata
    summary_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'auto', 'scheduled'
    participant_count INTEGER NOT NULL, -- Number of unique participants
    message_count INTEGER NOT NULL, -- Total messages summarized
    meaningful_message_count INTEGER NOT NULL, -- Only meaningful messages
    
    -- Time period covered
    conversation_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    conversation_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    conversation_duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (conversation_end_time - conversation_start_time)) / 60
    ) STORED,
    
    -- AI processing details
    ai_model VARCHAR(100) DEFAULT 'claude-3-5-sonnet-20241022',
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    processing_time_ms INTEGER,
    generation_cost_usd DECIMAL(10,6),
    
    -- Summary quality metrics
    confidence_score DECIMAL(3,2), -- AI confidence in summary quality
    summary_length_chars INTEGER GENERATED ALWAYS AS (LENGTH(summary_text)) STORED,
    key_topics_count INTEGER DEFAULT 0, -- Number of main topics identified
    
    -- User context
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    
    -- Summary preferences used
    include_usernames BOOLEAN DEFAULT true,
    include_timestamps BOOLEAN DEFAULT false,
    focus_on_decisions BOOLEAN DEFAULT true,
    focus_on_questions BOOLEAN DEFAULT true,
    
    -- Status and delivery
    status VARCHAR(50) DEFAULT 'completed', -- 'generating', 'completed', 'failed'
    error_message TEXT,
    delivered_to_user BOOLEAN DEFAULT false,
    delivery_timestamp TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    FOREIGN KEY (tracking_session_id) REFERENCES tracking_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES chat_groups(chat_id) ON DELETE CASCADE,
    
    CONSTRAINT valid_summary_status CHECK (status IN ('generating', 'completed', 'failed')),
    CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT valid_time_period CHECK (conversation_end_time > conversation_start_time),
    CONSTRAINT valid_message_counts CHECK (
        message_count >= meaningful_message_count AND 
        meaningful_message_count > 0
    )
);

COMMENT ON TABLE conversation_summaries IS 'AI-generated summaries of tracked conversations';
COMMENT ON COLUMN conversation_summaries.meaningful_message_count IS 'Count of substantial messages included in summary';
COMMENT ON COLUMN conversation_summaries.focus_on_decisions IS 'Whether summary emphasized decisions made in conversation';

-- Update tracking_sessions to reference conversation_summaries
ALTER TABLE tracking_sessions 
ADD CONSTRAINT fk_tracking_sessions_summary 
FOREIGN KEY (summary_id) REFERENCES conversation_summaries(id) ON DELETE SET NULL;

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Indexes for user_chat_tracking
CREATE INDEX idx_user_chat_tracking_user_chat ON user_chat_tracking(user_id, chat_id);
CREATE INDEX idx_user_chat_tracking_active ON user_chat_tracking(chat_id) WHERE is_tracking = true;

-- Indexes for tracking_sessions
CREATE INDEX idx_tracking_sessions_user_chat ON tracking_sessions(user_id, chat_id);
CREATE INDEX idx_tracking_sessions_status ON tracking_sessions(status);
CREATE INDEX idx_tracking_sessions_active ON tracking_sessions(chat_id) WHERE status = 'active';
CREATE INDEX idx_tracking_sessions_expires ON tracking_sessions(expires_at) WHERE status IN ('stopped', 'active');

-- Indexes for tracked_messages
CREATE INDEX idx_tracked_messages_session ON tracked_messages(tracking_session_id);
CREATE INDEX idx_tracked_messages_timestamp ON tracked_messages(message_timestamp DESC);
CREATE INDEX idx_tracked_messages_meaningful ON tracked_messages(tracking_session_id) WHERE is_meaningful = true;
CREATE INDEX idx_tracked_messages_chat_time ON tracked_messages(chat_id, message_timestamp DESC);

-- Indexes for conversation_summaries
CREATE INDEX idx_conversation_summaries_user_chat ON conversation_summaries(user_id, chat_id);
CREATE INDEX idx_conversation_summaries_session ON conversation_summaries(tracking_session_id);
CREATE INDEX idx_conversation_summaries_created ON conversation_summaries(created_at DESC);

-- =============================================================================
-- TRIGGERS AND FUNCTIONS
-- =============================================================================

-- Function to update tracking session statistics when messages are added
CREATE OR REPLACE FUNCTION update_tracking_session_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tracking_sessions 
        SET 
            total_messages_collected = total_messages_collected + 1,
            meaningful_messages_collected = CASE 
                WHEN NEW.is_meaningful THEN meaningful_messages_collected + 1
                ELSE meaningful_messages_collected
            END
        WHERE id = NEW.tracking_session_id;
        
        -- Update unique participants count
        UPDATE tracking_sessions 
        SET unique_participants = (
            SELECT COUNT(DISTINCT user_id) 
            FROM tracked_messages 
            WHERE tracking_session_id = NEW.tracking_session_id
        )
        WHERE id = NEW.tracking_session_id;
        
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update session stats when messages are tracked
CREATE TRIGGER update_session_stats_on_message
    AFTER INSERT ON tracked_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_session_stats();

-- Function to update user tracking statistics
CREATE OR REPLACE FUNCTION update_user_tracking_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.is_tracking = true AND NEW.is_tracking = false THEN
        -- Tracking stopped
        UPDATE user_chat_tracking 
        SET 
            total_tracking_sessions = total_tracking_sessions + 1,
            tracking_stopped_at = NOW()
        WHERE user_id = NEW.user_id AND chat_id = NEW.chat_id;
        
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'UPDATE' AND OLD.is_tracking = false AND NEW.is_tracking = true THEN
        -- Tracking started
        UPDATE user_chat_tracking 
        SET tracking_started_at = NOW()
        WHERE user_id = NEW.user_id AND chat_id = NEW.chat_id;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update user stats when tracking status changes
CREATE TRIGGER update_user_stats_on_tracking_change
    AFTER UPDATE ON user_chat_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_user_tracking_stats();

-- Function to automatically expire old tracking sessions
CREATE OR REPLACE FUNCTION expire_old_tracking_sessions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE tracking_sessions 
    SET 
        status = 'expired',
        ended_at = CASE WHEN ended_at IS NULL THEN expires_at ELSE ended_at END
    WHERE 
        status IN ('active', 'stopped') 
        AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Also update user tracking status for expired sessions
    UPDATE user_chat_tracking 
    SET 
        is_tracking = false,
        tracking_stopped_at = NOW()
    WHERE (user_id, chat_id) IN (
        SELECT user_id, chat_id 
        FROM tracking_sessions 
        WHERE status = 'expired' AND ended_at >= NOW() - INTERVAL '1 hour'
    );
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_old_tracking_sessions() IS 'Automatically expires old tracking sessions and updates user status';

-- Function to clean up old tracking data (for scheduled cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_tracking_data(days_to_keep INTEGER DEFAULT 30)
RETURNS TABLE(
    deleted_sessions INTEGER,
    deleted_messages INTEGER,
    deleted_summaries INTEGER
) AS $$
DECLARE
    session_count INTEGER;
    message_count INTEGER;
    summary_count INTEGER;
BEGIN
    -- Delete old summaries first (they reference sessions)
    DELETE FROM conversation_summaries 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS summary_count = ROW_COUNT;
    
    -- Delete old tracked messages (they reference sessions)
    DELETE FROM tracked_messages 
    WHERE tracking_recorded_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS message_count = ROW_COUNT;
    
    -- Delete old tracking sessions
    DELETE FROM tracking_sessions 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS session_count = ROW_COUNT;
    
    RETURN QUERY SELECT session_count, message_count, summary_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_tracking_data IS 'Removes tracking data older than specified days (default 30)';

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Active Tracking Sessions View
CREATE VIEW active_tracking_sessions AS
SELECT 
    ts.id as session_id,
    ts.user_id,
    ts.chat_id,
    cg.chat_title,
    ts.username,
    ts.first_name,
    ts.started_at,
    ts.total_messages_collected,
    ts.meaningful_messages_collected,
    ts.unique_participants,
    EXTRACT(EPOCH FROM (NOW() - ts.started_at)) / 60 as duration_minutes,
    ts.expires_at
FROM tracking_sessions ts
JOIN chat_groups cg ON ts.chat_id = cg.chat_id
WHERE ts.status = 'active'
ORDER BY ts.started_at DESC;

COMMENT ON VIEW active_tracking_sessions IS 'Currently active tracking sessions with real-time statistics';

-- User Tracking Status View
CREATE VIEW user_tracking_status AS
SELECT 
    uct.user_id,
    uct.chat_id,
    cg.chat_title,
    uct.username,
    uct.first_name,
    uct.is_tracking,
    uct.tracking_started_at,
    ts.id as current_session_id,
    ts.total_messages_collected as current_session_messages,
    uct.total_tracking_sessions,
    uct.total_summaries_generated
FROM user_chat_tracking uct
JOIN chat_groups cg ON uct.chat_id = cg.chat_id
LEFT JOIN tracking_sessions ts ON ts.user_id = uct.user_id 
    AND ts.chat_id = uct.chat_id 
    AND ts.status = 'active'
ORDER BY uct.updated_at DESC;

COMMENT ON VIEW user_tracking_status IS 'Current tracking status for all users across all chats';

-- Ready for Summary View
CREATE VIEW sessions_ready_for_summary AS
SELECT 
    ts.id as session_id,
    ts.user_id,
    ts.chat_id,
    cg.chat_title,
    ts.username,
    ts.first_name,
    ts.started_at,
    ts.ended_at,
    ts.meaningful_messages_collected,
    ts.unique_participants,
    ts.duration_minutes
FROM tracking_sessions ts
JOIN chat_groups cg ON ts.chat_id = cg.chat_id
WHERE 
    ts.status = 'stopped' 
    AND ts.summary_generated = false 
    AND ts.meaningful_messages_collected > 0
ORDER BY ts.ended_at ASC;

COMMENT ON VIEW sessions_ready_for_summary IS 'Tracking sessions that have stopped and are ready for summarization';

-- =============================================================================
-- INITIAL SETUP COMPLETE
-- =============================================================================

-- Log successful schema creation
INSERT INTO bot_activity_log (
    activity_type,
    activity_description,
    status
) VALUES (
    'schema_extension',
    'Chat tracking and summarization schema created successfully',
    'success'
);