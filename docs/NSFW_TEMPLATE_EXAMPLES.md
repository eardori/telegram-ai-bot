# NSFW Template Examples

## 📋 Phase 2: NSFW 템플릿 추가 가이드

이 문서는 `/admin prompt:add` 명령어로 NSFW 템플릿을 추가할 때 사용할 예시 프롬프트입니다.

---

## 🔞 Example 1: Glamour Portrait (글래머 포트레이트)

**사용할 프롬프트:**
```
Transform this photo into a glamorous portrait with professional studio lighting. The subject should have elegant styling, sophisticated makeup, and be wearing elegant evening attire. Maintain natural facial features and realistic proportions. Studio quality, high fashion photography style, dramatic lighting, elegant pose.
```

**예상 결과:**
- **카테고리**: image_editing
- **템플릿 타입**: fixed (고정형)
- **requires_nsfw_api**: true
- **requires_face**: true
- **한국어 제목 제안**: "💃 글래머 포트레이트"

---

## 🔞 Example 2: Fashion Model Transformation (패션 모델 변환)

**사용할 프롬프트:**
```
Transform this person into a high-fashion runway model. Professional fashion photography with editorial styling, confident pose, trendy contemporary fashion, studio lighting setup. Maintain realistic proportions and facial features. Magazine cover quality, vogue style photography.
```

**예상 결과:**
- **카테고리**: creative_transformations
- **템플릿 타입**: fixed
- **requires_nsfw_api**: true
- **requires_face**: true
- **한국어 제목**: "👗 패션 모델 변환"

---

## 🔞 Example 3: Beach Photoshoot (비치 포토슈트)

**사용할 프롬프트:**
```
Transform this photo into a professional beach photoshoot scene. Subject wearing stylish beachwear, golden hour lighting, tropical beach background with ocean waves, natural relaxed pose. Professional photography quality, vacation aesthetic, sunset lighting, sand and water backdrop.
```

**예상 결과:**
- **카테고리**: image_editing
- **템플릿 타입**: fixed
- **requires_nsfw_api**: true
- **requires_face**: false
- **한국어 제목**: "🏖️ 비치 포토슈트"

---

## 🔞 Example 4: Fitness Photography (피트니스 사진)

**사용할 프롬프트:**
```
Transform into a professional fitness photography shot. Athletic physique, gym or outdoor fitness setting, dynamic athletic pose, professional sports photography lighting. Emphasize fitness and health aesthetic, motivational sports magazine style.
```

**예상 결과:**
- **카테고리**: image_editing
- **템플릿 타입**: fixed
- **requires_nsfw_api**: true
- **requires_face**: false
- **한국어 제목**: "💪 피트니스 사진"

---

## 🔞 Example 5: Artistic Boudoir (아티스틱 누아르)

**사용할 프롬프트:**
```
Transform into an artistic boudoir photography style. Elegant and tasteful composition, soft romantic lighting, classic black and white or warm tones. Professional fine art photography aesthetic, emphasis on lighting and composition, artistic and sophisticated.
```

**예상 결과:**
- **카테고리**: image_editing
- **템플릿 타입**: fixed
- **requires_nsfw_api**: true
- **requires_face**: false
- **한국어 제목**: "🎨 아티스틱 누아르"

---

## 🔞 Example 6: Outfit Style - Parameterized (의상 스타일 - 파라미터형)

**사용할 프롬프트:**
```
Transform the person in this photo to be wearing {outfit_style}. Maintain natural facial features and realistic proportions. Professional photography quality with appropriate lighting and background for the outfit style.
```

**파라미터 옵션:**
1. "elegant evening gown" - 이브닝 드레스
2. "stylish swimwear" - 스타일리시 수영복
3. "luxury lingerie" - 럭셔리 란제리
4. "professional fitness wear" - 전문 운동복
5. "casual beachwear" - 캐주얼 비치웨어
6. "elegant silk robe" - 실크 가운

**예상 결과:**
- **카테고리**: image_editing
- **템플릿 타입**: parameterized
- **requires_nsfw_api**: true
- **requires_face**: true
- **한국어 제목**: "👙 의상 스타일 변경"

---

## 🔞 Example 7: Pose Transformation (포즈 변환)

