import type { Bot, Context } from 'grammy';
import type { BotConfig } from '../../../src/types';
import { DatabaseHelper } from '../utils/database';
export interface BotContextExtensions {
    config: BotConfig;
    db: DatabaseHelper;
    llm: any;
    user?: {
        id: string;
        telegramId: number;
        username?: string;
        firstName?: string;
        lastName?: string;
        languageCode?: string;
        isActive: boolean;
        role: 'user' | 'moderator' | 'admin' | 'owner';
        preferences: any;
    };
    chat?: {
        id: string;
        telegramId: number;
        type: 'private' | 'group' | 'supergroup' | 'channel';
        title?: string;
        username?: string;
        settings: any;
    };
    session?: {
        currentCommand?: string;
        step: number;
        data: Record<string, any>;
    };
    metrics: {
        startTime: number;
        processingTime?: number;
    };
}
export type BotContext = Context & BotContextExtensions;
export declare function setupBotMiddleware(bot: Bot, config: BotConfig): void;
export declare function setupBotCommands(bot: Bot, config: BotConfig): Promise<void>;
//# sourceMappingURL=index.d.ts.map