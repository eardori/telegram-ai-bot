-- ============================================
-- NSFW Category System - Emergency Fix
-- ============================================
-- Purpose: Fix CHECK constraint issue by completely removing and recreating
-- Created: 2025-01-10

-- ============================================
-- Step 1: Find and drop ALL constraints on category column
-- ============================================

DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find all constraints on prompt_templates table
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'prompt_templates'::regclass
          AND contype = 'c'  -- CHECK constraints only
    LOOP
        RAISE NOTICE 'Dropping constraint: %', constraint_record.conname;
        EXECUTE format('ALTER TABLE prompt_templates DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
END $$;

-- ============================================
-- Step 2: Fix any invalid existing data
-- ============================================

-- Check for invalid categories first
DO $$
DECLARE
    invalid_categories TEXT;
BEGIN
    SELECT string_agg(DISTINCT category, ', ')
    INTO invalid_categories
    FROM prompt_templates
    WHERE category NOT IN ('3d_figure', 'portrait', 'game_anime', 'image_editing', 'creative_transformations', 'nsfw');

    IF invalid_categories IS NOT NULL THEN
        RAISE NOTICE 'Found invalid categories: %', invalid_categories;
    ELSE
        RAISE NOTICE 'All categories are valid';
    END IF;
END $$;

-- Fix any invalid categories
UPDATE prompt_templates
SET category = 'image_editing', updated_at = NOW()
WHERE category NOT IN ('3d_figure', 'portrait', 'game_anime', 'image_editing', 'creative_transformations', 'nsfw');

-- ============================================
-- Step 3: Add new constraint with 'nsfw' included
-- ============================================

ALTER TABLE prompt_templates
ADD CONSTRAINT prompt_templates_category_check
CHECK (category IN ('3d_figure', 'portrait', 'game_anime', 'image_editing', 'creative_transformations', 'nsfw'));

-- ============================================
-- Step 4: Verify constraint was added
-- ============================================

SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'prompt_templates'::regclass
  AND contype = 'c';

-- ============================================
-- Step 5: Verify all categories are now valid
-- ============================================

SELECT
    category,
    COUNT(*) as count
FROM prompt_templates
GROUP BY category
ORDER BY count DESC;
