import type { Environment } from '../types';
export interface DatabaseConfig {
    url: string;
    apiKey: string;
    schema?: string;
    connectionOptions?: {
        poolSize?: number;
        timeout?: number;
        retryAttempts?: number;
        retryDelay?: number;
    };
}
export declare function getDatabaseConfig(env: Environment): DatabaseConfig;
export declare function validateDatabaseConfig(config: DatabaseConfig): void;
export declare function getDatabaseConnectionString(env: Environment): string;
export declare function getMigrationConfig(env: Environment): {
    database: DatabaseConfig;
    migrationsDirectory: string;
    seedDirectory: string;
    schemaDirectory: string;
};
export declare function getEnvironmentDatabaseSettings(environment: string): {
    logQueries: boolean;
    slowQueryThreshold: number;
    connectionOptions: {
        poolSize: number;
        timeout: number;
        retryAttempts: number;
    };
};
export declare const TABLES: {
    readonly USERS: "users";
    readonly CHATS: "chats";
    readonly MESSAGES: "messages";
    readonly SUMMARIES: "summaries";
    readonly BOT_COMMANDS: "bot_commands";
    readonly USER_SESSIONS: "user_sessions";
};
export declare const VIEWS: {
    readonly CHAT_STATISTICS: "chat_statistics";
    readonly USER_ACTIVITY: "user_activity";
};
export declare const FUNCTIONS: {
    readonly GET_CHAT_MESSAGES_IN_RANGE: "get_chat_messages_in_range";
    readonly CALCULATE_SUMMARY_STATS: "calculate_summary_stats";
};
//# sourceMappingURL=database.d.ts.map