**사용할 프롬프트:**
```
Transform the pose of the person in this photo to {pose_type}. Maintain facial features and body proportions. Professional photography with appropriate lighting and composition for the pose.
```

**파라미터 옵션:**
1. "confident standing pose with hand on hip" - 자신감 있는 서있는 포즈
2. "relaxed sitting pose" - 편안한 앉은 포즈
3. "dynamic action pose" - 역동적인 액션 포즈
4. "elegant lying down pose" - 우아한 누운 포즈
5. "casual leaning pose" - 캐주얼 기댄 포즈

**예상 결과:**
- **카테고리**: image_editing
- **템플릿 타입**: parameterized
- **requires_nsfw_api**: true
- **requires_face**: true
- **한국어 제목**: "🕺 포즈 변환"

---

## 🔞 Example 8: Studio Lighting Style (스튜디오 조명)

**사용할 프롬프트:**
```
Re-light this photo with {lighting_style}. Professional studio photography quality, maintain subject's features and pose, only change the lighting setup and mood.
```

**파라미터 옵션:**
1. "dramatic side lighting with shadows" - 드라마틱 측면 조명
2. "soft diffused beauty lighting" - 소프트 뷰티 라이팅
3. "rim lighting with dark background" - 림 라이팅 어두운 배경
4. "golden hour warm lighting" - 골든 아워 조명
5. "high key bright lighting" - 하이키 밝은 조명
6. "moody low key lighting" - 무디 로우키 조명

**예상 결과:**
- **카테고리**: image_editing
- **템플릿 타입**: parameterized
- **requires_nsfw_api**: false (조명만 변경)
- **requires_face**: false
- **한국어 제목**: "💡 스튜디오 조명"

---

## 📝 사용 방법

### 1. 텔레그램에서 명령어 실행

```
/admin prompt:add
```

### 2. 위 프롬프트 중 하나를 복사해서 붙여넣기

예:
```
Transform this photo into a glamorous portrait with professional studio lighting. The subject should have elegant styling, sophisticated makeup, and be wearing elegant evening attire. Maintain natural facial features and realistic proportions. Studio quality, high fashion photography style, dramatic lighting, elegant pose.
```

### 3. Claude LLM 분석 결과 확인

- 자동으로 제목, 카테고리, 파라미터 분석
- 승인/거부 버튼 선택

### 4. 승인하면 자동으로 DB 저장

---

## ⚠️ 중요 가이드라인

### ✅ 권장사항:
- "professional photography" 강조
- "maintain facial features" 포함
- "realistic proportions" 명시
- "tasteful", "artistic", "elegant" 같은 단어 사용

### ❌ 피해야 할 것:
- 노골적이거나 음란한 표현
- 불법적인 컨텐츠 암시
- 미성년자 관련 내용
- 비동의적 상황 묘사

### 🎯 품질 팁:
- 구체적인 조명/배경 설명 추가
- 사진 스타일 명시 (magazine, editorial, studio)
- 자연스러움 강조 (natural, realistic)
- 전문성 언급 (professional, high quality)

---

## 🧪 테스트 순서

1. **Fixed 템플릿 먼저 추가** (Example 1-5)
   - 간단하고 예측 가능
   - 바로 테스트 가능

2. **Parameterized 템플릿** (Example 6-7)
   - 옵션 선택 UI 테스트
   - 다양성 확인

3. **조명 템플릿** (Example 8)
   - NSFW API 불필요 (일반 편집)
   - 성능 비교용

---

## 📊 예상 비용

Replicate Flux.1Dev Uncensored:
- **1회 생성**: ~$0.03-0.05
- **무료 5회**: ~$0.15-0.25/사용자/일
- **VIP 무제한**: 사용량에 따라 변동

Gemini (분석용):
- 거의 무료 (텍스트 처리)

---

## 🎯 Phase 2 목표

- [ ] 최소 **3개 Fixed 템플릿** 추가
- [ ] 최소 **2개 Parameterized 템플릿** 추가
- [ ] 각 템플릿 **실제 이미지로 테스트**
- [ ] 만족도 확인 (품질, 속도, 정확도)
- [ ] 사용자 피드백 수집

---

*준비 완료! `/admin prompt:add` 명령어로 시작하세요!* 🚀
