// Bot Handlers Index - Main entry point for bot command and middleware setup

import type { Bot, Context } from 'grammy';
import type { BotConfig } from '../../../src/types';
import { createSupabaseClient, DatabaseHelper } from '../utils/database';
import { createLLMClient } from '../utils/llm';
import { createRateLimitMiddleware } from '../utils/rate-limiter';

// Additional properties for extended context
export interface BotContextExtensions {
  config: BotConfig;
  db: DatabaseHelper;
  llm: any;
  user?: {
    id: string;
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
    isActive: boolean;
    role: 'user' | 'moderator' | 'admin' | 'owner';
    preferences: any;
  };
  chat?: {
    id: string;
    telegramId: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    settings: any;
  };
  session?: {
    currentCommand?: string;
    step: number;
    data: Record<string, any>;
  };
  metrics: {
    startTime: number;
    processingTime?: number;
  };
}

// Extended context type combining grammY Context with additional services
export type BotContext = Context & BotContextExtensions;

/**
 * Setup bot middleware
 */
export function setupBotMiddleware(bot: Bot, config: BotConfig): void {
  // Initialize services middleware
  bot.use(async (ctx, next) => {
    // Add start time for metrics
    (ctx as BotContext).metrics = {
      startTime: Date.now(),
    };

    // Initialize database and LLM clients
    const db = new DatabaseHelper(createSupabaseClient(config.database));
    const llm = createLLMClient(config.llm);

    // Extend context with services
    (ctx as BotContext).config = config;
    (ctx as BotContext).db = db;
    (ctx as BotContext).llm = llm;

    await next();

    // Calculate processing time
    (ctx as BotContext).metrics.processingTime = Date.now() - (ctx as BotContext).metrics.startTime;
  });

  // User and chat middleware
  bot.use(async (ctx, next) => {
    const extCtx = ctx as BotContext;
    
    try {
      // Load or create user if available
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
          role: userData.role as any || 'user',
          preferences: userData.preferences || {},
        };
      }

      // Load or create chat if available
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
          type: chatData.type as any,
          title: chatData.title || undefined,
          username: chatData.username || undefined,
          settings: chatData.settings || {},
        };
      }

      await next();
    } catch (error) {
      console.error('Error in user/chat middleware:', error);
      // Continue processing even if user/chat loading fails
      await next();
    }
  });

  // Rate limiting middleware
  bot.use(async (ctx, next) => {
    const extCtx = ctx as BotContext;
    
    if (config.app.rateLimiting.enabled) {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      
      if (userId && chatId) {
        const rateLimitMiddleware = createRateLimitMiddleware();
        
        // Determine if this is a command
        const isCommand = ctx.message?.text?.startsWith('/') || ctx.callbackQuery;
        const command = ctx.message?.text?.split(' ')[0]?.slice(1) || 
                      (ctx.callbackQuery?.data?.split(':')[0]);
        
        // Check multiple rate limits
        const rateLimitResult = await rateLimitMiddleware.checkMultipleLimits(
          userId,
          chatId,
          isCommand ? command : undefined
        );
        
        if (!rateLimitResult.allowed) {
          await ctx.reply(
            `🚫 ${rateLimitResult.reason}`,
            ctx.message ? { reply_to_message_id: ctx.message.message_id } : undefined
          );
          return;
        }
      }
    }
    
    await next();
  });

  // Logging middleware
  bot.use(async (ctx, next) => {
    const extCtx = ctx as BotContext;
    const updateType = getUpdateType(ctx);
    
    console.log(`[${new Date().toISOString()}] Processing ${updateType}:`, {
      updateId: ctx.update.update_id,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      text: 'text' in ctx.update.message! ? ctx.update.message.text?.substring(0, 100) : undefined,
    });

    await next();

    console.log(`[${new Date().toISOString()}] Completed ${updateType}:`, {
      updateId: ctx.update.update_id,
      processingTimeMs: extCtx.metrics.processingTime,
    });
  });

  // Message storage middleware
  bot.on('message', async (ctx, next) => {
    const extCtx = ctx as BotContext;
    
    try {
      // Store message in database
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
    } catch (error) {
      console.error('Error storing message:', error);
      // Don't fail the request if message storage fails
    }

    await next();
  });

  // Edited message handling middleware
  bot.on('edited_message', async (ctx, next) => {
    const extCtx = ctx as BotContext;
    
    try {
      if (extCtx.chat && ctx.editedMessage) {
        await extCtx.db.updateMessage(
          ctx.editedMessage.message_id,
          extCtx.chat.id,
          {
            content: ctx.editedMessage.text || undefined,
            is_edited: true,
            processed_at: new Date().toISOString(),
          },
        );
      }
    } catch (error) {
      console.error('Error updating edited message:', error);
    }

    await next();
  });
}

