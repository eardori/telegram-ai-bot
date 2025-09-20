# 📸 AI 사진 편집 프롬프트 템플릿 분석 및 활용 계획

## 🎯 프롬프트 분석 요약

제공된 38개의 프롬프트를 분석한 결과, 다음과 같은 핵심 패턴과 카테고리를 도출했습니다.

### 📊 카테고리별 분류

| 카테고리 | 개수 | 프롬프트 번호 | 주요 특징 |
|----------|------|---------------|----------|
| **인물 사진 스타일링** | 12개 | 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 38 | 조명, 배경, 분위기 조정 |
| **3D/피규어 변환** | 5개 | 1, 13, 14, 15, 16 | 실물을 장난감/피규어로 변환 |
| **게임/애니메이션** | 2개 | 17, 35 | 게임 캐릭터화 |
| **이미지 편집 도구** | 11개 | 18-28, 30-33 | 합성, 교체, 추가, 제거 등 |
| **창의적 변환** | 3개 | 22, 34, 36-37 | 앨범, 스티커, 폴라로이드 |

---

## 🔑 핵심 프롬프트 패턴 분석

### 1. 구조적 패턴

모든 고품질 프롬프트는 다음 구조를 따릅니다:

```
[주요 동작/목적] + [세부 설명] + [스타일/품질 지정]
```

#### 예시 분석: 프롬프트 #3 (밤 인물사진)
```
1. 주요 동작: "Create an ultra-realistic night-time portrait"
2. 세부 설명:
   - Background: Arc de Triomphe 위치와 조명 상세
   - Lighting & Color: 따뜻한 야간 조명, 색감 설정
   - Pose & Angle: 구체적인 포즈와 카메라 각도
   - Outfit: 의상 상세 설명
3. 스타일/품질: "4K HD, realistic, cinematic"
```

### 2. 핵심 구성 요소

#### 필수 요소
- **주체 식별**: "uploaded person", "reference photo", "this image"
- **동작 지시**: "Create", "Generate", "Make", "Transform"
- **품질 지정**: "hyper-realistic", "photorealistic", "4K", "HD"

#### 선택적 상세 요소
- **조명**: "golden-orange spotlight", "warm ambient lighting", "dramatic spotlight"
- **배경**: 구체적 장소나 환경 설명
- **포즈/각도**: "three-quarter profile", "facing left", "tilted upward"
- **의상**: 상세한 옷차림 설명
- **분위기**: "moody", "cinematic", "vintage", "retro"

---

## 💡 프롬프트 템플릿 구조화

### 기본 템플릿 구조

```typescript
interface PromptTemplate {
  // 기본 정보
  id: string;
  name: string;
  category: PromptCategory;

  // 프롬프트 구성
  basePrompt: string;           // 핵심 지시사항
  variables: PromptVariable[];  // 대체 가능한 변수

  // 조건부 요소
  conditionalElements: {
    lighting?: LightingOptions[];
    background?: BackgroundOptions[];
    pose?: PoseOptions[];
    style?: StyleOptions[];
    quality?: QualityOptions[];
  };

  // 적용 조건
  requirements: {
    minImages: number;
    maxImages: number;
    imageTypes: ImageType[];     // portrait, full-body, object, etc.
    faceRequired: boolean;
    faceCount?: { min: number; max: number };
  };
}
```

### 변수 시스템

```typescript
interface PromptVariable {
  key: string;           // e.g., "{subject}", "{background}", "{lighting}"
  type: 'required' | 'optional';
  defaultValue?: string;
  options?: string[];    // 선택 가능한 옵션들
  userInput?: boolean;   // 사용자 입력 필요 여부
}
```

---

## 🎨 카테고리별 프롬프트 템플릿

### 1. 인물 사진 스타일링 템플릿

#### Template: `portrait_studio_lighting`
```javascript
{
  basePrompt: "Craft a moody studio portrait of {subject} bathed in {lighting_color} spotlight that creates {effect} behind them",
  variables: [
    {
      key: "{subject}",
      type: "required",
      defaultValue: "the uploaded person"
    },
    {
      key: "{lighting_color}",
      type: "optional",
      options: ["golden-orange", "cool blue", "warm pink", "dramatic white"],
      defaultValue: "golden-orange"
    },
    {
      key: "{effect}",
      type: "optional",
      options: ["a glowing circular halo", "dramatic shadows", "soft gradient"],
      defaultValue: "a glowing circular halo"
    }
  ],
  quality: ["hyper-realistic", "4K", "cinematic lighting"]
}
```

