# 🎯 프롬프트 관리 시스템 구현 계획

**작성일**: 2025-01-10
**목표**: LLM 기반 자동 프롬프트 분석 및 구조화 시스템 구축
**예상 기간**: 2-3주

---

## 📝 시나리오 개요

### 사용자 플로우
1. **어드민 명령어**: `/admin prompt:add`
2. **프롬프트 입력**: 어드민이 새로운 프롬프트 텍스트 전송
3. **LLM 분석**: Claude API를 통해 프롬프트 자동 분석
   - 제목 생성 (한글/영글)
   - 카테고리 자동 분류
   - 이미지 요구사항 추출
   - 파라미터 감지 및 제안
4. **확인 및 수정**: 어드민이 분석 결과 검토 및 수정
5. **DB 저장**: 구조화된 데이터를 데이터베이스에 저장
6. **즉시 활성화**: 유저들이 바로 사용 가능

---

## 🏗️ 시스템 아키텍처

### 1. 데이터베이스 스키마

#### 기존 테이블 확장
```sql
-- prompt_templates 테이블에 컬럼 추가
ALTER TABLE prompt_templates ADD COLUMN IF NOT EXISTS
    analysis_metadata JSONB, -- LLM 분석 결과 원본
    created_by BIGINT, -- 생성한 어드민 user_id
    approved_by BIGINT, -- 승인한 어드민 user_id
    approval_status VARCHAR(20) DEFAULT 'pending', -- pending | approved | rejected
    rejection_reason TEXT;
```

#### 새 테이블: prompt_analysis_queue
```sql
-- 분석 대기열 (임시 저장소)
CREATE TABLE IF NOT EXISTS prompt_analysis_queue (
    id SERIAL PRIMARY KEY,
    admin_user_id BIGINT NOT NULL,
    raw_prompt TEXT NOT NULL, -- 어드민이 입력한 원본 프롬프트

    -- LLM 분석 결과
    suggested_title_ko VARCHAR(100),
    suggested_title_en VARCHAR(100),
    suggested_category VARCHAR(50),
    suggested_subcategory VARCHAR(50),
    suggested_min_images INTEGER,
    suggested_max_images INTEGER,
    requires_face BOOLEAN,
    detected_parameters JSONB, -- [{key, name, type, options}]

    analysis_confidence FLOAT, -- 0-1 신뢰도
    analysis_raw JSONB, -- LLM 응답 원본

    status VARCHAR(20) DEFAULT 'analyzing', -- analyzing | ready | saved | rejected
    created_at TIMESTAMPTZ DEFAULT NOW(),
    analyzed_at TIMESTAMPTZ,

    -- 최종 저장된 template_key (저장 후 채워짐)
    final_template_key VARCHAR(50)
);

CREATE INDEX idx_prompt_analysis_admin ON prompt_analysis_queue(admin_user_id);
CREATE INDEX idx_prompt_analysis_status ON prompt_analysis_queue(status);
```