/**
 * Setup bot commands
 */
export async function setupBotCommands(bot: Bot, config: BotConfig): Promise<void> {
  // Import command handlers dynamically
  const [
    { setupStartCommand },
    { setupHelpCommand },
    { setupSummaryCommand },
    { setupSettingsCommand },
    { setupStatsCommand },
  ] = await Promise.all([
    import('./commands/start'),
    import('./commands/help'),
    import('./commands/summary'),
    import('./commands/settings'),
    import('./commands/stats'),
  ]);

  // Register commands
  setupStartCommand(bot);
  setupHelpCommand(bot);
  setupSummaryCommand(bot);
  setupSettingsCommand(bot);
  setupStatsCommand(bot);

  // Handle unknown commands
  bot.on('message:text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) {
      const command = ctx.message.text.split(' ')[0].slice(1).toLowerCase();
      const knownCommands = ['start', 'help', 'summary', 'settings', 'stats'];
      
      if (!knownCommands.includes(command)) {
        await ctx.reply(
          '❓ Unknown command. Use /help to see available commands.',
          { reply_to_message_id: ctx.message.message_id },
        );
        return;
      }
    }
    
    await next();
  });

  // Handle callback queries
  bot.on('callback_query', async (ctx) => {
    const extCtx = ctx as BotContext;
    
    try {
      await ctx.answerCallbackQuery();
      
      if (ctx.callbackQuery.data) {
        const [action, ...params] = ctx.callbackQuery.data.split(':');
        await handleCallbackQuery(action, params, extCtx);
      }
    } catch (error) {
      console.error('Error handling callback query:', error);
      await ctx.answerCallbackQuery('An error occurred. Please try again.');
    }
  });
}


/**
 * Get update type for logging
 */
function getUpdateType(ctx: Context): string {
  if (ctx.message) return 'message';
  if (ctx.editedMessage) return 'edited_message';
  if (ctx.callbackQuery) return 'callback_query';
  if (ctx.inlineQuery) return 'inline_query';
  if (ctx.channelPost) return 'channel_post';
  if (ctx.editedChannelPost) return 'edited_channel_post';
  return 'unknown';
}

/**
 * Get message type for database storage
 */
function getMessageType(message: any): 'text' | 'photo' | 'video' | 'audio' | 'document' | 'voice' | 'sticker' | 'animation' | 'location' | 'contact' | 'poll' | 'venue' | 'dice' | 'game' | 'other' {
  if (message.text) return 'text';
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.audio) return 'audio';
  if (message.document) return 'document';
  if (message.voice) return 'voice';
  if (message.sticker) return 'sticker';
  if (message.animation) return 'animation';
  if (message.location) return 'location';
  if (message.contact) return 'contact';
  if (message.poll) return 'poll';
  if (message.venue) return 'venue';
  if (message.dice) return 'dice';
  if (message.game) return 'game';
  return 'other';
}

/**
 * Get media info for database storage
 */
function getMediaInfo(message: any): any | null {
  if (message.photo) {
    return {
      type: 'photo',
      sizes: message.photo.map((size: any) => ({
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
  
  // Add more media types as needed
  return null;
}

/**
 * Get forward info for database storage
 */
function getForwardInfo(message: any): any | null {
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

/**
 * Handle callback queries
 */
async function handleCallbackQuery(action: string, params: string[], ctx: BotContext): Promise<void> {
  try {
    switch (action) {
      case 'settings':
        const { handleSettingsCallback } = await import('./commands/settings');
        await handleSettingsCallback(params, ctx);
        break;
        
      case 'summary':
        const { handleSummaryCallback } = await import('./commands/summary');
        await handleSummaryCallback(params, ctx);
        break;
        
      case 'stats':
        const { handleStatsCallback } = await import('./commands/stats');
        await handleStatsCallback(params, ctx);
        break;
        
      case 'help':
        const { handleHelpCallback } = await import('./commands/help');
        await handleHelpCallback(params, ctx);
        break;
        
      default:
        console.log(`Unknown callback action: ${action}`);
        await ctx.reply('Unknown action. Please try again.');
    }
  } catch (error) {
    console.error(`Error handling callback action ${action}:`, error);
    await ctx.reply('An error occurred while processing your request. Please try again.');
  }
}