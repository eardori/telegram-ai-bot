/**
 * Chat Tracking Service
 * Core functionality for conversation tracking and message collection
 */

import { supabase } from './supabase';
import {
  UserChatTracking,
  TrackingSession,
  TrackedMessage,
  TrackingSessionStatus,
  MessageType,
  StartTrackingRequest,
  StopTrackingRequest,
  TrackMessageRequest,
  TrackingStatusResponse,
  TrackingError,
  TrackingErrorCode,
  MessageAnalysis,
  TrackingConfig
} from '../types/tracking.types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: TrackingConfig = {
  max_session_duration_hours: 24,
  max_messages_per_session: 1000,
  auto_expire_after_days: 7,
  min_message_length: 3,
  exclude_bot_messages: true,
  exclude_commands: true,
  exclude_short_messages: true,
  default_language: 'ko',
  max_summary_length: 2000,
  include_context_by_default: true,
  max_tracking_sessions_per_user: 5,
  max_summaries_per_user_per_day: 10,
  cleanup_expired_sessions_after_days: 30,
  cleanup_old_summaries_after_days: 90
};

// =============================================================================
// CORE TRACKING SERVICE CLASS
// =============================================================================

export class TrackingService {
  private config: TrackingConfig;

  constructor(config?: Partial<TrackingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // USER TRACKING MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Start tracking messages for a user in a specific chat
   */
  async startTracking(request: StartTrackingRequest): Promise<TrackingSession> {
    try {
      console.log(`🟢 Starting tracking for user ${request.user_id} in chat ${request.chat_id}`);

      // Check if user is already tracking in this chat
      const existingTracking = await this.getUserTrackingStatus(request.user_id, request.chat_id);
      if (existingTracking.is_tracking) {
        throw new TrackingError(
          'User is already tracking messages in this chat',
          TrackingErrorCode.SESSION_ALREADY_ACTIVE,
          { session_id: existingTracking.session_id }
        );
      }

      // Check user session limit
      await this.checkUserSessionLimit(request.user_id);

      // Create or update user tracking record
      const userTracking = await this.upsertUserTracking({
        user_id: request.user_id,
        chat_id: request.chat_id,
        is_tracking: true,
        username: request.username,
        first_name: request.first_name,
        last_name: request.last_name,
        auto_summary_enabled: request.auto_summary_enabled ?? true,
        summary_language: request.summary_language ?? this.config.default_language
      });

      // Create new tracking session
      const session = await this.createTrackingSession({
        user_id: request.user_id,
        chat_id: request.chat_id,
        username: request.username,
        first_name: request.first_name,
        last_name: request.last_name
      });

      console.log(`✅ Tracking session created: ${session.id}`);
      return session;

    } catch (error) {
      console.error('❌ Error starting tracking:', error);
      if (error instanceof TrackingError) {
        throw error;
      }
      throw new TrackingError(
        'Failed to start tracking session',
        TrackingErrorCode.DATABASE_ERROR,
        error
      );
    }
  }

  /**
   * Stop tracking messages for a user in a specific chat
   */
  async stopTracking(request: StopTrackingRequest): Promise<TrackingSession | null> {
    try {
      console.log(`🔴 Stopping tracking for user ${request.user_id} in chat ${request.chat_id}`);

      // Get current active session
      const session = await this.getActiveSession(request.user_id, request.chat_id);
      if (!session) {
        throw new TrackingError(
          'No active tracking session found',
          TrackingErrorCode.SESSION_NOT_FOUND
        );
      }

      // Update session status
      const updatedSession = await this.endTrackingSession(session.id);

      // Update user tracking status
      await this.updateUserTrackingStatus(request.user_id, request.chat_id, false);

      console.log(`✅ Tracking session stopped: ${session.id}`);
      return updatedSession;

    } catch (error) {
      console.error('❌ Error stopping tracking:', error);
      if (error instanceof TrackingError) {
        throw error;
      }
      throw new TrackingError(
        'Failed to stop tracking session',
        TrackingErrorCode.DATABASE_ERROR,
        error
      );
    }
  }

  /**
   * Get current tracking status for a user in a chat
   */
  async getUserTrackingStatus(user_id: number, chat_id: number): Promise<TrackingStatusResponse> {
    try {
      const { data: userTracking } = await supabase
        .from('user_chat_tracking')
        .select('*')
        .eq('user_id', user_id)
        .eq('chat_id', chat_id)
        .single();

      if (!userTracking || !userTracking.is_tracking) {
        return { is_tracking: false };
      }

      // Get active session details
      const session = await this.getActiveSession(user_id, chat_id);
      if (!session) {
        // Update status if no active session found
        await this.updateUserTrackingStatus(user_id, chat_id, false);
        return { is_tracking: false };
      }

      const duration = session.started_at 
        ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / (1000 * 60))
        : 0;

      return {
        is_tracking: true,
        session_id: session.id,
        started_at: session.started_at,
        messages_collected: session.total_messages_collected,
        meaningful_messages: session.meaningful_messages_collected,
        participants: session.unique_participants,
        duration_minutes: duration
      };

    } catch (error) {
      console.error('❌ Error getting tracking status:', error);
      return { is_tracking: false };
    }
  }

