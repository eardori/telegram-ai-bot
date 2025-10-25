// Production Telegram Bot Webhook Handler
import { Handler, HandlerContext, HandlerEvent } from '@netlify/functions';
import { Bot, InputFile, webhookCallback, InlineKeyboard } from 'grammy';

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

// Import image editing handlers
import { registerImageEditHandlers } from '../../src/handlers/image-edit-handler';
import { registerNSFWConsentHandlers, checkNSFWAccess, executeWithNSFWTracking } from '../../src/handlers/nsfw-consent-handler';
import { handlePhotoUpload } from '../../src/handlers/photo-upload-handler';
import { editImageWithTemplate } from '../../src/services/image-edit-service';

// Import Replicate service
import { replicateService } from '../../src/services/replicate-service';

// Import Supabase
import { supabase } from '../../src/utils/supabase';

// Import credit system
import {
  checkCreditsBeforeEdit,
  deductCreditAfterEdit,
  getCreditBalanceMessage,
  notifyCreditDeduction
} from '../../src/services/image-edit-credit-wrapper';
import {
  getCreditPackagesKeyboard,
  getPurchaseOptionsMessage,
  getOutOfCreditsMessage,
  getWelcomeMessage
} from '../../src/services/purchase-ui-service';
import {
  createCreditPackageInvoice,
  createSubscriptionInvoice,
  validatePayment,
  parsePaymentPayload,
  getPaymentSuccessMessage
} from '../../src/services/telegram-stars-payment';
import { addCredits } from '../../src/services/credit-manager';

// Import i18n system
import { getUserLanguage, t, getLanguageDisplayName } from '../../src/utils/i18n-helper';
import { User } from '../../src/services/auth-service';

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
 * Get total count of active templates from database
 */
async function getActiveTemplateCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('prompt_templates')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (error) {
      console.error('❌ Error counting templates:', error);
      return 41; // Fallback to known count
    }

    return count || 41;
  } catch (error) {
    console.error('❌ Error in getActiveTemplateCount:', error);
    return 41; // Fallback
  }
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
// USER STATE MANAGEMENT (for multi-step flows)
// =============================================================================

// User state for admin prompt input flow
const userStates = new Map<number, string>();

// =============================================================================
// CONVERSATION CONTEXT MANAGEMENT
// =============================================================================

// In-memory conversation context for session continuity
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ConversationContext {
  messages: ConversationMessage[];
  lastActive: number;
}

const conversationContexts = new Map<string, ConversationContext>();
const CONTEXT_MAX_MESSAGES = 10; // Keep last 10 messages (5 exchanges)
const CONTEXT_TTL = 30 * 60 * 1000; // 30 minutes

// Cleanup old contexts periodically
setInterval(() => {
  const now = Date.now();
  conversationContexts.forEach((context, key) => {
    if (now - context.lastActive > CONTEXT_TTL) {
      conversationContexts.delete(key);
      console.log(`🧹 Cleaned up conversation context for ${key}`);
    }
  });
}, 5 * 60 * 1000); // Check every 5 minutes

/**
 * Get or create conversation context for a user
 */
function getConversationContext(userId: number, chatId: number): ConversationContext {
  const key = `${userId}:${chatId}`;
  let context = conversationContexts.get(key);

  if (!context) {
    context = {
      messages: [],
      lastActive: Date.now()
    };
    conversationContexts.set(key, context);
    console.log(`✨ Created new conversation context for user ${userId} in chat ${chatId}`);
  }

  return context;
}

/**
 * Add message to conversation context
 */
function addToContext(userId: number, chatId: number, role: 'user' | 'assistant', content: string): void {
  const context = getConversationContext(userId, chatId);

  context.messages.push({
    role,
    content,
    timestamp: Date.now()
  });

  // Keep only last N messages
  if (context.messages.length > CONTEXT_MAX_MESSAGES) {
    context.messages = context.messages.slice(-CONTEXT_MAX_MESSAGES);
  }

  context.lastActive = Date.now();

  console.log(`📝 Added ${role} message to context. Total messages: ${context.messages.length}`);
}

/**
 * Get conversation history for Claude API
 */
