// Environment Configuration

import type { EnvironmentVariables } from '../types';

/**
 * Get and validate environment variables
 */
export function getEnvironmentConfig(): EnvironmentVariables {
  return {
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    
    // Telegram Configuration
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL,
    
    // Database Configuration
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
    
    // LLM Configuration
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
    
    LLM_PROVIDER: (process.env.LLM_PROVIDER as any) || 'anthropic',
    LLM_MODEL: process.env.LLM_MODEL || process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
    
    // Application Configuration
    LOG_LEVEL: (process.env.LOG_LEVEL as any) || 'info',
    TIMEZONE: process.env.TIMEZONE || 'UTC',
    DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE || 'en',
    
    // Rate Limiting
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
    
    // Feature Flags
    SUMMARY_ENABLED: process.env.SUMMARY_ENABLED,
    TRANSLATION_ENABLED: process.env.TRANSLATION_ENABLED,
    MODERATION_ENABLED: process.env.MODERATION_ENABLED,
    ANALYTICS_ENABLED: process.env.ANALYTICS_ENABLED,
    
    // Scheduler Configuration
    SCHEDULER_ENABLED: process.env.SCHEDULER_ENABLED,
    SCHEDULER_TIMEZONE: process.env.SCHEDULER_TIMEZONE,
  };
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if we're in staging mode
 */
export function isStaging(): boolean {
  return process.env.NODE_ENV === 'staging';
}

/**
 * Get the current environment name
 */
export function getEnvironment(): 'development' | 'staging' | 'production' {
  return (process.env.NODE_ENV as any) || 'development';
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): void {
  const env = getEnvironmentConfig();
  const errors: string[] = [];

  // Required variables
  const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'SUPABASE_URL',
    'LLM_MODEL',
  ];

  for (const varName of requiredVars) {
    if (!env[varName as keyof Environment]) {
      errors.push(`${varName} is required`);
    }
  }

  // At least one database key is required
  if (!env.SUPABASE_ANON_KEY && !env.SUPABASE_SERVICE_KEY) {
    errors.push('Either SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY is required');
  }

  // At least one LLM API key based on provider
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
      // Ollama doesn't require an API key
      break;
    default:
      errors.push(`Unsupported LLM provider: ${llmProvider}`);
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Load environment variables from .env file in development
 */
export function loadEnvironment(): void {
  if (isDevelopment()) {
    try {
      // Try to load dotenv if available
      const dotenv = require('dotenv');
      dotenv.config();
    } catch (error) {
      // dotenv is optional, continue without it
      console.warn('dotenv not available, skipping .env file loading');
    }
  }
}

/**
 * Get environment-specific configuration overrides
 */
export function getEnvironmentOverrides(): Partial<Environment> {
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