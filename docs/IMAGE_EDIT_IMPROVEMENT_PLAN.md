# 🎨 이미지 편집 기능 개선 계획

**작성일:** 2025-10-08
**우선순위:** 최우선 (세션 기억 기능보다 높음)
**현재 상태:** Gemini API 연동 완료, 기본 기능 작동 확인

---

## ✅ 현재 완료된 사항

### 1. 기본 기능
- ✅ 이미지 업로드 및 분석 (Gemini Vision)
- ✅ 템플릿 추천 시스템 (AI 기반)
- ✅ 인라인 버튼 UI
- ✅ 이미지 편집 실행 (Gemini 2.5 Flash Image Preview)
- ✅ 결과 전송 및 후속 액션 버튼
- ✅ Replicate → Gemini 전환 완료
- ✅ 폴라로이드 템플릿 테스트 성공

### 2. 데이터베이스
- ✅ `prompt_templates` 테이블 (38개 템플릿 저장)
- ✅ `image_analysis_results` 테이블 (분석 결과 저장)
- ✅ `image_edit_results` 테이블 (편집 결과 저장)

### 3. 구현된 핸들러
- ✅ Template 선택 (`t:templateKey:chatId:messageId`)
- ✅ Retry (다른 스타일 시도)
- ✅ Back (원본으로 돌아가기)
- ✅ Redo (같은 스타일 재편집)
- ✅ Rate (별점 평가)
- ⚠️ "전체 38개 스타일 보기" 버튼 (구현됨, 핸들러 미확인)
- ⚠️ 페이지네이션 (`tp:page:fileKey`) (코드 존재, 미테스트)

---

## 🎯 개선 작업 계획

### Phase 1: 현재 기능 검증 및 테스트 (우선순위: 최고)

#### 1.1 템플릿 다양성 테스트
**목표:** 다양한 카테고리의 템플릿이 실제로 작동하는지 검증

**테스트 대상:**
- ✅ **창의적 변환** (Creative Transform): 폴라로이드 가족 - 완료
- ⏳ **게임/애니메이션**: 리듬게임 캐릭터
- ⏳ **이미지 편집**: 의상 교체, 표정 변경
- ⏳ **3D/피규어**: 넨도로이드, 팝마트
- ⏳ **인물 스타일링**: 밤 인물사진, 야외 인물사진

**측정 지표:**
- 성공률 (편집 완료 vs 실패)
- 평균 처리 시간
- 결과 품질 (사용자 피드백)

**예상 소요 시간:** 1시간

---

#### 1.2 "전체 38개 스타일 보기" 기능 검증
**목표:** 기존 구현된 기능이 정상 작동하는지 확인

**확인 사항:**
1. ✅ 버튼 존재 여부: `t:all:${fileKey}`
2. ⏳ 핸들러 구현 여부: `bot.callbackQuery(/^t:all:/)`
3. ⏳ 템플릿 페이지네이션: 8개씩 분할 표시
4. ⏳ 페이지 이동: `tp:1:${fileKey}` (다음 페이지)

**작업:**
- 핸들러 존재 확인
- 테스트 실행
- 버그 수정

**예상 소요 시간:** 30분

---

### Phase 2: 프롬프트 최적화 (우선순위: 높음)

#### 2.1 현재 프롬프트 분석
**현재 구조:**
```typescript
const editPrompt = `${request.templatePrompt}

IMPORTANT INSTRUCTIONS:
- Analyze the input image carefully
- Apply the requested style transformation precisely
- Maintain the subject's identity and key features
- Enhance quality while preserving important details
- Create a visually appealing, high-quality result

Generate the edited image following the style description above.`;
```

**문제점:**
- Gemini에 맞는 최적화 부족
- 템플릿별 특화 지시사항 없음
- 품질 제어 파라미터 미활용

---

#### 2.2 개선 방안

