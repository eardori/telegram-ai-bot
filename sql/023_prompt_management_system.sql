-- =============================================================================
-- PROMPT MANAGEMENT SYSTEM
-- Version: 1.0.0
-- Date: 2025-01-10
-- Description: LLM-powered automatic prompt analysis and structuring system
-- =============================================================================

-- =============================================================================
-- STEP 1: Extend existing prompt_templates table
-- =============================================================================

-- Add metadata columns to prompt_templates
ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS
    analysis_metadata JSONB; -- LLM analysis result (raw JSON)

ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS
    created_by BIGINT; -- Admin user_id who created this

ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS
    approved_by BIGINT; -- Admin user_id who approved this

ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS
    approval_status VARCHAR(20) DEFAULT 'pending'; -- pending | approved | rejected

ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS
    rejection_reason TEXT; -- Why this was rejected

COMMENT ON COLUMN prompt_templates.analysis_metadata IS 'Raw JSON result from LLM analysis (confidence, warnings, suggestions)';
COMMENT ON COLUMN prompt_templates.created_by IS 'Admin user ID who created this template';
COMMENT ON COLUMN prompt_templates.approved_by IS 'Admin user ID who approved this template';
COMMENT ON COLUMN prompt_templates.approval_status IS 'Approval status: pending | approved | rejected';

-- Update existing templates to 'approved' status (already in production)
UPDATE prompt_templates
SET approval_status = 'approved'
WHERE approval_status = 'pending';

-- =============================================================================
-- STEP 2: Create prompt_analysis_queue table (staging area)
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_analysis_queue (
    id SERIAL PRIMARY KEY,
    admin_user_id BIGINT NOT NULL, -- Admin who submitted the prompt

    -- Raw input
    raw_prompt TEXT NOT NULL, -- Original prompt text from admin

    -- LLM analysis results
    suggested_title_ko VARCHAR(100),
    suggested_title_en VARCHAR(100),
    suggested_category VARCHAR(50),
    suggested_subcategory VARCHAR(50),
    suggested_min_images INTEGER DEFAULT 1,
    suggested_max_images INTEGER DEFAULT 1,
    requires_face BOOLEAN DEFAULT false,
    suggested_min_faces INTEGER DEFAULT 0,
    detected_parameters JSONB, -- Array of detected parameters with options

    -- Metadata
    analysis_confidence FLOAT, -- 0.0 to 1.0
    analysis_warnings JSONB, -- Array of warning strings
    analysis_suggestions JSONB, -- Array of improvement suggestion strings
    analysis_raw JSONB, -- Complete raw LLM response

    -- Status tracking
    status VARCHAR(20) DEFAULT 'analyzing', -- analyzing | ready | saved | rejected
    created_at TIMESTAMPTZ DEFAULT NOW(),
    analyzed_at TIMESTAMPTZ,

    -- Link to final template (after approval)
    final_template_key VARCHAR(50)
);

CREATE INDEX idx_prompt_analysis_admin ON prompt_analysis_queue(admin_user_id);
CREATE INDEX idx_prompt_analysis_status ON prompt_analysis_queue(status);
CREATE INDEX idx_prompt_analysis_created ON prompt_analysis_queue(created_at DESC);

COMMENT ON TABLE prompt_analysis_queue IS 'Staging area for new prompts awaiting LLM analysis and admin approval';
COMMENT ON COLUMN prompt_analysis_queue.status IS 'analyzing: LLM processing | ready: awaiting admin decision | saved: approved and saved | rejected: admin rejected';
COMMENT ON COLUMN prompt_analysis_queue.detected_parameters IS 'JSON array of detected parameters: [{parameter_key, parameter_name_ko, parameter_type, suggested_options: [{option_key, option_name_ko, prompt_fragment, emoji}]}]';

