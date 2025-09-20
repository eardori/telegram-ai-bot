-- =============================================================================
-- AI IMAGE EDITING FEATURE - DATABASE SCHEMA
-- Version: 1.0.0
-- Description: Schema for intelligent photo editing with 38 prompt templates
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PROMPT TEMPLATES TABLE
-- Stores all 38 editing prompt templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_templates (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(50) UNIQUE NOT NULL,
    template_name_ko TEXT NOT NULL,
    template_name_en TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'portrait_styling',     -- 인물 사진 스타일링
        '3d_figurine',         -- 3D/피규어 변환
        'game_animation',      -- 게임/애니메이션
        'image_editing',       -- 이미지 편집 도구
        'creative_transform'   -- 창의적 변환
    )),
    subcategory VARCHAR(50),

    -- Prompt content
    base_prompt TEXT NOT NULL,
    example_prompt TEXT,
    prompt_variables JSONB DEFAULT '[]',

    -- Requirements and conditions
    min_images INTEGER DEFAULT 1,
    max_images INTEGER DEFAULT 1,
    requires_face BOOLEAN DEFAULT FALSE,
    min_faces INTEGER DEFAULT 0,
    max_faces INTEGER DEFAULT NULL,
    image_requirements JSONB DEFAULT '{}',
    optimal_conditions JSONB DEFAULT '{}',

    -- Metadata
    priority INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN usage_count > 0 THEN (success_count::DECIMAL / usage_count * 100)
            ELSE 0
        END
    ) STORED,
    average_processing_time_ms INTEGER,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    INDEX idx_prompt_templates_category (category),
    INDEX idx_prompt_templates_priority (priority DESC),
    INDEX idx_prompt_templates_usage (usage_count DESC),
    INDEX idx_prompt_templates_success_rate (success_rate DESC)
);

-- =============================================================================
-- 2. IMAGE ANALYSIS RESULTS TABLE
-- Stores analysis results for uploaded images
-- =============================================================================

CREATE TABLE IF NOT EXISTS image_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    message_id BIGINT,

    -- Image information
    image_count INTEGER NOT NULL,
    image_urls TEXT[],
    image_sizes INTEGER[],
    total_size_bytes BIGINT,

    -- Analysis data
    analysis_data JSONB NOT NULL,
    face_count INTEGER DEFAULT 0,
    detected_objects TEXT[],
    scene_description TEXT,
    dominant_colors TEXT[],
    composition_type VARCHAR(50),
    image_quality_score DECIMAL(3,2),

    -- Categorization
    suggested_categories TEXT[],
    confidence_scores JSONB DEFAULT '{}',

    -- Performance metrics
    analysis_time_ms INTEGER,
    api_calls_made INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    INDEX idx_analysis_user_id (user_id),
    INDEX idx_analysis_session_id (session_id),
    INDEX idx_analysis_created_at (created_at DESC)
);

-- =============================================================================
-- 3. EDIT SUGGESTIONS TABLE
-- Stores generated suggestions for users
-- =============================================================================

CREATE TABLE IF NOT EXISTS edit_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID REFERENCES image_analysis_results(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,

    -- Suggestion data
    suggestions JSONB NOT NULL, -- Array of suggestion objects
    suggested_template_ids INTEGER[],
    display_order INTEGER[],

    -- User interaction
    selected_template_id INTEGER REFERENCES prompt_templates(id),
    selected_at TIMESTAMPTZ,
    custom_modifications TEXT,

    -- Feedback
    user_satisfaction INTEGER CHECK (user_satisfaction >= 1 AND user_satisfaction <= 5),
    feedback_text TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),

    -- Indexes
    INDEX idx_suggestions_analysis_id (analysis_id),
    INDEX idx_suggestions_user_id (user_id),
    INDEX idx_suggestions_expires_at (expires_at)
);

-- =============================================================================
-- 4. EDIT HISTORY TABLE
-- Stores completed edits and results
-- =============================================================================

CREATE TABLE IF NOT EXISTS edit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    suggestion_id UUID REFERENCES edit_suggestions(id),
    template_id INTEGER REFERENCES prompt_templates(id),

    -- Edit details
    final_prompt TEXT NOT NULL,
    prompt_language VARCHAR(10) DEFAULT 'en',
    custom_parameters JSONB DEFAULT '{}',

    -- Source and result
    original_image_urls TEXT[],
    edited_image_url TEXT,
    edited_image_size_bytes INTEGER,

    -- Processing information
    processing_start_at TIMESTAMPTZ,
    processing_end_at TIMESTAMPTZ,
    processing_time_ms INTEGER,
    api_service_used VARCHAR(50), -- 'nano_banafo', 'gemini', etc.

    -- Cost tracking
    estimated_cost DECIMAL(10,4),
    tokens_used INTEGER,

    -- User feedback
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_comment TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,

    -- Status
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN (
        'processing', 'completed', 'failed', 'cancelled'
    )),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    INDEX idx_edit_history_user_id (user_id),
    INDEX idx_edit_history_template_id (template_id),
    INDEX idx_edit_history_status (status),
    INDEX idx_edit_history_created_at (created_at DESC),
    INDEX idx_edit_history_favorite (is_favorite, user_id) WHERE is_favorite = TRUE
);