**A. 카테고리별 프롬프트 강화**
```typescript
function getEnhancedPrompt(template: Template, imageAnalysis: Analysis): string {
  const basePrompt = template.base_prompt;

  // 카테고리별 특화 지시사항
  const categoryInstructions = {
    '3d_figurine': `
      - Create a miniature figurine transformation
      - Maintain plastic/vinyl toy aesthetic
      - Add clean white or gradient background
      - Preserve facial features in simplified form
    `,
    'portrait_styling': `
      - Keep photorealistic quality
      - Enhance lighting and composition
      - Maintain natural skin tones
      - Preserve identity completely
    `,
    'game_animation': `
      - Apply stylized character design
      - Use vibrant, saturated colors
      - Add character art aesthetic
      - Maintain recognizable features
    `,
    'creative_transform': `
      - Creative artistic interpretation
      - Unique visual style
      - Maintain subject recognition
      - Add artistic flair
    `
  };

  return `${basePrompt}

${categoryInstructions[template.category] || ''}

QUALITY REQUIREMENTS:
- High resolution output (1024x1024 minimum)
- Sharp details and clear focus
- Professional color grading
- No artifacts or distortions

SUBJECT PRESERVATION:
- Keep facial features recognizable
- Maintain body proportions
- Preserve distinctive characteristics
- Natural pose and expression

Generate the edited image following all instructions above.`;
}
```

**B. 이미지 분석 결과 활용**
```typescript
// 분석 결과를 프롬프트에 반영
if (analysis.faces.count > 1) {
  prompt += `\n- Image contains ${analysis.faces.count} people, preserve all faces`;
}

if (analysis.lighting === 'poor') {
  prompt += `\n- Enhance lighting quality`;
}

if (analysis.scene === 'outdoor') {
  prompt += `\n- Maintain outdoor atmosphere`;
}
```

**예상 소요 시간:** 2시간

---

### Phase 3: 처리 시간 단축 (우선순위: 중)

#### 3.1 현재 처리 시간 분석
**측정 항목:**
- 이미지 다운로드 시간
- Gemini API 호출 시간
- 결과 전송 시간

**최적화 방법:**

**A. 병렬 처리**
```typescript
// Before: Sequential
const imageBuffer = await downloadImage(url);
const result = await geminiClient.editImage(imageBuffer, prompt);

// After: Parallel where possible
const [imageBuffer, templateData] = await Promise.all([
  downloadImage(url),
  fetchTemplateDetails(templateKey)
]);
```

**B. 캐싱 전략**
```typescript
// Image caching (if same image multiple edits)
const imageCache = new Map<string, Buffer>();

function getCachedImage(url: string): Buffer | null {
  return imageCache.get(url) || null;
}
```

**C. Timeout 최적화**
```typescript
// NanoBanafoClient에서 timeout 조정
private timeout: number = 30000; // 30초 → 필요시 조정
```

**예상 소요 시간:** 1시간

---

### Phase 4: UI/UX 개선 (우선순위: 높음)

#### 4.1 카테고리별 분류 UI

**현재 상태:**
- 추천 템플릿 4~5개만 표시
- "전체 38개 스타일 보기" 버튼만 존재

**개선안:**
```
📸 사진을 받았어요!

🔍 분석 결과:
👤 인물 4명 감지 • 📸 단체 사진 • 🏠 야외

━━━━━━━━━━━━━━━━━━━━━━

🎯 추천 스타일 (TOP 4):
✨ 폴라로이드 가족 ⭐⭐⭐⭐⭐
🎮 리듬게임 캐릭터 ⭐⭐⭐⭐

━━━━━━━━━━━━━━━━━━━━━━

📂 카테고리별 전체 보기:
[🎭 3D/피규어] [📸 인물 스타일] [🎮 게임/애니메이션]
[🛠️ 이미지 편집] [✨ 창의적 변환]

🔍 전체 38개 스타일 목록 보기
```

