/**
 * Tracking Command Handlers
 * Handles all tracking-related commands with Dobby personality
 */

import { Context } from 'grammy';
import { trackingService } from './tracking-service';
import { summarizationService } from './summarization-service';
import {
  TrackingCommand,
  TrackingError,
  TrackingErrorCode,
  MessageType
} from '../types/tracking.types';

// =============================================================================
// COMMAND PARSING AND DETECTION
// =============================================================================

/**
 * Parse Dobby tracking commands from message text
 */
export function parseTrackingCommand(text: string, ctx: Context): TrackingCommand | null {
  const message = ctx.message;
  if (!message || !('from' in message) || !message.from) return null;

  const user = message.from;
  const chat = ctx.chat;

  // Normalize text for parsing
  const normalizedText = text.toLowerCase().trim();

  // Extract user information
  const userInfo = {
    user_id: user.id,
    chat_id: chat.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    message_id: message.message_id
  };

  // Check for tracking start commands
  if (isTrackingStartCommand(normalizedText)) {
    return {
      type: 'start',
      ...userInfo,
      options: {
        auto_summary: true,
        summary_language: 'ko'
      }
    };
  }

  // Check for tracking stop commands
  if (isTrackingStopCommand(normalizedText)) {
    return {
      type: 'stop',
      ...userInfo,
      options: {
        generate_summary: false // Don't auto-generate on stop, user can request manually
      }
    };
  }

  // Check for summarize commands
  if (isSummarizeCommand(normalizedText)) {
    return {
      type: 'summarize',
      ...userInfo,
      options: {
        include_usernames: true,
        include_timestamps: false
      }
    };
  }

  // Check for status commands
  if (isStatusCommand(normalizedText)) {
    return {
      type: 'status',
      ...userInfo
    };
  }

  return null;
}

/**
 * Check if message should be tracked (for middleware)
 */
export function shouldTrackMessage(text: string, ctx: Context): boolean {
  const message = ctx.message;
  if (!message || !('from' in message) || !message.from) return false;

  // Don't track bot commands
  if (text.startsWith('/')) return false;

  // Don't track tracking commands themselves
  if (parseTrackingCommand(text, ctx)) return false;

  // Don't track messages from bots
  if (message.from.is_bot) return false;

  return true;
}

// =============================================================================
// COMMAND DETECTION HELPERS
// =============================================================================

function isTrackingStartCommand(text: string): boolean {
  const startPatterns = [
    /도비야[,\s]*(대화\s*)?추적\s*시작/,
    /도비야[,\s]*(대화\s*)?기록\s*시작/,
    /도비야[,\s]*(대화\s*)?저장\s*시작/,
    /도비야[,\s]*대화\s*추적\s*해줘/,
    /도비야[,\s]*대화\s*기록\s*해줘/,
    /^\/track_start$/
  ];

  return startPatterns.some(pattern => pattern.test(text));
}

function isTrackingStopCommand(text: string): boolean {
  const stopPatterns = [
    /도비야[,\s]*(대화\s*)?추적\s*중단/,
    /도비야[,\s]*(대화\s*)?추적\s*중지/,
    /도비야[,\s]*(대화\s*)?추적\s*그만/,
    /도비야[,\s]*(대화\s*)?기록\s*중단/,
    /도비야[,\s]*(대화\s*)?기록\s*중지/,
    /도비야[,\s]*(대화\s*)?기록\s*그만/,
    /도비야[,\s]*추적\s*끝/,
    /도비야[,\s]*기록\s*끝/,
    /^\/track_stop$/
  ];

  return stopPatterns.some(pattern => pattern.test(text));
}