  // ---------------------------------------------------------------------------
  // MESSAGE TRACKING
  // ---------------------------------------------------------------------------

  /**
   * Track a message if user has active tracking session
   */
  async trackMessage(request: TrackMessageRequest): Promise<TrackedMessage | null> {
    try {
      // Get active session for any user in this chat who might be tracking
      const activeSessions = await this.getActiveSessionsForChat(request.chat_id);
      
      if (activeSessions.length === 0) {
        return null; // No one is tracking in this chat
      }

      const analysis = this.analyzeMessage(request.content, request);
      
      // Only track meaningful messages
      if (!analysis.is_meaningful) {
        return null;
      }

      // Track message for each active session
      const trackedMessages: TrackedMessage[] = [];
      
      for (const session of activeSessions) {
        // Check if session hasn't exceeded limits
        if (session.total_messages_collected >= this.config.max_messages_per_session) {
          await this.expireSession(session.id, 'Message limit exceeded');
          continue;
        }

        // Check if session hasn't expired
        if (this.isSessionExpired(session)) {
          await this.expireSession(session.id, 'Session time limit exceeded');
          continue;
        }

        const trackedMessage = await this.createTrackedMessage({
          ...request,
          tracking_session_id: session.id,
          ...analysis
        });

        if (trackedMessage) {
          trackedMessages.push(trackedMessage);
        }
      }

      return trackedMessages.length > 0 ? trackedMessages[0] : null;

    } catch (error) {
      console.error('❌ Error tracking message:', error);
      return null; // Fail silently for message tracking
    }
  }

  /**
   * Analyze message content to determine if it should be tracked
   */
  private analyzeMessage(content: string, request: TrackMessageRequest): MessageAnalysis {
    const trimmedContent = content.trim();
    const wordCount = trimmedContent.split(/\s+/).length;
    
    // Check if message is meaningful
    let is_meaningful = true;
    
    // Skip if too short
    if (trimmedContent.length < this.config.min_message_length) {
      is_meaningful = false;
    }
    
    // Skip bot messages if configured
    if (this.config.exclude_bot_messages && request.is_bot_message) {
      is_meaningful = false;
    }
    
    // Skip commands if configured
    if (this.config.exclude_commands && (request.is_command || trimmedContent.startsWith('/'))) {
      is_meaningful = false;
    }
    
    // Skip very short messages if configured
    if (this.config.exclude_short_messages && wordCount < 2) {
      is_meaningful = false;
    }
    
    // Skip common short responses
    const shortResponses = ['ㅋㅋ', 'ㅎㅎ', 'ㅠㅠ', 'ok', 'okay', '네', '아니요', '응', '어'];
    if (shortResponses.includes(trimmedContent.toLowerCase())) {
      is_meaningful = false;
    }

    // Detect patterns
    const contains_question = /[?？]/.test(trimmedContent) || 
      /^(뭐|무엇|어떻|어디|언제|왜|누구|어느|어떤)/i.test(trimmedContent);
    
    const contains_url = /https?:\/\/[^\s]+/.test(trimmedContent);
    const contains_media = request.message_type !== MessageType.TEXT;
    const is_bot_command = trimmedContent.startsWith('/') || request.is_command || false;

    return {
      is_meaningful,
      contains_question,
      contains_url,
      contains_media,
      is_bot_command,
      confidence_score: is_meaningful ? 0.8 : 0.2,
      content_length: trimmedContent.length,
      word_count: wordCount
    };
  }

