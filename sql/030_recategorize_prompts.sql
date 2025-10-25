-- ============================================
-- Prompt Templates Re-categorization
-- ============================================
-- Purpose: Re-organize 38 templates into new 6-category structure
-- Created: 2025-01-10
-- Categories: 3d_figure, portrait, game_anime, image_editing, creative_transformations, nsfw

-- ============================================
-- Current Categories (OLD)
-- ============================================
-- - 3d_figurine (5개)
-- - portrait_styling (12개)
-- - image_editing (16개)
-- - game_animation (2개)
-- - creative_transform (3개)

-- ============================================
-- New Categories (6개)
-- ============================================
-- 1. 3d_figure: 3D 캐릭터 및 피규어 변환
-- 2. portrait: 인물 사진 및 초상화
-- 3. game_anime: 게임 및 애니메이션 스타일
-- 4. image_editing: 범용 이미지 편집
-- 5. creative_transformations: 창의적 변환 및 아트워크
-- 6. nsfw: 성인 전용 콘텐츠 (이미 분류됨)

-- ============================================
-- Step 1: 3D Figure (5개)
-- ============================================
-- 기존 3d_figurine → 3d_figure 변경

UPDATE prompt_templates
SET
    category = '3d_figure',
    subcategory = 'character',
    updated_at = NOW()
WHERE template_key IN (
    'figurine_commercial',  -- 🧸 고급 피규어 스타일
    'yarn_doll',            -- 🧶 실 인형 스타일
    'plush_hero',           -- 🦸 봉제인형 영웅
    'emoji_stickers',       -- 😊 이모지 스티커 세트
    'funko_pop'             -- 🎁 펑코팝 피규어
);

-- ============================================
-- Step 2: Portrait (인물 사진 - 12개)
-- ============================================
-- 기존 portrait_styling → portrait

-- 서브카테고리별 분류:
-- - fashion: 패션/스타일 중심
-- - glamour: 화려한/우아한 컨셉
-- - artistic: 예술적 표현
-- - professional: 전문 촬영

-- Fashion 포트레이트 (4개)
UPDATE prompt_templates
SET
    category = 'portrait',
    subcategory = 'fashion',
    updated_at = NOW()
WHERE template_key IN (
    'red_carpet',           -- 🌟 레드카펫 스타 (패션 이벤트)
    'orange_fashion',       -- 🍊 오렌지 패션 포트레이트
    'retro_lounge'          -- 🎶 레트로 라운지 스타일
);

-- Glamour 포트레이트 (4개)
UPDATE prompt_templates
SET
    category = 'portrait',
    subcategory = 'glamour',
    updated_at = NOW()
WHERE template_key IN (
    'elegant_saree',        -- 🎭 우아한 전통의상 (화려함)
    'golden_vintage',       -- ✨ 골든 빈티지 포트레이트
    'hollywood_70s',        -- 🎬 70년대 헐리우드 (글래머)
    'rose_romantic'         -- 🌹 로맨틱 장미 초상화
);

-- Artistic 포트레이트 (2개)
UPDATE prompt_templates
SET
    category = 'portrait',
    subcategory = 'artistic',
    updated_at = NOW()
WHERE template_key IN (
    'dramatic_bw',          -- 🎭 드라마틱 흑백 (예술적 표현)
    'soft_window_light'     -- 💡 부드러운 창가 빛 (예술적 조명)
);

-- Professional/Cinematic 포트레이트 (3개)
UPDATE prompt_templates
SET
    category = 'portrait',
    subcategory = 'professional',
    updated_at = NOW()
WHERE template_key IN (
    'night_portrait_paris', -- 🌃 파리의 밤 (전문적 배경)
    'cinematic_suit',       -- 👔 영화같은 정장 초상화
    'bw_professional'       -- 📸 전문가 흑백 사진
);

-- ============================================
-- Step 3: Game & Anime (2개)
-- ============================================
-- 기존 game_animation → game_anime

UPDATE prompt_templates
SET
    category = 'game_anime',
    subcategory = 'game_style',
    updated_at = NOW()
WHERE template_key IN (
    'rhythm_game',          -- 🎮 리듬게임 캐릭터
    'pixel_16bit'           -- 👾 16비트 픽셀 캐릭터
);

-- ============================================
-- Step 4: Image Editing (범용 편집 - 11개)
-- ============================================
-- 실용적인 편집 기능들

-- Background/Environment (2개)
UPDATE prompt_templates
SET
    category = 'image_editing',
    subcategory = 'background',
    updated_at = NOW()
WHERE template_key IN (
    'background_replace',   -- 🌄 배경 변경 (Parameterized)
    'season_change'         -- 🍂 계절 변경
);

-- Object Editing (3개)
UPDATE prompt_templates
SET
    category = 'image_editing',
    subcategory = 'object',
    updated_at = NOW()
WHERE template_key IN (
    'object_add',           -- ➕ 물체 추가
    'object_remove',        -- ➖ 물체 제거
    'text_edit'             -- ✏️ 텍스트 수정
);

