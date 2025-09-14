/**
 * TypeScript Types and Interfaces for Chat Tracking System
 * Telegram Bot - Conversation Tracking and Summarization
 */

// =============================================================================
// CORE TRACKING TYPES
// =============================================================================

export interface UserChatTracking {
  id: string;
  user_id: number;
  chat_id: number;
  is_tracking: boolean;
  tracking_started_at?: Date;
  tracking_stopped_at?: Date;
  username?: string;
  first_name?: string;
  last_name?: string;
  auto_summary_enabled: boolean;
  summary_language: string;
  total_tracking_sessions: number;
  total_messages_tracked: number;
  total_summaries_generated: number;
  created_at: Date;
  updated_at: Date;
}

export interface TrackingSession {
  id: string;
  user_id: number;
  chat_id: number;
  started_at: Date;
  ended_at?: Date;
  duration_minutes?: number;
  total_messages_collected: number;
  meaningful_messages_collected: number;
  unique_participants: number;
  status: TrackingSessionStatus;
  expires_at: Date;
  summary_generated: boolean;
  summary_generated_at?: Date;
  summary_id?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  created_at: Date;
}

export interface TrackedMessage {
  id: string;
  tracking_session_id: string;
  chat_id: number;
  message_id: number;
  user_id: number;
  username?: string;
  user_first_name?: string;
  user_last_name?: string;
  content: string;
  message_type: MessageType;
  reply_to_message_id?: number;
  reply_to_content?: string;
  thread_id?: number;
  message_timestamp: Date;
  tracking_recorded_at: Date;
  is_bot_message: boolean;
  is_command: boolean;
  is_edited: boolean;
  is_forwarded: boolean;
  is_meaningful: boolean;
  contains_question: boolean;
  contains_url: boolean;
  contains_media: boolean;
}

export interface ConversationSummary {
  id: string;
  tracking_session_id: string;
  chat_id: number;
  user_id: number;
  summary_text: string;
  summary_language: string;
  summary_type: SummaryType;
  participant_count: number;
  message_count: number;
  meaningful_message_count: number;
  conversation_start_time: Date;
  conversation_end_time: Date;
  conversation_duration_minutes: number;
  ai_model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  processing_time_ms?: number;
  generation_cost_usd?: number;
  confidence_score?: number;
  summary_length_chars: number;
  key_topics_count: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  include_usernames: boolean;
  include_timestamps: boolean;
  focus_on_decisions: boolean;
  focus_on_questions: boolean;
  status: SummaryStatus;
  error_message?: string;
  delivered_to_user: boolean;
  delivery_timestamp?: Date;
  created_at: Date;
}

// =============================================================================
// ENUMS AND CONSTANTS
// =============================================================================

export enum TrackingSessionStatus {
  ACTIVE = 'active',
  STOPPED = 'stopped',
  SUMMARIZED = 'summarized',
  EXPIRED = 'expired'
}

export enum SummaryType {
  MANUAL = 'manual',
  AUTO = 'auto',
  SCHEDULED = 'scheduled'
}

