-- =============================================================================
-- IMAGE EDIT RESULTS TABLE
-- Stores results of image editing operations
-- =============================================================================

CREATE TABLE IF NOT EXISTS image_edit_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- User and session info
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,

    -- Template info
    template_key VARCHAR(50) NOT NULL,

    -- Image URLs
    original_image_url TEXT NOT NULL,
    edited_image_url TEXT,

    -- Processing info
    processing_time_ms INTEGER,
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_image_edit_results_user ON image_edit_results (user_id);
CREATE INDEX IF NOT EXISTS idx_image_edit_results_template ON image_edit_results (template_key);
CREATE INDEX IF NOT EXISTS idx_image_edit_results_status ON image_edit_results (status);
CREATE INDEX IF NOT EXISTS idx_image_edit_results_created ON image_edit_results (created_at DESC);

-- Foreign key constraint
ALTER TABLE image_edit_results
ADD CONSTRAINT fk_template_key
FOREIGN KEY (template_key)
REFERENCES prompt_templates(template_key)
ON DELETE CASCADE;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_image_edit_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_image_edit_results_updated_at ON image_edit_results;

CREATE TRIGGER trigger_update_image_edit_results_updated_at
    BEFORE UPDATE ON image_edit_results
    FOR EACH ROW
    EXECUTE FUNCTION update_image_edit_results_updated_at();
