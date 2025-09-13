// Supabase Database Client Utility

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import type { Database, DatabaseConfig } from '../../../src/types';

/**
 * Create and configure Supabase client
 */
export function createSupabaseClient(config: DatabaseConfig): SupabaseClient<Database> {
  const client = createClient<Database>(
    config.url,
    config.apiKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      db: {
        schema: config.schema || 'public',
      },
      global: {
        headers: {
          'User-Agent': 'telegram-ai-bot/1.0.0',
        },
      },
    },
  );

  return client;
}

/**
 * Database helper functions for common operations
 */
export class DatabaseHelper {
  private retryAttempts = 3;
  private retryDelay = 1000; // milliseconds

  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * Execute a database operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Database operation '${operationName}' failed (attempt ${attempt}/${this.retryAttempts}):`, error);
        
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // exponential backoff
          await this.sleep(delay);
        }
      }
    }
    
    console.error(`Database operation '${operationName}' failed after ${this.retryAttempts} attempts:`, lastError);
    throw lastError!;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate required fields
   */
  private validateRequired(data: Record<string, any>, requiredFields: string[]): void {
    const missing = requiredFields.filter(field => {
      const value = data[field];
      return value === undefined || value === null || value === '';
    });
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Sanitize data for database insertion
   */
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        continue; // Skip undefined values
      }
      
      if (typeof value === 'string') {
        // Sanitize strings
        sanitized[key] = value.trim().substring(0, 10000); // Limit string length
      } else if (typeof value === 'object' && value !== null) {
        // Ensure objects are valid JSON
        try {
          sanitized[key] = JSON.parse(JSON.stringify(value));
        } catch {
          console.warn(`Invalid JSON object for field ${key}, skipping`);
          continue;
        }
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Upsert user information
   */
  async upsertUser(userData: {
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    language_code?: string;
  }) {
    return this.executeWithRetry(async () => {
      // Validate required fields
      this.validateRequired(userData, ['telegram_id']);
      
      // Sanitize input data
      const sanitizedData = this.sanitizeData({
        telegram_id: userData.telegram_id,
        username: userData.username || null,
        first_name: userData.first_name || null,
        last_name: userData.last_name || null,
        language_code: userData.language_code || null,
        is_active: true,
        last_seen: new Date().toISOString(),
        preferences: {
          language: userData.language_code || 'en',
          timezone: 'UTC',
          notification_settings: {
            summaries: true,
            mentions: true,
            replies: true,
          },
          privacy_settings: {
            allow_data_collection: true,
            share_analytics: false,
          },
          summary_preferences: {
            enabled: true,
            frequency: ['daily'],
            format: 'detailed',
            include_media: false,
          },
        },
      });

      const { data, error } = await this.client
        .from('users')
        .upsert(sanitizedData, {
          onConflict: 'telegram_id',
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to upsert user: ${error.message}`);
      }

      return data;
    }, 'upsertUser');
  }

  /**
   * Upsert chat information
   */
  async upsertChat(chatData: {
    telegram_id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    description?: string;
  }) {
    return this.executeWithRetry(async () => {
      // Validate required fields
      this.validateRequired(chatData, ['telegram_id', 'type']);
      
      // Validate chat type
      const validTypes = ['private', 'group', 'supergroup', 'channel'];
      if (!validTypes.includes(chatData.type)) {
        throw new Error(`Invalid chat type: ${chatData.type}`);
      }
      
      // Sanitize input data
      const sanitizedData = this.sanitizeData({
        telegram_id: chatData.telegram_id,
        type: chatData.type,
        title: chatData.title || null,
        username: chatData.username || null,
        description: chatData.description || null,
        is_active: true,
        last_activity: new Date().toISOString(),
        settings: {
          summary_enabled: true,
          summary_frequency: ['daily'],
          summary_format: 'detailed',
          auto_delete_old_messages: false,
          auto_delete_days: 30,
          allowed_commands: ['start', 'help', 'summary', 'settings', 'stats'],
          allowed_summary_roles: ['admin', 'member'],
          admin_users: [],
          exclude_topics: [],
          include_media_info: false,
          bot_permissions: {
            can_send_messages: true,
            can_send_media: true,
            can_delete_messages: false,
            can_restrict_members: false,
          },
        },
      });

      const { data, error } = await this.client
        .from('chats')
        .upsert(sanitizedData, {
          onConflict: 'telegram_id',
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to upsert chat: ${error.message}`);
      }

      return data;
    }, 'upsertChat');
  }

  /**
   * Store a message
   */
  async storeMessage(messageData: {
    telegram_message_id: number;
    chat_id: string;
    user_id?: string;
    content?: string;
    message_type: Database['public']['Enums']['message_type'];
    media_info?: any;
    reply_to_message_id?: string;
    is_edited?: boolean;
    is_forwarded?: boolean;
    forward_info?: any;
  }) {
    return this.executeWithRetry(async () => {
      // Validate required fields
      this.validateRequired(messageData, ['telegram_message_id', 'chat_id', 'message_type']);
      
      // Validate message type
      const validTypes = ['text', 'photo', 'video', 'audio', 'document', 'voice', 'sticker', 'animation', 'location', 'contact', 'poll', 'venue', 'dice', 'game', 'other'];
      if (!validTypes.includes(messageData.message_type)) {
        throw new Error(`Invalid message type: ${messageData.message_type}`);
      }
      
      // Sanitize input data
      const sanitizedData = this.sanitizeData({
        telegram_message_id: messageData.telegram_message_id,
        chat_id: messageData.chat_id,
        user_id: messageData.user_id || null,
        content: messageData.content || null,
        message_type: messageData.message_type,
        media_info: messageData.media_info || null,
        reply_to_message_id: messageData.reply_to_message_id || null,
        is_edited: messageData.is_edited || false,
        is_forwarded: messageData.is_forwarded || false,
        forward_info: messageData.forward_info || null,
        processed_at: null,
      });

      // Handle potential duplicate messages
      const { data, error } = await this.client
        .from('messages')
        .insert(sanitizedData)
        .select()
        .single();

      if (error) {
        // Check if it's a duplicate key error
        if (error.code === '23505') {
          console.warn(`Duplicate message detected: ${messageData.telegram_message_id} in chat ${messageData.chat_id}`);
          // Return existing message
          const existing = await this.client
            .from('messages')
            .select()
            .eq('telegram_message_id', messageData.telegram_message_id)
            .eq('chat_id', messageData.chat_id)
            .single();
          
          if (existing.data) {
            return existing.data;
          }
        }
        
        throw new Error(`Failed to store message: ${error.message}`);
      }

      return data;
    }, 'storeMessage');
  }

  /**
   * Update a message (for edited messages)
   */
  async updateMessage(
    telegramMessageId: number,
    chatId: string,
    updates: {
      content?: string;
      is_edited?: boolean;
      processed_at?: string;
    },
  ) {
    return this.executeWithRetry(async () => {
      // Validate required parameters
      if (!telegramMessageId || !chatId) {
        throw new Error('telegram_message_id and chat_id are required');
      }
      
      // Sanitize updates
      const sanitizedUpdates = this.sanitizeData({
        ...updates,
        updated_at: new Date().toISOString(),
      });

      const { data, error } = await this.client
        .from('messages')
        .update(sanitizedUpdates)
        .eq('telegram_message_id', telegramMessageId)
        .eq('chat_id', chatId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.warn(`Message not found for update: ${telegramMessageId} in chat ${chatId}`);
          return null;
        }
        throw new Error(`Failed to update message: ${error.message}`);
      }

      return data;
    }, 'updateMessage');
  }

  /**
   * Get recent messages for a chat
   */
  async getRecentMessages(
    chatId: string,
    limit: number = 50,
    beforeDate?: string,
  ): Promise<any[]> {
    return this.executeWithRetry(async () => {
      // Validate parameters
      if (!chatId) {
        throw new Error('chat_id is required');
      }
      
      // Validate limit
      const validatedLimit = Math.min(Math.max(1, limit), 1000); // Between 1 and 1000
      
      let query = this.client
        .from('messages')
        .select(`
          *,
          users:user_id (
            id,
            telegram_id,
            username,
            first_name,
            last_name
          )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(validatedLimit);

      if (beforeDate) {
        // Validate date format
        const date = new Date(beforeDate);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date format for beforeDate');
        }
        query = query.lt('created_at', beforeDate);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get recent messages: ${error.message}`);
      }

      return data || [];
    }, 'getRecentMessages');
  }

  /**
   * Get messages in a time range for summary
   */
  async getMessagesInRange(
    chatId: string,
    startTime: string,
    endTime: string,
  ): Promise<any[]> {
    return this.executeWithRetry(async () => {
      // Validate parameters
      if (!chatId || !startTime || !endTime) {
        throw new Error('chat_id, start_time, and end_time are required');
      }
      
      // Validate date formats
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format for start_time or end_time');
      }
      
      if (start >= end) {
        throw new Error('start_time must be before end_time');
      }

      // Try using RPC function first, fall back to direct query if it doesn't exist
      let data, error;
      
      try {
        const result = await this.client
          .rpc('get_chat_messages_in_range', {
            chat_id: chatId,
            start_time: startTime,
            end_time: endTime,
          });
        data = result.data;
        error = result.error;
      } catch (rpcError) {
        console.warn('RPC function not available, using direct query:', rpcError);
        
        // Fallback to direct query
        const result = await this.client
          .from('messages')
          .select(`
            *,
            users:user_id (
              id,
              telegram_id,
              username,
              first_name,
              last_name
            )
          `)
          .eq('chat_id', chatId)
          .gte('created_at', startTime)
          .lte('created_at', endTime)
          .order('created_at', { ascending: true });
          
        data = result.data;
        error = result.error;
      }

      if (error) {
        throw new Error(`Failed to get messages in range: ${error.message}`);
      }

      return data || [];
    }, 'getMessagesInRange');
  }

  /**
   * Store a summary
   */
  async storeSummary(summaryData: {
    chat_id: string;
    summary_type: Database['public']['Enums']['summary_type'];
    content: string;
    message_count: number;
    start_time: string;
    end_time: string;
    metadata?: any;
  }) {
    return this.executeWithRetry(async () => {
      // Validate required fields
      this.validateRequired(summaryData, ['chat_id', 'summary_type', 'content', 'message_count', 'start_time', 'end_time']);
      
      // Validate summary type
      const validTypes = ['manual', 'scheduled', 'daily', 'weekly', 'monthly'];
      if (!validTypes.includes(summaryData.summary_type)) {
        throw new Error(`Invalid summary type: ${summaryData.summary_type}`);
      }
      
      // Validate dates
      const startTime = new Date(summaryData.start_time);
      const endTime = new Date(summaryData.end_time);
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new Error('Invalid date format for start_time or end_time');
      }
      
      if (startTime >= endTime) {
        throw new Error('start_time must be before end_time');
      }
      
      // Validate message count
      if (summaryData.message_count < 0) {
        throw new Error('message_count cannot be negative');
      }
      
      // Sanitize data
      const sanitizedData = this.sanitizeData({
        ...summaryData,
        content: summaryData.content.substring(0, 50000), // Limit content length
      });

      const { data, error } = await this.client
        .from('summaries')
        .insert(sanitizedData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to store summary: ${error.message}`);
      }

      return data;
    }, 'storeSummary');
  }

  /**
   * Get user session
   */
  async getUserSession(userId: string) {
    return this.executeWithRetry(async () => {
      if (!userId) {
        throw new Error('user_id is required');
      }

      const { data, error } = await this.client
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw new Error(`Failed to get user session: ${error.message}`);
      }

      return data;
    }, 'getUserSession');
  }

  /**
   * Update or create user session
   */
  async upsertUserSession(
    userId: string,
    sessionData: any,
    expiresInMs: number = 30 * 60 * 1000, // 30 minutes default
  ) {
    return this.executeWithRetry(async () => {
      if (!userId) {
        throw new Error('user_id is required');
      }

      const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

      const sanitizedData = this.sanitizeData({
        user_id: userId,
        session_data: sessionData,
        expires_at: expiresAt,
      });

      const { data, error } = await this.client
        .from('user_sessions')
        .upsert(sanitizedData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to upsert user session: ${error.message}`);
      }

      return data;
    }, 'upsertUserSession');
  }

  /**
   * Get chat statistics
   */
  async getChatStatistics(chatId: string) {
    return this.executeWithRetry(async () => {
      if (!chatId) {
        throw new Error('chat_id is required');
      }

      const { data, error } = await this.client
        .from('chat_statistics')
        .select('*')
        .eq('chat_id', chatId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to get chat statistics: ${error.message}`);
      }

      return data;
    }, 'getChatStatistics');
  }

  /**
   * Get user activity in a chat
   */
  async getUserActivity(chatId: string, userId?: string) {
    return this.executeWithRetry(async () => {
      if (!chatId) {
        throw new Error('chat_id is required');
      }

      let query = this.client
        .from('user_activity')
        .select('*')
        .eq('chat_id', chatId);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get user activity: ${error.message}`);
      }

      return data || [];
    }, 'getUserActivity');
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(olderThanDays: number = 90) {
    return this.executeWithRetry(async () => {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      // Delete old messages
      const { error: messagesError } = await this.client
        .from('messages')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (messagesError) {
        console.error('Error cleaning up old messages:', messagesError);
      }

      // Delete expired sessions
      const { error: sessionsError } = await this.client
        .from('user_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (sessionsError) {
        console.error('Error cleaning up expired sessions:', sessionsError);
      }

      return {
        messagesCleanup: !messagesError,
        sessionsCleanup: !sessionsError,
      };
    }, 'cleanupOldData');
  }

  /**
   * Health check for database connection
   */
  async healthCheck() {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      const { data, error } = await this.client
        .from('users')
        .select('id')
        .limit(1);

      if (error) {
        throw error;
      }

      const responseTime = Date.now() - startTime;
      
      return { 
        status: 'healthy', 
        responseTime,
        timestamp: new Date().toISOString(),
        details: {
          canConnect: true,
          canQuery: true,
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        details: {
          canConnect: false,
          canQuery: false,
        }
      };
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    totalUsers: number;
    totalChats: number;
    totalMessages: number;
    totalSummaries: number;
    activeUsersLast24h: number;
    messagesLast24h: number;
  }> {
    return this.executeWithRetry(async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Get all counts in parallel
      const [usersResult, chatsResult, messagesResult, summariesResult, activeUsersResult, recentMessagesResult] = await Promise.all([
        this.client.from('users').select('id', { count: 'exact', head: true }),
        this.client.from('chats').select('id', { count: 'exact', head: true }),
        this.client.from('messages').select('id', { count: 'exact', head: true }),
        this.client.from('summaries').select('id', { count: 'exact', head: true }),
        this.client.from('users').select('id', { count: 'exact', head: true }).gte('last_seen', twentyFourHoursAgo),
        this.client.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', twentyFourHoursAgo),
      ]);
      
      // Check for errors
      const results = [usersResult, chatsResult, messagesResult, summariesResult, activeUsersResult, recentMessagesResult];
      for (const result of results) {
        if (result.error) {
          throw new Error(`Database stats error: ${result.error.message}`);
        }
      }
      
      return {
        totalUsers: usersResult.count || 0,
        totalChats: chatsResult.count || 0,
        totalMessages: messagesResult.count || 0,
        totalSummaries: summariesResult.count || 0,
        activeUsersLast24h: activeUsersResult.count || 0,
        messagesLast24h: recentMessagesResult.count || 0,
      };
    }, 'getDatabaseStats');
  }

  /**
   * Update user last seen timestamp
   */
  async updateUserLastSeen(userId: string): Promise<void> {
    return this.executeWithRetry(async () => {
      if (!userId) {
        throw new Error('user_id is required');
      }
      
      const { error } = await this.client
        .from('users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userId);
      
      if (error) {
        throw new Error(`Failed to update user last seen: ${error.message}`);
      }
    }, 'updateUserLastSeen');
  }

  /**
   * Get user by telegram ID
   */
  async getUserByTelegramId(telegramId: number): Promise<any | null> {
    return this.executeWithRetry(async () => {
      if (!telegramId) {
        throw new Error('telegram_id is required');
      }
      
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        throw new Error(`Failed to get user by telegram ID: ${error.message}`);
      }
      
      return data;
    }, 'getUserByTelegramId');
  }

  /**
   * Get chat by telegram ID
   */
  async getChatByTelegramId(telegramId: number): Promise<any | null> {
    return this.executeWithRetry(async () => {
      if (!telegramId) {
        throw new Error('telegram_id is required');
      }
      
      const { data, error } = await this.client
        .from('chats')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Chat not found
        }
        throw new Error(`Failed to get chat by telegram ID: ${error.message}`);
      }
      
      return data;
    }, 'getChatByTelegramId');
  }
}