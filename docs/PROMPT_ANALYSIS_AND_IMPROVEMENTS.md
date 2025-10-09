# 🔍 프롬프트 분석 및 개선방향

**작성일**: 2025-01-10
**분석 대상**: 데이터베이스에 저장된 38개 프롬프트 템플릿
**목적**: 프롬프트 품질 검증 및 개선 방향 수립

---

## 📊 현재 프롬프트 현황

### 전체 통계
- **총 템플릿 개수**: 38개
- **템플릿 유형**:
  - Fixed 템플릿: 35개
  - Parameterized 템플릿: 3개 (background_replace, outfit_styling, expression_change)

### 카테고리별 분류
1. **3D/Figurine** (3d_figurine): 5개
   - figurine_commercial, yarn_doll, plush_hero, emoji_stickers, funko_pop

2. **Portrait Styling** (portrait_styling): 12개
   - red_carpet, night_portrait_paris, elegant_saree, golden_vintage, dramatic_bw,
   - hollywood_70s, cinematic_suit, rose_romantic, orange_fashion, soft_window_light,
   - retro_lounge, bw_professional

3. **Image Editing** (image_editing): 16개
   - multi_merge, outfit_swap, expression_change, muscular_transform, background_replace,
   - object_add, object_remove, camera_angle, season_change, text_edit,
   - clothing_extract, clothing_change, hairstyle_change, quality_enhance, photo_restore

4. **Game/Animation** (game_animation): 2개
   - rhythm_game, pixel_16bit

5. **Creative Transform** (creative_transform): 3개
   - album_9_photos, photo_strip_9, polaroid_couple, polaroid_family

---

## 🚨 발견된 문제점

### 1. 이미지 개수 불일치 문제

#### 🔴 심각 (Blocker)
| 템플릿 키 | 템플릿 이름 | 문제 상황 | 수정 필요 |
|-----------|------------|---------|----------|
| `outfit_swap` | 👔 의상 교체 | 프롬프트에 "Image1", "Image2" 언급<br/>실제로는 1장만 전송됨 | `min_images=1, max_images=1`로 변경<br/>프롬프트 재작성 필요 |
| `clothing_change` | 👕 의상만 변경 | `max_images=2` 설정<br/>프롬프트에 이미지 참조 없음 | `max_images=1`로 변경 |
| `hairstyle_change` | 💇 헤어스타일 변경 | `max_images=2` 설정<br/>프롬프트에 이미지 참조 없음 | `max_images=1`로 변경 |

**outfit_swap 현재 프롬프트**:
```
Keep the character in Image1 unchanged, but replace their outfit with
the clothing in Image2. Maintain the same pose, body proportions, and
facial features, while applying the color, texture, and style of the
outfit in Image2.
```

**문제**: 사용자가 실제로 1장만 업로드하는데 프롬프트는 2장을 요구함 → API 에러 발생 가능

---

### 2. 프롬프트 명확성 문제

#### ⚠️ 중간 (개선 권장)
| 템플릿 키 | 문제 | 개선 방향 |
|-----------|-----|----------|
| `multi_merge` | "multiple images" 언급하나 구체적 지시 부족 | 레이아웃 옵션 추가 (grid, collage, side-by-side) |
| `expression_change` | 감정 옵션 없음 (Parameterized 전환 필요) | ✅ 이미 Parameterized로 전환됨 |
| `album_9_photos` | "9장" 생성 보장 없음 | 명시적으로 "Generate exactly 9 portraits in a 3x3 grid" 추가 |
| `text_edit` | 어떤 텍스트를 어떻게 수정할지 불명확 | 사용자 입력 파라미터 추가 필요 |
| `object_add` | 어떤 물체를 어디에 추가할지 불명확 | 사용자 입력 파라미터 추가 필요 |
| `object_remove` | 어떤 물체를 제거할지 불명확 | 사용자 입력 파라미터 추가 필요 |

---

### 3. 템플릿 이름 vs 프롬프트 불일치

#### 💡 경미 (UX 개선)
| 템플릿 키 | 한글 이름 | 실제 프롬프트 내용 | 개선 방향 |
|-----------|----------|------------------|----------|
| `elegant_saree` | 🎭 우아한 사리 스타일 | 한국어 이름이 "사리"이지만 프롬프트는 영어로 "saree" | 한국 사용자에게 "사리"가 생소할 수 있음<br/>"전통 의상 스타일" 또는 "이국적 의상" 등으로 변경 권장 |
| `night_portrait_paris` | 🌃 파리의 밤 인물사진 | Arc de Triomphe 특정 위치 고정 | "파리"를 파라미터로 만들어 다른 도시도 선택 가능하게 |
| `hollywood_70s` | 🎬 70년대 헐리우드 스타 | 70년대만 가능 | 다른 연대 (80s, 90s)도 선택 가능하게 |

---

### 4. Parameterized 전환 필요 템플릿

