-- ============================================
-- Prompt Templates Re-categorization (FIXED)
-- ============================================
-- Purpose: Re-organize templates based on ACTUAL current DB state
-- Created: 2025-01-10
-- Current State: 36개가 image_editing에 몰려있음 → 6개 카테고리로 분산

-- ============================================
-- Step 1: 3D Figure Category (5개)
-- ============================================

UPDATE prompt_templates
SET
    category = '3d_figure',
    subcategory = 'character',
    updated_at = NOW()
WHERE template_key IN (
    'figurine_commercial',  -- 🎭 피규어 만들기
    'yarn_doll',            -- 🧸 손뜨개 인형
    'plush_hero',           -- 🦸 히어로 봉제인형
    'emoji_stickers',       -- 😊 이모지 스티커 세트
    'funko_pop'             -- 🎮 Funko Pop 피규어
);

-- ============================================
-- Step 2: Portrait Category (12개)
-- ============================================

-- Fashion Portrait (3개)
UPDATE prompt_templates
SET
    category = 'portrait',
    subcategory = 'fashion',
    updated_at = NOW()
WHERE template_key IN (
    'red_carpet',           -- 🌟 레드카펫 스타일
    'orange_fashion',       -- 🟠 오렌지 패션 화보
    'retro_lounge'          -- 🎷 레트로 라운지 스타일
);

-- Glamour Portrait (3개)
UPDATE prompt_templates
SET
    category = 'portrait',
    subcategory = 'glamour',
    updated_at = NOW()
WHERE template_key IN (
    'golden_vintage',       -- 🌅 골든아워 빈티지
    'hollywood_70s',        -- 🎬 70년대 헐리우드 스타
    'rose_romantic'         -- 🌹 로맨틱 로즈 스타일
);

-- Artistic Portrait (2개)
UPDATE prompt_templates
SET
    category = 'portrait',
    subcategory = 'artistic',
    updated_at = NOW()
WHERE template_key IN (
    'dramatic_bw',          -- ⚫ 드라마틱 흑백사진
    'soft_window_light'     -- ☀️ 창가의 부드러운 빛
);

-- Professional Portrait (3개)
UPDATE prompt_templates
SET
    category = 'portrait',
    subcategory = 'professional',
    updated_at = NOW()
WHERE template_key IN (
    'night_portrait_paris', -- 🌃 파리의 밤 인물사진
    'cinematic_suit',       -- 🎩 시네마틱 수트 스타일
    'bw_professional'       -- 📷 프로페셔널 흑백
);

-- ============================================
-- Step 3: Game & Anime Category (2개)
-- ============================================

UPDATE prompt_templates
SET
    category = 'game_anime',
    subcategory = 'game_style',
    updated_at = NOW()
WHERE template_key IN (
    'rhythm_game',          -- 🎮 리듬게임 캐릭터
    'pixel_16bit'           -- 👾 16비트 픽셀아트
);

-- ============================================
-- Step 4: Creative Transformations (10개)
-- ============================================

-- Photo Layout/Album (4개)
UPDATE prompt_templates
SET
    category = 'creative_transformations',
    subcategory = 'layout',
    updated_at = NOW()
WHERE template_key IN (
    'album_9_photos',       -- 📸 9장 앨범 생성
    'photo_strip_9',        -- 📷 9장 스티커 사진
    'polaroid_couple',      -- 💑 폴라로이드 커플
    'polaroid_family'       -- 👨‍👩‍👧‍👦 폴라로이드 가족
);

-- Style Transformation (4개)
UPDATE prompt_templates
SET
    category = 'creative_transformations',
    subcategory = 'style',
    updated_at = NOW()
WHERE template_key IN (
    'multi_merge',          -- 🎨 다중 이미지 합성
    'camera_angle',         -- 📐 카메라 앵글 변경
    '9part_superhero_story', -- 🦸 슈퍼히어로 9부작 스토리
    '_pencil_sketch_transformation' -- ✏️ 연필 스케치 변환
);

-- Fashion Styling (2개)
UPDATE prompt_templates
SET
    category = 'creative_transformations',
    subcategory = 'fashion',
    updated_at = NOW()
WHERE template_key IN (
    'outfit_swap',          -- 👔 의상 스타일 변경
    'outfit_styling'        -- 👗 의상 스타일링
);

