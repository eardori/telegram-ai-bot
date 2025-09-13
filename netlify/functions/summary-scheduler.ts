// Summary Scheduler for Netlify Functions

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

import type { BotConfig, SummaryType } from '../../src/types';
import { getConfig } from '../../src/config';
import { createSupabaseClient, DatabaseHelper } from './utils/database';
import { createLLMClient } from './utils/llm';
import { TelegramBot } from './utils/telegram';

// Scheduled task handler
export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  console.log('Summary scheduler triggered:', {
    method: event.httpMethod,
    path: event.path,
    headers: event.headers,
  });

  // Only accept POST requests (Netlify scheduled functions use POST)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Load configuration
    const config = getConfig();

    if (!config.scheduler.enabled) {
      console.log('Scheduler is disabled');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Scheduler is disabled' }),
      };
    }

    // Parse request body to determine summary type
    const requestBody = event.body ? JSON.parse(event.body) : {};
    const summaryType: SummaryType = requestBody.summaryType || 'daily';

    console.log('Processing scheduled summaries:', summaryType);

    // Initialize clients
    const db = createSupabaseClient(config.database);
    const dbHelper = new DatabaseHelper(db);
    const llm = createLLMClient(config.llm);
    const telegram = new TelegramBot(config.telegram);

    // Process summaries
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
  } catch (error) {
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

/**
 * Process summaries for all eligible chats
 */
async function processSummaries(
  summaryType: SummaryType,
  context: {
    config: BotConfig;
    db: any;
    dbHelper: DatabaseHelper;
    llm: any;
    telegram: TelegramBot;
  },
) {
  const startTime = Date.now();
  const { config, dbHelper, llm, telegram } = context;

  console.log(`Starting ${summaryType} summary processing...`);

  let processed = 0;
  const errors: string[] = [];

  try {
    // Get eligible chats for summary
    const chats = await getEligibleChats(summaryType, dbHelper);
    console.log(`Found ${chats.length} eligible chats for ${summaryType} summaries`);

    // Process chats in batches to avoid overwhelming the system
    const batchSize = config.scheduler.batchSize || 10;
    const batches = chunkArray(chats, batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(chat => 
        processChatSummary(chat, summaryType, context)
          .then(() => {
            processed++;
            console.log(`Processed summary for chat ${chat.telegram_id}`);
          })
          .catch(error => {
            const errorMsg = `Failed to process chat ${chat.telegram_id}: ${error.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }),
      );

      // Wait for batch to complete
      await Promise.all(batchPromises);

      // Add delay between batches to avoid rate limiting
      if (batches.indexOf(batch) < batches.length - 1) {
        await sleep(2000); // 2 second delay between batches
      }
    }
  } catch (error) {
    const errorMsg = `Summary processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMsg);
    errors.push(errorMsg);
  }

  const duration = Date.now() - startTime;
  console.log(`Summary processing completed: ${processed} processed, ${errors.length} errors, ${duration}ms`);

  return { processed, errors, duration };
}

/**
 * Get chats eligible for summary generation
 */
async function getEligibleChats(summaryType: SummaryType, dbHelper: DatabaseHelper) {
  // Get the time range for this summary type
  const timeRange = getSummaryTimeRange(summaryType);
  
  // Query active chats with summary enabled
  const { data: chats, error } = await dbHelper.client
    .from('chats')
    .select('*')
    .eq('is_active', true)
    .contains('settings->summary_frequency', [summaryType]);

  if (error) {
    console.error('Error getting eligible chats:', error);
    throw error;
  }

  // Filter chats that haven't had a recent summary of this type
  const eligibleChats = [];
  
  for (const chat of chats || []) {
    const recentSummary = await getRecentSummary(chat.id, summaryType, dbHelper);
    
    // Check if enough time has passed since last summary
    if (!recentSummary || isTimeForNewSummary(recentSummary.created_at, summaryType)) {
      // Check if there are enough new messages
      const messageCount = await getMessageCount(
        chat.id,
        timeRange.start,
        timeRange.end,
        dbHelper,
      );
      
      if (messageCount >= getMinimumMessages(summaryType)) {
        eligibleChats.push(chat);
      }
    }
  }

  return eligibleChats;
}

/**
 * Process summary for a single chat
 */
async function processChatSummary(
  chat: any,
  summaryType: SummaryType,
  context: {
    config: BotConfig;
    dbHelper: DatabaseHelper;
    llm: any;
    telegram: TelegramBot;
  },
) {
  const { dbHelper, llm, telegram } = context;
  
  console.log(`Processing ${summaryType} summary for chat ${chat.telegram_id}`);

  try {
    // Get time range for summary
    const timeRange = getSummaryTimeRange(summaryType);
    
    // Get messages for the time range
    const messages = await dbHelper.getMessagesInRange(
      chat.id,
      timeRange.start,
      timeRange.end,
    );

    if (messages.length < getMinimumMessages(summaryType)) {
      console.log(`Not enough messages for chat ${chat.telegram_id}: ${messages.length}`);
      return;
    }

    // Prepare summary request
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
        language: 'en', // TODO: Get from chat settings
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

    // Generate summary using LLM
    const summaryResponse = await llm.generateSummary(summaryRequest);

    // Store summary in database
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

    // Send summary to chat if configured
    if (shouldSendSummaryToChat(chat, summaryType)) {
      await sendSummaryToChat(chat, summaryResponse, summaryType, telegram);
    }

    console.log(`Successfully processed ${summaryType} summary for chat ${chat.telegram_id}`);
  } catch (error) {
    console.error(`Error processing summary for chat ${chat.telegram_id}:`, error);
    throw error;
  }
}

/**
 * Get the time range for a summary type
 */
function getSummaryTimeRange(summaryType: SummaryType) {
  const now = new Date();
  const end = new Date(now);
  let start: Date;

  switch (summaryType) {
    case 'hourly':
      start = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      break;
    case 'daily':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      break;
    case 'weekly':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      break;
    case 'monthly':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      break;
    default:
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24 hours
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Get recent summary for a chat
 */
async function getRecentSummary(chatId: string, summaryType: SummaryType, dbHelper: DatabaseHelper) {
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

/**
 * Check if it's time for a new summary
 */
function isTimeForNewSummary(lastSummaryDate: string, summaryType: SummaryType): boolean {
  const lastSummary = new Date(lastSummaryDate);
  const now = new Date();
  const timeDiff = now.getTime() - lastSummary.getTime();

  switch (summaryType) {
    case 'hourly':
      return timeDiff >= 60 * 60 * 1000; // 1 hour
    case 'daily':
      return timeDiff >= 24 * 60 * 60 * 1000; // 24 hours
    case 'weekly':
      return timeDiff >= 7 * 24 * 60 * 60 * 1000; // 7 days
    case 'monthly':
      return timeDiff >= 30 * 24 * 60 * 60 * 1000; // 30 days
    default:
      return timeDiff >= 24 * 60 * 60 * 1000; // Default to 24 hours
  }
}

/**
 * Get message count for a time range
 */
async function getMessageCount(
  chatId: string,
  startTime: string,
  endTime: string,
  dbHelper: DatabaseHelper,
): Promise<number> {
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

/**
 * Get minimum messages required for summary type
 */
function getMinimumMessages(summaryType: SummaryType): number {
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

/**
 * Get participant count for a chat
 */
async function getParticipantCount(chatId: string, dbHelper: DatabaseHelper): Promise<number> {
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

/**
 * Check if summary should be sent to chat
 */
function shouldSendSummaryToChat(chat: any, summaryType: SummaryType): boolean {
  // Don't send hourly summaries automatically (too frequent)
  if (summaryType === 'hourly') {
    return false;
  }

  // Check chat settings
  return chat.settings?.send_summaries !== false;
}

/**
 * Send summary to chat
 */
async function sendSummaryToChat(
  chat: any,
  summaryResponse: any,
  summaryType: SummaryType,
  telegram: TelegramBot,
) {
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
  } catch (error) {
    console.error(`Failed to send summary to chat ${chat.telegram_id}:`, error);
  }
}

/**
 * Utility function to chunk array into batches
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Utility function to sleep/delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}