function getContextMessages(userId: number, chatId: number): Array<{role: string, content: string}> {
  const context = getConversationContext(userId, chatId);
  return context.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

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

// Helper function for Claude API with dynamic prompts and conversation context
async function callClaudeAPI(
  message: string,
  maxTokens: number = 2000,
  temperature: number = 0.7,
  conversationHistory: Array<{role: string, content: string}> = []
) {
  const startTime = Date.now();

  try {
    // Build messages array with conversation history
    const messages: Array<{role: string, content: string}> = [];

    // Add conversation history
    if (conversationHistory.length > 0) {
      messages.push(...conversationHistory);
      console.log(`💬 Including ${conversationHistory.length} previous messages for context`);
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

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
          messages: messages
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
function isDobbyActivated(text: string, isReply: boolean = false): { activated: boolean; command: string | null; content: string } {
  const dobbyPattern = /도비야[,\s]*(.*)/i;
  const match = text.match(dobbyPattern);

  if (!match) {
    return { activated: false, command: null, content: '' };
  }

  const content = match[1].trim();

  // If it's a reply to a photo, default to edit command
  if (isReply) {
    return { activated: true, command: 'edit', content: content };
  }

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

// Enhanced Q&A function with dynamic prompts and conversation context
async function answerQuestion(question: string, isDobby: boolean = false, userId?: string, chatId?: string) {
  try {
    console.log(`🤔 Processing question: "${question}"`);

    // Get dynamic prompt from database
    const { prompt, maxTokens, temperature } = await getQAPrompt(question, isDobby);

    console.log(`📝 Using ${isDobby ? 'Dobby' : 'standard'} prompt template`);

    // Get conversation context if userId and chatId are provided
    let conversationHistory: Array<{role: string, content: string}> = [];
    if (userId && chatId) {
      const userIdNum = parseInt(userId);
      const chatIdNum = parseInt(chatId);
      conversationHistory = getContextMessages(userIdNum, chatIdNum);

      if (conversationHistory.length > 0) {
        console.log(`🔄 Continuing conversation with ${conversationHistory.length} previous messages`);
      }
    }

    const claudeResponse = await callClaudeAPI(prompt, maxTokens, temperature, conversationHistory);

    // Store the conversation in context
    if (userId && chatId) {
      const userIdNum = parseInt(userId);
      const chatIdNum = parseInt(chatId);
      addToContext(userIdNum, chatIdNum, 'user', question);
      addToContext(userIdNum, chatIdNum, 'assistant', claudeResponse.text);
    }

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
async function getHelpMessage(lang: 'ko' | 'en' = 'ko'): Promise<string> {
  try {
    const versionInfo = await getVersionInfoForHelp();
    const msg = t('helpMain', lang);
    const features = t('helpFeatures', lang);
    const commands = t('helpCommands', lang);
    const support = t('helpSupport', lang);

    if (lang === 'en') {
      return `${msg}

${versionInfo}

━━━━━━━━━━━━━━━━━━━━━━

${features}

🎨 **5 Categories, 38+ Editing Styles:**
• 🎭 3D/Figurine (Pixar, Clay, LEGO, etc.)
• 📸 Portrait Styling (Profile, ID Photo, etc.)
• 🎮 Game/Animation (GTA, Anime, etc.)
• 🛠️ Image Editing (Background/Outfit/Expression)
• ✨ Creative Transform (Art Gallery, Album Cover, etc.)

✨ **Parameterized Templates:**
• 🌍 **Background Change** - 6 options (Beach, City, Space, etc.)
• 👗 **Outfit Change** - 6 options (Suit, Dress, Hanbok, etc.)
• 😊 **Expression Change** - 5 options (Smile, Serious, Mysterious, etc.)

━━━━━━━━━━━━━━━━━━━━━━

${commands}

💳 **Credits & Payments:**
• 30 edits ₩3,000 ~ 600 edits ₩50,000
• Subscription: 50/mo ₩4,500 ~ Unlimited ₩29,900

🎁 **Referral Bonus:**
• Invite 1 friend: 10 credits each
• Milestones: 5(+20), 10(+50), 25(+150), 50(+500+VIP)

━━━━━━━━━━━━━━━━━━━━━━

${support}

🎯 **Upload a photo now and experience AI magic!**`;
    }

    // Korean (default)
    return `${msg}

${versionInfo}

━━━━━━━━━━━━━━━━━━━━━━

📸 **AI 사진 편집** (메인 기능)
1. 봇에 사진 업로드
2. AI가 자동 분석 후 3가지 스타일 추천
3. 원하는 스타일 선택 또는 전체 카테고리 탐색
4. 결과 확인 및 피드백 (👍/👎)

${features}

🎨 **5가지 카테고리, 38개 편집 스타일:**
• 🎭 3D/피규어 변환 (Pixar, Clay, LEGO 등)
• 📸 인물 스타일링 (프로필, 증명사진 등)
• 🎮 게임/애니메이션 (GTA, 애니메이션 등)
• 🛠️ 이미지 편집 (배경/의상/표정 변경)
• ✨ 창의적 변환 (미술관, 앨범 커버 등)

✨ **파라미터 선택형 템플릿:**
• 🌍 **배경 변경** - 6가지 배경 (해변, 도심, 우주 등)
• 👗 **의상 변경** - 6가지 의상 (정장, 드레스, 한복 등)
• 😊 **표정 변경** - 5가지 표정 (웃음, 진지, 신비로운 등)

━━━━━━━━━━━━━━━━━━━━━━

${commands}

💳 **크레딧 & 결제:**
• 무료 체험: 신규 가입 시 5회 무료
• 크레딧 패키지: 30회 ₩3,000 ~ 600회 ₩50,000
• 구독 플랜: 월 50회 ₩4,500 ~ 무제한 ₩29,900

🎁 **친구 초대 보너스:**
• /referral - 초대 코드 및 통계 확인
• /enter_code - 추천 코드 입력
• 친구 1명 초대: 양쪽 각 10 크레딧
• 마일스톤 달성: 5명(+20), 10명(+50), 25명(+150), 50명(+500+VIP)

━━━━━━━━━━━━━━━━━━━━━━

${support}

🎯 **지금 사진을 업로드하고 AI 마법을 경험하세요!**`;
  } catch (error) {
    console.error('Error getting help message:', error);
    const msg = t('helpMain', lang);
    return `${msg}

📸 **AI Photo Editor**
1. Upload photo
2. Check AI recommendations
3. Select style
4. See results!

🎯 Upload a photo now!`;
  }
}

/* ============================================================================
   ARCHIVED FEATURES (미사용 기능 - 나중에 재사용 가능)
   ============================================================================

   🗂️ 대화 추적 및 요약 기능:
   • "도비야, 대화 추적 시작해줘" - 중요한 대화 기록 시작
   • "도비야, 대화 추적 그만해줘" - 추적 중단
   • "도비야, 요약해줘" - 추적된 대화를 똑똑하게 요약
   • 📊 개인별 추적 - 각자 원하는 대로 추적 가능

   🎯 추적 시스템 명령어:
   • /track_start - 대화 추적 시작
   • /track_stop - 대화 추적 중단
   • /summarize - 대화 요약 생성
   • /track_status - 현재 추적 상태 확인

   🤖 일반 AI 명령어:
   • /ask [질문] - 명시적 질문하기
   • /image [설명] - 이미지 생성

   ============================================================================ */

// =============================================================================
// 📸 PHOTO UPLOAD HANDLER - New Photo Editing Flow
// =============================================================================

bot.on('message:photo', async (ctx) => {
  try {
    console.log('📸 Photo received from user');

    // Handle photo upload
    const uploadResult = await handlePhotoUpload(ctx);

    if (!uploadResult.success) {
      await ctx.reply(`❌ 사진 처리 중 오류가 발생했습니다.\n\n${uploadResult.error}`);
      return;
    }

    console.log('✅ Photo processed successfully:', uploadResult.imageUrl);

    // Build message with analysis and AI suggestions
    let message = `✅ **사진을 받았어요!**\n\n`;
    message += `🔍 **분석 결과:**\n${uploadResult.analysisSummary || '분석 중...'}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Store file ID in cache with short key
    const fileKey = storeFileId(ctx.chat!.id, ctx.message!.message_id, uploadResult.fileId!);

    // Create inline keyboard
    const keyboard = new InlineKeyboard();

    // Add AI Suggestions first (if available)
    const aiSuggestions = uploadResult.analysis?.aiSuggestions || [];
    if (aiSuggestions.length > 0) {
      // Store AI suggestions in cache for callback handler
      storeAISuggestions(fileKey, aiSuggestions);
      message += `✨ **AI 추천 (이 사진만을 위한 특별 제안):**\n\n`;

      const aiButtons: Array<{ text: string; data: string }> = [];

      aiSuggestions.forEach((suggestion, index) => {
        message += `${index + 1}. **${suggestion.title}**\n`;
        message += `   ${suggestion.description}\n\n`;

        // Add AI suggestion buttons (without emoji)
        aiButtons.push({
          text: suggestion.title,
          data: `ai:${index}:${fileKey}`
        });
      });

      // Use smart layout for AI buttons
      addButtonsWithSmartLayout(keyboard, aiButtons);
      keyboard.row();

      message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Add template recommendations
    if (uploadResult.recommendations && uploadResult.recommendations.length > 0) {
      message += `🎯 **템플릿 추천** (적합도 순):\n\n`;

      const templateButtons: Array<{ text: string; data: string }> = [];

      uploadResult.recommendations.slice(0, 4).forEach((rec, index) => {
        const stars = '⭐'.repeat(Math.ceil(rec.confidence / 25));
        message += `${rec.nameKo} ${stars}\n`;

        // Add template buttons (without category emoji, keep only template emoji if exists)
        templateButtons.push({
          text: rec.nameKo, // Remove emoji prefix
          data: `t:${rec.templateKey}:${fileKey}`
        });
      });

      message += `\n💡 **아래 버튼을 눌러 스타일을 선택하세요:**\n`;

      // Use smart layout for template buttons (prefer 2 per row for readability)
      addButtonsWithSmartLayout(keyboard, templateButtons, { preferredPerRow: 2 });
      keyboard.row();
    }

    // Add category buttons (without emojis, smart layout)
    const categoryButtons: Array<{ text: string; data: string }> = [
      { text: '3D/피규어', data: `cat:3d_figurine:${fileKey}` },
      { text: '인물 스타일', data: `cat:portrait_styling:${fileKey}` },
      { text: '게임/애니', data: `cat:game_animation:${fileKey}` },
      { text: '이미지 편집', data: `cat:image_editing:${fileKey}` },
      { text: '창의적 변환', data: `cat:creative_transform:${fileKey}` }
    ];

    addButtonsWithSmartLayout(keyboard, categoryButtons);
    keyboard.row();

    // Add "View All" button with dynamic count
    const totalCount = await getActiveTemplateCount();
    keyboard.text('📋 전체 스타일 보기', `t:all:${fileKey}`);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    // TODO: Next steps
    // 1. ✅ Analyze image (DONE)
    // 2. ✅ Recommend templates (DONE)
    // 3. ✅ Show inline buttons (DONE)
    // 4. Handle button clicks (below)

  } catch (error) {
    console.error('❌ Error in photo handler:', error);
    await ctx.reply('❌ 사진 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
});

// =============================================================================
// CALLBACK QUERY HANDLERS (Inline Buttons)
// =============================================================================

/**
 * Smart button layout helper
 * Arranges buttons based on text length for better mobile UX
 *
 * Rules:
 * - Short text (<=10 chars): 3 buttons per row
 * - Medium text (11-20 chars): 2 buttons per row
 * - Long text (>20 chars): 1 button per row
 */
function addButtonsWithSmartLayout(
  keyboard: InlineKeyboard,
  buttons: Array<{ text: string; data: string }>,
  options: { maxPerRow?: number; preferredPerRow?: number } = {}
): InlineKeyboard {
  const { maxPerRow = 3, preferredPerRow } = options;

  let currentRow: Array<{ text: string; data: string }> = [];
  let currentRowLength = 0;

  buttons.forEach((button, index) => {
    const textLength = button.text.length;

    // Determine how many buttons can fit based on text length
    let maxInRow = preferredPerRow || maxPerRow;
    if (textLength > 20) {
      maxInRow = 1; // Long text: one per row
    } else if (textLength > 10) {
      maxInRow = 2; // Medium text: two per row
    } else {
      maxInRow = 3; // Short text: three per row
    }

    // Check if we need to start a new row
    const needNewRow = currentRow.length >= maxInRow ||
                       (currentRow.length > 0 && currentRowLength + textLength > 40);

    if (needNewRow) {
      // Add current row to keyboard
      currentRow.forEach(btn => keyboard.text(btn.text, btn.data));
      keyboard.row();
      currentRow = [];
      currentRowLength = 0;
    }

    // Add button to current row
    currentRow.push(button);
    currentRowLength += textLength;

    // If last button, add remaining row
    if (index === buttons.length - 1 && currentRow.length > 0) {
      currentRow.forEach(btn => keyboard.text(btn.text, btn.data));
    }
  });

  return keyboard;
}

// In-memory storage for file IDs and AI suggestions (session-based)
const fileIdCache = new Map<string, string>();
const aiSuggestionsCache = new Map<string, any[]>();

function storeFileId(chatId: number, messageId: number, fileId: string): string {
  const key = `${chatId}:${messageId}`;
  fileIdCache.set(key, fileId);
  return key;
}

function getFileId(key: string): string | undefined {
  return fileIdCache.get(key);
}

function storeAISuggestions(fileKey: string, suggestions: any[]): void {
  aiSuggestionsCache.set(fileKey, suggestions);
}

function getAISuggestions(fileKey: string): any[] | undefined {
  return aiSuggestionsCache.get(fileKey);
}

// Callback data mapping system (to avoid Telegram 64-byte limit)
interface CallbackDataMap {
  templateKey: string;
  parameterKey: string;
  optionKey: string;
  chatId: number;
  messageId: number;
}

const callbackDataCache = new Map<string, CallbackDataMap>();
let callbackIdCounter = 0;

/**
 * Generate short callback ID and store the data
 * Format: param:{shortId} (e.g., "param:a1b2c3")
 */
function generateShortCallbackId(data: CallbackDataMap): string {
  // Generate 6-character alphanumeric ID
  const shortId = (callbackIdCounter++).toString(36).padStart(6, '0');
  callbackDataCache.set(shortId, data);

  // Auto-cleanup after 1 hour
  setTimeout(() => {
    callbackDataCache.delete(shortId);
  }, 60 * 60 * 1000);

  return shortId;
}

/**
 * Resolve short callback ID to original data
 */
function resolveCallbackData(shortId: string): CallbackDataMap | undefined {
  return callbackDataCache.get(shortId);
}

// AI Suggestion selection callback handler (NEW!)
bot.callbackQuery(/^ai:(\d+):(.+):(.+)$/, async (ctx) => {
  try {
    const suggestionIndex = parseInt(ctx.match[1]);
    const chatId = parseInt(ctx.match[2]);
    const messageId = parseInt(ctx.match[3]);
    const fileKey = `${chatId}:${messageId}`;

    console.log(`✨ AI Suggestion ${suggestionIndex} selected for file: ${fileKey}`);

    // Get AI suggestions from cache
    const suggestions = getAISuggestions(fileKey);
    if (!suggestions || !suggestions[suggestionIndex]) {
      await ctx.answerCallbackQuery('AI 제안 정보를 찾을 수 없습니다. 사진을 다시 업로드해주세요.');
      return;
    }

    const suggestion = suggestions[suggestionIndex];

    // Get file ID
    let fileId = getFileId(fileKey);
    if (!fileId) {
      // Try retrieving from database
      const { data, error } = await supabase
        .from('image_analysis_results')
        .select('analysis_data')
        .eq('message_id', messageId)
        .single();

      if (error || !data || !data.analysis_data?.file_id) {
        await ctx.answerCallbackQuery('이미지 정보를 찾을 수 없습니다. 사진을 다시 업로드해주세요.');
        return;
      }

      fileId = data.analysis_data.file_id;
      storeFileId(chatId, messageId, fileId);
    }

    // Answer callback
    await ctx.answerCallbackQuery(`✨ ${suggestion.title} - 편집 중...`);

    // Get image URL
    const file = await ctx.api.getFile(fileId);
    const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
    const imageUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

    // ========== CREDIT CHECK ==========
    const creditCheck = await checkCreditsBeforeEdit(ctx, `ai_${suggestionIndex}`);

    if (!creditCheck.canProceed) {
      if (creditCheck.message) {
        await ctx.reply(creditCheck.message);
      }

      if (creditCheck.shouldShowPurchaseOptions) {
        const keyboard = await getCreditPackagesKeyboard();
        const message = await getPurchaseOptionsMessage();
        await ctx.reply(message, { reply_markup: keyboard });
      }

      await ctx.answerCallbackQuery('크레딧이 부족합니다');
      return;
    }

    // Show welcome message for new users
    if (creditCheck.message && creditCheck.isRegistered) {
      await ctx.reply(creditCheck.message);
    }

    // Send processing message
    const processingMsg = await ctx.reply(`🎨 **AI 추천으로 편집 중...**\n\n✨ ${suggestion.title}\n${suggestion.description}\n\n⏳ 잠시만 기다려주세요...`);

    // Edit image using AI suggestion prompt
    const editResult = await editImageWithTemplate({
      imageUrl,
      templatePrompt: suggestion.prompt,
      templateName: suggestion.title,
      category: 'ai_suggestion',
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      templateKey: `ai_${suggestionIndex}`
    });

    if (editResult.success && editResult.outputFile) {
      // ========== DEDUCT CREDIT ==========
      const deductResult = await deductCreditAfterEdit(
        ctx,
        `ai_${suggestionIndex}`,
        undefined,
        creditCheck.isFreeTrial
      );

      if (!deductResult.success) {
        console.error('❌ Failed to deduct credit:', deductResult.message);
      }
      // Delete processing message
      await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id);

      // Build caption with credit info
      let caption = `✨ **AI 추천: ${suggestion.title}**\n\n${suggestion.description}\n\n⏱️ 처리 시간: ${(editResult.processingTime! / 1000).toFixed(1)}초`;

      // Add credit info for private chat or free trial
      if (creditCheck.isFreeTrial) {
        caption += `\n\n${deductResult.message}`;
      } else if (ctx.chat?.type === 'private') {
        caption += `\n\n💳 남은 크레딧: ${deductResult.remainingCredits}회`;
      }

      // Send edited image
      await ctx.replyWithPhoto(editResult.outputFile, { caption });

      // Send DM notification for group chat (non-free-trial users)
      const isGroupChat = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
      if (isGroupChat && !creditCheck.isFreeTrial) {
        await notifyCreditDeduction(ctx, deductResult.remainingCredits, true);
      }

      console.log(`✅ AI suggestion edit completed in ${editResult.processingTime}ms`);
    } else {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `❌ 편집 실패: ${editResult.error}`
      );
    }

  } catch (error) {
    console.error('❌ Error in AI suggestion handler:', error);
    await ctx.reply('❌ AI 추천 편집 중 오류가 발생했습니다.');
  }
});

// Template selection callback handler
bot.callbackQuery(/^t:([^:]+):(.+):(.+)$/, async (ctx) => {
  try {
    const templateKey = ctx.match[1];
    const chatId = parseInt(ctx.match[2]);
    const messageId = parseInt(ctx.match[3]);
    const fileKey = `${chatId}:${messageId}`;

    // Try to get from cache first
    let fileId = getFileId(fileKey);

    // If not in cache, retrieve from database using message_id
    if (!fileId) {
      console.log(`🔍 FileId not in cache, retrieving from database for message ${messageId}...`);

      const { data, error } = await supabase
        .from('image_analysis_results')
        .select('analysis_data')
        .eq('message_id', messageId)
        .single();

      if (error || !data) {
        await ctx.answerCallbackQuery('이미지 정보를 찾을 수 없습니다. 사진을 다시 업로드해주세요.');
        return;
      }

      fileId = data.analysis_data?.file_id;

      if (!fileId) {
        await ctx.answerCallbackQuery('파일 ID를 찾을 수 없습니다. 사진을 다시 업로드해주세요.');
        return;
      }

      // Store in cache for future use
      storeFileId(chatId, messageId, fileId);
      console.log(`✅ FileId retrieved from database and cached: ${fileId}`);
    }

    console.log(`🎨 Template selected: ${templateKey} for file: ${fileId}`);

    // Answer callback to remove loading state
    await ctx.answerCallbackQuery();

    // Handle "View All" button
    if (templateKey === 'all') {
      // Fetch all templates from database
      const { data: allTemplates, error } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('priority', { ascending: false });

      if (error || !allTemplates) {
        await ctx.reply('❌ 템플릿 목록을 가져오는 중 오류가 발생했습니다.');
        return;
      }

      // Create paginated keyboard with all templates (한 줄에 1개씩, 이모티콘 제거)
      const keyboard = new InlineKeyboard();
      const templatesPerPage = 8; // 페이지당 8개로 증가
      const totalPages = Math.ceil(allTemplates.length / templatesPerPage);
      const pageTemplates = allTemplates.slice(0, templatesPerPage);

      // Add template buttons (한 줄에 1개씩, 이모티콘 없이)
      pageTemplates.forEach(template => {
        keyboard.text(
          template.template_name_ko, // 이모티콘 제거
          `t:${template.template_key}:${fileKey}`
        ).row();
      });

      // Navigation buttons
      keyboard.row();
      keyboard.text(`1/${totalPages}`, `noop`);
      if (allTemplates.length > templatesPerPage) {
        keyboard.text('➡️ 다음', `tp:1:${fileKey}`);
      }

      // Back to categories
      keyboard.row();
      keyboard.text('🔙 카테고리로', `back_to_main:${fileKey}`);

      await ctx.reply(
        `🎨 **전체 스타일** (1/${totalPages} 페이지)\n\n` +
        `총 ${allTemplates.length}개 스타일 중 선택:`,
        { reply_markup: keyboard }
      );
      return;
    }

    // Fetch selected template from database
    const { data: template, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('template_key', templateKey)
      .single();

    if (error || !template) {
      await ctx.reply('❌ 선택한 템플릿을 찾을 수 없습니다.');
      return;
    }

    // ✨ CHECK IF PARAMETERIZED TEMPLATE
    const { isParameterizedTemplate, getTemplateWithParameters } = await import('../../src/services/parameterized-template-service');

    const isParam = await isParameterizedTemplate(templateKey);

    if (isParam) {
      console.log(`🎯 Parameterized template detected: ${templateKey}`);

      // Fetch template with parameters and options
      const templateWithParams = await getTemplateWithParameters(templateKey);

      if (!templateWithParams || !templateWithParams.parameters || templateWithParams.parameters.length === 0) {
        await ctx.reply('❌ 템플릿 파라미터를 찾을 수 없습니다.');
        return;
      }

      // Get first parameter (for now, we only support single parameter)
      const parameter = templateWithParams.parameters[0];

      if (!parameter.options || parameter.options.length === 0) {
        await ctx.reply('❌ 선택 가능한 옵션이 없습니다.');
        return;
      }

      // Build parameter selection keyboard
      const paramKeyboard = new InlineKeyboard();

      let message = `🎨 **${template.template_name_ko}**\n\n`;
      message += `📋 **${parameter.parameter_name_ko}**를 선택해주세요:\n\n`;

      // Add option buttons (1 per row for clarity)
      parameter.options.forEach((option) => {
        // Generate short callback ID to avoid 64-byte limit
        const shortId = generateShortCallbackId({
          templateKey,
          parameterKey: parameter.parameter_key,
          optionKey: option.option_key,
          chatId,
          messageId
        });

        paramKeyboard.text(
          option.option_name_ko,  // No emoji
          `p:${shortId}`  // Ultra-short format: "p:a1b2c3"
        ).row();
      });

      // Back button (returns to categories)
      paramKeyboard.row();
      paramKeyboard.text('⬅️ 뒤로', `back_to_main:${chatId}:${messageId}`)
        .text('🏠 처음으로', `back_to_start:${chatId}:${messageId}`);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: paramKeyboard
      });

      return;
    }

    // ✨ ORIGINAL FLOW FOR FIXED TEMPLATES
    // Get image URL from fileId
    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) {
      await ctx.reply('❌ 원본 이미지를 찾을 수 없습니다.');
      return;
    }

    const imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    // ========== CREDIT CHECK ==========
    const creditCheck = await checkCreditsBeforeEdit(ctx, templateKey);

    if (!creditCheck.canProceed) {
      if (creditCheck.message) {
        await ctx.reply(creditCheck.message);
      }

      if (creditCheck.shouldShowPurchaseOptions) {
        const keyboard = await getCreditPackagesKeyboard();
        const message = await getPurchaseOptionsMessage();
        await ctx.reply(message, { reply_markup: keyboard });
      }

      await ctx.answerCallbackQuery('크레딧이 부족합니다');
      return;
    }

    // Show welcome message for new users
    if (creditCheck.message && creditCheck.isRegistered) {
      await ctx.reply(creditCheck.message);
    }

    // Send processing message
    const processingMsg = await ctx.reply(
      `✨ **${template.template_name_ko}** 스타일로 편집 중...\n\n` +
      `🎨 AI가 작업 중입니다. 잠시만 기다려주세요...`
    );

    console.log('📋 Template details:', {
      name: template.template_name_ko,
      category: template.category,
      prompt: template.base_prompt.substring(0, 100) + '...'
    });

    // Execute image editing with Gemini
    const { editImageWithTemplate } = await import('../../src/services/image-edit-service');

    const editResult = await editImageWithTemplate({
      imageUrl,
      templatePrompt: template.base_prompt,
      templateName: template.template_name_ko,
      category: template.category,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      templateKey: templateKey
    });

    // Check for Cloudflare 403 specifically
    if (!editResult.success && editResult.error?.includes('403')) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `⚠️ **일시적 서비스 제한**\n\n` +
        `Replicate API가 현재 Cloudflare에 의해 차단되어 있습니다.\n\n` +
        `📧 관리자가 해결 중이니 잠시 후 다시 시도해주세요.\n\n` +
        `💡 **대안:**\n` +
        `• 다른 시간에 다시 시도\n` +
        `• 다른 템플릿 사용\n` +
        `• /help 로 다른 기능 확인`
      );
      return;
    }

    if (editResult.success && (editResult.outputUrl || editResult.outputFile)) {
      // ========== DEDUCT CREDIT ==========
      const deductResult = await deductCreditAfterEdit(
        ctx,
        templateKey,
        undefined,
        creditCheck.isFreeTrial
      );

      if (!deductResult.success) {
        console.error('❌ Failed to deduct credit:', deductResult.message);
      }

      // Update processing message
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `✅ **편집 완료!**\n\n` +
        `🎨 스타일: ${template.template_name_ko}\n` +
        `⏱️ 처리 시간: ${Math.round(editResult.processingTime! / 1000)}초\n\n` +
        `결과를 전송합니다...`
      );

      // Create action buttons for the edited image
      let actionKeyboard = new InlineKeyboard();

      // If free trial, add signup button first
      if (creditCheck.isFreeTrial) {
        const botUsername = ctx.me.username;
        actionKeyboard = actionKeyboard
          .url('지금 가입하고 5회 더 받기', `https://t.me/${botUsername}?start=group_signup`)
          .row();
      }

      // Add standard action buttons (unified UX)
      actionKeyboard = actionKeyboard
        .text('🔄 같은 스타일 다시', `redo:${template.template_key}:${fileKey}`).row()
        .text('📂 카테고리에서 선택', `back_to_categories:${fileKey}`)
        .text('🏠 처음으로', `back_to_start:${fileKey}`).row()
        .row()
        .text('👍 좋아요', `feedback:like:${template.template_key}:${fileKey}`)
        .text('👎 별로예요', `feedback:dislike:${template.template_key}:${fileKey}`);

      // Build caption with credit info (simplified)
      let caption = `✨ **${template.template_name_ko}** 편집 완료!\n\n` +
        `⏱️ ${Math.round(editResult.processingTime! / 1000)}초 소요`;

      // Add credit info for private chat or free trial
      if (creditCheck.isFreeTrial) {
        caption += `\n\n${deductResult.message}`;
      } else if (ctx.chat?.type === 'private') {
        caption += `\n\n💳 남은 크레딧: ${deductResult.remainingCredits}회`;
      }

      // Send edited image with action buttons
      const photoSource = editResult.outputFile || editResult.outputUrl!;
      await ctx.replyWithPhoto(photoSource, {
        caption,
        reply_markup: actionKeyboard
      });

      // Send DM notification for group chat (non-free-trial users)
      const isGroupChat = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
      if (isGroupChat && !creditCheck.isFreeTrial) {
        await notifyCreditDeduction(ctx, deductResult.remainingCredits, true);
      }

      // Store edit result in database (only if URL is available)
      const editedImageUrl = editResult.outputUrl || '(direct_file)';
      const { data: editRecord } = await supabase
        .from('image_edit_results')
        .insert({
          user_id: ctx.from?.id,
          chat_id: ctx.chat?.id,
          template_key: template.template_key,
          original_image_url: imageUrl,
          edited_image_url: editedImageUrl,
          processing_time_ms: editResult.processingTime,
          status: 'completed'
        })
        .select()
        .single();

      console.log('✅ Edit result stored in database:', editRecord?.id);

    } else {
      // Handle error
      let errorMsg = editResult.error || 'Unknown error';

      // User-friendly error messages
      if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
        errorMsg = '⏱️ 서버 응답 시간 초과\n잠시 후 다시 시도해주세요.';
      } else if (errorMsg.includes('Failed to download image')) {
        errorMsg = '📥 이미지 다운로드 실패\n네트워크 연결을 확인하고 다시 시도해주세요.';
      } else if (errorMsg.includes('Cloudflare') || errorMsg.includes('403')) {
        errorMsg = '🚫 API 접근 차단 (Cloudflare 403)\n잠시 후 다시 시도해주세요.';
      } else if (errorMsg.includes('quota') || errorMsg.includes('limit')) {
        errorMsg = '📊 API 사용량 한도 초과\n잠시 후 다시 시도해주세요.';
      } else if (errorMsg.length > 200) {
        errorMsg = errorMsg.substring(0, 200) + '...';
      }

      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `❌ **편집 실패**\n\n` +
        `${errorMsg}\n\n` +
        `💡 다른 스타일을 시도하거나 나중에 다시 시도해주세요.`
      );

      console.error('❌ Edit failed:', editResult.error);
    }

  } catch (error) {
    console.error('❌ Error in template callback:', error);
    await ctx.reply('❌ 템플릿 선택 처리 중 오류가 발생했습니다.');
  }
});

// ✨ Parameter selection callback handler (for parameterized templates)
// NEW: Uses short ID format "p:{shortId}" to avoid 64-byte limit
bot.callbackQuery(/^p:([a-z0-9]+)$/, async (ctx) => {
  try {
    const shortId = ctx.match[1];

    // Resolve short ID to original data
    const callbackData = resolveCallbackData(shortId);

    if (!callbackData) {
      await ctx.answerCallbackQuery('세션이 만료되었습니다. 사진을 다시 업로드해주세요.');
      return;
    }

    const { templateKey, parameterKey, optionKey, chatId, messageId } = callbackData;
    const fileKey = `${chatId}:${messageId}`;

    console.log(`🎯 Parameter selected (short ID: ${shortId}):`, {
      template: templateKey,
      parameter: parameterKey,
      option: optionKey,
      fileKey
    });

    // Answer callback to remove loading state
    await ctx.answerCallbackQuery();

    // Try to get fileId from cache first
    let fileId = getFileId(fileKey);

    // If not in cache, retrieve from database
    if (!fileId) {
      console.log(`🔍 FileId not in cache, retrieving from database for message ${messageId}...`);

      const { data, error } = await supabase
        .from('image_analysis_results')
        .select('analysis_data')
        .eq('message_id', messageId)
        .single();

      if (error || !data) {
        await ctx.reply('이미지 정보를 찾을 수 없습니다. 사진을 다시 업로드해주세요.');
        return;
      }

      fileId = data.analysis_data?.file_id;

      if (!fileId) {
        await ctx.reply('파일 ID를 찾을 수 없습니다. 사진을 다시 업로드해주세요.');
        return;
      }

      storeFileId(chatId, messageId, fileId);
      console.log(`✅ FileId retrieved from database and cached: ${fileId}`);
    }

    // Get image URL from fileId
    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) {
      await ctx.reply('❌ 원본 이미지를 찾을 수 없습니다.');
      return;
    }

    const imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    // Fetch template and parameter option
    const {
      getTemplateWithParameters,
      getParameterOption,
      buildPromptWithParameters
    } = await import('../../src/services/parameterized-template-service');

    const templateWithParams = await getTemplateWithParameters(templateKey);
    const option = await getParameterOption(templateKey, parameterKey, optionKey);

    if (!templateWithParams || !option) {
      await ctx.reply('❌ 템플릿 정보를 찾을 수 없습니다.');
      return;
    }

    // Build final prompt with selected parameter
    const parameters: Record<string, string> = {
      [parameterKey]: option.prompt_fragment
    };

    const finalPrompt = buildPromptWithParameters(templateWithParams.base_prompt, parameters);

    console.log(`📝 Final prompt built:`, {
      basePrompt: templateWithParams.base_prompt.substring(0, 50) + '...',
      parameter: `{${parameterKey}}`,
      fragment: option.prompt_fragment.substring(0, 50) + '...',
      finalPrompt: finalPrompt.substring(0, 100) + '...'
    });

    // ========== CREDIT CHECK ==========
    const creditCheck = await checkCreditsBeforeEdit(ctx, templateKey);

    if (!creditCheck.canProceed) {
      if (creditCheck.message) {
        await ctx.reply(creditCheck.message);
      }

      if (creditCheck.shouldShowPurchaseOptions) {
        const keyboard = await getCreditPackagesKeyboard();
        const message = await getPurchaseOptionsMessage();
        await ctx.reply(message, { reply_markup: keyboard });
      }

      await ctx.answerCallbackQuery('크레딧이 부족합니다');
      return;
    }

    // Show welcome message for new users
    if (creditCheck.message && creditCheck.isRegistered) {
      await ctx.reply(creditCheck.message);
    }

    // Send processing message
    const processingMsg = await ctx.reply(
      `✨ **${templateWithParams.template_name_ko}** 편집 중...\n\n` +
      `📋 선택: ${option.emoji || '•'} ${option.option_name_ko}\n\n` +
      `🎨 AI가 작업 중입니다. 잠시만 기다려주세요...`
    );

    // Execute image editing with final prompt
    const { editImageWithTemplate } = await import('../../src/services/image-edit-service');

    const editResult = await editImageWithTemplate({
      imageUrl,
      templatePrompt: finalPrompt,
      templateName: `${templateWithParams.template_name_ko} - ${option.option_name_ko}`,
      category: templateWithParams.template_type,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      templateKey: templateKey
    });

    // Check for Cloudflare 403 specifically
    if (!editResult.success && editResult.error?.includes('403')) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `⚠️ **일시적 서비스 제한**\n\n` +
        `Replicate API가 현재 Cloudflare에 의해 차단되어 있습니다.\n\n` +
        `📧 관리자가 해결 중이니 잠시 후 다시 시도해주세요.\n\n` +
        `💡 **대안:**\n` +
        `• 다른 시간에 다시 시도\n` +
        `• 다른 템플릿 사용\n` +
        `• /help 로 다른 기능 확인`
      );
      return;
    }

    if (editResult.success && (editResult.outputUrl || editResult.outputFile)) {
      // ========== DEDUCT CREDIT ==========
      const deductResult = await deductCreditAfterEdit(
        ctx,
        templateKey,
        undefined,
        creditCheck.isFreeTrial
      );

      if (!deductResult.success) {
        console.error('❌ Failed to deduct credit:', deductResult.message);
      }

      // Update processing message
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `✅ **편집 완료!**\n\n` +
        `🎨 스타일: ${templateWithParams.template_name_ko}\n` +
        `📋 선택: ${option.emoji || '•'} ${option.option_name_ko}\n` +
        `⏱️ 처리 시간: ${Math.round(editResult.processingTime! / 1000)}초\n\n` +
        `결과를 전송합니다...`
      );

      // Create action buttons for the edited image (unified UX)
      const actionKeyboard = new InlineKeyboard()
        .text('🔄 같은 스타일 다시', `redo:${templateKey}:${fileKey}`).row()
        .text('🎨 다른 옵션 선택', `t:${templateKey}:${fileKey}`)
        .text('📂 카테고리에서 선택', `back_to_categories:${fileKey}`).row()
        .text('🏠 처음으로', `back_to_start:${fileKey}`).row()
        .row()
        .text('👍 좋아요', `feedback:like:${templateKey}:${fileKey}`)
        .text('👎 별로예요', `feedback:dislike:${templateKey}:${fileKey}`);

      // Build caption with credit info (simplified)
      let caption = `✨ **${templateWithParams.template_name_ko}** 편집 완료!\n\n` +
        `📋 선택: ${option.emoji || '•'} ${option.option_name_ko}\n` +
        `⏱️ ${Math.round(editResult.processingTime! / 1000)}초 소요`;

      // Add credit info for private chat or free trial
      if (creditCheck.isFreeTrial) {
        caption += `\n\n${deductResult.message}`;
      } else if (ctx.chat?.type === 'private') {
        caption += `\n\n💳 남은 크레딧: ${deductResult.remainingCredits}회`;
      }

      // Send edited image with action buttons
      const photoSource = editResult.outputFile || editResult.outputUrl!;
      await ctx.replyWithPhoto(photoSource, {
        caption,
        reply_markup: actionKeyboard
      });

      // Send DM notification for group chat (non-free-trial users)
      const isGroupChat = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
      if (isGroupChat && !creditCheck.isFreeTrial) {
        await notifyCreditDeduction(ctx, deductResult.remainingCredits, true);
      }

      // Store edit result in database (only if URL is available)
      if (editResult.outputUrl) {
        const { error: insertError } = await supabase
          .from('image_edit_results')
          .insert({
            user_id: ctx.from?.id,
            chat_id: ctx.chat?.id,
            original_image_url: imageUrl,
            edited_image_url: editResult.outputUrl,
            template_key: templateKey,
            template_name: templateWithParams.template_name_ko,
            prompt_used: finalPrompt,
            processing_time_ms: editResult.processingTime,
            success: true
          });

        if (insertError) {
          console.error('❌ Failed to store edit result:', insertError);
        } else {
          console.log('✅ Edit result stored in database');
        }
      }

    } else {
      // Handle failure
      let errorMsg = editResult.error || 'Unknown error';

      if (errorMsg.length > 200) {
        errorMsg = errorMsg.substring(0, 200) + '...';
      }

      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `❌ **편집 실패**\n\n` +
        `오류: ${errorMsg}\n\n` +
        `💡 다른 옵션을 시도하거나 나중에 다시 시도해주세요.`
      );

      console.error('❌ Parameterized edit failed:', editResult.error);
    }

  } catch (error) {
    console.error('❌ Error in parameter callback:', error);
    await ctx.reply('❌ 파라미터 선택 처리 중 오류가 발생했습니다.');
  }
});