#### 새 테이블: prompt_approval_log
```sql
-- 승인/거부 이력 추적
CREATE TABLE IF NOT EXISTS prompt_approval_log (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(50) NOT NULL,
    admin_user_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL, -- approved | rejected | modified
    previous_state JSONB, -- 변경 전 상태
    new_state JSONB, -- 변경 후 상태
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2. Claude API 프롬프트 분석 시스템

#### 분석용 시스템 프롬프트
```typescript
const PROMPT_ANALYSIS_SYSTEM_PROMPT = `
You are an expert prompt engineer for image generation APIs (like Flux, Nano Banafo, etc.).
Analyze the given prompt and extract structured metadata.

Response format (JSON):
{
  "title_ko": "한글 제목 (이모지 포함)",
  "title_en": "English Title",
  "category": "3d_figurine | portrait_styling | image_editing | game_animation | creative_transform",
  "subcategory": "collectible | glamour | fashion | ...",
  "min_images": 1,
  "max_images": 1,
  "requires_face": true/false,
  "min_faces": 0,
  "description_ko": "이 템플릿이 무엇을 하는지 한 문장 설명",
  "description_en": "One sentence description",
  "detected_parameters": [
    {
      "parameter_key": "background_style",
      "parameter_name_ko": "배경 스타일",
      "parameter_name_en": "Background Style",
      "parameter_type": "select | text | color",
      "is_required": true,
      "suggested_options": [
        {
          "option_key": "beach_sunset",
          "option_name_ko": "석양 해변",
          "option_name_en": "Beach Sunset",
          "prompt_fragment": "a beautiful beach at sunset...",
          "emoji": "🏖️"
        }
      ]
    }
  ],
  "priority_score": 70,
  "confidence": 0.85,
  "warnings": [
    "이 프롬프트는 2장의 이미지를 요구하지만 min_images=1로 설정되었습니다.",
    "표정이나 스타일 같은 변수가 감지되었습니다. Parameterized 템플릿으로 전환을 고려하세요."
  ],
  "improvement_suggestions": [
    "프롬프트 끝에 'photorealistic, high resolution' 추가 권장",
    "'background'를 파라미터로 분리하면 사용자 선택권이 늘어납니다."
  ]
}

Analysis rules:
1. **Image count detection**:
   - If prompt mentions "Image1", "Image2", etc. → min_images = number of distinct images
   - If prompt says "multiple images" or "several photos" → min_images = 2+
   - Default: min_images = 1, max_images = 1

2. **Face detection**:
   - requires_face = true if prompt mentions: person, face, portrait, expression, smile, etc.
   - requires_face = false for objects, landscapes, abstract art

3. **Category classification**:
   - 3d_figurine: figurine, toy, doll, plush, emoji, 3D character
   - portrait_styling: portrait, fashion, glamour, vintage photo, celebrity style
   - image_editing: swap, change, replace, enhance, remove, add, modify
   - game_animation: game character, pixel art, animation, cartoon
   - creative_transform: collage, photo strip, artistic transformation

4. **Parameter detection**:
   - Look for {placeholders}, [options], or natural language variables
   - Suggest 4-6 preset options per parameter
   - Example: "change to {expression}" → detect "expression" parameter

5. **Priority scoring** (0-100):
   - 90-100: Highly viral, unique, high demand (figurines, glamour portraits)
   - 70-89: Popular use cases (background change, outfit swap)
   - 50-69: Niche but useful (camera angle change, season change)
   - 30-49: Specialized (text edit, object remove)

6. **Confidence score** (0-1):
   - 0.9+: Very clear prompt with explicit instructions
   - 0.7-0.9: Good prompt, minor ambiguity
   - 0.5-0.7: Vague prompt, needs clarification
   - <0.5: Unclear or poorly structured

Respond ONLY with valid JSON. No markdown code blocks.
`;
```

---

### 3. 서비스 레이어 구현

#### `src/services/prompt-analysis-service.ts`
```typescript
import { supabase } from '../utils/supabase';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!
});

export interface PromptAnalysisResult {
  title_ko: string;
  title_en: string;
  category: string;
  subcategory: string;
  min_images: number;
  max_images: number;
  requires_face: boolean;
  min_faces?: number;
  description_ko: string;
  description_en: string;
  detected_parameters: DetectedParameter[];
  priority_score: number;
  confidence: number;
  warnings: string[];
  improvement_suggestions: string[];
}

export interface DetectedParameter {
  parameter_key: string;
  parameter_name_ko: string;
  parameter_name_en: string;
  parameter_type: 'select' | 'text' | 'color';
  is_required: boolean;
  suggested_options: ParameterOption[];
}

export interface ParameterOption {
  option_key: string;
  option_name_ko: string;
  option_name_en: string;
  prompt_fragment: string;
  emoji: string;
}

/**
 * Claude API를 사용하여 프롬프트 분석
 */
