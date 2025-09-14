/**
 * Comprehensive Error Handler for Chat Tracking System
 * Handles edge cases, database errors, and system recovery
 */

import { Context } from 'grammy';
import { supabase } from './supabase';
import {
  TrackingError,
  TrackingErrorCode,
  TrackingSessionStatus,
  UserChatTracking
} from '../types/tracking.types';

// =============================================================================
// CHAT GROUP INITIALIZATION
// =============================================================================

/**
 * Ensure chat group exists in database
 */
export async function ensureChatGroupExists(ctx: Context): Promise<boolean> {
  try {
    const chat = ctx.chat;
    if (!chat) return false;

    // Check if chat group already exists
    const { data: existingChat } = await supabase
      .from('chat_groups')
      .select('id')
      .eq('chat_id', chat.id)
      .single();

    if (existingChat) {
      return true;
    }

    // Create new chat group record
    const chatTitle = 'title' in chat ? chat.title || `Chat ${chat.id}` : `Private ${chat.id}`;
    const chatType = chat.type === 'private' ? 'private' : 
                    chat.type === 'supergroup' ? 'supergroup' : 'group';

    const { error } = await supabase
      .from('chat_groups')
      .insert({
        chat_id: chat.id,
        chat_title: chatTitle,
        chat_type: chatType,
        is_active: true,
        member_count: 0 // Will be updated when we get member info
      });

    if (error) {
      console.error('Failed to create chat group:', error);
      return false;
    }

    console.log(`✅ Chat group created: ${chatTitle} (${chat.id})`);
    return true;

  } catch (error) {
    console.error('Error ensuring chat group exists:', error);
    return false;
  }
}

// =============================================================================
// SESSION RECOVERY
// =============================================================================

/**
 * Recover from orphaned tracking sessions
 */
export async function recoverOrphanedSessions(): Promise<{
  recovered: number;
  expired: number;
}> {
  try {
    console.log('🔄 Checking for orphaned tracking sessions...');

    // Find active sessions without corresponding user tracking records
    const { data: orphanedSessions } = await supabase
      .from('tracking_sessions')
      .select(`
        id,
        user_id,
        chat_id,
        started_at
      `)
      .eq('status', TrackingSessionStatus.ACTIVE);

    if (!orphanedSessions || orphanedSessions.length === 0) {
      return { recovered: 0, expired: 0 };
    }

    let recovered = 0;
    let expired = 0;

    for (const session of orphanedSessions) {
      try {
        // Check if corresponding user tracking exists
        const { data: userTracking } = await supabase
          .from('user_chat_tracking')
          .select('is_tracking')
          .eq('user_id', session.user_id)
          .eq('chat_id', session.chat_id)
          .single();

        const sessionAge = Date.now() - new Date(session.started_at).getTime();
        const hoursOld = sessionAge / (1000 * 60 * 60);

        if (!userTracking?.is_tracking || hoursOld > 48) {
          // Expire old or orphaned sessions
          await supabase
            .from('tracking_sessions')
            .update({
              status: TrackingSessionStatus.EXPIRED,
              ended_at: new Date().toISOString()
            })
            .eq('id', session.id);

          // Update user tracking status
          await supabase
            .from('user_chat_tracking')
            .update({ is_tracking: false })
            .eq('user_id', session.user_id)
            .eq('chat_id', session.chat_id);

          expired++;
          console.log(`⏰ Expired orphaned session: ${session.id}`);
        } else {
          recovered++;
          console.log(`✅ Recovered valid session: ${session.id}`);
        }

      } catch (error) {
        console.error(`Error processing session ${session.id}:`, error);
      }
    }

    console.log(`🔄 Session recovery complete: ${recovered} recovered, ${expired} expired`);
    return { recovered, expired };

  } catch (error) {
    console.error('Error in session recovery:', error);
    return { recovered: 0, expired: 0 };
  }
}

// =============================================================================
// DATA CONSISTENCY CHECKS
// =============================================================================

/**
 * Fix data consistency issues
 */
