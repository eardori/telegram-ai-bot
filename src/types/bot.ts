// Bot Application Types

import type { TelegramUpdate, TelegramMessage, TelegramUser, TelegramChat } from './telegram';
import type { LLMConfig, SummaryPreferences } from './llm';
import type { Database } from './database';

// Bot Configuration
export interface BotConfig {
  telegram: {
    botToken: string;
    webhookUrl?: string;
    allowedUpdates?: string[];
    dropPendingUpdates?: boolean;
  };
  database: {
    url: string;
    apiKey: string;
    schema?: string;
  };
  llm: LLMConfig;
  app: {
    environment: 'development' | 'staging' | 'production';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    timezone: string;
    defaultLanguage: string;
    maxMessageLength: number;
    rateLimiting: {
      enabled: boolean;
      maxRequests: number;
      windowMs: number;
    };
    features: {
      summaryEnabled: boolean;
      translationEnabled: boolean;
      moderationEnabled: boolean;
      analyticsEnabled: boolean;
    };
  };
  scheduler: {
    enabled: boolean;
    summaryIntervals: {
      hourly: boolean;
      daily: boolean;
      weekly: boolean;
      monthly: boolean;
    };
    timezone: string;
    batchSize: number;
  };
}

// Bot Context
export interface BotContext {
  update: TelegramUpdate;
  message?: TelegramMessage;
  user?: TelegramUser;
  chat?: TelegramChat;
  command?: BotCommand;
  args?: string[];
  session?: UserSession;
  config: BotConfig;
  db: Database;
  llm: any; // LLM client instance
  telegram: any; // Telegram client instance
}

// Command System
export interface BotCommand {
  command: string;
  description: string;
  aliases?: string[];
  category: CommandCategory;
  permissions: CommandPermissions;
  rateLimiting?: {
    maxUses: number;
    windowMs: number;
  };
  handler: CommandHandler;
}

export type CommandCategory = 
  | 'general' 
  | 'admin' 
  | 'moderation' 
  | 'summary' 
  | 'settings' 
  | 'analytics' 
  | 'help';

export interface CommandPermissions {
  adminOnly: boolean;
  allowedChatTypes: ('private' | 'group' | 'supergroup' | 'channel')[];
  requiredRole?: UserRole;
  customCheck?: (context: BotContext) => boolean | Promise<boolean>;
}

export type UserRole = 'user' | 'moderator' | 'admin' | 'owner';

export type CommandHandler = (context: BotContext) => Promise<CommandResponse>;

export interface CommandResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  nextAction?: NextAction;
}

export interface NextAction {
  type: 'wait_for_input' | 'show_menu' | 'redirect' | 'schedule_task';
  data?: any;
  timeout?: number;
}

// User Session Management
export interface UserSession {
  userId: string;
  chatId: string;
  currentCommand?: string;
  step: number;
  context: Record<string, any>;
  tempData: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
}

// Event System
export interface BotEvent {
  type: BotEventType;
  timestamp: Date;
  source: EventSource;
  data: any;
  userId?: string;
  chatId?: string;
  metadata?: Record<string, any>;
}

export type BotEventType = 
  | 'message_received'
  | 'command_executed'
  | 'user_joined'
  | 'user_left'
  | 'summary_generated'
  | 'error_occurred'
  | 'rate_limit_exceeded'
  | 'webhook_received'
  | 'scheduled_task_executed';

export type EventSource = 'telegram' | 'scheduler' | 'webhook' | 'internal';

export interface EventHandler {
  eventType: BotEventType;
  handler: (event: BotEvent, context: BotContext) => Promise<void>;
  priority?: number;
}

// Message Processing
export interface MessageProcessor {
  name: string;
  priority: number;
  shouldProcess: (context: BotContext) => boolean | Promise<boolean>;
  process: (context: BotContext) => Promise<ProcessingResult>;
}

export interface ProcessingResult {
  processed: boolean;
  shouldContinue: boolean;
  data?: any;
  error?: string;
  modifications?: MessageModification[];
}

