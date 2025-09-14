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
exports.setupBotMiddleware = setupBotMiddleware;
exports.setupBotCommands = setupBotCommands;
const database_1 = require("../utils/database");
const llm_1 = require("../utils/llm");
const rate_limiter_1 = require("../utils/rate-limiter");
function setupBotMiddleware(bot, config) {
    bot.use(async (ctx, next) => {
        ctx.metrics = {
            startTime: Date.now(),
        };
        const db = new database_1.DatabaseHelper((0, database_1.createSupabaseClient)(config.database));
        const llm = (0, llm_1.createLLMClient)(config.llm);
        ctx.config = config;
        ctx.db = db;
        ctx.llm = llm;
        await next();
        ctx.metrics.processingTime = Date.now() - ctx.metrics.startTime;
    });
    bot.use(async (ctx, next) => {
        const extCtx = ctx;
        try {
            if (ctx.from) {
                const userData = await extCtx.db.upsertUser({
                    telegram_id: ctx.from.id,
                    username: ctx.from.username,
                    first_name: ctx.from.first_name,
                    last_name: ctx.from.last_name,
                    language_code: ctx.from.language_code,
                });
                extCtx.user = {
                    id: userData.id,
                    telegramId: userData.telegram_id,
                    username: userData.username || undefined,
                    firstName: userData.first_name || undefined,
                    lastName: userData.last_name || undefined,
                    languageCode: userData.language_code || undefined,
                    isActive: userData.is_active,
                    role: userData.role || 'user',
                    preferences: userData.preferences || {},
                };
            }
            if (ctx.chat) {
                const chatData = await extCtx.db.upsertChat({
                    telegram_id: ctx.chat.id,
                    type: ctx.chat.type,
                    title: 'title' in ctx.chat ? ctx.chat.title : undefined,
                    username: 'username' in ctx.chat ? ctx.chat.username : undefined,
                    description: 'description' in ctx.chat ? ctx.chat.description : undefined,
                });
                extCtx.chat = {
                    id: chatData.id,
                    telegramId: chatData.telegram_id,
                    type: chatData.type,
                    title: chatData.title || undefined,
                    username: chatData.username || undefined,
                    settings: chatData.settings || {},
                };
            }
            await next();
        }
        catch (error) {
            console.error('Error in user/chat middleware:', error);
            await next();
        }
    });
    bot.use(async (ctx, next) => {
        const extCtx = ctx;
        if (config.app.rateLimiting.enabled) {
            const userId = ctx.from?.id;
            const chatId = ctx.chat?.id;
            if (userId && chatId) {
                const rateLimitMiddleware = (0, rate_limiter_1.createRateLimitMiddleware)();
                const isCommand = ctx.message?.text?.startsWith('/') || ctx.callbackQuery;
                const command = ctx.message?.text?.split(' ')[0]?.slice(1) ||
                    (ctx.callbackQuery?.data?.split(':')[0]);
                const rateLimitResult = await rateLimitMiddleware.checkMultipleLimits(userId, chatId, isCommand ? command : undefined);
                if (!rateLimitResult.allowed) {
                    await ctx.reply(`🚫 ${rateLimitResult.reason}`, ctx.message ? { reply_to_message_id: ctx.message.message_id } : undefined);
                    return;
                }
            }
        }
        await next();
    });
    bot.use(async (ctx, next) => {
        const extCtx = ctx;
        const updateType = getUpdateType(ctx);
        console.log(`[${new Date().toISOString()}] Processing ${updateType}:`, {
            updateId: ctx.update.update_id,
            userId: ctx.from?.id,
            chatId: ctx.chat?.id,
            text: 'text' in ctx.update.message ? ctx.update.message.text?.substring(0, 100) : undefined,
        });
        await next();
        console.log(`[${new Date().toISOString()}] Completed ${updateType}:`, {
            updateId: ctx.update.update_id,
            processingTimeMs: extCtx.metrics.processingTime,
        });
    });
    bot.on('message', async (ctx, next) => {
        const extCtx = ctx;
        try {
            if (extCtx.chat && ctx.message) {
                await extCtx.db.storeMessage({
                    telegram_message_id: ctx.message.message_id,
                    chat_id: extCtx.chat.id,
                    user_id: extCtx.user?.id,
                    content: ctx.message.text || null,
                    message_type: getMessageType(ctx.message),
                    media_info: getMediaInfo(ctx.message),
                    reply_to_message_id: ctx.message.reply_to_message?.message_id?.toString(),
                    is_edited: false,
                    is_forwarded: !!ctx.message.forward_from || !!ctx.message.forward_from_chat,
                    forward_info: getForwardInfo(ctx.message),
                });
            }
        }
        catch (error) {
            console.error('Error storing message:', error);
        }
        await next();
    });
    bot.on('edited_message', async (ctx, next) => {
        const extCtx = ctx;
        try {
            if (extCtx.chat && ctx.editedMessage) {
                await extCtx.db.updateMessage(ctx.editedMessage.message_id, extCtx.chat.id, {
                    content: ctx.editedMessage.text || undefined,
                    is_edited: true,
                    processed_at: new Date().toISOString(),
                });
            }
        }
        catch (error) {
            console.error('Error updating edited message:', error);
        }
        await next();
    });
}
async function setupBotCommands(bot, config) {
    const [{ setupStartCommand }, { setupHelpCommand }, { setupSummaryCommand }, { setupSettingsCommand }, { setupStatsCommand },] = await Promise.all([
        Promise.resolve().then(() => __importStar(require('./commands/start'))),
        Promise.resolve().then(() => __importStar(require('./commands/help'))),
        Promise.resolve().then(() => __importStar(require('./commands/summary'))),
        Promise.resolve().then(() => __importStar(require('./commands/settings'))),
        Promise.resolve().then(() => __importStar(require('./commands/stats'))),
    ]);
    setupStartCommand(bot);
    setupHelpCommand(bot);
    setupSummaryCommand(bot);
    setupSettingsCommand(bot);
    setupStatsCommand(bot);
    bot.on('message:text', async (ctx, next) => {
        if (ctx.message.text.startsWith('/')) {
            const command = ctx.message.text.split(' ')[0].slice(1).toLowerCase();
            const knownCommands = ['start', 'help', 'summary', 'settings', 'stats'];
            if (!knownCommands.includes(command)) {
                await ctx.reply('❓ Unknown command. Use /help to see available commands.', { reply_to_message_id: ctx.message.message_id });
                return;
            }
        }
        await next();
    });
    bot.on('callback_query', async (ctx) => {
        const extCtx = ctx;
        try {
            await ctx.answerCallbackQuery();
            if (ctx.callbackQuery.data) {
                const [action, ...params] = ctx.callbackQuery.data.split(':');
                await handleCallbackQuery(action, params, extCtx);
            }
        }
        catch (error) {
            console.error('Error handling callback query:', error);
            await ctx.answerCallbackQuery('An error occurred. Please try again.');
        }
    });
}
function getUpdateType(ctx) {
    if (ctx.message)
        return 'message';
    if (ctx.editedMessage)
        return 'edited_message';
    if (ctx.callbackQuery)
        return 'callback_query';
    if (ctx.inlineQuery)
        return 'inline_query';
    if (ctx.channelPost)
        return 'channel_post';
    if (ctx.editedChannelPost)
        return 'edited_channel_post';
    return 'unknown';
}
function getMessageType(message) {
    if (message.text)
        return 'text';
    if (message.photo)
        return 'photo';
    if (message.video)
        return 'video';
    if (message.audio)
        return 'audio';
    if (message.document)
        return 'document';
    if (message.voice)
        return 'voice';
    if (message.sticker)
        return 'sticker';
    if (message.animation)
        return 'animation';
    if (message.location)
        return 'location';
    if (message.contact)
        return 'contact';
    if (message.poll)
        return 'poll';
    if (message.venue)
        return 'venue';
    if (message.dice)
        return 'dice';
    if (message.game)
        return 'game';
    return 'other';
}
function getMediaInfo(message) {
    if (message.photo) {
        return {
            type: 'photo',
            sizes: message.photo.map((size) => ({
                file_id: size.file_id,
                file_unique_id: size.file_unique_id,
                width: size.width,
                height: size.height,
                file_size: size.file_size,
            })),
            caption: message.caption,
        };
    }
    if (message.video) {
        return {
            type: 'video',
            file_id: message.video.file_id,
            file_unique_id: message.video.file_unique_id,
            width: message.video.width,
            height: message.video.height,
            duration: message.video.duration,
            mime_type: message.video.mime_type,
            file_size: message.video.file_size,
            caption: message.caption,
        };
    }
    if (message.document) {
        return {
            type: 'document',
            file_id: message.document.file_id,
            file_unique_id: message.document.file_unique_id,
            file_name: message.document.file_name,
            mime_type: message.document.mime_type,
            file_size: message.document.file_size,
            caption: message.caption,
        };
    }
    return null;
}
function getForwardInfo(message) {
    if (message.forward_from || message.forward_from_chat) {
        return {
            from_user: message.forward_from ? {
                id: message.forward_from.id,
                first_name: message.forward_from.first_name,
                last_name: message.forward_from.last_name,
                username: message.forward_from.username,
            } : null,
            from_chat: message.forward_from_chat ? {
                id: message.forward_from_chat.id,
                type: message.forward_from_chat.type,
                title: message.forward_from_chat.title,
                username: message.forward_from_chat.username,
            } : null,
            date: message.forward_date,
            signature: message.forward_signature,
            sender_name: message.forward_sender_name,
        };
    }
    return null;
}
async function handleCallbackQuery(action, params, ctx) {
    try {
        switch (action) {
            case 'settings':
                const { handleSettingsCallback } = await Promise.resolve().then(() => __importStar(require('./commands/settings')));
                await handleSettingsCallback(params, ctx);
                break;
            case 'summary':
                const { handleSummaryCallback } = await Promise.resolve().then(() => __importStar(require('./commands/summary')));
                await handleSummaryCallback(params, ctx);
                break;
            case 'stats':
                const { handleStatsCallback } = await Promise.resolve().then(() => __importStar(require('./commands/stats')));
                await handleStatsCallback(params, ctx);
                break;
            case 'help':
                const { handleHelpCallback } = await Promise.resolve().then(() => __importStar(require('./commands/help')));
                await handleHelpCallback(params, ctx);
                break;
            default:
                console.log(`Unknown callback action: ${action}`);
                await ctx.reply('Unknown action. Please try again.');
        }
    }
    catch (error) {
        console.error(`Error handling callback action ${action}:`, error);
        await ctx.reply('An error occurred while processing your request. Please try again.');
    }
}
//# sourceMappingURL=index.js.map