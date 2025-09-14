import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, DatabaseConfig } from '../../../src/types';
export declare function createSupabaseClient(config: DatabaseConfig): SupabaseClient<Database>;
export declare class DatabaseHelper {
    private readonly client;
    private retryAttempts;
    private retryDelay;
    constructor(client: SupabaseClient<Database>);
    private executeWithRetry;
    private sleep;
    private validateRequired;
    private sanitizeData;
    upsertUser(userData: {
        telegram_id: number;
        username?: string;
        first_name?: string;
        last_name?: string;
        language_code?: string;
    }): Promise<never>;
    upsertChat(chatData: {
        telegram_id: number;
        type: 'private' | 'group' | 'supergroup' | 'channel';
        title?: string;
        username?: string;
        description?: string;
    }): Promise<never>;
    storeMessage(messageData: {
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
    }): Promise<any>;
    updateMessage(telegramMessageId: number, chatId: string, updates: {
        content?: string;
        is_edited?: boolean;
        processed_at?: string;
    }): Promise<null>;
    getRecentMessages(chatId: string, limit?: number, beforeDate?: string): Promise<any[]>;
    getMessagesInRange(chatId: string, startTime: string, endTime: string): Promise<any[]>;
    storeSummary(summaryData: {
        chat_id: string;
        summary_type: Database['public']['Enums']['summary_type'];
        content: string;
        message_count: number;
        start_time: string;
        end_time: string;
        metadata?: any;
    }): Promise<never>;
    getUserSession(userId: string): Promise<null>;
    upsertUserSession(userId: string, sessionData: any, expiresInMs?: number): Promise<never>;
    getChatStatistics(chatId: string): Promise<null>;
    getUserActivity(chatId: string, userId?: string): Promise<never[]>;
    cleanupOldData(olderThanDays?: number): Promise<{
        messagesCleanup: boolean;
        sessionsCleanup: boolean;
    }>;
    healthCheck(): Promise<{
        status: string;
        responseTime: number;
        timestamp: string;
        details: {
            canConnect: boolean;
            canQuery: boolean;
        };
        error?: undefined;
    } | {
        status: string;
        responseTime: number;
        error: string;
        timestamp: string;
        details: {
            canConnect: boolean;
            canQuery: boolean;
        };
    }>;
    getDatabaseStats(): Promise<{
        totalUsers: number;
        totalChats: number;
        totalMessages: number;
        totalSummaries: number;
        activeUsersLast24h: number;
        messagesLast24h: number;
    }>;
    updateUserLastSeen(userId: string): Promise<void>;
    getUserByTelegramId(telegramId: number): Promise<any | null>;
    getChatByTelegramId(telegramId: number): Promise<any | null>;
}
//# sourceMappingURL=database.d.ts.map