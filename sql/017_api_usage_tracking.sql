-- API Usage Tracking System
-- Tracks Gemini API usage and costs

-- API usage logs table
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    chat_id BIGINT,
    operation VARCHAR(50) NOT NULL, -- 'image_analysis', 'image_edit', 'text_generation'
    model VARCHAR(100) NOT NULL, -- 'gemini-2.0-flash-exp', 'gemini-2.5-flash-image-preview'

    -- Token/Image metrics
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    input_images INTEGER DEFAULT 0,
    output_images INTEGER DEFAULT 0,

    -- Cost calculation (USD)
    estimated_cost DECIMAL(10, 6) NOT NULL,

    -- Metadata
    template_key VARCHAR(50), -- For image edits
    session_id UUID, -- Link to session if applicable
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_operation ON api_usage_logs(operation);
CREATE INDEX IF NOT EXISTS idx_api_usage_model ON api_usage_logs(model);

-- API cost summary view (daily)
CREATE OR REPLACE VIEW api_daily_costs AS
SELECT
    DATE(created_at) as date,
    operation,
    model,
    COUNT(*) as total_calls,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(input_images) as total_input_images,
    SUM(output_images) as total_output_images,
    SUM(estimated_cost) as total_cost,
    AVG(processing_time_ms) as avg_processing_time_ms,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_calls,
    SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_calls
FROM api_usage_logs
GROUP BY DATE(created_at), operation, model
ORDER BY date DESC, total_cost DESC;

-- User API usage summary
CREATE OR REPLACE VIEW user_api_usage AS
SELECT
    user_id,
    COUNT(*) as total_calls,
    SUM(estimated_cost) as total_cost,
    MAX(created_at) as last_used,
    COUNT(DISTINCT DATE(created_at)) as days_active
FROM api_usage_logs
WHERE success = true
GROUP BY user_id
ORDER BY total_cost DESC;

-- Add comments
COMMENT ON TABLE api_usage_logs IS 'Tracks all Gemini API usage with cost estimation';
COMMENT ON COLUMN api_usage_logs.operation IS 'Type of operation: image_analysis, image_edit, text_generation';
COMMENT ON COLUMN api_usage_logs.estimated_cost IS 'Estimated cost in USD based on Gemini pricing';
COMMENT ON VIEW api_daily_costs IS 'Daily aggregated API costs and usage metrics';
COMMENT ON VIEW user_api_usage IS 'Per-user API usage summary';
