-- =============================================================================
-- PROMPT IMPROVEMENTS - 프롬프트 개선
-- Version: 1.0.0
-- Date: 2025-01-10
-- Description: 중복 제거, 옵션 확장, 새 파라미터 템플릿 추가
-- =============================================================================

-- =============================================================================
-- PART 1: 중복 템플릿 제거
-- =============================================================================

-- 1.1. clothing_change 템플릿 비활성화 (outfit_styling과 중복)
UPDATE prompt_templates
SET is_active = false,
    updated_at = NOW()
WHERE template_key = 'clothing_change';

DO $$ BEGIN
    RAISE NOTICE '✅ Part 1 완료: clothing_change 비활성화';
END $$;

-- =============================================================================
-- PART 2: 기존 파라미터 옵션 확장
-- =============================================================================

-- 2.1. 배경 변경 (Background Replace) - 옵션 3개 추가
-- 기존 6개 → 9개

INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    -- 7. 산 정상
    ((SELECT id FROM template_parameters WHERE template_key = 'background_replace' AND parameter_key = 'background_style'),
     'mountain_peak', '산 정상', 'Mountain Peak',
     'a majestic mountain peak view with snow-capped summits, clouds below, vast panoramic vista, clear blue sky, alpine atmosphere, breathtaking elevation, and pristine natural beauty', '🏔️', 7),

    -- 8. 중세 성
    ((SELECT id FROM template_parameters WHERE template_key = 'background_replace' AND parameter_key = 'background_style'),
     'medieval_castle', '중세 성', 'Medieval Castle',
     'a grand medieval castle with massive stone walls, towering battlements, flying banners and flags, historical architecture, moat, drawbridge, and majestic medieval atmosphere', '🏰', 8),

    -- 9. 벚꽃 정원
    ((SELECT id FROM template_parameters WHERE template_key = 'background_replace' AND parameter_key = 'background_style'),
     'cherry_blossom', '벚꽃 정원', 'Cherry Blossom Garden',
     'a beautiful cherry blossom garden in full bloom with pink sakura petals gently falling, soft spring light, romantic atmosphere, Japanese garden elements, and peaceful ambiance', '🌸', 9)
ON CONFLICT (parameter_id, option_key) DO UPDATE SET
    option_name_ko = EXCLUDED.option_name_ko,
    option_name_en = EXCLUDED.option_name_en,
    prompt_fragment = EXCLUDED.prompt_fragment,
    emoji = EXCLUDED.emoji,
    display_order = EXCLUDED.display_order;

DO $$ BEGIN
    RAISE NOTICE '✅ Part 2.1 완료: 배경 옵션 3개 추가 (총 9개)';
END $$;

-- 2.2. 의상 변경 (Outfit Styling) - 옵션 4개 추가
-- 기존 6개 → 10개

INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    -- 7. 턱시도
    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_styling' AND parameter_key = 'outfit_style'),
     'formal_tuxedo', '턱시도', 'Formal Tuxedo',
     'a formal black tuxedo with satin lapels, crisp white dress shirt, black bow tie, cummerbund, dress pants with satin stripe, and polished patent leather shoes', '🎩', 7),

    -- 8. 로커 스타일
    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_styling' AND parameter_key = 'outfit_style'),
     'rocker_leather', '로커 스타일', 'Rocker Style',
     'edgy rocker outfit - black leather jacket with metal studs, band t-shirt with vintage graphics, ripped distressed jeans, and heavy boots with buckles', '🎸', 8),

    -- 9. 비즈니스 캐주얼
    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_styling' AND parameter_key = 'outfit_style'),
     'business_casual', '비즈니스 캐주얼', 'Business Casual',
     'business casual attire - oxford button-down shirt in soft colors, khaki chinos or dress slacks, optional blazer, and leather loafers or dress sneakers', '👔', 9),

    -- 10. 여름 리조트
    ((SELECT id FROM template_parameters WHERE template_key = 'outfit_styling' AND parameter_key = 'outfit_style'),
     'summer_resort', '여름 리조트', 'Summer Resort',
     'relaxed resort wear - colorful Hawaiian shirt with tropical print, linen pants or shorts, sandals or espadrilles, and sunglasses for a vacation vibe', '🌴', 10)
