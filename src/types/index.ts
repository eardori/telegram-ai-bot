// Type Exports

// Re-export all types from individual modules
export * from './telegram';
export * from './database';
export * from './llm';
export * from './bot';

// Common utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type Nullable<T> = T | null;
export type Maybe<T> = T | undefined;
export type AsyncResult<T> = Promise<Result<T>>;

export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}

// Environment types
export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'staging' | 'production';
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_URL?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  AZURE_OPENAI_API_KEY?: string;
  HUGGINGFACE_API_KEY?: string;
  LLM_PROVIDER: 'openai' | 'anthropic' | 'google' | 'azure' | 'huggingface' | 'ollama';
  LLM_MODEL: string;
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  TIMEZONE?: string;
  DEFAULT_LANGUAGE?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  SUMMARY_ENABLED?: string;
  TRANSLATION_ENABLED?: string;
  MODERATION_ENABLED?: string;
  ANALYTICS_ENABLED?: string;
  SCHEDULER_ENABLED?: string;
  SCHEDULER_TIMEZONE?: string;
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Cache types
export interface CacheItem<T> {
  key: string;
  value: T;
  expiresAt: Date;
  createdAt: Date;
}

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number;
  checkPeriod: number; // Cleanup interval in milliseconds
}

// Logger types
export interface LogContext {
  userId?: string;
  chatId?: string;
  messageId?: number;
  command?: string;
  requestId?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  context?: LogContext;
  error?: Error;
  metadata?: Record<string, any>;
}

// Rate limiting types
export interface RateLimit {
  key: string;
  points: number;
  windowMs: number;
  maxHits: number;
  remainingPoints: number;
  resetTime: Date;
}

export interface RateLimitConfig {
  keyGenerator: (context: any) => string;
  points: number;
  duration: number;
  blockDuration?: number;
  execEvenly?: boolean;
}

// Localization types
export interface LocalizationKey {
  key: string;
  namespace?: string;
  defaultValue?: string;
  interpolation?: Record<string, any>;
}

export interface Translation {
  [key: string]: string | Translation;
}

export interface LocalizationConfig {
  defaultLanguage: string;
  supportedLanguages: string[];
  fallbackLanguage: string;
  autoDetect: boolean;
}

// Health check types
export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  retries: number;
  gracefulShutdown: boolean;
}

export interface HealthCheckResult {
  service: string;
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  timestamp: Date;
  error?: string;
  metadata?: Record<string, any>;
}

// Queue types (for background job processing)
export interface QueueJob<T = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface QueueConfig {
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  removeOnComplete: number;
  removeOnFail: number;
}

// Feature flags
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
  conditions?: FeatureFlagCondition[];
  metadata?: Record<string, any>;
}

export interface FeatureFlagCondition {
  type: 'user_id' | 'chat_id' | 'user_role' | 'chat_type' | 'language' | 'custom';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
}

// Webhook security
export interface WebhookSecurity {
  secretToken?: string;
  allowedIPs?: string[];
  maxPayloadSize: number;
  signatureHeader?: string;
  timestampHeader?: string;
  timestampTolerance?: number;
}

// Export commonly used type unions
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type EnvironmentType = 'development' | 'staging' | 'production';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type MimeType = 'application/json' | 'application/xml' | 'text/plain' | 'text/html' | 'multipart/form-data';