#### Template: `portrait_location_night`
```javascript
{
  basePrompt: "Create an ultra-realistic night-time portrait from this photo, standing near {landmark} in {city}",
  variables: [
    {
      key: "{landmark}",
      type: "required",
      userInput: true,
      options: ["Arc de Triomphe", "Eiffel Tower", "Times Square", "Tokyo Tower"]
    },
    {
      key: "{city}",
      type: "required",
      userInput: true,
      options: ["Paris", "New York", "Tokyo", "London"]
    }
  ],
  additionalElements: {
    lighting: "warm ambient nighttime lighting with subtle yellow-orange glows",
    pose: "three-quarter profile, relaxed stance",
    mood: "cinematic, moody feel"
  }
}
```

### 2. 3D/피규어 변환 템플릿

#### Template: `figurine_commercialized`
```javascript
{
  basePrompt: "Create a {scale} scale commercialized figurine of the character in the picture, in {style} style, in a real environment",
  variables: [
    {
      key: "{scale}",
      type: "optional",
      options: ["1/7", "1/8", "1/6", "1/4"],
      defaultValue: "1/7"
    },
    {
      key: "{style}",
      type: "optional",
      options: ["realistic", "anime", "chibi", "cartoon"],
      defaultValue: "realistic"
    }
  ],
  environment: {
    placement: "computer desk",
    base: "round transparent acrylic base",
    surroundings: ["3D modeling screen", "toy packaging box", "collectible display"]
  }
}
```

#### Template: `plush_toy`
```javascript
{
  basePrompt: "A soft, high-quality plush toy of {subject}, with an oversized head, small body, and stubby limbs",
  materials: "fuzzy fabric with visible stitching and embroidered facial features",
  presentation: "sitting or standing against a neutral background",
  style: "cute, collectible plush look"
}
```

### 3. 이미지 편집 도구 템플릿

#### Template: `image_merge`
```javascript
{
  basePrompt: "Combine multiple images ({images}) into a single cohesive image",
  requirements: {
    minImages: 2,
    maxImages: 5
  },
  instructions: [
    "Keep all key subjects recognizable",
    "Maintain proportions and details",
    "Blend naturally with consistent lighting",
    "Match shadows and perspective"
  ]
}
```

#### Template: `outfit_swap`
```javascript
{
  basePrompt: "Keep the character in {image1} unchanged, but replace their {clothing_item} with the outfit in {image2}",
  variables: [
    {
      key: "{clothing_item}",
      type: "required",
      options: ["outfit", "top", "bottom", "dress", "accessories"]
    }
  ],
  preservation: ["pose", "body proportions", "facial features"],
  application: ["color", "texture", "style of new clothing"]
}
```

---

## 🤖 지능형 프롬프트 생성 시스템

### 1. 이미지 분석 기반 프롬프트 추천

```typescript
class SmartPromptGenerator {
  async analyzeAndRecommend(imageAnalysis: ImageAnalysis): Promise<PromptRecommendation[]> {
    const recommendations = [];

    // 얼굴 감지 기반 추천
    if (imageAnalysis.faces.count === 1) {
      if (imageAnalysis.faces.clarity === 'high') {
        recommendations.push({
          template: 'portrait_studio_lighting',
          confidence: 0.95,
          reason: '고품질 얼굴이 감지되어 스튜디오 인물 사진 편집 추천'
        });

        recommendations.push({
          template: 'figurine_commercialized',
          confidence: 0.85,
          reason: '선명한 인물로 피규어 제작 가능'
        });
      }

      if (imageAnalysis.scene === 'indoor') {
        recommendations.push({
          template: 'background_replace',
          confidence: 0.80,
          reason: '실내 배경을 더 흥미로운 장소로 변경 가능'
        });
      }
    }

    // 다중 인물 감지
    if (imageAnalysis.faces.count >= 2) {
      recommendations.push({
        template: 'polaroid_family',
        confidence: 0.90,
        reason: '여러 명이 있어 가족/친구 폴라로이드 생성 적합'
      });
    }

    // 의상이 잘 보이는 전신 사진
    if (imageAnalysis.bodyVisible && imageAnalysis.clothingClear) {
      recommendations.push({
        template: 'outfit_swap',
        confidence: 0.85,
        reason: '의상이 잘 보여 옷 교체 편집 가능'
      });
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }
}
```