-- Appearance Editing (4개)
UPDATE prompt_templates
SET
    category = 'image_editing',
    subcategory = 'appearance',
    updated_at = NOW()
WHERE template_key IN (
    'clothing_change',      -- 👕 의상만 변경 (→ Parameterized 전환 예정)
    'hairstyle_change',     -- 💇 헤어스타일 변경 (→ Parameterized 전환 예정)
    'expression_change',    -- 😊 표정 변경 (Parameterized)
    'muscular_transform'    -- 💪 근육질 변환
);

-- Technical Enhancement (2개)
UPDATE prompt_templates
SET
    category = 'image_editing',
    subcategory = 'enhancement',
    updated_at = NOW()
WHERE template_key IN (
    'quality_enhance',      -- ⬆️ 화질 향상
    'photo_restore'         -- 🔧 오래된 사진 복원
);

-- ============================================
-- Step 5: Creative Transformations (창의적 변환 - 7개)
-- ============================================
-- 예술적이고 창의적인 변환

-- Multi-photo Layouts (4개)
UPDATE prompt_templates
SET
    category = 'creative_transformations',
    subcategory = 'layout',
    updated_at = NOW()
WHERE template_key IN (
    'album_9_photos',       -- 📸 9장 앨범 레이아웃
    'photo_strip_9',        -- 📷 포토스트립 9컷
    'polaroid_couple',      -- 💑 폴라로이드 커플
    'polaroid_family'       -- 👨‍👩‍👧‍👦 폴라로이드 가족
);

-- Style Transformations (3개)
UPDATE prompt_templates
SET
    category = 'creative_transformations',
    subcategory = 'style',
    updated_at = NOW()
WHERE template_key IN (
    'multi_merge',          -- 🎨 여러 이미지 합성
    'outfit_styling',       -- 👗 의상 스타일링 (Parameterized)
    'camera_angle'          -- 📐 카메라 앵글 변경
);

-- Outfit Swap (의상 교체 - 특별 처리)
-- 문제: 현재 2장 요구하나 실제 1장만 받음 → 임시로 creative로 분류
UPDATE prompt_templates
SET
    category = 'creative_transformations',
    subcategory = 'style',
    updated_at = NOW()
WHERE template_key = 'outfit_swap';  -- 👔 의상 교체 (수정 필요)

-- Clothing Extract (옷 추출 - 특수 기능)
UPDATE prompt_templates
SET
    category = 'image_editing',
    subcategory = 'object',
    updated_at = NOW()
WHERE template_key = 'clothing_extract';  -- 👚 의상만 추출

-- ============================================
-- Step 6: Verify Category Distribution
-- ============================================

-- Check final distribution
SELECT
    category,
    subcategory,
    COUNT(*) as template_count,
    COUNT(*) FILTER (WHERE is_active = true) as active_count,
    string_agg(template_key, ', ' ORDER BY template_key) as templates
FROM prompt_templates
WHERE category != 'nsfw'  -- NSFW는 별도 확인
GROUP BY category, subcategory
ORDER BY category, subcategory;

-- Check NSFW category separately
SELECT
    'nsfw' as category,
    subcategory,
    COUNT(*) as template_count,
    string_agg(template_key, ', ' ORDER BY template_key) as templates
FROM prompt_templates
WHERE category = 'nsfw'
GROUP BY subcategory;

-- ============================================
-- Step 7: Summary Statistics
-- ============================================

-- Final category counts
SELECT
    category,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE template_type = 'fixed') as fixed,
    COUNT(*) FILTER (WHERE template_type = 'parameterized') as parameterized,
    COUNT(*) FILTER (WHERE is_active = true) as active
FROM prompt_templates
GROUP BY category
ORDER BY total DESC;

-- ============================================
-- Step 8: Validate All Templates Have Valid Categories
-- ============================================

-- Should return 0 rows
SELECT template_key, category, subcategory
FROM prompt_templates
WHERE category NOT IN ('3d_figure', 'portrait', 'game_anime', 'image_editing', 'creative_transformations', 'nsfw')
   OR category IS NULL;

-- ============================================
-- Notes & Next Steps
-- ============================================

-- 📝 재분류 요약:
-- - 3d_figure: 5개 (character)
-- - portrait: 12개 (fashion: 3개, glamour: 4개, artistic: 2개, professional: 3개)
-- - game_anime: 2개 (game_style)
-- - image_editing: 11개 (background: 2, object: 4, appearance: 4, enhancement: 2)
-- - creative_transformations: 7개 (layout: 4, style: 3)
-- - nsfw: 별도 관리 (자동 분류된 템플릿)

-- 🔧 개선 필요 항목:
-- 1. outfit_swap: 이미지 개수 불일치 수정 필요 (min/max_images = 1로 변경)
-- 2. clothing_change, hairstyle_change: max_images를 1로 수정
-- 3. elegant_saree: 한글 이름 변경 고려 ("우아한 전통의상 스타일")

-- ============================================
-- End of Re-categorization
-- ============================================
