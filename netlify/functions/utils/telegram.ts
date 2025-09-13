// Telegram Bot API Utility

import type {
  TelegramApiResponse,
  TelegramMessage,
  TelegramUpdate,
  TelegramInlineKeyboardMarkup,
  TelegramBotCommand,
} from '../../../src/types/telegram';
import type { TelegramConfig } from '../../../src/config/telegram';

/**
 * Telegram Bot API Client
 */
export class TelegramBot {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: TelegramConfig) {
    this.token = config.botToken;
    this.baseUrl = `${config.apiOptions?.baseUrl || 'https://api.telegram.org'}/bot${this.token}`;
  }

  /**
   * Make a request to Telegram Bot API
   */
  private async makeRequest<T = any>(
    method: string,
    params?: Record<string, any>,
  ): Promise<TelegramApiResponse<T>> {
    const url = `${this.baseUrl}/${method}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: params ? JSON.stringify(params) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
    }

    return data;
  }

  /**
   * Send a text message
   */
  async sendMessage(
    chatId: number | string,
    text: string,
    options: {
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      entities?: any[];
      disable_web_page_preview?: boolean;
      disable_notification?: boolean;
      protect_content?: boolean;
      reply_to_message_id?: number;
      allow_sending_without_reply?: boolean;
      reply_markup?: TelegramInlineKeyboardMarkup;
    } = {},
  ): Promise<TelegramMessage> {
    const response = await this.makeRequest<TelegramMessage>('sendMessage', {
      chat_id: chatId,
      text,
      ...options,
    });

    return response.result!;
  }

  /**
   * Send a photo
   */
  async sendPhoto(
    chatId: number | string,
    photo: string,
    options: {
      caption?: string;
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      caption_entities?: any[];
      disable_notification?: boolean;
      protect_content?: boolean;
      reply_to_message_id?: number;
      allow_sending_without_reply?: boolean;
      reply_markup?: TelegramInlineKeyboardMarkup;
    } = {},
  ): Promise<TelegramMessage> {
    const response = await this.makeRequest<TelegramMessage>('sendPhoto', {
      chat_id: chatId,
      photo,
      ...options,
    });

    return response.result!;
  }

  /**
   * Send a document
   */
  async sendDocument(
    chatId: number | string,
    document: string,
    options: {
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
    } = {},
  ): Promise<TelegramMessage> {
    const response = await this.makeRequest<TelegramMessage>('sendDocument', {
      chat_id: chatId,
      document,
      ...options,
    });

    return response.result!;
  }

  /**
   * Edit a message text
   */
  async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options: {
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      entities?: any[];
      disable_web_page_preview?: boolean;
      reply_markup?: TelegramInlineKeyboardMarkup;
    } = {},
  ): Promise<TelegramMessage | boolean> {
    const response = await this.makeRequest<TelegramMessage | boolean>('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options,
    });

    return response.result!;
  }

  /**
   * Delete a message
   */
  async deleteMessage(
    chatId: number | string,
    messageId: number,
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });

    return response.result!;
  }

  /**
   * Send chat action (typing, uploading, etc.)
   */
  async sendChatAction(
    chatId: number | string,
    action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'choose_sticker' | 'find_location' | 'record_video_note' | 'upload_video_note',
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('sendChatAction', {
      chat_id: chatId,
      action,
    });

    return response.result!;
  }

  /**
   * Answer callback query
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    options: {
      text?: string;
      show_alert?: boolean;
      url?: string;
      cache_time?: number;
    } = {},
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...options,
    });

    return response.result!;
  }

  /**
   * Get chat information
   */
  async getChat(chatId: number | string) {
    const response = await this.makeRequest('getChat', {
      chat_id: chatId,
    });

    return response.result!;
  }

  /**
   * Get chat member information
   */
  async getChatMember(chatId: number | string, userId: number) {
    const response = await this.makeRequest('getChatMember', {
      chat_id: chatId,
      user_id: userId,
    });

    return response.result!;
  }

  /**
   * Get chat administrators
   */
  async getChatAdministrators(chatId: number | string) {
    const response = await this.makeRequest('getChatAdministrators', {
      chat_id: chatId,
    });

    return response.result!;
  }

  /**
   * Get bot information
   */
  async getMe() {
    const response = await this.makeRequest('getMe');
    return response.result!;
  }

  /**
   * Set bot commands
   */
  async setMyCommands(
    commands: TelegramBotCommand[],
    options: {
      scope?: any;
      language_code?: string;
    } = {},
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('setMyCommands', {
      commands,
      ...options,
    });

    return response.result!;
  }

  /**
   * Get bot commands
   */
  async getMyCommands(options: {
    scope?: any;
    language_code?: string;
  } = {}): Promise<TelegramBotCommand[]> {
    const response = await this.makeRequest<TelegramBotCommand[]>('getMyCommands', options);
    return response.result!;
  }

  /**
   * Set webhook
   */
  async setWebhook(
    url: string,
    options: {
      certificate?: string;
      ip_address?: string;
      max_connections?: number;
      allowed_updates?: string[];
      drop_pending_updates?: boolean;
      secret_token?: string;
    } = {},
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('setWebhook', {
      url,
      ...options,
    });

    return response.result!;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(dropPendingUpdates?: boolean): Promise<boolean> {
    const response = await this.makeRequest<boolean>('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });

    return response.result!;
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo() {
    const response = await this.makeRequest('getWebhookInfo');
    return response.result!;
  }

  /**
   * Get updates (for polling)
   */
  async getUpdates(options: {
    offset?: number;
    limit?: number;
    timeout?: number;
    allowed_updates?: string[];
  } = {}): Promise<TelegramUpdate[]> {
    const response = await this.makeRequest<TelegramUpdate[]>('getUpdates', options);
    return response.result!;
  }

  /**
   * Forward a message
   */
  async forwardMessage(
    chatId: number | string,
    fromChatId: number | string,
    messageId: number,
    options: {
      disable_notification?: boolean;
      protect_content?: boolean;
    } = {},
  ): Promise<TelegramMessage> {
    const response = await this.makeRequest<TelegramMessage>('forwardMessage', {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
      ...options,
    });

    return response.result!;
  }

  /**
   * Copy a message
   */
  async copyMessage(
    chatId: number | string,
    fromChatId: number | string,
    messageId: number,
    options: {
      caption?: string;
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      caption_entities?: any[];
      disable_notification?: boolean;
      protect_content?: boolean;
      reply_to_message_id?: number;
      allow_sending_without_reply?: boolean;
      reply_markup?: TelegramInlineKeyboardMarkup;
    } = {},
  ): Promise<{ message_id: number }> {
    const response = await this.makeRequest<{ message_id: number }>('copyMessage', {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
      ...options,
    });

    return response.result!;
  }

  /**
   * Pin a chat message
   */
  async pinChatMessage(
    chatId: number | string,
    messageId: number,
    options: {
      disable_notification?: boolean;
    } = {},
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('pinChatMessage', {
      chat_id: chatId,
      message_id: messageId,
      ...options,
    });

    return response.result!;
  }

  /**
   * Unpin a chat message
   */
  async unpinChatMessage(
    chatId: number | string,
    messageId?: number,
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('unpinChatMessage', {
      chat_id: chatId,
      message_id: messageId,
    });

    return response.result!;
  }

  /**
   * Leave a chat
   */
  async leaveChat(chatId: number | string): Promise<boolean> {
    const response = await this.makeRequest<boolean>('leaveChat', {
      chat_id: chatId,
    });

    return response.result!;
  }

  /**
   * Export chat invite link
   */
  async exportChatInviteLink(chatId: number | string): Promise<string> {
    const response = await this.makeRequest<string>('exportChatInviteLink', {
      chat_id: chatId,
    });

    return response.result!;
  }

  /**
   * Create chat invite link
   */
  async createChatInviteLink(
    chatId: number | string,
    options: {
      name?: string;
      expire_date?: number;
      member_limit?: number;
      creates_join_request?: boolean;
    } = {},
  ) {
    const response = await this.makeRequest('createChatInviteLink', {
      chat_id: chatId,
      ...options,
    });

    return response.result!;
  }

  /**
   * Set chat description
   */
  async setChatDescription(
    chatId: number | string,
    description?: string,
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('setChatDescription', {
      chat_id: chatId,
      description,
    });

    return response.result!;
  }

  /**
   * Set chat title
   */
  async setChatTitle(
    chatId: number | string,
    title: string,
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('setChatTitle', {
      chat_id: chatId,
      title,
    });

    return response.result!;
  }

  /**
   * Restrict chat member
   */
  async restrictChatMember(
    chatId: number | string,
    userId: number,
    permissions: any,
    options: {
      until_date?: number;
    } = {},
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('restrictChatMember', {
      chat_id: chatId,
      user_id: userId,
      permissions,
      ...options,
    });

    return response.result!;
  }

  /**
   * Ban chat member
   */
  async banChatMember(
    chatId: number | string,
    userId: number,
    options: {
      until_date?: number;
      revoke_messages?: boolean;
    } = {},
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('banChatMember', {
      chat_id: chatId,
      user_id: userId,
      ...options,
    });

    return response.result!;
  }

  /**
   * Unban chat member
   */
  async unbanChatMember(
    chatId: number | string,
    userId: number,
    onlyIfBanned?: boolean,
  ): Promise<boolean> {
    const response = await this.makeRequest<boolean>('unbanChatMember', {
      chat_id: chatId,
      user_id: userId,
      only_if_banned: onlyIfBanned,
    });

    return response.result!;
  }

  /**
   * Download file
   */
  async downloadFile(fileId: string): Promise<ArrayBuffer> {
    // First get file info
    const fileInfoResponse = await this.makeRequest('getFile', {
      file_id: fileId,
    });

    const filePath = fileInfoResponse.result!.file_path;
    if (!filePath) {
      throw new Error('File path not available');
    }

    // Download the file
    const downloadUrl = `https://api.telegram.org/file/bot${this.token}/${filePath}`;
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  /**
   * Get file info
   */
  async getFile(fileId: string) {
    const response = await this.makeRequest('getFile', {
      file_id: fileId,
    });

    return response.result!;
  }
}

