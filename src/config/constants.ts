// Application Constants

// Bot Information
export const BOT_INFO = {
  NAME: 'AI Summary Bot',
  VERSION: '1.0.0',
  DESCRIPTION: 'An intelligent bot that provides chat summaries and analytics using advanced AI',
  AUTHOR: 'Multiful Team',
  REPOSITORY: 'https://github.com/multiful/bot-telegram',
} as const;

// Supported Languages
export const SUPPORTED_LANGUAGES = {
  EN: 'en',
  ES: 'es',
  FR: 'fr',
  DE: 'de',
  IT: 'it',
  PT: 'pt',
  RU: 'ru',
  ZH: 'zh',
  JA: 'ja',
  KO: 'ko',
} as const;

export const LANGUAGE_NAMES = {
  [SUPPORTED_LANGUAGES.EN]: 'English',
  [SUPPORTED_LANGUAGES.ES]: 'Español',
  [SUPPORTED_LANGUAGES.FR]: 'Français',
  [SUPPORTED_LANGUAGES.DE]: 'Deutsch',
  [SUPPORTED_LANGUAGES.IT]: 'Italiano',
  [SUPPORTED_LANGUAGES.PT]: 'Português',
  [SUPPORTED_LANGUAGES.RU]: 'Русский',
  [SUPPORTED_LANGUAGES.ZH]: '中文',
  [SUPPORTED_LANGUAGES.JA]: '日本語',
  [SUPPORTED_LANGUAGES.KO]: '한국어',
} as const;

// Default Settings
export const DEFAULTS = {
  LANGUAGE: SUPPORTED_LANGUAGES.EN,
  TIMEZONE: 'UTC',
  SUMMARY_FORMAT: 'detailed',
  MESSAGE_LIMIT: 4096,
  SUMMARY_MESSAGE_COUNT: 100,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
  RATE_LIMIT_MAX: 30, // 30 requests per minute
} as const;

// Summary Settings
export const SUMMARY_SETTINGS = {
  MIN_MESSAGES: 5,
  MAX_MESSAGES: 1000,
  DEFAULT_MESSAGE_COUNT: 50,
  FORMATS: ['brief', 'detailed', 'bullet_points'] as const,
  TYPES: ['hourly', 'daily', 'weekly', 'monthly', 'manual', 'event_based'] as const,
  MAX_LENGTH: {
    brief: 500,
    detailed: 2000,
    bullet_points: 1500,
  },
} as const;

// Message Types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  PHOTO: 'photo',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  STICKER: 'sticker',
  VOICE: 'voice',
  VIDEO_NOTE: 'video_note',
  LOCATION: 'location',
  CONTACT: 'contact',
  POLL: 'poll',
  DICE: 'dice',
  GAME: 'game',
  INVOICE: 'invoice',
  SUCCESSFUL_PAYMENT: 'successful_payment',
  CONNECTED_WEBSITE: 'connected_website',
  PASSPORT_DATA: 'passport_data',
  PROXIMITY_ALERT_TRIGGERED: 'proximity_alert_triggered',
  VIDEO_CHAT_SCHEDULED: 'video_chat_scheduled',
  VIDEO_CHAT_STARTED: 'video_chat_started',
  VIDEO_CHAT_ENDED: 'video_chat_ended',
  VIDEO_CHAT_PARTICIPANTS_INVITED: 'video_chat_participants_invited',
  WEB_APP_DATA: 'web_app_data',
  OTHER: 'other',
} as const;

// Chat Types
export const CHAT_TYPES = {
  PRIVATE: 'private',
  GROUP: 'group',
  SUPERGROUP: 'supergroup',
  CHANNEL: 'channel',
} as const;

// User Roles
export const USER_ROLES = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  OWNER: 'owner',
} as const;

// Command Categories
export const COMMAND_CATEGORIES = {
  GENERAL: 'general',
  ADMIN: 'admin',
  MODERATION: 'moderation',
  SUMMARY: 'summary',
  SETTINGS: 'settings',
  ANALYTICS: 'analytics',
  HELP: 'help',
} as const;

