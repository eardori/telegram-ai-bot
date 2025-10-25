# 🔄 프롬프트 재분류 요약

## 📊 현재 문제점

### 1. DB 카테고리와 코드 불일치
| 코드 (webhook.ts) | DB (실제) | 상태 |
|------------------|-----------|------|
| `3d_figurine` | `3d_figure` | ❌ 불일치 |
| `portrait_styling` | `portrait` | ❌ 불일치 |
| `game_animation` | `game_anime` | ❌ 불일치 |
| `image_editing` | `image_editing` | ✅ 일치 |
| `creative_transform` | `creative_transformations` | ❌ 불일치 |
| ❌ 없음 | `nsfw` | ❌ 메뉴에 없음! |

### 2. 템플릿 분포 문제
- 현재: **36개가 `image_editing`에 몰려있음**
- 목표: 6개 카테고리로 균형있게 분산

---

## ✅ 해결 방법

### Option A: SQL만 수정 (DB → 코드 맞춤) ⭐ 추천
**장점:** 코드 수정 불필요, 빠른 적용
**단점:** 카테고리 이름이 직관적이지 않음

```sql
-- SQL에서 코드의 카테고리명으로 변경
UPDATE prompt_templates SET category = '3d_figurine' WHERE category = '3d_figure';
UPDATE prompt_templates SET category = 'portrait_styling' WHERE ...;
UPDATE prompt_templates SET category = 'game_animation' WHERE ...;
UPDATE prompt_templates SET category = 'creative_transform' WHERE ...;
```

### Option B: 코드 + SQL 모두 수정 (정석)
**장점:** 깔끔한 카테고리명, 확장성 좋음
**단점:** 코드 빌드 + 배포 필요

```typescript
// webhook.ts 수정
keyboard.text('3D/피규어', `cat:3d_figure:${fileKey}`).row();
keyboard.text('인물 스타일', `cat:portrait:${fileKey}`).row();
keyboard.text('게임/애니메이션', `cat:game_anime:${fileKey}`).row();
keyboard.text('이미지 편집', `cat:image_editing:${fileKey}`).row();
keyboard.text('창의적 변환', `cat:creative_transformations:${fileKey}`).row();
keyboard.text('🔞 성인 전용', `cat:nsfw:${fileKey}`).row(); // NEW!
```

---

## 📋 최종 재분류 계획 (Option B 기준)

### 1. 3d_figure (5개)
- figurine_commercial, yarn_doll, plush_hero, emoji_stickers, funko_pop

### 2. portrait (12개)
- **fashion** (3): red_carpet, orange_fashion, retro_lounge
- **glamour** (3): golden_vintage, hollywood_70s, rose_romantic
- **artistic** (2): dramatic_bw, soft_window_light
- **professional** (3): night_portrait_paris, cinematic_suit, bw_professional

### 3. game_anime (2개)
- rhythm_game, pixel_16bit

### 4. image_editing (13개)
- **background** (2): background_replace, season_change
- **object** (4): object_add, object_remove, text_edit, clothing_extract
- **appearance** (4): expression_change, hairstyle_change, makeup_styling, muscular_transform
- **fashion** (1): clothing_change (비활성화)
- **enhancement** (3): quality_enhance, photo_restore, time_season_change

### 5. creative_transformations (10개)
- **layout** (4): album_9_photos, photo_strip_9, polaroid_couple, polaroid_family
- **style** (4): multi_merge, camera_angle, 9part_superhero_story, _pencil_sketch_transformation
- **fashion** (2): outfit_swap, outfit_styling

### 6. nsfw (7개) ⭐ NEW
- elegant_saree, _glamorous_studio_portrait, nurse_concept_portrait
- stewardess_fantasy_transformation, maid_concept_portrait
- captivating_nurse_style, midnight_flight_stewardess

**총 49개 템플릿**

---

## 🚀 실행 순서

### Option A (빠른 수정):
1. `sql/030_recategorize_to_legacy_names.sql` 실행
2. 카테고리 메뉴에 NSFW 추가하는 코드만 수정

### Option B (정석) ⭐ 추천:
1. `sql/030_recategorize_prompts_fixed.sql` 실행
2. `webhook.ts` 카테고리 핸들러 수정 (6곳)
3. i18n 메시지 확인 (`categoryNSFW` 이미 있음)
4. 빌드 + 배포

---

## 🔍 수정이 필요한 코드 위치

### webhook.ts에서 수정 필요 (총 6곳):

1. **Line 2348-2352**: `back_to_main` 핸들러의 카테고리 버튼
2. **Line 2380-2384**: `back_to_categories` 핸들러의 카테고리 버튼
3. **Line 1060-1084**: 초기 이미지 분석 후 카테고리 버튼
4. **카테고리 핸들러**: `bot.callbackQuery(/^cat:(.+):(.+)$/)`에서 카테고리 필터링

---

## ⚠️ 주의사항

1. **NSFW 카테고리는 동의 플로우가 있어야 함**
   - 이미 구현됨 (`nsfw-consent-handler.ts`)
   - 카테고리 선택 시 동의 확인 필요

2. **카테고리 변경 시 URL 검증 필요**
   - `cat:nsfw:xxx` 호출 시 동의 체크

3. **i18n 확인**
   - `messages.ts`에 `categoryNSFW: '🔞 성인 전용'` 이미 있음
   - 영어: '🔞 Adult Content'

---

*작성일: 2025-01-10*
