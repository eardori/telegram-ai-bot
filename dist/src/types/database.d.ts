export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;
                    telegram_id: number;
                    username: string | null;
                    first_name: string | null;
                    last_name: string | null;
                    language_code: string | null;
                    is_active: boolean;
                    preferences: UserPreferences;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    telegram_id: number;
                    username?: string | null;
                    first_name?: string | null;
                    last_name?: string | null;
                    language_code?: string | null;
                    is_active?: boolean;
                    preferences?: UserPreferences;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    telegram_id?: number;
                    username?: string | null;
                    first_name?: string | null;
                    last_name?: string | null;
                    language_code?: string | null;
                    is_active?: boolean;
                    preferences?: UserPreferences;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            chats: {
                Row: {
                    id: string;
                    telegram_id: number;
                    type: 'private' | 'group' | 'supergroup' | 'channel';
                    title: string | null;
                    username: string | null;
                    description: string | null;
                    is_active: boolean;
                    settings: ChatSettings;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    telegram_id: number;
                    type: 'private' | 'group' | 'supergroup' | 'channel';
                    title?: string | null;
                    username?: string | null;
                    description?: string | null;
                    is_active?: boolean;
                    settings?: ChatSettings;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    telegram_id?: number;
                    type?: 'private' | 'group' | 'supergroup' | 'channel';
                    title?: string | null;
                    username?: string | null;
                    description?: string | null;
                    is_active?: boolean;
                    settings?: ChatSettings;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            messages: {
                Row: {
                    id: string;
                    telegram_message_id: number;
                    chat_id: string;
                    user_id: string | null;
                    content: string | null;
                    message_type: MessageType;
                    media_info: MediaInfo | null;
                    reply_to_message_id: string | null;
                    is_edited: boolean;
                    is_forwarded: boolean;
                    forward_info: ForwardInfo | null;
                    processed_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    telegram_message_id: number;
                    chat_id: string;
                    user_id?: string | null;
                    content?: string | null;
                    message_type: MessageType;
                    media_info?: MediaInfo | null;
                    reply_to_message_id?: string | null;
                    is_edited?: boolean;
                    is_forwarded?: boolean;
                    forward_info?: ForwardInfo | null;
                    processed_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    telegram_message_id?: number;
                    chat_id?: string;
                    user_id?: string | null;
                    content?: string | null;
                    message_type?: MessageType;
                    media_info?: MediaInfo | null;
                    reply_to_message_id?: string | null;
                    is_edited?: boolean;
                    is_forwarded?: boolean;
                    forward_info?: ForwardInfo | null;
                    processed_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            summaries: {
                Row: {
                    id: string;
                    chat_id: string;
                    summary_type: SummaryType;
                    content: string;
                    message_count: number;
                    start_time: string;
                    end_time: string;
                    metadata: SummaryMetadata;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    chat_id: string;
                    summary_type: SummaryType;
                    content: string;
                    message_count: number;
                    start_time: string;
                    end_time: string;
                    metadata?: SummaryMetadata;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    chat_id?: string;
                    summary_type?: SummaryType;
                    content?: string;
                    message_count?: number;
                    start_time?: string;
                    end_time?: string;
                    metadata?: SummaryMetadata;
                    created_at?: string;
                };
            };
            bot_commands: {
                Row: {
                    id: string;
                    command: string;
                    description: string;
                    is_active: boolean;
                    allowed_chat_types: ('private' | 'group' | 'supergroup' | 'channel')[];
                    admin_only: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    command: string;
                    description: string;
                    is_active?: boolean;
                    allowed_chat_types?: ('private' | 'group' | 'supergroup' | 'channel')[];
                    admin_only?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    command?: string;
                    description?: string;
                    is_active?: boolean;
                    allowed_chat_types?: ('private' | 'group' | 'supergroup' | 'channel')[];
                    admin_only?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            user_sessions: {
                Row: {
                    id: string;
                    user_id: string;
                    session_data: SessionData;
                    expires_at: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    session_data: SessionData;
                    expires_at: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    session_data?: SessionData;
                    expires_at?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
        };
        Views: {
            chat_statistics: {
                Row: {
                    chat_id: string;
                    total_messages: number;
                    total_users: number;
                    most_active_user: string | null;
                    last_activity: string | null;
                    daily_average: number;
                };
            };
            user_activity: {
                Row: {
                    user_id: string;
                    chat_id: string;
                    message_count: number;
                    last_message_at: string;
                    first_message_at: string;
                };
            };
        };
        Functions: {
            get_chat_messages_in_range: {
                Args: {
                    chat_id: string;
                    start_time: string;
                    end_time: string;
                };
                Returns: {
                    id: string;
                    content: string;
                    user_id: string;
                    created_at: string;
                }[];
            };
            calculate_summary_stats: {
                Args: {
                    chat_id: string;
                    summary_type: SummaryType;
                };
                Returns: {
                    total_summaries: number;
                    avg_message_count: number;
                    last_summary_at: string;
                };
            };
        };
        Enums: {
            message_type: 'text' | 'photo' | 'video' | 'audio' | 'document' | 'sticker' | 'voice' | 'video_note' | 'location' | 'contact' | 'poll' | 'dice' | 'game' | 'invoice' | 'successful_payment' | 'connected_website' | 'passport_data' | 'proximity_alert_triggered' | 'video_chat_scheduled' | 'video_chat_started' | 'video_chat_ended' | 'video_chat_participants_invited' | 'web_app_data' | 'other';
            summary_type: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual' | 'event_based';
        };
    };
}
export type MessageType = Database['public']['Enums']['message_type'];
export type SummaryType = Database['public']['Enums']['summary_type'];
export interface UserPreferences {
    language: string;
    timezone: string;
    notification_settings: {
        summaries: boolean;
        mentions: boolean;
        replies: boolean;
    };
    privacy_settings: {
        allow_data_collection: boolean;
        share_analytics: boolean;
    };
    summary_preferences: {
        enabled: boolean;
        frequency: SummaryType[];
        format: 'brief' | 'detailed' | 'bullet_points';
        include_media: boolean;
    };
}
export interface ChatSettings {
    summary_enabled: boolean;
    summary_frequency: SummaryType[];
    auto_delete_old_messages: boolean;
    auto_delete_days: number;
    allowed_commands: string[];
    admin_users: number[];
    bot_permissions: {
        can_send_messages: boolean;
        can_send_media: boolean;
        can_delete_messages: boolean;
        can_restrict_members: boolean;
    };
}
export interface MediaInfo {
    file_id: string;
    file_unique_id: string;
    file_type: string;
    file_size?: number;
    file_name?: string;
    mime_type?: string;
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: {
        file_id: string;
        width: number;
        height: number;
    };
}
export interface ForwardInfo {
    from_user_id?: number;
    from_chat_id?: number;
    from_message_id?: number;
    signature?: string;
    sender_name?: string;
    date: number;
}
export interface SummaryMetadata {
    llm_model: string;
    processing_time_ms: number;
    token_count?: number;
    confidence_score?: number;
    language_detected?: string;
    categories?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
    key_participants?: {
        user_id: string;
        message_count: number;
        contribution_score: number;
    }[];
    topics?: {
        topic: string;
        relevance_score: number;
    }[];
}
export interface SessionData {
    current_command?: string;
    step?: number;
    context?: Record<string, any>;
    temp_data?: Record<string, any>;
    last_interaction?: string;
}
export type DbResult<T> = T extends (...args: any[]) => any ? Awaited<ReturnType<T>> : never;
export type DbResultOk<T> = T extends {
    data: infer U;
} ? U : never;
export type DbResultErr = {
    error: {
        message: string;
        details?: any;
        hint?: any;
        code?: string;
    };
};
export type TableName = keyof Database['public']['Tables'];
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];
export type Insert<T extends TableName> = Database['public']['Tables'][T]['Insert'];
export type Update<T extends TableName> = Database['public']['Tables'][T]['Update'];
export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: {
        column: string;
        ascending?: boolean;
    };
}
export interface FilterOptions {
    eq?: Record<string, any>;
    neq?: Record<string, any>;
    gt?: Record<string, any>;
    gte?: Record<string, any>;
    lt?: Record<string, any>;
    lte?: Record<string, any>;
    like?: Record<string, string>;
    ilike?: Record<string, string>;
    in?: Record<string, any[]>;
    contains?: Record<string, any>;
    containedBy?: Record<string, any>;
}
//# sourceMappingURL=database.d.ts.map