function isSummarizeCommand(text: string): boolean {
  const summarizePatterns = [
    /도비야[,\s]*요약/,
    /도비야[,\s]*정리/,
    /도비야[,\s]*대화\s*요약/,
    /도비야[,\s]*대화\s*정리/,
    /도비야[,\s]*요약해줘/,
    /도비야[,\s]*정리해줘/,
    /도비야[,\s]*대화\s*요약해줘/,
    /도비야[,\s]*대화\s*정리해줘/,
    /^\/summarize$/
  ];

  return summarizePatterns.some(pattern => pattern.test(text));
}

function isStatusCommand(text: string): boolean {
  const statusPatterns = [
    /도비야[,\s]*상태/,
    /도비야[,\s]*추적\s*상태/,
    /도비야[,\s]*현재\s*상태/,
    /도비야[,\s]*지금\s*추적/,
    /^\/track_status$/
  ];

  return statusPatterns.some(pattern => pattern.test(text));
}

// =============================================================================
// COMMAND HANDLERS
// =============================================================================

/**
 * Handle tracking start command
 */
export async function handleTrackingStart(command: TrackingCommand, ctx: Context): Promise<void> {
  try {
    console.log(`🟢 Handling tracking start for user ${command.user_id} in chat ${command.chat_id}`);

    // Check if already tracking
    const currentStatus = await trackingService.getUserTrackingStatus(command.user_id, command.chat_id);
    
    if (currentStatus.is_tracking) {
      const response = summarizationService.getDobbyTrackingResponse('already_active', {
        message_count: currentStatus.messages_collected,
        duration: currentStatus.duration_minutes
      });
      
      await ctx.reply(response);
      return;
    }

    // Start tracking
    const session = await trackingService.startTracking({
      user_id: command.user_id,
      chat_id: command.chat_id,
      username: command.username,
      first_name: command.first_name,
      last_name: command.last_name,
      auto_summary_enabled: command.options?.auto_summary ?? true,
      summary_language: command.options?.summary_language ?? 'ko'
    });

    // Send success response
    const response = summarizationService.getDobbyTrackingResponse('started', {
      timestamp: new Date().toLocaleString('ko-KR')
    });

    await ctx.reply(response);

    console.log(`✅ Tracking started successfully for session ${session.id}`);

  } catch (error) {
    console.error('❌ Error handling tracking start:', error);
    
    let errorMessage = '알 수 없는 오류가 발생했습니다.';
    
    if (error instanceof TrackingError) {
      switch (error.code) {
        case TrackingErrorCode.SESSION_ALREADY_ACTIVE:
          return; // Already handled above
        case TrackingErrorCode.SESSION_LIMIT_EXCEEDED:
          errorMessage = '추적 세션 한도를 초과했습니다. 기존 추적을 먼저 중단해주세요.';
          break;
        default:
          errorMessage = error.message;
      }
    }

    await ctx.reply(`🧙‍♀️ **도비가 실수했습니다...**

❌ 추적 시작 중 오류: ${errorMessage}

💡 잠시 후 다시 시도해주세요.`);
  }
}

/**
 * Handle tracking stop command
 */
export async function handleTrackingStop(command: TrackingCommand, ctx: Context): Promise<void> {
  try {
    console.log(`🔴 Handling tracking stop for user ${command.user_id} in chat ${command.chat_id}`);

    // Check if currently tracking
    const currentStatus = await trackingService.getUserTrackingStatus(command.user_id, command.chat_id);
    
    if (!currentStatus.is_tracking) {
      const response = summarizationService.getDobbyTrackingResponse('not_active');
      await ctx.reply(response);
      return;
    }

    // Stop tracking
    const session = await trackingService.stopTracking({
      user_id: command.user_id,
      chat_id: command.chat_id,
      generate_summary: command.options?.generate_summary ?? false
    });

    if (!session) {
      await ctx.reply(`🧙‍♀️ **추적을 중단했지만 세션을 찾을 수 없습니다.**

💡 "도비야, 요약해줘"로 기존 데이터를 요약할 수 있습니다.`);
      return;
    }

    // Send success response
    const response = summarizationService.getDobbyTrackingResponse('stopped', {
      message_count: session.total_messages_collected,
      meaningful_count: session.meaningful_messages_collected,
      participant_count: session.unique_participants,
      duration: session.duration_minutes
    });

    await ctx.reply(response);

    console.log(`✅ Tracking stopped successfully for session ${session.id}`);

  } catch (error) {
    console.error('❌ Error handling tracking stop:', error);
    
    let errorMessage = '알 수 없는 오류가 발생했습니다.';
    
    if (error instanceof TrackingError) {
      if (error.code === TrackingErrorCode.SESSION_NOT_FOUND) {
        errorMessage = '추적 중인 세션을 찾을 수 없습니다.';
      } else {
        errorMessage = error.message;
      }
    }

    await ctx.reply(`🧙‍♀️ **도비가 실수했습니다...**

❌ 추적 중단 중 오류: ${errorMessage}

💡 잠시 후 다시 시도해주세요.`);
  }
}