**구현:**
```typescript
// Category buttons
const categoryKeyboard = new InlineKeyboard()
  .text('🎭 3D/피규어', `cat:3d_figurine:${fileKey}`)
  .text('📸 인물 스타일', `cat:portrait_styling:${fileKey}`).row()
  .text('🎮 게임/애니메이션', `cat:game_animation:${fileKey}`)
  .text('🛠️ 이미지 편집', `cat:image_editing:${fileKey}`).row()
  .text('✨ 창의적 변환', `cat:creative_transform:${fileKey}`)
  .text('🔍 전체 보기', `t:all:${fileKey}`);

// Category handler
bot.callbackQuery(/^cat:([^:]+):(.+)$/, async (ctx) => {
  const category = ctx.match[1];
  const fileKey = ctx.match[2];

  // Fetch templates by category
  const templates = await fetchTemplatesByCategory(category);

  // Display with pagination
  await displayTemplatesPage(ctx, templates, 0, fileKey);
});
```

**예상 소요 시간:** 2시간

---

#### 4.2 페이지네이션 개선

**현재 구현 상태:**
```typescript
// 코드 존재하지만 테스트 필요
keyboard.text('➡️ 다음 페이지', `tp:1:${fileKey}`);
```

**개선안:**
```
🎨 3D/피규어 스타일 (1/5 페이지)

[🎭 넨도로이드] [🧸 팝마트]
[🎨 클레이 피규어] [🎪 소니엔젤]
[🎯 레고 미니피그] [🎨 쿠키런]

[⬅️ 이전] [📋 카테고리] [➡️ 다음]
```

**구현:**
```typescript
bot.callbackQuery(/^tp:(\d+):(.+)$/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  const fileKey = ctx.match[2];

  await displayTemplatesPage(ctx, allTemplates, page, fileKey);
});

async function displayTemplatesPage(
  ctx: Context,
  templates: Template[],
  page: number,
  fileKey: string
) {
  const perPage = 6; // 2 rows of 3
  const start = page * perPage;
  const end = start + perPage;
  const pageTemplates = templates.slice(start, end);
  const totalPages = Math.ceil(templates.length / perPage);

  const keyboard = new InlineKeyboard();

  // Template buttons (2 rows of 3)
  for (let i = 0; i < pageTemplates.length; i += 3) {
    const row = pageTemplates.slice(i, i + 3);
    row.forEach(t => {
      keyboard.text(`${t.emoji} ${t.name_ko}`, `t:${t.key}:${fileKey}`);
    });
    keyboard.row();
  }

  // Navigation buttons
  if (page > 0) {
    keyboard.text('⬅️ 이전', `tp:${page - 1}:${fileKey}`);
  }
  keyboard.text('📋 카테고리', `back_cat:${fileKey}`);
  if (page < totalPages - 1) {
    keyboard.text('➡️ 다음', `tp:${page + 1}:${fileKey}`);
  }

  await ctx.editMessageText(
    `🎨 **스타일 선택** (${page + 1}/${totalPages} 페이지)\n\n` +
    `원하는 스타일을 선택하세요:`,
    { reply_markup: keyboard }
  );
}
```

**예상 소요 시간:** 1.5시간

---

### Phase 5: Gemini API 비용 추적 (우선순위: 중)

#### 5.1 비용 계산 로직

**Gemini 2.5 Flash Image Preview 가격:**
- Input: $0.00001875 per image (up to 3.75M pixels)
- Output: $0.000075 per image (up to 3.75M pixels)

