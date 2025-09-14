-- =============================================================================
-- COMBINED DATABASE SETUP FOR TELEGRAM BOT
-- This script combines all required schemas for:
-- 1. Chat tracking system
-- 2. Dynamic prompt management
-- 3. Bot activity logging
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. INITIAL CORE SCHEMA (from 001_initial_schema.sql)
-- =============================================================================

-- Bot Activity Log
CREATE TABLE IF NOT EXISTS bot_activity_log (
    id BIGSERIAL PRIMARY KEY,
    activity_type TEXT NOT NULL,
    activity_description TEXT,
    user_id BIGINT,
    chat_id BIGINT,
    message_id BIGINT,
    status TEXT DEFAULT 'success',
    error_code TEXT,
    error_message TEXT,
    request_data JSONB,
    response_data JSONB,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    language_code TEXT DEFAULT 'ko',
    timezone TEXT DEFAULT 'Asia/Seoul',
    notification_enabled BOOLEAN DEFAULT TRUE,
    auto_summary_enabled BOOLEAN DEFAULT TRUE,
    summary_interval_hours INTEGER DEFAULT 6,
    max_summary_length INTEGER DEFAULT 2000,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. CHAT GROUPS TABLE (from 001_initial_schema.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_groups (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT UNIQUE NOT NULL,
    chat_title TEXT,
    chat_type TEXT CHECK (chat_type IN ('private', 'group', 'supergroup', 'channel')),
    is_active BOOLEAN DEFAULT TRUE,
    member_count INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. DYNAMIC PROMPT MANAGEMENT (from database/schema.sql)
-- =============================================================================

-- Prompts table for dynamic prompt management
CREATE TABLE IF NOT EXISTS prompts (
    id BIGSERIAL PRIMARY KEY,
    prompt_type TEXT NOT NULL CHECK (prompt_type IN ('image_generation', 'qa_system', 'summarization', 'custom')),
    prompt_name TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    prompt_version INTEGER DEFAULT 1,
    template_variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    usage_count BIGINT DEFAULT 0,
    average_response_time_ms DECIMAL,
    success_rate DECIMAL DEFAULT 100.0,
    created_by TEXT DEFAULT 'system',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(prompt_type, prompt_name)
);

-- Prompt usage analytics
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

-- =============================================================================
-- 4. CHAT TRACKING SYSTEM (from sql/006_chat_tracking_schema.sql)
-- =============================================================================

-- User chat tracking preferences
CREATE TABLE IF NOT EXISTS user_chat_tracking (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    is_tracking BOOLEAN DEFAULT FALSE,
    tracking_started_at TIMESTAMPTZ,
    tracking_stopped_at TIMESTAMPTZ,
    auto_summary_enabled BOOLEAN DEFAULT TRUE,
    summary_language TEXT DEFAULT 'ko',
    max_session_duration_hours INTEGER DEFAULT 24,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    total_sessions_created INTEGER DEFAULT 0,
    total_messages_tracked INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, chat_id)
);

-- Tracking sessions
CREATE TABLE IF NOT EXISTS tracking_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'stopped', 'expired', 'summarized')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    duration_minutes INTEGER,
    total_messages_collected INTEGER DEFAULT 0,
    meaningful_messages_collected INTEGER DEFAULT 0,
    unique_participants INTEGER DEFAULT 1,
    auto_summary_enabled BOOLEAN DEFAULT TRUE,
    summary_language TEXT DEFAULT 'ko',
    session_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (user_id, chat_id) REFERENCES user_chat_tracking(user_id, chat_id)
);

-- Tracked messages
CREATE TABLE IF NOT EXISTS tracked_messages (
    id BIGSERIAL PRIMARY KEY,
    tracking_session_id UUID REFERENCES tracking_sessions(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    username TEXT,
    user_first_name TEXT,
    user_last_name TEXT,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'photo', 'video', 'document', 'sticker', 'voice', 'other')),
    message_timestamp TIMESTAMPTZ NOT NULL,
    tracking_recorded_at TIMESTAMPTZ DEFAULT NOW(),
    is_meaningful BOOLEAN DEFAULT TRUE,
    is_bot_message BOOLEAN DEFAULT FALSE,
    is_command BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    is_forwarded BOOLEAN DEFAULT FALSE,
    reply_to_message_id BIGINT,
    reply_to_content TEXT,
    sentiment_score DECIMAL,
    topic_tags TEXT[] DEFAULT '{}',
    message_metadata JSONB DEFAULT '{}',
    
    UNIQUE(tracking_session_id, message_id)
);

