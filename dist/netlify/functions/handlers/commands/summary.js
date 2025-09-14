"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSummaryCommand = setupSummaryCommand;
exports.handleSummaryCallback = handleSummaryCallback;
const rate_limiter_1 = require("../../utils/rate-limiter");
function setupSummaryCommand(bot) {
    bot.command('summary', async (ctx) => {
        const extCtx = ctx;
        try {
            if (!extCtx.config.app.features.summaryEnabled) {
                await ctx.reply('❌ Summary feature is currently disabled.', { reply_to_message_id: ctx.message?.message_id });
                return;
            }
            const args = ctx.message?.text?.split(' ').slice(1) || [];
            const summaryOptions = parseSummaryArgs(args);
            if (!await canUserRequestSummary(extCtx)) {
                await ctx.reply('🚫 You don\'t have permission to request summaries in this chat.', { reply_to_message_id: ctx.message?.message_id });
                return;
            }
            if (ctx.from) {
                const rateLimitMiddleware = (0, rate_limiter_1.createRateLimitMiddleware)();
                const summaryLimitResult = await rateLimitMiddleware.checkSummaryLimit(ctx.from.id);
                if (!summaryLimitResult.allowed) {
                    await ctx.reply(`🚫 ${summaryLimitResult.reason}`, { reply_to_message_id: ctx.message?.message_id });
                    return;
                }
            }
            await ctx.replyWithChatAction('typing');
            const messages = await getMessagesForSummary(extCtx, summaryOptions);
            if (messages.length < 5) {
                await ctx.reply('📭 Not enough messages to generate a meaningful summary.\n' +
                    '<i>Need at least 5 messages. Try having more conversation first!</i>', {
                    parse_mode: 'HTML',
                    reply_to_message_id: ctx.message?.message_id,
                });
                return;
            }
            let progressMessage;
            if (messages.length > 100) {
                progressMessage = await ctx.reply('🔄 Analyzing ' + messages.length + ' messages... This may take a moment.');
            }
            const startTime = Date.now();
            const summaryResult = await generateSummary(extCtx, messages, summaryOptions);
            const processingTime = Date.now() - startTime;
            if (progressMessage) {
                try {
                    await ctx.api.deleteMessage(ctx.chat.id, progressMessage.message_id);
                }
                catch (error) {
                    console.log('Could not delete progress message:', error);
                }
            }
            const formattedSummary = formatSummaryMessage(summaryResult, messages.length, processingTime);
            await ctx.reply(formattedSummary, {
                parse_mode: 'HTML',
                reply_to_message_id: ctx.message?.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '📊 Detailed Stats', callback_data: 'summary:stats' },
                            { text: '🔄 Regenerate', callback_data: 'summary:regenerate' },
                        ],
                        [
                            { text: '📤 Export', callback_data: 'summary:export' },
                            { text: '⚙️ Settings', callback_data: 'settings:summary' },
                        ],
                    ],
                },
            });
            if (extCtx.chat) {
                await storeSummaryInDatabase(extCtx, summaryResult, messages.length, summaryOptions);
            }
            if (extCtx.config.app.features.analyticsEnabled) {
                await trackSummaryRequest(extCtx, messages.length, processingTime);
            }
        }
        catch (error) {
            console.error('Error in /summary command:', error);
            let errorMessage = '❌ Sorry, I encountered an error generating the summary.';
            if (error instanceof Error) {
                if (error.message.includes('rate limit')) {
                    errorMessage = '⏰ You\'re requesting summaries too quickly. Please wait a moment and try again.';
                }
                else if (error.message.includes('insufficient')) {
                    errorMessage = '📭 Not enough suitable messages found for summarization.';
                }
                else if (error.message.includes('LLM')) {
                    errorMessage = '🤖 The AI service is temporarily unavailable. Please try again later.';
                }
            }
            await ctx.reply(errorMessage, {
                reply_to_message_id: ctx.message?.message_id,
            });
        }
    });
}
async function handleSummaryCallback(params, ctx) {
    const action = params[0];
    switch (action) {
        case 'quick':
            await generateQuickSummary(ctx);
            break;
        case 'stats':
            await showDetailedStats(ctx);
            break;
        case 'regenerate':
            await regenerateSummary(ctx);
            break;
        case 'export':
            await exportSummary(ctx);
            break;
        default:
            await ctx.answerCallbackQuery('Unknown action');
    }
}
function parseSummaryArgs(args) {
    const options = {};
    for (const arg of args) {
        if (/^\d+$/.test(arg)) {
            options.messageCount = Math.min(parseInt(arg, 10), 500);
        }
        else if (['today', 'yesterday', 'week', 'month'].includes(arg.toLowerCase())) {
            options.timeRange = arg.toLowerCase();
        }
        else if (['brief', 'detailed', 'bullets'].includes(arg.toLowerCase())) {
            options.format = arg.toLowerCase();
        }
        else if (arg.toLowerCase() === 'media') {
            options.includeMedia = true;
        }
    }
    return options;
}
async function canUserRequestSummary(ctx) {
    try {
        if (ctx.chat?.type === 'private')
            return true;
        const allowedRoles = ctx.chat?.settings?.allowed_summary_roles || ['admin', 'member'];
        const userRole = ctx.user?.role || 'member';
        if (!allowedRoles.includes(userRole)) {
            return false;
        }
        if (ctx.config.app.rateLimiting.enabled) {
            const userId = ctx.from?.id;
            if (userId) {
                return true;
            }
        }
        return true;
    }
    catch (error) {
        console.error('Error checking summary permissions:', error);
        return false;
    }
}
async function getMessagesForSummary(ctx, options) {
    if (!ctx.chat)
        return [];
    const messageCount = options.messageCount || 50;
    try {
        if (options.timeRange) {
            const { startTime, endTime } = getTimeRange(options.timeRange);
            return await ctx.db.getMessagesInRange(ctx.chat.id, startTime, endTime);
        }
        else {
            return await ctx.db.getRecentMessages(ctx.chat.id, messageCount);
        }
    }
    catch (error) {
        console.error('Error fetching messages for summary:', error);
        return [];
    }
}
function getTimeRange(range) {
    const now = new Date();
    const endTime = now.toISOString();
    let startTime;
    switch (range) {
        case 'today':
            startTime = new Date(now);
            startTime.setHours(0, 0, 0, 0);
            break;
        case 'yesterday':
            startTime = new Date(now);
            startTime.setDate(startTime.getDate() - 1);
            startTime.setHours(0, 0, 0, 0);
            break;
        case 'week':
            startTime = new Date(now);
            startTime.setDate(startTime.getDate() - 7);
            break;
        case 'month':
            startTime = new Date(now);
            startTime.setDate(startTime.getDate() - 30);
            break;
        default:
            startTime = new Date(now);
            startTime.setHours(startTime.getHours() - 24);
    }
    return {
        startTime: startTime.toISOString(),
        endTime,
    };
}
async function generateSummary(ctx, messages, options) {
    try {
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            author: {
                id: msg.users?.telegram_id || 'unknown',
                name: msg.users?.first_name || msg.users?.username || 'Unknown User',
                username: msg.users?.username,
            },
            content: msg.content || '[Media or unsupported content]',
            timestamp: msg.created_at,
            type: msg.message_type,
        }));
        const summaryRequest = {
            messages: formattedMessages,
            preferences: {
                format: options.format || 'detailed',
                language: ctx.user?.languageCode || 'en',
                maxLength: getMaxLength(options.format),
                includeParticipants: true,
                includeTimestamp: true,
                focusAreas: options.focusTopics,
                excludeTopics: getExcludeTopics(ctx),
            },
            context: {
                chatType: ctx.chat?.type,
                chatTitle: ctx.chat?.title,
                participantCount: new Set(formattedMessages.map(m => m.author.id)).size,
            },
        };
        const summaryResponse = await ctx.llm.generateSummary(summaryRequest);
        return summaryResponse;
    }
    catch (error) {
        console.error('Error generating summary:', error);
        throw new Error('Failed to generate summary: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}
function getMaxLength(format) {
    switch (format) {
        case 'brief': return 200;
        case 'bullets': return 500;
        case 'detailed': return 1000;
        default: return 500;
    }
}
function getExcludeTopics(ctx) {
    return ctx.chat?.settings?.exclude_topics || [];
}
function formatSummaryMessage(summaryResult, messageCount, processingTime) {
    const { summary, metadata } = summaryResult;
    const header = `📋 <b>Chat Summary</b>\n`;
    const stats = `📊 <i>Analyzed ${messageCount} messages from ${metadata.participantCount} participants</i>\n\n`;
    const content = summary;
    const footer = `\n\n⏱ <i>Generated in ${Math.round(processingTime / 1000)}s</i>`;
    let participants = '';
    if (metadata.keyParticipants && metadata.keyParticipants.length > 0) {
        participants = `\n👥 <b>Key participants:</b> ${metadata.keyParticipants.slice(0, 3).join(', ')}`;
    }
    let topics = '';
    if (metadata.mainTopics && metadata.mainTopics.length > 0) {
        topics = `\n🏷 <b>Main topics:</b> ${metadata.mainTopics.slice(0, 5).join(', ')}`;
    }
    return header + stats + content + participants + topics + footer;
}
async function storeSummaryInDatabase(ctx, summaryResult, messageCount, options) {
    try {
        if (!ctx.chat)
            return;
        const now = new Date().toISOString();
        const timeRange = options.timeRange ? getTimeRange(options.timeRange) : null;
        await ctx.db.storeSummary({
            chat_id: ctx.chat.id,
            summary_type: options.timeRange === 'today' ? 'daily' : 'manual',
            content: summaryResult.summary,
            message_count: messageCount,
            start_time: timeRange?.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end_time: timeRange?.endTime || now,
            metadata: {
                ...summaryResult.metadata,
                requestedBy: ctx.user?.id,
                options,
                processingTime: summaryResult.metadata.processingTimeMs,
            },
        });
    }
    catch (error) {
        console.error('Error storing summary in database:', error);
    }
}
async function trackSummaryRequest(ctx, messageCount, processingTime) {
    try {
        const eventData = {
            event: 'summary_generated',
            userId: ctx.user?.id,
            chatId: ctx.chat?.id,
            messageCount,
            processingTimeMs: processingTime,
            timestamp: new Date().toISOString(),
        };
        console.log('Summary request tracked:', eventData);
    }
    catch (error) {
        console.error('Error tracking summary request:', error);
    }
}
async function generateQuickSummary(ctx) {
    await ctx.answerCallbackQuery('Generating quick summary...');
    try {
        const messages = await ctx.db.getRecentMessages(ctx.chat.id, 20);
        if (messages.length < 5) {
            await ctx.editMessageText('📭 Not enough recent messages for a quick summary.\n' +
                '<i>Need at least 5 messages in recent conversation.</i>', { parse_mode: 'HTML' });
            return;
        }
        const summaryResult = await generateSummary(ctx, messages, { format: 'brief' });
        const formattedSummary = formatSummaryMessage(summaryResult, messages.length, 0);
        await ctx.editMessageText(formattedSummary, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📝 Detailed Summary', callback_data: 'summary:detailed' },
                        { text: '📊 Stats', callback_data: 'summary:stats' },
                    ],
                ],
            },
        });
    }
    catch (error) {
        console.error('Error generating quick summary:', error);
        await ctx.editMessageText('❌ Failed to generate quick summary. Please try again.');
    }
}
async function showDetailedStats(ctx) {
    await ctx.answerCallbackQuery('Loading detailed statistics...');
    const statsMessage = `
📊 <b>Detailed Chat Statistics</b>

<i>Feature coming soon! This will include:</i>
• Message frequency analysis
• User participation metrics
• Topic trend analysis
• Peak activity times
• Word cloud generation

For now, use /stats command for basic statistics.
  `;
    await ctx.editMessageText(statsMessage, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '⬅️ Back to Summary', callback_data: 'summary:back' }],
            ],
        },
    });
}
async function regenerateSummary(ctx) {
    await ctx.answerCallbackQuery('Regenerating summary...');
    await ctx.editMessageText('🔄 Regenerating summary with improved analysis...\n\n' +
        '<i>This feature will re-analyze the same messages with different parameters for better results.</i>', { parse_mode: 'HTML' });
}
async function exportSummary(ctx) {
    await ctx.answerCallbackQuery('Export options coming soon!');
    const exportMessage = `
📤 <b>Export Summary</b>

<i>Export options will include:</i>
• 📄 PDF document
• 📝 Text file
• 🌐 HTML page
• 📊 JSON data
• 📧 Email delivery

This feature is coming soon!
  `;
    await ctx.editMessageText(exportMessage, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '⬅️ Back to Summary', callback_data: 'summary:back' }],
            ],
        },
    });
}
//# sourceMappingURL=summary.js.map