// Action button handlers for edited images

// NOTE: retry handler removed - replaced by back_to_categories and back_to_start
// Users now have direct access to categories or original image with AI recommendations

// Back to original image (DEPRECATED - replaced by back_to_start)
bot.callbackQuery(/^back:(.+):(.+)$/, async (ctx) => {
  try {
    const chatId = parseInt(ctx.match[1]);
    const messageId = parseInt(ctx.match[2]);
    const fileKey = `${chatId}:${messageId}`;

    let fileId = getFileId(fileKey);

    if (!fileId) {
      const { data } = await supabase
        .from('image_analysis_results')
        .select('analysis_data')
        .eq('message_id', messageId)
        .single();

      fileId = data?.analysis_data?.file_id;
      if (fileId) storeFileId(chatId, messageId, fileId);
    }

    if (!fileId) {
      await ctx.answerCallbackQuery('세션이 만료되었습니다.');
      return;
    }

    await ctx.answerCallbackQuery('원본 이미지를 다시 전송합니다...');

    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) {
      await ctx.reply('❌ 원본 이미지를 찾을 수 없습니다.');
      return;
    }

    const imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    await ctx.replyWithPhoto(imageUrl, {
      caption: '📸 **원본 이미지**\n\n다시 편집하시려면 위의 추천 버튼을 사용하세요.'
    });

  } catch (error) {
    console.error('❌ Error in back_to_original:', error);
    await ctx.reply('❌ 원본 이미지 전송 중 오류가 발생했습니다.');
  }
});

// Re-edit with same style
bot.callbackQuery(/^redo:([^:]+):(.+):(.+)$/, async (ctx) => {
  try {
    const templateKey = ctx.match[1];
    const chatId = parseInt(ctx.match[2]);
    const messageId = parseInt(ctx.match[3]);
    const fileKey = `${chatId}:${messageId}`;

    let fileId = getFileId(fileKey);

    if (!fileId) {
      const { data } = await supabase
        .from('image_analysis_results')
        .select('analysis_data')
        .eq('message_id', messageId)
        .single();

      fileId = data?.analysis_data?.file_id;
      if (fileId) storeFileId(chatId, messageId, fileId);
    }

    if (!fileId) {
      await ctx.answerCallbackQuery('세션이 만료되었습니다.');
      return;
    }

    await ctx.answerCallbackQuery('같은 스타일로 다시 편집합니다...');

    // Fetch template
    const { data: template, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('template_key', templateKey)
      .single();

    if (error || !template) {
      await ctx.reply('❌ 템플릿을 찾을 수 없습니다.');
      return;
    }

    // Get image URL
    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) {
      await ctx.reply('❌ 원본 이미지를 찾을 수 없습니다.');
      return;
    }

    const imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    // ========== CREDIT CHECK ==========
    const creditCheck = await checkCreditsBeforeEdit(ctx, templateKey);

    if (!creditCheck.canProceed) {
      if (creditCheck.message) {
        await ctx.reply(creditCheck.message);
      }

      if (creditCheck.shouldShowPurchaseOptions) {
        const keyboard = await getCreditPackagesKeyboard();
        const message = await getPurchaseOptionsMessage();
        await ctx.reply(message, { reply_markup: keyboard });
      }

      await ctx.answerCallbackQuery('크레딧이 부족합니다');
      return;
    }

    // Show welcome message for new users
    if (creditCheck.message && creditCheck.isRegistered) {
      await ctx.reply(creditCheck.message);
    }

    // Execute editing (same logic as template selection)
    const processingMsg = await ctx.reply(
      `🎨 **${template.template_name_ko}** 스타일로 다시 편집 중...\n\n` +
      `⚡ 잠시만 기다려주세요...`
    );

    const { editImageWithTemplate } = await import('../../src/services/image-edit-service');

    const editResult = await editImageWithTemplate({
      imageUrl,
      templatePrompt: template.base_prompt,
      templateName: template.template_name_ko,
      category: template.category,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      templateKey: templateKey
    });

    if (editResult.success && (editResult.outputUrl || editResult.outputFile)) {
      // ========== DEDUCT CREDIT ==========
      const deductResult = await deductCreditAfterEdit(
        ctx,
        templateKey,
        undefined,
        creditCheck.isFreeTrial
      );

      if (!deductResult.success) {
        console.error('❌ Failed to deduct credit:', deductResult.message);
      }

      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `✅ 편집 완료!`
      );

      // Create action buttons
      let actionKeyboard = new InlineKeyboard();

      // If free trial, add signup button first
      if (creditCheck.isFreeTrial) {
        const botUsername = ctx.me.username;
        actionKeyboard = actionKeyboard
          .url('지금 가입하고 5회 더 받기', `https://t.me/${botUsername}?start=group_signup`)
          .row();
      }

      // Add standard action buttons (unified UX)
      actionKeyboard = actionKeyboard
        .text('🔄 같은 스타일 다시', `redo:${template.template_key}:${fileKey}`).row()
        .text('📂 카테고리에서 선택', `back_to_categories:${fileKey}`)
        .text('🏠 처음으로', `back_to_start:${fileKey}`).row()
        .row()
        .text('👍 좋아요', `feedback:like:${template.template_key}:${fileKey}`)
        .text('👎 별로예요', `feedback:dislike:${template.template_key}:${fileKey}`);

      // Build caption with credit info (simplified)
      let caption = `✨ **${template.template_name_ko}** 편집 완료!`;

      // Add credit info for private chat or free trial
      if (creditCheck.isFreeTrial) {
        caption += `\n\n${deductResult.message}`;
      } else if (ctx.chat?.type === 'private') {
        caption += `\n\n💳 남은 크레딧: ${deductResult.remainingCredits}회`;
      }

      const photoSource = editResult.outputFile || editResult.outputUrl!;
      await ctx.replyWithPhoto(photoSource, {
        caption,
        reply_markup: actionKeyboard
      });

      // Send DM notification for group chat (non-free-trial users)
      const isGroupChat = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
      if (isGroupChat && !creditCheck.isFreeTrial) {
        await notifyCreditDeduction(ctx, deductResult.remainingCredits, true);
      }
    } else {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        `❌ 편집 실패: ${editResult.error}`
      );
    }

  } catch (error) {
    console.error('❌ Error in re_edit:', error);
    await ctx.reply('❌ 재편집 중 오류가 발생했습니다.');
  }
});

