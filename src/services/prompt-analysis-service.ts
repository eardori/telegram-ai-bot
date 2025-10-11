/**
 * Prompt Analysis Service
 * LLM-powered automatic prompt analysis and structuring
 */

import { supabase } from '../utils/supabase';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!
});

// =============================================================================
// Types
// =============================================================================

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

export interface QueueEntry {
  id: number;
  admin_user_id: number;
  raw_prompt: string;
  suggested_title_ko: string;
  suggested_title_en: string;
  suggested_category: string;
  suggested_subcategory: string;
  suggested_min_images: number;
  suggested_max_images: number;
  requires_face: boolean;
  detected_parameters: DetectedParameter[];
  analysis_confidence: number;
  analysis_raw: PromptAnalysisResult;
  status: string;
  created_at: string;
  analyzed_at: string;
}

// =============================================================================
// LLM System Prompt
// =============================================================================

const PROMPT_ANALYSIS_SYSTEM_PROMPT = `
You are an expert prompt engineer for image generation APIs (like Flux, Nano Banafo, Replicate).
Analyze the given prompt and extract structured metadata.

Response format (JSON only, no markdown):
{
  "title_ko": "한글 제목 (이모지 포함, 예: 🎨 배경 변경)",
  "title_en": "English Title",
  "category": "3d_figurine | portrait_styling | image_editing | game_animation | creative_transform",
  "subcategory": "collectible | glamour | fashion | background | face | body | ...",
  "min_images": 1,
  "max_images": 1,
  "requires_face": true,
  "min_faces": 0,
  "description_ko": "이 템플릿이 무엇을 하는지 한 문장 설명",
  "description_en": "One sentence description",
  "detected_parameters": [
    {
      "parameter_key": "background_style",
      "parameter_name_ko": "배경 스타일",
      "parameter_name_en": "Background Style",
      "parameter_type": "select",
      "is_required": true,
      "suggested_options": [
        {
          "option_key": "beach_sunset",
          "option_name_ko": "석양 해변",
          "option_name_en": "Beach Sunset",
          "prompt_fragment": "a beautiful beach at sunset with golden hour lighting",
          "emoji": "🏖️"
        }
      ]
    }
  ],
  "priority_score": 70,
  "confidence": 0.85,
  "warnings": [
    "Warning message in Korean"
  ],
  "improvement_suggestions": [
    "Suggestion in Korean"
  ]
}

Analysis rules:
1. **Image count detection**:
   - If prompt mentions "Image1", "Image2" → min_images = number of distinct images
   - If prompt says "multiple images" → min_images = 2+
   - Default: min_images = 1, max_images = 1

2. **Face detection**:
   - requires_face = true if: person, face, portrait, expression, smile, etc.
   - requires_face = false for: objects, landscapes, abstract

3. **Category classification**:
   - 3d_figurine: figurine, toy, doll, plush, emoji, 3D character
   - portrait_styling: portrait, fashion, glamour, vintage photo
   - image_editing: swap, change, replace, enhance, remove, add
   - game_animation: game character, pixel art, animation
   - creative_transform: collage, photo strip, artistic transformation

4. **Parameter detection**:
   - Look for {placeholders}, [options], or variable parts
   - Suggest 4-6 preset options per parameter
   - Example: "change to {expression}" → detect "expression" parameter

5. **Priority scoring** (0-100):
   - 90-100: Highly viral, unique (figurines, glamour)
   - 70-89: Popular (background change, outfit swap)
   - 50-69: Niche but useful
   - 30-49: Specialized

6. **Confidence score** (0-1):
   - 0.9+: Very clear prompt
   - 0.7-0.9: Good prompt, minor ambiguity
   - 0.5-0.7: Vague, needs clarification
   - <0.5: Unclear

7. **Warnings**: Detect issues like:
   - Image count mismatch
   - Ambiguous instructions
   - Missing key details

8. **Subcategories**:
   - 3d_figurine: collectible, handcraft, plush, sticker
   - portrait_styling: glamour, location, cultural, vintage, retro, fashion, romantic, natural, professional, artistic
   - image_editing: composite, fashion, face, body, background, cleanup, perspective, environment, text, enhancement, restoration, beauty
   - game_animation: game, retro_game
   - creative_transform: album, photo_booth, polaroid, business

CRITICAL JSON FORMATTING RULES:
- Respond ONLY with valid JSON
- NO markdown code blocks (no \`\`\`json or \`\`\`)
- ALL string values MUST be properly escaped:
  * Use \\n for newlines (not actual line breaks)
  * Use \\" for quotes inside strings
  * Use \\\\ for backslashes
- Keep prompt_fragment values SHORT and simple (under 100 characters)
- Keep description fields SHORT (under 200 characters)
- If you need to include a long description, break it into shorter warning/suggestion items instead
`;

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Claude API를 사용하여 프롬프트 분석
 */
