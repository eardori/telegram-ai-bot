"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBotConfig = createBotConfig;
exports.validateConfig = validateConfig;
exports.getConfig = getConfig;
const environment_1 = require("./environment");
const database_1 = require("./database");
const llm_1 = require("./llm");
const telegram_1 = require("./telegram");
function createBotConfig() {
    const env = (0, environment_1.getEnvironmentConfig)();
    return {
        telegram: (0, telegram_1.getTelegramConfig)(env),
        database: (0, database_1.getDatabaseConfig)(env),
        llm: (0, llm_1.getLLMConfig)(env),
        app: {
            environment: env.NODE_ENV || 'development',
            logLevel: env.LOG_LEVEL || 'info',
            timezone: env.TIMEZONE || 'UTC',
            defaultLanguage: env.DEFAULT_LANGUAGE || 'en',
            maxMessageLength: 4096,
            rateLimiting: {
                enabled: true,
                maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS || '30', 10),
                windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || '60000', 10),
            },
            features: {
                summaryEnabled: env.SUMMARY_ENABLED?.toLowerCase() !== 'false',
                translationEnabled: env.TRANSLATION_ENABLED?.toLowerCase() === 'true',
                moderationEnabled: env.MODERATION_ENABLED?.toLowerCase() === 'true',
                analyticsEnabled: env.ANALYTICS_ENABLED?.toLowerCase() !== 'false',
            },
        },
        scheduler: {
            enabled: env.SCHEDULER_ENABLED?.toLowerCase() !== 'false',
            summaryIntervals: {
                hourly: true,
                daily: true,
                weekly: true,
                monthly: false,
            },
            timezone: env.SCHEDULER_TIMEZONE || env.TIMEZONE || 'UTC',
            batchSize: 50,
        },
    };
}
function validateConfig(config) {
    const errors = [];
    if (!config.telegram.botToken) {
        errors.push('TELEGRAM_BOT_TOKEN is required');
    }
    if (!config.database.url) {
        errors.push('SUPABASE_URL is required');
    }
    if (!config.database.apiKey) {
        errors.push('SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY is required');
    }
    if (!config.llm.apiKey) {
        errors.push(`${config.llm.provider.toUpperCase()}_API_KEY is required`);
    }
    if (!config.llm.model) {
        errors.push('LLM_MODEL is required');
    }
    if (!['development', 'staging', 'production'].includes(config.app.environment)) {
        errors.push('NODE_ENV must be development, staging, or production');
    }
    if (!['debug', 'info', 'warn', 'error'].includes(config.app.logLevel)) {
        errors.push('LOG_LEVEL must be debug, info, warn, or error');
    }
    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
}
function getConfig() {
    const config = createBotConfig();
    validateConfig(config);
    return config;
}
__exportStar(require("./environment"), exports);
__exportStar(require("./database"), exports);
__exportStar(require("./llm"), exports);
__exportStar(require("./telegram"), exports);
__exportStar(require("./constants"), exports);
//# sourceMappingURL=index.js.map