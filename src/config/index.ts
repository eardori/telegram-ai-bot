// Configuration Index

import { BotConfig } from '../types/bot';
import { getEnvironmentConfig } from './environment';
import { getDatabaseConfig } from './database';
import { getLLMConfig } from './llm';
import { getTelegramConfig } from './telegram';

/**
 * Main configuration factory function
 * Combines all configuration modules into a single BotConfig
 */
export function createBotConfig(): BotConfig {
  const env = getEnvironmentConfig();
  
  return {
    telegram: getTelegramConfig(env),
    database: getDatabaseConfig(env),
    llm: getLLMConfig(env),
    app: {
      environment: env.NODE_ENV || 'development',
      logLevel: env.LOG_LEVEL || 'info',
      timezone: env.TIMEZONE || 'UTC',
      defaultLanguage: env.DEFAULT_LANGUAGE || 'en',
      maxMessageLength: 4096,
      rateLimiting: {
        enabled: true,
        maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS || '30', 10),
        windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
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

/**
 * Validate the complete configuration
 */
export function validateConfig(config: BotConfig): void {
  const errors: string[] = [];

  // Validate Telegram config
  if (!config.telegram.botToken) {
    errors.push('TELEGRAM_BOT_TOKEN is required');
  }

  // Validate database config
  if (!config.database.url) {
    errors.push('SUPABASE_URL is required');
  }
  if (!config.database.apiKey) {
    errors.push('SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY is required');
  }

  // Validate LLM config
  if (!config.llm.apiKey) {
    errors.push(`${config.llm.provider.toUpperCase()}_API_KEY is required`);
  }
  if (!config.llm.model) {
    errors.push('LLM_MODEL is required');
  }

  // Validate app config
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

/**
 * Get configuration with validation
 */
export function getConfig(): BotConfig {
  const config = createBotConfig();
  validateConfig(config);
  return config;
}

// Export individual config modules for direct access
export * from './environment';
export * from './database';
export * from './llm';
export * from './telegram';
export * from './constants';