-- =============================================================================
-- STEP 3: Create prompt_approval_log table (audit trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_approval_log (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(50) NOT NULL,
    admin_user_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL, -- approved | rejected | modified | deactivated
    previous_state JSONB, -- State before action
    new_state JSONB, -- State after action
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompt_log_template ON prompt_approval_log(template_key);
CREATE INDEX idx_prompt_log_admin ON prompt_approval_log(admin_user_id);
CREATE INDEX idx_prompt_log_action ON prompt_approval_log(action);
CREATE INDEX idx_prompt_log_created ON prompt_approval_log(created_at DESC);

COMMENT ON TABLE prompt_approval_log IS 'Audit log for all prompt template approval/rejection/modification actions';
COMMENT ON COLUMN prompt_approval_log.action IS 'approved: new template approved | rejected: new template rejected | modified: existing template edited | deactivated: template disabled';

-- =============================================================================
-- STEP 4: Create prompt_test_results table (quality tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_test_results (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(50) NOT NULL,
    version_number INTEGER DEFAULT 1,

    -- Test inputs
    test_image_url TEXT,
    test_parameters JSONB, -- Parameters used for test (if parameterized)

    -- Test results
    result_image_url TEXT,
    generation_time_ms INTEGER, -- How long it took
    success BOOLEAN, -- Did it work without errors?
    error_message TEXT, -- If failed, why?

    -- Quality scores
    success_score FLOAT, -- 0-100 (automated quality check)
    user_rating INTEGER, -- 1-5 stars (if human rated)
    feedback TEXT, -- Human feedback

    -- Metadata
    tested_by BIGINT, -- User or admin who tested
    tested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompt_test_template ON prompt_test_results(template_key);
CREATE INDEX idx_prompt_test_success ON prompt_test_results(success);
CREATE INDEX idx_prompt_test_rating ON prompt_test_results(user_rating DESC);
CREATE INDEX idx_prompt_test_created ON prompt_test_results(tested_at DESC);

COMMENT ON TABLE prompt_test_results IS 'Test results for prompt templates to track quality and success rate';
COMMENT ON COLUMN prompt_test_results.success_score IS 'Automated quality score 0-100 based on image analysis';
COMMENT ON COLUMN prompt_test_results.user_rating IS 'Human rating 1-5 stars';

-- =============================================================================
-- STEP 5: Create views for easy querying
-- =============================================================================

-- View: Prompt templates with approval info
CREATE OR REPLACE VIEW v_prompt_templates_with_approval AS
SELECT
    pt.id,
    pt.template_key,
    pt.template_name_ko,
    pt.template_name_en,
    pt.category,
    pt.subcategory,
    pt.template_type,
    pt.priority,
    pt.is_active,
    pt.approval_status,
    pt.created_by,
    pt.approved_by,
    pt.created_at,
    pt.updated_at,
    u1.username as creator_username,
    u2.username as approver_username,
    COALESCE(usage.total_uses, 0) as total_uses,
    COALESCE(tests.avg_rating, 0) as avg_rating,
    COALESCE(tests.test_count, 0) as test_count
FROM prompt_templates pt
LEFT JOIN users u1 ON pt.created_by = u1.id
LEFT JOIN users u2 ON pt.approved_by = u2.id
LEFT JOIN LATERAL (
    SELECT COUNT(*) as total_uses
    FROM credit_transactions ct
    WHERE ct.related_template_key = pt.template_key
    AND ct.transaction_type = 'usage'
) usage ON true
LEFT JOIN LATERAL (
    SELECT
        AVG(user_rating) as avg_rating,
        COUNT(*) as test_count
    FROM prompt_test_results ptr
    WHERE ptr.template_key = pt.template_key
    AND ptr.user_rating IS NOT NULL
) tests ON true
ORDER BY pt.priority DESC, pt.created_at DESC;

COMMENT ON VIEW v_prompt_templates_with_approval IS 'Prompt templates with creator, approver, usage stats, and ratings';

-- View: Pending prompts awaiting approval
CREATE OR REPLACE VIEW v_pending_prompts AS
SELECT
    paq.id as queue_id,
    paq.admin_user_id,
    u.username as admin_username,
    paq.raw_prompt,
    paq.suggested_title_ko,
    paq.suggested_title_en,
    paq.suggested_category,
    paq.analysis_confidence,
    paq.status,
    paq.created_at,
    paq.analyzed_at
FROM prompt_analysis_queue paq
LEFT JOIN users u ON paq.admin_user_id = u.id
WHERE paq.status IN ('ready', 'analyzing')
ORDER BY paq.created_at DESC;

COMMENT ON VIEW v_pending_prompts IS 'Prompts in analysis queue awaiting admin review';

-- View: Recent approval activity
CREATE OR REPLACE VIEW v_recent_approvals AS
SELECT
    pal.id,
    pal.template_key,
    pt.template_name_ko,
    pal.action,
    pal.admin_user_id,
    u.username as admin_username,
    pal.comment,
    pal.created_at
FROM prompt_approval_log pal
LEFT JOIN prompt_templates pt ON pal.template_key = pt.template_key
LEFT JOIN users u ON pal.admin_user_id = u.id
ORDER BY pal.created_at DESC
LIMIT 50;

COMMENT ON VIEW v_recent_approvals IS 'Recent 50 prompt approval/rejection actions';

-- =============================================================================
-- STEP 6: Helper functions
-- =============================================================================

-- Function: Get next available template key
CREATE OR REPLACE FUNCTION get_next_template_key(base_name TEXT)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_key VARCHAR(50);
    v_counter INTEGER := 1;
BEGIN
    -- Convert to snake_case
    v_key := lower(regexp_replace(base_name, '[^a-zA-Z0-9\s]', '', 'g'));
    v_key := regexp_replace(v_key, '\s+', '_', 'g');
    v_key := substring(v_key, 1, 45); -- Leave room for counter

    -- Check if exists
    WHILE EXISTS(SELECT 1 FROM prompt_templates WHERE template_key = v_key) LOOP
        v_counter := v_counter + 1;
        v_key := substring(v_key, 1, 45) || '_' || v_counter;
    END LOOP;

    RETURN v_key;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_template_key IS 'Generate unique template_key from English title';

-- Function: Calculate template success rate
CREATE OR REPLACE FUNCTION get_template_success_rate(p_template_key VARCHAR)
RETURNS FLOAT AS $$
DECLARE
    v_success_rate FLOAT;
BEGIN
    SELECT
        CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE (COUNT(*) FILTER (WHERE success = true)::FLOAT / COUNT(*)) * 100
        END INTO v_success_rate
    FROM prompt_test_results
    WHERE template_key = p_template_key;

    RETURN COALESCE(v_success_rate, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_template_success_rate IS 'Calculate success rate percentage for a template';

-- =============================================================================
-- STEP 7: Sample data for testing (optional)
-- =============================================================================

-- Insert a sample analysis queue entry for testing
-- (Uncomment to use)
/*
INSERT INTO prompt_analysis_queue (
    admin_user_id,
    raw_prompt,
    suggested_title_ko,
    suggested_title_en,
    suggested_category,
    suggested_subcategory,
    suggested_min_images,
    suggested_max_images,
    requires_face,
    analysis_confidence,
    status,
    analyzed_at
) VALUES (
    123456789, -- Replace with actual admin user_id
    'Create a professional business card design with the person from this photo. Include name, title, and contact information in a modern, clean layout.',
    '💼 비즈니스 카드 디자인',
    'Business Card Design',
    'creative_transform',
    'business',
    1,
    1,
    true,
    0.92,
    'ready',
    NOW()
);
*/

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
    queue_count INTEGER;
    log_count INTEGER;
    test_count INTEGER;
    template_count INTEGER;
BEGIN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '✅ PROMPT MANAGEMENT SYSTEM SCHEMA CREATED';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '';

    -- Count tables
    SELECT COUNT(*) INTO queue_count FROM prompt_analysis_queue;
    SELECT COUNT(*) INTO log_count FROM prompt_approval_log;
    SELECT COUNT(*) INTO test_count FROM prompt_test_results;
    SELECT COUNT(*) INTO template_count FROM prompt_templates WHERE approval_status = 'approved';

    RAISE NOTICE '📊 Database Status:';
    RAISE NOTICE '  • Analysis Queue: % entries', queue_count;
    RAISE NOTICE '  • Approval Log: % entries', log_count;
    RAISE NOTICE '  • Test Results: % entries', test_count;
    RAISE NOTICE '  • Approved Templates: %', template_count;
    RAISE NOTICE '';

    RAISE NOTICE '📋 Created Tables:';
    RAISE NOTICE '  ✓ prompt_analysis_queue - Staging area for new prompts';
    RAISE NOTICE '  ✓ prompt_approval_log - Audit trail';
    RAISE NOTICE '  ✓ prompt_test_results - Quality tracking';
    RAISE NOTICE '';

    RAISE NOTICE '📋 Created Views:';
    RAISE NOTICE '  ✓ v_prompt_templates_with_approval';
    RAISE NOTICE '  ✓ v_pending_prompts';
    RAISE NOTICE '  ✓ v_recent_approvals';
    RAISE NOTICE '';

    RAISE NOTICE '📋 Created Functions:';
    RAISE NOTICE '  ✓ get_next_template_key(text)';
    RAISE NOTICE '  ✓ get_template_success_rate(varchar)';
    RAISE NOTICE '';

    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '✅ READY FOR PROMPT ANALYSIS SERVICE IMPLEMENTATION';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Implement prompt-analysis-service.ts';
    RAISE NOTICE '  2. Add /admin prompt:add command to webhook.ts';
    RAISE NOTICE '  3. Test with sample prompts';
END $$;

-- =============================================================================
-- SUMMARY
-- =============================================================================

/*
PROMPT MANAGEMENT SYSTEM SCHEMA

TABLES:
1. prompt_analysis_queue - Staging area for new prompts
   - Stores raw prompt input from admin
   - Holds LLM analysis results
   - Tracks approval status

2. prompt_approval_log - Complete audit trail
   - Records all approval/rejection/modification actions
   - Stores before/after states
   - Admin comments

3. prompt_test_results - Quality tracking
   - Test execution results
   - Success rates
   - User ratings and feedback

VIEWS:
1. v_prompt_templates_with_approval - Templates with metadata
2. v_pending_prompts - Prompts awaiting review
3. v_recent_approvals - Recent activity log

FUNCTIONS:
1. get_next_template_key() - Generate unique keys
2. get_template_success_rate() - Calculate success percentage

WORKFLOW:
1. Admin runs /admin prompt:add
2. Admin sends raw prompt text
3. LLM analyzes prompt → saved to prompt_analysis_queue
4. Admin reviews analysis and approves/rejects
5. If approved → saved to prompt_templates + log entry
6. If parameterized → parameters saved to template_parameters
7. Template becomes available to users immediately

NEXT IMPLEMENTATION:
- src/services/prompt-analysis-service.ts
- netlify/functions/webhook.ts (/admin commands)
*/
