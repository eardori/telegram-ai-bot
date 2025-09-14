"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const grammy_1 = require("grammy");
// Constants
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const IMAGEN_MODEL = 'imagen-4.0-generate-001';
const ANTHROPIC_VERSION = '2023-06-01';
// Import prompt management utilities
const prompt_manager_1 = require("../../src/utils/prompt-manager");
// Import tracking system
const tracking_commands_1 = require("../../src/utils/tracking-commands");
// Import error handling
const error_handler_1 = require("../../src/utils/error-handler");
const tracking_types_1 = require("../../src/types/tracking.types");
// Import version management
const version_manager_1 = require("../../src/utils/version-manager");
// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
// =============================================================================
// COST CALCULATION FUNCTIONS
// =============================================================================
/**
 * Calculate cost for Claude API usage
 * Pricing: ~$3 per million input tokens, ~$15 per million output tokens
 */
function calculateClaudeCost(inputTokens, outputTokens) {
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
function calculateImagenCost() {
    return 0.020;
}
/**
 * Calculate cost for Gemini Vision API usage
 * Pricing: ~$0.00025 per image analysis
 */
function calculateGeminiVisionCost() {
    return 0.00025;
}
/**
 * Format cost display for users
 */
function formatCost(cost) {
    if (cost < 0.001) {
        return '< $0.001';
    }
    return `$${cost.toFixed(3)}`;
}
// =============================================================================
// ENHANCED FETCH WITH TIMEOUT
// =============================================================================
/**
 * Enhanced fetch with timeout support
 */
async function fetchWithTimeout(url, options, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs}ms`);
        }
        throw error;
    }
}
// Create bot instance
const bot = new grammy_1.Bot(BOT_TOKEN);
// =============================================================================
// DUPLICATE MESSAGE PREVENTION
// =============================================================================
// In-memory cache to prevent duplicate message processing
const processedMessages = new Set();
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
    if (!message)
        return next();
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
bot.use(tracking_commands_1.trackMessageMiddleware);
// Error handling middleware
bot.use(async (ctx, next) => {
    try {
        // Ensure chat group exists in database
        await (0, error_handler_1.ensureChatGroupExists)(ctx);
        await next();
    }
    catch (error) {
        console.error('Bot middleware error:', error);
        (0, error_handler_1.logErrorWithContext)(error, {
            chat_id: ctx.chat?.id,
            user_id: ctx.from?.id,
            message_text: ctx.message && 'text' in ctx.message ? ctx.message.text : null
        });
        if (error instanceof tracking_types_1.TrackingError) {
            await ctx.reply((0, error_handler_1.getUserFriendlyErrorMessage)(error));
        }
        else {
            await ctx.reply(`🧙‍♀️ **도비가 예상치 못한 문제를 만났습니다...**

❌ 일시적인 오류가 발생했습니다.

💡 잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의해주세요.`);
        }
    }
});
// Helper function to generate image with Imagen
async function generateImageWithImagen(userInput, isDobby = false, userId, chatId) {
    const startTime = Date.now();
    try {
        console.log(`🎨 Generating image with Imagen for: "${userInput}"`);
        // Get dynamic prompt from database
        const enhancedPrompt = isDobby
            ? await (0, prompt_manager_1.getDobbyImagePrompt)(userInput)
            : await (0, prompt_manager_1.getImagePrompt)(userInput);
        console.log(`📝 Using enhanced prompt: "${enhancedPrompt}"`);
        // Use reduced timeout to fit within Netlify's 10-second limit
        // Reduce image size for faster generation
        const response = await fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict', {
            method: 'POST',
            headers: {
                'x-goog-api-key': GOOGLE_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                instances: [{ prompt: enhancedPrompt }],
                parameters: {
                    sampleCount: 1,
                    sampleImageSize: '1K', // Imagen 4.0 requires 1K or 2K
                    aspectRatio: '1:1'
                }
            })
        }, 8000 // 8-second timeout to fit within Netlify's 10-second limit
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
        if (data.predictions && data.predictions.length > 0) {
            const prediction = data.predictions[0];
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
    }
    catch (error) {
        console.error('Imagen API error:', error);
        throw error;
    }
}
// Helper function for Claude API with dynamic prompts
async function callClaudeAPI(message, maxTokens = 2000, temperature = 0.7) {
    const startTime = Date.now();
    try {
        // Use enhanced fetch with timeout
        const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
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
        }, 45000 // 45-second timeout for Claude API (increased from 20s due to timeouts)
        );
        const data = await response.json();
        const processingTime = Date.now() - startTime;
        if (response.ok) {
            const responseText = data.content[0]?.text || '응답이 없습니다.';
            // Calculate cost based on token usage
            const usage = data.usage;
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
        }
        else {
            const errorText = await response.text();
            console.error('Claude API Error Response:', errorText);
            throw new Error(data.error?.message || `알 수 없는 오류: ${response.status} ${response.statusText}`);
        }
    }
    catch (error) {
        console.error('Claude API Error:', error);
        throw error;
    }
}
// Helper function for Claude API (Vision) with retry logic
async function callClaudeVisionAPI(prompt, imageData, mediaType, retries = 2) {
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
                return data.content[0]?.text || '이미지 분석에 실패했습니다.';
            }
            else {
                // Try to parse error response
                let errorMessage = `Vision API 오류: ${response.status} ${response.statusText}`;
                let isOverloaded = false;
                try {
                    const errorData = await response.json();
                    console.error('Claude Vision API Error Response:', errorData);
                    errorMessage = errorData.error?.message || errorMessage;
                    // Check if it's an overload error
                    isOverloaded = errorData.error?.type === 'overloaded_error' ||
                        errorMessage.toLowerCase().includes('overloaded');
                }
                catch {
                    // If JSON parsing fails, use default error message
                    console.error('Could not parse error response body');
                }
                // If it's an overload error and we have retries left, throw to retry
                if (isOverloaded && attempt < retries) {
                    console.log('🔄 Claude API is overloaded, will retry...');
                    throw new Error(errorMessage);
                }
                else {
                    // Final error, no more retries
                    throw new Error(errorMessage);
                }
            }
        }
        catch (error) {
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
async function handleError(ctx, error, command, thinkingMessage = null) {
    console.error(`Error in ${command}:`, error);
    const errorMessage = `❌ **'${command}' 작업 중 오류 발생**

**오류 내용:**
${error.message}

💡 잠시 후 다시 시도해 보시거나, 문제가 계속되면 관리자에게 문의해주세요.`;
    try {
        if (thinkingMessage?.message_id) {
            await ctx.api.editMessageText(ctx.chat.id, thinkingMessage.message_id, errorMessage);
        }
        else {
            await ctx.reply(errorMessage);
        }
    }
    catch (replyError) {
        console.error('Failed to send error message to user:', replyError);
    }
}
// Helper function to detect questions
function isQuestion(text) {
    const questionPatterns = [
        /\?$/, // ends with ?
        /^(뭐|무엇|어떻|어디|언제|왜|누구|어느)/, // Korean question words
        /^(what|how|where|when|why|who|which)/i, // English question words
        /(방법|어떻게|알려줘|궁금)/, // asking for help/info
        /(추천|제안|의견)/, // asking for recommendations
    ];
    return questionPatterns.some(pattern => pattern.test(text.trim()));
}
// Helper function to detect Dobby activation
function isDobbyActivated(text) {
    const dobbyPattern = /도비야[,\s]*(.*)/i;
    const match = text.match(dobbyPattern);
    if (!match) {
        return { activated: false, command: null, content: '' };
    }
    const content = match[1].trim();
    // Check for help commands
    if (/(사용법|도움말|사용방법|어떻게|메뉴얼|가이드|명령어)/i.test(content)) {
        return { activated: true, command: 'help', content: content };
    }
    // Check for image generation commands
    if (/(그려줘|그려|그림|이미지|생성)/i.test(content)) {
        // Remove only the final command words, not all occurrences
        const imagePrompt = content
            .replace(/\s*(그림을\s+)?그려줘\s*$/i, '') // Remove "그림을 그려줘" at the end
            .replace(/\s*그려줘\s*$/i, '') // Remove "그려줘" at the end
            .replace(/\s*그려\s*$/i, '') // Remove "그려" at the end
            .replace(/\s*만들어줘\s*$/i, '') // Remove "만들어줘" at the end
            .replace(/\s*생성해줘\s*$/i, '') // Remove "생성해줘" at the end
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
async function answerQuestion(question, isDobby = false, userId, chatId) {
    try {
        console.log(`🤔 Processing question: "${question}"`);
        // Get dynamic prompt from database
        const { prompt, maxTokens, temperature } = await (0, prompt_manager_1.getQAPrompt)(question, isDobby);
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
    }
    catch (error) {
        console.error('Q&A Error:', error);
        throw error;
    }
}
// Helper function to get help message content
async function getHelpMessage() {
    try {
        const versionInfo = await (0, version_manager_1.getVersionInfoForHelp)();
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
    }
    catch (error) {
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
        const versionHistory = await (0, version_manager_1.getFormattedVersionHistory)(5);
        await ctx.reply(`${versionHistory}

💡 **명령어:**
• /version - 최근 5개 버전 보기
• /help - 사용법 보기

🏠 도비가 지속적으로 발전하고 있습니다!`);
    }
    catch (error) {
        console.error('Error fetching version history:', error);
        await ctx.reply(`❌ **버전 정보를 가져오는 중 오류가 발생했습니다**

${error.message}

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
    }
    catch (error) {
        await handleError(ctx, error, 'Claude API 테스트');
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
        await ctx.replyWithPhoto(new grammy_1.InputFile(imageBuffer, `generated_${Date.now()}.png`), {
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
    }
    catch (error) {
        await handleError(ctx, error, '이미지 생성', generatingMessage);
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
    }
    catch (error) {
        await handleError(ctx, error, '질문 답변', thinkingMessage);
    }
});
// Tracking Commands
bot.command('track_start', async (ctx) => {
    console.log('🟢 /track_start command received');
    const command = (0, tracking_commands_1.parseTrackingCommand)('/track_start', ctx);
    if (command) {
        await (0, tracking_commands_1.handleTrackingCommand)(command, ctx);
    }
});
bot.command('track_stop', async (ctx) => {
    console.log('🔴 /track_stop command received');
    const command = (0, tracking_commands_1.parseTrackingCommand)('/track_stop', ctx);
    if (command) {
        await (0, tracking_commands_1.handleTrackingCommand)(command, ctx);
    }
});
bot.command('summarize', async (ctx) => {
    console.log('📝 /summarize command received');
    const command = (0, tracking_commands_1.parseTrackingCommand)('/summarize', ctx);
    if (command) {
        await (0, tracking_commands_1.handleTrackingCommand)(command, ctx);
    }
});
bot.command('track_status', async (ctx) => {
    console.log('📊 /track_status command received');
    const command = (0, tracking_commands_1.parseTrackingCommand)('/track_status', ctx);
    if (command) {
        await (0, tracking_commands_1.handleTrackingCommand)(command, ctx);
    }
});
// Health check and maintenance commands (admin only)
bot.command('health', async (ctx) => {
    console.log('🏥 /health command received');
    try {
        const { performHealthCheck } = await Promise.resolve().then(() => __importStar(require('../../src/utils/error-handler')));
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
    }
    catch (error) {
        console.error('Health check error:', error);
        await ctx.reply(`❌ 상태 점검 중 오류가 발생했습니다: ${error.message}`);
    }
});
bot.command('maintenance', async (ctx) => {
    console.log('🔧 /maintenance command received');
    try {
        const { recoverOrphanedSessions, performConsistencyCheck } = await Promise.resolve().then(() => __importStar(require('../../src/utils/error-handler')));
        const maintenanceMsg = await ctx.reply('🔧 **시스템 유지보수를 시작합니다...**\n\n⏳ 데이터 정리 및 복구 중...');
        // Perform maintenance tasks
        const [recovery, consistency] = await Promise.all([
            recoverOrphanedSessions(),
            performConsistencyCheck()
        ]);
        await ctx.api.editMessageText(ctx.chat.id, maintenanceMsg.message_id, `🔧 **시스템 유지보수 완료**

📊 **세션 복구:**
• 복구됨: ${recovery.recovered}개
• 만료됨: ${recovery.expired}개

🔍 **데이터 일관성 검사:**
• 사용자 추적 상태 수정: ${consistency.fixed_user_tracking}개
• 세션 통계 수정: ${consistency.fixed_session_stats}개
• 정리된 메시지: ${consistency.cleaned_messages}개

✅ 유지보수가 성공적으로 완료되었습니다!

⏰ 완료 시간: ${new Date().toLocaleString('ko-KR')}`);
    }
    catch (error) {
        console.error('Maintenance error:', error);
        await ctx.reply(`❌ 유지보수 중 오류가 발생했습니다: ${error.message}`);
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
            const visionResponse = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GOOGLE_API_KEY}`, {
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
            }, 15000);
            if (!visionResponse.ok) {
                throw new Error(`Gemini Vision API error: ${visionResponse.status}`);
            }
            const visionData = await visionResponse.json();
            const analysis = visionData.candidates?.[0]?.content?.parts?.[0]?.text;
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
        }
        catch (error) {
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
    }
    else {
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
        // Check for Dobby-style editing request or direct editing keywords
        const isDobbyEdit = text.includes('도비야');
        const editingKeywords = /(편집|수정|보정|바꿔|변경|조정|개선|만들어|추가|배경|예쁘게|멋지게|enhance|edit|modify|adjust|add|create|change|background)/i;
        if (isDobbyEdit || editingKeywords.test(text)) {
            console.log('✏️ Image editing request detected!');
            try {
                // Get the largest photo
                const photo = replyToMessage.photo[replyToMessage.photo.length - 1];
                const file = await ctx.api.getFile(photo.file_id);
                if (!file.file_path) {
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
                const imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
                const imageResponse = await fetch(imageUrl);
                const imageArrayBuffer = await imageResponse.arrayBuffer();
                const imageBase64 = Buffer.from(imageArrayBuffer).toString('base64');
                // Analyze image with Gemini Vision - SIMPLIFIED for speed
                const analysisPrompt = `User request: "${editRequest}"

Create a SHORT English prompt (max 30 words) that:
1. Describes main subject
2. Applies the requested change
3. Keep it simple

Output ONLY the prompt.`;
                console.log('🔍 Analyzing image with Gemini Vision...');
                const visionStartTime = Date.now();
                // Call Gemini Vision API with timeout
                const visionResponse = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GOOGLE_API_KEY}`, {
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
                }, 5000 // 5-second timeout for faster response
                );
                if (!visionResponse.ok) {
                    throw new Error(`Gemini Vision API error: ${visionResponse.status}`);
                }
                const visionData = await visionResponse.json();
                const analysis = visionData.candidates?.[0]?.content?.parts?.[0]?.text;
                const visionProcessingTime = Date.now() - visionStartTime;
                const visionCost = calculateGeminiVisionCost();
                if (!analysis) {
                    throw new Error('No analysis received from Gemini Vision');
                }
                console.log(`📝 Image analysis completed in ${visionProcessingTime}ms, generating enhanced version...`);
                console.log('🔍 Gemini Vision Analysis:', analysis.substring(0, 300) + '...');
                // Generate enhanced image with Imagen using Gemini's analysis
                // The analysis from Gemini already contains a detailed prompt
                const enhancedPrompt = analysis;
                // Check remaining time before image generation
                const elapsedTime = Date.now() - visionStartTime;
                if (elapsedTime > 3000) {
                    // If we've already used 3+ seconds, respond with prompt only
                    // Delete processing message first
                    await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id);
                    await ctx.reply(`✅ **이미지 분석 완료!**

📝 **생성된 프롬프트:**
"${enhancedPrompt}"

💡 **이미지 생성하기:**
복사해서 다시 보내주세요:
\`도비야 ${enhancedPrompt} 그려줘\`

⚠️ 시간 제한으로 분석만 완료했습니다.`);
                    console.log('⏱️ Timeout prevention: Returned prompt only');
                    return;
                }
                const imageResult = await generateImageWithImagen(enhancedPrompt, false);
                // Delete processing message
                await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id);
                // Calculate total cost
                const totalCost = visionCost + imageResult.cost;
                // Send enhanced image with appropriate message
                const caption = isDobbyEdit
                    ? `🧙‍♀️ **도비가 마법으로 편집을 완료했습니다!**

✏️ **주인님의 요청**: "${editRequest}"
🪄 **도비의 마법 도구**:
- 👁️ Gemini Vision (이미지 분석): ${formatCost(visionCost)}
- 🎨 Google Imagen 4.0 (이미지 생성): ${formatCost(imageResult.cost)}

💰 **총 비용**: ${formatCost(totalCost)}
⏱️ **처리시간**: 분석 ${visionProcessingTime}ms + 생성 ${imageResult.processingTime}ms

✨ **도비의 편집 결과입니다!**

도비는 주인님이 만족하시길 바랍니다! 🧙‍♀️`
                    : `🎨 **이미지 편집 완료!**

✏️ **편집 요청**: "${editRequest}"
🤖 **AI 처리 완료**:
- 👁️ 분석 (Gemini Vision): ${formatCost(visionCost)}
- 🎨 생성 (Google Imagen 4.0): ${formatCost(imageResult.cost)}

💰 **총 비용**: ${formatCost(totalCost)}
⏱️ **처리시간**: 분석 ${visionProcessingTime}ms + 생성 ${imageResult.processingTime}ms

✨ **편집된 이미지입니다!**`;
                // Fix base64 handling
                const editedImageBuffer = imageResult.imageData.includes('base64,')
                    ? Buffer.from(imageResult.imageData.split('base64,')[1], 'base64')
                    : Buffer.from(imageResult.imageData, 'base64');
                await ctx.replyWithPhoto(new grammy_1.InputFile(editedImageBuffer), {
                    caption: caption
                });
                console.log('✅ Image editing completed successfully!');
            }
            catch (error) {
                console.error('❌ Image editing error:', error);
                await ctx.reply(`❌ **이미지 편집 실패**

오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}

💡 **다시 시도해보세요:**
- 이미지에 reply로 "편집해줘", "보정해줘", "개선해줘" 등으로 요청
- 구체적인 편집 내용을 명시하면 더 좋습니다`);
            }
            return; // Exit after handling image editing
        }
    }
    // Check for Dobby activation and other commands
    console.log(`🔍 DEBUGGING - Checking Dobby activation for: "${text}"`);
    const dobbyCheck = isDobbyActivated(text);
    console.log(`🔍 DEBUGGING - Dobby check result:`, dobbyCheck);
    // Check for tracking commands (Dobby-style commands)
    const trackingCommand = (0, tracking_commands_1.parseTrackingCommand)(text, ctx);
    console.log(`🔍 DEBUGGING - Tracking command result:`, trackingCommand);
    // Handle tracking commands if detected
    if (trackingCommand) {
        console.log(`🎯 Tracking command detected: ${trackingCommand.type}`);
        await (0, tracking_commands_1.handleTrackingCommand)(trackingCommand, ctx);
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
                const successMsg = await (0, prompt_manager_1.getSystemMessage)('dobby_success_image', {
                    user_input: dobbyCheck.content,
                    cost: formatCost(imageResult.cost),
                    processing_time: imageResult.processingTime,
                    timestamp: new Date().toLocaleString('ko-KR')
                });
                // Send image directly from buffer
                await ctx.replyWithPhoto(new grammy_1.InputFile(imageBuffer, `dobby_${Date.now()}.png`), {
                    caption: `${successMsg}

💰 **비용**: ${formatCost(imageResult.cost)}
⏱️ **처리시간**: ${imageResult.processingTime}ms
🎨 **도구**: Google Imagen 4.0`
                });
                // Delete generating message
                await ctx.api.deleteMessage(ctx.chat.id, generatingMessage.message_id);
                console.log('✅ Dobby image generation successful!');
            }
            catch (error) {
                console.error('Dobby image generation error:', error);
                await ctx.api.editMessageText(ctx.chat.id, generatingMessage.message_id, `🧙‍♀️ **도비가 실수했습니다...**

❌ 이미지 생성 중 오류: ${error.message}

😔 도비는 실패를 용서받지 못합니다...
💡 잠시 후 다시 말씀해주시면 더 열심히 하겠습니다!`);
            }
        }
        else if (dobbyCheck.command === 'help') {
            // Handle Dobby help command
            console.log(`❓ Dobby help request: "${dobbyCheck.content}"`);
            try {
                const helpMessage = await getHelpMessage();
                await ctx.reply(`🧙‍♀️ **도비가 사용법을 알려드립니다!**

${helpMessage}

🏠 주인님을 위해 언제든지 도움을 드릴 준비가 되어있습니다!`);
                console.log('✅ Dobby help message sent successfully!');
            }
            catch (error) {
                console.error('Dobby help error:', error);
                await ctx.reply(`🧙‍♀️ **도비가 실수했습니다...**

❌ 도움말을 가져오는 중 오류가 발생했습니다.

💡 /help 명령어를 사용하시거나 잠시 후 다시 시도해주세요!`);
            }
        }
        else if (dobbyCheck.command === 'ask') {
            // Handle Dobby Q&A
            console.log(`🤔 Dobby Q&A: "${dobbyCheck.content}"`);
            // Get dynamic processing message
            const processingMsg = await (0, prompt_manager_1.getSystemMessage)('dobby_processing_qa', {
                question: dobbyCheck.content
            });
            const thinkingMessage = await ctx.reply(processingMsg);
            try {
                const answerResult = await answerQuestion(dobbyCheck.content, true, ctx.from?.id?.toString(), ctx.chat?.id?.toString());
                // Delete thinking message and send answer
                await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
                // Get dynamic success message
                const successMsg = await (0, prompt_manager_1.getSystemMessage)('dobby_success_qa', {
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
            }
            catch (error) {
                console.error('Dobby Q&A error:', error);
                await ctx.api.editMessageText(ctx.chat.id, thinkingMessage.message_id, `🧙‍♀️ **도비가 실수했습니다...**

❌ 답변 중 오류: ${error.message}

😔 도비는 아직 모르는 것이 많습니다...
💡 다른 방식으로 물어봐주시면 더 열심히 하겠습니다!`);
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
const webhookHandler = (0, grammy_1.webhookCallback)(bot, 'std/http');
// Netlify Functions handler
const handler = async (event, _context) => {
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
        const response = await webhookHandler(request);
        console.log('✅ Webhook processed successfully');
        return {
            statusCode: response.status,
            headers: { 'Content-Type': 'application/json' },
            body: await response.text()
        };
    }
    catch (error) {
        console.error('❌ Webhook processing error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error', message: error.message })
        };
    }
};
exports.handler = handler;