export async function performConsistencyCheck(): Promise<{
  fixed_user_tracking: number;
  fixed_session_stats: number;
  cleaned_messages: number;
}> {
  try {
    console.log('🔍 Performing data consistency check...');

    let fixedUserTracking = 0;
    let fixedSessionStats = 0;
    let cleanedMessages = 0;

    // Fix user tracking status inconsistencies
    const { data: inconsistentUsers } = await supabase
      .from('user_chat_tracking')
      .select(`
        user_id,
        chat_id,
        is_tracking
      `)
      .eq('is_tracking', true);

    if (inconsistentUsers) {
      for (const user of inconsistentUsers) {
        const { data: activeSession } = await supabase
          .from('tracking_sessions')
          .select('id')
          .eq('user_id', user.user_id)
          .eq('chat_id', user.chat_id)
          .eq('status', TrackingSessionStatus.ACTIVE)
          .single();

        if (!activeSession) {
          // User marked as tracking but no active session
          await supabase
            .from('user_chat_tracking')
            .update({ is_tracking: false })
            .eq('user_id', user.user_id)
            .eq('chat_id', user.chat_id);

          fixedUserTracking++;
          console.log(`🔧 Fixed user tracking status: ${user.user_id}/${user.chat_id}`);
        }
      }
    }

    // Fix session statistics
    const { data: sessions } = await supabase
      .from('tracking_sessions')
      .select('id')
      .in('status', [TrackingSessionStatus.ACTIVE, TrackingSessionStatus.STOPPED]);

    if (sessions) {
      for (const session of sessions) {
        const { data: messageStats } = await supabase
          .from('tracked_messages')
          .select('*')
          .eq('tracking_session_id', session.id);

        if (messageStats) {
          const totalMessages = messageStats.length;
          const meaningfulMessages = messageStats.filter(m => m.is_meaningful).length;
          const uniqueParticipants = new Set(messageStats.map(m => m.user_id)).size;

          await supabase
            .from('tracking_sessions')
            .update({
              total_messages_collected: totalMessages,
              meaningful_messages_collected: meaningfulMessages,
              unique_participants: uniqueParticipants
            })
            .eq('id', session.id);

          fixedSessionStats++;
        }
      }
    }

    // Clean up messages from expired sessions
    const { data: expiredSessions } = await supabase
      .from('tracking_sessions')
      .select('id')
      .eq('status', TrackingSessionStatus.EXPIRED);

    const expiredSessionIds = expiredSessions?.map(s => s.id) || [];

    const { data: expiredMessages } = await supabase
      .from('tracked_messages')
      .select('id')
      .in('tracking_session_id', expiredSessionIds);

    if (expiredMessages && expiredMessages.length > 0) {
      const { error } = await supabase
        .from('tracked_messages')
        .delete()
        .in('id', expiredMessages.map(m => m.id));

      if (!error) {
        cleanedMessages = expiredMessages.length;
        console.log(`🗑️ Cleaned ${cleanedMessages} messages from expired sessions`);
      }
    }

    console.log(`✅ Consistency check complete: ${fixedUserTracking} users, ${fixedSessionStats} sessions, ${cleanedMessages} messages`);

    return {
      fixed_user_tracking: fixedUserTracking,
      fixed_session_stats: fixedSessionStats,
      cleaned_messages: cleanedMessages
    };

  } catch (error) {
    console.error('Error in consistency check:', error);
    return {
      fixed_user_tracking: 0,
      fixed_session_stats: 0,
      cleaned_messages: 0
    };
  }
}

// =============================================================================
// ERROR CONTEXT HELPERS
// =============================================================================

/**
 * Get user-friendly error message for tracking errors
 */
export function getUserFriendlyErrorMessage(error: TrackingError, context?: any): string {
  const dobbyPrefix = '🧙‍♀️ **도비가 문제를 해결하려고 합니다...**\n\n';

  switch (error.code) {
    case TrackingErrorCode.SESSION_ALREADY_ACTIVE:
      return `${dobbyPrefix}❌ 이미 추적 중인 세션이 있습니다.\n💡 "도비야, 대화 추적 그만해줘"로 기존 추적을 먼저 중단해주세요.`;

    case TrackingErrorCode.SESSION_NOT_FOUND:
      return `${dobbyPrefix}❌ 추적 중인 세션을 찾을 수 없습니다.\n💡 "도비야, 대화 추적 시작해줘"로 새로운 추적을 시작해주세요.`;

    case TrackingErrorCode.SESSION_EXPIRED:
      return `${dobbyPrefix}⏰ 추적 세션이 만료되었습니다.\n💡 새로운 추적을 시작하려면 "도비야, 대화 추적 시작해줘"라고 해주세요.`;

    case TrackingErrorCode.SESSION_LIMIT_EXCEEDED:
      return `${dobbyPrefix}❌ 동시 추적 세션 한도를 초과했습니다.\n💡 기존 추적을 먼저 중단하거나 요약해주세요.`;

    case TrackingErrorCode.NO_MESSAGES_TO_SUMMARIZE:
      return `${dobbyPrefix}📝 요약할 메시지가 없습니다.\n💡 대화를 추적한 후 요약을 요청해주세요.`;

    case TrackingErrorCode.SUMMARY_GENERATION_FAILED:
      return `${dobbyPrefix}❌ 요약 생성에 실패했습니다.\n💡 잠시 후 다시 시도해주세요.`;

    case TrackingErrorCode.SUMMARY_LIMIT_EXCEEDED:
      return `${dobbyPrefix}❌ 일일 요약 생성 한도를 초과했습니다.\n💡 내일 다시 시도해주세요.`;

    case TrackingErrorCode.DATABASE_ERROR:
      return `${dobbyPrefix}❌ 데이터베이스 오류가 발생했습니다.\n💡 잠시 후 다시 시도해주세요.`;

    case TrackingErrorCode.CLAUDE_API_ERROR:
      return `${dobbyPrefix}❌ AI 서비스 연결에 문제가 있습니다.\n💡 잠시 후 다시 시도해주세요.`;

    case TrackingErrorCode.RATE_LIMIT_ERROR:
      return `${dobbyPrefix}⏱️ 요청이 너무 많습니다.\n💡 잠시 기다린 후 다시 시도해주세요.`;

    case TrackingErrorCode.VALIDATION_ERROR:
      return `${dobbyPrefix}❌ 입력 데이터에 문제가 있습니다.\n💡 명령어를 다시 확인해주세요.`;

    default:
      return `${dobbyPrefix}❌ 알 수 없는 오류: ${error.message}\n💡 문제가 지속되면 관리자에게 문의해주세요.`;
  }
}