-- Conversation summaries
CREATE TABLE IF NOT EXISTS conversation_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_session_id UUID REFERENCES tracking_sessions(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    summary_text TEXT NOT NULL,
    summary_language TEXT DEFAULT 'ko',
    message_count INTEGER NOT NULL,
    participant_count INTEGER DEFAULT 1,
    time_period_start TIMESTAMPTZ NOT NULL,
    time_period_end TIMESTAMPTZ NOT NULL,
    key_topics TEXT[] DEFAULT '{}',
    key_decisions TEXT[] DEFAULT '{}',
    key_questions TEXT[] DEFAULT '{}',
    summary_metadata JSONB DEFAULT '{}',
    processing_time_ms INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tracking_session_id)
);

-- =============================================================================
-- 5. INDEXES FOR PERFORMANCE (from 002_indexes.sql)
-- =============================================================================

-- Bot activity log indexes
CREATE INDEX IF NOT EXISTS idx_bot_activity_log_user_id ON bot_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_activity_log_chat_id ON bot_activity_log(chat_id);
CREATE INDEX IF NOT EXISTS idx_bot_activity_log_created_at ON bot_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_bot_activity_log_activity_type ON bot_activity_log(activity_type);

-- User preferences indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_username ON user_preferences(username);
CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at ON user_preferences(updated_at);

-- Chat groups indexes
CREATE INDEX IF NOT EXISTS idx_chat_groups_chat_id ON chat_groups(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_groups_is_active ON chat_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_groups_chat_type ON chat_groups(chat_type);

-- Prompts indexes
CREATE INDEX IF NOT EXISTS idx_prompts_prompt_type ON prompts(prompt_type);
CREATE INDEX IF NOT EXISTS idx_prompts_is_active ON prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_prompts_prompt_name ON prompts(prompt_name);
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at);

