-- ============================================
-- NSFW Category System
-- ============================================
-- Purpose: Separate NSFW templates into dedicated category
-- Created: 2025-01-10
-- Related: Phase 2 of NSFW implementation

-- ============================================
-- 0. Fix CHECK constraint to allow 'nsfw' category
-- ============================================

-- IMPORTANT: Must fix any invalid existing data FIRST before modifying constraint

-- Step 0: Check for any rows with invalid categories (for debugging)
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM prompt_templates
    WHERE category NOT IN ('3d_figure', 'portrait', 'game_anime', 'image_editing', 'creative_transformations', 'nsfw');

    IF invalid_count > 0 THEN
        RAISE NOTICE 'Found % rows with invalid categories', invalid_count;

        -- Show invalid rows
        RAISE NOTICE 'Invalid categories: %', (
            SELECT string_agg(DISTINCT category, ', ')
            FROM prompt_templates
            WHERE category NOT IN ('3d_figure', 'portrait', 'game_anime', 'image_editing', 'creative_transformations', 'nsfw')
        );
    END IF;
END $$;

-- Step 1: Fix any rows with NULL or invalid categories (safety measure)
UPDATE prompt_templates
SET category = 'image_editing'
WHERE category IS NULL
   OR category NOT IN ('3d_figure', 'portrait', 'game_anime', 'image_editing', 'creative_transformations', 'nsfw');

-- Step 2: Drop existing CHECK constraint completely
ALTER TABLE prompt_templates
DROP CONSTRAINT IF EXISTS prompt_templates_category_check;

-- Step 3: Add new constraint with 'nsfw' included
ALTER TABLE prompt_templates
ADD CONSTRAINT prompt_templates_category_check
CHECK (category IN ('3d_figure', 'portrait', 'game_anime', 'image_editing', 'creative_transformations', 'nsfw'));

COMMENT ON CONSTRAINT prompt_templates_category_check ON prompt_templates IS
'Allowed category values: 3d_figure, portrait, game_anime, image_editing, creative_transformations, nsfw';

-- ============================================
-- 1. Add requires_nsfw_api column
-- ============================================

-- Add column if it doesn't exist
ALTER TABLE prompt_templates
ADD COLUMN IF NOT EXISTS requires_nsfw_api BOOLEAN DEFAULT false;

-- Add index for quick NSFW template lookups
CREATE INDEX IF NOT EXISTS idx_prompt_templates_nsfw
ON prompt_templates(requires_nsfw_api, category)
WHERE requires_nsfw_api = true;

COMMENT ON COLUMN prompt_templates.requires_nsfw_api IS 'Template requires NSFW API (Replicate) instead of Gemini';

-- ============================================
-- 2. Check current categories (informational only)
-- ============================================

-- Note: Categories are currently stored as TEXT in prompt_templates
-- We'll add 'nsfw' as a new category alongside:
-- - '3d_figure'
-- - 'portrait'
-- - 'game_anime'
-- - 'image_editing'
-- - 'creative_transformations'

-- COMMENTED OUT: This is informational only, can run manually if needed
-- SELECT DISTINCT category, COUNT(*) as template_count
-- FROM prompt_templates
-- GROUP BY category
-- ORDER BY template_count DESC;

-- ============================================
-- 3. Identify existing NSFW templates (informational only)
-- ============================================

-- Templates that likely require NSFW API:
-- - Any template with adult/mature content
-- - Revealing outfit transformations
-- - Certain pose/style changes

-- COMMENTED OUT: This SELECT can be run manually after column is created
-- SELECT
--     template_key,
--     template_name_ko,
--     template_name_en,
--     category,
--     subcategory,
--     requires_nsfw_api
-- FROM prompt_templates
-- WHERE
--     -- Keywords that suggest NSFW content
--     (base_prompt ILIKE '%swimwear%'
--     OR base_prompt ILIKE '%lingerie%'
--     OR base_prompt ILIKE '%revealing%'
--     OR base_prompt ILIKE '%seductive%'
--     OR base_prompt ILIKE '%bikini%'
--     OR base_prompt ILIKE '%nude%'
--     OR base_prompt ILIKE '%nsfw%'
--     OR base_prompt ILIKE '%adult%'
--     OR base_prompt ILIKE '%erotic%'
--     OR base_prompt ILIKE '%sensual%')
--     OR template_key ILIKE '%nsfw%'
--     OR template_key ILIKE '%adult%'
--     OR requires_nsfw_api = true
-- ORDER BY category, template_key;

-- ============================================
-- 4. Move identified templates to NSFW category
-- ============================================

-- Update category for NSFW templates
UPDATE prompt_templates
SET
    category = 'nsfw',
    subcategory = CASE
        -- Preserve meaningful subcategories
        WHEN subcategory = 'beauty' THEN 'glamour'
        WHEN subcategory = 'style' THEN 'fashion'
        WHEN subcategory = 'transformation' THEN 'transformation'
        ELSE 'general'
    END,
    updated_at = NOW()
WHERE
    -- Automatic detection based on keywords
    (base_prompt ILIKE '%swimwear%'
    OR base_prompt ILIKE '%lingerie%'
    OR base_prompt ILIKE '%revealing%'
    OR base_prompt ILIKE '%bikini%'
    OR template_key ILIKE '%nsfw%'
    OR template_key ILIKE '%adult%'
    OR requires_nsfw_api = true)
    -- Safety check: don't move if already in nsfw
    AND category != 'nsfw';