/**
 * Helper functions for creating inline keyboards
 */
export class InlineKeyboard {
  private keyboard: any[][] = [];

  /**
   * Add a row of buttons
   */
  row(...buttons: InlineKeyboardButton[]): InlineKeyboard {
    this.keyboard.push(buttons);
    return this;
  }

  /**
   * Add a single button on a new row
   */
  button(text: string, callbackData: string): InlineKeyboard {
    return this.row(new InlineKeyboardButton(text).callbackData(callbackData));
  }

  /**
   * Add a URL button on a new row
   */
  url(text: string, url: string): InlineKeyboard {
    return this.row(new InlineKeyboardButton(text).url(url));
  }

  /**
   * Build the keyboard markup
   */
  build(): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: this.keyboard,
    };
  }
}

/**
 * Helper class for creating inline keyboard buttons
 */
export class InlineKeyboardButton {
  private button: any = {};

  constructor(text: string) {
    this.button.text = text;
  }

  /**
   * Set callback data
   */
  callbackData(data: string): InlineKeyboardButton {
    this.button.callback_data = data;
    return this;
  }

  /**
   * Set URL
   */
  url(url: string): InlineKeyboardButton {
    this.button.url = url;
    return this;
  }

  /**
   * Set switch inline query
   */
  switchInlineQuery(query: string): InlineKeyboardButton {
    this.button.switch_inline_query = query;
    return this;
  }

  /**
   * Set switch inline query current chat
   */
  switchInlineQueryCurrentChat(query: string): InlineKeyboardButton {
    this.button.switch_inline_query_current_chat = query;
    return this;
  }

  /**
   * Build the button
   */
  build() {
    return this.button;
  }
}