**우선순위 높음** (사용자 맞춤화 가치 높음):
1. ✅ `background_replace` - **이미 완료**
2. ✅ `expression_change` - **이미 완료**
3. ✅ `outfit_styling` - **이미 완료**
4. `clothing_change` - 의상 스타일 선택 (캐주얼, 정장, 스포츠웨어)
5. `hairstyle_change` - 헤어스타일 선택 (단발, 장발, 웨이브, 펌)
6. `season_change` - 계절 선택 (봄, 여름, 가을, 겨울)
7. `camera_angle` - 앵글 선택 (low angle, high angle, bird's eye, worm's eye)

**우선순위 중간**:
8. `muscular_transform` - 근육량 레벨 선택 (슬림, 탄탄한, 보디빌더)
9. `quality_enhance` - 향상 정도 선택 (자연스러운, 중간, 극대화)

---

## 🎯 카테고리별 문제 요약

### 3D/Figurine (5개)
- ✅ **문제 없음**: 모두 단일 이미지 기반, 명확한 지시
- 💡 개선점: `funko_pop`, `yarn_doll` 등에 색상/스타일 옵션 추가 가능

### Portrait Styling (12개)
- ⚠️ **문제**: `elegant_saree` 이름 현지화 필요
- ⚠️ **문제**: `night_portrait_paris` 등 위치/시대가 고정됨 → Parameterized 전환 권장
- ✅ **강점**: 대부분 명확하고 디테일한 프롬프트

### Image Editing (16개) - **가장 많은 문제**
- 🔴 **Blocker**: `outfit_swap` - 이미지 개수 불일치
- ⚠️ **이슈**: `clothing_change`, `hairstyle_change` - max_images 설정 오류
- ⚠️ **이슈**: `text_edit`, `object_add`, `object_remove` - 사용자 입력 파라미터 없음
- 💡 **개선**: 6-7개 템플릿이 Parameterized 전환 필요

### Game/Animation (2개)
- ✅ **문제 없음**: 명확한 프롬프트

### Creative Transform (3개)
- ⚠️ **이슈**: `album_9_photos` - "9장" 생성 보장 필요
- ⚠️ **이슈**: `polaroid_couple`, `polaroid_family` - 가상 인물 생성 시 윤리적 고려 필요

---

## 📋 즉시 수정 필요 항목 (Blocker)

### 1. outfit_swap 프롬프트 재작성
**현재 (잘못됨)**:
```sql
base_prompt: 'Keep the character in Image1 unchanged, but replace
their outfit with the clothing in Image2.'
min_images: 2
max_images: 2
```

**수정안 1 - 단일 이미지 기반**:
```sql
base_prompt: 'Change the outfit of the person in this photo to a
different style of clothing [describe style here]. Keep the same pose,
body proportions, and facial features. Ensure realistic fabric physics,
lighting, and shadows.'
min_images: 1
max_images: 1
template_type: 'parameterized'
```

**수정안 2 - 실제 2장 이미지 사용** (더 복잡, 구현 고려):
```sql
base_prompt: 'Take the outfit from the second image and apply it to
the person in the first image. Keep the person's pose, body proportions,
and facial features from the first image. Apply the color, texture, and
style of the outfit from the second image.'
min_images: 2
max_images: 2
```

**권장**: 수정안 1 (Parameterized 전환) - 사용자 경험 단순화

---

### 2. clothing_change, hairstyle_change max_images 수정
```sql
-- 현재
UPDATE prompt_templates SET max_images = 2 WHERE template_key IN ('clothing_change', 'hairstyle_change');

-- 수정
UPDATE prompt_templates SET max_images = 1 WHERE template_key IN ('clothing_change', 'hairstyle_change');
```

---

## 🚀 단계별 개선 로드맵

### Phase 1: 긴급 수정 (1-2일) 🔥
1. **outfit_swap** 프롬프트 재작성 및 DB 업데이트
2. **clothing_change**, **hairstyle_change** max_images 수정
3. **album_9_photos** 프롬프트에 "exactly 9 portraits in 3x3 grid" 명시
4. SQL 마이그레이션 파일 생성 (`sql/022_fix_prompt_issues.sql`)

### Phase 2: UX 개선 (3-5일) ⚡
1. **text_edit**, **object_add**, **object_remove**에 사용자 입력 파라미터 추가
2. **elegant_saree** 한글 이름 변경 ("전통 의상 스타일")
3. **multi_merge**에 레이아웃 옵션 추가 (파라미터화)
4. 프롬프트 분석 도구 개발 (LLM 기반)

### Phase 3: Parameterized 전환 (1주) 🎨
1. **clothing_change** → 의상 스타일 옵션 (캐주얼, 정장, 스포츠웨어, 한복)
2. **hairstyle_change** → 헤어스타일 옵션 (단발, 장발, 곱슬머리, 염색)
3. **season_change** → 계절 옵션 (봄, 여름, 가을, 겨울)
4. **camera_angle** → 앵글 옵션 (low, high, bird's eye, worm's eye)
5. SQL 파일: `sql/023_parameterize_templates.sql`