/**
 * Handle summarize command
 */
export async function handleSummarize(command: TrackingCommand, ctx: Context): Promise<void> {
  try {
    console.log(`📝 Handling summarize for user ${command.user_id} in chat ${command.chat_id}`);

    // Check if there's anything to summarize
    const currentStatus = await trackingService.getUserTrackingStatus(command.user_id, command.chat_id);
    
    // Send generating message
    const generatingMessage = summarizationService.getDobbySummaryResponse('generating', {
      message_count: currentStatus.messages_collected || 0,
      participant_count: currentStatus.participants || 1,
      duration: currentStatus.duration_minutes || 0
    });

    const processingMsg = await ctx.reply(generatingMessage);

    // Generate summary
    const result = await summarizationService.generateSummary({
      user_id: command.user_id,
      chat_id: command.chat_id,
      summary_language: 'ko',
      include_usernames: command.options?.include_usernames ?? true,
      include_timestamps: command.options?.include_timestamps ?? false,
      focus_on_decisions: true,
      focus_on_questions: true
    });

    // Delete generating message
    try {
      await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id);
    } catch (e) {
      console.log('Could not delete processing message:', e);
    }

    if (result.success) {
      // Send successful summary
      const response = summarizationService.getDobbySummaryResponse('completed', {
        message_count: result.message_count,
        participant_count: result.participant_count,
        duration: Math.round((result.processing_time_ms || 0) / 1000 / 60),
        summary_text: result.summary_text,
        topic_count: 3 // Could be enhanced to detect actual topics
      });

      await ctx.reply(response);

      console.log(`✅ Summary generated successfully: ${result.summary_id}`);

    } else {
      // Send error response
      const response = summarizationService.getDobbySummaryResponse('failed', {
        error_message: result.error_message
      });

      await ctx.reply(response);
    }

  } catch (error) {
    console.error('❌ Error handling summarize:', error);
    
    let errorResponse = '';
    
    if (error instanceof TrackingError) {
      switch (error.code) {
        case TrackingErrorCode.SESSION_NOT_FOUND:
        case TrackingErrorCode.NO_MESSAGES_TO_SUMMARIZE:
          errorResponse = summarizationService.getDobbySummaryResponse('no_messages');
          break;
        default:
          errorResponse = summarizationService.getDobbySummaryResponse('failed', {
            error_message: error.message
          });
      }
    } else {
      errorResponse = summarizationService.getDobbySummaryResponse('failed', {
        error_message: '요약 생성 중 예상치 못한 오류가 발생했습니다.'
      });
    }

    // Try to delete processing message
    try {
      const processingMsg = ctx.message;
      if (processingMsg) {
        await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id);
      }
    } catch (e) {
      // Ignore deletion errors
    }

    await ctx.reply(errorResponse);
  }
}

/**
 * Handle status command
 */