// NOTE: rate and rating handlers removed - feature not implemented
// Rating feature can be added later with proper database schema

// Template pagination handler (for "View All")
bot.callbackQuery(/^tp:(\d+):(.+):(.+)$/, async (ctx) => {
  try {
    const page = parseInt(ctx.match[1]);
    const chatId = parseInt(ctx.match[2]);
    const messageId = parseInt(ctx.match[3]);

    await ctx.answerCallbackQuery();

    const fileKey = `${chatId}:${messageId}`;

    // Fetch all templates
    const { data: allTemplates, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('priority', { ascending: false });

    if (error || !allTemplates) {
      await ctx.reply('❌ 템플릿 목록을 가져오는 중 오류가 발생했습니다.');
      return;
    }

    // Pagination settings
    const templatesPerPage = 8; // 한 줄에 1개씩
    const totalPages = Math.ceil(allTemplates.length / templatesPerPage);
    const start = page * templatesPerPage;
    const end = start + templatesPerPage;
    const pageTemplates = allTemplates.slice(start, end);

    // Create keyboard
    const keyboard = new InlineKeyboard();

    // Add template buttons (한 줄에 1개씩, 이모티콘 없이)
    pageTemplates.forEach(template => {
      keyboard.text(
        template.template_name_ko,
        `t:${template.template_key}:${fileKey}`
      ).row();
    });

    // Navigation buttons
    keyboard.row();
    if (page > 0) {
      keyboard.text('⬅️ 이전', `tp:${page - 1}:${fileKey}`);
    }
    keyboard.text(`${page + 1}/${totalPages}`, `noop`);
    if (page < totalPages - 1) {
      keyboard.text('➡️ 다음', `tp:${page + 1}:${fileKey}`);
    }

    // Back to categories
    keyboard.row();
    keyboard.text('🔙 카테고리로', `back_to_main:${fileKey}`);

    await ctx.editMessageText(
      `🎨 **전체 스타일** (${page + 1}/${totalPages} 페이지)\n\n` +
      `총 ${allTemplates.length}개 스타일 중 선택:`,
      { reply_markup: keyboard }
    );

  } catch (error) {
    console.error('❌ Error in template pagination:', error);
    await ctx.reply('❌ 페이지 이동 중 오류가 발생했습니다.');
  }
});

// Category pagination handler
bot.callbackQuery(/^catp:([^:]+):(\d+):(.+):(.+)$/, async (ctx) => {
  try {
    const category = ctx.match[1];
    const page = parseInt(ctx.match[2]);
    const chatId = parseInt(ctx.match[3]);
    const messageId = parseInt(ctx.match[4]);

    await ctx.answerCallbackQuery();

    const fileKey = `${chatId}:${messageId}`;

    // Get category name (without emojis)
    const categoryNames: Record<string, string> = {
      '3d_figurine': '3D/피규어',
      'portrait_styling': '인물 스타일',
      'game_animation': '게임/애니메이션',
      'image_editing': '이미지 편집',
      'creative_transform': '창의적 변환'
    };
    const categoryName = categoryNames[category] || category;

    // Fetch templates by category
    const { data: templates, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error || !templates) {
      await ctx.reply(`❌ ${categoryName} 카테고리를 불러오는 중 오류가 발생했습니다.`);
      return;
    }

    // Pagination settings
    const templatesPerPage = 8;
    const totalPages = Math.ceil(templates.length / templatesPerPage);
    const start = page * templatesPerPage;
    const end = start + templatesPerPage;
    const pageTemplates = templates.slice(start, end);

    // Create keyboard
    const keyboard = new InlineKeyboard();

    // Add template buttons (한 줄에 1개씩, 이모티콘 없이)
    pageTemplates.forEach(template => {
      keyboard.text(
        template.template_name_ko,
        `t:${template.template_key}:${fileKey}`
      ).row();
    });

    // Navigation buttons
    keyboard.row();
    if (page > 0) {
      keyboard.text('⬅️ 이전', `catp:${category}:${page - 1}:${fileKey}`);
    }
    keyboard.text(`${page + 1}/${totalPages}`, `noop`);
    if (page < totalPages - 1) {
      keyboard.text('➡️ 다음', `catp:${category}:${page + 1}:${fileKey}`);
    }

    // Back button
    keyboard.row();
    keyboard.text('🔙 카테고리로', `back_to_main:${fileKey}`);

    await ctx.editMessageText(
      `🎨 **${categoryName}** (${page + 1}/${totalPages} 페이지)\n\n` +
      `총 ${templates.length}개 스타일 중 선택:`,
      { reply_markup: keyboard }
    );

  } catch (error) {
    console.error('❌ Error in category pagination:', error);
    await ctx.reply('❌ 페이지 이동 중 오류가 발생했습니다.');
  }
});

// No-operation handler for page number display
bot.callbackQuery('noop', async (ctx) => {
  await ctx.answerCallbackQuery();
});

// Back to main categories handler
bot.callbackQuery(/^back_to_main:(.+):(.+)$/, async (ctx) => {
  try {
    const chatId = parseInt(ctx.match[1]);
    const messageId = parseInt(ctx.match[2]);

    await ctx.answerCallbackQuery();

    // Show categories menu
    const keyboard = new InlineKeyboard();
    const fileKey = `${chatId}:${messageId}`;

    // Category buttons (한 줄에 1개씩)
    keyboard.text('🎭 3D/피규어', `cat:3d_figurine:${fileKey}`).row();
    keyboard.text('👤 인물 스타일', `cat:portrait_styling:${fileKey}`).row();
    keyboard.text('🎮 게임/애니메이션', `cat:game_animation:${fileKey}`).row();
    keyboard.text('✂️ 이미지 편집', `cat:image_editing:${fileKey}`).row();
    keyboard.text('🎨 창의적 변환', `cat:creative_transform:${fileKey}`).row();

    // All templates button
    keyboard.row();
    keyboard.text('📋 전체 스타일 보기', `show_all:${fileKey}`);

    await ctx.editMessageText(
      '🎨 **카테고리 선택**\n\n' +
      '원하는 스타일 카테고리를 선택하세요:',
      { reply_markup: keyboard }
    );
  } catch (error) {
    console.error('❌ Error in back_to_main handler:', error);
    await ctx.answerCallbackQuery('❌ 오류가 발생했습니다.');
  }
});

// Back to categories handler (from result screen)
bot.callbackQuery(/^back_to_categories:(.+):(.+)$/, async (ctx) => {
  try {
    const chatId = parseInt(ctx.match[1]);
    const messageId = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();

    const keyboard = new InlineKeyboard();
    const fileKey = `${chatId}:${messageId}`;

    // Category buttons (no emojis for consistent UX)
    keyboard.text('3D/피규어', `cat:3d_figurine:${fileKey}`).row();
    keyboard.text('인물 스타일', `cat:portrait_styling:${fileKey}`).row();
    keyboard.text('게임/애니메이션', `cat:game_animation:${fileKey}`).row();
    keyboard.text('이미지 편집', `cat:image_editing:${fileKey}`).row();
    keyboard.text('창의적 변환', `cat:creative_transform:${fileKey}`).row();

    // All templates button
    keyboard.row();
    keyboard.text('📋 전체 스타일 보기', `show_all:${fileKey}`);

    await ctx.reply(
      '📂 **카테고리 선택**\n\n' +
      '원하는 스타일 카테고리를 선택하세요:',
      { reply_markup: keyboard }
    );
  } catch (error) {
    console.error('❌ Error in back_to_categories handler:', error);
    await ctx.answerCallbackQuery('❌ 오류가 발생했습니다.');
  }
});

// Show all templates handler (redirect to t:all)
bot.callbackQuery(/^show_all:(.+)$/, async (ctx) => {
  try {
    const fileKey = ctx.match[1];
    const [chatIdStr, messageIdStr] = fileKey.split(':');
    const chatId = parseInt(chatIdStr);
    const messageId = parseInt(messageIdStr);

    await ctx.answerCallbackQuery();

    // Get fileId from cache or database
    let fileId = getFileId(fileKey);

    if (!fileId) {
      const { data, error } = await supabase
        .from('image_analyses')
        .select('analysis_data')
        .eq('chat_id', chatId)
        .eq('message_id', messageId)
        .single();

      if (!error && data?.analysis_data?.file_id) {
        fileId = data.analysis_data.file_id;
        storeFileId(chatId, messageId, fileId);
      }
    }

    if (!fileId) {
      await ctx.reply('❌ 이미지 정보를 찾을 수 없습니다. 사진을 다시 업로드해주세요.');
      return;
    }

    // Fetch all templates from database
    const { data: allTemplates, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('priority', { ascending: false });

    if (error || !allTemplates) {
      await ctx.reply('❌ 템플릿 목록을 가져오는 중 오류가 발생했습니다.');
      return;
    }

    // Create paginated keyboard with all templates
    const keyboard = new InlineKeyboard();
    const templatesPerPage = 8;
    const totalPages = Math.ceil(allTemplates.length / templatesPerPage);
    const pageTemplates = allTemplates.slice(0, templatesPerPage);

    // Add template buttons (한 줄에 1개씩)
    pageTemplates.forEach(template => {
      keyboard.text(
        template.template_name_ko,
        `t:${template.template_key}:${chatId}:${messageId}`
      ).row();
    });

    // Navigation buttons
    keyboard.row();
    keyboard.text(`1/${totalPages}`, `noop`);
    if (allTemplates.length > templatesPerPage) {
      keyboard.text('➡️ 다음', `tp:1:${fileKey}`);
    }

    // Back to categories
    keyboard.row();
    keyboard.text('🔙 카테고리로', `back_to_main:${fileKey}`);

    await ctx.reply(
      `🎨 **전체 스타일** (1/${totalPages} 페이지)\n\n` +
      `총 ${allTemplates.length}개 스타일 중 선택:`,
      { reply_markup: keyboard }
    );

  } catch (error) {
    console.error('❌ Error in show_all handler:', error);
    await ctx.reply('❌ 전체 스타일 목록을 표시하는 중 오류가 발생했습니다.');
  }
});

// Back to start handler (show original image with AI recommendations)
bot.callbackQuery(/^back_to_start:(.+)$/, async (ctx) => {
  try {
    const fileKey = ctx.match[1];
    const [chatIdStr, messageIdStr] = fileKey.split(':');
    const chatId = parseInt(chatIdStr);
    const messageId = parseInt(messageIdStr);

    await ctx.answerCallbackQuery();

    // Get fileId from cache or database
    let fileId = getFileId(fileKey);

    if (!fileId) {
      const { data, error } = await supabase
        .from('image_analyses')
        .select('analysis_data')
        .eq('chat_id', chatId)
        .eq('message_id', messageId)
        .single();

      if (!error && data?.analysis_data?.file_id) {
        fileId = data.analysis_data.file_id;
        storeFileId(chatId, messageId, fileId);
      }
    }

    if (!fileId) {
      await ctx.reply('❌ 원본 이미지를 찾을 수 없습니다. 사진을 다시 업로드해주세요.');
      return;
    }

    // Get file path from Telegram
    const file = await ctx.api.getFile(fileId);
    const imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    // Re-analyze and show recommendations
    const { analyzeImage } = await import('../../src/services/image-analysis-service');
    const { getTemplateRecommendations } = await import('../../src/services/template-recommendation-service');
    const analysis = await analyzeImage(imageUrl);
    const recommendations = await getTemplateRecommendations(analysis, 3);

    // Build message with AI recommendations
    let message = `🤖 **AI 분석 결과**\n\n`;
    if (analysis.rawAnalysis) {
      message += `${analysis.rawAnalysis}\n\n`;
    }
    message += `**추천 스타일:**\n`;

    const keyboard = new InlineKeyboard();

    // Add recommendation buttons (3개, 한 줄에 1개씩)
    recommendations.forEach(rec => {
      const stars = '⭐'.repeat(Math.ceil(rec.confidence / 25));
      message += `${rec.nameKo} ${stars}\n`;
      keyboard.text(rec.nameKo, `t:${rec.templateKey}:${fileKey}`).row();
    });

    // Add category and view all buttons
    keyboard.row();
    keyboard.text('📂 카테고리에서 선택', `back_to_categories:${fileKey}`);
    keyboard.row();
    keyboard.text('📋 전체 스타일 보기', `show_all:${fileKey}`);

    // Send original image with recommendations
    await ctx.replyWithPhoto(imageUrl, {
      caption: message,
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('❌ Error in back_to_start handler:', error);
    await ctx.reply('❌ 처음으로 돌아가기 중 오류가 발생했습니다.');
  }
});

// Feedback handlers (like/dislike)
bot.callbackQuery(/^feedback:(like|dislike):([^:]+):(.+)$/, async (ctx) => {
  try {
    const feedbackType = ctx.match[1]; // 'like' or 'dislike'
    const templateKey = ctx.match[2];
    const fileKey = ctx.match[3];

    const satisfied = feedbackType === 'like';

    await ctx.answerCallbackQuery(satisfied ? '👍 감사합니다!' : '👎 피드백 감사합니다!');

    // Get template name
    const { data: template } = await supabase
      .from('prompt_templates')
      .select('template_name_ko')
      .eq('template_key', templateKey)
      .single();

    // Store feedback in database
    const { error } = await supabase
      .from('template_feedback')
      .insert({
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        template_key: templateKey,
        template_name: template?.template_name_ko || templateKey,
        satisfied: satisfied
      });

    if (error) {
      console.error('❌ Error storing feedback:', error);
    } else {
      console.log(`✅ Feedback stored: ${templateKey} - ${satisfied ? 'positive' : 'negative'}`);
    }

    // If dissatisfied, offer help
    if (!satisfied) {
      const keyboard = new InlineKeyboard()
        .text('🎨 다른 스타일 추천받기', `back_to_categories:${fileKey}`)
        .text('🏠 처음으로', `back_to_start:${fileKey}`);

      await ctx.reply(
        '😔 아쉽네요! 더 나은 결과를 위해 도와드리겠습니다.\n\n' +
        '다른 스타일을 시도해보시거나, 처음부터 다시 시작할 수 있습니다.',
        { reply_markup: keyboard }
      );
    } else {
      // Just acknowledge positive feedback
      await ctx.reply(
        '🎉 좋아해 주셔서 감사합니다!\n\n' +
        '계속해서 멋진 이미지를 만들어보세요! ✨'
      );
    }

  } catch (error) {
    console.error('❌ Error in feedback handler:', error);
    await ctx.answerCallbackQuery('❌ 피드백 처리 중 오류가 발생했습니다.');
  }
});

// Show credits callback - from referral page
bot.callbackQuery('show_credits', async (ctx) => {
  try {
    await ctx.answerCallbackQuery();

    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }

    const balanceMessage = await getCreditBalanceMessage(userId);
    await ctx.reply(balanceMessage, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('❌ Error in show_credits callback:', error);
    await ctx.answerCallbackQuery('오류가 발생했습니다.');
  }
});

// Category selection handler
bot.callbackQuery(/^cat:([^:]+):(.+):(.+)$/, async (ctx) => {
  try {
    const category = ctx.match[1];
    const chatId = parseInt(ctx.match[2]);
    const messageId = parseInt(ctx.match[3]);

    await ctx.answerCallbackQuery();

    // Get category name in Korean (without emojis)
    const categoryNames: Record<string, string> = {
      '3d_figurine': '3D/피규어',
      'portrait_styling': '인물 스타일',
      'game_animation': '게임/애니메이션',
      'image_editing': '이미지 편집',
      'creative_transform': '창의적 변환'
    };

    const categoryName = categoryNames[category] || category;

    // Fetch templates by category
    const { data: templates, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error || !templates || templates.length === 0) {
      await ctx.reply(`❌ ${categoryName} 카테고리의 템플릿을 찾을 수 없습니다.`);
      return;
    }

    // Create keyboard with category templates (한 줄에 1개씩)
    const fileKey = `${chatId}:${messageId}`;
    const keyboard = new InlineKeyboard();
    const templatesPerPage = 8;
    const pageTemplates = templates.slice(0, templatesPerPage);

    // Add template buttons (한 줄에 1개씩, 이모티콘 없이)
    pageTemplates.forEach(template => {
      keyboard.text(
        template.template_name_ko,
        `t:${template.template_key}:${fileKey}`
      ).row();
    });

    // Add pagination if more than 8 templates
    keyboard.row();
    if (templates.length > templatesPerPage) {
      keyboard.text('➡️ 다음', `catp:${category}:1:${fileKey}`);
    }

    // Add back button
    keyboard.row();
    keyboard.text('🔙 뒤로', `back_to_main:${fileKey}`);

    await ctx.reply(
      `🎨 **${categoryName} 스타일** (${templates.length}개)\n\n` +
      `원하는 스타일을 선택하세요:`,
      { reply_markup: keyboard }
    );

  } catch (error) {
    console.error('❌ Error in category selection:', error);
    await ctx.reply('❌ 카테고리 처리 중 오류가 발생했습니다.');
  }
});

// Helper function to get category emoji
function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    '3d_figurine': '🎭',
    'portrait_styling': '📸',
    'game_animation': '🎮',
    'image_editing': '🛠️',
    'creative_transform': '✨'
  };
  return emojiMap[category] || '🎨';
}

// Admin command: API cost dashboard
bot.command('apicost', async (ctx) => {
  try {
    // Check if user is admin (you can add admin user IDs to env)
    const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',').map(id => parseInt(id)) || [];
    const isAdmin = ADMIN_USER_IDS.includes(ctx.from?.id || 0);

    if (!isAdmin) {
      await ctx.reply('❌ This command is only available for administrators.');
      return;
    }

    const { getTotalCosts, getDailyCostSummary } = await import('../../src/services/api-cost-tracker');

    // Get 24-hour costs
    const last24h = await getTotalCosts(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
      new Date()
    );

    // Get 7-day costs
    const last7days = await getTotalCosts(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      new Date()
    );

    // Get 30-day costs
    const last30days = await getTotalCosts(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date()
    );

    // Get all-time costs
    const allTime = await getTotalCosts();

    const message = `📊 **API Usage & Cost Report**\n\n` +
      `**Last 24 Hours:**\n` +
      `• Total Calls: ${last24h.total_calls}\n` +
      `• Images Processed: ${last24h.total_images_processed}\n` +
      `• Cost: $${last24h.total_cost.toFixed(4)}\n` +
      `• Avg per call: $${(last24h.total_cost / (last24h.total_calls || 1)).toFixed(6)}\n\n` +
      `**Last 7 Days:**\n` +
      `• Total Calls: ${last7days.total_calls}\n` +
      `• Images Processed: ${last7days.total_images_processed}\n` +
      `• Cost: $${last7days.total_cost.toFixed(4)}\n\n` +
      `**Last 30 Days:**\n` +
      `• Total Calls: ${last30days.total_calls}\n` +
      `• Images Processed: ${last30days.total_images_processed}\n` +
      `• Cost: $${last30days.total_cost.toFixed(4)}\n\n` +
      `**All Time:**\n` +
      `• Total Calls: ${allTime.total_calls}\n` +
      `• Images Processed: ${allTime.total_images_processed}\n` +
      `• Total Cost: $${allTime.total_cost.toFixed(4)}\n\n` +
      `💡 *Pricing: Input $0.00001875/img, Output $0.000075/img*`;

    await ctx.reply(message);

  } catch (error) {
    console.error('❌ Error in apicost command:', error);
    await ctx.reply('❌ Failed to fetch API cost data.');
  }
});

// Bot commands
bot.command('start', async (ctx) => {
  console.log('📨 Start command received');

  try {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;

    if (!userId) {
      await ctx.reply('❌ 사용자 정보를 가져올 수 없습니다.');
      return;
    }

    // Get user from database to determine language
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    const lang = getUserLanguage(ctx, userData as User);

    // Check for referral code in /start parameter
    const startPayload = ctx.match;  // Gets the text after /start

    if (startPayload) {
      // Handle different types of deep links
      if (startPayload.startsWith('ref_')) {
        // Referral code: /start ref_MULTI12345
        const referralCode = startPayload.substring(4);  // Remove 'ref_' prefix
        console.log(`🎁 Referral code detected: ${referralCode}`);

        // Import referral service dynamically
        const { processReferral, formatReferredWelcome, formatReferrerNotification, getUserIdByReferralCode } = await import('../../src/services/referral-service');

        // Process the referral
        const result = await processReferral(referralCode, userId);

        if (result.success) {
          // Send welcome message to referred user
          await ctx.reply(formatReferredWelcome(result.referredReward || 10));

          // Notify referrer
          const referrerId = await getUserIdByReferralCode(referralCode);
          if (referrerId) {
            try {
              await bot.api.sendMessage(
                referrerId,
                formatReferrerNotification(username || `사용자 ${userId}`, result.referrerReward || 10)
              );
            } catch (error) {
              console.warn('⚠️ Could not notify referrer:', error);
            }
          }
        } else {
          // Show error but still show help message
          const errorPrefix = lang === 'en' ? `⚠️ ${result.message}\n\nPlease check the help below:` : `⚠️ ${result.message}\n\n아래 도움말을 확인하세요:`;
          await ctx.reply(errorPrefix);
        }
      } else if (startPayload === 'group_signup') {
        // Group free trial signup: /start group_signup
        console.log('🎁 Group free trial signup');
        const groupSignupMsg = lang === 'en'
          ? `🎉 **Welcome!**\n\n` +
            `You signed up after trying the bot in a group!\n` +
            `You received 5 credits as a signup bonus.\n\n` +
            `💡 Invite friends to earn more credits:\n` +
            `Use /referral command! 🚀`
          : `🎉 **가입을 환영합니다!**\n\n` +
            `그룹에서 무료 체험 후 가입하셨네요!\n` +
            `가입 보상으로 5 크레딧을 받으셨습니다.\n\n` +
            `💡 친구를 초대하면 더 많은 크레딧을 받을 수 있습니다:\n` +
            `/referral 명령어로 확인하세요! 🚀`;
        await ctx.reply(groupSignupMsg);
      }
    }

    // Show help message
    const helpMessage = await getHelpMessage(lang);
    await ctx.reply(helpMessage);

  } catch (error) {
    console.error('❌ Error in start command:', error);
    const lang = getUserLanguage(ctx);
    const helpMessage = await getHelpMessage(lang);
    await ctx.reply(helpMessage);
  }
});

// Help command - shows same content as start (with admin section if admin)
bot.command('help', async (ctx) => {
  console.log('❓ Help command received');

  try {
    const userId = ctx.from?.id || 0;

    // Get user from database to determine language
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    const lang = getUserLanguage(ctx, userData as User);

    // Check if user is admin
    const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',').map(id => parseInt(id)) || [];
    const isAdmin = ADMIN_USER_IDS.includes(userId);

    let helpMessage = await getHelpMessage(lang);

    // Add admin section if user is admin (always in Korean for now)
    if (isAdmin) {
      helpMessage += `\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      helpMessage += `🔧 **관리자 전용 명령어:**\n\n`;

      helpMessage += `**📊 대시보드 & 분석:**\n`;
      helpMessage += `• /admin - 통합 대시보드 (24h/7d/30d)\n`;
      helpMessage += `• /admin feedback [days] - 사용자 피드백 통계\n`;
      helpMessage += `• /apicost - API 사용량 및 비용\n\n`;

      helpMessage += `**👥 사용자 관리:**\n`;
      helpMessage += `• /admin user:search <id> - 사용자 검색\n`;
      helpMessage += `• /admin credit:grant <id> <amount> <reason> - 크레딧 지급\n\n`;

      helpMessage += `**🎨 프롬프트 관리:**\n`;
      helpMessage += `• /admin prompt:add - 새 프롬프트 추가 (LLM 분석)\n`;
      helpMessage += `• /admin prompt:list [category] - 프롬프트 목록\n`;
      helpMessage += `• /admin prompt:stats <key> [days] - 템플릿 상세 통계\n`;
      helpMessage += `• /admin prompt:view <key> - 프롬프트 상세\n`;
      helpMessage += `• /admin prompt:toggle <key> - 활성화/비활성화\n\n`;

      helpMessage += `**🛠️ 시스템:**\n`;
      helpMessage += `• /health - 시스템 상태 확인\n`;
      helpMessage += `• /whoami - User ID 확인\n`;
    }

    await ctx.reply(helpMessage);
  } catch (error) {
    console.error('❌ Error in help command:', error);
    const lang = getUserLanguage(ctx);
    const helpMessage = await getHelpMessage(lang);
    await ctx.reply(helpMessage);
  }
});

// Whoami command - shows user ID for admin setup
bot.command('whoami', async (ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'N/A';
  const firstName = ctx.from?.first_name || 'N/A';

  await ctx.reply(
    `👤 **당신의 정보:**\n\n` +
    `• **User ID**: \`${userId}\`\n` +
    `• **Username**: @${username}\n` +
    `• **이름**: ${firstName}\n\n` +
    `💡 **ADMIN_USER_IDS 환경변수에 추가하세요:**\n` +
    `\`ADMIN_USER_IDS=${userId}\``,
    { parse_mode: 'Markdown' }
  );
});

// Language command - allows users to change their language preference
bot.command('language', async (ctx) => {
  console.log('🌍 Language command received');

  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Get current language
    const { data: userData } = await supabase
      .from('users')
      .select('language_code')
      .eq('id', userId)
      .single();

    const currentLang = getUserLanguage(ctx, userData as User);
    const msg = t('selectLanguage', currentLang);

    // Create language selection keyboard
    const keyboard = new InlineKeyboard()
      .text('🇰🇷 한국어', 'lang:ko')
      .text('🇺🇸 English', 'lang:en');

    await ctx.reply(msg, { reply_markup: keyboard });
  } catch (error) {
    console.error('❌ Error in language command:', error);
    await ctx.reply('❌ Error changing language. Please try again.');
  }
});

