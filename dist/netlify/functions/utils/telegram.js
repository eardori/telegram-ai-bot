"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineKeyboardButton = exports.InlineKeyboard = exports.TelegramBot = void 0;
class TelegramBot {
    constructor(config) {
        this.token = config.botToken;
        this.baseUrl = `${config.apiOptions?.baseUrl || 'https://api.telegram.org'}/bot${this.token}`;
    }
    async makeRequest(method, params) {
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
    async sendMessage(chatId, text, options = {}) {
        const response = await this.makeRequest('sendMessage', {
            chat_id: chatId,
            text,
            ...options,
        });
        return response.result;
    }
    async sendPhoto(chatId, photo, options = {}) {
        const response = await this.makeRequest('sendPhoto', {
            chat_id: chatId,
            photo,
            ...options,
        });
        return response.result;
    }
    async sendDocument(chatId, document, options = {}) {
        const response = await this.makeRequest('sendDocument', {
            chat_id: chatId,
            document,
            ...options,
        });
        return response.result;
    }
    async editMessageText(chatId, messageId, text, options = {}) {
        const response = await this.makeRequest('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text,
            ...options,
        });
        return response.result;
    }
    async deleteMessage(chatId, messageId) {
        const response = await this.makeRequest('deleteMessage', {
            chat_id: chatId,
            message_id: messageId,
        });
        return response.result;
    }
    async sendChatAction(chatId, action) {
        const response = await this.makeRequest('sendChatAction', {
            chat_id: chatId,
            action,
        });
        return response.result;
    }
    async answerCallbackQuery(callbackQueryId, options = {}) {
        const response = await this.makeRequest('answerCallbackQuery', {
            callback_query_id: callbackQueryId,
            ...options,
        });
        return response.result;
    }
    async getChat(chatId) {
        const response = await this.makeRequest('getChat', {
            chat_id: chatId,
        });
        return response.result;
    }
    async getChatMember(chatId, userId) {
        const response = await this.makeRequest('getChatMember', {
            chat_id: chatId,
            user_id: userId,
        });
        return response.result;
    }
    async getChatAdministrators(chatId) {
        const response = await this.makeRequest('getChatAdministrators', {
            chat_id: chatId,
        });
        return response.result;
    }
    async getMe() {
        const response = await this.makeRequest('getMe');
        return response.result;
    }
    async setMyCommands(commands, options = {}) {
        const response = await this.makeRequest('setMyCommands', {
            commands,
            ...options,
        });
        return response.result;
    }
    async getMyCommands(options = {}) {
        const response = await this.makeRequest('getMyCommands', options);
        return response.result;
    }
    async setWebhook(url, options = {}) {
        const response = await this.makeRequest('setWebhook', {
            url,
            ...options,
        });
        return response.result;
    }
    async deleteWebhook(dropPendingUpdates) {
        const response = await this.makeRequest('deleteWebhook', {
            drop_pending_updates: dropPendingUpdates,
        });
        return response.result;
    }
    async getWebhookInfo() {
        const response = await this.makeRequest('getWebhookInfo');
        return response.result;
    }
    async getUpdates(options = {}) {
        const response = await this.makeRequest('getUpdates', options);
        return response.result;
    }
    async forwardMessage(chatId, fromChatId, messageId, options = {}) {
        const response = await this.makeRequest('forwardMessage', {
            chat_id: chatId,
            from_chat_id: fromChatId,
            message_id: messageId,
            ...options,
        });
        return response.result;
    }
    async copyMessage(chatId, fromChatId, messageId, options = {}) {
        const response = await this.makeRequest('copyMessage', {
            chat_id: chatId,
            from_chat_id: fromChatId,
            message_id: messageId,
            ...options,
        });
        return response.result;
    }
    async pinChatMessage(chatId, messageId, options = {}) {
        const response = await this.makeRequest('pinChatMessage', {
            chat_id: chatId,
            message_id: messageId,
            ...options,
        });
        return response.result;
    }
    async unpinChatMessage(chatId, messageId) {
        const response = await this.makeRequest('unpinChatMessage', {
            chat_id: chatId,
            message_id: messageId,
        });
        return response.result;
    }
    async leaveChat(chatId) {
        const response = await this.makeRequest('leaveChat', {
            chat_id: chatId,
        });
        return response.result;
    }
    async exportChatInviteLink(chatId) {
        const response = await this.makeRequest('exportChatInviteLink', {
            chat_id: chatId,
        });
        return response.result;
    }
    async createChatInviteLink(chatId, options = {}) {
        const response = await this.makeRequest('createChatInviteLink', {
            chat_id: chatId,
            ...options,
        });
        return response.result;
    }
    async setChatDescription(chatId, description) {
        const response = await this.makeRequest('setChatDescription', {
            chat_id: chatId,
            description,
        });
        return response.result;
    }
    async setChatTitle(chatId, title) {
        const response = await this.makeRequest('setChatTitle', {
            chat_id: chatId,
            title,
        });
        return response.result;
    }
    async restrictChatMember(chatId, userId, permissions, options = {}) {
        const response = await this.makeRequest('restrictChatMember', {
            chat_id: chatId,
            user_id: userId,
            permissions,
            ...options,
        });
        return response.result;
    }
    async banChatMember(chatId, userId, options = {}) {
        const response = await this.makeRequest('banChatMember', {
            chat_id: chatId,
            user_id: userId,
            ...options,
        });
        return response.result;
    }
    async unbanChatMember(chatId, userId, onlyIfBanned) {
        const response = await this.makeRequest('unbanChatMember', {
            chat_id: chatId,
            user_id: userId,
            only_if_banned: onlyIfBanned,
        });
        return response.result;
    }
    async downloadFile(fileId) {
        const fileInfoResponse = await this.makeRequest('getFile', {
            file_id: fileId,
        });
        const filePath = fileInfoResponse.result.file_path;
        if (!filePath) {
            throw new Error('File path not available');
        }
        const downloadUrl = `https://api.telegram.org/file/bot${this.token}/${filePath}`;
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
        }
        return response.arrayBuffer();
    }
    async getFile(fileId) {
        const response = await this.makeRequest('getFile', {
            file_id: fileId,
        });
        return response.result;
    }
}
exports.TelegramBot = TelegramBot;
class InlineKeyboard {
    constructor() {
        this.keyboard = [];
    }
    row(...buttons) {
        this.keyboard.push(buttons);
        return this;
    }
    button(text, callbackData) {
        return this.row(new InlineKeyboardButton(text).callbackData(callbackData));
    }
    url(text, url) {
        return this.row(new InlineKeyboardButton(text).url(url));
    }
    build() {
        return {
            inline_keyboard: this.keyboard,
        };
    }
}
exports.InlineKeyboard = InlineKeyboard;
class InlineKeyboardButton {
    constructor(text) {
        this.button = {};
        this.button.text = text;
    }
    callbackData(data) {
        this.button.callback_data = data;
        return this;
    }
    url(url) {
        this.button.url = url;
        return this;
    }
    switchInlineQuery(query) {
        this.button.switch_inline_query = query;
        return this;
    }
    switchInlineQueryCurrentChat(query) {
        this.button.switch_inline_query_current_chat = query;
        return this;
    }
    build() {
        return this.button;
    }
}
exports.InlineKeyboardButton = InlineKeyboardButton;
//# sourceMappingURL=telegram.js.map