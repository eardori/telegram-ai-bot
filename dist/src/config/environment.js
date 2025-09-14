"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvironmentConfig = getEnvironmentConfig;
exports.isDevelopment = isDevelopment;
exports.isProduction = isProduction;
exports.isStaging = isStaging;
exports.getEnvironment = getEnvironment;
exports.validateEnvironment = validateEnvironment;
exports.loadEnvironment = loadEnvironment;
exports.getEnvironmentOverrides = getEnvironmentOverrides;
function getEnvironmentConfig() {
    return {
        NODE_ENV: process.env.NODE_ENV || 'development',
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
        TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL,
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
        HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
        LLM_PROVIDER: process.env.LLM_PROVIDER || 'anthropic',
        LLM_MODEL: process.env.LLM_MODEL || process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        TIMEZONE: process.env.TIMEZONE || 'UTC',
        DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE || 'en',
        RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
        RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
        SUMMARY_ENABLED: process.env.SUMMARY_ENABLED,
        TRANSLATION_ENABLED: process.env.TRANSLATION_ENABLED,
        MODERATION_ENABLED: process.env.MODERATION_ENABLED,
        ANALYTICS_ENABLED: process.env.ANALYTICS_ENABLED,
        SCHEDULER_ENABLED: process.env.SCHEDULER_ENABLED,
        SCHEDULER_TIMEZONE: process.env.SCHEDULER_TIMEZONE,
    };
}
function isDevelopment() {
    return process.env.NODE_ENV === 'development';
}
function isProduction() {
    return process.env.NODE_ENV === 'production';
}
function isStaging() {
    return process.env.NODE_ENV === 'staging';
}
function getEnvironment() {
    return process.env.NODE_ENV || 'development';
}
function validateEnvironment() {
    const env = getEnvironmentConfig();
    const errors = [];
    const requiredVars = [
        'TELEGRAM_BOT_TOKEN',
        'SUPABASE_URL',
        'LLM_MODEL',
    ];
    for (const varName of requiredVars) {
        if (!env[varName]) {
            errors.push(`${varName} is required`);
        }
    }
    if (!env.SUPABASE_ANON_KEY && !env.SUPABASE_SERVICE_KEY) {
        errors.push('Either SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY is required');
    }
    const llmProvider = env.LLM_PROVIDER;
    switch (llmProvider) {
        case 'openai':
            if (!env.OPENAI_API_KEY) {
                errors.push('OPENAI_API_KEY is required for OpenAI provider');
            }
            break;
        case 'anthropic':
            if (!env.ANTHROPIC_API_KEY) {
                errors.push('ANTHROPIC_API_KEY is required for Anthropic provider');
            }
            break;
        case 'google':
            if (!env.GOOGLE_API_KEY) {
                errors.push('GOOGLE_API_KEY is required for Google provider');
            }
            break;
        case 'azure':
            if (!env.AZURE_OPENAI_API_KEY) {
                errors.push('AZURE_OPENAI_API_KEY is required for Azure provider');
            }
            break;
        case 'huggingface':
            if (!env.HUGGINGFACE_API_KEY) {
                errors.push('HUGGINGFACE_API_KEY is required for HuggingFace provider');
            }
            break;
        case 'ollama':
            break;
        default:
            errors.push(`Unsupported LLM provider: ${llmProvider}`);
    }
    if (errors.length > 0) {
        throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }
}
function loadEnvironment() {
    if (isDevelopment()) {
        try {
            const dotenv = require('dotenv');
            dotenv.config();
        }
        catch (error) {
            console.warn('dotenv not available, skipping .env file loading');
        }
    }
}
function getEnvironmentOverrides() {
    const environment = getEnvironment();
    switch (environment) {
        case 'development':
            return {
                LOG_LEVEL: 'debug',
                SCHEDULER_ENABLED: 'false',
                ANALYTICS_ENABLED: 'false',
            };
        case 'staging':
            return {
                LOG_LEVEL: 'info',
                SCHEDULER_ENABLED: 'true',
                ANALYTICS_ENABLED: 'true',
            };
        case 'production':
            return {
                LOG_LEVEL: 'warn',
                SCHEDULER_ENABLED: 'true',
                ANALYTICS_ENABLED: 'true',
            };
        default:
            return {};
    }
}
//# sourceMappingURL=environment.js.map