export enum SummaryStatus {
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum MessageType {
  TEXT = 'text',
  PHOTO = 'photo',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  VOICE = 'voice',
  STICKER = 'sticker',
  ANIMATION = 'animation',
  LOCATION = 'location',
  CONTACT = 'contact',
  POLL = 'poll'
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

export interface StartTrackingRequest {
  user_id: number;
  chat_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  auto_summary_enabled?: boolean;
  summary_language?: string;
}

export interface StopTrackingRequest {
  user_id: number;
  chat_id: number;
  generate_summary?: boolean;
}

export interface TrackMessageRequest {
  session_id: string;
  chat_id: number;
  message_id: number;
  user_id: number;
  username?: string;
  user_first_name?: string;
  user_last_name?: string;
  content: string;
  message_type?: MessageType;
  reply_to_message_id?: number;
  reply_to_content?: string;
  message_timestamp: Date;
  is_bot_message?: boolean;
  is_command?: boolean;
  is_edited?: boolean;
  is_forwarded?: boolean;
}

export interface GenerateSummaryRequest {
  user_id: number;
  chat_id: number;
  session_id?: string; // If not provided, uses current active session
  summary_language?: string;
  include_usernames?: boolean;
  include_timestamps?: boolean;
  focus_on_decisions?: boolean;
  focus_on_questions?: boolean;
}

export interface TrackingStatusResponse {
  is_tracking: boolean;
  session_id?: string;
  started_at?: Date;
  messages_collected?: number;
  meaningful_messages?: number;
  participants?: number;
  duration_minutes?: number;
}

export interface SummaryResponse {
  success: boolean;
  summary_id?: string;
  summary_text?: string;
  message_count?: number;
  participant_count?: number;
  processing_time_ms?: number;
  error_message?: string;
}

// =============================================================================
// VIEW TYPES (for database views)
// =============================================================================

export interface ActiveTrackingSessionView {
  session_id: string;
  user_id: number;
  chat_id: number;
  chat_title: string;
  username?: string;
  first_name?: string;
  started_at: Date;
  total_messages_collected: number;
  meaningful_messages_collected: number;
  unique_participants: number;
  duration_minutes: number;
  expires_at: Date;
}

export interface UserTrackingStatusView {
  user_id: number;
  chat_id: number;
  chat_title: string;
  username?: string;
  first_name?: string;
  is_tracking: boolean;
  tracking_started_at?: Date;
  current_session_id?: string;
  current_session_messages?: number;
  total_tracking_sessions: number;
  total_summaries_generated: number;
}

export interface SessionReadyForSummaryView {
  session_id: string;
  user_id: number;
  chat_id: number;
  chat_title: string;
  username?: string;
  first_name?: string;
  started_at: Date;
  ended_at: Date;
  meaningful_messages_collected: number;
  unique_participants: number;
  duration_minutes: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export interface TrackingCommand {
  type: 'start' | 'stop' | 'summarize' | 'status';
  user_id: number;
  chat_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  message_id?: number;
  options?: {
    auto_summary?: boolean;
    summary_language?: string;
    generate_summary?: boolean;
    include_usernames?: boolean;
    include_timestamps?: boolean;
  };
}

export interface MessageAnalysis {
  is_meaningful: boolean;
  contains_question: boolean;
  contains_url: boolean;
  contains_media: boolean;
  is_bot_command: boolean;
  confidence_score: number;
  content_length: number;
  word_count: number;
}

export interface SummaryPromptContext {
  messages: TrackedMessage[];
  chat_title?: string;
  participant_count: number;
  conversation_duration: number;
  language: string;
  include_usernames: boolean;
  include_timestamps: boolean;
  focus_on_decisions: boolean;
  focus_on_questions: boolean;
}

export interface ClaudeAPIResponse {
  success: boolean;
  content?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  processing_time_ms: number;
  error_message?: string;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export interface TrackingConfig {
  // Session limits
  max_session_duration_hours: number;
  max_messages_per_session: number;
  auto_expire_after_days: number;
  
  // Message filtering
  min_message_length: number;
  exclude_bot_messages: boolean;
  exclude_commands: boolean;
  exclude_short_messages: boolean;
  
  // Summary settings
  default_language: string;
  max_summary_length: number;
  include_context_by_default: boolean;
  
  // Rate limiting
  max_tracking_sessions_per_user: number;
  max_summaries_per_user_per_day: number;
  
  // Cleanup settings
  cleanup_expired_sessions_after_days: number;
  cleanup_old_summaries_after_days: number;
}

export interface DobbyResponseTemplate {
  tracking_started: string;
  tracking_stopped: string;
  tracking_already_active: string;
  tracking_not_active: string;
  summary_generating: string;
  summary_completed: string;
  summary_failed: string;
  no_messages_to_summarize: string;
  session_expired: string;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export class TrackingError extends Error {
  constructor(
    message: string,
    public code: TrackingErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'TrackingError';
  }
}

export enum TrackingErrorCode {
  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_ALREADY_ACTIVE = 'SESSION_ALREADY_ACTIVE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',
  
  // Message errors
  MESSAGE_TOO_SHORT = 'MESSAGE_TOO_SHORT',
  MESSAGE_ALREADY_TRACKED = 'MESSAGE_ALREADY_TRACKED',
  MESSAGE_LIMIT_EXCEEDED = 'MESSAGE_LIMIT_EXCEEDED',
  
  // Summary errors
  NO_MESSAGES_TO_SUMMARIZE = 'NO_MESSAGES_TO_SUMMARIZE',
  SUMMARY_GENERATION_FAILED = 'SUMMARY_GENERATION_FAILED',
  SUMMARY_LIMIT_EXCEEDED = 'SUMMARY_LIMIT_EXCEEDED',
  
  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // API errors
  CLAUDE_API_ERROR = 'CLAUDE_API_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR'
}

// =============================================================================
// TYPES EXPORTED ABOVE (no re-export needed as they use export interface/type)
// =============================================================================