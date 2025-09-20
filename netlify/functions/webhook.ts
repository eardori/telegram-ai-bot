// Production Telegram Bot Webhook Handler
import { Handler, HandlerContext, HandlerEvent } from '@netlify/functions';
import { Bot, InputFile, webhookCallback } from 'grammy';

// Constants
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const IMAGEN_MODEL = 'imagen-4.0-generate-001';
const ANTHROPIC_VERSION = '2023-06-01';

// Gemini Files API Configuration
const FILES_API_THRESHOLD = 15 * 1024 * 1024; // 15MB threshold for Files API
const GEMINI_MODELS = {
  IMAGE_PREVIEW: 'gemini-2.5-flash-image-preview',
  FLASH_EXP: 'gemini-2.0-flash-exp',
  FLASH: 'gemini-1.5-flash'
} as const;

// Import prompt management utilities
import { getImagePrompt, getDobbyImagePrompt, getQAPrompt, getSystemMessage } from '../../src/utils/prompt-manager';

// Import tracking system
import { parseTrackingCommand, handleTrackingCommand, trackMessageMiddleware } from '../../src/utils/tracking-commands';

// Import error handling
import { ensureChatGroupExists, getUserFriendlyErrorMessage, logErrorWithContext } from '../../src/utils/error-handler';
import { TrackingError } from '../../src/types/tracking.types';

// Import version management
import { getVersionInfoForHelp, getFormattedVersionHistory } from '../../src/utils/version-manager';

// Environment variables - support both Netlify and Render naming
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

// =============================================================================
// COST CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate cost for Claude API usage
 * Pricing: ~$3 per million input tokens, ~$15 per million output tokens
 */
function calculateClaudeCost(inputTokens: number, outputTokens: number): number {
  const INPUT_COST_PER_MILLION = 3.0;
  const OUTPUT_COST_PER_MILLION = 15.0;

  const inputCost = (inputTokens / 1000000) * INPUT_COST_PER_MILLION;
  const outputCost = (outputTokens / 1000000) * OUTPUT_COST_PER_MILLION;

  return inputCost + outputCost;
}

/**
 * Calculate cost for Google Imagen API usage
 * Pricing: ~$0.020 per image
 */
function calculateImagenCost(): number {
  return 0.020;
}

/**
 * Calculate cost for Gemini Vision API usage
 * Pricing: ~$0.00025 per image analysis
 */
function calculateGeminiVisionCost(): number {
  return 0.00025;
}

/**
 * Calculate cost for Gemini Files API usage
 * Pricing: ~$0.0005 per image upload + processing cost
 */
function calculateGeminiFilesCost(): number {
  return 0.0005;
}

/**
 * Format cost display for users
 */
function formatCost(cost: number): string {
  if (cost < 0.001) {
    return '< $0.001';
  }
  return `$${cost.toFixed(3)}`;
}

// =============================================================================
// GEMINI FILES API INTEGRATION
// =============================================================================

/**
 * Upload image to Gemini Files API for processing large images (>15MB)
 * @param imageBuffer - Buffer containing image data
 * @param mimeType - MIME type of the image (e.g., 'image/jpeg')
 * @returns Promise resolving to file upload response
 */
async function uploadToGeminiFiles(imageBuffer: Buffer, mimeType: string): Promise<{uri: string, name: string}> {
  console.log(`📤 Uploading image to Gemini Files API (${imageBuffer.length} bytes, ${mimeType})`);

  const startTime = Date.now();

  try {
    // Create multipart form data
    const formData = new FormData();

    // Add metadata
    formData.append('metadata', JSON.stringify({
      file: {
        displayName: `telegram_image_${Date.now()}`
      }
    }));

    // Add the image file
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append('file', blob);

    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        body: formData
      },
      30000 // 30-second timeout for upload
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Files API upload failed: ${response.status} - ${errorText}`);
    }

    const fileData = await response.json();
    const uploadTime = Date.now() - startTime;

    console.log(`✅ File uploaded successfully in ${uploadTime}ms:`, {
      uri: (fileData as any).file?.uri,
      name: (fileData as any).file?.name,
      size: imageBuffer.length
    });

    return {
      uri: (fileData as any).file?.uri,
      name: (fileData as any).file?.name
    };
  } catch (error) {
    console.error('❌ Gemini Files API upload error:', error);
    throw error;
  }
}

/**
 * Delete file from Gemini Files API after processing
 * @param fileUri - URI of the file to delete
 */
async function deleteGeminiFile(fileUri: string): Promise<void> {
  try {
    console.log(`🗑️ Cleaning up Gemini file: ${fileUri}`);

    const response = await fetchWithTimeout(
      `${fileUri}?key=${GOOGLE_API_KEY}`,
      {
        method: 'DELETE'
      },
      10000 // 10-second timeout for deletion
    );

    if (response.ok) {
      console.log(`✅ File deleted successfully: ${fileUri}`);
    } else {
      console.warn(`⚠️ File deletion failed (${response.status}), but continuing...`);
    }
  } catch (error) {
    console.warn('⚠️ File cleanup failed (but continuing):', error);
    // Don't throw - cleanup failure shouldn't stop the main flow
  }
}

/**
 * Process image using Gemini Files API with file URI
 * @param fileUri - URI of the uploaded file
 * @param editRequest - The editing request from user
 * @param modelName - Gemini model to use
 * @returns Promise resolving to API response
 */
async function processImageWithFilesAPI(
  fileUri: string,
  editRequest: string,
  modelName: string
): Promise<Response> {
  console.log(`🔄 Processing image with Files API using ${modelName}`);

  const requestBody = {
    contents: [{
      parts: [
        {
          text: modelName.includes('2.5-flash-image-preview')
            ? `Generate an edited version of this image with the following modification: ${editRequest}

Important: You must return the edited image itself, not a text description.
Apply the requested changes directly to the image while preserving the original subjects and composition.
Output: Modified image with the requested changes applied.`
            : `You are an image editor. Edit this image based on: "${editRequest}"

Modify the image to fulfill this request while maintaining the original subjects and composition.
Apply the specific changes requested.`
        },
        {
          fileData: {
            mimeType: "image/jpeg",
            fileUri: fileUri
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192
    }
  };

  return await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    },
    30000 // 30-second timeout
  );
}

// =============================================================================
// ENHANCED FETCH WITH TIMEOUT
// =============================================================================

/**
 * Enhanced fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Create bot instance with validation
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is not set!');
  console.error('Available env vars:', Object.keys(process.env).filter(k => !k.includes('KEY')));
}

const bot = new Bot(BOT_TOKEN || 'dummy-token-for-build');

// =============================================================================
// DUPLICATE MESSAGE PREVENTION
// =============================================================================

// In-memory cache to prevent duplicate message processing
const processedMessages = new Set<string>();
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MESSAGE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Cleanup old message IDs periodically
setInterval(() => {
  const now = Date.now();
  processedMessages.forEach((messageKey) => {
    const [timestamp] = messageKey.split(':');
    if (now - parseInt(timestamp) > MESSAGE_CACHE_TTL) {
      processedMessages.delete(messageKey);
    }
  });
}, CACHE_CLEANUP_INTERVAL);

// Middleware to prevent duplicate processing
bot.use(async (ctx, next) => {
  const message = ctx.message;
  if (!message) return next();
  
  // Create unique message key: timestamp:chat_id:message_id:user_id
  const messageKey = `${Date.now()}:${ctx.chat.id}:${message.message_id}:${ctx.from?.id}`;
  const checkKey = `${ctx.chat.id}:${message.message_id}:${ctx.from?.id}`;
  
  // Check if we've already processed this message
  const alreadyProcessed = Array.from(processedMessages).some(key => key.includes(checkKey));
  
  if (alreadyProcessed) {
    console.log(`🔄 Duplicate message detected, skipping: ${checkKey}`);
    return; // Skip duplicate processing
  }
  
  // Mark message as being processed
  processedMessages.add(messageKey);
  console.log(`✅ Processing new message: ${checkKey}`);
  
  return next();
});

// Add tracking middleware to track messages when tracking is active
bot.use(trackMessageMiddleware);

// Error handling middleware
bot.use(async (ctx, next) => {
  try {
    // Ensure chat group exists in database
    await ensureChatGroupExists(ctx);
    await next();
  } catch (error) {
    console.error('Bot middleware error:', error);
    logErrorWithContext(error as Error, {
      chat_id: ctx.chat?.id,
      user_id: ctx.from?.id,
      message_text: ctx.message && 'text' in ctx.message ? ctx.message.text : null

    });
    
    if (error instanceof TrackingError) {
      await ctx.reply(getUserFriendlyErrorMessage(error));
    } else {
      await ctx.reply(`🧙‍♀️ **도비가 예상치 못한 문제를 만났습니다...**

❌ 일시적인 오류가 발생했습니다.

💡 잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의해주세요.`);
    }
  }
});

// Helper function to generate image with Imagen
async function generateImageWithImagen(userInput: string, isDobby: boolean = false, userId?: string, chatId?: string) {
  const startTime = Date.now();

  try {
    console.log(`🎨 Generating image with Imagen for: "${userInput}"`);

    // Get dynamic prompt from database
    const enhancedPrompt = isDobby
      ? await getDobbyImagePrompt(userInput)
      : await getImagePrompt(userInput);

    console.log(`📝 Using enhanced prompt: "${enhancedPrompt}"`);

    // Use reduced timeout to fit within Netlify's 10-second limit
    // Reduce image size for faster generation
    const response = await fetchWithTimeout(
      'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GOOGLE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [{ prompt: enhancedPrompt }],
          parameters: {
            sampleCount: 1,
            sampleImageSize: '1K',  // Imagen 4.0 requires 1K or 2K
            aspectRatio: '1:1'
          }
        })
      },
      20000 // 20-second timeout for Render.com (30-second limit)
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Imagen API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    console.log(`🎨 Image generation successful in ${processingTime}ms!`);

    // Calculate cost
    const imageCost = calculateImagenCost();

    if ((data as any).predictions && (data as any).predictions.length > 0) {
      const prediction = (data as any).predictions[0];
      if (prediction.bytesBase64Encoded) {
        return {
          imageData: prediction.bytesBase64Encoded,
          mimeType: prediction.mimeType || 'image/png',
          cost: imageCost,
          processingTime
        };
      }
    }

    throw new Error('No image data in response');
  } catch (error) {
    console.error('Imagen API error:', error);
    throw error;
  }
}

// Helper function for Claude API with dynamic prompts
async function callClaudeAPI(message: string, maxTokens: number = 2000, temperature: number = 0.7) {
  const startTime = Date.now();

  try {
    // Use enhanced fetch with timeout
    const response = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: maxTokens,
          temperature: temperature,
          messages: [{
            role: 'user',
            content: message
          }]
        })
      },
      45000 // 45-second timeout for Claude API (increased from 20s due to timeouts)
    );


    const data = await response.json();
    const processingTime = Date.now() - startTime;

    if (response.ok) {
      const responseText = (data as any).content[0]?.text || '응답이 없습니다.';

      // Calculate cost based on token usage
      const usage = (data as any).usage;
      const inputTokens = usage?.input_tokens || 0;
      const outputTokens = usage?.output_tokens || 0;
      const cost = calculateClaudeCost(inputTokens, outputTokens);

      return {
        text: responseText,
        cost,
        processingTime,
        inputTokens,
        outputTokens
      };
    } else {
      const errorText = await response.text();
      console.error('Claude API Error Response:', errorText);
      throw new Error((data as any).error?.message || `알 수 없는 오류: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Claude API Error:', error);
    throw error;
  }
}