// Error Codes
export const ERROR_CODES = {
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  
  // Telegram API errors
  TELEGRAM_API_ERROR: 'TELEGRAM_API_ERROR',
  BOT_BLOCKED: 'BOT_BLOCKED',
  CHAT_NOT_FOUND: 'CHAT_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  INVALID_BOT_TOKEN: 'INVALID_BOT_TOKEN',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  QUERY_ERROR: 'QUERY_ERROR',
  CONSTRAINT_ERROR: 'CONSTRAINT_ERROR',
  
  // LLM API errors
  LLM_API_ERROR: 'LLM_API_ERROR',
  INVALID_API_KEY: 'INVALID_API_KEY',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  MODEL_OVERLOADED: 'MODEL_OVERLOADED',
  CONTENT_FILTERED: 'CONTENT_FILTERED',
  
  // Processing errors
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  PARSING_ERROR: 'PARSING_ERROR',
  ENCODING_ERROR: 'ENCODING_ERROR',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Cache Keys
export const CACHE_KEYS = {
  USER_SESSION: (userId: string) => `session:${userId}`,
  CHAT_SETTINGS: (chatId: string) => `settings:${chatId}`,
  USER_PREFERENCES: (userId: string) => `prefs:${userId}`,
  RATE_LIMIT: (key: string) => `ratelimit:${key}`,
  SUMMARY_CACHE: (chatId: string, type: string) => `summary:${chatId}:${type}`,
  MESSAGE_COUNT: (chatId: string) => `count:${chatId}`,
  HEALTH_CHECK: 'healthcheck',
} as const;

// Webhook Paths
export const WEBHOOK_PATHS = {
  TELEGRAM: '/webhook/telegram',
  HEALTH: '/health',
  READY: '/ready',
  METRICS: '/metrics',
} as const;

// Scheduler Intervals
export const SCHEDULER_INTERVALS = {
  HOURLY: '0 * * * *', // Every hour
  DAILY: '0 0 * * *', // Every day at midnight
  WEEKLY: '0 0 * * 0', // Every Sunday at midnight
  MONTHLY: '0 0 1 * *', // First day of every month at midnight
  CLEANUP: '0 2 * * *', // Every day at 2 AM
  HEALTH_CHECK: '*/5 * * * *', // Every 5 minutes
} as const;

// File Size Limits (in bytes)
export const FILE_SIZE_LIMITS = {
  PHOTO: 10 * 1024 * 1024, // 10MB
  VIDEO: 50 * 1024 * 1024, // 50MB
  AUDIO: 50 * 1024 * 1024, // 50MB
  DOCUMENT: 50 * 1024 * 1024, // 50MB
  VOICE: 50 * 1024 * 1024, // 50MB
} as const;

// Regular Expressions
export const REGEX_PATTERNS = {
  BOT_TOKEN: /^\d{8,10}:[A-Za-z0-9_-]{35}$/,
  URL: /^https?:\/\/[^\s]+$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USERNAME: /^@?[a-zA-Z0-9_]{5,32}$/,
  LANGUAGE_CODE: /^[a-z]{2}(-[A-Z]{2})?$/,
  TIMEZONE: /^[A-Za-z_]+\/[A-Za-z_]+$/,
  COMMAND: /^\/[a-z0-9_]+(@[a-zA-Z0-9_]+)?$/,
} as const;

// Date Formats
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DATE_ONLY: 'YYYY-MM-DD',
  TIME_ONLY: 'HH:mm:ss',
  HUMAN_READABLE: 'MMMM D, YYYY [at] h:mm A',
  COMPACT: 'MM/DD/YY HH:mm',
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  SUMMARY_ENABLED: 'summary_enabled',
  TRANSLATION_ENABLED: 'translation_enabled',
  MODERATION_ENABLED: 'moderation_enabled',
  ANALYTICS_ENABLED: 'analytics_enabled',
  SCHEDULER_ENABLED: 'scheduler_enabled',
  INLINE_MODE_ENABLED: 'inline_mode_enabled',
  WEBHOOK_SECURITY: 'webhook_security',
  RATE_LIMITING: 'rate_limiting',
  CACHING: 'caching',
  LOGGING: 'logging',
} as const;

// Environment Variables
export const ENV_VARS = {
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  
  // Telegram
  TELEGRAM_BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',
  TELEGRAM_WEBHOOK_URL: 'TELEGRAM_WEBHOOK_URL',
  
  // Database
  SUPABASE_URL: 'SUPABASE_URL',
  SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY',
  SUPABASE_SERVICE_KEY: 'SUPABASE_SERVICE_KEY',
  
  // LLM Providers
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  GOOGLE_API_KEY: 'GOOGLE_API_KEY',
  AZURE_OPENAI_API_KEY: 'AZURE_OPENAI_API_KEY',
  HUGGINGFACE_API_KEY: 'HUGGINGFACE_API_KEY',
  LLM_PROVIDER: 'LLM_PROVIDER',
  LLM_MODEL: 'LLM_MODEL',
  
  // Application
  LOG_LEVEL: 'LOG_LEVEL',
  TIMEZONE: 'TIMEZONE',
  DEFAULT_LANGUAGE: 'DEFAULT_LANGUAGE',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  BOT_STARTED: 'Bot started successfully',
  WEBHOOK_SET: 'Webhook set successfully',
  SUMMARY_GENERATED: 'Summary generated successfully',
  SETTINGS_UPDATED: 'Settings updated successfully',
  LANGUAGE_CHANGED: 'Language changed successfully',
  PREFERENCES_SAVED: 'Preferences saved successfully',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  INTERNAL_ERROR: 'An internal error occurred. Please try again later.',
  INVALID_COMMAND: 'Invalid command. Use /help to see available commands.',
  UNAUTHORIZED_ACCESS: 'You are not authorized to use this command.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait and try again.',
  FEATURE_DISABLED: 'This feature is currently disabled.',
  CHAT_NOT_SUPPORTED: 'This command is not supported in this chat type.',
  INSUFFICIENT_MESSAGES: 'Not enough messages to generate a summary.',
  PROCESSING_FAILED: 'Failed to process your request. Please try again.',
} as const;