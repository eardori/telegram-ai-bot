"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseHelper = void 0;
exports.createSupabaseClient = createSupabaseClient;
const supabase_js_1 = require("@supabase/supabase-js");
function createSupabaseClient(config) {
    const client = (0, supabase_js_1.createClient)(config.url, config.apiKey, {
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
    });
    return client;
}
class DatabaseHelper {
    constructor(client) {
        this.client = client;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }
    async executeWithRetry(operation, operationName) {
        let lastError;
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                console.warn(`Database operation '${operationName}' failed (attempt ${attempt}/${this.retryAttempts}):`, error);
                if (attempt < this.retryAttempts) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    await this.sleep(delay);
                }
            }
        }
        console.error(`Database operation '${operationName}' failed after ${this.retryAttempts} attempts:`, lastError);
        throw lastError;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    validateRequired(data, requiredFields) {
        const missing = requiredFields.filter(field => {
            const value = data[field];
            return value === undefined || value === null || value === '';
        });
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
    }
    sanitizeData(data) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) {
                continue;
            }
            if (typeof value === 'string') {
                sanitized[key] = value.trim().substring(0, 10000);
            }
            else if (typeof value === 'object' && value !== null) {
                try {
                    sanitized[key] = JSON.parse(JSON.stringify(value));
                }
                catch {
                    console.warn(`Invalid JSON object for field ${key}, skipping`);
                    continue;
                }
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    async upsertUser(userData) {
        return this.executeWithRetry(async () => {
            this.validateRequired(userData, ['telegram_id']);
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
    async upsertChat(chatData) {
        return this.executeWithRetry(async () => {
            this.validateRequired(chatData, ['telegram_id', 'type']);
            const validTypes = ['private', 'group', 'supergroup', 'channel'];
            if (!validTypes.includes(chatData.type)) {
                throw new Error(`Invalid chat type: ${chatData.type}`);
            }
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
    async storeMessage(messageData) {
        return this.executeWithRetry(async () => {
            this.validateRequired(messageData, ['telegram_message_id', 'chat_id', 'message_type']);
            const validTypes = ['text', 'photo', 'video', 'audio', 'document', 'voice', 'sticker', 'animation', 'location', 'contact', 'poll', 'venue', 'dice', 'game', 'other'];
            if (!validTypes.includes(messageData.message_type)) {
                throw new Error(`Invalid message type: ${messageData.message_type}`);
            }
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
            const { data, error } = await this.client
                .from('messages')
                .insert(sanitizedData)
                .select()
                .single();
            if (error) {
                if (error.code === '23505') {
                    console.warn(`Duplicate message detected: ${messageData.telegram_message_id} in chat ${messageData.chat_id}`);
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
    async updateMessage(telegramMessageId, chatId, updates) {
        return this.executeWithRetry(async () => {
            if (!telegramMessageId || !chatId) {
                throw new Error('telegram_message_id and chat_id are required');
            }
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
    async getRecentMessages(chatId, limit = 50, beforeDate) {
        return this.executeWithRetry(async () => {
            if (!chatId) {
                throw new Error('chat_id is required');
            }
            const validatedLimit = Math.min(Math.max(1, limit), 1000);
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
    async getMessagesInRange(chatId, startTime, endTime) {
        return this.executeWithRetry(async () => {
            if (!chatId || !startTime || !endTime) {
                throw new Error('chat_id, start_time, and end_time are required');
            }
            const start = new Date(startTime);
            const end = new Date(endTime);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new Error('Invalid date format for start_time or end_time');
            }
            if (start >= end) {
                throw new Error('start_time must be before end_time');
            }
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
            }
            catch (rpcError) {
                console.warn('RPC function not available, using direct query:', rpcError);
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
    async storeSummary(summaryData) {
        return this.executeWithRetry(async () => {
            this.validateRequired(summaryData, ['chat_id', 'summary_type', 'content', 'message_count', 'start_time', 'end_time']);
            const validTypes = ['manual', 'scheduled', 'daily', 'weekly', 'monthly'];
            if (!validTypes.includes(summaryData.summary_type)) {
                throw new Error(`Invalid summary type: ${summaryData.summary_type}`);
            }
            const startTime = new Date(summaryData.start_time);
            const endTime = new Date(summaryData.end_time);
            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                throw new Error('Invalid date format for start_time or end_time');
            }
            if (startTime >= endTime) {
                throw new Error('start_time must be before end_time');
            }
            if (summaryData.message_count < 0) {
                throw new Error('message_count cannot be negative');
            }
            const sanitizedData = this.sanitizeData({
                ...summaryData,
                content: summaryData.content.substring(0, 50000),
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
    async getUserSession(userId) {
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
            if (error && error.code !== 'PGRST116') {
                throw new Error(`Failed to get user session: ${error.message}`);
            }
            return data;
        }, 'getUserSession');
    }
    async upsertUserSession(userId, sessionData, expiresInMs = 30 * 60 * 1000) {
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
    async getChatStatistics(chatId) {
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
    async getUserActivity(chatId, userId) {
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
    async cleanupOldData(olderThanDays = 90) {
        return this.executeWithRetry(async () => {
            const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
            const { error: messagesError } = await this.client
                .from('messages')
                .delete()
                .lt('created_at', cutoffDate.toISOString());
            if (messagesError) {
                console.error('Error cleaning up old messages:', messagesError);
            }
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
    async healthCheck() {
        const startTime = Date.now();
        try {
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
        }
        catch (error) {
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
    async getDatabaseStats() {
        return this.executeWithRetry(async () => {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const [usersResult, chatsResult, messagesResult, summariesResult, activeUsersResult, recentMessagesResult] = await Promise.all([
                this.client.from('users').select('id', { count: 'exact', head: true }),
                this.client.from('chats').select('id', { count: 'exact', head: true }),
                this.client.from('messages').select('id', { count: 'exact', head: true }),
                this.client.from('summaries').select('id', { count: 'exact', head: true }),
                this.client.from('users').select('id', { count: 'exact', head: true }).gte('last_seen', twentyFourHoursAgo),
                this.client.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', twentyFourHoursAgo),
            ]);
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
    async updateUserLastSeen(userId) {
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
    async getUserByTelegramId(telegramId) {
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
                    return null;
                }
                throw new Error(`Failed to get user by telegram ID: ${error.message}`);
            }
            return data;
        }, 'getUserByTelegramId');
    }
    async getChatByTelegramId(telegramId) {
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
                    return null;
                }
                throw new Error(`Failed to get chat by telegram ID: ${error.message}`);
            }
            return data;
        }, 'getChatByTelegramId');
    }
}
exports.DatabaseHelper = DatabaseHelper;
//# sourceMappingURL=database.js.map