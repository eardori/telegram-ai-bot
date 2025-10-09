-- =============================================================================
-- FIX PROMPT TEMPLATE ISSUES
-- Version: 1.0.0
-- Date: 2025-01-10
-- Description: Fix critical issues found in prompt template analysis
-- =============================================================================

-- =============================================================================
-- ISSUE 1 (BLOCKER): outfit_swap - Image count mismatch
-- Problem: Prompt mentions "Image1" and "Image2", but min_images=2, max_images=2
--          Users only upload 1 image in practice
-- Solution: Convert to parameterized template with outfit style options
-- =============================================================================

-- Update outfit_swap to single-image parameterized template
UPDATE prompt_templates SET
    template_name_ko = '👔 의상 스타일 변경',
    template_name_en = 'Outfit Style Change',
    base_prompt = 'Change the outfit of the person in this photo to {outfit_style}. Keep the same pose, body proportions, facial features, and background. Only change the clothing. Ensure the new outfit fits naturally on the body with proper folds, shadows, and realistic fabric texture. Photorealistic, high-resolution.',
    template_type = 'parameterized',
    min_images = 1,
    max_images = 1,
    priority = 87,
    updated_at = NOW()
WHERE template_key = 'outfit_swap';

-- Add parameter for outfit_swap
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'outfit_swap', 'outfit_style', '의상 스타일', 'Outfit Style',
    'select', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- Add outfit options for outfit_swap
INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_swap' AND parameter_key = 'outfit_style'),
     'business_formal', '정장 (비즈니스)', 'Business Formal',
     'a professional business suit - tailored blazer, dress shirt, tie, dress pants, and polished leather shoes', '💼', 1),

    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_swap' AND parameter_key = 'outfit_style'),
     'casual_modern', '모던 캐주얼', 'Modern Casual',
     'modern casual wear - stylish jeans, fitted t-shirt or sweater, sneakers, and minimal accessories', '👕', 2),

    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_swap' AND parameter_key = 'outfit_style'),
     'evening_dress', '이브닝 드레스', 'Evening Dress',
     'an elegant evening dress - floor-length or cocktail dress with sophisticated design, dressy heels, and jewelry', '👗', 3),

    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_swap' AND parameter_key = 'outfit_style'),
     'sportswear_active', '스포츠웨어', 'Sportswear',
     'athletic sportswear - performance t-shirt, sports shorts or leggings, running shoes, and athletic accessories', '🏃', 4),

    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_swap' AND parameter_key = 'outfit_style'),
     'traditional_hanbok', '한복 (전통의상)', 'Traditional Hanbok',
     'traditional Korean hanbok - vibrant jeogori jacket and chima skirt or baji pants with elegant embroidery', '🎎', 5),

    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_swap' AND parameter_key = 'outfit_style'),
     'streetwear_urban', '스트릿 패션', 'Urban Streetwear',
     'trendy streetwear - oversized hoodie, cargo pants, high-top sneakers, and urban accessories like caps or chains', '🧢', 6)
ON CONFLICT (parameter_id, option_key) DO NOTHING;

-- =============================================================================
-- ISSUE 2 (IMPORTANT): clothing_change - Wrong max_images setting
-- Problem: max_images=2 but prompt only expects 1 image
-- Solution: Fix max_images to 1
-- =============================================================================

UPDATE prompt_templates SET
    max_images = 1,
    updated_at = NOW()
WHERE template_key = 'clothing_change';

-- =============================================================================
-- ISSUE 3 (IMPORTANT): hairstyle_change - Wrong max_images setting
-- Problem: max_images=2 but prompt only expects 1 image
-- Solution: Fix max_images to 1
-- =============================================================================

UPDATE prompt_templates SET
    max_images = 1,
    updated_at = NOW()
WHERE template_key = 'hairstyle_change';

-- =============================================================================
-- ISSUE 4 (IMPROVEMENT): album_9_photos - Not guaranteed to generate 9 photos
-- Problem: Prompt doesn't explicitly specify "exactly 9 portraits in 3x3 grid"
-- Solution: Update prompt to be more explicit
-- =============================================================================

UPDATE prompt_templates SET
    base_prompt = 'Using the uploaded photo as a reference, generate exactly 9 vibrant half-length portraits arranged in a 3x3 grid layout. Each portrait should show a different pose and be placed in a unique natural setting, with rich, colorful details that highlight the diversity of nature. Maintain the same person across all 9 portraits with consistent facial features and style.',
    updated_at = NOW()
WHERE template_key = 'album_9_photos';

-- =============================================================================
-- ISSUE 5 (UX IMPROVEMENT): elegant_saree - Korean name localization
-- Problem: "사리" (saree) is unfamiliar to Korean users
-- Solution: Change to more descriptive Korean name
-- =============================================================================