// Handle language selection callback
bot.callbackQuery(/^lang:(ko|en)$/, async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    const selectedLang = ctx.match[1] as 'ko' | 'en';

    // Update language in database
    const { error } = await supabase
      .from('users')
      .update({ language_code: selectedLang })
      .eq('id', userId);

    if (error) {
      console.error('❌ Error updating language:', error);
      await ctx.answerCallbackQuery({ text: '❌ Error updating language' });
      return;
    }

    const langName = getLanguageDisplayName(selectedLang);
    const successMsg = t('languageChanged', selectedLang)(langName);

    await ctx.answerCallbackQuery({ text: successMsg });
    await ctx.editMessageText(successMsg);

    console.log(`✅ Language changed to ${selectedLang} for user ${userId}`);
  } catch (error) {
    console.error('❌ Error handling language callback:', error);
    await ctx.answerCallbackQuery({ text: '❌ Error' });
  }
});

// =============================================================================
// ADMIN COMMANDS - Dashboard, User Management, Credit Grant
// =============================================================================

/**
 * Admin dashboard - show real-time statistics
 * Usage: /admin or /admin dashboard [period]
 */
bot.command('admin', async (ctx) => {
  try {
    const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',').map(id => parseInt(id)) || [];
    const userId = ctx.from?.id || 0;

    if (!ADMIN_USER_IDS.includes(userId)) {
      await ctx.reply('❌ 관리자 권한이 필요합니다.');
      return;
    }

    const commandText = ctx.message?.text || '';
    const args = commandText.split(' ').slice(1);

    // Parse subcommand
    const subcommand = args[0] || 'dashboard';

    if (subcommand === 'dashboard' || !subcommand) {
      // Get period from args (default: 24h)
      const period = (args[1] === '7d' || args[1] === '30d') ? args[1] : '24h';

      console.log(`📊 Admin dashboard requested for period: ${period}`);

      const { getDashboardStats, formatDashboardMessage } = await import('../../src/services/admin-dashboard');
      const stats = await getDashboardStats(period);
      const message = formatDashboardMessage(stats);

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } else if (subcommand.startsWith('user:')) {
      // /admin user:search <user_id>
      const searchUserId = parseInt(args[1] || '0');

      if (!searchUserId || isNaN(searchUserId)) {
        await ctx.reply('❌ 올바른 User ID를 입력해주세요.\n\n사용법: `/admin user:search 123456789`', { parse_mode: 'Markdown' });
        return;
      }

      console.log(`🔍 Admin searching for user: ${searchUserId}`);

      const { getUserInfo, formatUserInfo } = await import('../../src/services/admin-users');
      const userInfo = await getUserInfo(searchUserId);

      if (!userInfo) {
        await ctx.reply(`❌ User ID ${searchUserId}를 찾을 수 없습니다.`);
        return;
      }

      const message = formatUserInfo(userInfo);
      await ctx.reply(message, { parse_mode: 'Markdown' });

    } else if (subcommand.startsWith('credit:')) {
      // /admin credit:grant <user_id> <amount> <reason>
      const targetUserId = parseInt(args[1] || '0');
      const amount = parseInt(args[2] || '0');
      const reason = args.slice(3).join(' ') || '관리자 지급';

      if (!targetUserId || isNaN(targetUserId)) {
        await ctx.reply('❌ 올바른 User ID를 입력해주세요.\n\n사용법: `/admin credit:grant 123456789 10 보상`', { parse_mode: 'Markdown' });
        return;
      }

      if (!amount || isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ 올바른 크레딧 수량을 입력해주세요. (1 이상)', { parse_mode: 'Markdown' });
        return;
      }

      console.log(`💳 Admin granting ${amount} credits to user ${targetUserId}: ${reason}`);

      const { grantCredits, notifyUserCreditGrant, formatCreditGrantMessage } = await import('../../src/services/admin-credits');

      const result = await grantCredits({
        userId: targetUserId,
        amount,
        reason,
        grantedBy: userId
      });

      // Get username for message
      const { getUserInfo } = await import('../../src/services/admin-users');
      const targetUser = await getUserInfo(targetUserId);
      const username = targetUser?.username;

      const message = formatCreditGrantMessage(result, username);
      await ctx.reply(message, { parse_mode: 'Markdown' });

      // Send DM to user
      if (result.success) {
        await notifyUserCreditGrant(bot, targetUserId, amount, reason);
      }

    } else if (subcommand === 'prompt:add') {
      // /admin prompt:add
      await ctx.reply(
        '📝 **새 프롬프트 추가**\n\n' +
        '프롬프트 텍스트를 입력해주세요.\n' +
        '(여러 줄 입력 가능)\n\n' +
        '예시:\n' +
        '```\n' +
        'Create a professional business card design with the person from this photo. ' +
        'Include name, title, and contact information in a modern, clean layout.\n' +
        '```\n\n' +
        '입력을 취소하려면 /cancel 을 입력하세요.',
        { parse_mode: 'Markdown' }
      );

      // Set user state to awaiting prompt input
      userStates.set(userId, 'awaiting_prompt_input');

    } else if (subcommand === 'prompt:list') {
      // /admin prompt:list [category]
      const category = args[1];

      console.log(`📝 Admin listing prompts, category: ${category || 'all'}`);

      const { getPromptList, formatPromptList, createCategoryKeyboard } =
        await import('../../src/services/admin-prompt-manager');

      const prompts = await getPromptList(category);
      const message = formatPromptList(prompts, category);

      if (!category) {
        // Show category selection
        const keyboard = createCategoryKeyboard();
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else {
        await ctx.reply(message, { parse_mode: 'Markdown' });
      }

    } else if (subcommand === 'feedback') {
      // /admin feedback [period]
      const period = parseInt(args[1]) || 7; // Default: 7 days

      console.log(`📊 Admin feedback dashboard requested for ${period} days`);

      // Get overall statistics
      const { data: overallStats, error: statsError } = await supabase
        .from('v_template_feedback_stats')
        .select('*')
        .order('total_feedback', { ascending: false })
        .limit(10);

      // Get recent feedback (last N days)
      const { data: recentStats, error: recentError } = await supabase
        .rpc('get_feedback_summary', { p_days: period });

      // Get low satisfaction alerts
      const { data: alerts, error: alertsError } = await supabase
        .from('v_low_satisfaction_alerts')
        .select('*');

      if (statsError || recentError || alertsError) {
        console.error('❌ Error fetching feedback stats:', statsError || recentError || alertsError);
        await ctx.reply('❌ 피드백 통계를 가져오는데 실패했습니다.');
        return;
      }

      // Format message
      let message = '📊 **사용자 피드백 대시보드**\n\n';

      // Overall stats (Top 10)
      if (overallStats && overallStats.length > 0) {
        message += '**전체 통계 (Top 10)**\n';
        overallStats.forEach((stat: any, idx: number) => {
          const emoji = stat.satisfaction_rate >= 80 ? '🟢' : stat.satisfaction_rate >= 60 ? '🟡' : '🔴';
          message += `${idx + 1}. ${emoji} ${stat.template_name}\n`;
          message += `   만족도: ${stat.satisfaction_rate}% (${stat.positive_count}👍 / ${stat.negative_count}👎)\n`;
          message += `   총 피드백: ${stat.total_feedback}회\n\n`;
        });
      } else {
        message += '아직 피드백이 없습니다.\n\n';
      }

      // Recent trends
      if (recentStats && recentStats.length > 0) {
        message += `\n**최근 ${period}일 트렌드**\n`;
        recentStats.forEach((stat: any) => {
          const trendEmoji = stat.trend === 'improving' ? '📈' :
                            stat.trend === 'declining' ? '📉' :
                            stat.trend === 'new' ? '🆕' : '➡️';
          message += `${trendEmoji} ${stat.template_name}: ${stat.satisfaction_rate}%\n`;
        });
        message += '\n';
      }

      // Low satisfaction alerts
      if (alerts && alerts.length > 0) {
        message += '\n🚨 **주의 필요한 템플릿**\n';
        message += '(만족도 50% 미만, 피드백 10개 이상)\n\n';
        alerts.forEach((alert: any) => {
          message += `🔴 ${alert.template_name}\n`;
          message += `   만족도: ${alert.satisfaction_rate}%\n`;
          message += `   불만족: ${alert.negative_count}회 / 총 ${alert.total_feedback}회\n\n`;
        });
      }

      message += '\n사용법: `/admin feedback [기간]`\n';
      message += '예시: `/admin feedback 30` (최근 30일)';

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } else if (subcommand.startsWith('prompt:stats')) {
      // /admin prompt:stats <template_key> [days]
      const templateKey = args[1];
      const days = parseInt(args[2]) || 30;

      if (!templateKey) {
        await ctx.reply('❌ Template key를 입력해주세요.\n\n사용법: `/admin prompt:stats <template_key> [days]`\n예시: `/admin prompt:stats pixar_3d 30`', { parse_mode: 'Markdown' });
        return;
      }

      console.log(`📊 Admin viewing prompt stats: ${templateKey}, ${days} days`);

      // Get detailed stats from database
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_template_stats', {
          p_template_key: templateKey,
          p_days: days
        });

      if (statsError || !statsData || statsData.length === 0) {
        console.error('❌ Error fetching prompt stats:', statsError);
        await ctx.reply(`❌ 템플릿 통계를 가져오는데 실패했습니다: \`${templateKey}\``, { parse_mode: 'Markdown' });
        return;
      }

      const stats = statsData[0];

      // Format message
      let message = `📊 **템플릿 상세 통계**\n\n`;
      message += `**템플릿:** ${stats.template_name}\n`;
      message += `**Key:** \`${stats.template_key}\`\n`;
      message += `**카테고리:** ${stats.category}\n`;
      message += `**상태:** ${stats.is_active ? '✅ 활성' : '❌ 비활성'}\n\n`;

      message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Overall stats
      message += `**📈 전체 통계**\n`;
      message += `• 총 사용: ${stats.total_uses || 0}회\n`;
      if (stats.success_rate !== null) {
        const emoji = stats.success_rate >= 90 ? '🟢' : stats.success_rate >= 70 ? '🟡' : '🔴';
        message += `• 성공률: ${emoji} ${stats.success_rate}%\n`;
      }
      if (stats.satisfaction_rate !== null && stats.total_feedback > 0) {
        const emoji = stats.satisfaction_rate >= 80 ? '🟢' : stats.satisfaction_rate >= 60 ? '🟡' : '🔴';
        message += `• 만족도: ${emoji} ${stats.satisfaction_rate}% (${stats.total_feedback}건 피드백)\n`;
      }
      if (stats.avg_processing_time_ms) {
        message += `• 평균 처리시간: ${Math.round(stats.avg_processing_time_ms / 1000)}초\n`;
      }
      message += `\n`;

      // Recent stats
      message += `**📅 최근 ${days}일**\n`;
      message += `• 사용: ${stats.recent_uses || 0}회\n`;
      if (stats.recent_success_rate !== null && stats.recent_uses > 0) {
        const emoji = stats.recent_success_rate >= 90 ? '🟢' : stats.recent_success_rate >= 70 ? '🟡' : '🔴';
        message += `• 성공률: ${emoji} ${stats.recent_success_rate}%\n`;
      }
      if (stats.recent_satisfaction_rate !== null && stats.recent_feedback > 0) {
        const emoji = stats.recent_satisfaction_rate >= 80 ? '🟢' : stats.recent_satisfaction_rate >= 60 ? '🟡' : '🔴';
        message += `• 만족도: ${emoji} ${stats.recent_satisfaction_rate}% (${stats.recent_feedback}건)\n`;
      }
      if (stats.recent_avg_processing_time_ms) {
        message += `• 평균 처리시간: ${Math.round(stats.recent_avg_processing_time_ms / 1000)}초\n`;
      }
      message += `\n`;

      // Trend analysis
      if (stats.success_rate !== null && stats.recent_success_rate !== null) {
        const successDiff = stats.recent_success_rate - stats.success_rate;
        if (Math.abs(successDiff) >= 5) {
          const trendEmoji = successDiff > 0 ? '📈' : '📉';
          message += `${trendEmoji} **성공률 트렌드:** ${successDiff > 0 ? '+' : ''}${successDiff.toFixed(1)}%\n`;
        }
      }

      if (stats.satisfaction_rate !== null && stats.recent_satisfaction_rate !== null) {
        const satDiff = stats.recent_satisfaction_rate - stats.satisfaction_rate;
        if (Math.abs(satDiff) >= 5) {
          const trendEmoji = satDiff > 0 ? '📈' : '📉';
          message += `${trendEmoji} **만족도 트렌드:** ${satDiff > 0 ? '+' : ''}${satDiff.toFixed(1)}%\n`;
        }
      }

      if (stats.first_used_at) {
        message += `\n**📅 타임라인**\n`;
        const firstUsed = new Date(stats.first_used_at);
        const lastUsed = stats.last_used_at ? new Date(stats.last_used_at) : null;
        message += `• 첫 사용: ${firstUsed.toLocaleDateString('ko-KR')}\n`;
        if (lastUsed) {
          message += `• 최근 사용: ${lastUsed.toLocaleDateString('ko-KR')}\n`;
        }
        if (stats.last_feedback_at) {
          const lastFeedback = new Date(stats.last_feedback_at);
          message += `• 최근 피드백: ${lastFeedback.toLocaleDateString('ko-KR')}\n`;
        }
      }

      message += `\n사용법: \`/admin prompt:stats <key> [days]\`\n`;
      message += `다른 기간: \`/admin prompt:stats ${templateKey} 7\` (7일)`;

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } else if (subcommand.startsWith('prompt:view')) {
      // /admin prompt:view <template_key>
      const templateKey = args[1];

      if (!templateKey) {
        await ctx.reply('❌ Template key를 입력해주세요.\n\n사용법: `/admin prompt:view <template_key>`', { parse_mode: 'Markdown' });
        return;
      }

      console.log(`📝 Admin viewing prompt: ${templateKey}`);

      const { getPromptDetail, getPromptStats, formatPromptDetail, createPromptDetailKeyboard } =
        await import('../../src/services/admin-prompt-manager');

      const prompt = await getPromptDetail(templateKey);

      if (!prompt) {
        await ctx.reply(`❌ 프롬프트를 찾을 수 없습니다: \`${templateKey}\``, { parse_mode: 'Markdown' });
        return;
      }

      const stats = await getPromptStats(templateKey);
      const message = formatPromptDetail(prompt, stats || undefined);
      const keyboard = createPromptDetailKeyboard(templateKey, prompt.is_active);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } else if (subcommand.startsWith('prompt:toggle')) {
      // /admin prompt:toggle <template_key>
      const templateKey = args[1];

      if (!templateKey) {
        await ctx.reply('❌ Template key를 입력해주세요.\n\n사용법: `/admin prompt:toggle <template_key>`', { parse_mode: 'Markdown' });
        return;
      }

      console.log(`📝 Admin toggling prompt status: ${templateKey}`);

      const { togglePromptStatus } = await import('../../src/services/admin-prompt-manager');

      const result = await togglePromptStatus(templateKey);

      await ctx.reply(
        result.success
          ? `✅ ${result.message}\n\n상태: ${result.is_active ? '✅ 활성' : '❌ 비활성'}`
          : `❌ ${result.message}`,
        { parse_mode: 'Markdown' }
      );

    } else if (subcommand.startsWith('prompt:priority')) {
      // /admin prompt:priority <template_key> <priority>
      const templateKey = args[1];
      const priority = parseInt(args[2] || '0');

      if (!templateKey || isNaN(priority)) {
        await ctx.reply(
          '❌ 올바른 형식으로 입력해주세요.\n\n' +
          '사용법: `/admin prompt:priority <template_key> <priority>`\n' +
          '우선순위: 0-100 사이의 숫자',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      console.log(`📝 Admin updating prompt priority: ${templateKey} → ${priority}`);

      const { updatePromptPriority } = await import('../../src/services/admin-prompt-manager');

      const result = await updatePromptPriority(templateKey, priority);

      await ctx.reply(
        result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
        { parse_mode: 'Markdown' }
      );

    } else {
      // Unknown subcommand
      await ctx.reply(
        `❌ 알 수 없는 관리자 명령어입니다.\n\n` +
        `**📊 대시보드 & 분석:**\n` +
        `• \`/admin\` - 통합 대시보드 (24h/7d/30d)\n` +
        `• \`/admin feedback [days]\` - 사용자 피드백 통계\n\n` +
        `**👥 사용자 관리:**\n` +
        `• \`/admin user:search <user_id>\` - 사용자 검색\n` +
        `• \`/admin credit:grant <user_id> <amount> <reason>\` - 크레딧 지급\n\n` +
        `**🎨 프롬프트 관리:**\n` +
        `• \`/admin prompt:add\` - 새 프롬프트 추가 (LLM 분석)\n` +
        `• \`/admin prompt:list [category]\` - 프롬프트 목록\n` +
        `• \`/admin prompt:stats <key> [days]\` - 템플릿 상세 통계\n` +
        `• \`/admin prompt:view <key>\` - 프롬프트 상세\n` +
        `• \`/admin prompt:toggle <key>\` - 활성화/비활성화\n\n` +
        `자세한 내용은 \`/help\`를 입력하세요.`,
        { parse_mode: 'Markdown' }
      );
    }

  } catch (error) {
    console.error('❌ Error in admin command:', error);
    await ctx.reply(`❌ 관리자 명령 실행 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

/**
 * Cancel command - Cancel any ongoing admin flow
 */
bot.command('cancel', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const currentState = userStates.get(userId);
  if (currentState) {
    userStates.delete(userId);
    await ctx.reply('✅ 입력이 취소되었습니다.');
  } else {
    await ctx.reply('취소할 진행 중인 작업이 없습니다.');
  }
});

/**
 * Message handler for prompt input (admin flow)
 */
bot.on('message:text', async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const userState = userStates.get(userId);

  // Check if user is in prompt input state
  if (userState === 'awaiting_prompt_input') {
    const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',').map(id => parseInt(id)) || [];

    if (!ADMIN_USER_IDS.includes(userId)) {
      userStates.delete(userId);
      return next();
    }

    const rawPrompt = ctx.message.text;
    const chatId = ctx.chat.id;

    // Immediately respond and clear state
    await ctx.reply('🔄 프롬프트를 분석 중입니다...\n\n⏱️ 10-20초 정도 소요됩니다. 잠시만 기다려주세요!');
    userStates.delete(userId);

    // Process analysis in background (non-blocking)
    (async () => {
      try {
        console.log(`📝 Starting background prompt analysis for user ${userId}`);

        const {
          analyzePromptWithLLM,
          saveAnalysisToQueue,
          formatAnalysisResult
        } = await import('../../src/services/prompt-analysis-service');

        console.log('📝 Calling analyzePromptWithLLM...');
        // LLM 분석
        const analysis = await analyzePromptWithLLM(rawPrompt);
        console.log(`✅ Analysis complete: ${analysis.title_ko}`);

        console.log('📝 Saving to queue...');
        // 대기열에 저장
        const queueId = await saveAnalysisToQueue(userId, rawPrompt, analysis);
        console.log(`✅ Saved to queue: ${queueId}`);

        // 결과 표시
        const message = formatAnalysisResult(analysis);

        const { InlineKeyboard } = await import('grammy');
        const keyboard = new InlineKeyboard()
          .text('✅ 승인하고 저장', `approve_prompt:${queueId}`)
          .row()
          .text('❌ 거부', `reject_prompt:${queueId}`);

        console.log(`📝 Sending result message to chat ${chatId}...`);
        await bot.api.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
        console.log('✅ Result message sent successfully');

      } catch (error) {
        console.error('❌ Error analyzing prompt (background):', error);
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

        try {
          await bot.api.sendMessage(
            chatId,
            '❌ 프롬프트 분석 중 오류가 발생했습니다.\n\n' +
            `오류: ${error instanceof Error ? error.message : String(error)}\n\n` +
            '다시 시도하려면 /admin prompt:add 를 입력하세요.'
          );
        } catch (sendError) {
          console.error('❌ Failed to send error message:', sendError);
        }
      }
    })().catch(err => {
      console.error('❌ Unhandled error in background analysis:', err);
    });

    return; // Don't call next() - we handled this message
  }

  // Pass to next handler if not in special state
  return next();
});

/**
 * Callback: Approve prompt
 */
bot.callbackQuery(/^approve_prompt:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const queueId = parseInt(ctx.match[1]);
  const userId = ctx.from?.id || 0;

  try {
    const { saveAnalysisAsTemplate, formatTemplateSavedMessage } =
      await import('../../src/services/prompt-analysis-service');

    const templateKey = await saveAnalysisAsTemplate(queueId, userId);

    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    await ctx.reply(formatTemplateSavedMessage(templateKey), { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('❌ Error saving prompt:', error);
    await ctx.reply(`❌ 저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

/**
 * Callback: Reject prompt
 */
bot.callbackQuery(/^reject_prompt:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const queueId = parseInt(ctx.match[1]);
  const userId = ctx.from?.id || 0;

  try {
    const { rejectAnalysis } = await import('../../src/services/prompt-analysis-service');
    await rejectAnalysis(queueId, userId, 'Rejected by admin');

    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    await ctx.reply('❌ 프롬프트가 거부되었습니다.');

  } catch (error) {
    console.error('❌ Error rejecting prompt:', error);
    await ctx.reply('❌ 오류가 발생했습니다.');
  }
});

/**
 * Callback: List prompts by category
 */
bot.callbackQuery(/^list_prompts:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const category = ctx.match[1] === 'all' ? undefined : ctx.match[1];

  try {
    const { getPromptList, formatPromptList } = await import('../../src/services/admin-prompt-manager');

    const prompts = await getPromptList(category);
    const message = formatPromptList(prompts, category);

    await ctx.editMessageText(message, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('❌ Error listing prompts:', error);
    await ctx.reply('❌ 프롬프트 목록을 불러올 수 없습니다.');
  }
});

/**
 * Callback: Toggle prompt status
 */
bot.callbackQuery(/^toggle_prompt:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const templateKey = ctx.match[1];

  try {
    const { togglePromptStatus, getPromptDetail, getPromptStats, formatPromptDetail, createPromptDetailKeyboard } =
      await import('../../src/services/admin-prompt-manager');

    const result = await togglePromptStatus(templateKey);

    if (result.success) {
      // Refresh the detail view
      const prompt = await getPromptDetail(templateKey);
      if (prompt) {
        const stats = await getPromptStats(templateKey);
        const message = formatPromptDetail(prompt, stats || undefined);
        const keyboard = createPromptDetailKeyboard(templateKey, prompt.is_active);

        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }

      await ctx.answerCallbackQuery(`✅ ${result.message}`);
    } else {
      await ctx.answerCallbackQuery(`❌ ${result.message}`);
    }

  } catch (error) {
    console.error('❌ Error toggling prompt:', error);
    await ctx.answerCallbackQuery('❌ 오류가 발생했습니다.');
  }
});

/**
 * Callback: Show prompt stats
 */
bot.callbackQuery(/^stats_prompt:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const templateKey = ctx.match[1];

  try {
    const { getPromptStats } = await import('../../src/services/admin-prompt-manager');

    const stats = await getPromptStats(templateKey);

    if (!stats) {
      await ctx.reply('❌ 통계를 불러올 수 없습니다.');
      return;
    }

    const message = `📊 **프롬프트 사용 통계**\n\n` +
      `Template: \`${templateKey}\`\n\n` +
      `**사용 현황:**\n` +
      `• 총 사용: ${stats.usage_count}회\n` +
      `• 성공: ${stats.success_count}회 (${stats.success_rate.toFixed(1)}%)\n` +
      `• 실패: ${stats.failure_count}회\n` +
      `• 평균 처리 시간: ${stats.avg_processing_time.toFixed(1)}초\n` +
      `• 마지막 사용: ${stats.last_used ? new Date(stats.last_used).toLocaleString('ko-KR') : '사용 안 됨'}`;

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('❌ Error getting prompt stats:', error);
    await ctx.reply('❌ 통계를 불러올 수 없습니다.');
  }
});

/**
 * Callback: Back to prompt list
 */
bot.callbackQuery('prompt_list', async (ctx) => {
  await ctx.answerCallbackQuery();

  try {
    const { getPromptList, formatPromptList, createCategoryKeyboard } =
      await import('../../src/services/admin-prompt-manager');

    const prompts = await getPromptList();
    const message = formatPromptList(prompts);
    const keyboard = createCategoryKeyboard();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('❌ Error returning to prompt list:', error);
    await ctx.reply('❌ 목록을 불러올 수 없습니다.');
  }
});

// Terms of Service command (required for Telegram Stars)
bot.command('terms', async (ctx) => {
  console.log('📜 Terms command received');

  const termsMessage = `📜 **이용 약관 (Terms of Service)**

**1. 서비스 개요**
• Multiful AI Bot은 AI 기반 이미지 편집 서비스를 제공합니다
• Telegram Stars를 통해 크레딧 및 구독을 구매할 수 있습니다

**2. 크레딧 시스템**
• 1 크레딧 = 1회 이미지 편집
• 크레딧은 환불 불가능하며, 구매 후 즉시 사용 가능합니다
• 무료 크레딧은 신규 가입 시 5개가 제공됩니다

**3. 구독 서비스**
• 구독은 월 단위로 자동 갱신됩니다
• 매월 초에 크레딧이 자동 충전됩니다
• 구독 취소는 언제든지 가능하며, 남은 기간까지 유효합니다

**4. 환불 정책**
• 디지털 상품 특성상 기본적으로 환불 불가합니다
• 기술적 오류로 인한 문제 발생 시 /support로 문의해주세요
• 정당한 사유가 인정될 경우 개별 검토 후 환불 가능합니다

**5. 서비스 이용 제한**
• 불법적이거나 유해한 콘텐츠 생성은 금지됩니다
• 서비스 남용 시 계정이 제한될 수 있습니다
• AI 생성 결과물의 저작권은 사용자에게 있습니다

**6. 개인정보 보호**
• 사용자 정보는 서비스 제공 목적으로만 사용됩니다
• Telegram ID, 사용 내역만 저장됩니다
• 업로드된 이미지는 편집 후 즉시 삭제됩니다

**7. 면책 사항**
• AI 생성 결과물의 정확성을 보장하지 않습니다
• 서비스 중단 시 사전 공지하며, 크레딧은 유지됩니다
• 제3자 API 장애로 인한 문제는 책임지지 않습니다

**8. 약관 변경**
• 본 약관은 사전 고지 후 변경될 수 있습니다
• 계속 사용 시 변경된 약관에 동의한 것으로 간주됩니다

**문의**: /support 명령어를 사용하세요

마지막 업데이트: 2025년 1월`;

  await ctx.reply(termsMessage);
});

// Credits command - check credit balance
bot.command('credits', async (ctx) => {
  console.log('💳 Credits command received');

  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ 사용자 정보를 확인할 수 없습니다.');
      return;
    }

    // Get user language
    const { data: userData } = await supabase
      .from('users')
      .select('language_code')
      .eq('id', userId)
      .single();

    const lang = getUserLanguage(ctx, userData as User);

    const balanceMessage = await getCreditBalanceMessage(userId);

    // Add purchase button if credits are low
    const { getCreditBalance } = await import('../../src/services/credit-manager');
    const balance = await getCreditBalance(userId);

    if (balance.total_credits < 5) {
      const keyboard = await getCreditPackagesKeyboard();
      const lowCreditsMsg = lang === 'en'
        ? `${balanceMessage}\n\n⚠️ Low credits!\n💡 Top up below:`
        : `${balanceMessage}\n\n⚠️ 크레딧이 부족합니다!\n💡 아래에서 충전하세요:`;

      await ctx.reply(lowCreditsMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      await ctx.reply(balanceMessage, { parse_mode: 'Markdown' });
    }

  } catch (error) {
    console.error('❌ Error in credits command:', error);
    const lang = getUserLanguage(ctx);
    const errorMsg = lang === 'en'
      ? '❌ Error loading credit information.'
      : '❌ 크레딧 정보를 불러오는 중 오류가 발생했습니다.';
    await ctx.reply(errorMsg);
  }
});