ON CONFLICT (parameter_id, option_key) DO UPDATE SET
    option_name_ko = EXCLUDED.option_name_ko,
    option_name_en = EXCLUDED.option_name_en,
    prompt_fragment = EXCLUDED.prompt_fragment,
    emoji = EXCLUDED.emoji,
    display_order = EXCLUDED.display_order;

DO $$ BEGIN
    RAISE NOTICE '✅ Part 2.2 완료: 의상 옵션 4개 추가 (총 10개)';
END $$;

-- 2.3. 표정 변경 (Expression Change) - 옵션 3개 추가
-- 기존 5개 → 8개

INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    -- 6. 평온한
    ((SELECT id FROM template_parameters WHERE template_key = 'expression_change' AND parameter_key = 'expression_type'),
     'calm_peaceful', '평온한', 'Calm & Peaceful',
     'a calm, peaceful expression with serene eyes, gentle closed-lip smile, relaxed facial muscles, tranquil demeanor, and Zen-like composure', '😌', 6),

    -- 7. 사색하는
    ((SELECT id FROM template_parameters WHERE template_key = 'expression_change' AND parameter_key = 'expression_type'),
     'thoughtful_pensive', '사색하는', 'Thoughtful',
     'a thoughtful, pensive expression with contemplative eyes gazing into distance, slightly furrowed brow, serious demeanor, and intellectual atmosphere', '🤔', 7),

    -- 8. 다정한
    ((SELECT id FROM template_parameters WHERE template_key = 'expression_change' AND parameter_key = 'expression_type'),
     'warm_friendly', '다정한', 'Warm & Friendly',
     'a warm, friendly expression with genuine smile, kind eyes, approachable demeanor, welcoming energy, and heartwarming presence', '😊', 8)
ON CONFLICT (parameter_id, option_key) DO UPDATE SET
    option_name_ko = EXCLUDED.option_name_ko,
    option_name_en = EXCLUDED.option_name_en,
    prompt_fragment = EXCLUDED.prompt_fragment,
    emoji = EXCLUDED.emoji,
    display_order = EXCLUDED.display_order;

DO $$ BEGIN
    RAISE NOTICE '✅ Part 2.3 완료: 표정 옵션 3개 추가 (총 8개)';
END $$;

-- =============================================================================
-- PART 3: 새 파라미터 템플릿 - 헤어스타일 변경
-- =============================================================================

-- 3.1. 템플릿 추가 (또는 업데이트)
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    template_type, min_images, max_images, requires_face, priority, is_active
) VALUES (
    'hairstyle_change',
    '💇 헤어스타일 변경',
    'Hairstyle Change',
    'image_editing',
    'beauty',
    'Change the hairstyle of the person in this photo to {hairstyle_type}. Keep the face, expression, skin tone, clothing, pose, and background exactly the same. Only modify the hair with natural texture, color, shine, volume, and realistic hair physics. Ensure the new hairstyle fits naturally with the face shape and overall appearance.',
    'parameterized', 1, 1, true, 68, true
)
ON CONFLICT (template_key) DO UPDATE SET
    template_name_ko = EXCLUDED.template_name_ko,
    template_name_en = EXCLUDED.template_name_en,
    base_prompt = EXCLUDED.base_prompt,
    updated_at = NOW();

-- 3.2. 파라미터 추가
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'hairstyle_change', 'hairstyle_type', '헤어스타일 선택', 'Hairstyle Type',
    'select', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- 3.3. 파라미터 옵션 추가 (8개)
INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    -- 1. 긴 생머리
    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'long_straight', '긴 생머리', 'Long Straight',
     'long straight hair flowing down to waist or lower, sleek and silky texture, glossy shine, black or dark brown color, perfectly smooth and straight with natural movement', '💇‍♀️', 1),

    -- 2. 웨이브 펌
    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'wavy_curls', '웨이브 펌', 'Wavy Curls',
     'shoulder-length wavy hair with natural-looking curls, soft romantic waves, bouncy volume, medium-brown color with subtle highlights, and flowing movement', '🌀', 2),

    -- 3. 단발 보브
    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'short_bob', '단발 보브', 'Short Bob',
     'a sleek short bob haircut at chin length, straight clean lines, neat blunt cut, chic and modern style, dark color, and professional appearance', '✂️', 3),

    -- 4. 남성 언더컷
    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'undercut', '남성 언더컷', 'Undercut',
     'modern undercut hairstyle - short faded sides and back, longer hair on top styled back or to the side, textured with subtle product, and contemporary masculine look', '💈', 4),

    -- 5. 컬러 염색
    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'colored_vibrant', '컬러 염색', 'Colored Hair',
     'vibrant colored hair with bold fashion colors - pink, purple, blue, or pastel tones, gradient or ombre effect, modern trendy style, and eye-catching appearance', '🎨', 5),

    -- 6. 포니테일
    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'high_ponytail', '포니테일', 'High Ponytail',
     'high ponytail hairstyle tied up neatly at crown, long flowing hair from the tie, clean pulled-back look, sporty and active appearance, with some face-framing wisps', '🎀', 6),

    -- 7. 업스타일
    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'elegant_updo', '엘레강트 업스타일', 'Elegant Updo',
     'an elegant updo hairstyle with hair swept up and secured in a sophisticated bun or chignon, intricate styling details, perfect for formal events, with soft tendrils framing the face', '👸', 7),

    -- 8. 아프로 곱슬
    ((SELECT id FROM template_parameters WHERE template_key = 'hairstyle_change' AND parameter_key = 'hairstyle_type'),
     'afro_curls', '아프로 곱슬', 'Afro Curls',
     'voluminous afro curls with natural coily texture, full rounded shape, healthy shine, thick density, and beautiful natural hair celebration', '🦱', 8)
ON CONFLICT (parameter_id, option_key) DO UPDATE SET
    option_name_ko = EXCLUDED.option_name_ko,
    option_name_en = EXCLUDED.option_name_en,
    prompt_fragment = EXCLUDED.prompt_fragment,
    emoji = EXCLUDED.emoji,
    display_order = EXCLUDED.display_order;

DO $$ BEGIN
    RAISE NOTICE '✅ Part 3 완료: 헤어스타일 변경 템플릿 추가 (8개 옵션)';
END $$;

-- =============================================================================
-- PART 4: 새 파라미터 템플릿 - 메이크업 스타일
-- =============================================================================

-- 4.1. 템플릿 추가 (또는 업데이트)
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    template_type, min_images, max_images, requires_face, priority, is_active
) VALUES (
    'makeup_styling',
    '💄 메이크업 스타일',
    'Makeup Styling',
    'image_editing',
    'beauty',
    'Apply {makeup_style} to the person''s face in this photo. Keep the face shape, features, skin texture, hair, clothing, pose, and background exactly the same. Only change the makeup application with realistic colors, smooth blending, professional techniques, and natural lighting response. Ensure the makeup looks professionally applied and enhances the natural beauty.',
    'parameterized', 1, 1, true, 67, true
)
ON CONFLICT (template_key) DO UPDATE SET
    template_name_ko = EXCLUDED.template_name_ko,
    template_name_en = EXCLUDED.template_name_en,
    base_prompt = EXCLUDED.base_prompt,
    updated_at = NOW();

-- 4.2. 파라미터 추가
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'makeup_styling', 'makeup_style', '메이크업 스타일', 'Makeup Style',
    'select', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- 4.3. 파라미터 옵션 추가 (6개)
INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    -- 1. 내추럴
    ((SELECT id FROM template_parameters WHERE template_key = 'makeup_styling' AND parameter_key = 'makeup_style'),
     'natural_minimal', '내추럴 메이크업', 'Natural Look',
     'natural minimal makeup - light foundation for even skin tone, subtle nude eyeshadow, soft brown eyeliner, natural mascara, peachy blush, and nude pink lip color for a fresh no-makeup makeup look', '✨', 1),

    -- 2. 글램
    ((SELECT id FROM template_parameters WHERE template_key = 'makeup_styling' AND parameter_key = 'makeup_style'),
     'glamorous_bold', '글램 메이크업', 'Glamorous',
     'glamorous bold makeup - flawless full coverage foundation, dramatic smokey eye with dark eyeshadow, winged eyeliner, false lashes, sculpted contour, highlighter on cheekbones, and bold red or burgundy lipstick', '💋', 2),

    -- 3. 로맨틱
    ((SELECT id FROM template_parameters WHERE template_key = 'makeup_styling' AND parameter_key = 'makeup_style'),
     'romantic_pink', '로맨틱 메이크업', 'Romantic Pink',
     'romantic pink makeup - dewy foundation, soft pink eyeshadow with shimmer, delicate eyeliner, fluttery lashes, coral or pink blush, and pink or rose lipstick for a sweet feminine look', '🌸', 3),

    -- 4. 고딕
    ((SELECT id FROM template_parameters WHERE template_key = 'makeup_styling' AND parameter_key = 'makeup_style'),
     'gothic_dark', '고딕 메이크업', 'Gothic Dark',
     'gothic dark makeup - pale foundation, dark smokey eyes with black eyeshadow, heavy black eyeliner and mascara, dark lipstick in black or deep purple, dramatic contour for edgy alternative style', '🖤', 4),

    -- 5. 무대용
    ((SELECT id FROM template_parameters WHERE template_key = 'makeup_styling' AND parameter_key = 'makeup_style'),
     'stage_dramatic', '무대 메이크업', 'Stage Dramatic',
     'stage dramatic makeup - intense full coverage foundation, exaggerated contouring and highlighting, bold colorful eyeshadow, thick eyeliner, heavy mascara or false lashes, strong blush, and vibrant lip color designed for stage lighting', '🎭', 5),

    -- 6. K-뷰티 글로우
    ((SELECT id FROM template_parameters WHERE template_key = 'makeup_styling' AND parameter_key = 'makeup_style'),
     'kbeauty_glow', 'K-뷰티 글로우', 'K-Beauty Glow',
     'K-beauty glow makeup - luminous dewy skin with glass skin effect, subtle eyeshadow with light shimmer, straight aegyo-sal under eyes, natural brows, soft pink blush on apples of cheeks, and gradient lip tint for Korean beauty style', '🌟', 6)
ON CONFLICT (parameter_id, option_key) DO UPDATE SET
    option_name_ko = EXCLUDED.option_name_ko,
    option_name_en = EXCLUDED.option_name_en,
    prompt_fragment = EXCLUDED.prompt_fragment,
    emoji = EXCLUDED.emoji,
    display_order = EXCLUDED.display_order;

DO $$ BEGIN
    RAISE NOTICE '✅ Part 4 완료: 메이크업 스타일 템플릿 추가 (6개 옵션)';
END $$;

-- =============================================================================
-- PART 5: 새 파라미터 템플릿 - 시간대/계절 변경
-- =============================================================================

-- 5.1. 템플릿 추가 (또는 업데이트)
INSERT INTO prompt_templates (
    template_key, template_name_ko, template_name_en, category, subcategory,
    base_prompt,
    template_type, min_images, max_images, requires_face, priority, is_active
) VALUES (
    'time_season_change',
    '🌅 시간대/계절 변경',
    'Time & Season Change',
    'image_editing',
    'atmosphere',
    'Transform this photo to {time_season}. Adjust the overall lighting, color temperature, shadows, highlights, and atmospheric mood to perfectly match the selected time or season. Keep all subjects, composition, poses, and scene elements exactly the same - only change the ambient lighting environment and atmospheric feeling.',
    'parameterized', 1, 1, false, 66, true
)
ON CONFLICT (template_key) DO UPDATE SET
    template_name_ko = EXCLUDED.template_name_ko,
    template_name_en = EXCLUDED.template_name_en,
    base_prompt = EXCLUDED.base_prompt,
    updated_at = NOW();

-- 5.2. 파라미터 추가
INSERT INTO template_parameters (
    template_key, parameter_key, parameter_name_ko, parameter_name_en,
    parameter_type, is_required, display_order
) VALUES (
    'time_season_change', 'time_season', '시간대/계절', 'Time & Season',
    'select', true, 1
)
ON CONFLICT (template_key, parameter_key) DO NOTHING;

