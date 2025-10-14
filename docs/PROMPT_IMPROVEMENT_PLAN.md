# 🎨 프롬프트 개선 계획

## 📊 현재 상황 분석

### ✅ 기존 파라미터 템플릿 (3개)

| Template Key | 파라미터 | 옵션 수 | 상태 | 문제 |
|-------------|---------|---------|------|------|
| `background_replace` | `background_style` | 6개 | ✅ 정상 | 없음 |
| `outfit_styling` | `outfit_style` | 6개 | ✅ 정상 | **의상 변경 중복** |
| `expression_change` | `expression_type` | 5개 | ✅ 정상 | 없음 |

### ❌ 문제점 발견

#### **1. 의상 변경 템플릿 중복**

**현재 상황:**
- ✅ `outfit_styling` (Parameterized) - **정상 작동**
  - 6가지 의상 스타일 선택 가능
  - 정장, 캐주얼, 드레스, 스포츠웨어, 한복, 슈퍼히어로

- ❓ `clothing_change` (Fixed) - **009_insert_prompt_templates.sql**
  - 고정 프롬프트
  - "의상만 변경" 기능
  - **outfit_styling과 기능 중복!**

- ❓ `outfit_swap` (2-image) - **009_insert_prompt_templates.sql**
  - 2장 이미지 필요 (의상 교환)
  - 다른 용도이므로 유지 필요

**결론:**
- `clothing_change` 템플릿 **삭제** 또는 **비활성화** 필요
- `outfit_styling`으로 통합 (더 기능이 풍부함)

#### **2. 파라미터 옵션 부족**

| 카테고리 | 현재 옵션 수 | 요청 | 개선안 |
|---------|------------|------|--------|
| 배경 변경 | 6개 | ✅ 충분 | 2-3개 추가 |
| 의상 변경 | 6개 | 🟡 보통 | 3-4개 추가 |
| 표정 변경 | 5개 | 🟡 보통 | 2-3개 추가 |
| 헤어 변경 | ❌ 없음 | 🔴 **필요** | **신규 6-8개** |
| 메이크업 | ❌ 없음 | 🟡 선택 | 4-6개 |
| 시간대/계절 | ❌ 없음 | 🟡 선택 | 4개 |

---

## 🎯 개선 목표

### **Phase 1: 중복 제거 및 기존 확장** (1-2시간) 🔴 우선

1. ✅ `clothing_change` 템플릿 비활성화
2. ✅ 기존 파라미터 옵션 확장
   - 배경: 6개 → 9개 (+3)
   - 의상: 6개 → 10개 (+4)
   - 표정: 5개 → 8개 (+3)

### **Phase 2: 새 파라미터 템플릿 추가** (2-3시간) 🟡 중요

3. ✅ 헤어스타일 변경 (Hairstyle Change) - **NEW!**
4. ✅ 메이크업 변경 (Makeup Change) - **NEW!**
5. ✅ 시간대 변경 (Time of Day) - **NEW!**

### **Phase 3: 테스트 및 배포** (30분) 🟢 필수

6. ✅ SQL 실행 및 검증
7. ✅ 사용자 테스트
8. ✅ 배포

---

## 📋 Phase 1: 중복 제거 및 기존 확장

### **1.1. clothing_change 템플릿 비활성화**

```sql
-- 중복 템플릿 비활성화
UPDATE prompt_templates
SET is_active = false,
    updated_at = NOW()
WHERE template_key = 'clothing_change';
```

**이유:**
- `outfit_styling` 템플릿이 더 기능적
- 6가지 스타일 선택 가능
- 사용자 경험 향상

---

### **1.2. 배경 변경 (Background Replace) - 옵션 추가**

**기존 6개:**
1. 🏖️ 석양 해변 (Beach Sunset)
2. 🌃 도심 야경 (City Night)
3. 🌌 우주 은하 (Space Galaxy)
4. 🌳 판타지 숲 (Fantasy Forest)
5. ⚪ 화이트 스튜디오 (White Studio)
6. ☕ 아늑한 카페 (Cozy Cafe)

**추가 3개:**
7. 🏔️ **산 정상** (Mountain Peak)
   - `mountain_peak`
   - 높은 산 정상, 구름 위, 탁 트인 전망, 맑은 하늘

8. 🏰 **중세 성** (Medieval Castle)
   - `medieval_castle`
   - 웅장한 중세 성, 돌벽, 깃발, 역사적 분위기

9. 🌸 **벚꽃 정원** (Cherry Blossom Garden)
   - `cherry_blossom`
   - 만개한 벚꽃 나무, 분홍빛 꽃잎, 봄날의 로맨틱한 분위기

---

### **1.3. 의상 변경 (Outfit Styling) - 옵션 추가**

**기존 6개:**
1. 💼 비즈니스 정장 (Business Suit)
2. 👕 캐주얼 스트릿 (Casual Streetwear)
3. 👗 우아한 드레스 (Elegant Dress)
4. 🏃 스포츠웨어 (Sportswear)
5. 🎎 한복 (Traditional Hanbok)
6. 🦸 슈퍼히어로 (Superhero Costume)