-- ============================================
-- Step 5: Image Editing (실용 편집 - 13개)
-- ============================================

-- Background & Environment (2개)
UPDATE prompt_templates
SET
    category = 'image_editing',
    subcategory = 'background',
    updated_at = NOW()
WHERE template_key IN (
    'background_replace',   -- 🌍 배경 변경
    'season_change'         -- 🍂 계절 변경
);

-- Object Manipulation (4개)
UPDATE prompt_templates
SET
    category = 'image_editing',
    subcategory = 'object',
    updated_at = NOW()
WHERE template_key IN (
    'object_add',           -- ➕ 사물 추가
    'object_remove',        -- ➖ 사물 제거
    'text_edit',            -- ✏️ 텍스트 편집
    'clothing_extract'      -- 👗 의상 추출
);

-- Face & Appearance (4개)
UPDATE prompt_templates
SET
    category = 'image_editing',
    subcategory = 'appearance',
    updated_at = NOW()
WHERE template_key IN (
    'expression_change',    -- 😊 표정 변경
    'hairstyle_change',     -- 💇 헤어스타일 변경
    'makeup_styling',       -- 💄 메이크업 스타일
    'muscular_transform'    -- 💪 근육질 변신
);

-- Clothing (2개 - clothing_change는 is_active=false라서 제외)
UPDATE prompt_templates
SET
    category = 'image_editing',
    subcategory = 'fashion',
    updated_at = NOW()
WHERE template_key = 'clothing_change'; -- 👕 의상만 변경 (비활성화)

-- Quality Enhancement (3개)
UPDATE prompt_templates
SET
    category = 'image_editing',
    subcategory = 'enhancement',
    updated_at = NOW()
WHERE template_key IN (
    'quality_enhance',      -- ✨ 화질 개선
    'photo_restore',        -- 🔧 사진 복원
    'time_season_change'    -- 🌅 시간대/계절 변경
);

-- ============================================
-- Step 6: NSFW Category (이미 분류됨 - 확인만)
-- ============================================

-- 이미 NSFW로 분류된 템플릿들 확인
SELECT template_key, template_name_ko, category, subcategory
FROM prompt_templates
WHERE category = 'nsfw'
ORDER BY template_key;

-- Expected: elegant_saree, _glamorous_studio_portrait, nurse_concept_portrait,
--           stewardess_fantasy_transformation, maid_concept_portrait,
--           captivating_nurse_style, midnight_flight_stewardess

-- ============================================
-- Step 7: Verify Results
-- ============================================

-- 카테고리별 분포 확인
SELECT
    category,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_active = true) as active,
    COUNT(*) FILTER (WHERE template_type = 'parameterized') as parameterized
FROM prompt_templates
GROUP BY category
ORDER BY
    CASE category
        WHEN '3d_figure' THEN 1
        WHEN 'portrait' THEN 2
        WHEN 'game_anime' THEN 3
        WHEN 'image_editing' THEN 4
        WHEN 'creative_transformations' THEN 5
        WHEN 'nsfw' THEN 6
    END;

-- 서브카테고리별 상세 분포
SELECT
    category,
    subcategory,
    COUNT(*) as count,
    string_agg(template_key, ', ' ORDER BY template_key) as templates
FROM prompt_templates
WHERE is_active = true
GROUP BY category, subcategory
ORDER BY category, subcategory;

-- 잘못된 카테고리 확인 (없어야 함)
SELECT template_key, category
FROM prompt_templates
WHERE category NOT IN ('3d_figure', 'portrait', 'game_anime', 'image_editing', 'creative_transformations', 'nsfw');

-- ============================================
-- Expected Final Distribution
-- ============================================

-- 3d_figure: 5개 (character)
-- portrait: 12개 (fashion: 3, glamour: 3, artistic: 2, professional: 3)
-- game_anime: 2개 (game_style)
-- image_editing: 13개 (background: 2, object: 4, appearance: 4, fashion: 1, enhancement: 3)
-- creative_transformations: 10개 (layout: 4, style: 4, fashion: 2)
-- nsfw: 7개 (별도 관리)

-- TOTAL: 49개 템플릿

-- ============================================
-- End of Re-categorization
-- ============================================