-- Prompt usage analytics indexes
CREATE INDEX IF NOT EXISTS idx_prompt_usage_analytics_prompt_id ON prompt_usage_analytics(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_usage_analytics_user_id ON prompt_usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_usage_analytics_created_at ON prompt_usage_analytics(created_at);

-- User chat tracking indexes
CREATE INDEX IF NOT EXISTS idx_user_chat_tracking_user_id ON user_chat_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_chat_tracking_chat_id ON user_chat_tracking(chat_id);
CREATE INDEX IF NOT EXISTS idx_user_chat_tracking_is_tracking ON user_chat_tracking(is_tracking);
CREATE INDEX IF NOT EXISTS idx_user_chat_tracking_last_activity ON user_chat_tracking(last_activity_at);

-- Tracking sessions indexes
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_user_id ON tracking_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_chat_id ON tracking_sessions(chat_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_status ON tracking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_started_at ON tracking_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_user_chat ON tracking_sessions(user_id, chat_id);

-- Tracked messages indexes
CREATE INDEX IF NOT EXISTS idx_tracked_messages_session_id ON tracked_messages(tracking_session_id);
CREATE INDEX IF NOT EXISTS idx_tracked_messages_chat_id ON tracked_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_tracked_messages_user_id ON tracked_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_messages_timestamp ON tracked_messages(message_timestamp);
CREATE INDEX IF NOT EXISTS idx_tracked_messages_meaningful ON tracked_messages(is_meaningful);
CREATE INDEX IF NOT EXISTS idx_tracked_messages_recorded_at ON tracked_messages(tracking_recorded_at);

-- Conversation summaries indexes
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_session_id ON conversation_summaries(tracking_session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user_id ON conversation_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_chat_id ON conversation_summaries(chat_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_created_at ON conversation_summaries(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_time_period ON conversation_summaries(time_period_start, time_period_end);

-- =============================================================================
-- 6. UTILITY FUNCTIONS (from 004_functions.sql)
-- =============================================================================

-- Function to expire old tracking sessions
CREATE OR REPLACE FUNCTION expire_old_tracking_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    expired_count INTEGER := 0;
BEGIN
    -- Expire sessions older than 7 days
    UPDATE tracking_sessions 
    SET 
        status = 'expired',
        ended_at = NOW(),
        updated_at = NOW()
    WHERE 
        status = 'active' 
        AND started_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Update user tracking status for expired sessions
    UPDATE user_chat_tracking 
    SET 
        is_tracking = FALSE,
        updated_at = NOW()
    WHERE 
        (user_id, chat_id) IN (
            SELECT user_id, chat_id 
            FROM tracking_sessions 
            WHERE status = 'expired'
        );
    
    RETURN expired_count;
END;
$$;

-- Function to cleanup old tracking data
CREATE OR REPLACE FUNCTION cleanup_old_tracking_data(days_to_keep INTEGER DEFAULT 30)
RETURNS TABLE(deleted_messages INTEGER, deleted_summaries INTEGER, deleted_sessions INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
    del_messages INTEGER := 0;
    del_summaries INTEGER := 0;
    del_sessions INTEGER := 0;
BEGIN
    -- Delete old tracked messages
    DELETE FROM tracked_messages 
    WHERE tracking_recorded_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS del_messages = ROW_COUNT;
    
    -- Delete old summaries (keep longer than messages)
    DELETE FROM conversation_summaries 
    WHERE created_at < NOW() - INTERVAL '1 day' * (days_to_keep + 30);
    
    GET DIAGNOSTICS del_summaries = ROW_COUNT;
    
    -- Delete old expired sessions
    DELETE FROM tracking_sessions 
    WHERE status = 'expired' AND ended_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS del_sessions = ROW_COUNT;
    
    deleted_messages := del_messages;
    deleted_summaries := del_summaries; 
    deleted_sessions := del_sessions;
    
    RETURN NEXT;
END;
$$;

-- Function to get tracking statistics
CREATE OR REPLACE FUNCTION get_tracking_statistics()
RETURNS TABLE(
    active_sessions INTEGER,
    total_users INTEGER,
    messages_today INTEGER,
    summaries_today INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM tracking_sessions WHERE status = 'active'),
        (SELECT COUNT(DISTINCT user_id)::INTEGER FROM user_chat_tracking WHERE is_tracking = TRUE),
        (SELECT COUNT(*)::INTEGER FROM tracked_messages WHERE tracking_recorded_at >= CURRENT_DATE),
        (SELECT COUNT(*)::INTEGER FROM conversation_summaries WHERE created_at >= CURRENT_DATE);
END;
$$;

-- =============================================================================
-- 7. INITIAL DATA (from database/initial-data.sql)
-- =============================================================================

-- Insert default prompts for dynamic management
INSERT INTO prompts (prompt_type, prompt_name, prompt_text, template_variables, metadata)
VALUES
    (
        'image_generation',
        'default_image_prompt',
        '이미지를 생성해주세요: {user_request}. 고화질이고 아름답고 창의적으로 만들어주세요. 스타일: 사실적이고 생생한 느낌으로.',
        '["user_request"]',
        '{"description": "Default image generation prompt in Korean", "style": "realistic", "quality": "high"}'
    ),
    (
        'qa_system',
        'dobby_personality_prompt',
        '당신은 해리포터의 도비(Dobby)입니다. 도비의 특징적인 말투와 성격으로 답변해주세요:

- 자신을 "도비"라고 지칭
- 주인님께 충성스럽고 도움이 되고 싶어함
- 간혹 집요정다운 귀여운 실수나 걱정
- 따뜻하고 친근한 말투
- 이모지 적극 활용
- 마법사 세계의 표현들 사용

사용자 질문: {user_question}

도비답게 친절하고 도움이 되는 답변을 해주세요.',
        '["user_question"]',
        '{"character": "Dobby", "personality": "helpful, loyal, cute", "language": "Korean"}'
    ),
    (
        'summarization',
        'conversation_summary_prompt',
        '다음 대화 내용을 {summary_language}로 요약해주세요:

{conversation_messages}

다음 형식으로 요약해주세요:
📝 **대화 요약**

🗓️ **기간**: {time_period}
👥 **참여자**: {participant_count}명 ({participant_names})
💬 **메시지 수**: {message_count}개

📋 **주요 내용**:
- [핵심 대화 내용 요약]

🎯 **결정사항**:
- [중요한 결정이나 합의사항]

❓ **미해결 질문**:
- [해결되지 않은 질문이나 논의사항]

🏷️ **키워드**: [주요 키워드들]

요약은 간결하지만 중요한 내용은 놓치지 않도록 해주세요.',
        '["summary_language", "conversation_messages", "time_period", "participant_count", "participant_names", "message_count"]',
        '{"purpose": "Conversation summarization", "format": "structured", "language": "flexible"}'
    )
ON CONFLICT (prompt_type, prompt_name) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    template_variables = EXCLUDED.template_variables,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- =============================================================================
-- SETUP COMPLETE
-- =============================================================================

-- Final status check
DO $$
BEGIN
    RAISE NOTICE '✅ Database setup completed successfully!';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - bot_activity_log';
    RAISE NOTICE '  - user_preferences'; 
    RAISE NOTICE '  - chat_groups';
    RAISE NOTICE '  - prompts';
    RAISE NOTICE '  - prompt_usage_analytics';
    RAISE NOTICE '  - user_chat_tracking';
    RAISE NOTICE '  - tracking_sessions';
    RAISE NOTICE '  - tracked_messages';
    RAISE NOTICE '  - conversation_summaries';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  - expire_old_tracking_sessions()';
    RAISE NOTICE '  - cleanup_old_tracking_data()';
    RAISE NOTICE '  - get_tracking_statistics()';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Ready to deploy to production!';
END $$;