export async function handleTrackingStatus(command: TrackingCommand, ctx: Context): Promise<void> {
  try {
    console.log(`📊 Handling status check for user ${command.user_id} in chat ${command.chat_id}`);

    const status = await trackingService.getUserTrackingStatus(command.user_id, command.chat_id);

    if (status.is_tracking) {
      const response = `🧙‍♀️ **도비의 추적 상태 보고**

✅ **현재 추적 중입니다!**

📊 **현재 세션 정보:**
• 추적 시작: ${status.started_at ? new Date(status.started_at).toLocaleString('ko-KR') : '알 수 없음'}
• 경과 시간: ${status.duration_minutes || 0}분
• 수집된 메시지: ${status.messages_collected || 0}개
• 의미있는 메시지: ${status.meaningful_messages || 0}개
• 참여자 수: ${status.participants || 1}명

💡 **사용 가능한 명령어:**
• "도비야, 대화 추적 그만해줘" - 추적 중단
• "도비야, 요약해줘" - 지금까지 요약

🏠 도비는 열심히 기록하고 있습니다!`;

      await ctx.reply(response);
    } else {
      const response = `🧙‍♀️ **도비의 추적 상태 보고**

⭕ **현재 추적하지 않고 있습니다**

💡 **시작하려면:**
• "도비야, 대화 추적 시작해줘" - 새로운 추적 시작

🏠 도비는 언제든 명령을 기다리고 있습니다!`;

      await ctx.reply(response);
    }

  } catch (error) {
    console.error('❌ Error handling status check:', error);
    
    await ctx.reply(`🧙‍♀️ **상태 확인 중 오류가 발생했습니다**

❌ ${error instanceof Error ? error.message : '알 수 없는 오류'}

💡 잠시 후 다시 시도해주세요.`);
  }
}

// =============================================================================
// MESSAGE TRACKING MIDDLEWARE
// =============================================================================

/**
 * Middleware to track messages when tracking is active
 */
export async function trackMessageMiddleware(ctx: Context, next: () => Promise<void>): Promise<void> {
  try {
    const message = ctx.message;
    
    // Only process text messages for now
    if (!message || !('text' in message) || !message.text) {
      return next();
    }

    // Skip if this is a command or shouldn't be tracked
    if (!shouldTrackMessage(message.text, ctx)) {
      return next();
    }

    // Extract message information
    const messageData: any = {
      chat_id: ctx.chat.id,
      message_id: message.message_id,
      user_id: message.from.id,
      username: message.from.username,
      user_first_name: message.from.first_name,
      user_last_name: message.from.last_name,
      content: message.text,
      message_type: MessageType.TEXT,
      message_timestamp: new Date(message.date * 1000),
      is_bot_message: message.from.is_bot,
      is_command: message.text.startsWith('/'),
      is_edited: false,
      is_forwarded: !!(message as any).forward_from
    };

    // Add reply context if this is a reply
    if (message.reply_to_message) {
      messageData.reply_to_message_id = message.reply_to_message.message_id;
      if ('text' in message.reply_to_message && message.reply_to_message.text) {
        messageData.reply_to_content = message.reply_to_message.text.substring(0, 200); // Limit length
      }
    }

    // Try to track the message (will only track if someone is actively tracking)
    await trackingService.trackMessage({
      session_id: '', // This will be determined by the service
      ...messageData
    });

  } catch (error) {
    console.error('❌ Error in tracking middleware:', error);
    // Continue processing even if tracking fails
  }

  return next();
}

// =============================================================================
// MAIN COMMAND ROUTER
// =============================================================================

/**
 * Main handler for all tracking commands
 */
export async function handleTrackingCommand(command: TrackingCommand, ctx: Context): Promise<void> {
  switch (command.type) {
    case 'start':
      await handleTrackingStart(command, ctx);
      break;
    case 'stop':
      await handleTrackingStop(command, ctx);
      break;
    case 'summarize':
      await handleSummarize(command, ctx);
      break;
    case 'status':
      await handleTrackingStatus(command, ctx);
      break;
    default:
      console.warn('Unknown tracking command type:', command.type);
  }
}