/**
 * Log error with context for debugging
 */
export function logErrorWithContext(error: Error, context: any): void {
  const timestamp = new Date().toISOString();
  const contextStr = JSON.stringify(context, null, 2);
  
  console.error(`❌ Error [${timestamp}]:`, {
    name: error.name,
    message: error.message,
    stack: error.stack,
    context: context
  });

  // Log to database for monitoring (if needed)
  try {
    supabase
      .from('bot_activity_log')
      .insert({
        activity_type: 'error',
        activity_description: error.message,
        status: 'error',
        error_code: error.name,
        error_message: error.message,
        request_data: context
      })
      .then(({ error: dbError }) => {
        if (dbError) {
          console.error('Failed to log error to database:', dbError);
        }
      });
  } catch (dbError) {
    console.error('Failed to log error to database:', dbError);
  }
}

// =============================================================================
// GRACEFUL DEGRADATION
// =============================================================================

/**
 * Handle graceful degradation when services are unavailable
 */
export async function handleServiceDegradation(ctx: Context, serviceType: 'database' | 'claude' | 'tracking'): Promise<void> {
  const responses = {
    database: `🧙‍♀️ **도비가 일시적으로 기억을 잃었습니다...**

❌ 데이터베이스 연결에 문제가 있습니다.

💡 **임시 해결책:**
• 잠시 후 다시 시도해주세요
• 기본 AI 기능은 계속 사용 가능합니다

🏠 도비는 빠르게 회복하겠습니다!`,

    claude: `🧙‍♀️ **도비의 마법이 일시적으로 약해졌습니다...**

❌ AI 서비스 연결에 문제가 있습니다.

💡 **사용 가능한 기능:**
• 대화 추적은 계속 진행됩니다
• 이미지 생성은 사용 가능합니다
• 요약은 잠시 후 다시 시도해주세요

🔮 마법의 힘이 곧 돌아올 것입니다!`,

    tracking: `🧙‍♀️ **도비의 기록 시스템에 문제가 생겼습니다...**

❌ 추적 시스템이 일시적으로 불안정합니다.

💡 **사용 가능한 기능:**
• 일반 AI 질문답변
• 이미지 생성
• 기존 추적 데이터는 안전합니다

📝 추적 기능은 곧 복구됩니다!`
  };

  await ctx.reply(responses[serviceType]);
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Comprehensive health check for tracking system
 */
export async function performHealthCheck(): Promise<{
  database: boolean;
  claude_api: boolean;
  tracking_system: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  let database = true;
  let claude_api = true;
  let tracking_system = true;

  try {
    // Test database connection
    const { error: dbError } = await supabase
      .from('chat_groups')
      .select('id')
      .limit(1);

    if (dbError) {
      database = false;
      issues.push(`Database error: ${dbError.message}`);
    }

    // Test Claude API
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }]
        })
      });

      if (!response.ok && response.status !== 400) { // 400 is expected for minimal test
        claude_api = false;
        issues.push(`Claude API error: ${response.status} ${response.statusText}`);
      }
    } catch (apiError) {
      claude_api = false;
      issues.push(`Claude API connection error: ${apiError}`);
    }

    // Test tracking system
    const { data: activeSessions } = await supabase
      .from('tracking_sessions')
      .select('count')
      .eq('status', TrackingSessionStatus.ACTIVE);

    if (!activeSessions) {
      tracking_system = false;
      issues.push('Unable to query tracking sessions');
    }

  } catch (error) {
    issues.push(`Health check error: ${error}`);
  }

  return {
    database,
    claude_api,
    tracking_system,
    issues
  };
}

// =============================================================================
// EXPORT
// =============================================================================

// All functions are already exported individually above
// No need for additional exports