// Helper function for Claude API (Vision) with retry logic
async function callClaudeVisionAPI(prompt: string, imageData: string, mediaType: string, retries: number = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 Retrying Claude Vision API (attempt ${attempt + 1}/${retries + 1})...`);
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }

      console.log(`🖼️ Calling Claude Vision API for prompt: "${prompt}"`);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageData,
              },
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })
    });

      if (response.ok) {
        const data = await response.json();
        console.log('🖼️ Claude Vision API call successful!');
        return (data as any).content[0]?.text || '이미지 분석에 실패했습니다.';
      } else {
        // Try to parse error response
        let errorMessage = `Vision API 오류: ${response.status} ${response.statusText}`;
        let isOverloaded = false;
        try {
          const errorData = await response.json();
          console.error('Claude Vision API Error Response:', errorData);
          errorMessage = (errorData as any).error?.message || errorMessage;
          // Check if it's an overload error
          isOverloaded = (errorData as any).error?.type === 'overloaded_error' ||
                        errorMessage.toLowerCase().includes('overloaded');
        } catch {
          // If JSON parsing fails, use default error message
          console.error('Could not parse error response body');
        }

        // If it's an overload error and we have retries left, throw to retry
        if (isOverloaded && attempt < retries) {
          console.log('🔄 Claude API is overloaded, will retry...');
          throw new Error(errorMessage);
        } else {
          // Final error, no more retries
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      console.error(`Claude Vision API Error (attempt ${attempt + 1}):`, error);

      // If this is the last attempt, throw the error
      if (attempt === retries) {
        throw error;
      }
      // Otherwise, continue to next iteration for retry
    }
  }

  // Should not reach here, but just in case
  throw new Error('Claude Vision API failed after all retries');
}

// Centralized error handler
async function handleError(ctx: any, error: Error, command: string, thinkingMessage: any = null) {
  console.error(`Error in ${command}:`, error);

  const errorMessage = `❌ **'${command}' 작업 중 오류 발생**

**오류 내용:**
${error.message}

💡 잠시 후 다시 시도해 보시거나, 문제가 계속되면 관리자에게 문의해주세요.`;

  try {
    if (thinkingMessage?.message_id) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        thinkingMessage.message_id,
        errorMessage
      );
    } else {
      await ctx.reply(errorMessage);
    }
  } catch (replyError) {
    console.error('Failed to send error message to user:', replyError);
  }
}

// Helper function to detect questions
function isQuestion(text: string): boolean {
  const questionPatterns = [
    /\?$/,                    // ends with ?
    /^(뭐|무엇|어떻|어디|언제|왜|누구|어느)/,  // Korean question words
    /^(what|how|where|when|why|who|which)/i,  // English question words
    /(방법|어떻게|알려줘|궁금)/,    // asking for help/info
    /(추천|제안|의견)/,           // asking for recommendations
  ];

  return questionPatterns.some(pattern => pattern.test(text.trim()));
}

// Helper function to detect Dobby activation
function isDobbyActivated(text: string): { activated: boolean; command: string | null; content: string } {
  const dobbyPattern = /도비야[,\s]*(.*)/i;
  const match = text.match(dobbyPattern);

  if (!match) {
    return { activated: false, command: null, content: '' };
  }

  const content = match[1].trim();

  // Check for help commands
  if (/(사용법|도움말|사용방법|메뉴얼|가이드|명령어 알려|도움 줘|help)/i.test(content)) {
    return { activated: true, command: 'help', content: content };
  }

  // Check for image generation commands
  if (/(그려줘|그려|그림|이미지|생성)/i.test(content)) {
    // Remove only the final command words, not all occurrences
    const imagePrompt = content
      .replace(/\s*(그림을\s+)?그려줘\s*$/i, '')  // Remove "그림을 그려줘" at the end
      .replace(/\s*그려줘\s*$/i, '')  // Remove "그려줘" at the end
      .replace(/\s*그려\s*$/i, '')  // Remove "그려" at the end
      .replace(/\s*만들어줘\s*$/i, '')  // Remove "만들어줘" at the end
      .replace(/\s*생성해줘\s*$/i, '')  // Remove "생성해줘" at the end
      .trim();
    return { activated: true, command: 'image', content: imagePrompt };
  }

  // Check for Q&A commands
  if (/(알려줘|뭐야|설명해|가르쳐|궁금)/i.test(content)) {
    return { activated: true, command: 'ask', content: content };
  }

  // Default to Q&A if no specific command detected
  return { activated: true, command: 'ask', content: content };
}

// Enhanced Q&A function with dynamic prompts
async function answerQuestion(question: string, isDobby: boolean = false, userId?: string, chatId?: string) {
  try {
    console.log(`🤔 Processing question: "${question}"`);

    // Get dynamic prompt from database
    const { prompt, maxTokens, temperature } = await getQAPrompt(question, isDobby);

    console.log(`📝 Using ${isDobby ? 'Dobby' : 'standard'} prompt template`);

    const claudeResponse = await callClaudeAPI(prompt, maxTokens, temperature);

    return {
      text: claudeResponse.text,
      cost: claudeResponse.cost,
      processingTime: claudeResponse.processingTime,
      tokenUsage: {
        input: claudeResponse.inputTokens,
        output: claudeResponse.outputTokens
      }
    };
  } catch (error) {
    console.error('Q&A Error:', error);
    throw error;
  }
}

// Helper function to get help message content
async function getHelpMessage(): Promise<string> {
  try {
    const versionInfo = await getVersionInfoForHelp();

    return `🧙‍♀️ **도비 AI 봇입니다!** 🏠

${versionInfo}

🌟 **도비 개인비서 모드:**
• 🎨 **"도비야, ~~~ 그려줘"** - 마법같은 이미지 생성
• 💬 **"도비야, ~~~ 알려줘/뭐야?"** - 충실한 질문 답변
• 🖼️ **사진에 답장** - 이미지 편집 및 수정

📝 **NEW! 대화 추적 및 요약 기능:**
• **"도비야, 대화 추적 시작해줘"** - 중요한 대화 기록 시작
• **"도비야, 대화 추적 그만해줘"** - 추적 중단
• **"도비야, 요약해줘"** - 추적된 대화를 똑똑하게 요약
• 📊 개인별 추적 - 각자 원하는 대로 추적 가능

🤖 **일반 AI 기능:**
• /ask [질문] - 명시적 질문하기
• /image [설명] - 이미지 생성
• /help - 사용법 보기
• /version - 버전 기록 확인
• 자동 질문 감지 - 질문하면 바로 답변

🎯 **추적 시스템 명령어:**
• /track_start - 대화 추적 시작
• /track_stop - 대화 추적 중단
• /summarize - 대화 요약 생성
• /track_status - 현재 추적 상태 확인

🧙‍♀️ **도비 사용 예시:**
• "도비야, 귀여운 강아지 그려줘"
• "도비야, 파이썬 공부법 알려줘"
• "도비야, 대화 추적 시작해줘"
• "도비야, 요약해줘"
• "도비야, 사용법 알려줘"

✨ **도비의 특별함:**
• 🎭 해리포터 도비 캐릭터 스타일
• 🏠 "주인님"을 위한 충실한 서비스
• 🔮 마법같은 AI 능력 (Google Imagen 4.0 + Claude 3.5)
• 📚 똑똑한 대화 요약 (개인별 맞춤)

🎯 **도비는 언제나 준비되어 있습니다!**
"도비야"라고 불러주시면 즉시 달려갑니다! 🏃‍♂️✨`;
  } catch (error) {
    console.error('Error getting help message:', error);
    // Fallback to basic message
    return `🧙‍♀️ **도비 AI 봇입니다!** 🏠

🤖 **도비 봇 v1.0.0** (개발 중)

🌟 **도비 개인비서 모드:**
• 🎨 **"도비야, ~~~ 그려줘"** - 마법같은 이미지 생성
• 💬 **"도비야, ~~~ 알려줘/뭐야?"** - 충실한 질문 답변
• 🖼️ **사진에 답장** - 이미지 편집 및 수정

📝 **대화 추적 및 요약 기능:**
• **"도비야, 대화 추적 시작해줘"** - 중요한 대화 기록 시작
• **"도비야, 대화 추적 그만해줘"** - 추적 중단
• **"도비야, 요약해줘"** - 추적된 대화를 똑똑하게 요약

🎯 **도비는 언제나 준비되어 있습니다!**
"도비야"라고 불러주시면 즉시 달려갑니다! 🏃‍♂️✨`;
  }
}

// Bot commands
bot.command('start', async (ctx) => {
  console.log('📨 Start command received');
  const helpMessage = await getHelpMessage();
  await ctx.reply(helpMessage);
});

// Help command - shows same content as start
bot.command('help', async (ctx) => {
  console.log('❓ Help command received');
  const helpMessage = await getHelpMessage();
  await ctx.reply(helpMessage);
});

// Version command - shows version history
bot.command('version', async (ctx) => {
  console.log('📚 Version command received');

  try {
    const versionHistory = await getFormattedVersionHistory(5);
    await ctx.reply(`${versionHistory}

💡 **명령어:**
• /version - 최근 5개 버전 보기
• /help - 사용법 보기

🏠 도비가 지속적으로 발전하고 있습니다!`);

  } catch (error) {
    console.error('Error fetching version history:', error);
    await ctx.reply(`❌ **버전 정보를 가져오는 중 오류가 발생했습니다**

${(error as Error).message}

💡 잠시 후 다시 시도해주세요.`);
  }
});

bot.command('test', async (ctx) => {
  console.log('🧪 Test command received');
  await ctx.reply(`🧪 프로덕션 테스트 성공!

🌐 배포 환경:
• 플랫폼: ✅ Netlify Functions
• 통신 방식: ✅ Webhook (실시간)
• Claude API: ✅ ${CLAUDE_API_KEY ? '연결됨' : '❌ 미연결'}
• Google Imagen: ✅ ${GOOGLE_API_KEY ? '연결됨' : '❌ 미연결'}

⏰ 서버 시간: ${new Date().toISOString()}
🌍 항상 온라인 상태로 운영됩니다!`);
});

bot.command('summary', async (ctx) => {
  console.log('📝 Summary command received');
  try {
    const claudeResponse = await callClaudeAPI('안녕하세요! 프로덕션 환경에서 테스트입니다. 한국어로 짧게 인사해주세요.');
    await ctx.reply(`🎉 Claude API 프로덕션 테스트 성공!

Claude의 응답:
${claudeResponse.text}

💰 비용: ${formatCost(claudeResponse.cost)}
⏱️ 처리시간: ${claudeResponse.processingTime}ms
🔤 토큰 사용량: ${claudeResponse.inputTokens} → ${claudeResponse.outputTokens}

✅ 서버리스 환경에서 AI 연동 완료!`);

  } catch (error) {
    await handleError(ctx, error as Error, 'Claude API 테스트');
  }
});

bot.command('image', async (ctx) => {
  const prompt = ctx.message?.text?.replace('/image', '').trim() || '';
  if (!prompt) {
    await ctx.reply(`🎨 **이미지 생성 사용법:**\n\n/image [상세한 설명]\n\n예시:\n• /image 미래적인 로봇 개발자`);
    return;
  }

  console.log(`🎨 Image generation requested: "${prompt}"`);
  const generatingMessage = await ctx.reply(`🎨 이미지 생성 중...\n\n프롬프트: "${prompt}"`);

  try {
    const imageResult = await generateImageWithImagen(prompt, false, ctx.from?.id?.toString(), ctx.chat?.id?.toString());

    // Create buffer from base64

    const imageBuffer = Buffer.from(imageResult.imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

    await ctx.replyWithPhoto(new InputFile(imageBuffer, `generated_${Date.now()}.png`), {
      caption: `🎨 프로덕션 이미지 생성 완료!

프롬프트: "${prompt}"

✨ Google Imagen 4.0
🌐 Netlify Functions
🎯 해상도: 1024x1024
💰 비용: ${formatCost(imageResult.cost)}
⏱️ 처리시간: ${imageResult.processingTime}ms
📅 ${new Date().toLocaleString('ko-KR')}`

    });

    await ctx.api.deleteMessage(ctx.chat.id, generatingMessage.message_id);
    console.log('✅ Image sent successfully!');
  } catch (error) {
    await handleError(ctx, error as Error, '이미지 생성', generatingMessage);
  }
});

// Generate command for image creation (also used for 2-stage editing)
bot.command('generate', async (ctx) => {
  const prompt = ctx.message?.text?.replace('/generate', '').trim() || '';

  if (!prompt) {
    await ctx.reply(`🎨 **이미지 생성 사용법:**

/generate [프롬프트]

예시:
• /generate 귀여운 강아지가 공원에서 노는 모습
• /generate futuristic city with flying cars
• /generate 아름다운 일몰이 있는 해변

💡 **이미지 편집 후 사용:**
이미지 분석 후 제공된 프롬프트로 생성 가능`);
    return;
  }

  console.log(`🎨 Generating image with prompt: "${prompt}"`);
  const generatingMessage = await ctx.reply(`🎨 **이미지 생성 중...**

📝 프롬프트: "${prompt}"
🤖 AI: Google Imagen 4.0
⚡ 잠시만 기다려주세요...`);

  try {
    const imageResult = await generateImageWithImagen(prompt, false, ctx.from?.id?.toString(), ctx.chat?.id?.toString());

    // Create buffer from base64
    const imageBuffer = Buffer.from(imageResult.imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

    await ctx.replyWithPhoto(new InputFile(imageBuffer, `generated_${Date.now()}.png`), {
      caption: `🎨 **이미지 생성 완료!**

📝 **프롬프트**: "${prompt}"
✨ **AI**: Google Imagen 4.0
💰 **비용**: ${formatCost(imageResult.cost)}
⏱️ **처리시간**: ${imageResult.processingTime}ms

📅 ${new Date().toLocaleString('ko-KR')}`
    });

    await ctx.api.deleteMessage(ctx.chat.id, generatingMessage.message_id);
    console.log('✅ Image sent successfully!');

  } catch (error) {
    await handleError(ctx, error as Error, '이미지 생성', generatingMessage);
  }
});

bot.command('ask', async (ctx) => {
  const question = ctx.message?.text?.replace('/ask', '').trim() || '';
  if (!question) {
    await ctx.reply(`🤔 **AI 질문답변 사용법:**\n\n/ask [질문내용]\n\n예시:\n• /ask 파이썬 문법 어떻게 배워?`);
    return;
  }

  console.log(`🔍 Explicit question asked: "${question}"`);
  const thinkingMessage = await ctx.reply(`🤔 질문을 분석하고 있습니다...\n\n질문: "${question}"`);

  try {
    const answerResult = await answerQuestion(question, false, ctx.from?.id?.toString(), ctx.chat?.id?.toString());

    // Delete thinking message and send answer
    await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);

    await ctx.reply(`🤖 **AI 답변** (/ask 명령어)

❓ **질문:** ${question}

💡 **답변:**
${answerResult.text}

💰 **비용:** ${formatCost(answerResult.cost)}
⏱️ **처리시간:** ${answerResult.processingTime}ms
🔤 **토큰:** ${answerResult.tokenUsage.input} → ${answerResult.tokenUsage.output}

---
✨ 추가 질문이 있으면 언제든 /ask [질문] 하세요!
⏰ ${new Date().toLocaleString('ko-KR')}`);


    console.log('✅ Explicit question answered successfully!');
  } catch (error) {
    await handleError(ctx, error as Error, '질문 답변', thinkingMessage);
  }
});

// Tracking Commands
bot.command('track_start', async (ctx) => {
  console.log('🟢 /track_start command received');
  const command = parseTrackingCommand('/track_start', ctx);
  if (command) {
    await handleTrackingCommand(command, ctx);
  }
});

bot.command('track_stop', async (ctx) => {
  console.log('🔴 /track_stop command received');
  const command = parseTrackingCommand('/track_stop', ctx);
  if (command) {
    await handleTrackingCommand(command, ctx);
  }
});

bot.command('summarize', async (ctx) => {
  console.log('📝 /summarize command received');
  const command = parseTrackingCommand('/summarize', ctx);
  if (command) {
    await handleTrackingCommand(command, ctx);
  }
});

bot.command('track_status', async (ctx) => {
  console.log('📊 /track_status command received');
  const command = parseTrackingCommand('/track_status', ctx);
  if (command) {
    await handleTrackingCommand(command, ctx);
  }
});

// Health check and maintenance commands (admin only)
bot.command('health', async (ctx) => {
  console.log('🏥 /health command received');
  
  try {
    const { performHealthCheck } = await import('../../src/utils/error-handler');
    const health = await performHealthCheck();
    
    const statusEmoji = {
      database: health.database ? '✅' : '❌',
      claude_api: health.claude_api ? '✅' : '❌',
      tracking_system: health.tracking_system ? '✅' : '❌'
    };
    
    await ctx.reply(`🏥 **시스템 상태 점검 결과**

📊 **서비스 상태:**
• 데이터베이스: ${statusEmoji.database}
• Claude AI: ${statusEmoji.claude_api}  
• 추적 시스템: ${statusEmoji.tracking_system}

${health.issues.length > 0 ? `⚠️ **발견된 문제:**\n${health.issues.map(issue => `• ${issue}`).join('\n')}` : '✅ 모든 시스템이 정상 작동 중입니다!'}

⏰ 점검 시간: ${new Date().toLocaleString('ko-KR')}`);

  } catch (error) {
    console.error('Health check error:', error);
    await ctx.reply(`❌ 상태 점검 중 오류가 발생했습니다: ${(error as Error).message}`);
  }
});

bot.command('maintenance', async (ctx) => {
  console.log('🔧 /maintenance command received');
  
  try {
    const { recoverOrphanedSessions, performConsistencyCheck } = await import('../../src/utils/error-handler');
    
    const maintenanceMsg = await ctx.reply('🔧 **시스템 유지보수를 시작합니다...**\n\n⏳ 데이터 정리 및 복구 중...');
    
    // Perform maintenance tasks
    const [recovery, consistency] = await Promise.all([
      recoverOrphanedSessions(),
      performConsistencyCheck()
    ]);
    
    await ctx.api.editMessageText(
      ctx.chat.id,
      maintenanceMsg.message_id,
      `🔧 **시스템 유지보수 완료**

📊 **세션 복구:**
• 복구됨: ${recovery.recovered}개
• 만료됨: ${recovery.expired}개

🔍 **데이터 일관성 검사:**
• 사용자 추적 상태 수정: ${consistency.fixed_user_tracking}개
• 세션 통계 수정: ${consistency.fixed_session_stats}개
• 정리된 메시지: ${consistency.cleaned_messages}개

✅ 유지보수가 성공적으로 완료되었습니다!

⏰ 완료 시간: ${new Date().toLocaleString('ko-KR')}`
    );

  } catch (error) {
    console.error('Maintenance error:', error);
    await ctx.reply(`❌ 유지보수 중 오류가 발생했습니다: ${(error as Error).message}`);
  }
});

// Handle photo messages with editing capability
bot.on('message:photo', async (ctx) => {
  console.log('📸 Photo message received');

  // Skip if message is from the bot itself
  if (ctx.from?.is_bot || ctx.from?.id === ctx.me?.id) {
    return;
  }

  const caption = ctx.message.caption || '';

  // Check if user wants analysis (with caption like "분석해줘", "뭐야", "설명해줘" or with "도비야")
  const analysisKeywords = /(분석|설명|뭐야|뭐지|알려줘|무엇|what|analyze|describe|explain)/i;
  const isDobbyRequest = caption.includes('도비야');

  if (isDobbyRequest || analysisKeywords.test(caption)) {
    console.log('🔍 Photo analysis requested');

    try {
      // Get the largest photo
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const file = await ctx.api.getFile(photo.file_id);

      if (!file.file_path) {
        await ctx.reply('❌ 이미지 파일을 가져올 수 없습니다.');
        return;
      }

      // Send processing message
      const processingMsg = isDobbyRequest
        ? await ctx.reply(`🧙‍♀️ **도비가 이미지를 분석하고 있습니다!**

👁️ **마법의 눈으로 살펴보는 중...**
🪄 도비의 분석 마법: Gemini Vision AI

⚡ 잠시만 기다려주세요...`)
        : await ctx.reply(`🔍 **이미지 분석 중...**

👁️ AI가 이미지를 살펴보고 있습니다...
🤖 분석 도구: Gemini Vision

⏳ 잠시만 기다려주세요...`);

      // Download image
      const imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
      const imageResponse = await fetchWithTimeout(imageUrl, {}, 10000);
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');

      // Extract request from caption
      const userRequest = caption.replace(/도비야[,\s]*/i, '').trim();

      // Analyze image with Gemini Vision
      const analysisPrompt = userRequest
        ? `Please analyze this image and respond to the user's request in Korean: "${userRequest}". Provide a detailed, helpful response.`
        : `Please analyze this image in detail. Describe what you see, including:
1. Main subjects and objects
2. Setting/background
3. Colors and composition
4. Any text or notable details
5. Overall mood or atmosphere

Provide the analysis in Korean.`;

      console.log('🔍 Analyzing image with Gemini Vision...');
      const startTime = Date.now();

      // Call Gemini Vision API with timeout
      const visionResponse = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: analysisPrompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: imageBase64
                  }
                }
              ]
            }]
          })
        },
        15000
      );

      if (!visionResponse.ok) {
        throw new Error(`Gemini Vision API error: ${visionResponse.status}`);
      }

      const visionData = await visionResponse.json();
      const analysis = (visionData as any).candidates?.[0]?.content?.parts?.[0]?.text;

      if (!analysis) {
        throw new Error('No analysis received from Gemini Vision');
      }

      const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
      const cost = calculateGeminiVisionCost();

      console.log('📝 Image analysis completed');

      // Delete processing message
      await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id);

      // Send analysis result
      const resultMessage = isDobbyRequest
        ? `🧙‍♀️ **도비의 이미지 분석 완료!**

${analysis}

💰 비용: $${cost.toFixed(4)}
⏱️ 처리 시간: ${processingTime}초
👁️ 분석 도구: Gemini Vision AI

도비가 도움이 되었기를 바랍니다! 🧙‍♀️`
        : `🔍 **이미지 분석 결과**

${analysis}

💰 비용: $${cost.toFixed(4)}
⏱️ 처리 시간: ${processingTime}초
🤖 AI: Gemini Vision`;

      await ctx.reply(resultMessage, {
        reply_to_message_id: ctx.message.message_id
      });

      console.log('✅ Image analysis sent successfully');

    } catch (error) {
      console.error('❌ Image analysis error:', error);

      const errorMessage = isDobbyRequest
        ? `🧙‍♀️ **도비가 실수했습니다...**

❌ 이미지 분석 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}

💡 다시 시도해주세요!`
        : `❌ **이미지 분석 실패**

오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}

💡 다시 시도해보세요.`;

      await ctx.reply(errorMessage);
    }
  } else {
    // If no analysis requested, just acknowledge the photo
    await ctx.reply(`📸 사진을 받았습니다!

💡 **사용 가능한 기능:**
• 캡션에 "도비야, 분석해줘" - 이미지 분석
• 캡션에 "뭐야?" 또는 "설명해줘" - 이미지 설명
• Reply로 "편집해줘" - 이미지 편집
• Reply로 "배경 바꿔줘" - 배경 변경`);
  }
});