-- ============================================
-- 5. Verify NSFW API flag is set correctly
-- ============================================

-- Ensure all templates in NSFW category have requires_nsfw_api = true
UPDATE prompt_templates
SET
    requires_nsfw_api = true,
    updated_at = NOW()
WHERE category = 'nsfw'
    AND requires_nsfw_api IS DISTINCT FROM true;

-- ============================================
-- 6. Create NSFW category metadata
-- ============================================

-- Add category descriptions (for future UI)
-- This is informational - actual category names are in i18n

COMMENT ON TABLE prompt_templates IS
'Image editing prompt templates.
Categories:
- 3d_figure: 3D character and figure transformations
- portrait: Portrait and people photography
- game_anime: Game and anime style transformations
- image_editing: General image editing
- creative_transformations: Creative and artistic transformations
- nsfw: Adult content (requires age verification and consent)';

-- ============================================
-- 7. NSFW category statistics view
-- ============================================

CREATE OR REPLACE VIEW v_nsfw_category_stats AS
SELECT
    subcategory,
    COUNT(*) as template_count,
    COUNT(*) FILTER (WHERE is_active = true) as active_count,
    COUNT(*) FILTER (WHERE template_type = 'fixed') as fixed_count,
    COUNT(*) FILTER (WHERE template_type = 'parameterized') as param_count,
    AVG(priority) as avg_priority
FROM prompt_templates
WHERE category = 'nsfw'
GROUP BY subcategory
ORDER BY template_count DESC;

COMMENT ON VIEW v_nsfw_category_stats IS 'Statistics for NSFW category templates';

-- ============================================
-- 8. List all NSFW templates
-- ============================================

CREATE OR REPLACE VIEW v_nsfw_templates AS
SELECT
    template_key,
    template_name_ko,
    template_name_en,
    subcategory,
    template_type,
    is_active,
    requires_face,
    priority,
    -- Usage stats (if usage log exists)
    (SELECT COUNT(*)
     FROM nsfw_usage_log nul
     WHERE nul.template_key = pt.template_key
     AND nul.created_at >= CURRENT_DATE - INTERVAL '30 days') as usage_last_30d,
    created_at,
    updated_at
FROM prompt_templates pt
WHERE category = 'nsfw'
ORDER BY priority DESC, template_key;

COMMENT ON VIEW v_nsfw_templates IS 'All NSFW templates with usage statistics';

-- ============================================
-- 9. Function: Get NSFW templates for UI
-- ============================================

CREATE OR REPLACE FUNCTION get_nsfw_templates(
    p_subcategory TEXT DEFAULT NULL,
    p_only_active BOOLEAN DEFAULT true
) RETURNS TABLE(
    template_key TEXT,
    template_name_ko TEXT,
    template_name_en TEXT,
    subcategory TEXT,
    template_type TEXT,
    base_prompt TEXT,
    has_parameters BOOLEAN,
    parameter_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pt.template_key,
        pt.template_name_ko,
        pt.template_name_en,
        pt.subcategory,
        pt.template_type,
        pt.base_prompt,
        (pt.template_type = 'parameterized') as has_parameters,
        COALESCE((
            SELECT COUNT(*)
            FROM template_parameters tp
            WHERE tp.template_key = pt.template_key
        ), 0)::INTEGER as parameter_count
    FROM prompt_templates pt
    WHERE pt.category = 'nsfw'
        AND (p_only_active = false OR pt.is_active = true)
        AND (p_subcategory IS NULL OR pt.subcategory = p_subcategory)
    ORDER BY pt.priority DESC, pt.template_key;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_nsfw_templates IS 'Get NSFW templates for UI display';

-- ============================================
-- 10. Check results (run these manually to verify)
-- ============================================

-- COMMENTED OUT: Run these SELECT queries manually after script completes

-- View what got moved to NSFW category
-- SELECT
--     template_key,
--     template_name_ko,
--     subcategory,
--     template_type,
--     requires_nsfw_api,
--     is_active
-- FROM v_nsfw_templates;

-- View category distribution
-- SELECT
--     category,
--     COUNT(*) as total,
--     COUNT(*) FILTER (WHERE is_active = true) as active,
--     COUNT(*) FILTER (WHERE requires_nsfw_api = true) as nsfw_api_required
-- FROM prompt_templates
-- GROUP BY category
-- ORDER BY total DESC;

-- ============================================
-- 11. Sample queries for testing
-- ============================================

-- Get all active NSFW templates
-- SELECT * FROM get_nsfw_templates();

-- Get NSFW templates by subcategory
-- SELECT * FROM get_nsfw_templates('glamour');

-- Get NSFW category statistics
-- SELECT * FROM v_nsfw_category_stats;

-- Check if any template needs manual review
-- SELECT template_key, template_name_ko, base_prompt
-- FROM prompt_templates
-- WHERE category != 'nsfw'
--   AND (base_prompt ILIKE '%sexy%' OR base_prompt ILIKE '%romantic%')
-- ORDER BY template_key;

-- ============================================
-- End of NSFW Category System
-- ============================================