### 2. 컨텍스트 기반 프롬프트 최적화

```typescript
class PromptOptimizer {
  optimize(template: PromptTemplate, context: UserContext): string {
    let prompt = template.basePrompt;

    // 사용자 선호도 반영
    if (context.preferences.style === 'vintage') {
      prompt += " with vintage film grain and warm color grading";
    }

    // 시간대별 조명 자동 조정
    const hour = new Date().getHours();
    if (hour >= 17 || hour < 7) {
      prompt += " with evening/night lighting ambiance";
    } else {
      prompt += " with natural daylight";
    }

    // 사용자 히스토리 기반 스타일 추가
    if (context.history.favoriteStyles.includes('cinematic')) {
      prompt += ", cinematic composition, movie-like color grading";
    }

    return prompt;
  }
}
```

---

## 🔄 동적 프롬프트 조합 시스템

### 1. 모듈형 프롬프트 구성

```typescript
interface PromptModule {
  type: 'subject' | 'action' | 'style' | 'quality' | 'environment';
  content: string;
  compatibility: string[]; // 호환 가능한 다른 모듈
}

const promptModules: PromptModule[] = [
  // Subject Modules
  {
    type: 'subject',
    content: 'the uploaded person (preserve face 100%)',
    compatibility: ['portrait', 'figurine', 'style_transfer']
  },

  // Action Modules
  {
    type: 'action',
    content: 'Create a hyper-realistic portrait',
    compatibility: ['lighting', 'background', 'pose']
  },

  // Style Modules
  {
    type: 'style',
    content: '1970s retro aesthetic with vintage film grain',
    compatibility: ['fashion', 'portrait', 'scene']
  },

  // Quality Modules
  {
    type: 'quality',
    content: '4K HD, photorealistic, studio lighting',
    compatibility: ['all']
  }
];
```

### 2. 지능형 조합 알고리즘

```typescript
class PromptComposer {
  compose(modules: PromptModule[], userInput?: string): string {
    const composition = {
      subject: '',
      action: '',
      details: [],
      style: '',
      quality: ''
    };

    // 모듈 분류 및 조합
    modules.forEach(module => {
      switch(module.type) {
        case 'subject':
          composition.subject = module.content;
          break;
        case 'action':
          composition.action = module.content;
          break;
        case 'style':
          composition.style = module.content;
          break;
        case 'quality':
          composition.quality = module.content;
          break;
        default:
          composition.details.push(module.content);
      }
    });

    // 사용자 입력 통합
    if (userInput) {
      composition.details.push(userInput);
    }

    // 최종 프롬프트 생성
    return `${composition.action} of ${composition.subject}. ${composition.details.join('. ')}. Style: ${composition.style}. Quality: ${composition.quality}`;
  }
}
```

---

## 📱 사용자 인터페이스 프롬프트 매핑

### 1. 간단한 선택지를 상세 프롬프트로 변환

```typescript
interface UserChoice {
  displayText: string;      // 사용자에게 보여지는 텍스트
  internalPrompt: string;    // 실제 사용될 프롬프트
  requiredImages: number;
  category: string;
}

const userChoices: UserChoice[] = [
  {
    displayText: "🎭 피규어 만들기",
    internalPrompt: promptTemplates.figurine_commercialized.fullPrompt,
    requiredImages: 1,
    category: "3d_transform"
  },
  {
    displayText: "🌃 밤 거리 인물사진",
    internalPrompt: promptTemplates.portrait_location_night.fullPrompt,
    requiredImages: 1,
    category: "portrait_styling"
  },
  {
    displayText: "👔 옷 바꿔입기",
    internalPrompt: promptTemplates.outfit_swap.fullPrompt,
    requiredImages: 2,
    category: "image_editing"
  }
];
```

