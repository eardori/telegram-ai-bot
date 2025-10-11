-- =============================================================================
-- ADD MISSING PARAMETERIZED TEMPLATES
-- Version: 1.0.0
-- Description: Add 5 missing parameterized templates with options
-- Templates: season_change, hairstyle_change, object_add, object_remove, text_edit
-- =============================================================================

-- =============================================================================
-- TEMPLATE 1: 계절 변경 (Season Change)
-- =============================================================================

UPDATE prompt_templates SET
    template_name_ko = '🍂 계절 변경',
    base_prompt = 'Transform this photo to show {season_type}. Adjust the environment, colors, lighting, foliage, and atmospheric effects to authentically represent the chosen season. Keep the main subject and composition unchanged. Ensure photorealistic quality with natural seasonal elements.',
    template_type = 'parameterized',
    min_images = 1,
    max_images = 1,
    priority = 66
WHERE template_key = 'season_change';

-- Add parameter
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'season_change', 'season_type', '계절 선택', 'Season Type',
    'select', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- Add options
INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    ((SELECT id FROM template_parameters WHERE template_key = 'season_change' AND parameter_key = 'season_type'),
     'spring', '봄', 'Spring',
     'spring season with blooming flowers, fresh green leaves, cherry blossoms, blue sky, gentle sunlight, and rejuvenating atmosphere', '🌸', 1),

    ((SELECT id FROM template_parameters WHERE template_key = 'season_change' AND parameter_key = 'season_type'),
     'summer', '여름', 'Summer',
     'summer season with lush green foliage, bright sunshine, clear blue skies, vibrant colors, warm golden light, and lively atmosphere', '☀️', 2),

    ((SELECT id FROM template_parameters WHERE template_key = 'season_change' AND parameter_key = 'season_type'),
     'autumn', '가을', 'Autumn',
     'autumn season with golden, orange, and red fall foliage, fallen leaves on the ground, warm autumn colors, soft golden hour light, and nostalgic atmosphere', '🍂', 3),

    ((SELECT id FROM template_parameters WHERE template_key = 'season_change' AND parameter_key = 'season_type'),
     'winter', '겨울', 'Winter',
     'winter season with snow-covered ground and trees, frost, icicles, bare branches, cold blue-white lighting, soft snowfall, and serene winter atmosphere', '❄️', 4)
ON CONFLICT (parameter_id, option_key) DO NOTHING;

-- =============================================================================
-- TEMPLATE 2: 헤어스타일 변경 (Hairstyle Change)
-- =============================================================================

UPDATE prompt_templates SET
    template_name_ko = '💇 헤어스타일 변경',
    base_prompt = 'Change the hairstyle of the person to {hairstyle_type}. Keep the same face, facial features, body, pose, clothing, and background. Only modify the hair. Ensure the new hairstyle looks natural with realistic hair texture, volume, flow, lighting, and shadows.',
    template_type = 'parameterized',
    min_images = 1,
    max_images = 1,
    priority = 67
WHERE template_key = 'hairstyle_change';

-- Add parameter
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'hairstyle_change', 'hairstyle_type', '헤어스타일 선택', 'Hairstyle Type',
    'select', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- Add options
INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'long_straight', '긴 생머리', 'Long Straight Hair',
     'long, straight, flowing hair that falls past the shoulders, with smooth texture, natural shine, and sleek appearance', '💁‍♀️', 1),

    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'wavy_curly', '웨이브 / 컬리', 'Wavy Curly Hair',
     'wavy or curly hair with defined curls or waves, volume, bounce, natural texture, and dynamic movement', '🌊', 2),

    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'short_bob', '단발 / 보브컷', 'Short Bob Cut',
     'short bob haircut ending at chin or shoulder length, with clean lines, modern style, and structured shape', '💇', 3),

    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'pixie_short', '픽시컷 / 짧은머리', 'Pixie Cut',
     'very short pixie cut with textured layers, edgy modern style, clean neckline, and confident look', '✂️', 4),

    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'ponytail', '포니테일', 'Ponytail',
     'hair pulled back into a high or low ponytail, sleek or voluminous, with clean hairline and casual-chic style', '🎀', 5),

    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'bun_updo', '업스타일 / 묶은머리', 'Bun Updo',
     'hair styled in an elegant bun or updo, neat and polished, sophisticated style, suitable for formal occasions', '👰', 6)
