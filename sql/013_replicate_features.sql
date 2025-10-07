-- =============================================================================
-- REPLICATE FEATURES SCHEMA
-- Version: 1.0.0
-- Description: Database schema for NSFW content generation tracking via Replicate API
-- =============================================================================

-- NSFW 콘텐츠 생성 기록
CREATE TABLE IF NOT EXISTS nsfw_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'image' or 'video' or 'image_to_video'
    prompt TEXT NOT NULL,
    model_version VARCHAR(100),
    prediction_id VARCHAR(100), -- Replicate prediction ID for async tracking
    output_url TEXT,
    tokens_used INTEGER DEFAULT 20,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_nsfw_user_date ON nsfw_generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nsfw_chat_date ON nsfw_generations(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nsfw_prediction ON nsfw_generations(prediction_id) WHERE prediction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nsfw_status ON nsfw_generations(status, created_at DESC);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- 일일 제한 체크 함수
CREATE OR REPLACE FUNCTION check_nsfw_daily_limit(p_user_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    daily_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO daily_count
    FROM nsfw_generations
    WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '24 hours'
    AND status != 'failed';

    RETURN daily_count < 5; -- 일일 5회 제한
END;
$$ LANGUAGE plpgsql;

-- NSFW 생성 통계 조회
CREATE OR REPLACE FUNCTION get_nsfw_stats(p_user_id BIGINT)
RETURNS TABLE (
    total_generations BIGINT,
    today_count BIGINT,
    image_count BIGINT,
    video_count BIGINT,
    total_tokens_used BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_generations,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::BIGINT as today_count,
        COUNT(*) FILTER (WHERE type = 'image')::BIGINT as image_count,
        COUNT(*) FILTER (WHERE type IN ('video', 'image_to_video'))::BIGINT as video_count,
        COALESCE(SUM(tokens_used), 0)::BIGINT as total_tokens_used
    FROM nsfw_generations
    WHERE user_id = p_user_id
    AND status = 'completed';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE nsfw_generations IS 'Replicate API를 통한 NSFW 콘텐츠 생성 기록';
COMMENT ON COLUMN nsfw_generations.type IS 'image: 텍스트→이미지, video: 텍스트→비디오, image_to_video: 이미지→비디오';
COMMENT ON COLUMN nsfw_generations.prediction_id IS 'Replicate prediction ID (webhook 처리용)';
COMMENT ON COLUMN nsfw_generations.status IS 'pending: 대기중, processing: 처리중, completed: 완료, failed: 실패';
COMMENT ON FUNCTION check_nsfw_daily_limit IS '사용자의 일일 NSFW 생성 제한 확인 (5회)';
COMMENT ON FUNCTION get_nsfw_stats IS '사용자의 NSFW 생성 통계 조회';