// Handle ALL text messages - unified handler
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  const replyToMessage = ctx.message.reply_to_message;
  
  console.log(`💬 DEBUGGING - Message received: "${text}"`);
  console.log(`💬 DEBUGGING - From user: ${ctx.from?.first_name} (ID: ${ctx.from?.id})`);
  console.log(`💬 DEBUGGING - Is bot: ${ctx.from?.is_bot}`);
  console.log(`💬 DEBUGGING - Bot ID: ${ctx.me?.id}`);

  // 🚨 CRITICAL: Skip if message is from the bot itself to prevent infinite loops
  if (ctx.from?.is_bot || ctx.from?.id === ctx.me?.id) {
    console.log(`🤖 Skipping bot's own message: ${text}`);
    return;
  }

  // 🚨 CRITICAL: Skip if this is a command - let command handlers process them
  if (text.startsWith('/')) {
    console.log(`⚡ Skipping command "${text}" - letting command handlers process it`);
    return;
  }

  // [REMOVED] Duplicate image editing handler - using the improved one below
  
  // Check if this is a reply to a photo with editing request
  if (replyToMessage && 'photo' in replyToMessage && replyToMessage.photo) {
    console.log('🖼️ Reply to photo detected, checking for editing request...');
    console.log('📝 Reply text:', text);
    console.log('📷 Photo count:', replyToMessage.photo.length);

    // Check for Dobby-style editing request or direct editing keywords
    const isDobbyEdit = text.includes('도비야');
    const editingKeywords = /(편집|수정|보정|바꿔|변경|조정|개선|만들어|추가|배경|예쁘게|멋지게|enhance|edit|modify|adjust|add|create|change|background)/i;

    if (isDobbyEdit || editingKeywords.test(text)) {
      console.log('✏️ Image editing request detected!');
      console.log('🔍 Is Dobby edit:', isDobbyEdit);
      console.log('📝 Edit request:', text);
      
      try {
        // Get the largest photo
        console.log('📷 Getting largest photo from message...');
        const photo = replyToMessage.photo[replyToMessage.photo.length - 1];
        console.log('📷 Photo file_id:', photo.file_id);

        console.log('🔄 Getting file info from Telegram API...');
        const file = await ctx.api.getFile(photo.file_id);
        console.log('📁 File path:', file.file_path);

        // Declare variables at the start of the try block
        let uploadedFileUri: string | null = null;
        let useFilesAPI = false;

        if (!file.file_path) {
          console.error('❌ No file path received from Telegram');
          await ctx.reply('❌ 이미지 파일을 가져올 수 없습니다.');
          return;
        }

        // Extract editing intent from text (remove "도비야" if present)
        const editRequest = text.replace(/도비야[,\s]*/i, '').trim();

        // Send processing message with Dobby personality if requested
        const processingMsg = isDobbyEdit
          ? await ctx.reply(`🧙‍♀️ **도비가 이미지를 편집하고 있습니다!**

📸 **원본 이미지 분석 중**: 도비가 마법으로 분석합니다...
✏️ **편집 요청**: "${editRequest}"
🪄 **도비의 마법**: Gemini Vision + Imagen AI

⚡ 도비가 열심히 작업 중입니다...`)
          : await ctx.reply(`🎨 **이미지 편집 중...**

📸 **원본 이미지 분석**: 진행 중
✏️ **편집 요청**: "${editRequest}"
🤖 **AI 처리**: Gemini Vision + Imagen

⚡ 잠시만 기다려주세요...`);

        // Download image
        console.log('📥 Downloading image from Telegram...');
        const imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
        const imageResponse = await fetchWithTimeout(imageUrl, {}, 10000); // 10s timeout for download
        const imageArrayBuffer = await imageResponse.arrayBuffer();
        const imageBuffer = Buffer.from(imageArrayBuffer);
        const imageBase64 = imageBuffer.toString('base64');

        console.log('✅ Image downloaded, size:', imageBuffer.length, 'bytes');

        // Determine if we should use Files API based on size (15MB limit for inline data)
        useFilesAPI = imageBuffer.length > FILES_API_THRESHOLD;

        console.log(`📊 Image size analysis:`, {
          sizeBytes: imageBuffer.length,
          sizeMB: (imageBuffer.length / (1024 * 1024)).toFixed(2),
          threshold: (FILES_API_THRESHOLD / (1024 * 1024)).toFixed(0) + 'MB',
          useFilesAPI: useFilesAPI,
          method: useFilesAPI ? 'Files API (Large Image)' : 'Inline Data (Standard)'
        });

        // Use Gemini for real image editing
        console.log('🎨 Starting real image editing with Gemini...');

        const editStartTime = Date.now();
        // uploadedFileUri already declared above

        // Try multiple Gemini models for image editing
        let editResponse;
        let modelUsed = '';

        // Try Gemini 2.5 Flash Image Preview for actual image editing
        try {
          console.log('🔄 Trying Gemini 2.5 Flash Image Preview for direct image editing...');

          // Upload file if using Files API
          if (useFilesAPI && !uploadedFileUri) {
            console.log('📤 Uploading large image to Files API...');
            const uploadResult = await uploadToGeminiFiles(imageBuffer, 'image/jpeg');
            uploadedFileUri = uploadResult.uri;
            console.log('✅ Image uploaded to Files API:', uploadedFileUri);
          }

          // Use Files API or inline data based on image size
          if (useFilesAPI && uploadedFileUri) {
            editResponse = await processImageWithFilesAPI(
              uploadedFileUri,
              editRequest,
              'gemini-2.5-flash-image-preview'
            );
          } else {
            editResponse = await fetchWithTimeout(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [
                      {
                        text: `Generate an edited version of this image with the following modification: ${editRequest}

                        Important: You must return the edited image itself, not a text description.
                        Apply the requested changes directly to the image while preserving the original subjects and composition.
                        Output: Modified image with the requested changes applied.`
                      },
                      {
                        inline_data: {
                          mime_type: 'image/jpeg',
                          data: imageBase64
                        }
                      }
                    ]
                  }],
                  generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 8192
                  }
                })
              },
              30000 // 30-second timeout
            );
          }
          modelUsed = 'Gemini 2.5 Flash Image Preview' + (useFilesAPI ? ' (Files API)' : '');

          // Trust that Gemini will return an image with the improved prompt
        } catch (error) {
          console.log('⚠️ Gemini 2.5 Flash Image Preview failed or returned text:', error);

          // Try Gemini 2.0 Flash Experimental as second attempt
          try {
            console.log('🔄 Trying Gemini 2.0 Flash Experimental as fallback...');

            // Upload file if using Files API and not already uploaded
            if (useFilesAPI && !uploadedFileUri) {
              console.log('📤 Uploading large image to Files API for fallback...');
              const uploadResult = await uploadToGeminiFiles(imageBuffer, 'image/jpeg');
              uploadedFileUri = uploadResult.uri;
              console.log('✅ Image uploaded to Files API:', uploadedFileUri);
            }

            // Use Files API or inline data based on image size
            if (useFilesAPI && uploadedFileUri) {
              editResponse = await processImageWithFilesAPI(
                uploadedFileUri,
                editRequest,
                'gemini-2.0-flash-exp'
              );
            } else {
              editResponse = await fetchWithTimeout(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_API_KEY}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [
                        {
                          text: `You are an image editor. Edit this image based on: "${editRequest}"

                          Modify the image to fulfill this request while maintaining the original subjects and composition.
                          Apply the specific changes requested.`
                        },
                        {
                          inline_data: {
                            mime_type: 'image/jpeg',
                            data: imageBase64
                          }
                        }
                      ]
                    }],
                    generationConfig: {
                      temperature: 0.4,
                      maxOutputTokens: 8192
                    }
                  })
                },
                25000 // 25-second timeout
              );
            }
            modelUsed = 'Gemini 2.0 Flash Experimental' + (useFilesAPI ? ' (Files API)' : '');
          } catch (exp2Error) {
            console.log('⚠️ Gemini 2.0 Flash Experimental also failed or returned text:', exp2Error);

          // Final Fallback: Use Gemini for analysis then Imagen for generation
          console.log('🔄 Final Fallback: Gemini analysis + Imagen generation');

          // First, analyze the image with Gemini
          // Upload file if using Files API and not already uploaded
          if (useFilesAPI && !uploadedFileUri) {
            console.log('📤 Uploading large image to Files API for analysis...');
            const uploadResult = await uploadToGeminiFiles(imageBuffer, 'image/jpeg');
            uploadedFileUri = uploadResult.uri;
            console.log('✅ Image uploaded to Files API:', uploadedFileUri);
          }

          let analysisResponse;
          if (useFilesAPI && uploadedFileUri) {
            // Use Files API for analysis
            analysisResponse = await fetchWithTimeout(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [
                      {
                        text: `Analyze this image and create a detailed prompt for: "${editRequest}".
                        Describe what's in the image and how to modify it according to the request.
                        Output ONLY a concise prompt for image generation.`
                      },
                      {
                        fileData: {
                          mimeType: "image/jpeg",
                          fileUri: uploadedFileUri
                        }
                      }
                    ]
                  }],
                  generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 150
                  }
                })
              },
              10000 // 10s timeout
            );
          } else {
            // Use inline data for smaller images
            analysisResponse = await fetchWithTimeout(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [
                      {
                        text: `Analyze this image and create a detailed prompt for: "${editRequest}".
                        Describe what's in the image and how to modify it according to the request.
                        Output ONLY a concise prompt for image generation.`
                      },
                      { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
                    ]
                  }],
                  generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 150
                  }
                })
              },
              10000 // 10s timeout
            );
          }

          if (!analysisResponse.ok) {
            throw new Error('Gemini analysis failed');
          }

          const analysisData = await analysisResponse.json();
          const editPrompt = (analysisData as any).candidates?.[0]?.content?.parts?.[0]?.text?.trim() || editRequest;

          console.log('📝 Generated edit prompt:', editPrompt);

          // Generate with Imagen 4.0 based on analysis
          editResponse = await fetchWithTimeout(
            'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
            {
              method: 'POST',
              headers: {
                'x-goog-api-key': GOOGLE_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                instances: [{
                  prompt: editPrompt + ' High quality, photorealistic, detailed.'
                }],
                parameters: {
                  sampleCount: 1,
                  sampleImageSize: '1K',
                  aspectRatio: '1:1'
                }
              })
            },
            20000 // 20s timeout
          );
          modelUsed = useFilesAPI
            ? 'Gemini Analysis (Files API) + Imagen 4.0'
            : 'Gemini Analysis (Inline) + Imagen 4.0';
          }
        } finally {
          // Clean up uploaded file if it was used
          if (uploadedFileUri) {
            // Don't await - let cleanup happen in background
            deleteGeminiFile(uploadedFileUri).catch(error => {
              console.warn('Background file cleanup failed:', error);
            });
          }
        }

        if (!editResponse.ok) {
          const errorText = await editResponse.text();
          throw new Error(`API error: ${editResponse.status} - ${errorText}`);
        }

        const editData = await editResponse.json();
        const editProcessingTime = Date.now() - editStartTime;

        console.log('📊 Response structure:', {
          model: modelUsed,
          hasCandidates: !!(editData as any).candidates,
          candidatesCount: (editData as any).candidates?.length,
          hasPredictions: !!(editData as any).predictions,
          fullResponse: JSON.stringify(editData).substring(0, 500) // Log first 500 chars for debugging
        });

        // Check for IMAGE_SAFETY rejection
        const finishReason = (editData as any).candidates?.[0]?.finishReason;
        if (finishReason === 'IMAGE_SAFETY') {
          console.log('⚠️ Image editing blocked by safety filter');
          throw new Error('IMAGE_SAFETY: Content blocked by safety filters');
        }

        // Extract image data based on model
        let editedImageData;
        if (modelUsed.includes('Imagen')) {
          editedImageData = (editData as any).predictions?.[0]?.bytesBase64Encoded;
          console.log('📸 Imagen response - Image data found:', !!editedImageData);
        } else {
          // Gemini model response - check if it returned an image or text
          const candidates = (editData as any).candidates;
          const parts = candidates?.[0]?.content?.parts;

          console.log('📊 Gemini response analysis:', {
            hasContent: !!candidates?.[0]?.content,
            partsCount: parts?.length,
            partsTypes: parts?.map((p: any) =>
              p.inline_data ? 'image' : p.inlineData ? 'image' : p.text ? 'text' : 'unknown'
            ),
            firstPartKeys: parts?.[0] ? Object.keys(parts[0]) : null
          });

          if (parts) {
            // Look for image data in the response (check all possible formats)
            const imagePart = parts.find((part: any) =>
              part.inline_data?.mime_type?.startsWith('image/') ||
              part.inlineData?.mimeType?.startsWith('image/') ||
              part.inline_data?.mimeType?.startsWith('image/') ||
              part.inlineData?.mime_type?.startsWith('image/')
            );

            if (imagePart) {
              // Handle multiple possible response formats
              editedImageData = imagePart.inline_data?.data ||
                               imagePart.inlineData?.data ||
                               imagePart.inline_data?.data ||
                               imagePart.inlineData?.data;
              console.log('✅ Gemini returned edited image! Data length:', editedImageData?.length);
            } else if (parts[0]?.text) {
              // If Gemini returned only text, it didn't edit the image
              console.log('⚠️ Gemini returned text instead of image, using Imagen fallback');
              console.log('📝 Gemini text response:', parts[0].text.substring(0, 200));
              const prompt = parts[0].text.substring(0, 500) || editRequest;

              // Generate with Imagen
              const imagenResponse = await fetchWithTimeout(
                'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
                {
                  method: 'POST',
                  headers: {
                    'x-goog-api-key': GOOGLE_API_KEY,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: {
                      sampleCount: 1,
                      sampleImageSize: '1K',
                      aspectRatio: '1:1'
                    }
                  })
                },
                15000 // 15s timeout for final fallback
              );

              if (imagenResponse.ok) {
                const imagenData = await imagenResponse.json();
                editedImageData = (imagenData as any).predictions?.[0]?.bytesBase64Encoded;
                modelUsed = 'Gemini + Imagen 4.0 (Fallback)';
              }
            }
          }
        }

        if (!editedImageData) {
          throw new Error('No edited image received from API');
        }

        console.log(`✅ Image editing completed in ${editProcessingTime}ms using ${modelUsed}`);

        // Create buffer from the edited image
        const editedImageBuffer = Buffer.from(editedImageData, 'base64');

        // Delete processing message
        await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id);

        // Calculate cost based on method used
        const baseCost = 0.002; // Base processing cost
        const filesCost = useFilesAPI ? calculateGeminiFilesCost() : 0; // Additional Files API cost
        const estimatedCost = baseCost + filesCost;

        // Send edited image with enhanced information
        const caption = isDobbyEdit
          ? `🧙‍♀️ **도비가 마법으로 편집을 완료했습니다!**

✏️ **주인님의 요청**: "${editRequest}"
🪄 **도비의 마법 도구**: ${modelUsed}
📊 **처리 방식**: ${useFilesAPI ? 'Files API (대용량)' : 'Inline Data (표준)'}

💰 **비용**: ${formatCost(estimatedCost)}
⏱️ **처리시간**: ${editProcessingTime}ms

✨ **도비의 편집 결과입니다!**

도비는 주인님이 만족하시길 바랍니다! 🧙‍♀️`
          : `🎨 **이미지 편집 완료!**

✏️ **편집 요청**: "${editRequest}"
🤖 **AI 편집**: ${modelUsed}
📊 **처리 방식**: ${useFilesAPI ? 'Files API (대용량)' : 'Inline Data (표준)'}

💰 **비용**: ${formatCost(estimatedCost)}
⏱️ **처리시간**: ${editProcessingTime}ms

✨ **편집된 이미지입니다!**`;

        await ctx.replyWithPhoto(new InputFile(editedImageBuffer), {
          caption: caption
        });

        console.log('✅ Image editing completed and sent to user');
        
      } catch (error) {
        console.error('❌ Image editing error:', error);

        // Check if it's a safety error
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        const isSafetyError = errorMessage.includes('IMAGE_SAFETY');

        if (isSafetyError) {
          await ctx.reply(`⚠️ **안전 필터에 의해 차단됨**

요청하신 편집 내용이 Google AI의 안전 정책에 위반됩니다.

💡 **다른 방법으로 시도해보세요:**
- 더 순화된 표현으로 요청해주세요
- 예: "의상을 캐주얼한 옷으로 변경"
- 예: "옷 색상을 파란색으로 변경"

🔒 차단된 내용: 노출이 많은 의상, 성적 콘텐츠 등`);
        } else {
          await ctx.reply(`❌ **이미지 편집 실패**

오류: ${errorMessage}

💡 **다시 시도해보세요:**
- 이미지에 reply로 "편집해줘", "보정해줘", "개선해줘" 등으로 요청
- 구체적인 편집 내용을 명시하면 더 좋습니다
- 대용량 이미지는 Files API로 자동 처리됩니다`);
        }
      }
      
      return; // Exit after handling image editing
    } else {
      console.log('💬 Reply to photo but no editing keywords detected');
    }
  }

  // Check for Dobby activation and other commands
  console.log(`🔍 DEBUGGING - Checking Dobby activation for: "${text}"`);
  const dobbyCheck = isDobbyActivated(text);
  console.log(`🔍 DEBUGGING - Dobby check result:`, dobbyCheck);
  
  // Check for tracking commands (Dobby-style commands)
  const trackingCommand = parseTrackingCommand(text, ctx);
  console.log(`🔍 DEBUGGING - Tracking command result:`, trackingCommand);
  
  // Handle tracking commands if detected
  if (trackingCommand) {
    console.log(`🎯 Tracking command detected: ${trackingCommand.type}`);
    await handleTrackingCommand(trackingCommand, ctx);
    return;
  }

  if (dobbyCheck.activated) {
    console.log(`🧙‍♀️ DEBUGGING - Dobby activated! Command: ${dobbyCheck.command}, Content: "${dobbyCheck.content}"`);

    if (dobbyCheck.command === 'image') {
      // Handle Dobby image generation
      if (!dobbyCheck.content) {
        await ctx.reply(`🧙‍♀️ **도비가 준비되었습니다!**

🎨 **이미지 생성 사용법:**
• "도비야, 귀여운 강아지 그려줘"
• "도비야, 미래적인 로봇 그려줘"
• "도비야, 아름다운 풍경 그림 그려줘"

✨ 어떤 그림을 그려드릴까요?`);
        return;
      }

      console.log(`🎨 Dobby image generation: "${dobbyCheck.content}"`);

      // Send immediate response to prevent timeout
      const processingMsg = `🧙‍♀️ **도비가 그림을 그리고 있습니다!**

🎨 주인님의 요청: "${dobbyCheck.content}"
✨ 도비가 마법으로 그림을 만들고 있어요...

⚡ 잠시만 기다려주세요!`;

      const generatingMessage = await ctx.reply(processingMsg);

      try {
        const imageResult = await generateImageWithImagen(dobbyCheck.content, true, ctx.from?.id?.toString(), ctx.chat?.id?.toString());

        // Create buffer from base64
        const imageBuffer = Buffer.from(imageResult.imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

        // Get dynamic success message with cost information
        const successMsg = await getSystemMessage('dobby_success_image', {
          user_input: dobbyCheck.content,
          cost: formatCost(imageResult.cost),
          processing_time: imageResult.processingTime,
          timestamp: new Date().toLocaleString('ko-KR')
        });

        // Send image directly from buffer
        await ctx.replyWithPhoto(new InputFile(imageBuffer, `dobby_${Date.now()}.png`), {
          caption: `${successMsg}

💰 **비용**: ${formatCost(imageResult.cost)}
⏱️ **처리시간**: ${imageResult.processingTime}ms
🎨 **도구**: Google Imagen 4.0`
        });

        // Delete generating message
        await ctx.api.deleteMessage(ctx.chat.id, generatingMessage.message_id);

        console.log('✅ Dobby image generation successful!');

      } catch (error) {
        console.error('Dobby image generation error:', error);

        await ctx.api.editMessageText(
          ctx.chat.id,
          generatingMessage.message_id,
          `🧙‍♀️ **도비가 실수했습니다...**

❌ 이미지 생성 중 오류: ${(error as Error).message}

😔 도비는 실패를 용서받지 못합니다...
💡 잠시 후 다시 말씀해주시면 더 열심히 하겠습니다!`
        );
      }

    } else if (dobbyCheck.command === 'help') {
      // Handle Dobby help command
      console.log(`❓ Dobby help request: "${dobbyCheck.content}"`);

      try {
        const helpMessage = await getHelpMessage();
        await ctx.reply(`🧙‍♀️ **도비가 사용법을 알려드립니다!**

${helpMessage}

🏠 주인님을 위해 언제든지 도움을 드릴 준비가 되어있습니다!`);

        console.log('✅ Dobby help message sent successfully!');

      } catch (error) {
        console.error('Dobby help error:', error);
        await ctx.reply(`🧙‍♀️ **도비가 실수했습니다...**

❌ 도움말을 가져오는 중 오류가 발생했습니다.

💡 /help 명령어를 사용하시거나 잠시 후 다시 시도해주세요!`);
      }

    } else if (dobbyCheck.command === 'ask') {
      // Handle Dobby Q&A
      console.log(`🤔 Dobby Q&A: "${dobbyCheck.content}"`);

      // Get dynamic processing message
      const processingMsg = await getSystemMessage('dobby_processing_qa', {
        question: dobbyCheck.content
      });
      
      const thinkingMessage = await ctx.reply(processingMsg);

      try {
        const answerResult = await answerQuestion(dobbyCheck.content, true, ctx.from?.id?.toString(), ctx.chat?.id?.toString());

        // Delete thinking message and send answer
        await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);

        // Get dynamic success message
        const successMsg = await getSystemMessage('dobby_success_qa', {
          question: dobbyCheck.content,
          answer: answerResult.text,
          cost: formatCost(answerResult.cost),
          processing_time: answerResult.processingTime,
          timestamp: new Date().toLocaleString('ko-KR')
        });

        await ctx.reply(`${successMsg}

💰 **비용**: ${formatCost(answerResult.cost)}
⏱️ **처리시간**: ${answerResult.processingTime}ms
🔤 **토큰**: ${answerResult.tokenUsage.input} → ${answerResult.tokenUsage.output}
🧠 **AI**: Claude 3.5 Sonnet`);

        console.log('✅ Dobby Q&A successful!');

      } catch (error) {
        console.error('Dobby Q&A error:', error);

        await ctx.api.editMessageText(
          ctx.chat.id,
          thinkingMessage.message_id,
          `🧙‍♀️ **도비가 실수했습니다...**

❌ 답변 중 오류: ${(error as Error).message}

😔 도비는 아직 모르는 것이 많습니다...
💡 다른 방식으로 물어봐주시면 더 열심히 하겠습니다!`
        );
      }
    }

    return; // Dobby handled the message, skip other processing
  }

  // Do not respond to regular messages without "도비야" keyword
  // Only slash commands and messages with "도비야" should trigger responses
  console.log(`💭 Regular message (not Dobby command): "${text}" - no response`);
});

// Debug middleware - log ALL messages
bot.use(async (ctx, next) => {
  console.log('🔍 DEBUG - Message type:', ctx.message?.text ? 'text' : ctx.message?.photo ? 'photo' : 'other');
  console.log('🔍 DEBUG - Message content:', ctx.message?.text || '[non-text]');
  console.log('🔍 DEBUG - From:', ctx.from?.first_name, '(', ctx.from?.id, ')');
  await next();

});

// Error handling
bot.catch((err) => {
  console.error('Production bot error:', err);
});

// Create webhook callback
const webhookHandler = webhookCallback(bot, 'std/http');

// Netlify Functions handler
export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  console.log('🌐 WEBHOOK ENTRY POINT - Received request');
  console.log('🌐 Method:', event.httpMethod);
  console.log('🌐 Body:', event.body);
  console.log('🌐 Headers:', JSON.stringify(event.headers, null, 2));

  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...event.headers },
      body: event.body
    });

    // Process webhook normally - no timeout on Render
    const response = await webhookHandler(request);

    console.log('✅ Webhook processed');

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: await response.text()
    };
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return {
      statusCode: 200, // Return 200 to prevent Telegram retry
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  }
};
