-- =============================================================================
-- UPGRADE EXISTING TEMPLATES TO PARAMETERIZED
-- Version: 1.0.0
-- Description: Upgrade 3 existing templates to parameterized with options
-- =============================================================================

-- =============================================================================
-- TEMPLATE 1: 배경 변경 (Background Replace)
-- Upgrade existing 'background_replace' template
-- =============================================================================

UPDATE prompt_templates SET
    template_name_ko = '🌍 배경 변경',
    base_prompt = 'Replace the background of this photo with {background_style}. Keep the subject exactly as is, including pose, clothing, facial features, and the lighting on the subject. Seamlessly blend the subject into the new background with natural shadows and reflections. Maintain photorealistic quality.',
    template_type = 'parameterized',
    min_images = 1,
    max_images = 1,
    priority = 90
WHERE template_key = 'background_replace';

-- Add parameter
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'background_replace', 'background_style', '배경 스타일', 'Background Style',
    'select', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- Add options
INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    ((SELECT id FROM template_parameters WHERE template_key = 'background_replace' AND parameter_key = 'background_style'),
     'beach_sunset', '석양 해변', 'Beach Sunset',
     'a beautiful beach at sunset with golden hour lighting, gentle waves lapping the shore, palm trees silhouettes, and warm orange-pink sky', '🏖️', 1),

    ((SELECT id FROM template_parameters WHERE template_key = 'background_replace' AND parameter_key = 'background_style'),
     'city_night', '도심 야경', 'City Night',
     'a modern city skyline at night with illuminated skyscrapers, bokeh lights from traffic and buildings, neon signs, and urban atmosphere', '🌃', 2),

    ((SELECT id FROM template_parameters WHERE template_key = 'background_replace' AND parameter_key = 'background_style'),
     'space_galaxy', '우주 은하', 'Space Galaxy',
     'a cosmic space scene with colorful nebulae, distant stars, multiple galaxies, and ethereal cosmic atmosphere', '🌌', 3),

    ((SELECT id FROM template_parameters WHERE template_key = 'background_replace' AND parameter_key = 'background_style'),
     'fantasy_forest', '판타지 숲', 'Fantasy Forest',
     'an enchanted magical forest with glowing bioluminescent plants, floating fireflies, mystical fog, and dreamlike atmosphere', '🌳', 4),

    ((SELECT id FROM template_parameters WHERE template_key = 'background_replace' AND parameter_key = 'background_style'),
     'studio_white', '화이트 스튜디오', 'White Studio',
     'a clean, professional white studio background with soft gradient lighting and subtle shadows for portrait photography', '⚪', 5),

    ((SELECT id FROM template_parameters WHERE template_key = 'background_replace' AND parameter_key = 'background_style'),
     'cafe_cozy', '아늑한 카페', 'Cozy Cafe',
     'a cozy vintage cafe interior with warm yellow lighting, wooden furniture, coffee cups on tables, plants, and comfortable atmosphere', '☕', 6)
ON CONFLICT (parameter_id, option_key) DO NOTHING;

-- =============================================================================
-- TEMPLATE 2: 의상 스타일링 (Outfit Styling) - NEW TEMPLATE
-- Note: Different from 'outfit_swap' which swaps between 2 images
-- =============================================================================

INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt, template_type,
    min_images, max_images, requires_face, min_faces, priority, is_active
) VALUES (
    'outfit_styling',
    '👗 의상 스타일링',
    'Outfit Styling',
    'image_editing',
    'fashion',
    'Change the clothing of the person in this photo to {outfit_style}. Keep the face, pose, body proportions, and background exactly the same. Only change the clothing. Ensure the new outfit fits naturally on the body with proper folds, shadows, and realistic fabric texture.',
    'parameterized',
    1, 1, true, 1, 88, true
)
ON CONFLICT (template_key) DO UPDATE SET
    template_type = 'parameterized',
    base_prompt = EXCLUDED.base_prompt,
    priority = EXCLUDED.priority;

-- Add parameter
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'outfit_styling', 'outfit_style', '의상 스타일', 'Outfit Style',
    'select', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- Add options
INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_styling' AND parameter_key = 'outfit_style'),
     'business_suit', '비즈니스 정장', 'Business Suit',
     'a professional business suit - black or navy blazer, crisp white dress shirt, silk tie, dress pants, and polished leather shoes', '💼', 1),

    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_styling' AND parameter_key = 'outfit_style'),
     'casual_street', '캐주얼 스트릿', 'Casual Streetwear',
     'trendy streetwear - graphic t-shirt with cool design, relaxed fit jeans, stylish sneakers, and a baseball cap', '👕', 2),

    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_styling' AND parameter_key = 'outfit_style'),
     'elegant_dress', '우아한 드레스', 'Elegant Dress',
     'an elegant evening dress - floor-length gown with flowing fabric, sophisticated design, elegant accessories, and dressy heels', '👗', 3),

    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_styling' AND parameter_key = 'outfit_style'),
     'sportswear', '스포츠웨어', 'Sportswear',
     'athletic sportswear - moisture-wicking running shirt, performance shorts or leggings, sports brand logo, and athletic running shoes', '🏃', 4),

    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_styling' AND parameter_key = 'outfit_style'),
     'traditional_hanbok', '한복', 'Traditional Hanbok',
     'traditional Korean hanbok with vibrant colors - jeogori (jacket), chima (skirt) or baji (pants), elegant embroidery, and traditional accessories', '🎎', 5),

    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_styling' AND parameter_key = 'outfit_style'),
     'superhero', '슈퍼히어로', 'Superhero Costume',
     'a superhero costume - form-fitting suit with emblematic design, cape flowing behind, mask or cowl, and superhero insignia', '🦸', 6)
ON CONFLICT (parameter_id, option_key) DO NOTHING;

-- =============================================================================
-- TEMPLATE 3: 표정 변경 (Expression Change)
-- Upgrade existing 'expression_change' template
-- =============================================================================

UPDATE prompt_templates SET
    template_name_ko = '😊 표정 변경',
    base_prompt = 'Change the facial expression of the person in this photo to {expression_type}. Keep everything else exactly the same - same pose, same clothing, same background, same lighting. Only modify the facial expression naturally and realistically.',
    template_type = 'parameterized',
    min_images = 1,
    max_images = 1,
    priority = 85
WHERE template_key = 'expression_change';

-- Add parameter
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'expression_change', 'expression_type', '표정 선택', 'Expression Type',
    'select', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- Add options
INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    ((SELECT id FROM template_parameters WHERE template_key = 'expression_change' AND parameter_key = 'expression_type'),
     'happy_smile', '밝게 웃는', 'Happy Smile',
     'a bright, genuine smile with visible teeth, happy crinkled eyes, raised cheeks, and joyful expression', '😄', 1),

    ((SELECT id FROM template_parameters WHERE template_key = 'expression_change' AND parameter_key = 'expression_type'),
     'serious_pro', '진지한', 'Serious Professional',
     'a serious, professional expression with neutral mouth, focused eyes, composed demeanor, and confident stance', '😐', 2),

    ((SELECT id FROM template_parameters WHERE template_key = 'expression_change' AND parameter_key = 'expression_type'),
     'mysterious', '신비로운', 'Mysterious',
     'a mysterious, subtle smile with slight smirk, intrigue in the eyes, enigmatic expression, and alluring gaze', '😏', 3),

    ((SELECT id FROM template_parameters WHERE template_key = 'expression_change' AND parameter_key = 'expression_type'),
     'confident', '자신감 있는', 'Confident',
     'a confident, determined expression with strong direct eye contact, slight chin raise, assertive demeanor, and powerful presence', '😎', 4),

    ((SELECT id FROM template_parameters WHERE template_key = 'expression_change' AND parameter_key = 'expression_type'),
     'playful', '장난스러운', 'Playful',
     'a playful, cheeky expression - tongue slightly out or cute wink, mischievous smile, fun-loving eyes, and youthful energy', '😜', 5)
ON CONFLICT (parameter_id, option_key) DO NOTHING;

-- =============================================================================
-- SUMMARY
-- =============================================================================
SELECT
    COUNT(DISTINCT template_key) as parameterized_templates,
    COUNT(DISTINCT parameter_key) as total_parameters,
    COUNT(*) as total_options
FROM template_parameters_full;