**추가 4개:**
7. 🎩 **턱시도** (Tuxedo)
   - `formal_tuxedo`
   - 격식있는 턱시도, 보타이, 커머벌드, 정장 구두

8. 🎸 **로커 스타일** (Rocker Style)
   - `rocker_leather`
   - 가죽 재킷, 밴드 티셔츠, 찢어진 청바지, 부츠

9. 👔 **프로페셔널 캐주얼** (Business Casual)
   - `business_casual`
   - 옥스퍼드 셔츠, 치노 팬츠, 블레이저(선택), 로퍼

10. 🌴 **여름 리조트** (Summer Resort)
    - `summer_resort`
    - 하와이안 셔츠, 린넨 팬츠, 샌들, 선글라스

---

### **1.4. 표정 변경 (Expression Change) - 옵션 추가**

**기존 5개:**
1. 😄 밝게 웃는 (Happy Smile)
2. 😐 진지한 (Serious Professional)
3. 😏 신비로운 (Mysterious)
4. 😎 자신감 있는 (Confident)
5. 😜 장난스러운 (Playful)

**추가 3개:**
6. 😌 **평온한** (Calm & Peaceful)
   - `calm_peaceful`
   - 평온한 표정, 부드러운 눈빛, 릴렉스된 미소

7. 🤔 **사색하는** (Thoughtful)
   - `thoughtful_pensive`
   - 생각에 잠긴 표정, 먼 곳을 바라보는 눈빛, 진지한 분위기

8. 😊 **다정한** (Warm & Friendly)
   - `warm_friendly`
   - 따뜻한 미소, 친근한 눈빛, 다가가기 쉬운 표정

---

## 🆕 Phase 2: 새 파라미터 템플릿 추가

### **2.1. 헤어스타일 변경 (Hairstyle Change)** 🔥 **NEW!**

**Template Info:**
```sql
template_key: 'hairstyle_change'
template_name_ko: '💇 헤어스타일 변경'
template_name_en: 'Hairstyle Change'
category: 'image_editing'
subcategory: 'beauty'
type: 'parameterized'
```

**Base Prompt:**
```
Change the hairstyle of the person in this photo to {hairstyle_type}. Keep the face, expression, clothing, pose, and background exactly the same. Only modify the hair with natural texture, color, and styling. Ensure realistic hair physics, shine, and volume.
```

**파라미터 옵션 (8개):**

1. 💇‍♀️ **긴 생머리** (Long Straight)
   - `long_straight`
   - 허리까지 오는 긴 생머리, 윤기나는 검은색 또는 갈색

2. 🌀 **웨이브 펌** (Wavy Curls)
   - `wavy_curls`
   - 어깨까지 오는 웨이브 헤어, 자연스러운 볼륨

3. ✂️ **단발 보브** (Short Bob)
   - `short_bob`
   - 턱선까지 오는 단정한 보브컷, 매끈한 라인

4. 💈 **남성 언더컷** (Undercut)
   - `undercut`
   - 측면 짧게, 윗부분 길게, 뒤로 넘긴 스타일

5. 🎨 **컬러 염색** (Colored Hair)
   - `colored_vibrant`
   - 화려한 컬러 (핑크, 파란색, 보라색 등), 그라데이션

6. 🎀 **포니테일** (Ponytail)
   - `high_ponytail`
   - 높은 포니테일, 깔끔하고 활동적인 느낌

7. 👸 **엘레강트 업스타일** (Elegant Updo)
   - `elegant_updo`
   - 정교한 업스타일, 결혼식이나 파티용

8. 🦱 **아프로 곱슬** (Afro Curls)
   - `afro_curls`
   - 볼륨 있는 곱슬머리, 자연스러운 텍스처

---

### **2.2. 메이크업 변경 (Makeup Change)** 💄 **NEW!**

**Template Info:**
```sql
template_key: 'makeup_styling'
template_name_ko: '💄 메이크업 스타일'
template_name_en: 'Makeup Styling'
category: 'image_editing'
subcategory: 'beauty'
type: 'parameterized'
```

**Base Prompt:**
```
Apply {makeup_style} to the person's face in this photo. Keep the face shape, features, hair, clothing, and background exactly the same. Only change the makeup with realistic colors, blending, and professional application. Ensure natural skin texture and lighting.
```

**파라미터 옵션 (6개):**

1. ✨ **내추럴 메이크업** (Natural Look)
   - `natural_minimal`
   - 가볍고 자연스러운 메이크업, 누드톤, 은은한 립

2. 💋 **글램 메이크업** (Glamorous)
   - `glamorous_bold`
   - 스모키 아이, 볼드한 립스틱, 하이라이터, 화려함

3. 🌸 **로맨틱 메이크업** (Romantic Pink)
   - `romantic_pink`
   - 핑크톤 아이섀도, 코랄 블러셔, 핑크 립스틱

4. 🖤 **고딕 메이크업** (Gothic Dark)
   - `gothic_dark`
   - 다크 아이라이너, 블랙 립스틱, 창백한 파운데이션