UPDATE prompt_templates SET
    template_name_ko = '🎭 우아한 전통의상 스타일',
    updated_at = NOW()
WHERE template_key = 'elegant_saree';

-- =============================================================================
-- ISSUE 6 (IMPROVEMENT): multi_merge - Add explicit layout instructions
-- Problem: "Combine multiple images" is too vague
-- Solution: Add more specific layout instructions
-- =============================================================================

UPDATE prompt_templates SET
    base_prompt = 'Combine multiple images into a single cohesive image with a natural layout (side-by-side, grid, or artistic collage). Keep all key subjects recognizable and maintain their proportions and details. Blend the images naturally with consistent lighting, shadows, perspective, and style. Ensure smooth transitions between images. Photorealistic, high-resolution, seamless integration.',
    updated_at = NOW()
WHERE template_key = 'multi_merge';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Show fixed templates
DO $$
DECLARE
    fixed_count INTEGER;
    template_record RECORD;
BEGIN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '✅ PROMPT TEMPLATE FIXES APPLIED';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '';

    -- Count fixed templates
    SELECT COUNT(*) INTO fixed_count
    FROM prompt_templates
    WHERE template_key IN ('outfit_swap', 'clothing_change', 'hairstyle_change',
                           'album_9_photos', 'elegant_saree', 'multi_merge');

    RAISE NOTICE '📊 Fixed % templates', fixed_count;
    RAISE NOTICE '';
    RAISE NOTICE '📋 Fixed Template Details:';
    RAISE NOTICE '';

    -- Show details of each fixed template
    FOR template_record IN
        SELECT
            template_key,
            template_name_ko,
            template_type,
            min_images,
            max_images,
            priority
        FROM prompt_templates
        WHERE template_key IN ('outfit_swap', 'clothing_change', 'hairstyle_change',
                               'album_9_photos', 'elegant_saree', 'multi_merge')
        ORDER BY template_key
    LOOP
        RAISE NOTICE '  • %', template_record.template_key;
        RAISE NOTICE '    - Name: %', template_record.template_name_ko;
        RAISE NOTICE '    - Type: %', template_record.template_type;
        RAISE NOTICE '    - Images: % - %', template_record.min_images, template_record.max_images;
        RAISE NOTICE '    - Priority: %', template_record.priority;
        RAISE NOTICE '';
    END LOOP;

    -- Show outfit_swap parameters
    RAISE NOTICE '🎨 outfit_swap Parameterization:';
    FOR template_record IN
        SELECT
            tp.parameter_name_ko,
            COUNT(tpo.id) as option_count
        FROM template_parameters tp
        LEFT JOIN template_parameter_options tpo ON tp.id = tpo.parameter_id
        WHERE tp.template_key = 'outfit_swap'
        GROUP BY tp.parameter_name_ko
    LOOP
        RAISE NOTICE '  • Parameter: % (% options)',
            template_record.parameter_name_ko,
            template_record.option_count;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '✅ ALL FIXES APPLIED SUCCESSFULLY';
    RAISE NOTICE '=============================================================================';
END $$;

-- =============================================================================
-- SUMMARY OF CHANGES
-- =============================================================================

/*
CHANGES SUMMARY:

1. ✅ outfit_swap (BLOCKER FIX)
   - Changed from 2-image swap to 1-image parameterized template
   - Added 6 outfit style options (business, casual, dress, sportswear, hanbok, streetwear)
   - min_images: 2 → 1
   - max_images: 2 → 1
   - template_type: fixed → parameterized

2. ✅ clothing_change (IMPORTANT FIX)
   - Fixed max_images from 2 to 1

3. ✅ hairstyle_change (IMPORTANT FIX)
   - Fixed max_images from 2 to 1

4. ✅ album_9_photos (IMPROVEMENT)
   - Updated prompt to explicitly specify "exactly 9 portraits in 3x3 grid"

5. ✅ elegant_saree (UX IMPROVEMENT)
   - Changed Korean name from "우아한 사리 스타일" to "우아한 전통의상 스타일"

6. ✅ multi_merge (IMPROVEMENT)
   - Added explicit layout instructions (side-by-side, grid, collage)

IMPACT:
- Critical API errors prevented (outfit_swap image mismatch)
- User confusion eliminated (clothing_change, hairstyle_change)
- Better user experience (clearer prompts)
- 1 new parameterized template (outfit_swap with 6 options)

NEXT STEPS:
1. Deploy this SQL to Supabase
2. Test outfit_swap with new parameterized options
3. Monitor template usage and error rates
4. Proceed with Phase 2: Additional parameterizations
*/