ON CONFLICT (parameter_id, option_key) DO NOTHING;

-- =============================================================================
-- TEMPLATE 3: 사물 추가 (Object Add)
-- =============================================================================

UPDATE prompt_templates SET
    template_name_ko = '➕ 사물 추가',
    base_prompt = 'Add {object_to_add} to this photo. Place it naturally in the scene, matching the existing lighting, perspective, shadows, and style. Ensure seamless integration with photorealistic quality. Keep all original elements unchanged.',
    template_type = 'parameterized',
    min_images = 1,
    max_images = 1,
    priority = 71
WHERE template_key = 'object_add';

-- Add parameter
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'object_add', 'object_to_add', '추가할 사물', 'Object to Add',
    'select', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- Add options
INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    ((SELECT id FROM template_parameters WHERE template_key = 'object_add' AND parameter_key = 'object_to_add'),
     'flowers_vase', '꽃다발 / 화병', 'Flowers in Vase',
     'a beautiful vase with fresh colorful flowers - roses, tulips, or seasonal blooms arranged naturally', '💐', 1),

    ((SELECT id FROM template_parameters WHERE template_key = 'object_add' AND parameter_key = 'object_to_add'),
     'pet_dog', '강아지', 'Pet Dog',
     'a friendly cute dog sitting or standing naturally in the scene, with appropriate breed characteristics and realistic fur texture', '🐕', 2),

    ((SELECT id FROM template_parameters WHERE template_key = 'object_add' AND parameter_key = 'object_to_add'),
     'pet_cat', '고양이', 'Pet Cat',
     'a cute cat sitting gracefully or curled up naturally in the scene, with realistic fur, whiskers, and feline characteristics', '🐱', 3),

    ((SELECT id FROM template_parameters WHERE template_key = 'object_add' AND parameter_key = 'object_to_add'),
     'butterfly', '나비', 'Butterfly',
     'delicate colorful butterflies flying gracefully in the scene, with detailed wings, natural flight patterns, and ethereal presence', '🦋', 4),

    ((SELECT id FROM template_parameters WHERE template_key = 'object_add' AND parameter_key = 'object_to_add'),
     'umbrella', '우산', 'Umbrella',
     'a stylish umbrella being held naturally, appropriate for the scene (rain or sun), with realistic fabric texture and shadows', '☂️', 5),

    ((SELECT id FROM template_parameters WHERE template_key = 'object_add' AND parameter_key = 'object_to_add'),
     'coffee_cup', '커피잔', 'Coffee Cup',
     'a ceramic coffee cup or mug placed naturally on a table or held in hand, with realistic steam, liquid, and coffee details', '☕', 6)
ON CONFLICT (parameter_id, option_key) DO NOTHING;

-- =============================================================================
-- TEMPLATE 4: 사물 제거 (Object Remove)
-- =============================================================================

UPDATE prompt_templates SET
    template_name_ko = '➖ 사물 제거',
    base_prompt = 'Remove {object_to_remove} from this photo. Fill the area naturally to maintain the scene''s continuity, lighting, perspective, and details. Ensure seamless removal with photorealistic background reconstruction. Keep all other elements unchanged.',
    template_type = 'parameterized',
    min_images = 1,
    max_images = 1,
    priority = 84
WHERE template_key = 'object_remove';

-- Add parameter
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'object_remove', 'object_to_remove', '제거할 대상', 'Object to Remove',
    'select', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- Add options
INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    ((SELECT id FROM template_parameters WHERE template_key = 'object_remove' AND parameter_key = 'object_to_remove'),
     'person_bg', '사람 (배경)', 'Background Person',
     'any person or people in the background of the photo, not the main subject', '👤', 1),

    ((SELECT id FROM template_parameters WHERE template_key = 'object_remove' AND parameter_key = 'object_to_remove'),
     'vehicle', '차량 / 자동차', 'Vehicle',
     'any vehicles like cars, trucks, motorcycles, or bicycles visible in the photo', '🚗', 2),

    ((SELECT id FROM template_parameters WHERE template_key = 'object_remove' AND parameter_key = 'object_to_remove'),
     'text_sign', '텍스트 / 간판', 'Text and Signs',
     'any visible text, signs, billboards, or written content in the photo', '🪧', 3),

    ((SELECT id FROM template_parameters WHERE template_key = 'object_remove' AND parameter_key = 'object_to_remove'),
     'wire_pole', '전선 / 전신주', 'Wires and Poles',
     'electrical wires, telephone poles, utility posts, or overhead cables', '⚡', 4),

    ((SELECT id FROM template_parameters WHERE template_key = 'object_remove' AND parameter_key = 'object_to_remove'),
     'trash_litter', '쓰레기 / 잡동사니', 'Trash and Clutter',
     'any trash, litter, unwanted objects, or cluttered items in the scene', '🗑️', 5),

    ((SELECT id FROM template_parameters WHERE template_key = 'object_remove' AND parameter_key = 'object_to_remove'),
     'watermark', '워터마크 / 로고', 'Watermark/Logo',
     'any watermarks, logos, stamps, or overlay graphics on the photo', '©️', 6)
ON CONFLICT (parameter_id, option_key) DO NOTHING;

-- =============================================================================
-- TEMPLATE 5: 텍스트 편집 (Text Edit)
-- Note: This is a text input type, not select type
-- =============================================================================

UPDATE prompt_templates SET
    template_name_ko = '✏️ 텍스트 편집',
    base_prompt = 'Edit the visible text in this photo. Replace the existing text with: "{new_text}". Keep the background, design, layout, and all other elements unchanged. Match the font style, size, color, and formatting to look natural and consistent with the original design. Ensure photorealistic quality and seamless integration.',
    template_type = 'parameterized',
    min_images = 1,
    max_images = 1,
    priority = 55
WHERE template_key = 'text_edit';

-- Add parameter (text input type)
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'text_edit', 'new_text', '새 텍스트', 'New Text',
    'text', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- Note: text type parameters don't have predefined options
-- User will input free text directly

-- =============================================================================
-- VERIFICATION AND SUMMARY
-- =============================================================================

-- Count parameterized templates
DO $$
DECLARE
    total_param_templates INTEGER;
    total_parameters INTEGER;
    total_options INTEGER;
BEGIN
    SELECT COUNT(DISTINCT template_key) INTO total_param_templates
    FROM prompt_templates
    WHERE template_type = 'parameterized' AND is_active = true;

    SELECT COUNT(DISTINCT parameter_key) INTO total_parameters
    FROM template_parameters;

    SELECT COUNT(*) INTO total_options
    FROM template_parameter_options;

    RAISE NOTICE '✅ Parameterized Templates Update Complete';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Summary:';
    RAISE NOTICE '  - Total Parameterized Templates: %', total_param_templates;
    RAISE NOTICE '  - Total Parameters: %', total_parameters;
    RAISE NOTICE '  - Total Options: %', total_options;
    RAISE NOTICE '';
    RAISE NOTICE '📋 New Templates Added:';
    RAISE NOTICE '  1. 계절 변경 (season_change) - 4 options';
    RAISE NOTICE '  2. 헤어스타일 변경 (hairstyle_change) - 6 options';
    RAISE NOTICE '  3. 사물 추가 (object_add) - 6 options';
    RAISE NOTICE '  4. 사물 제거 (object_remove) - 6 options';
    RAISE NOTICE '  5. 텍스트 편집 (text_edit) - text input type';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 All parameterized templates now configured!';
END $$;

-- Show full list of parameterized templates
SELECT
    template_key,
    template_name,
    COUNT(DISTINCT parameter_key) as parameters,
    STRING_AGG(DISTINCT parameter_name, ', ') as parameter_names
FROM template_parameters_full
GROUP BY template_key, template_name
ORDER BY template_key;