export interface MessageModification {
  type: 'filter' | 'transform' | 'enhance' | 'translate';
  applied: boolean;
  data: any;
}

// Middleware System
export interface Middleware {
  name: string;
  priority: number;
  execute: (context: BotContext, next: () => Promise<void>) => Promise<void>;
}

// Error Handling
export interface BotError {
  code: string;
  message: string;
  type: ErrorType;
  severity: ErrorSeverity;
  context?: BotContext;
  stack?: string;
  timestamp: Date;
  userId?: string;
  chatId?: string;
}

export type ErrorType = 
  | 'telegram_api'
  | 'database'
  | 'llm_api'
  | 'validation'
  | 'rate_limit'
  | 'permission'
  | 'internal'
  | 'network'
  | 'timeout';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Analytics and Metrics
export interface BotMetrics {
  timestamp: Date;
  period: MetricsPeriod;
  data: {
    messagesProcessed: number;
    commandsExecuted: number;
    summariesGenerated: number;
    activeUsers: number;
    activeChats: number;
    errors: number;
    averageResponseTime: number;
    llmTokensUsed: number;
    databaseQueries: number;
  };
  breakdown?: {
    byCommand?: Record<string, number>;
    byChat?: Record<string, number>;
    byUser?: Record<string, number>;
    byError?: Record<string, number>;
  };
}

export type MetricsPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

// Webhook Types
export interface WebhookRequest {
  body: TelegramUpdate;
  headers: Record<string, string>;
  method: string;
  url: string;
  timestamp: Date;
}

export interface WebhookResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: any;
}

// Scheduler Types
export interface ScheduledTask {
  id: string;
  name: string;
  type: TaskType;
  schedule: TaskSchedule;
  data: any;
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
  runCount: number;
  failureCount: number;
  maxRetries: number;
}

export type TaskType = 
  | 'generate_summary'
  | 'cleanup_old_data'
  | 'send_notification'
  | 'update_statistics'
  | 'backup_data'
  | 'health_check';

export interface TaskSchedule {
  type: 'cron' | 'interval';
  expression: string; // cron expression or interval in ms
  timezone?: string;
}

export interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  timestamp: Date;
}

// Plugin System
export interface BotPlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  dependencies?: string[];
  config?: Record<string, any>;
  
  // Lifecycle hooks
  onLoad?: (bot: BotInstance) => Promise<void>;
  onUnload?: (bot: BotInstance) => Promise<void>;
  onMessage?: (context: BotContext) => Promise<void>;
  onCommand?: (context: BotContext) => Promise<void>;
  onError?: (error: BotError, context?: BotContext) => Promise<void>;
  
  // Plugin components
  commands?: BotCommand[];
  processors?: MessageProcessor[];
  middleware?: Middleware[];
  eventHandlers?: EventHandler[];
}

export interface BotInstance {
  config: BotConfig;
  plugins: Map<string, BotPlugin>;
  commands: Map<string, BotCommand>;
  processors: MessageProcessor[];
  middleware: Middleware[];
  eventHandlers: Map<BotEventType, EventHandler[]>;
  
  // Core methods
  start(): Promise<void>;
  stop(): Promise<void>;
  processUpdate(update: TelegramUpdate): Promise<void>;
  executeCommand(command: string, context: BotContext): Promise<CommandResponse>;
  loadPlugin(plugin: BotPlugin): Promise<void>;
  unloadPlugin(name: string): Promise<void>;
  emit(event: BotEvent): Promise<void>;
}

// State Management
export interface BotState {
  status: BotStatus;
  startTime: Date;
  uptime: number;
  version: string;
  activeConnections: number;
  totalUpdatesProcessed: number;
  lastUpdate?: Date;
  healthCheck: HealthStatus;
}

export type BotStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    telegram: ComponentHealth;
    database: ComponentHealth;
    llm: ComponentHealth;
    scheduler: ComponentHealth;
  };
  lastCheck: Date;
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  lastCheck: Date;
}