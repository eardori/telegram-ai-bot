"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FUNCTIONS = exports.VIEWS = exports.TABLES = void 0;
exports.getDatabaseConfig = getDatabaseConfig;
exports.validateDatabaseConfig = validateDatabaseConfig;
exports.getDatabaseConnectionString = getDatabaseConnectionString;
exports.getMigrationConfig = getMigrationConfig;
exports.getEnvironmentDatabaseSettings = getEnvironmentDatabaseSettings;
function getDatabaseConfig(env) {
    const apiKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY;
    if (!apiKey) {
        throw new Error('Either SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY must be provided');
    }
    return {
        url: env.SUPABASE_URL,
        apiKey,
        schema: 'public',
        connectionOptions: {
            poolSize: 10,
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
        },
    };
}
function validateDatabaseConfig(config) {
    const errors = [];
    if (!config.url) {
        errors.push('Database URL is required');
    }
    else if (!isValidUrl(config.url)) {
        errors.push('Database URL must be a valid URL');
    }
    if (!config.apiKey) {
        errors.push('Database API key is required');
    }
    if (config.connectionOptions) {
        const { poolSize, timeout, retryAttempts, retryDelay } = config.connectionOptions;
        if (poolSize && (poolSize < 1 || poolSize > 100)) {
            errors.push('Pool size must be between 1 and 100');
        }
        if (timeout && (timeout < 1000 || timeout > 300000)) {
            errors.push('Timeout must be between 1000ms and 300000ms');
        }
        if (retryAttempts && (retryAttempts < 0 || retryAttempts > 10)) {
            errors.push('Retry attempts must be between 0 and 10');
        }
        if (retryDelay && (retryDelay < 100 || retryDelay > 10000)) {
            errors.push('Retry delay must be between 100ms and 10000ms');
        }
    }
    if (errors.length > 0) {
        throw new Error(`Database configuration validation failed:\n${errors.join('\n')}`);
    }
}
function getDatabaseConnectionString(env) {
    const config = getDatabaseConfig(env);
    return config.url;
}
function getMigrationConfig(env) {
    return {
        database: getDatabaseConfig(env),
        migrationsDirectory: './sql/migrations',
        seedDirectory: './sql/seeds',
        schemaDirectory: './sql/schema',
    };
}
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
function getEnvironmentDatabaseSettings(environment) {
    switch (environment) {
        case 'development':
            return {
                logQueries: true,
                slowQueryThreshold: 1000,
                connectionOptions: {
                    poolSize: 5,
                    timeout: 30000,
                    retryAttempts: 2,
                },
            };
        case 'staging':
            return {
                logQueries: false,
                slowQueryThreshold: 2000,
                connectionOptions: {
                    poolSize: 8,
                    timeout: 25000,
                    retryAttempts: 3,
                },
            };
        case 'production':
            return {
                logQueries: false,
                slowQueryThreshold: 5000,
                connectionOptions: {
                    poolSize: 15,
                    timeout: 20000,
                    retryAttempts: 3,
                },
            };
        default:
            return {
                logQueries: false,
                slowQueryThreshold: 3000,
                connectionOptions: {
                    poolSize: 10,
                    timeout: 30000,
                    retryAttempts: 3,
                },
            };
    }
}
exports.TABLES = {
    USERS: 'users',
    CHATS: 'chats',
    MESSAGES: 'messages',
    SUMMARIES: 'summaries',
    BOT_COMMANDS: 'bot_commands',
    USER_SESSIONS: 'user_sessions',
};
exports.VIEWS = {
    CHAT_STATISTICS: 'chat_statistics',
    USER_ACTIVITY: 'user_activity',
};
exports.FUNCTIONS = {
    GET_CHAT_MESSAGES_IN_RANGE: 'get_chat_messages_in_range',
    CALCULATE_SUMMARY_STATS: 'calculate_summary_stats',
};
//# sourceMappingURL=database.js.map