-- 5.3. 파라미터 옵션 추가 (4개)
INSERT INTO template_parameter_options (
    parameter_id, option_key, option_name_ko, option_name_en,
    prompt_fragment, emoji, display_order
) VALUES
    -- 1. 골든 아워
    ((SELECT id FROM template_parameters WHERE template_key = 'time_season_change' AND parameter_key = 'time_season'),
     'golden_hour', '황금 시간 (골든 아워)', 'Golden Hour',
     'golden hour lighting - warm orange-golden sunlight, long dramatic shadows, soft glowing atmosphere, rich saturated colors, magical quality of light shortly after sunrise or before sunset', '🌅', 1),

    -- 2. 밤 / 야경
    ((SELECT id FROM template_parameters WHERE template_key = 'time_season_change' AND parameter_key = 'time_season'),
     'night_time', '밤 / 야경', 'Night Time',
     'night time atmosphere - dark blue or black sky with stars or moon, artificial lighting from street lamps or windows, cool color temperature, mysterious nocturnal mood, and evening ambiance', '🌃', 2),

    -- 3. 겨울
    ((SELECT id FROM template_parameters WHERE template_key = 'time_season_change' AND parameter_key = 'time_season'),
     'winter_scene', '겨울 분위기', 'Winter',
     'winter season atmosphere - cool blue color tones, soft diffused light through overcast sky, potential snowfall effect, crisp cold feeling, winter clothing appropriate, and seasonal winter mood', '❄️', 3),

    -- 4. 봄
    ((SELECT id FROM template_parameters WHERE template_key = 'time_season_change' AND parameter_key = 'time_season'),
     'spring_scene', '봄 분위기', 'Spring',
     'spring season atmosphere - bright cheerful lighting, warm sunlight with fresh quality, vibrant colors with emphasis on greens and pastels, blooming flowers in background, renewal and growth feeling, and pleasant spring weather mood', '🌸', 4)
ON CONFLICT (parameter_id, option_key) DO UPDATE SET
    option_name_ko = EXCLUDED.option_name_ko,
    option_name_en = EXCLUDED.option_name_en,
    prompt_fragment = EXCLUDED.prompt_fragment,
    emoji = EXCLUDED.emoji,
    display_order = EXCLUDED.display_order;

DO $$ BEGIN
    RAISE NOTICE '✅ Part 5 완료: 시간대/계절 변경 템플릿 추가 (4개 옵션)';
END $$;

-- =============================================================================
-- VERIFICATION & SUMMARY
-- =============================================================================

-- 통계 확인
DO $$
DECLARE
    active_templates INT;
    param_templates INT;
    total_options INT;
BEGIN
    SELECT COUNT(*) INTO active_templates FROM prompt_templates WHERE is_active = true;
    SELECT COUNT(*) INTO param_templates FROM prompt_templates WHERE template_type = 'parameterized' AND is_active = true;
    SELECT COUNT(*) INTO total_options FROM template_parameter_options;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '프롬프트 개선 완료! 🎉';
    RAISE NOTICE '========================================';
    RAISE NOTICE '활성 템플릿: % 개', active_templates;
    RAISE NOTICE '파라미터 템플릿: % 개', param_templates;
    RAISE NOTICE '총 파라미터 옵션: % 개', total_options;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Phase 1: 중복 제거 (clothing_change 비활성화)';
    RAISE NOTICE '✅ Phase 2: 기존 옵션 확장 (+10개)';
    RAISE NOTICE '  - 배경: 6 → 9개 (+3)';
    RAISE NOTICE '  - 의상: 6 → 10개 (+4)';
    RAISE NOTICE '  - 표정: 5 → 8개 (+3)';
    RAISE NOTICE '✅ Phase 3: 새 템플릿 추가 (+3개)';
    RAISE NOTICE '  - 헤어스타일 변경 (8개 옵션)';
    RAISE NOTICE '  - 메이크업 스타일 (6개 옵션)';
    RAISE NOTICE '  - 시간대/계절 (4개 옵션)';
    RAISE NOTICE '';
    RAISE NOTICE '다음 단계: 봇에서 테스트해보세요! 🚀';
    RAISE NOTICE '========================================';
END $$;