export async function analyzePromptWithLLM(
  rawPrompt: string
): Promise<PromptAnalysisResult> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: PROMPT_ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this image generation prompt:\n\n${rawPrompt}`
        }
      ]
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const result = JSON.parse(textContent.text) as PromptAnalysisResult;
    return result;
  } catch (error) {
    console.error('❌ Error analyzing prompt:', error);
    throw error;
  }
}

/**
 * 분석 결과를 대기열에 저장
 */
export async function saveAnalysisToQueue(
  adminUserId: number,
  rawPrompt: string,
  analysis: PromptAnalysisResult
): Promise<number> {
  const { data, error } = await supabase
    .from('prompt_analysis_queue')
    .insert({
      admin_user_id: adminUserId,
      raw_prompt: rawPrompt,
      suggested_title_ko: analysis.title_ko,
      suggested_title_en: analysis.title_en,
      suggested_category: analysis.category,
      suggested_subcategory: analysis.subcategory,
      suggested_min_images: analysis.min_images,
      suggested_max_images: analysis.max_images,
      requires_face: analysis.requires_face,
      detected_parameters: analysis.detected_parameters,
      analysis_confidence: analysis.confidence,
      analysis_raw: analysis,
      status: 'ready',
      analyzed_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * 분석 결과 조회
 */
export async function getAnalysisById(id: number) {
  const { data, error } = await supabase
    .from('prompt_analysis_queue')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * 어드민 승인 후 실제 템플릿으로 저장
 */
export async function saveAnalysisAsTemplate(
  queueId: number,
  adminUserId: number,
  overrides?: Partial<PromptAnalysisResult>
): Promise<string> {
  // 1. 대기열에서 분석 결과 가져오기
  const analysis = await getAnalysisById(queueId);

  // 2. template_key 생성 (title_en 기반)
  const templateKey = generateTemplateKey(
    overrides?.title_en || analysis.suggested_title_en
  );

  // 3. prompt_templates에 삽입
  const { error: insertError } = await supabase
    .from('prompt_templates')
    .insert({
      template_key: templateKey,
      template_name_ko: overrides?.title_ko || analysis.suggested_title_ko,
      template_name_en: overrides?.title_en || analysis.suggested_title_en,
      category: overrides?.category || analysis.suggested_category,
      subcategory: overrides?.subcategory || analysis.suggested_subcategory,
      base_prompt: analysis.raw_prompt,
      template_type: analysis.detected_parameters?.length > 0 ? 'parameterized' : 'fixed',
      min_images: overrides?.min_images || analysis.suggested_min_images,
      max_images: overrides?.max_images || analysis.suggested_max_images,
      requires_face: overrides?.requires_face ?? analysis.requires_face,
      priority: overrides?.priority_score || analysis.analysis_raw.priority_score,
      is_active: true,
      created_by: adminUserId,
      approved_by: adminUserId,
      approval_status: 'approved',
      analysis_metadata: analysis.analysis_raw
    });

  if (insertError) throw insertError;

  // 4. Parameterized인 경우 파라미터 및 옵션 저장
  if (analysis.detected_parameters?.length > 0) {
    await saveParametersAndOptions(templateKey, analysis.detected_parameters);
  }

  // 5. 대기열 상태 업데이트
  await supabase
    .from('prompt_analysis_queue')
    .update({
      status: 'saved',
      final_template_key: templateKey
    })
    .eq('id', queueId);

  // 6. 승인 로그 기록
  await supabase
    .from('prompt_approval_log')
    .insert({
      template_key: templateKey,
      admin_user_id: adminUserId,
      action: 'approved',
      new_state: analysis.analysis_raw,
      comment: 'LLM 분석 결과 승인 및 저장'
    });

  return templateKey;
}

/**
 * template_key 생성 (영문 제목 → snake_case)
 */
function generateTemplateKey(titleEn: string): string {
  return titleEn
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

/**
 * 파라미터 및 옵션 저장
 */
async function saveParametersAndOptions(
  templateKey: string,
  parameters: DetectedParameter[]
) {
  for (const param of parameters) {
    // 1. 파라미터 저장
    const { data: paramData, error: paramError } = await supabase
      .from('template_parameters')
      .insert({
        template_key: templateKey,
        parameter_key: param.parameter_key,
        parameter_name_ko: param.parameter_name_ko,
        parameter_name_en: param.parameter_name_en,
        parameter_type: param.parameter_type,
        is_required: param.is_required,
        display_order: parameters.indexOf(param) + 1
      })
      .select('id')
      .single();

    if (paramError) throw paramError;

    // 2. 옵션 저장
    const options = param.suggested_options.map((opt, idx) => ({
      parameter_id: paramData.id,
      option_key: opt.option_key,
      option_name_ko: opt.option_name_ko,
      option_name_en: opt.option_name_en,
      prompt_fragment: opt.prompt_fragment,
      emoji: opt.emoji,
      display_order: idx + 1
    }));

    const { error: optError } = await supabase
      .from('template_parameter_options')
      .insert(options);

    if (optError) throw optError;
  }
}

/**
 * 분석 결과 포맷팅 (Telegram 메시지)
 */
export function formatAnalysisResult(analysis: PromptAnalysisResult): string {
  let message = `🔍 **프롬프트 분석 완료**\n\n`;

  message += `**제목**\n`;
  message += `• 한글: ${analysis.title_ko}\n`;
  message += `• 영문: ${analysis.title_en}\n\n`;

  message += `**분류**\n`;
  message += `• 카테고리: ${analysis.category}\n`;
  message += `• 서브카테고리: ${analysis.subcategory}\n\n`;

  message += `**이미지 요구사항**\n`;
  message += `• 최소 이미지: ${analysis.min_images}장\n`;
  message += `• 최대 이미지: ${analysis.max_images}장\n`;
  message += `• 얼굴 필요: ${analysis.requires_face ? '예' : '아니오'}\n\n`;

  message += `**설명**\n`;
  message += `${analysis.description_ko}\n\n`;

  if (analysis.detected_parameters.length > 0) {
    message += `**감지된 파라미터** (${analysis.detected_parameters.length}개)\n`;
    analysis.detected_parameters.forEach(param => {
      message += `• ${param.parameter_name_ko} (${param.suggested_options.length}개 옵션)\n`;
    });
    message += `\n`;
  }

  message += `**우선순위 점수**: ${analysis.priority_score}/100\n`;
  message += `**신뢰도**: ${(analysis.confidence * 100).toFixed(0)}%\n\n`;

  if (analysis.warnings.length > 0) {
    message += `⚠️ **경고사항**\n`;
    analysis.warnings.forEach(w => message += `• ${w}\n`);
    message += `\n`;
  }

  if (analysis.improvement_suggestions.length > 0) {
    message += `💡 **개선 제안**\n`;
    analysis.improvement_suggestions.forEach(s => message += `• ${s}\n`);
  }

  return message;
}
```

