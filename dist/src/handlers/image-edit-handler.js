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
const nano_banafo_client_1 = require("../services/nano-banafo-client");
const supabase_1 = require("../utils/supabase");
// Session storage (in production, use Redis or database)
const editSessions = new Map();
// Map short IDs to full session IDs for callback data
const sessionIdMap = new Map();
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
        const caption = ctx.message.caption || '';
        const triggerWord = process.env.IMAGE_EDIT_TRIGGER_WORD || '도비야';
        const mediaGroupId = ctx.message.media_group_id;
        // For media groups (multiple photos), check if we should process this message
        if (mediaGroupId) {
            // Check if we already have a session for this media group
            const groupSessionId = `${ctx.from.id}_${ctx.chat?.id || ctx.from.id}_group_${mediaGroupId}`;
            const existingSession = editSessions.get(groupSessionId);
            // If session exists and has trigger word, continue processing
            // If no session exists, check for trigger word in current message
            if (!existingSession && !caption.includes(triggerWord)) {
                return;
            }
        }
        else {
            // Single photo - must have trigger word
            if (!caption.includes(triggerWord)) {
                return;
            }
        }
        const userId = ctx.from.id;
        const chatId = ctx.chat?.id || userId;
        const messageId = ctx.message.message_id;
        const photos = ctx.message.photo;
        // Get largest photo
        const largestPhoto = photos[photos.length - 1];
        // Use userId_chatId for session management (without messageId to avoid session loss)
        const sessionId = `${userId}_${chatId}`;
        // Check for media group (already declared above)
        const groupSessionId = mediaGroupId ? `${userId}_${chatId}_group_${mediaGroupId}` : sessionId;
        let session = editSessions.get(groupSessionId) || editSessions.get(sessionId);
        // Create new session if needed
        if (!session || session.state === 'completed') {
            session = await createEditSession(userId, chatId);
            session.messageId = messageId;
            const finalSessionId = mediaGroupId ? groupSessionId : sessionId;
            editSessions.set(finalSessionId, session);
            // Store the session ID in the session for later reference
            session.sessionId = finalSessionId;
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
        // If this is a media group (multiple photos sent together)
        // Telegram sends them as separate messages with same media_group_id
        if (mediaGroupId) {
            console.log(`📸 Media group detected: ${mediaGroupId}, photos: ${session.images.length}`);
            // Wait a bit for other photos in the group
            setTimeout(async () => {
                // Check if more photos were added to this session
                const currentSessionId = session.sessionId || groupSessionId;
                const updatedSession = editSessions.get(currentSessionId);
                if (updatedSession && updatedSession.state !== 'analyzing' && updatedSession.state !== 'completed') {
                    console.log(`🔍 Starting analysis for ${updatedSession.images.length} photos`);
                    updatedSession.state = 'analyzing';
                    await startImageAnalysis(ctx, updatedSession);
                }
            }, 1500); // Wait 1.5 seconds for other photos in the group
        }
        else {
            // Single photo - analyze immediately
            console.log('📸 Single photo detected, analyzing immediately');
            await startImageAnalysis(ctx, session);
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
        let suggestions = [];
        try {
            suggestions = await suggestionEngine.generateSuggestions(analysis, userHistory, 5);
            console.log(`✅ Generated ${suggestions.length} suggestions`);
        }
        catch (error) {
            console.error('❌ Suggestion generation error:', error);
        }
        // Use default suggestions if none generated
        if (!suggestions || suggestions.length === 0) {
            console.log('⚠️ Using default suggestions');
            suggestions = getDefaultSuggestions(analysis.imageCount);
        }
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
    console.log(`🎨 Showing ${suggestions?.length || 0} suggestions`);
    if (!suggestions || suggestions.length === 0) {
        console.error('❌ No suggestions to show!');
        await ctx.reply('❌ 편집 제안을 생성할 수 없습니다. 다시 시도해주세요.');
        return;
    }
    // Store session ID for callback handling
    const fullSessionId = session.sessionId || `${session.userId}_${session.chatId}`;
    // Create short session ID for callback data (Telegram limit: 64 bytes)
    const shortSessionId = Math.random().toString(36).substr(2, 9);
    sessionIdMap.set(shortSessionId, fullSessionId);
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
        // Add button for each suggestion (use templateId to shorten callback data)
        keyboard.text(`${emoji} ${suggestion.displayName}`, `e:${suggestion.templateId}:${shortSessionId}`);
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
    // Add custom edit option (shortened callback data)
    keyboard.row();
    keyboard.text('✏️ 커스텀 편집', `c:${shortSessionId}`);
    keyboard.text('❌ 취소', `x:${shortSessionId}`);
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
        const [action, ...params] = data.split(':');
        // Resolve short session ID to full session ID
        let sessionId = '';
        if (params.length > 0) {
            const shortId = params[params.length - 1];
            sessionId = sessionIdMap.get(shortId) || shortId;
        }
        switch (action) {
            case 'e': // edit (shortened from 'edit')
                const templateId = parseInt(params[0], 10);
                await handleEditSelectionById(ctx, sessionId, templateId);
                break;
            case 'edit': // legacy support
                await handleEditSelection(ctx, params[1], params[2]);
                break;
            case 'c': // custom (shortened from 'custom')
            case 'custom': // legacy support
                await handleCustomEdit(ctx, sessionId || params[0]);
                break;
            case 'x': // cancel (shortened from 'cancel')
            case 'cancel': // legacy support
                await handleCancelEdit(ctx, sessionId || params[0]);
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
        console.log(`🎯 Handling edit selection: sessionId=${sessionId}, templateKey=${templateKey}`);
        // Try to find session with different possible IDs
        let session = editSessions.get(sessionId);
        if (!session) {
            // Try to find by iterating through all sessions matching user/chat
            const userId = ctx.from?.id;
            const chatId = ctx.chat?.id;
            for (const [key, value] of editSessions.entries()) {
                if (userId && chatId && key.includes(`${userId}_${chatId}`)) {
                    console.log(`🔍 Found session with key: ${key}`);
                    session = value;
                    sessionId = key;
                    break;
                }
            }
        }
        if (!session) {
            console.error(`❌ No session found. Available sessions:`, Array.from(editSessions.keys()));
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
        const processStartTime = Date.now();
        // IMPORTANT: Call Gemini Image Edit API (Nano Banafo)
        // Google Gemini CAN edit images with gemini-2.0-flash-exp model
        try {
            const nanoBanafoClient = new nano_banafo_client_1.NanoBanafoClient();
            // Call the image editing API
            const editedImageBuffer = await nanoBanafoClient.editImage(imageBuffers[0], prompt, template.negativePrompt);
            // Send edited image to Telegram
            const sentMessage = await ctx.replyWithPhoto(new grammy_1.InputFile(editedImageBuffer), {
                caption: `✅ **편집 완료!**\n\n` +
                    `🎨 사용된 템플릿: ${template.templateNameKo}\n` +
                    `⏱️ 처리 시간: ${Math.round((Date.now() - processStartTime) / 1000)}초\n` +
                    `💰 예상 비용: $${template.estimatedCost || 0.002}\n\n` +
                    `📝 ${template.description}`
            });
            // Get the file ID for the edited image
            const photos = sentMessage.photo;
            const fileId = photos[photos.length - 1].file_id;
            const resultUrl = `tg://photo/${fileId}`;
            // Save to database
            await saveEditResult(session, template, prompt, resultUrl);
            // Update the processing message
            await ctx.editMessageText(`✅ **편집 완료!**\n\n` +
                `🎨 사용된 템플릿: ${template.templateNameKo}\n` +
                `⏱️ 처리 시간: ${Math.round((Date.now() - processStartTime) / 1000)}초\n` +
                `💰 예상 비용: $${template.estimatedCost || 0.002}\n\n` +
                `편집된 이미지가 위에 전송되었습니다. ⬆️`);
        }
        catch (error) {
            console.error('Image editing failed:', error);
            // Fallback to mock mode if API fails
            await ctx.editMessageText(`⚠️ **편집 처리 중 문제가 발생했습니다**\n\n` +
                `현재 이미지 편집 서비스가 일시적으로 사용 불가능합니다.\n` +
                `잠시 후 다시 시도해주세요.\n\n` +
                `오류: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
        }
        // Mark session as completed
        session.state = 'completed';
    }
    catch (error) {
        console.error('Edit selection error:', error);
        await ctx.answerCallbackQuery('❌ 편집 중 오류가 발생했습니다.');
    }
}
/**
 * Handle edit selection by template ID
 */
async function handleEditSelectionById(ctx, sessionId, templateId) {
    console.log(`🎨 handleEditSelectionById called: templateId=${templateId}, sessionId=${sessionId}`);
    let session = editSessions.get(sessionId);
    // Try to find session with different variations
    if (!session) {
        // Try to find by iterating through all sessions
        for (const [key, value] of editSessions.entries()) {
            if (key.includes(`${ctx.from?.id}_${ctx.chat?.id}`)) {
                console.log(`🔍 Found session with key: ${key}`);
                session = value;
                sessionId = key;
                break;
            }
        }
    }
    if (!session) {
        console.error(`❌ Session not found for: ${sessionId}`);
        console.log('Available sessions:', Array.from(editSessions.keys()));
        await ctx.answerCallbackQuery('❌ 세션이 만료되었습니다. 사진을 다시 업로드해주세요.');
        return;
    }
    // For default templates (11-15), use hardcoded values
    let template = null;
    // Check if it's a default multi-image template
    if (templateId >= 11 && templateId <= 15) {
        const defaultTemplates = {
            11: {
                id: 11,
                templateKey: 'multi_image_composite',
                templateNameKo: '🎨 이미지 합성',
                templateNameEn: 'Multi Image Composite',
                category: 'multi_image',
                basePrompt: 'Merge these images into a creative composite',
                description: '여러 이미지를 하나로 합성합니다',
                priority: 95,
                isActive: true
            },
            12: {
                id: 12,
                templateKey: 'outfit_swap',
                templateNameKo: '👔 의상 교체',
                templateNameEn: 'Outfit Swap',
                category: 'multi_image',
                basePrompt: 'Swap outfits between the people in these images',
                description: '이미지 간 의상을 교체합니다',
                priority: 90,
                isActive: true
            },
            13: {
                id: 13,
                templateKey: 'background_replace_multi',
                templateNameKo: '🏞️ 배경 통일',
                templateNameEn: 'Background Replace Multi',
                category: 'multi_image',
                basePrompt: 'Replace all backgrounds to match the same scene',
                description: '모든 이미지의 배경을 통일합니다',
                priority: 85,
                isActive: true
            },
            14: {
                id: 14,
                templateKey: 'album_9_photos',
                templateNameKo: '📸 9장 앨범',
                templateNameEn: '9 Photo Album',
                category: 'multi_image',
                basePrompt: 'Create a 9-photo album layout',
                description: '9장의 앨범 형태로 만듭니다',
                priority: 80,
                isActive: true
            },
            15: {
                id: 15,
                templateKey: 'sticker_photo_9',
                templateNameKo: '🎯 스티커 사진',
                templateNameEn: 'Sticker Photo',
                category: 'multi_image',
                basePrompt: 'Create sticker-style photos',
                description: '스티커 사진 형태로 만듭니다',
                priority: 75,
                isActive: true
            }
        };
        const defaultTemplate = defaultTemplates[templateId];
        if (defaultTemplate) {
            template = {
                ...defaultTemplate,
                promptVariables: [],
                requirements: { minImages: 2 },
                usageCount: 0,
                successCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }
    }
    else {
        // Find template by ID from database
        const { data: templates, error } = await supabase_1.supabase
            .from('prompt_templates')
            .select('*')
            .eq('id', templateId)
            .single();
        if (!error && templates) {
            // Map database template to PromptTemplate type
            template = {
                id: templates.id,
                templateKey: templates.template_key,
                templateNameKo: templates.template_name_ko,
                templateNameEn: templates.template_name_en,
                category: templates.category,
                subcategory: templates.subcategory,
                basePrompt: templates.base_prompt,
                examplePrompt: templates.example_prompt,
                negativePrompt: templates.negative_prompt,
                description: templates.description,
                promptVariables: templates.prompt_variables || [],
                requirements: templates.requirements || {},
                priority: templates.priority || 50,
                usageCount: templates.usage_count || 0,
                successCount: templates.success_count || 0,
                successRate: templates.success_rate,
                averageProcessingTimeMs: templates.average_processing_time_ms,
                estimatedCost: templates.estimated_cost,
                isActive: templates.is_active,
                createdAt: new Date(templates.created_at),
                updatedAt: new Date(templates.updated_at)
            };
        }
    }
    if (!template) {
        console.error(`❌ Template not found for ID: ${templateId}`);
        await ctx.answerCallbackQuery('❌ 템플릿을 찾을 수 없습니다.');
        return;
    }
    // Use existing handleEditSelection logic
    console.log(`✅ Using template: ${template.templateNameKo} (${template.templateKey})`);
    await handleEditSelection(ctx, template.templateKey, sessionId);
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
 * Handle /edit command - now only works with reply
 */
async function handleEditCommand(ctx) {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (!userId || !chatId) {
        await ctx.reply('❌ 사용자 정보를 찾을 수 없습니다.');
        return;
    }
    // Check if this is a reply to a message with photo
    if (ctx.message?.reply_to_message?.photo) {
        const replyMsg = ctx.message.reply_to_message;
        const photos = replyMsg.photo;
        const caption = ctx.message.text?.replace('/edit', '').trim() || '';
        // Create new session for this edit
        const session = await createEditSession(userId, chatId);
        const sessionId = `${userId}_${chatId}_edit_${Date.now()}`;
        editSessions.set(sessionId, session);
        // Get largest photo
        const largestPhoto = photos[photos.length - 1];
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
        // Start analysis immediately
        await startImageAnalysis(ctx, session);
    }
    else {
        // No photo to edit - show instructions
        await ctx.reply('📸 **AI 사진 편집**\n\n' +
            '편집하려면 사진에 답장(reply)하면서 /edit 명령어를 사용하세요.\n\n' +
            '**사용 방법:**\n' +
            '1. 편집하고 싶은 사진에 답장\n' +
            '2. /edit 입력\n' +
            '3. 원하는 편집 스타일 선택\n\n' +
            '💡 **팁**: 새 사진을 업로드하면 자동으로 편집 제안을 받을 수 있습니다.');
    }
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
 * Get default suggestions when generation fails
 */
function getDefaultSuggestions(imageCount) {
    const singleImageSuggestions = [
        {
            templateId: 1,
            templateKey: 'figurine_commercial',
            displayName: '🎭 피규어 만들기',
            description: '사진을 고품질 피규어 스타일로 변환합니다',
            confidence: 0.9,
            priority: 95,
            requiredImages: 1,
            estimatedTime: 15,
            estimatedCost: 0.002
        },
        {
            templateId: 2,
            templateKey: 'portrait_styling_redcarpet',
            displayName: '✨ 레드카펫 스타일',
            description: '고급스러운 레드카펫 스타일로 변환합니다',
            confidence: 0.85,
            priority: 90,
            requiredImages: 1,
            estimatedTime: 12,
            estimatedCost: 0.002
        },
        {
            templateId: 3,
            templateKey: 'quality_enhance',
            displayName: '🔧 화질 개선',
            description: '이미지 화질을 향상시킵니다',
            confidence: 0.8,
            priority: 85,
            requiredImages: 1,
            estimatedTime: 10,
            estimatedCost: 0.001
        },
        {
            templateId: 4,
            templateKey: 'vintage_portrait',
            displayName: '📷 빈티지 스타일',
            description: '클래식한 빈티지 분위기로 변환합니다',
            confidence: 0.75,
            priority: 80,
            requiredImages: 1,
            estimatedTime: 10,
            estimatedCost: 0.001
        },
        {
            templateId: 5,
            templateKey: 'black_white_dramatic',
            displayName: '⚫ 드라마틱 흑백',
            description: '감각적인 흑백 사진으로 변환합니다',
            confidence: 0.7,
            priority: 75,
            requiredImages: 1,
            estimatedTime: 8,
            estimatedCost: 0.001
        }
    ];
    const multiImageSuggestions = [
        {
            templateId: 11,
            templateKey: 'multi_image_composite',
            displayName: '🎨 이미지 합성',
            description: '여러 이미지를 하나로 합성합니다',
            confidence: 0.9,
            priority: 95,
            requiredImages: 2,
            estimatedTime: 20,
            estimatedCost: 0.003
        },
        {
            templateId: 12,
            templateKey: 'outfit_swap',
            displayName: '👔 의상 교체',
            description: '이미지 간 의상을 교체합니다',
            confidence: 0.85,
            priority: 90,
            requiredImages: 2,
            estimatedTime: 18,
            estimatedCost: 0.003
        },
        {
            templateId: 13,
            templateKey: 'background_replace',
            displayName: '🏞️ 배경 통일',
            description: '모든 이미지의 배경을 통일합니다',
            confidence: 0.8,
            priority: 85,
            requiredImages: 2,
            estimatedTime: 15,
            estimatedCost: 0.002
        },
        {
            templateId: 14,
            templateKey: 'album_9_photos',
            displayName: '📸 9장 앨범',
            description: '9장의 앨범 형태로 만듭니다',
            confidence: 0.75,
            priority: 80,
            requiredImages: 9,
            estimatedTime: 12,
            estimatedCost: 0.002
        },
        {
            templateId: 15,
            templateKey: 'sticker_photo_9',
            displayName: '🎯 스티커 사진',
            description: '스티커 사진 형태로 만듭니다',
            confidence: 0.7,
            priority: 75,
            requiredImages: 4,
            estimatedTime: 10,
            estimatedCost: 0.002
        }
    ];
    return imageCount === 1 ? singleImageSuggestions : multiImageSuggestions;
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