5. 🎭 **무대 메이크업** (Stage Dramatic)
   - `stage_dramatic`
   - 진한 컨투어링, 극적인 아이 메이크업, 무대용

6. 🌟 **K-뷰티 글로우** (K-Beauty Glow)
   - `kbeauty_glow`
   - 촉촉한 피부, 자연스러운 광채, 그라데이션 립

---

### **2.3. 시간대/계절 변경 (Time & Season Change)** 🌅 **NEW!**

**Template Info:**
```sql
template_key: 'time_season_change'
template_name_ko: '🌅 시간대/계절 변경'
template_name_en: 'Time & Season Change'
category: 'image_editing'
subcategory: 'atmosphere'
type: 'parameterized'
```

**Base Prompt:**
```
Transform this photo to {time_season}. Adjust the lighting, colors, shadows, and atmosphere to match the selected time or season. Keep all subjects and composition the same, only change the ambient lighting and environmental mood.
```

**파라미터 옵션 (4개):**

1. 🌅 **황금 시간 (골든 아워)** (Golden Hour)
   - `golden_hour`
   - 따뜻한 황금빛 조명, 긴 그림자, 부드러운 빛

2. 🌃 **밤 / 야경** (Night Time)
   - `night_time`
   - 어두운 하늘, 인공 조명, 차가운 색조, 별빛

3. ❄️ **겨울 분위기** (Winter)
   - `winter_scene`
   - 차가운 푸른 톤, 눈 내리는 효과, 겨울 조명

4. 🌸 **봄 분위기** (Spring)
   - `spring_scene`
   - 밝고 화사한 색감, 벚꽃 효과, 따뜻한 햇살

---

## 📊 개선 후 비교

| 항목 | Before | After | 증가 |
|-----|--------|-------|------|
| **파라미터 템플릿 수** | 3개 | 6개 | **+100%** |
| **총 파라미터 옵션 수** | 17개 | 47개 | **+176%** |
| **배경 옵션** | 6개 | 9개 | +50% |
| **의상 옵션** | 6개 | 10개 | +67% |
| **표정 옵션** | 5개 | 8개 | +60% |
| **헤어 옵션** | 0개 | 8개 | **NEW!** |
| **메이크업 옵션** | 0개 | 6개 | **NEW!** |
| **시간/계절 옵션** | 0개 | 4개 | **NEW!** |
| **중복 템플릿** | 1개 | 0개 | **해결!** |

---

## 🚀 실행 계획

### **Step 1: SQL 스크립트 작성** (1시간)

파일: `sql/027_prompt_improvements.sql`

```sql
-- Part 1: 중복 템플릿 제거
-- Part 2: 기존 옵션 확장 (배경 +3, 의상 +4, 표정 +3)
-- Part 3: 새 템플릿 추가 (헤어, 메이크업, 시간/계절)
```

### **Step 2: 테스트** (30분)

1. Supabase SQL Editor 실행
2. 각 템플릿 확인
3. 파라미터 옵션 버튼 확인
4. 실제 이미지 편집 테스트

### **Step 3: 배포** (10분)

1. Git 커밋
2. Render.com 배포
3. 프로덕션 검증

---

## 💡 추가 개선 아이디어 (향후)

### **Phase 3 (선택 사항):**

1. **연령 변경** (Age Change)
   - 어린이 → 청소년 → 성인 → 노년

2. **성별 변환** (Gender Swap)
   - 남성 ↔ 여성 스타일 변환

3. **예술 스타일** (Art Style)
   - 유화, 수채화, 연필 스케치 등

4. **감정 변경** (Emotion Change)
   - 기쁨, 슬픔, 분노, 놀람 등

---

## 📋 체크리스트

### Phase 1: 중복 제거 및 확장
- [ ] `clothing_change` 비활성화
- [ ] 배경 옵션 3개 추가
- [ ] 의상 옵션 4개 추가
- [ ] 표정 옵션 3개 추가

### Phase 2: 새 템플릿 추가
- [ ] 헤어스타일 변경 템플릿 (8옵션)
- [ ] 메이크업 스타일 템플릿 (6옵션)
- [ ] 시간/계절 변경 템플릿 (4옵션)

### Phase 3: 테스트 & 배포
- [ ] SQL 실행 검증
- [ ] UI/UX 테스트
- [ ] 이미지 편집 품질 확인
- [ ] Git 커밋 & 배포

---

## 🎯 예상 효과

### **사용자 경험:**
- ✅ 중복 제거로 혼란 감소
- ✅ 다양한 옵션으로 만족도 증가
- ✅ 파라미터 선택의 재미 증가

### **비즈니스:**
- ✅ 사용자 체류 시간 증가
- ✅ 반복 사용률 증가
- ✅ 입소문 효과 (더 많은 기능)

### **기술:**
- ✅ 확장 가능한 구조 유지
- ✅ 일관된 프롬프트 품질
- ✅ 유지보수 용이

---

*작성일: 2025-01-10*
*예상 소요 시간: 2-3시간*
*우선순위: 🔴 높음*

**준비 완료! 🎨 Let's improve!**
