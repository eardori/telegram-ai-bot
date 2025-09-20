"use strict";
/**
 * Telegram Bot Image Edit Handler
 * Handles photo uploads and editing workflow
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerImageEditHandlers = registerImageEditHandlers;
const grammy_1 = require("grammy");
const image_analyzer_1 = require("../services/image-analyzer");
const suggestion_engine_1 = require("../services/suggestion-engine");
const prompt_builder_1 = require("../services/prompt-builder");
const template_matcher_1 = require("../services/template-matcher");
const supabase_1 = require("../utils/supabase");
// Session storage (in production, use Redis or database)
const editSessions = new Map();
// Services
const imageAnalyzer = new image_analyzer_1.ImageAnalyzer();
const suggestionEngine = new suggestion_engine_1.SuggestionEngine();
const promptBuilder = new prompt_builder_1.PromptBuilder();
const templateMatcher = new template_matcher_1.TemplateMatcher();
/**
 * Register image edit handlers
 */
function registerImageEditHandlers(bot) {
    // Handle photo upload
    bot.on('message:photo', handlePhotoUpload);
    // Handle callback queries from inline keyboards
    bot.on('callback_query:data', handleCallbackQuery);
    // Handle /edit command
    bot.command('edit', handleEditCommand);
    // Handle /cancel command
    bot.command('cancel', handleCancelCommand);
}
/**
 * Handle photo upload
 */