  // ---------------------------------------------------------------------------
  // SESSION MANAGEMENT
  // ---------------------------------------------------------------------------

  private async createTrackingSession(data: {
    user_id: number;
    chat_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): Promise<TrackingSession> {
    const { data: session, error } = await supabase
      .from('tracking_sessions')
      .insert({
        user_id: data.user_id,
        chat_id: data.chat_id,
        started_at: new Date().toISOString(),
        status: TrackingSessionStatus.ACTIVE,
        username: data.username,
        first_name: data.first_name,
        last_name: data.last_name,
        expires_at: new Date(Date.now() + this.config.max_session_duration_hours * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new TrackingError(
        'Failed to create tracking session',
        TrackingErrorCode.DATABASE_ERROR,
        error
      );
    }

    return session;
  }

  private async endTrackingSession(session_id: string): Promise<TrackingSession> {
    const { data: session, error } = await supabase
      .from('tracking_sessions')
      .update({
        status: TrackingSessionStatus.STOPPED,
        ended_at: new Date().toISOString()
      })
      .eq('id', session_id)
      .select()
      .single();

    if (error) {
      throw new TrackingError(
        'Failed to end tracking session',
        TrackingErrorCode.DATABASE_ERROR,
        error
      );
    }

    return session;
  }

  private async getActiveSession(user_id: number, chat_id: number): Promise<TrackingSession | null> {
    const { data: session } = await supabase
      .from('tracking_sessions')
      .select('*')
      .eq('user_id', user_id)
      .eq('chat_id', chat_id)
      .eq('status', TrackingSessionStatus.ACTIVE)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    return session;
  }

  private async getActiveSessionsForChat(chat_id: number): Promise<TrackingSession[]> {
    const { data: sessions } = await supabase
      .from('tracking_sessions')
      .select('*')
      .eq('chat_id', chat_id)
      .eq('status', TrackingSessionStatus.ACTIVE);

    return sessions || [];
  }

  private async createTrackedMessage(data: TrackMessageRequest & MessageAnalysis & { tracking_session_id: string }): Promise<TrackedMessage | null> {
    try {
      const { data: message, error } = await supabase
        .from('tracked_messages')
        .insert({
          tracking_session_id: data.tracking_session_id,
          chat_id: data.chat_id,
          message_id: data.message_id,
          user_id: data.user_id,
          username: data.username,
          user_first_name: data.user_first_name,
          user_last_name: data.user_last_name,
          content: data.content,
          message_type: data.message_type || MessageType.TEXT,
          reply_to_message_id: data.reply_to_message_id,
          reply_to_content: data.reply_to_content,
          message_timestamp: data.message_timestamp.toISOString(),
          is_bot_message: data.is_bot_message || false,
          is_command: data.is_command || false,
          is_edited: data.is_edited || false,
          is_forwarded: data.is_forwarded || false,
          is_meaningful: data.is_meaningful,
          contains_question: data.contains_question,
          contains_url: data.contains_url,
          contains_media: data.contains_media
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating tracked message:', error);
        return null;
      }

      return message;

    } catch (error) {
      console.error('Error creating tracked message:', error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // USER MANAGEMENT
  // ---------------------------------------------------------------------------

  private async upsertUserTracking(data: Partial<UserChatTracking>): Promise<UserChatTracking> {
    const { data: userTracking, error } = await supabase
      .from('user_chat_tracking')
      .upsert({
        user_id: data.user_id!,
        chat_id: data.chat_id!,
        is_tracking: data.is_tracking ?? false,
        username: data.username,
        first_name: data.first_name,
        last_name: data.last_name,
        auto_summary_enabled: data.auto_summary_enabled ?? true,
        summary_language: data.summary_language ?? this.config.default_language,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,chat_id'
      })
      .select()
      .single();

    if (error) {
      throw new TrackingError(
        'Failed to update user tracking status',
        TrackingErrorCode.DATABASE_ERROR,
        error
      );
    }

    return userTracking;
  }

  private async updateUserTrackingStatus(user_id: number, chat_id: number, is_tracking: boolean): Promise<void> {
    const { error } = await supabase
      .from('user_chat_tracking')
      .update({
        is_tracking,
        updated_at: new Date().toISOString(),
        ...(is_tracking ? { tracking_started_at: new Date().toISOString() } : { tracking_stopped_at: new Date().toISOString() })
      })
      .eq('user_id', user_id)
      .eq('chat_id', chat_id);

    if (error) {
      throw new TrackingError(
        'Failed to update user tracking status',
        TrackingErrorCode.DATABASE_ERROR,
        error
      );
    }
  }

  private async checkUserSessionLimit(user_id: number): Promise<void> {
    const { data: activeSessions } = await supabase
      .from('tracking_sessions')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', TrackingSessionStatus.ACTIVE);

    if (activeSessions && activeSessions.length >= this.config.max_tracking_sessions_per_user) {
      throw new TrackingError(
        `User has reached maximum active sessions limit (${this.config.max_tracking_sessions_per_user})`,
        TrackingErrorCode.SESSION_LIMIT_EXCEEDED
      );
    }
  }

  // ---------------------------------------------------------------------------
  // SESSION UTILITIES
  // ---------------------------------------------------------------------------

  private isSessionExpired(session: TrackingSession): boolean {
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    return now > expiresAt;
  }

  private async expireSession(session_id: string, reason: string): Promise<void> {
    console.log(`⏰ Expiring session ${session_id}: ${reason}`);
    
    await supabase
      .from('tracking_sessions')
      .update({
        status: TrackingSessionStatus.EXPIRED,
        ended_at: new Date().toISOString()
      })
      .eq('id', session_id);
  }

  // ---------------------------------------------------------------------------
  // CLEANUP UTILITIES
  // ---------------------------------------------------------------------------

  /**
   * Clean up expired sessions and old data
   */
  async performCleanup(): Promise<{
    expired_sessions: number;
    cleaned_sessions: number;
    cleaned_messages: number;
  }> {
    try {
      console.log('🧹 Starting tracking data cleanup...');

      // Expire old active sessions
      const { data: expiredSessions } = await supabase
        .rpc('expire_old_tracking_sessions');

      // Clean up old data
      const { data: cleanupResult } = await supabase
        .rpc('cleanup_old_tracking_data', {
          days_to_keep: this.config.cleanup_expired_sessions_after_days
        });

      console.log('✅ Cleanup completed:', {
        expired_sessions: expiredSessions || 0,
        cleaned_sessions: cleanupResult?.deleted_sessions || 0,
        cleaned_messages: cleanupResult?.deleted_messages || 0
      });

      return {
        expired_sessions: expiredSessions || 0,
        cleaned_sessions: cleanupResult?.deleted_sessions || 0,
        cleaned_messages: cleanupResult?.deleted_messages || 0
      };

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      return {
        expired_sessions: 0,
        cleaned_sessions: 0,
        cleaned_messages: 0
      };
    }
  }

  // ---------------------------------------------------------------------------
  // QUERY UTILITIES
  // ---------------------------------------------------------------------------

  /**
   * Get messages for a tracking session (for summarization)
   */
  async getSessionMessages(session_id: string, meaningful_only: boolean = true): Promise<TrackedMessage[]> {
    let query = supabase
      .from('tracked_messages')
      .select('*')
      .eq('tracking_session_id', session_id)
      .order('message_timestamp', { ascending: true });

    if (meaningful_only) {
      query = query.eq('is_meaningful', true);
    }

    const { data: messages, error } = await query;

    if (error) {
      throw new TrackingError(
        'Failed to get session messages',
        TrackingErrorCode.DATABASE_ERROR,
        error
      );
    }

    return messages || [];
  }

  /**
   * Get session by ID
   */
  async getSession(session_id: string): Promise<TrackingSession | null> {
    const { data: session } = await supabase
      .from('tracking_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    return session;
  }

  /**
   * Get sessions ready for summary
   */
  async getSessionsReadyForSummary(): Promise<TrackingSession[]> {
    const { data: sessions } = await supabase
      .from('sessions_ready_for_summary')
      .select('*')
      .limit(10);

    return sessions || [];
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const trackingService = new TrackingService();