// Referral command - show referral code and statistics
bot.command('referral', async (ctx) => {
  console.log('🎁 Referral command received');

  try {
    const userId = ctx.from?.id;
    const botUsername = ctx.me.username;

    if (!userId) {
      await ctx.reply('❌ 사용자 정보를 확인할 수 없습니다.');
      return;
    }

    // Get user language
    const { data: userData } = await supabase
      .from('users')
      .select('language_code')
      .eq('id', userId)
      .single();

    const lang = getUserLanguage(ctx, userData as User);

    // Import referral service
    const { getReferralStats, formatReferralMessage, generateReferralLink } = await import('../../src/services/referral-service');

    // Get referral statistics
    const stats = await getReferralStats(userId);

    if (!stats) {
      const errorMsg = lang === 'en'
        ? '❌ Unable to load referral information. Please try again later.'
        : '❌ 추천 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.';
      await ctx.reply(errorMsg);
      return;
    }

    // Format and send message
    const message = formatReferralMessage(stats, botUsername);
    const referralLink = generateReferralLink(stats.referralCode, botUsername);

    // Check if user already has a referrer (show different button)
    const { data: hasReferrer } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_user_id', userId)
      .single();

    // Create share button with language-specific text
    const shareText = lang === 'en'
      ? `🎁 Join Multiful AI bot and get 10 FREE credits!\n\n✨ AI image editing with various styles\n🚀 Start now!`
      : `🎁 Multiful AI 봇에 가입하고 10 크레딧을 무료로 받으세요!\n\n✨ AI 이미지 편집, 다양한 스타일 변환\n🚀 지금 바로 시작하세요!`;

    const shareButtonText = lang === 'en' ? 'Share with friends' : '친구에게 공유하기';
    const creditsButtonText = lang === 'en' ? 'Check my credits' : '내 크레딧 확인';
    const enterCodeButtonText = lang === 'en' ? 'Enter referral code' : '추천 코드 입력하기';

    const keyboard = new InlineKeyboard()
      .url(shareButtonText, `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`)
      .row()
      .text(creditsButtonText, 'show_credits');

    // Add "Enter referral code" button only if user doesn't have a referrer yet
    if (!hasReferrer) {
      keyboard.row().text(enterCodeButtonText, 'enter_referral_code');
    }

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('❌ Error in referral command:', error);
    const lang = getUserLanguage(ctx);
    const errorMsg = lang === 'en'
      ? '❌ Error loading referral information.'
      : '❌ 추천 정보를 불러오는 중 오류가 발생했습니다.';
    await ctx.reply(errorMsg);
  }
});