async function handlePhotoUpload(ctx) {
    try {
        if (!ctx.message?.photo || !ctx.from) {
            return;
        }
        const userId = ctx.from.id;
        const chatId = ctx.chat?.id || userId;
        const photos = ctx.message.photo;
        const caption = ctx.message.caption || '';
        // Get largest photo
        const largestPhoto = photos[photos.length - 1];
        // Check for existing session
        const sessionId = `${userId}_${chatId}`;
        let session = editSessions.get(sessionId);
        // If no session or session is completed, start new session
        if (!session || session.state === 'completed') {
            session = await createEditSession(userId, chatId);
            editSessions.set(sessionId, session);
        }
        // Add photo to session
        const photoMessage = {
            fileId: largestPhoto.file_id,
            fileSize: largestPhoto.file_size || 0,
            width: largestPhoto.width || 0,
            height: largestPhoto.height || 0,
            caption: caption
        };
        session.images.push(photoMessage);
        session.lastActivityAt = new Date();
        // Check if user wants immediate processing or is collecting multiple images
        const isMultiImageMode = caption.toLowerCase().includes('더') ||
            caption.toLowerCase().includes('more') ||
            caption.toLowerCase().includes('추가');
        if (isMultiImageMode && session.images.length < 5) {
            // Wait for more images
            await ctx.reply(`📸 ${session.images.length}장 받았습니다.\n` +
                `추가로 업로드하거나 "완료"를 입력하여 분석을 시작하세요.\n` +
                `(최대 5장까지 가능)`);
            return;
        }
        // Check for direct edit request in caption
        const hasEditRequest = caption && (caption.includes('편집') ||
            caption.includes('바꿔') ||
            caption.includes('변경') ||
            caption.includes('edit'));
        if (hasEditRequest || session.images.length === 1) {
            // Start analysis immediately
            await startImageAnalysis(ctx, session);
        }
        else {
            // Ask user what to do
            const keyboard = new grammy_1.InlineKeyboard()
                .text('🎨 편집 시작', 'start_edit')
                .text('📸 사진 추가', 'add_more')
                .row()
                .text('❌ 취소', 'cancel_edit');
            await ctx.reply(`📸 ${session.images.length}장의 사진을 받았습니다.\n` +
                `어떻게 하시겠습니까?`, { reply_markup: keyboard });
        }
    }
    catch (error) {
        console.error('Photo upload error:', error);
        await ctx.reply('❌ 사진 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}
/**
 * Start image analysis
 */
async function startImageAnalysis(ctx, session) {
    try {
        session.state = 'analyzing';
        // Send analyzing message
        const analyzeMsg = await ctx.reply('🔍 이미지 분석 중...\n' +
            '⏳ 잠시만 기다려주세요 (약 5-10초)');
        // Download and analyze images
        const imageBuffers = await downloadImages(ctx, session.images);
        let analysis;
        if (imageBuffers.length === 1) {
            analysis = await imageAnalyzer.analyze(imageBuffers[0]);
        }
        else {
            analysis = await imageAnalyzer.analyzeMultiple(imageBuffers);
        }
        // Update analysis with session info
        analysis.userId = session.userId;
        analysis.chatId = session.chatId;
        session.analysis = analysis;
        // Save analysis to database
        await saveAnalysis(analysis);
        // Generate suggestions
        const userHistory = await getUserHistory(session.userId);
        const suggestions = await suggestionEngine.generateSuggestions(analysis, userHistory, 5);
        session.suggestions = suggestions;
        session.state = 'showing_suggestions';
        // Delete analyzing message
        await ctx.api.deleteMessage(ctx.chat.id, analyzeMsg.message_id);
        // Show analysis results and suggestions
        await showSuggestions(ctx, session, analysis, suggestions);
    }
    catch (error) {
        console.error('Image analysis error:', error);
        await ctx.reply('❌ 이미지 분석 중 오류가 발생했습니다.');
        session.state = 'completed';
    }
}
/**
 * Show edit suggestions
 */
async function showSuggestions(ctx, session, analysis, suggestions) {
    // Build analysis summary
    let summary = '📊 **이미지 분석 결과**\n\n';
    if (analysis.faces.count > 0) {
        summary += `👤 인물: ${analysis.faces.count}명 감지 (${analysis.faces.clarity} 품질)\n`;
    }
    if (analysis.scene.type) {
        summary += `🏞️ 장면: ${analysis.scene.type} (${analysis.scene.mood})\n`;
    }
    if (analysis.quality.overallScore) {
        const qualityPercent = Math.round(analysis.quality.overallScore * 100);
        summary += `✨ 품질: ${qualityPercent}%\n`;
    }
    summary += '\n🎨 **추천 편집 옵션**\n\n';
    // Create inline keyboard with suggestions
    const keyboard = new grammy_1.InlineKeyboard();
    suggestions.slice(0, 5).forEach((suggestion, index) => {
        const confidence = Math.round(suggestion.confidence * 100);
        const emoji = getEmojiForTemplate(suggestion.templateKey);
        // Add button for each suggestion
        keyboard.text(`${emoji} ${suggestion.displayName} (${confidence}%)`, `edit:${suggestion.templateKey}:${session.sessionId}`);
        if (index < suggestions.length - 1) {
            keyboard.row();
        }
        // Add to summary
        summary += `${index + 1}. ${emoji} **${suggestion.displayName}**\n`;
        summary += `   ${suggestion.description}\n`;
        if (suggestion.estimatedTime) {
            summary += `   ⏱️ 예상 시간: ${suggestion.estimatedTime}초\n`;
        }
        summary += '\n';
    });
    // Add custom edit option
    keyboard.row();
    keyboard.text('✏️ 커스텀 편집', `custom:${session.sessionId}`);
    keyboard.text('❌ 취소', `cancel:${session.sessionId}`);
    await ctx.reply(summary, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}
/**
 * Handle callback query from inline keyboard
 */
async function handleCallbackQuery(ctx) {
    try {
        if (!ctx.callbackQuery?.data) {
            return;
        }
        const data = ctx.callbackQuery.data;
        const userId = ctx.from?.id;
        if (!userId) {
            await ctx.answerCallbackQuery('❌ 사용자 정보를 찾을 수 없습니다.');
            return;
        }
        // Parse callback data
        const parts = data.split(':');
        const action = parts[0];
        switch (action) {
            case 'edit':
                await handleEditSelection(ctx, parts[1], parts[2]);
                break;
            case 'custom':
                await handleCustomEdit(ctx, parts[1]);
                break;
            case 'cancel':
                await handleCancelEdit(ctx, parts[1]);
                break;
            case 'start_edit':
                await handleStartEdit(ctx);
                break;
            case 'add_more':
                await ctx.answerCallbackQuery('📸 추가 사진을 업로드해주세요.');
                break;
            case 'cancel_edit':
                await handleCancelEdit(ctx, `${userId}_${ctx.chat?.id}`);
                break;
            default:
                await ctx.answerCallbackQuery('❌ 알 수 없는 명령입니다.');
        }
    }
    catch (error) {
        console.error('Callback query error:', error);
        await ctx.answerCallbackQuery('❌ 처리 중 오류가 발생했습니다.');
    }
}
/**
 * Handle edit selection
 */
async function handleEditSelection(ctx, templateKey, sessionId) {
    try {
        const session = editSessions.get(sessionId);
        if (!session) {
            await ctx.answerCallbackQuery('❌ 세션이 만료되었습니다. 다시 시작해주세요.');
            return;
        }
        // Get template
        const template = await templateMatcher.getTemplateByKey(templateKey);
        if (!template) {
            await ctx.answerCallbackQuery('❌ 템플릿을 찾을 수 없습니다.');
            return;
        }
        session.selectedTemplate = template;
        session.state = 'processing';
        // Answer callback
        await ctx.answerCallbackQuery(`✅ ${template.templateNameKo} 선택됨`);
        // Update message
        await ctx.editMessageText(`🎨 **${template.templateNameKo}** 편집을 시작합니다...\n\n` +
            '⏳ 처리 중입니다. 잠시만 기다려주세요...\n' +
            '예상 소요 시간: 10-20초');
        // Build prompt
        const prompt = promptBuilder.build(template);
        // Download images if not already done
        const imageBuffers = await downloadImages(ctx, session.images);
        // TODO: Call Nano Banafo API here
        // For now, simulate processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Simulate result
        const resultUrl = 'https://example.com/edited-image.jpg';
        // Save to database
        await saveEditResult(session, template, prompt, resultUrl);
        // Send result
        await ctx.editMessageText(`✅ **편집 완료!**\n\n` +
            `🎨 사용된 템플릿: ${template.templateNameKo}\n` +
            `⏱️ 처리 시간: 15초\n` +
            `💰 예상 비용: $0.002\n\n` +
            `[편집된 이미지 보기](${resultUrl})`);
        // Mark session as completed
        session.state = 'completed';
        // Ask for feedback
        const feedbackKeyboard = new grammy_1.InlineKeyboard()
            .text('⭐⭐⭐⭐⭐', `rate:5:${sessionId}`)
            .text('⭐⭐⭐⭐', `rate:4:${sessionId}`)
            .row()
            .text('⭐⭐⭐', `rate:3:${sessionId}`)
            .text('⭐⭐', `rate:2:${sessionId}`)
            .text('⭐', `rate:1:${sessionId}`);
        await ctx.reply('만족도를 평가해주세요:', { reply_markup: feedbackKeyboard });
    }
    catch (error) {
        console.error('Edit selection error:', error);
        await ctx.answerCallbackQuery('❌ 편집 중 오류가 발생했습니다.');
    }
}
/**
 * Handle custom edit
 */
async function handleCustomEdit(ctx, sessionId) {
    const session = editSessions.get(sessionId);
    if (!session) {
        await ctx.answerCallbackQuery('❌ 세션이 만료되었습니다.');
        return;
    }
    await ctx.answerCallbackQuery('✏️ 커스텀 편집 모드');
    await ctx.editMessageText('✏️ **커스텀 편집**\n\n' +
        '원하시는 편집 내용을 자세히 설명해주세요.\n' +
        '예시:\n' +
        '- "배경을 파리 에펠탑으로 바꿔주세요"\n' +
        '- "흑백 사진으로 만들어주세요"\n' +
        '- "빈티지 스타일로 편집해주세요"');
    // Set session state to wait for custom input
    session.state = 'awaiting_custom_input';
}
/**
 * Handle cancel edit
 */
async function handleCancelEdit(ctx, sessionId) {
    const session = editSessions.get(sessionId);
    if (session) {
        session.state = 'completed';
        editSessions.delete(sessionId);
    }
    await ctx.answerCallbackQuery('❌ 편집이 취소되었습니다.');
    await ctx.editMessageText('편집이 취소되었습니다.');
}
/**
 * Handle start edit
 */
async function handleStartEdit(ctx) {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (!userId || !chatId) {
        await ctx.answerCallbackQuery('❌ 사용자 정보를 찾을 수 없습니다.');
        return;
    }
    const sessionId = `${userId}_${chatId}`;
    const session = editSessions.get(sessionId);
    if (!session) {
        await ctx.answerCallbackQuery('❌ 세션이 만료되었습니다.');
        return;
    }
    await ctx.answerCallbackQuery('🎨 편집을 시작합니다.');
    await startImageAnalysis(ctx, session);
}
/**
 * Handle /edit command
 */
async function handleEditCommand(ctx) {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (!userId || !chatId) {
        await ctx.reply('❌ 사용자 정보를 찾을 수 없습니다.');
        return;
    }
    // Create new session
    const session = await createEditSession(userId, chatId);
    const sessionId = `${userId}_${chatId}`;
    editSessions.set(sessionId, session);
    await ctx.reply('📸 **AI 사진 편집**\n\n' +
        '편집하실 사진을 업로드해주세요.\n' +
        '최대 5장까지 동시에 편집할 수 있습니다.\n\n' +
        '💡 **팁**:\n' +
        '- 사진과 함께 편집 내용을 설명하면 더 정확한 결과를 얻을 수 있습니다\n' +
        '- 예: "배경을 바꿔주세요" 또는 "빈티지 스타일로"\n' +
        '- 여러 장을 합성하려면 모든 사진을 업로드 후 "완료"를 입력하세요');
}
/**
 * Handle /cancel command
 */
async function handleCancelCommand(ctx) {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (!userId || !chatId) {
        return;
    }
    const sessionId = `${userId}_${chatId}`;
    const session = editSessions.get(sessionId);
    if (session) {
        editSessions.delete(sessionId);
        await ctx.reply('✅ 편집 세션이 취소되었습니다.');
    }
    else {
        await ctx.reply('진행 중인 편집 세션이 없습니다.');
    }
}
/**
 * Create edit session
 */
async function createEditSession(userId, chatId) {
    return {
        sessionId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        chatId,
        state: 'awaiting_images',
        images: [],
        startedAt: new Date(),
        lastActivityAt: new Date()
    };
}
/**
 * Download images from Telegram
 */
async function downloadImages(ctx, photos) {
    const buffers = [];
    for (const photo of photos) {
        try {
            const file = await ctx.api.getFile(photo.fileId);
            if (!file.file_path)
                continue;
            const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            buffers.push(Buffer.from(arrayBuffer));
        }
        catch (error) {
            console.error('Failed to download image:', error);
        }
    }
    return buffers;
}
/**
 * Save analysis to database
 */
async function saveAnalysis(analysis) {
    try {
        const { error } = await supabase_1.supabase
            .from('image_analysis_results')
            .insert({
            id: analysis.id,
            session_id: analysis.sessionId,
            user_id: analysis.userId,
            chat_id: analysis.chatId,
            image_count: analysis.imageCount,
            image_urls: analysis.imageUrls,
            image_sizes: analysis.imageSizes,
            total_size_bytes: analysis.totalSizeBytes,
            analysis_data: {
                faces: analysis.faces,
                objects: analysis.detectedObjects,
                scene: analysis.scene,
                composition: analysis.composition,
                quality: analysis.quality
            },
            face_count: analysis.faces.count,
            detected_objects: analysis.detectedObjects.map(o => o.name),
            scene_description: analysis.scene.description,
            dominant_colors: analysis.dominantColors,
            suggested_categories: analysis.suggestedCategories,
            confidence_scores: analysis.confidenceScores,
            analysis_time_ms: analysis.analysisTimeMs,
            api_calls_made: analysis.apiCallsMade
        });
        if (error) {
            console.error('Failed to save analysis:', error);
        }
    }
    catch (error) {
        console.error('Error saving analysis:', error);
    }
}
/**
 * Save edit result
 */
async function saveEditResult(session, template, prompt, resultUrl) {
    try {
        const { error } = await supabase_1.supabase
            .from('edit_history')
            .insert({
            user_id: session.userId,
            chat_id: session.chatId,
            template_id: template.id,
            final_prompt: prompt,
            original_image_urls: [],
            edited_image_url: resultUrl,
            status: 'completed',
            processing_time_ms: 15000,
            api_service_used: 'nano_banafo'
        });
        if (error) {
            console.error('Failed to save edit result:', error);
        }
    }
    catch (error) {
        console.error('Error saving edit result:', error);
    }
}
/**
 * Get user history
 */
async function getUserHistory(userId) {
    try {
        const { data } = await supabase_1.supabase
            .from('edit_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);
        return data || [];
    }
    catch (error) {
        console.error('Failed to get user history:', error);
        return [];
    }
}
/**
 * Get emoji for template
 */
function getEmojiForTemplate(templateKey) {
    const emojiMap = {
        'figurine_commercial': '🎭',
        'red_carpet': '🌟',
        'night_portrait_paris': '🌃',
        'background_replace': '🏞️',
        'multi_merge': '🎨',
        'quality_enhance': '✨',
        'outfit_swap': '👔',
        'expression_change': '😊',
        'season_change': '🍂',
        'object_remove': '➖',
        'object_add': '➕'
    };
    return emojiMap[templateKey] || '🎨';
}
