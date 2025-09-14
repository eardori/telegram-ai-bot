"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const config_1 = require("../../src/config");
const database_1 = require("./utils/database");
const llm_1 = require("./utils/llm");
const telegram_1 = require("./utils/telegram");
const handler = async (event, context) => {
    console.log('Summary scheduler triggered:', {
        method: event.httpMethod,
        path: event.path,
        headers: event.headers,
    });
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
    try {
        const config = (0, config_1.getConfig)();
        if (!config.scheduler.enabled) {
            console.log('Scheduler is disabled');
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Scheduler is disabled' }),
            };
        }
        const requestBody = event.body ? JSON.parse(event.body) : {};
        const summaryType = requestBody.summaryType || 'daily';
        console.log('Processing scheduled summaries:', summaryType);
        const db = (0, database_1.createSupabaseClient)(config.database);
        const dbHelper = new database_1.DatabaseHelper(db);
        const llm = (0, llm_1.createLLMClient)(config.llm);
        const telegram = new telegram_1.TelegramBot(config.telegram);
        const result = await processSummaries(summaryType, {
            config,
            db,
            dbHelper,
            llm,
            telegram,
        });
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                summaryType,
                processed: result.processed,
                errors: result.errors,
                duration: result.duration,
            }),
        };
    }
    catch (error) {
        console.error('Scheduler processing error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};
exports.handler = handler;
async function processSummaries(summaryType, context) {
    const startTime = Date.now();
    const { config, dbHelper, llm, telegram } = context;
    console.log(`Starting ${summaryType} summary processing...`);
    let processed = 0;
    const errors = [];
    try {
        const chats = await getEligibleChats(summaryType, dbHelper);
        console.log(`Found ${chats.length} eligible chats for ${summaryType} summaries`);
        const batchSize = config.scheduler.batchSize || 10;
        const batches = chunkArray(chats, batchSize);
        for (const batch of batches) {
            const batchPromises = batch.map(chat => processChatSummary(chat, summaryType, context)
                .then(() => {
                processed++;
                console.log(`Processed summary for chat ${chat.telegram_id}`);
            })
                .catch(error => {
                const errorMsg = `Failed to process chat ${chat.telegram_id}: ${error.message}`;
                console.error(errorMsg);
                errors.push(errorMsg);
            }));
            await Promise.all(batchPromises);
            if (batches.indexOf(batch) < batches.length - 1) {
                await sleep(2000);
            }
        }
    }
    catch (error) {
        const errorMsg = `Summary processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
    }
    const duration = Date.now() - startTime;
    console.log(`Summary processing completed: ${processed} processed, ${errors.length} errors, ${duration}ms`);
    return { processed, errors, duration };
}
async function getEligibleChats(summaryType, dbHelper) {
    const timeRange = getSummaryTimeRange(summaryType);
    const { data: chats, error } = await dbHelper.client
        .from('chats')
        .select('*')
        .eq('is_active', true)
        .contains('settings->summary_frequency', [summaryType]);
    if (error) {
        console.error('Error getting eligible chats:', error);
        throw error;
    }
    const eligibleChats = [];
    for (const chat of chats || []) {
        const recentSummary = await getRecentSummary(chat.id, summaryType, dbHelper);
        if (!recentSummary || isTimeForNewSummary(recentSummary.created_at, summaryType)) {
            const messageCount = await getMessageCount(chat.id, timeRange.start, timeRange.end, dbHelper);
            if (messageCount >= getMinimumMessages(summaryType)) {
                eligibleChats.push(chat);
            }
        }
    }
    return eligibleChats;
}
async function processChatSummary(chat, summaryType, context) {
    const { dbHelper, llm, telegram } = context;
    console.log(`Processing ${summaryType} summary for chat ${chat.telegram_id}`);
    try {
        const timeRange = getSummaryTimeRange(summaryType);
        const messages = await dbHelper.getMessagesInRange(chat.id, timeRange.start, timeRange.end);
        if (messages.length < getMinimumMessages(summaryType)) {
            console.log(`Not enough messages for chat ${chat.telegram_id}: ${messages.length}`);
            return;
        }
        const summaryRequest = {
            messages: messages.map(msg => ({
                id: msg.id,
                content: msg.content || '[Non-text message]',
                author: {
                    id: msg.user_id || 'unknown',
                    name: msg.users?.first_name || 'Unknown User',
                    username: msg.users?.username,
                },
                timestamp: msg.created_at,
                messageType: msg.message_type,
                mediaInfo: msg.media_info,
            })),
            summaryType,
            preferences: {
                format: chat.settings?.summary_preferences?.format || 'detailed',
                language: 'en',
                includeMedia: chat.settings?.summary_preferences?.include_media || false,
                includeParticipants: chat.type !== 'private',
                includeTimestamps: false,
            },
            context: {
                chatType: chat.type,
                chatTitle: chat.title,
                participantCount: await getParticipantCount(chat.id, dbHelper),
                timeRange,
            },
        };
        const summaryResponse = await llm.generateSummary(summaryRequest);
        await dbHelper.storeSummary({
            chat_id: chat.id,
            summary_type: summaryType,
            content: summaryResponse.summary,
            message_count: messages.length,
            start_time: timeRange.start,
            end_time: timeRange.end,
            metadata: {
                llm_model: context.config.llm.model,
                processing_time_ms: summaryResponse.metadata.processingTimeMs,
                token_count: summaryResponse.metadata.tokenUsage.total_tokens,
                confidence_score: summaryResponse.metadata.confidence,
                key_participants: summaryResponse.metadata.keyParticipants,
                main_topics: summaryResponse.metadata.mainTopics,
                sentiment: summaryResponse.metadata.sentiment,
            },
        });
        if (shouldSendSummaryToChat(chat, summaryType)) {
            await sendSummaryToChat(chat, summaryResponse, summaryType, telegram);
        }
        console.log(`Successfully processed ${summaryType} summary for chat ${chat.telegram_id}`);
    }
    catch (error) {
        console.error(`Error processing summary for chat ${chat.telegram_id}:`, error);
        throw error;
    }
}
function getSummaryTimeRange(summaryType) {
    const now = new Date();
    const end = new Date(now);
    let start;
    switch (summaryType) {
        case 'hourly':
            start = new Date(now.getTime() - 60 * 60 * 1000);
            break;
        case 'daily':
            start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case 'weekly':
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'monthly':
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    return {
        start: start.toISOString(),
        end: end.toISOString(),
    };
}
async function getRecentSummary(chatId, summaryType, dbHelper) {
    const { data, error } = await dbHelper.client
        .from('summaries')
        .select('*')
        .eq('chat_id', chatId)
        .eq('summary_type', summaryType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    if (error && error.code !== 'PGRST116') {
        console.error('Error getting recent summary:', error);
        return null;
    }
    return data;
}
function isTimeForNewSummary(lastSummaryDate, summaryType) {
    const lastSummary = new Date(lastSummaryDate);
    const now = new Date();
    const timeDiff = now.getTime() - lastSummary.getTime();
    switch (summaryType) {
        case 'hourly':
            return timeDiff >= 60 * 60 * 1000;
        case 'daily':
            return timeDiff >= 24 * 60 * 60 * 1000;
        case 'weekly':
            return timeDiff >= 7 * 24 * 60 * 60 * 1000;
        case 'monthly':
            return timeDiff >= 30 * 24 * 60 * 60 * 1000;
        default:
            return timeDiff >= 24 * 60 * 60 * 1000;
    }
}
async function getMessageCount(chatId, startTime, endTime, dbHelper) {
    const { count, error } = await dbHelper.client
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chatId)
        .gte('created_at', startTime)
        .lte('created_at', endTime);
    if (error) {
        console.error('Error getting message count:', error);
        return 0;
    }
    return count || 0;
}
function getMinimumMessages(summaryType) {
    switch (summaryType) {
        case 'hourly':
            return 5;
        case 'daily':
            return 10;
        case 'weekly':
            return 20;
        case 'monthly':
            return 50;
        default:
            return 10;
    }
}
async function getParticipantCount(chatId, dbHelper) {
    const { count, error } = await dbHelper.client
        .from('messages')
        .select('user_id', { count: 'exact', head: true })
        .eq('chat_id', chatId)
        .not('user_id', 'is', null);
    if (error) {
        console.error('Error getting participant count:', error);
        return 1;
    }
    return count || 1;
}
function shouldSendSummaryToChat(chat, summaryType) {
    if (summaryType === 'hourly') {
        return false;
    }
    return chat.settings?.send_summaries !== false;
}
async function sendSummaryToChat(chat, summaryResponse, summaryType, telegram) {
    try {
        const summaryTypeEmoji = {
            hourly: '⏰',
            daily: '📅',
            weekly: '📊',
            monthly: '📈',
            manual: '📋',
            event_based: '🎯',
        };
        const message = `
${summaryTypeEmoji[summaryType]} **${summaryType.toUpperCase()} SUMMARY**

${summaryResponse.summary}

---
📊 **Statistics:**
• Messages: ${summaryResponse.metadata.messageCount}
• Participants: ${summaryResponse.metadata.participantCount}
• Sentiment: ${summaryResponse.metadata.sentiment}

Generated by AI Summary Bot
    `.trim();
        await telegram.sendMessage(chat.telegram_id, message, {
            parse_mode: 'Markdown',
        });
        console.log(`Sent ${summaryType} summary to chat ${chat.telegram_id}`);
    }
    catch (error) {
        console.error(`Failed to send summary to chat ${chat.telegram_id}:`, error);
    }
}
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=summary-scheduler.js.map