// Enter referral code button handler
bot.callbackQuery('enter_referral_code', async (ctx) => {
  try {
    await ctx.answerCallbackQuery();

    const userId = ctx.from?.id;

    if (!userId) {
      return;
    }

    // Check if user already has a referrer
    const { supabase } = await import('../../src/utils/supabase');
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_user_id', userId)
      .single();

    if (existing) {
      await ctx.reply('❌ 이미 추천인이 등록되어 있습니다.\n\n한 번만 추천 코드를 사용할 수 있습니다.');
      return;
    }

    await ctx.reply(
      '🔑 **추천 코드 입력**\n\n' +
      '친구에게 받은 추천 코드를 입력하세요.\n' +
      '(예: MULTI12345)\n\n' +
      '💡 **사용법:**\n' +
      '`/enter_code MULTI12345`\n\n' +
      '또는 친구가 보낸 링크를 클릭해도 됩니다!',
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    console.error('❌ Error in enter_referral_code callback:', error);
    await ctx.answerCallbackQuery('오류가 발생했습니다.');
  }
});

// Process manual referral code input
bot.command('enter_code', async (ctx) => {
  console.log('🔑 Processing referral code input');

  try {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const commandText = ctx.message?.text || '';
    const args = commandText.split(' ').slice(1);

    if (!userId) {
      await ctx.reply('❌ 사용자 정보를 확인할 수 없습니다.');
      return;
    }

    // Check if code was provided
    if (args.length === 0) {
      await ctx.reply(
        '🔑 **추천 코드를 입력하세요**\n\n' +
        '**사용법:** `/enter_code MULTI12345`\n\n' +
        '💡 친구에게 받은 추천 코드를 공백 뒤에 입력하세요.\n\n' +
        '예시:\n' +
        '`/enter_code MULTI12345`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const referralCode = args[0].toUpperCase();

    // Validate format
    if (!referralCode.startsWith('MULTI') || referralCode.length !== 10) {
      await ctx.reply(
        '❌ **잘못된 코드 형식입니다**\n\n' +
        '추천 코드는 `MULTI` + 5자리 숫자 형식입니다.\n' +
        '(예: MULTI12345)\n\n' +
        '다시 확인 후 입력해주세요.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Process referral
    const { processReferral, formatReferredWelcome, formatReferrerNotification, getUserIdByReferralCode } = await import('../../src/services/referral-service');

    const result = await processReferral(referralCode, userId);

    if (result.success) {
      // Send welcome message to referred user
      await ctx.reply(formatReferredWelcome(result.referredReward || 10));

      // Notify referrer
      const referrerId = await getUserIdByReferralCode(referralCode);
      if (referrerId) {
        try {
          await bot.api.sendMessage(
            referrerId,
            formatReferrerNotification(username || `사용자 ${userId}`, result.referrerReward || 10)
          );
        } catch (error) {
          console.warn('⚠️ Could not notify referrer:', error);
        }
      }
    } else {
      await ctx.reply(`❌ ${result.message}`);
    }

  } catch (error) {
    console.error('❌ Error processing referral code:', error);
    await ctx.reply('❌ 추천 코드 처리 중 오류가 발생했습니다.');
  }
});

// Support command (required for Telegram Stars)
bot.command('support', async (ctx) => {
  console.log('💬 Support command received');

  const supportMessage = `💬 **고객 지원 (Customer Support)**

**결제 관련 문의**
• 결제 오류, 크레딧 미지급 등
• 환불 요청 (정당한 사유 필요)
• 구독 관리 문제

**기술적 문제**
• 이미지 편집 실패
• 봇 오작동
• 기타 오류

**📧 지원 채널:**
1. GitHub Issues: https://github.com/eardori/telegram-ai-bot/issues
2. 이메일: support@multiful.ai (계획 중)
3. Telegram 그룹: (계획 중)

**⏰ 응답 시간:**
• 영업일 기준 24-48시간 이내

**📝 문의 시 포함 정보:**
• 사용자 ID: ${ctx.from?.id}
• 문제 발생 시각
• 스크린샷 (가능한 경우)
• 상세한 문제 설명

**💡 자주 묻는 질문:**
• 크레딧이 차감되지 않나요? → /help 참고
• 이미지 편집이 실패했나요? → 다시 시도해주세요
• 구독을 취소하고 싶나요? → 설정에서 취소 가능

감사합니다!`;

  await ctx.reply(supportMessage);
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

bot.command('test_replicate', async (ctx) => {
  console.log('🔞 Replicate API test command received');

  // Admin only
  const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',').map(id => parseInt(id)) || [];
  const userId = ctx.from?.id || 0;

  if (!ADMIN_USER_IDS.includes(userId)) {
    await ctx.reply('❌ 관리자 권한이 필요합니다.');
    return;
  }

  try {
    await ctx.reply('🔄 **Replicate API 테스트 중...**\n\n📍 Render.com 서버에서 실행\n⏱️ 최대 30초 소요', {
      parse_mode: 'Markdown'
    });

    // Dynamic import
    const { replicateService } = await import('../../src/services/replicate-service');

    // Test with simple prompt and small image size for speed
    const startTime = Date.now();
    const result = await replicateService.generateNSFWImage(
      'a beautiful sunset over the ocean',
      {
        width: 512,
        height: 512,
        steps: 10  // Faster generation
      }
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Success
    await ctx.reply(`✅ **Replicate API 테스트 성공!**

🎯 결과:
• 생성 시간: ${duration}초
• 이미지 URL: ${result[0] ? '✅ 생성됨' : '❌ 실패'}
• 서버: Render.com
• Cloudflare: ✅ 차단 해제됨

🔗 이미지 링크:
${result[0] || 'N/A'}`, {
      parse_mode: 'Markdown'
    });

    console.log(`✅ Replicate API test successful (${duration}s)`);

  } catch (error) {
    console.error('❌ Replicate API test failed:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const is403 = errorMessage.includes('403') || errorMessage.includes('Forbidden');

    await ctx.reply(`❌ **Replicate API 테스트 실패**

🔍 상태: ${is403 ? '403 Forbidden (Cloudflare 차단)' : '알 수 없는 오류'}
📍 서버: Render.com (IP: 54.254.162.138)
⏰ 시각: ${new Date().toISOString()}

${is403
  ? '🚨 **Cloudflare가 여전히 Render.com IP를 차단 중입니다**\n\n' +
    '다음 정보를 Render.com 지원팀에 전달하세요:\n' +
    '• Cloudflare Ray ID: 98cd61199e8587a0\n' +
    '• Blocked IP: 54.254.162.138\n' +
    '• Target: api.replicate.com\n' +
    '• Issue: 403 Forbidden (IP still blacklisted)'
  : `💡 API 키 또는 네트워크 설정을 확인해주세요.\n에러: ${errorMessage.substring(0, 200)}`}`, {
      parse_mode: 'Markdown'
    });
  }
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

// NSFW Image Generation with Replicate
bot.command('nsfw_imagine', async (ctx) => {
  const prompt = ctx.message?.text?.replace('/nsfw_imagine', '').trim() || '';

  if (!prompt) {
    await ctx.reply(`🔞 **NSFW 이미지 생성 사용법:**

/nsfw_imagine [프롬프트]

⚠️ **주의사항:**
• 성인용 콘텐츠 생성 기능입니다
• 일일 5회 제한
• 20 토큰 소모
• 처리 시간: 약 30-60초

💡 **예시:**
• /nsfw_imagine beautiful woman in elegant dress
• /nsfw_imagine artistic portrait photography

🤖 **AI**: Flux.1Dev Uncensored (MSFLUX NSFW v3)`);
    return;
  }

  if (!replicateService.isAvailable()) {
    await ctx.reply(`❌ **NSFW 생성 기능이 비활성화되어 있습니다.**

관리자에게 문의하세요.`);
    return;
  }

  console.log(`🔞 NSFW image generation requested: "${prompt}"`);

  try {
    // Check daily limit - DISABLED FOR TESTING
    // const { data: limitCheck } = await supabase.rpc('check_nsfw_daily_limit', {
    //   p_user_id: ctx.from!.id
    // });

    // if (!limitCheck) {
    //   await ctx.reply(`❌ **일일 생성 제한 초과**

    // 오늘은 이미 5회의 NSFW 콘텐츠를 생성하셨습니다.
    // 내일 다시 시도해주세요.`);
    //   return;
    // }

    const generatingMessage = await ctx.reply(`🔞 **NSFW 이미지 생성 중...**

📝 프롬프트: "${prompt}"
🤖 AI: Flux.1Dev Uncensored
⏳ 약 30-60초 소요됩니다...

🔔 완료되면 알림을 보내드립니다.`);

    // Create database record
    const { data: generation, error: dbError } = await supabase
      .from('nsfw_generations')
      .insert({
        user_id: ctx.from!.id,
        chat_id: ctx.chat!.id,
        type: 'image',
        prompt: prompt,
        model_version: 'flux-1dev-uncensored',
        status: 'processing'
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Failed to create generation record:', dbError);
      await ctx.api.editMessageText(
        ctx.chat!.id,
        generatingMessage.message_id,
        '❌ 데이터베이스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      );
      return;
    }

    // Generate image
    const imageUrls = await replicateService.generateNSFWImage(prompt);

    // Update database
    await supabase
      .from('nsfw_generations')
      .update({
        status: 'completed',
        output_url: imageUrls[0],
        completed_at: new Date().toISOString()
      })
      .eq('id', generation.id);

    // Delete processing message
    await ctx.api.deleteMessage(ctx.chat!.id, generatingMessage.message_id);

    // Send result
    for (const url of imageUrls) {
      await ctx.replyWithPhoto(url, {
        caption: imageUrls.length === 1 ? `✨ **NSFW 이미지 생성 완료!**

📝 프롬프트: "${prompt}"
🤖 AI: Flux.1Dev Uncensored (MSFLUX NSFW v3)
💰 비용: 20 토큰

🔞 성인용 콘텐츠입니다.` : undefined
      });
    }

    console.log('✅ NSFW image generated successfully!');

  } catch (error) {
    console.error('❌ NSFW image generation error:', error);

    // Extract meaningful error message
    let errorMsg = 'Unknown error';
    if (error instanceof Error) {
      if (error.message.includes('403')) {
        errorMsg = 'API 접근 거부 (403). Replicate 계정 또는 토큰을 확인해주세요.';
      } else if (error.message.includes('401')) {
        errorMsg = 'API 인증 실패. 토큰이 올바르지 않습니다.';
      } else if (error.message.includes('429')) {
        errorMsg = 'API 사용량 한도 초과. 잠시 후 다시 시도해주세요.';
      } else {
        // Use only first 100 characters of error message
        errorMsg = error.message.substring(0, 100);
      }
    }

    await ctx.reply(`❌ **NSFW 이미지 생성 실패**

오류: ${errorMsg}

💡 관리자에게 문의하거나 잠시 후 다시 시도해주세요.`);
  }
});

// NSFW Video Generation with Replicate
bot.command('nsfw_video', async (ctx) => {
  const prompt = ctx.message?.text?.replace('/nsfw_video', '').trim() || '';

  if (!prompt) {
    await ctx.reply(`🔞 **NSFW 비디오 생성 사용법:**

/nsfw_video [프롬프트]

⚠️ **주의사항:**
• 성인용 비디오 생성 기능입니다
• 일일 5회 제한
• 30 토큰 소모
• 처리 시간: 약 2-5분

💡 **예시:**
• /nsfw_video woman walking in the rain
• /nsfw_video dancer performing on stage

🤖 **AI**: Zeroscope V2 XL (Replicate)`);
    return;
  }

  if (!replicateService.isAvailable()) {
    await ctx.reply(`❌ **NSFW 생성 기능이 비활성화되어 있습니다.**

관리자에게 문의하세요.`);
    return;
  }

  console.log(`🔞 NSFW video generation requested: "${prompt}"`);

  try {
    // Check daily limit - DISABLED FOR TESTING
    // const { data: limitCheck } = await supabase.rpc('check_nsfw_daily_limit', {
    //   p_user_id: ctx.from!.id
    // });

    // if (!limitCheck) {
    //   await ctx.reply(`❌ **일일 생성 제한 초과**

    // 오늘은 이미 5회의 NSFW 콘텐츠를 생성하셨습니다.
    // 내일 다시 시도해주세요.`);
    //   return;
    // }

    const generatingMessage = await ctx.reply(`🔞 **NSFW 비디오 생성 중...**

📝 프롬프트: "${prompt}"
🤖 AI: Zeroscope V2 XL
⏳ 약 2-5분 소요됩니다...

🔔 완료되면 알림을 보내드립니다.`);

    // Create database record
    const { data: generation, error: dbError } = await supabase
      .from('nsfw_generations')
      .insert({
        user_id: ctx.from!.id,
        chat_id: ctx.chat!.id,
        type: 'video',
        prompt: prompt,
        model_version: 'zeroscope-v2-xl',
        status: 'processing',
        tokens_used: 30
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Failed to create generation record:', dbError);
      await ctx.api.editMessageText(
        ctx.chat!.id,
        generatingMessage.message_id,
        '❌ 데이터베이스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      );
      return;
    }

    // Generate video
    const videoUrl = await replicateService.generateNSFWVideo(prompt);

    // Update database
    await supabase
      .from('nsfw_generations')
      .update({
        status: 'completed',
        output_url: videoUrl,
        completed_at: new Date().toISOString()
      })
      .eq('id', generation.id);

    // Delete processing message
    await ctx.api.deleteMessage(ctx.chat!.id, generatingMessage.message_id);

    // Send result
    await ctx.replyWithVideo(videoUrl, {
      caption: `✨ **NSFW 비디오 생성 완료!**

📝 프롬프트: "${prompt}"
🤖 AI: Zeroscope V2 XL
💰 비용: 30 토큰

🔞 성인용 콘텐츠입니다.`
    });

    console.log('✅ NSFW video generated successfully!');

  } catch (error) {
    console.error('❌ NSFW video generation error:', error);
    await ctx.reply(`❌ **NSFW 비디오 생성 실패**

오류: ${(error as Error).message}

💡 다른 프롬프트로 다시 시도해주세요.`);
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

// Photo handling moved to image-edit-handler.ts for automatic AI suggestions
// Old photo handler has been completely removed to avoid conflicts
// Now all photo handling is done in image-edit-handler.ts which provides:
// - Automatic AI analysis and edit suggestions when photos are uploaded
// - Single photo: prioritizes figurine, styling, quality enhancement
// - Multiple photos: prioritizes merging, outfit swap, background replacement

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

      // Use the new photo upload handler with image analysis system
      try {
        const photo = replyToMessage.photo[replyToMessage.photo.length - 1];

        // Create a temporary context with the photo
        const photoCtx = {
          ...ctx,
          message: {
            ...ctx.message,
            photo: replyToMessage.photo,
            message_id: replyToMessage.message_id
          }
        };

        await ctx.reply('🔍 사진을 분석 중입니다...');

        // Handle photo upload (will trigger analysis and show recommendations)
        const uploadResult = await handlePhotoUpload(photoCtx as any);

        if (!uploadResult.success) {
          await ctx.reply(`❌ 사진 처리 중 오류가 발생했습니다.\n\n${uploadResult.error}`);
          return;
        }

        // Build message with AI suggestions and recommendations
        let message = `✅ **사진 분석 완료!**\n\n`;
        message += `🔍 **분석 결과:**\n${uploadResult.analysisSummary || '분석 중...'}\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Store file ID in cache
        const fileKey = storeFileId(ctx.chat!.id, replyToMessage.message_id, photo.file_id);

        // Create inline keyboard
        const keyboard = new InlineKeyboard();

        // Add AI Suggestions first
        const aiSuggestions = uploadResult.analysis?.aiSuggestions || [];
        if (aiSuggestions.length > 0) {
          // Store AI suggestions
          storeAISuggestions(fileKey, aiSuggestions);
          message += `✨ **AI 추천 (이 사진만을 위한 특별 제안):**\n\n`;

          aiSuggestions.forEach((suggestion, index) => {
            message += `${index + 1}. **${suggestion.title}**\n`;
            message += `   ${suggestion.description}\n\n`;

            keyboard.text(suggestion.title, `ai:${index}:${fileKey}`);
            if ((index + 1) % 2 === 0 || index === aiSuggestions.length - 1) {
              keyboard.row();
            }
          });

          message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        }

        // Add template recommendations
        if (uploadResult.recommendations && uploadResult.recommendations.length > 0) {
          message += `🎯 **템플릿 추천** (적합도 순):\n\n`;

          uploadResult.recommendations.slice(0, 4).forEach((rec) => {
            const stars = '⭐'.repeat(Math.ceil(rec.confidence / 25));
            message += `${rec.emoji} ${rec.nameKo} ${stars}\n`;
          });

          message += `\n💡 **아래 버튼을 눌러 스타일을 선택하세요:**\n`;

          // Add template buttons (no emoji)
          uploadResult.recommendations.slice(0, 4).forEach(rec => {
            keyboard.text(rec.nameKo, `t:${rec.templateKey}:${fileKey}`).row();
          });
        }

        // Add category buttons (no emoji)
        keyboard.row();
        keyboard.text('3D/피규어', `cat:3d_figurine:${fileKey}`)
          .text('인물 스타일', `cat:portrait_styling:${fileKey}`)
          .text('게임/애니', `cat:game_animation:${fileKey}`);
        keyboard.row();
        keyboard.text('이미지 편집', `cat:image_editing:${fileKey}`)
          .text('창의적 변환', `cat:creative_transform:${fileKey}`);

        // Add "View All" button
        keyboard.row();
        keyboard.text('📋 전체 스타일 보기', `show_all:${fileKey}`);

        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });

        return; // Exit after handling with new system

      } catch (error) {
        console.error('❌ Error in photo reply handler:', error);
        await ctx.reply('❌ 사진 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
        return;
      }
    }

    // OLD IMPLEMENTATION BELOW - This code will not run anymore
    if (false) {
      
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

      return; // Exit after handling image editing (OLD CODE - DISABLED)
    } // End of if (false) block
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

// =============================================================================
// TELEGRAM STARS PAYMENT HANDLERS
// Register BEFORE image editing handlers to prevent interception
// =============================================================================

/**
 * Handle "buy credits" button click
 */
bot.callbackQuery(/^buy_credits:(.+)$/, async (ctx) => {
  try {
    console.log('🔔 Buy credits button clicked!');
    console.log('Callback data:', ctx.callbackQuery?.data);
    console.log('From user:', ctx.from?.id, ctx.from?.username);

    const packageKey = ctx.match[1];
    console.log('Package key:', packageKey);

    await ctx.answerCallbackQuery('결제 페이지를 생성하는 중...');
    console.log('✅ Callback query answered');

    console.log(`💳 Creating invoice for package: ${packageKey}`);

    const success = await createCreditPackageInvoice(ctx, packageKey);

    if (!success) {
      console.error('❌ Failed to create invoice');
      await ctx.reply('❌ Invoice 생성에 실패했습니다. 로그를 확인해주세요.');
    } else {
      console.log('✅ Invoice created successfully');
    }

  } catch (error) {
    console.error('❌ Error in buy_credits handler:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    await ctx.reply(`❌ 결제 페이지 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

/**
 * Handle "subscribe" button click
 */
bot.callbackQuery(/^subscribe:(.+)$/, async (ctx) => {
  try {
    const planKey = ctx.match[1];
    await ctx.answerCallbackQuery('구독 결제 페이지를 생성하는 중...');

    console.log(`💳 Creating subscription invoice for plan: ${planKey}`);

    const success = await createSubscriptionInvoice(ctx, planKey);

    if (!success) {
      console.error('❌ Failed to create subscription invoice');
    }

  } catch (error) {
    console.error('❌ Error in subscribe handler:', error);
    await ctx.reply('❌ 구독 결제 페이지 생성 중 오류가 발생했습니다.');
  }
});

/**
 * Handle "show subscriptions" button click
 */
bot.callbackQuery('show_subscriptions', async (ctx) => {
  try {
    await ctx.answerCallbackQuery();

    const { getSubscriptionPlansKeyboard, getSubscriptionOptionsMessage } = await import('../../src/services/purchase-ui-service');

    const keyboard = await getSubscriptionPlansKeyboard();
    const message = await getSubscriptionOptionsMessage();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('❌ Error showing subscriptions:', error);
    await ctx.reply('❌ 구독 플랜을 불러오는 중 오류가 발생했습니다.');
  }
});

/**
 * Handle "show packages" button click
 */
bot.callbackQuery('show_packages', async (ctx) => {
  try {
    await ctx.answerCallbackQuery();

    const keyboard = await getCreditPackagesKeyboard();
    const message = await getPurchaseOptionsMessage();

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

  } catch (error) {
    console.error('❌ Error showing packages:', error);
    await ctx.reply('❌ 크레딧 패키지를 불러오는 중 오류가 발생했습니다.');
  }
});

/**
 * Handle "cancel purchase" button click
 */
bot.callbackQuery('cancel_purchase', async (ctx) => {
  try {
    await ctx.answerCallbackQuery('취소되었습니다');
    await ctx.deleteMessage();
  } catch (error) {
    console.error('❌ Error canceling purchase:', error);
  }
});

/**
 * Handle pre-checkout query
 * This is called before the payment is confirmed
 */
bot.on('pre_checkout_query', async (ctx) => {
  try {
    console.log('💳 Pre-checkout query received');
    console.log('Payload:', ctx.preCheckoutQuery?.invoice_payload);
    console.log('Total amount:', ctx.preCheckoutQuery?.total_amount);

    const payload = ctx.preCheckoutQuery!.invoice_payload;
    const totalAmount = ctx.preCheckoutQuery!.total_amount;

    // Validate payment
    const validation = await validatePayment(payload, totalAmount);

    if (validation.valid) {
      // Approve payment
      await ctx.answerPreCheckoutQuery(true);
      console.log('✅ Payment approved');
    } else {
      // Reject payment
      await ctx.answerPreCheckoutQuery(false, validation.error);
      console.log('❌ Payment rejected:', validation.error);
    }

  } catch (error) {
    console.error('❌ Error in pre-checkout handler:', error);
    await ctx.answerPreCheckoutQuery(false, '결제 처리 중 오류가 발생했습니다.');
  }
});

/**
 * Handle successful payment
 * This is called after the payment is completed
 */
bot.on('message:successful_payment', async (ctx) => {
  try {
    console.log('💰 Successful payment received!');

    const payment = ctx.message?.successful_payment;
    if (!payment) {
      console.error('❌ No payment data');
      return;
    }

    console.log('Payment details:', {
      currency: payment.currency,
      total_amount: payment.total_amount,
      invoice_payload: payment.invoice_payload,
      telegram_payment_charge_id: payment.telegram_payment_charge_id
    });

    const payloadData = parsePaymentPayload(payment.invoice_payload);

    if (!payloadData) {
      await ctx.reply('❌ 결제 정보를 처리할 수 없습니다. 관리자에게 문의해주세요.');
      return;
    }

    const userId = ctx.from!.id;

    if (payloadData.type === 'credit_package') {
      // Handle credit package purchase
      const { getPackageByKey } = await import('../../src/services/credit-manager');
      const pkg = await getPackageByKey(payloadData.package_key!);

      if (!pkg) {
        await ctx.reply('❌ 패키지 정보를 찾을 수 없습니다.');
        return;
      }

      // Add credits to user account
      const totalCredits = pkg.credits + pkg.bonus_credits;
      const result = await addCredits(
        userId,
        totalCredits,
        'paid',
        `Purchase: ${pkg.package_name_ko}`,
        pkg.package_key
      );

      if (result.success) {
        await ctx.reply(getPaymentSuccessMessage(
          'credit_package',
          pkg.package_name_ko,
          totalCredits
        ));

        console.log(`✅ Credits added: ${totalCredits} to user ${userId}`);

        // Log transaction in database
        await supabase
          .from('credit_transactions')
          .insert({
            user_id: userId,
            transaction_type: 'purchase',
            credit_type: 'paid',
            amount: totalCredits,
            balance_after: result.new_balance,
            description: `Telegram Stars: ${pkg.package_name_ko}`,
            payment_provider: 'telegram_stars',
            payment_id: payment.telegram_payment_charge_id,
            package_key: pkg.package_key
          });

      } else {
        await ctx.reply('❌ 크레딧 충전 중 오류가 발생했습니다. 관리자에게 문의해주세요.');
        console.error('❌ Failed to add credits:', result.message);
      }

    } else if (payloadData.type === 'subscription') {
      // Handle subscription purchase
      const { getPlanByKey } = await import('../../src/services/credit-manager');
      const plan = await getPlanByKey(payloadData.plan_key!);

      if (!plan) {
        await ctx.reply('❌ 구독 플랜 정보를 찾을 수 없습니다.');
        return;
      }

      // Update subscription status
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

      await supabase
        .from('user_credits')
        .update({
          subscription_type: plan.plan_key,
          subscription_status: 'active',
          subscription_start_date: now.toISOString(),
          subscription_end_date: endDate.toISOString(),
          subscription_telegram_id: payment.telegram_payment_charge_id,
          subscription_credits: plan.credits_per_month
        })
        .eq('user_id', userId);

      await ctx.reply(getPaymentSuccessMessage(
        'subscription',
        plan.plan_name_ko,
        plan.credits_per_month
      ));

      console.log(`✅ Subscription activated: ${plan.plan_key} for user ${userId}`);

      // Log transaction
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          transaction_type: 'purchase',
          credit_type: 'paid',
          amount: plan.credits_per_month,
          description: `Subscription: ${plan.plan_name_ko}`,
          payment_provider: 'telegram_stars',
          payment_id: payment.telegram_payment_charge_id,
          package_key: plan.plan_key
        });
    }

  } catch (error) {
    console.error('❌ Error handling successful payment:', error);
    await ctx.reply('❌ 결제 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.');
  }
});

// =============================================================================
// IMAGE EDITING HANDLERS
// Register AFTER payment handlers to allow payment buttons priority
// =============================================================================

// Register image editing handlers
registerImageEditHandlers(bot);

// Register NSFW consent handlers
registerNSFWConsentHandlers(bot);

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