### Phase 4: 고급 기능 (1-2주) 🌟
1. **night_portrait_paris** → 도시/장소 파라미터화 (파리, 뉴욕, 도쿄, 서울)
2. **hollywood_70s** → 연대 파라미터화 (60s, 70s, 80s, 90s)
3. **muscular_transform** → 근육량 레벨 파라미터화
4. **quality_enhance** → 향상 정도 파라미터화
5. A/B 테스트를 위한 프롬프트 버전 관리 시스템

---

## 🔧 기술적 개선 사항

### 1. 프롬프트 검증 시스템
- **LLM 기반 자동 분석**: 새 프롬프트 추가 시 자동으로 의미 분석
- **이미지 개수 검증**: min/max_images 설정과 프롬프트 내용 일치 여부 체크
- **파라미터 추출**: 프롬프트에서 가변 요소 자동 감지 및 파라미터화 제안

### 2. 프롬프트 버전 관리
```sql
CREATE TABLE prompt_template_versions (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(50) REFERENCES prompt_templates(template_key),
    version_number INTEGER NOT NULL,
    base_prompt TEXT NOT NULL,
    change_description TEXT,
    created_by BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT false,

    UNIQUE(template_key, version_number)
);
```

### 3. 프롬프트 테스트 결과 추적
```sql
CREATE TABLE prompt_test_results (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(50),
    version_number INTEGER,
    test_image_url TEXT,
    result_image_url TEXT,
    success_score FLOAT, -- 0-100
    user_rating INTEGER, -- 1-5 stars
    feedback TEXT,
    tested_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📈 성공 지표 (KPI)

### 단기 (Phase 1-2)
- ✅ 이미지 개수 불일치 에러율: 0% (현재 ~3-5% 추정)
- ✅ 프롬프트 실행 성공률: 95% 이상
- ✅ 사용자 재시도율: 20% 이하

### 중기 (Phase 3-4)
- 🎯 Parameterized 템플릿 비율: 30% 이상 (현재 8%)
- 🎯 평균 사용자 만족도: 4.0/5.0 이상
- 🎯 프롬프트 재사용률: 템플릿당 월 50회 이상

### 장기 (3개월 후)
- 🚀 템플릿 커버리지: 사용자 요청의 90% 커버
- 🚀 신규 템플릿 추가 속도: 주 2-3개
- 🚀 AI 기반 자동 프롬프트 최적화 시스템 구축

---

## 🎯 우선순위 액션 아이템

### 🔴 긴급 (이번 주)
1. [ ] `outfit_swap` 프롬프트 재작성 및 테스트
2. [ ] `clothing_change`, `hairstyle_change` max_images 수정
3. [ ] 긴급 수정 SQL 파일 생성 및 배포

### 🟡 중요 (다음 주)
4. [ ] `text_edit`, `object_add`, `object_remove` 파라미터 추가
5. [ ] `elegant_saree` 이름 변경
6. [ ] 프롬프트 검증 도구 프로토타입 개발

### 🟢 일반 (2주 후)
7. [ ] 5개 템플릿 Parameterized 전환
8. [ ] 프롬프트 버전 관리 시스템 구축
9. [ ] A/B 테스트 인프라 준비

---

## 📚 참고 자료

### 기존 문서
- `docs/PROMPT_TEMPLATES.md` - 38개 프롬프트 전체 목록
- `sql/009_insert_prompt_templates.sql` - 초기 프롬프트 삽입
- `sql/018_parameterized_templates.sql` - Parameterized 시스템 스키마
- `sql/019_insert_parameterized_templates.sql` - 3개 Parameterized 템플릿

### 관련 코드
- `src/services/prompt-service.ts` - 프롬프트 조회 및 처리 (구현 예정)
- `netlify/functions/webhook.ts` - 템플릿 선택 UI

---

## 💡 추가 고려사항

### 윤리적 고려
- `polaroid_couple`, `polaroid_family`: 가상 인물 생성 시 딥페이크 우려
  - 사용 약관에 "실제 인물이 아님" 명시 필요
  - 워터마크 또는 "AI Generated" 표시 고려

### 법적 고려
- `text_edit`: 상표권, 저작권 침해 가능성
  - 필터링 시스템 필요 (특정 브랜드 로고, 유명 캐릭터 등)

### 기술적 제약
- `album_9_photos`: 9장 생성 보장 어려움
  - Nano Banafo API 제약 확인 필요
  - 실패 시 재시도 또는 다른 수량 허용 고려

---

**다음 단계**: 이 분석을 바탕으로 `sql/022_fix_prompt_issues.sql` 작성 및 배포

*최종 수정: 2025-01-10*