-- =============================================================================
-- 5. USER PREFERENCES TABLE
-- Stores user-specific preferences for editing
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_edit_preferences (
    user_id BIGINT PRIMARY KEY,

    -- Style preferences
    preferred_styles TEXT[],
    preferred_categories TEXT[],
    avoided_styles TEXT[],

    -- Language preference
    interface_language VARCHAR(10) DEFAULT 'ko',
    prompt_language VARCHAR(10) DEFAULT 'en',

    -- Quality preferences
    preferred_quality VARCHAR(20) DEFAULT 'balanced' CHECK (preferred_quality IN (
        'fast', 'balanced', 'high_quality'
    )),
    auto_enhance BOOLEAN DEFAULT TRUE,

    -- History and statistics
    total_edits INTEGER DEFAULT 0,
    favorite_template_ids INTEGER[],
    last_used_template_id INTEGER,
    average_rating DECIMAL(3,2),

    -- Settings
    show_cost_estimates BOOLEAN DEFAULT TRUE,
    save_history BOOLEAN DEFAULT TRUE,
    enable_suggestions BOOLEAN DEFAULT TRUE,
    max_suggestions INTEGER DEFAULT 5,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. TEMPLATE PERFORMANCE METRICS TABLE
-- Tracks template performance over time
-- =============================================================================

CREATE TABLE IF NOT EXISTS template_performance_metrics (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES prompt_templates(id),

    -- Time period
    metric_date DATE NOT NULL,

    -- Usage metrics
    daily_usage_count INTEGER DEFAULT 0,
    daily_success_count INTEGER DEFAULT 0,
    daily_failure_count INTEGER DEFAULT 0,

    -- Performance metrics
    avg_processing_time_ms INTEGER,
    min_processing_time_ms INTEGER,
    max_processing_time_ms INTEGER,

    -- User satisfaction
    avg_user_rating DECIMAL(3,2),
    ratings_count INTEGER DEFAULT 0,

    -- Cost metrics
    total_cost DECIMAL(10,4),
    avg_cost_per_use DECIMAL(10,4),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint for one entry per template per day
    UNIQUE(template_id, metric_date),

    -- Indexes
    INDEX idx_metrics_template_id (template_id),
    INDEX idx_metrics_date (metric_date DESC)
);

-- =============================================================================
-- 7. BATCH EDIT JOBS TABLE
-- For handling multiple edits in one session
-- =============================================================================

CREATE TABLE IF NOT EXISTS batch_edit_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,

    -- Job details
    total_edits INTEGER NOT NULL,
    completed_edits INTEGER DEFAULT 0,
    failed_edits INTEGER DEFAULT 0,

    -- Templates used
    template_ids INTEGER[],

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled'
    )),

    -- Results
    result_urls TEXT[],

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_completion_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    INDEX idx_batch_jobs_user_id (user_id),
    INDEX idx_batch_jobs_status (status)
);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_prompt_templates_updated_at
    BEFORE UPDATE ON prompt_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_edit_preferences_updated_at
    BEFORE UPDATE ON user_edit_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired suggestions
CREATE OR REPLACE FUNCTION cleanup_expired_suggestions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM edit_suggestions
    WHERE expires_at < NOW()
    AND selected_template_id IS NULL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate template statistics
CREATE OR REPLACE FUNCTION calculate_template_stats(template_id_param INTEGER)
RETURNS TABLE(
    total_usage INTEGER,
    success_rate DECIMAL,
    avg_rating DECIMAL,
    avg_processing_time INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_usage,
        (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100) as success_rate,
        AVG(user_rating)::DECIMAL as avg_rating,
        AVG(processing_time_ms)::INTEGER as avg_processing_time
    FROM edit_history
    WHERE template_id = template_id_param;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Composite indexes for common queries
CREATE INDEX idx_analysis_user_chat ON image_analysis_results(user_id, chat_id, created_at DESC);
CREATE INDEX idx_suggestions_user_chat ON edit_suggestions(user_id, chat_id, created_at DESC);
CREATE INDEX idx_history_user_chat ON edit_history(user_id, chat_id, created_at DESC);
CREATE INDEX idx_history_template_success ON edit_history(template_id, status) WHERE status = 'completed';

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE prompt_templates IS '38개의 AI 이미지 편집 프롬프트 템플릿 저장';
COMMENT ON TABLE image_analysis_results IS '업로드된 이미지의 AI 분석 결과';
COMMENT ON TABLE edit_suggestions IS '사용자에게 제안된 편집 옵션';
COMMENT ON TABLE edit_history IS '완료된 편집 작업 이력';
COMMENT ON TABLE user_edit_preferences IS '사용자별 편집 선호도 설정';
COMMENT ON TABLE template_performance_metrics IS '템플릿 성능 추적 메트릭';
COMMENT ON TABLE batch_edit_jobs IS '배치 편집 작업 관리';

-- =============================================================================
-- INITIAL SETUP COMPLETE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Image Edit Schema created successfully!';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - prompt_templates';
    RAISE NOTICE '  - image_analysis_results';
    RAISE NOTICE '  - edit_suggestions';
    RAISE NOTICE '  - edit_history';
    RAISE NOTICE '  - user_edit_preferences';
    RAISE NOTICE '  - template_performance_metrics';
    RAISE NOTICE '  - batch_edit_jobs';
END $$;