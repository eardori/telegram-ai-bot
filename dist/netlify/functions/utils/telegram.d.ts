import type { TelegramMessage, TelegramUpdate, TelegramInlineKeyboardMarkup, TelegramBotCommand } from '../../../src/types/telegram';
import type { TelegramConfig } from '../../../src/config/telegram';
export declare class TelegramBot {
    private readonly baseUrl;
    private readonly token;
    constructor(config: TelegramConfig);
    private makeRequest;
    sendMessage(chatId: number | string, text: string, options?: {
        parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
        entities?: any[];
        disable_web_page_preview?: boolean;
        disable_notification?: boolean;
        protect_content?: boolean;
        reply_to_message_id?: number;
        allow_sending_without_reply?: boolean;
        reply_markup?: TelegramInlineKeyboardMarkup;
    }): Promise<TelegramMessage>;
    sendPhoto(chatId: number | string, photo: string, options?: {
        caption?: string;
        parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
        caption_entities?: any[];
        disable_notification?: boolean;
        protect_content?: boolean;
        reply_to_message_id?: number;
        allow_sending_without_reply?: boolean;
        reply_markup?: TelegramInlineKeyboardMarkup;
    }): Promise<TelegramMessage>;
    sendDocument(chatId: number | string, document: string, options?: {
        thumbnail?: string;
        caption?: string;
        parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
        caption_entities?: any[];
        disable_content_type_detection?: boolean;
        disable_notification?: boolean;
        protect_content?: boolean;
        reply_to_message_id?: number;
        allow_sending_without_reply?: boolean;
        reply_markup?: TelegramInlineKeyboardMarkup;
    }): Promise<TelegramMessage>;
    editMessageText(chatId: number | string, messageId: number, text: string, options?: {
        parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
        entities?: any[];
        disable_web_page_preview?: boolean;
        reply_markup?: TelegramInlineKeyboardMarkup;
    }): Promise<TelegramMessage | boolean>;
    deleteMessage(chatId: number | string, messageId: number): Promise<boolean>;
    sendChatAction(chatId: number | string, action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'choose_sticker' | 'find_location' | 'record_video_note' | 'upload_video_note'): Promise<boolean>;
    answerCallbackQuery(callbackQueryId: string, options?: {
        text?: string;
        show_alert?: boolean;
        url?: string;
        cache_time?: number;
    }): Promise<boolean>;
    getChat(chatId: number | string): Promise<any>;
    getChatMember(chatId: number | string, userId: number): Promise<any>;
    getChatAdministrators(chatId: number | string): Promise<any>;
    getMe(): Promise<any>;
    setMyCommands(commands: TelegramBotCommand[], options?: {
        scope?: any;
        language_code?: string;
    }): Promise<boolean>;
    getMyCommands(options?: {
        scope?: any;
        language_code?: string;
    }): Promise<TelegramBotCommand[]>;
    setWebhook(url: string, options?: {
        certificate?: string;
        ip_address?: string;
        max_connections?: number;
        allowed_updates?: string[];
        drop_pending_updates?: boolean;
        secret_token?: string;
    }): Promise<boolean>;
    deleteWebhook(dropPendingUpdates?: boolean): Promise<boolean>;
    getWebhookInfo(): Promise<any>;
    getUpdates(options?: {
        offset?: number;
        limit?: number;
        timeout?: number;
        allowed_updates?: string[];
    }): Promise<TelegramUpdate[]>;
    forwardMessage(chatId: number | string, fromChatId: number | string, messageId: number, options?: {
        disable_notification?: boolean;
        protect_content?: boolean;
    }): Promise<TelegramMessage>;
    copyMessage(chatId: number | string, fromChatId: number | string, messageId: number, options?: {
        caption?: string;
        parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
        caption_entities?: any[];
        disable_notification?: boolean;
        protect_content?: boolean;
        reply_to_message_id?: number;
        allow_sending_without_reply?: boolean;
        reply_markup?: TelegramInlineKeyboardMarkup;
    }): Promise<{
        message_id: number;
    }>;
    pinChatMessage(chatId: number | string, messageId: number, options?: {
        disable_notification?: boolean;
    }): Promise<boolean>;
    unpinChatMessage(chatId: number | string, messageId?: number): Promise<boolean>;
    leaveChat(chatId: number | string): Promise<boolean>;
    exportChatInviteLink(chatId: number | string): Promise<string>;
    createChatInviteLink(chatId: number | string, options?: {
        name?: string;
        expire_date?: number;
        member_limit?: number;
        creates_join_request?: boolean;
    }): Promise<any>;
    setChatDescription(chatId: number | string, description?: string): Promise<boolean>;
    setChatTitle(chatId: number | string, title: string): Promise<boolean>;
    restrictChatMember(chatId: number | string, userId: number, permissions: any, options?: {
        until_date?: number;
    }): Promise<boolean>;
    banChatMember(chatId: number | string, userId: number, options?: {
        until_date?: number;
        revoke_messages?: boolean;
    }): Promise<boolean>;
    unbanChatMember(chatId: number | string, userId: number, onlyIfBanned?: boolean): Promise<boolean>;
    downloadFile(fileId: string): Promise<ArrayBuffer>;
    getFile(fileId: string): Promise<any>;
}
export declare class InlineKeyboard {
    private keyboard;
    row(...buttons: InlineKeyboardButton[]): InlineKeyboard;
    button(text: string, callbackData: string): InlineKeyboard;
    url(text: string, url: string): InlineKeyboard;
    build(): TelegramInlineKeyboardMarkup;
}
export declare class InlineKeyboardButton {
    private button;
    constructor(text: string);
    callbackData(data: string): InlineKeyboardButton;
    url(url: string): InlineKeyboardButton;
    switchInlineQuery(query: string): InlineKeyboardButton;
    switchInlineQueryCurrentChat(query: string): InlineKeyboardButton;
    build(): any;
}
//# sourceMappingURL=telegram.d.ts.map