---

### 4. Webhook 명령어 구현

#### `/admin prompt:add` - 새 프롬프트 추가
```typescript
// netlify/functions/webhook.ts

bot.command('admin', async (ctx) => {
  const userId = ctx.from?.id;
  if (!isAdmin(userId)) {
    await ctx.reply('❌ 관리자 권한이 필요합니다.');
    return;
  }

  const args = ctx.message?.text?.split(' ').slice(1);
  if (args.length === 0) {
    await ctx.reply(getAdminHelpMessage());
    return;
  }

  const subcommand = args[0];

  switch (subcommand) {
    case 'prompt:add':
      await handlePromptAdd(ctx);
      break;
    case 'prompt:review':
      await handlePromptReview(ctx, args[1]);
      break;
    case 'prompt:approve':
      await handlePromptApprove(ctx, args[1]);
      break;
    case 'prompt:reject':
      await handlePromptReject(ctx, args[1]);
      break;
    // ... other admin commands
  }
});

/**
 * /admin prompt:add 핸들러
 */
async function handlePromptAdd(ctx: Context) {
  await ctx.reply(
    '📝 **새 프롬프트 추가**\n\n' +
    '프롬프트 텍스트를 입력해주세요.\n' +
    '(여러 줄 입력 가능)\n\n' +
    '예시:\n' +
    '```\n' +
    'Create a professional business card design with the person from this photo. ' +
    'Include name, title, and contact information in a modern, clean layout.\n' +
    '```',
    { parse_mode: 'Markdown' }
  );

  // 다음 메시지를 프롬프트로 받기 위해 세션에 상태 저장
  await setUserState(ctx.from!.id, 'awaiting_prompt_input');
}

/**
 * 프롬프트 입력 후 자동 분석
 */
bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id;
  const state = await getUserState(userId);

  if (state === 'awaiting_prompt_input') {
    const rawPrompt = ctx.message.text;

    await ctx.reply('🔄 프롬프트를 분석 중입니다... (5-10초 소요)');

    try {
      const { analyzePromptWithLLM, saveAnalysisToQueue, formatAnalysisResult } =
        await import('../../src/services/prompt-analysis-service');

      // LLM 분석
      const analysis = await analyzePromptWithLLM(rawPrompt);

      // 대기열에 저장
      const queueId = await saveAnalysisToQueue(userId, rawPrompt, analysis);

      // 결과 표시
      const message = formatAnalysisResult(analysis);

      const keyboard = new InlineKeyboard()
        .text('✅ 승인하고 저장', `approve_prompt:${queueId}`)
        .row()
        .text('✏️ 수정', `edit_prompt:${queueId}`)
        .text('❌ 거부', `reject_prompt:${queueId}`);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      await clearUserState(userId);
    } catch (error) {
      console.error('❌ Error analyzing prompt:', error);
      await ctx.reply(
        '❌ 프롬프트 분석 중 오류가 발생했습니다.\n\n' +
        '다시 시도하려면 /admin prompt:add 를 입력하세요.'
      );
      await clearUserState(userId);
    }
  }
});