**구현:**
```typescript
interface APIUsageLog {
  user_id: number;
  operation: 'image_analysis' | 'image_edit';
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  input_images: number;
  output_images: number;
  estimated_cost: number;
  timestamp: Date;
}

async function logAPIUsage(
  userId: number,
  operation: string,
  inputImages: number,
  outputImages: number
) {
  const inputCost = inputImages * 0.00001875;
  const outputCost = outputImages * 0.000075;
  const totalCost = inputCost + outputCost;

  await supabase.from('api_usage_logs').insert({
    user_id: userId,
    operation,
    model: 'gemini-2.5-flash-image-preview',
    input_images: inputImages,
    output_images: outputImages,
    estimated_cost: totalCost,
    timestamp: new Date()
  });

  return totalCost;
}

// Usage in image editing
const cost = await logAPIUsage(ctx.from.id, 'image_edit', 1, 1);
console.log(`💰 API cost: $${cost.toFixed(6)}`);
```

**예상 소요 시간:** 1시간

---

#### 5.2 비용 대시보드 (선택사항)

**관리자 명령어:**
```typescript
bot.command('apicost', async (ctx) => {
  // Admin only
  if (ctx.from?.id !== ADMIN_USER_ID) return;

  const { data: logs } = await supabase
    .from('api_usage_logs')
    .select('*')
    .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000));

  const totalCost = logs.reduce((sum, log) => sum + log.estimated_cost, 0);
  const totalOps = logs.length;

  await ctx.reply(
    `📊 **API 사용 현황 (24시간)**\n\n` +
    `🔢 총 작업: ${totalOps}건\n` +
    `💰 총 비용: $${totalCost.toFixed(4)}\n` +
    `📈 평균 비용: $${(totalCost / totalOps).toFixed(6)}/작업`
  );
});
```

**예상 소요 시간:** 30분

---

## 📋 작업 순서 및 일정

### Week 1: 검증 및 기본 개선
| 작업 | 우선순위 | 예상 시간 | 담당 |
|------|---------|----------|------|
| 1. 템플릿 다양성 테스트 | ⭐⭐⭐⭐⭐ | 1h | Claude |
| 2. "전체 스타일 보기" 검증 | ⭐⭐⭐⭐⭐ | 30min | Claude |
| 3. 프롬프트 최적화 (카테고리별) | ⭐⭐⭐⭐ | 2h | Claude |
| 4. 처리 시간 측정 및 분석 | ⭐⭐⭐ | 1h | Claude |

**총 예상 시간:** 4.5시간

---

### Week 2: UI/UX 개선
| 작업 | 우선순위 | 예상 시간 | 담당 |
|------|---------|----------|------|
| 5. 카테고리별 분류 UI 구현 | ⭐⭐⭐⭐ | 2h | Claude |
| 6. 페이지네이션 개선 | ⭐⭐⭐⭐ | 1.5h | Claude |
| 7. Gemini API 비용 추적 | ⭐⭐⭐ | 1.5h | Claude |

**총 예상 시간:** 5시간

---

## 🎯 성공 지표

### 정량적 지표
- ✅ 템플릿 성공률: 80% 이상
- ✅ 평균 처리 시간: 10초 이내
- ✅ 사용자 만족도 (별점): 4.0 이상
- ✅ 일일 API 비용: $1 이하

### 정성적 지표
- ✅ 다양한 스타일 제공 (38개 모두 활용)
- ✅ 직관적인 카테고리 탐색
- ✅ 빠르고 안정적인 응답
- ✅ 고품질 결과물

---

## 📝 다음 단계

1. **즉시 시작:** 템플릿 다양성 테스트 실행
2. **병행 작업:** "전체 스타일 보기" 기능 검증
3. **순차 진행:** 프롬프트 최적화 → UI 개선 → 비용 추적

---

## 📚 참고 문서

- `docs/PROMPT_TEMPLATES.md` - 38개 프롬프트 분석
- `docs/IMAGE_EDIT_FEATURE_PLAN.md` - 초기 기능 계획
- `docs/IMPLEMENTATION_TASKS.md` - 구현 작업 목록
- `sql/015_prompt_templates_table.sql` - 템플릿 DB 스키마

---

**최종 수정:** 2025-10-08
**다음 리뷰:** Week 1 완료 후
