import type { EnvironmentVariables } from '../types';
export interface TelegramConfig {
    botToken: string;
    webhookUrl?: string;
    allowedUpdates?: string[];
    dropPendingUpdates?: boolean;
    apiOptions?: {
        baseUrl?: string;
        timeout?: number;
        retryAttempts?: number;
        retryDelay?: number;
    };
}
export declare function getTelegramConfig(env: EnvironmentVariables): TelegramConfig;
export declare function validateTelegramConfig(config: TelegramConfig): void;
export declare function getWebhookConfig(env: Environment): {
    url: any;
    maxConnections: number;
    allowedUpdates: string[];
    dropPendingUpdates: boolean;
};
export declare function getBotCommands(): {
    command: string;
    description: string;
}[];
export declare function getAllowedUpdates(environment: string): string[];
export declare function getTelegramRateLimits(): {
    messagesPerSecond: number;
    messagesPerMinute: number;
    messagesPerChat: number;
    webhookUpdatesPerSecond: number;
    maxFileSize: number;
    maxPhotoSize: number;
    maxVideoSize: number;
    maxAudioSize: number;
    maxDocumentSize: number;
};
export declare function getMessageFormatting(): {
    maxMessageLength: number;
    maxCaptionLength: number;
    allowedParseMode: string[];
    defaultParseMode: string;
};
export declare function getEnvironmentTelegramSettings(environment: string): {
    polling: boolean;
    webhook: boolean;
    dropPendingUpdates: boolean;
    allowedUpdates: string[];
    logUpdates: boolean;
};
export declare function getInlineKeyboardConfig(): {
    maxButtonsPerRow: number;
    maxRows: number;
    maxButtonTextLength: number;
    maxCallbackDataLength: number;
    maxUrlLength: number;
};
export declare function getFileTypeConfig(): {
    allowedImageTypes: string[];
    allowedVideoTypes: string[];
    allowedAudioTypes: string[];
    allowedDocumentTypes: string[];
};
export declare function getBotProfile(): {
    name: string;
    description: string;
    shortDescription: string;
    commands: {
        command: string;
        description: string;
    }[];
};
//# sourceMappingURL=telegram.d.ts.map