### 2. 사용자 맞춤형 제안 생성

```typescript
class SuggestionGenerator {
  async generateSuggestions(
    imageAnalysis: ImageAnalysis,
    userHistory: UserHistory
  ): Promise<Suggestion[]> {
    const suggestions = [];

    // 이미지 특성에 맞는 템플릿 필터링
    const compatibleTemplates = this.filterTemplatesByImage(imageAnalysis);

    // 사용자 선호도 점수 계산
    compatibleTemplates.forEach(template => {
      const score = this.calculateScore(template, imageAnalysis, userHistory);

      if (score > 0.7) {
        suggestions.push({
          template: template,
          displayName: this.getLocalizedName(template, 'ko'),
          description: this.generateDescription(template, imageAnalysis),
          confidence: score,
          exampleImage: this.getExampleImage(template)
        });
      }
    });

    // 상위 5개 반환
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  private calculateScore(
    template: PromptTemplate,
    analysis: ImageAnalysis,
    history: UserHistory
  ): number {
    let score = 0.5; // 기본 점수

    // 이미지 적합성 (40%)
    if (this.checkImageCompatibility(template, analysis)) {
      score += 0.4;
    }

    // 사용자 선호도 (30%)
    const preferenceScore = this.getUserPreferenceScore(template, history);
    score += preferenceScore * 0.3;

    // 템플릿 인기도 (20%)
    const popularityScore = template.usageCount / 1000;
    score += Math.min(popularityScore * 0.2, 0.2);

    // 신규성 보너스 (10%)
    if (!history.usedTemplates.includes(template.id)) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }
}
```

---

## 🚀 구현 우선순위

### Phase 1: 핵심 템플릿 (Week 1)
1. **인물 사진 스타일링** - 가장 많이 사용될 기능
   - portrait_studio_lighting (프롬프트 #2)
   - portrait_location_night (프롬프트 #3)
   - portrait_black_white (프롬프트 #38)

2. **3D/피규어 변환** - 독특하고 재미있는 기능
   - figurine_commercialized (프롬프트 #1)
   - plush_toy (프롬프트 #14)

### Phase 2: 편집 도구 (Week 2)
1. **기본 편집**
   - background_replace (프롬프트 #23)
   - outfit_swap (프롬프트 #30)
   - image_merge (프롬프트 #18)

2. **고급 편집**
   - object_add (프롬프트 #24)
   - object_remove (프롬프트 #25)

### Phase 3: 창의적 변환 (Week 3)
1. **스타일 변환**
   - game_character_16bit (프롬프트 #35)
   - emoji_stickers (프롬프트 #15)

2. **앨범/콜라주**
   - album_9_photos (프롬프트 #22)
   - polaroid_style (프롬프트 #36-37)

---

## 📊 성공 측정 지표

### 템플릿 효과성 측정
```typescript
interface TemplateMetrics {
  templateId: string;
  usageCount: number;
  successRate: number;      // 사용자가 결과 수락한 비율
  averageRating: number;     // 1-5 평점
  editRequests: number;      // 추가 수정 요청 횟수
  completionTime: number;    // 평균 처리 시간
}
```

### A/B 테스트 계획
- 같은 이미지에 대해 다른 프롬프트 변형 테스트
- 사용자 선호도 수집 및 프롬프트 개선
- 자동 최적화 시스템 구축

---

## 🔧 기술적 구현 고려사항

### 1. 프롬프트 길이 최적화
- Nano Banafo API의 최대 프롬프트 길이 확인
- 필요시 프롬프트 압축 알고리즘 구현

### 2. 다국어 지원
- 한국어 입력을 영어 프롬프트로 자동 변환
- 결과 설명은 한국어로 제공

### 3. 캐싱 전략
- 자주 사용되는 프롬프트 조합 캐싱
- 유사한 이미지 분석 결과 재사용

---

## 📝 다음 단계

1. **데이터베이스에 프롬프트 템플릿 저장**
2. **이미지 분석 서비스 구현**
3. **프롬프트 추천 엔진 개발**
4. **사용자 인터페이스 구축**
5. **Nano Banafo API 통합**
6. **테스트 및 최적화**

---

*문서 작성일: 2024년 12월*
*버전: 1.0.0*