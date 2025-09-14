"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTelegramConfig = getTelegramConfig;
exports.validateTelegramConfig = validateTelegramConfig;
exports.getWebhookConfig = getWebhookConfig;
exports.getBotCommands = getBotCommands;
exports.getAllowedUpdates = getAllowedUpdates;
exports.getTelegramRateLimits = getTelegramRateLimits;
exports.getMessageFormatting = getMessageFormatting;
exports.getEnvironmentTelegramSettings = getEnvironmentTelegramSettings;
exports.getInlineKeyboardConfig = getInlineKeyboardConfig;
exports.getFileTypeConfig = getFileTypeConfig;
exports.getBotProfile = getBotProfile;
function getTelegramConfig(env) {
    return {
        botToken: env.TELEGRAM_BOT_TOKEN,
        webhookUrl: env.TELEGRAM_WEBHOOK_URL,
        allowedUpdates: [
            'message',
            'edited_message',
            'callback_query',
            'inline_query',
            'chosen_inline_result',
            'channel_post',
            'edited_channel_post',
        ],
        dropPendingUpdates: env.NODE_ENV === 'production',
        apiOptions: {
            baseUrl: 'https://api.telegram.org',
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
        },
    };
}
function validateTelegramConfig(config) {
    const errors = [];
    if (!config.botToken) {
        errors.push('Bot token is required');
    }
    else if (!isValidBotToken(config.botToken)) {
        errors.push('Bot token format is invalid');
    }
    if (config.webhookUrl && !isValidUrl(config.webhookUrl)) {
        errors.push('Webhook URL must be a valid HTTPS URL');
    }
    if (config.apiOptions) {
        const { timeout, retryAttempts, retryDelay } = config.apiOptions;
        if (timeout && (timeout < 1000 || timeout > 300000)) {
            errors.push('API timeout must be between 1000ms and 300000ms');
        }
        if (retryAttempts && (retryAttempts < 0 || retryAttempts > 10)) {
            errors.push('API retry attempts must be between 0 and 10');
        }
        if (retryDelay && (retryDelay < 100 || retryDelay > 10000)) {
            errors.push('API retry delay must be between 100ms and 10000ms');
        }
    }
    if (errors.length > 0) {
        throw new Error(`Telegram configuration validation failed:\n${errors.join('\n')}`);
    }
}
function getWebhookConfig(env) {
    return {
        url: env.TELEGRAM_WEBHOOK_URL,
        maxConnections: 40,
        allowedUpdates: [
            'message',
            'edited_message',
            'callback_query',
        ],
        dropPendingUpdates: env.NODE_ENV === 'production',
    };
}
function getBotCommands() {
    return [
        {
            command: 'start',
            description: 'Start the bot and get welcome message',
        },
        {
            command: 'help',
            description: 'Show available commands and help information',
        },
        {
            command: 'settings',
            description: 'Configure bot settings and preferences',
        },
        {
            command: 'summary',
            description: 'Generate a summary of recent chat messages',
        },
        {
            command: 'stats',
            description: 'Show chat statistics and analytics',
        },
        {
            command: 'lang',
            description: 'Change language settings',
        },
        {
            command: 'privacy',
            description: 'View privacy policy and data usage',
        },
        {
            command: 'feedback',
            description: 'Send feedback to the bot developers',
        },
    ];
}
function getAllowedUpdates(environment) {
    const baseUpdates = [
        'message',
        'edited_message',
        'callback_query',
    ];
    switch (environment) {
        case 'development':
            return [
                ...baseUpdates,
                'inline_query',
                'chosen_inline_result',
                'channel_post',
                'edited_channel_post',
                'poll',
                'poll_answer',
            ];
        case 'staging':
            return [
                ...baseUpdates,
                'channel_post',
                'edited_channel_post',
            ];
        case 'production':
            return baseUpdates;
        default:
            return baseUpdates;
    }
}
function getTelegramRateLimits() {
    return {
        messagesPerSecond: 30,
        messagesPerMinute: 20,
        messagesPerChat: 1,
        webhookUpdatesPerSecond: 100,
        maxFileSize: 50 * 1024 * 1024,
        maxPhotoSize: 10 * 1024 * 1024,
        maxVideoSize: 50 * 1024 * 1024,
        maxAudioSize: 50 * 1024 * 1024,
        maxDocumentSize: 50 * 1024 * 1024,
    };
}
function getMessageFormatting() {
    return {
        maxMessageLength: 4096,
        maxCaptionLength: 1024,
        allowedParseMode: ['HTML', 'Markdown', 'MarkdownV2'],
        defaultParseMode: 'HTML',
    };
}
function getEnvironmentTelegramSettings(environment) {
    switch (environment) {
        case 'development':
            return {
                polling: true,
                webhook: false,
                dropPendingUpdates: false,
                allowedUpdates: getAllowedUpdates('development'),
                logUpdates: true,
            };
        case 'staging':
            return {
                polling: false,
                webhook: true,
                dropPendingUpdates: true,
                allowedUpdates: getAllowedUpdates('staging'),
                logUpdates: true,
            };
        case 'production':
            return {
                polling: false,
                webhook: true,
                dropPendingUpdates: true,
                allowedUpdates: getAllowedUpdates('production'),
                logUpdates: false,
            };
        default:
            return {
                polling: true,
                webhook: false,
                dropPendingUpdates: false,
                allowedUpdates: getAllowedUpdates('development'),
                logUpdates: true,
            };
    }
}
function isValidBotToken(token) {
    const tokenRegex = /^\d{8,10}:[A-Za-z0-9_-]{35}$/;
    return tokenRegex.test(token);
}
function isValidUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === 'https:';
    }
    catch {
        return false;
    }
}
function getInlineKeyboardConfig() {
    return {
        maxButtonsPerRow: 8,
        maxRows: 100,
        maxButtonTextLength: 64,
        maxCallbackDataLength: 64,
        maxUrlLength: 256,
    };
}
function getFileTypeConfig() {
    return {
        allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        allowedVideoTypes: ['video/mp4', 'video/mpeg', 'video/quicktime'],
        allowedAudioTypes: ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'],
        allowedDocumentTypes: [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
    };
}
function getBotProfile() {
    return {
        name: 'AI Summary Bot',
        description: 'An intelligent bot that provides chat summaries and analytics using advanced AI',
        shortDescription: 'AI-powered chat summary bot',
        commands: getBotCommands(),
    };
}
//# sourceMappingURL=telegram.js.map