/**
 * 승인 버튼 핸들러
 */
bot.callbackQuery(/^approve_prompt:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const queueId = parseInt(ctx.match[1]);
  const userId = ctx.from?.id;

  try {
    const { saveAnalysisAsTemplate } = await import(
      '../../src/services/prompt-analysis-service'
    );

    const templateKey = await saveAnalysisAsTemplate(queueId, userId);

    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    await ctx.reply(
      `✅ **프롬프트가 저장되었습니다!**\n\n` +
      `Template Key: \`${templateKey}\`\n\n` +
      `사용자들이 이제 이 템플릿을 사용할 수 있습니다.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('❌ Error saving prompt:', error);
    await ctx.reply('❌ 저장 중 오류가 발생했습니다.');
  }
});

/**
 * 거부 버튼 핸들러
 */
bot.callbackQuery(/^reject_prompt:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const queueId = parseInt(ctx.match[1]);

  const { supabase } = await import('../../src/utils/supabase');
  await supabase
    .from('prompt_analysis_queue')
    .update({ status: 'rejected' })
    .eq('id', queueId);

  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  await ctx.reply('❌ 프롬프트가 거부되었습니다.');
});

/**
 * 수정 버튼 핸들러 (향후 구현)
 */
bot.callbackQuery(/^edit_prompt:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery('수정 기능은 곧 추가될 예정입니다.');
});
```

---

## 📋 구현 단계별 체크리스트

### Phase 1: 데이터베이스 및 기본 구조 (2-3일)
- [ ] `sql/022_prompt_management_system.sql` 작성
  - [ ] `prompt_analysis_queue` 테이블
  - [ ] `prompt_approval_log` 테이블
  - [ ] `prompt_templates` 컬럼 추가
- [ ] Supabase에 배포
- [ ] 테이블 생성 확인

### Phase 2: 프롬프트 분석 서비스 (3-4일)
- [ ] `src/services/prompt-analysis-service.ts` 작성
  - [ ] `analyzePromptWithLLM()` 구현
  - [ ] `saveAnalysisToQueue()` 구현
  - [ ] `saveAnalysisAsTemplate()` 구현
  - [ ] `saveParametersAndOptions()` 구현
- [ ] Claude API 시스템 프롬프트 최적화
- [ ] 단위 테스트 작성

### Phase 3: Webhook 명령어 구현 (2-3일)
- [ ] `/admin prompt:add` 명령어
- [ ] 프롬프트 입력 상태 관리
- [ ] 분석 결과 표시 및 승인/거부 버튼
- [ ] Callback query 핸들러
- [ ] 어드민 권한 체크

### Phase 4: 추가 관리 명령어 (2-3일)
- [ ] `/admin prompts` - 전체 프롬프트 목록
- [ ] `/admin prompt:stats <key>` - 특정 프롬프트 통계
- [ ] `/admin prompt:toggle <key>` - 활성화/비활성화
- [ ] `/admin prompt:edit <key>` - 프롬프트 수정
- [ ] `/admin prompt:delete <key>` - 프롬프트 삭제

### Phase 5: 테스트 및 배포 (2-3일)
- [ ] 실제 프롬프트 10개로 테스트
- [ ] 분석 품질 검증
- [ ] 문서 업데이트
- [ ] 프로덕션 배포

---

## 🧪 테스트 시나리오

### 시나리오 1: 명확한 프롬프트
**입력**:
```
Create a professional headshot of the person in this photo against a
solid white background. Enhance facial features, smooth skin texture,
and add studio-quality lighting. Ensure the person is well-groomed
and looking directly at the camera with a confident expression.
```

**예상 분석 결과**:
- title_ko: "📸 전문가용 헤드샷"
- category: "portrait_styling"
- min_images: 1, max_images: 1
- requires_face: true
- confidence: 0.9+
- warnings: []

---

### 시나리오 2: 파라미터가 포함된 프롬프트
**입력**:
```
Change the background of this photo to {background_type}. Keep the
person exactly as is, but place them in the new environment with
natural lighting and shadows.
```

**예상 분석 결과**:
- title_ko: "🌍 배경 변경"
- detected_parameters: [
    {
      parameter_key: "background_type",
      suggested_options: ["beach", "city", "forest", "studio", "space"]
    }
  ]
- confidence: 0.85
- improvement_suggestions: ["background_type 파라미터에 6개 옵션 제공 권장"]

---

### 시나리오 3: 애매한 프롬프트
**입력**:
```
Make the photo look better and more professional.
```

**예상 분석 결과**:
- confidence: 0.4
- warnings: [
    "프롬프트가 너무 모호합니다.",
    "'better'와 'professional'의 정의가 불명확합니다."
  ]
- improvement_suggestions: [
    "구체적인 개선 사항 명시 (화질, 조명, 배경 등)",
    "예시 이미지 또는 참고 스타일 제공"
  ]

---

### 시나리오 4: 이미지 개수 불일치
**입력**:
```
Swap the outfits between the person in Image1 and the person in Image2.
Keep their faces and poses unchanged.
```

**예상 분석 결과**:
- min_images: 2, max_images: 2
- warnings: [
    "이 프롬프트는 2장의 이미지가 필요합니다.",
    "사용자가 2장을 모두 업로드하는지 확인하세요."
  ]
- confidence: 0.85

---

## 📈 성공 지표

### 단기 (1개월)
- ✅ 프롬프트 분석 정확도: 85% 이상
- ✅ 파라미터 감지율: 80% 이상
- ✅ 어드민 승인율: 70% 이상 (30% 이하는 수정 필요)

### 중기 (3개월)
- 🎯 신규 프롬프트 추가 속도: 주 5-10개
- 🎯 프롬프트 평균 품질 점수: 4.0/5.0 이상
- 🎯 파라미터화 비율: 40% 이상

### 장기 (6개월)
- 🚀 전체 템플릿 개수: 100개 이상
- 🚀 자동 승인율: 50% 이상 (수정 없이 바로 승인)
- 🚀 사용자 커스텀 프롬프트 지원 (Beta)

---

## 🔐 보안 및 권한 관리

### 어드민 권한 체크
```typescript
function isAdmin(userId: number): boolean {
  const ADMIN_USER_IDS = [
    123456789, // 사용자 1
    987654321  // 사용자 2
  ];
  return ADMIN_USER_IDS.includes(userId);
}

// 또는 DB 기반 권한 체크
async function isAdmin(userId: number): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single();

  return data?.is_admin === true;
}
```

### Rate Limiting
```typescript
// LLM 분석 비용 절약을 위한 Rate Limit
const RATE_LIMITS = {
  prompt_analysis_per_admin_per_day: 50,
  prompt_analysis_per_admin_per_hour: 10
};

async function checkRateLimit(userId: number): Promise<boolean> {
  const { count } = await supabase
    .from('prompt_analysis_queue')
    .select('*', { count: 'exact', head: true })
    .eq('admin_user_id', userId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return (count || 0) < RATE_LIMITS.prompt_analysis_per_admin_per_day;
}
```

---

## 💰 비용 추정

### Claude API 비용
- **모델**: Claude Sonnet 4.5
- **Input**: ~500 tokens (시스템 프롬프트 + 사용자 프롬프트)
- **Output**: ~1000 tokens (JSON 응답)
- **단가**: Input $0.003/1K, Output $0.015/1K
- **1회 분석 비용**: ~$0.017

### 월간 비용 (예상)
- 신규 프롬프트 추가: 주 10개 × 4주 = 40개/월
- 재분석 (수정): 10개/월
- **총 50회 분석 × $0.017 = $0.85/월**

→ 매우 저렴한 비용으로 자동화 달성 ✅

---

## 🚀 향후 확장 계획

### Phase 6: 사용자 커스텀 프롬프트 (3개월 후)
- 일반 사용자가 자신만의 프롬프트 생성 가능
- 공개/비공개 설정
- 커뮤니티 템플릿 마켓플레이스

### Phase 7: A/B 테스트 시스템 (6개월 후)
- 동일 템플릿의 여러 프롬프트 버전 테스트
- 자동으로 성공률 높은 버전 선택
- 프롬프트 진화(Evolution) 시스템

### Phase 8: 멀티모달 분석 (1년 후)
- 샘플 이미지 업로드 시 자동으로 프롬프트 역공학
- "이런 스타일로 만들고 싶어요" → 프롬프트 자동 생성

---

## 📚 참고 문서

- `docs/PROMPT_ANALYSIS_AND_IMPROVEMENTS.md` - 현재 프롬프트 분석
- `sql/018_parameterized_templates.sql` - Parameterized 시스템
- `src/services/referral-service.ts` - 유사한 서비스 구조 참고

---

**다음 단계**: Phase 1 데이터베이스 스키마 작성 시작

*최종 수정: 2025-01-10*