export async function analyzePromptWithLLM(
  rawPrompt: string
): Promise<PromptAnalysisResult> {
  try {
    console.log('🔍 Analyzing prompt with Claude API...');

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

    // Clean response text (remove markdown code blocks if present)
    let cleanText = textContent.text.trim();

    // Remove ```json and ``` markers if present
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    cleanText = cleanText.trim();

    // Additional safety: Try to fix common JSON issues
    let result: PromptAnalysisResult;
    try {
      result = JSON.parse(cleanText) as PromptAnalysisResult;
    } catch (parseError) {
      console.warn('⚠️ Initial JSON parse failed, attempting repair...');
      console.warn('Parse error:', parseError instanceof Error ? parseError.message : String(parseError));

      // Log first 500 chars of problematic JSON for debugging
      console.warn('Problematic JSON (first 500 chars):', cleanText.substring(0, 500));
      console.warn('Problematic JSON (chars 6000-6300):', cleanText.substring(6000, 6300));

      // Attempt common fixes:
      // 1. Remove unescaped newlines in strings (replace with \n)
      // 2. Fix unescaped quotes
      let repairedText = cleanText;

      // This is a basic repair - replace actual newlines inside quoted strings
      // Note: This is not perfect but handles most cases
      repairedText = repairedText.replace(/("(?:[^"\\]|\\.)*?")/g, (match) => {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      });

      try {
        result = JSON.parse(repairedText) as PromptAnalysisResult;
        console.log('✅ JSON repair successful');
      } catch (repairError) {
        console.error('❌ JSON repair failed');
        console.error('Repair error:', repairError instanceof Error ? repairError.message : String(repairError));
        throw new Error(
          `Failed to parse Claude response as JSON. Original error: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
      }
    }

    console.log('✅ Prompt analysis complete');
    console.log(`   Title: ${result.title_ko}`);
    console.log(`   Category: ${result.category}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`   Parameters: ${result.detected_parameters.length}`);

    return result;
  } catch (error) {
    console.error('❌ Error analyzing prompt:', error);
    if (error instanceof Error) {
      console.error('❌ Error stack:', error.stack);
    }
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
  try {
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

    console.log(`✅ Analysis saved to queue (ID: ${data.id})`);
    return data.id;
  } catch (error) {
    console.error('❌ Error saving analysis to queue:', error);
    throw error;
  }
}

/**
 * 분석 결과 조회
 */
export async function getAnalysisById(id: number): Promise<QueueEntry | null> {
  try {
    const { data, error } = await supabase
      .from('prompt_analysis_queue')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as QueueEntry;
  } catch (error) {
    console.error('❌ Error fetching analysis:', error);
    return null;
  }
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
 * 고유한 template_key 생성 (중복 방지)
 */
async function getUniqueTemplateKey(titleEn: string): Promise<string> {
  let baseKey = generateTemplateKey(titleEn);
  let counter = 1;
  let templateKey = baseKey;

  while (true) {
    const { data } = await supabase
      .from('prompt_templates')
      .select('template_key')
      .eq('template_key', templateKey)
      .single();

    if (!data) break; // Key is unique

    counter++;
    templateKey = `${baseKey.substring(0, 45)}_${counter}`;
  }

  return templateKey;
}

/**
 * 파라미터 및 옵션 저장
 */
async function saveParametersAndOptions(
  templateKey: string,
  parameters: DetectedParameter[]
): Promise<void> {
  try {
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
      if (param.suggested_options && param.suggested_options.length > 0) {
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

    console.log(`✅ Saved ${parameters.length} parameters with options`);
  } catch (error) {
    console.error('❌ Error saving parameters:', error);
    throw error;
  }
}

/**
 * 어드민 승인 후 실제 템플릿으로 저장
 */
export async function saveAnalysisAsTemplate(
  queueId: number,
  adminUserId: number,
  overrides?: Partial<PromptAnalysisResult>
): Promise<string> {
  try {
    // 1. 대기열에서 분석 결과 가져오기
    const analysis = await getAnalysisById(queueId);
    if (!analysis) {
      throw new Error(`Analysis ${queueId} not found`);
    }

    // 2. template_key 생성
    const templateKey = await getUniqueTemplateKey(
      overrides?.title_en || analysis.suggested_title_en
    );

    console.log(`📝 Creating template: ${templateKey}`);

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
    if (analysis.detected_parameters && analysis.detected_parameters.length > 0) {
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

    console.log(`✅ Template created successfully: ${templateKey}`);
    return templateKey;
  } catch (error) {
    console.error('❌ Error saving template:', error);
    throw error;
  }
}

/**
 * 템플릿 거부
 */
export async function rejectAnalysis(
  queueId: number,
  adminUserId: number,
  reason?: string
): Promise<void> {
  try {
    await supabase
      .from('prompt_analysis_queue')
      .update({ status: 'rejected' })
      .eq('id', queueId);

    // 로그 기록
    await supabase
      .from('prompt_approval_log')
      .insert({
        template_key: `queue_${queueId}`,
        admin_user_id: adminUserId,
        action: 'rejected',
        comment: reason || 'Rejected by admin'
      });

    console.log(`❌ Analysis ${queueId} rejected`);
  } catch (error) {
    console.error('❌ Error rejecting analysis:', error);
    throw error;
  }
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Escape special Markdown characters
 */
function escapeMarkdown(text: string): string {
  // Remove emojis first
  text = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

  // Escape Markdown special characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

/**
 * 분석 결과 포맷팅 (Telegram 메시지)
 */
export function formatAnalysisResult(analysis: PromptAnalysisResult): string {
  let message = `🔍 *프롬프트 분석 완료*\n\n`;

  message += `*제목*\n`;
  message += `• 한글: ${escapeMarkdown(analysis.title_ko)}\n`;
  message += `• 영문: ${escapeMarkdown(analysis.title_en)}\n\n`;

  message += `*분류*\n`;
  message += `• 카테고리: ${analysis.category}\n`;
  message += `• 서브카테고리: ${analysis.subcategory}\n\n`;

  message += `*이미지 요구사항*\n`;
  message += `• 최소 이미지: ${analysis.min_images}장\n`;
  message += `• 최대 이미지: ${analysis.max_images}장\n`;
  message += `• 얼굴 필요: ${analysis.requires_face ? '예' : '아니오'}\n\n`;

  message += `*설명*\n`;
  message += `${escapeMarkdown(analysis.description_ko)}\n\n`;

  if (analysis.detected_parameters.length > 0) {
    message += `*감지된 파라미터* (${analysis.detected_parameters.length}개)\n`;
    analysis.detected_parameters.forEach(param => {
      message += `• ${escapeMarkdown(param.parameter_name_ko)} (${param.suggested_options.length}개 옵션)\n`;
    });
    message += `\n`;
  }

  message += `*우선순위 점수*: ${analysis.priority_score}/100\n`;
  message += `*신뢰도*: ${(analysis.confidence * 100).toFixed(0)}%\n\n`;

  if (analysis.warnings.length > 0) {
    message += `⚠️ *경고사항*\n`;
    analysis.warnings.forEach(w => message += `• ${escapeMarkdown(w)}\n`);
    message += `\n`;
  }

  if (analysis.improvement_suggestions.length > 0) {
    message += `💡 *개선 제안*\n`;
    analysis.improvement_suggestions.forEach(s => message += `• ${escapeMarkdown(s)}\n`);
  }

  return message;
}

/**
 * 템플릿 저장 성공 메시지
 */
export function formatTemplateSavedMessage(templateKey: string): string {
  return (
    `✅ **프롬프트가 저장되었습니다!**\n\n` +
    `Template Key: \`${templateKey}\`\n\n` +
    `사용자들이 이제 이 템플릿을 사용할 수 있습니다.`
  );
}
