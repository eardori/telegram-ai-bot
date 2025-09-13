# API Documentation

This document provides comprehensive API documentation for the Telegram AI Bot, including webhook endpoints, database schema, and integration details.

## 📡 Webhook Endpoints

### Main Webhook Endpoint

#### `POST /.netlify/functions/webhook`

Handles all incoming Telegram updates including messages, commands, and callbacks.

**Headers:**
- `Content-Type: application/json`
- `X-Telegram-Bot-Api-Secret-Token: your_secret_token` (in production)

**Request Body:**
```typescript
interface TelegramUpdate {
  update_id: number;
  message?: Message;
  callback_query?: CallbackQuery;
  inline_query?: InlineQuery;
}
```

**Response:**
```typescript
interface WebhookResponse {
  statusCode: 200 | 400 | 403 | 500;
  headers: {
    'Content-Type': 'application/json';
    'X-Request-ID': string;
    'X-Processing-Time': string;
  };
  body: string; // JSON stringified success or error
}
```

**Example Response:**
```json
{
  "success": true,
  "requestId": "req_1234567890",
  "processingTime": 150
}
```

### Scheduled Functions

#### `POST /.netlify/functions/summary-scheduler`

Triggers scheduled summary generation for all active chats.

**Trigger:** Netlify scheduled functions or external cron
**Authentication:** Internal only

**Response:**
```typescript
interface SchedulerResponse {
  success: boolean;
  processed: number;
  errors: number;
  details: Array<{
    chatId: string;
    status: 'success' | 'error';
    message?: string;
  }>;
}
```

## 🤖 Bot Commands API

### User Commands

#### `/start`
Initialize the bot for the current chat.

**Parameters:** None

**Response:** Welcome message with bot capabilities

**Database Effects:**
- Creates or updates chat record in `chats` table
- Sets `is_active = true`

#### `/help`
Display available commands and usage instructions.

**Parameters:** None

**Response:** Formatted help message

#### `/summary [hours]`
Generate a summary of recent chat messages.

**Parameters:**
- `hours` (optional): Number of hours to summarize (default: 24, max: 168)

**Response:** AI-generated summary or error message

**Database Effects:**
- Queries messages from specified time period
- Stores generated summary in `summaries` table
- Records usage statistics

**Example Usage:**
```
/summary
/summary 6
/summary 48
```

#### `/image [prompt]`
Generate an AI image based on the provided prompt.

**Parameters:**
- `prompt` (required): Description of the image to generate

**Response:** Generated image or error message

**Database Effects:**
- Stores image generation request in `generated_images` table
- Updates usage statistics
- Applies rate limiting

**Example Usage:**
```
/image beautiful sunset over mountains
/image cute cat wearing a hat, digital art style
```

#### `/stats`
Show usage statistics for the current chat.

**Parameters:** None

**Response:** Statistics summary including:
- Total messages processed
- Summaries generated
- Images created
- Active users

### Admin Commands

#### `/settings`
Configure bot settings (admin only).

**Parameters:** Interactive menu

**Response:** Settings configuration interface

**Database Effects:**
- Updates chat settings in `chats.settings` JSONB field

#### `/interval [hours]`
Set automatic summary interval (admin only).

**Parameters:**
- `hours`: Summary interval in hours (1, 6, 12, 24)

**Database Effects:**
- Updates `chats.settings.summary_interval`

#### `/enable` / `/disable`
Enable or disable bot features (admin only).

**Database Effects:**
- Updates `chats.is_active` field

## 🗄️ Database API

### Core Tables

#### `chats` Table

Stores chat configuration and metadata.

```sql
CREATE TABLE chats (
  id BIGINT PRIMARY KEY,              -- Telegram chat ID
  title VARCHAR(255),                 -- Chat title
  type VARCHAR(50) DEFAULT 'group',   -- 'private', 'group', 'supergroup'
  settings JSONB DEFAULT '{}',        -- Chat-specific settings
  is_active BOOLEAN DEFAULT true,     -- Bot enabled/disabled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Settings Schema:**
```typescript
interface ChatSettings {
  summary_interval?: number;          // Hours between auto-summaries
  max_summary_length?: number;        // Max characters in summary
  llm_provider?: string;             // Preferred LLM provider
  llm_model?: string;                // Specific model to use
  image_provider?: string;           // Preferred image generation provider
  admin_users?: number[];            // Admin user IDs
  features?: {
    auto_summary?: boolean;
    image_generation?: boolean;
    translation?: boolean;
  };
  rate_limits?: {
    messages_per_hour?: number;
    images_per_user_per_day?: number;
  };
}
```

#### `messages` Table

Stores all processed messages for summarization.

```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  message_id INTEGER NOT NULL,        -- Telegram message ID
  user_id BIGINT NOT NULL,           -- Telegram user ID
  username VARCHAR(255),             -- Telegram username
  first_name VARCHAR(255),           -- User's first name
  content TEXT NOT NULL,             -- Message text content
  message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'photo', 'document', etc.
  reply_to_message_id INTEGER,       -- If replying to another message
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'        -- Additional message data
);
```

**Metadata Schema:**
```typescript
interface MessageMetadata {
  edited?: boolean;
  forwarded?: boolean;
  has_media?: boolean;
  media_type?: string;
  file_id?: string;
  caption?: string;
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
    url?: string;
  }>;
}
```

#### `summaries` Table

Stores generated chat summaries.

```sql
CREATE TABLE summaries (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  summary_text TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  message_count INTEGER NOT NULL,
  model_used VARCHAR(100),           -- LLM model used
  tokens_used INTEGER,               -- API tokens consumed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `generated_images` Table

Stores AI image generation history.

```sql
CREATE TABLE generated_images (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  user_id BIGINT NOT NULL,
  message_id INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  image_url VARCHAR(1000),           -- URL to generated image
  thumbnail_url VARCHAR(1000),       -- URL to thumbnail
  provider VARCHAR(100) NOT NULL,    -- 'openai', 'midjourney', etc.
  model VARCHAR(100),                -- Specific model used
  style VARCHAR(100),                -- Art style applied
  dimensions VARCHAR(20) DEFAULT '1024x1024',
  processing_time_ms INTEGER,        -- Generation time
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `rate_limits` Table

Manages per-user rate limiting.

```sql
CREATE TABLE rate_limits (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  action_type VARCHAR(50) NOT NULL,  -- 'message', 'summary', 'image'
  count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

#### `usage_stats` Table

Tracks usage analytics and metrics.

```sql
CREATE TABLE usage_stats (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id),
  user_id BIGINT,                    -- NULL for system events
  action_type VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Action Types:**
- `message_received`
- `command_executed`
- `summary_generated`
- `image_generated`
- `error_occurred`
- `rate_limit_hit`

### Database Functions

#### Get Chat Statistics
```sql
CREATE OR REPLACE FUNCTION get_chat_stats(chat_id_param BIGINT)
RETURNS TABLE (
  total_messages BIGINT,
  unique_users BIGINT,
  summaries_generated BIGINT,
  images_generated BIGINT,
  last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_messages,
    COUNT(DISTINCT user_id) as unique_users,
    (SELECT COUNT(*) FROM summaries WHERE chat_id = chat_id_param) as summaries_generated,
    (SELECT COUNT(*) FROM generated_images WHERE chat_id = chat_id_param) as images_generated,
    MAX(timestamp) as last_activity
  FROM messages 
  WHERE chat_id = chat_id_param;
END;
$$ LANGUAGE plpgsql;
```

#### Clean Old Data
```sql
CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete old messages (keep summaries)
  DELETE FROM messages 
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Clean up expired rate limits
  DELETE FROM rate_limits WHERE expires_at < NOW();
  
  -- Clean up old usage stats (keep 90 days)
  DELETE FROM usage_stats 
  WHERE timestamp < NOW() - INTERVAL '90 days';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

## 🔌 LLM Integration API

### Supported Providers

#### OpenAI
```typescript
interface OpenAIConfig {
  provider: 'openai';
  apiKey: string;
  model: 'gpt-4' | 'gpt-3.5-turbo' | string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}
```

#### Anthropic Claude
```typescript
interface AnthropicConfig {
  provider: 'anthropic';
  apiKey: string;
  model: 'claude-3-sonnet-20240229' | 'claude-3-haiku-20240307' | string;
  maxTokens?: number;
  temperature?: number;
}
```

#### Google AI
```typescript
interface GoogleAIConfig {
  provider: 'google';
  apiKey: string;
  model: 'gemini-pro' | string;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}
```

### LLM Client Interface

```typescript
interface LLMClient {
  generateResponse(request: LLMRequest): Promise<LLMResponse>;
  generateStream(request: LLMRequest): AsyncGenerator<LLMStreamResponse>;
  getModels(): Promise<string[]>;
  
  // Specialized methods
  summarizeText(request: SummaryRequest): Promise<SummaryResponse>;
  analyzeContent(request: ContentAnalysisRequest): Promise<ContentAnalysisResponse>;
  translateText(request: TranslationRequest): Promise<TranslationResponse>;
  answerQuestion(request: QARequest): Promise<QAResponse>;
}
```

### Request/Response Types

```typescript
interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  context?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'content_filter';
  metadata?: any;
}

interface SummaryRequest {
  messages: Array<{
    user: string;
    content: string;
    timestamp: string;
  }>;
  maxLength?: number;
  style?: 'concise' | 'detailed' | 'bullet-points';
  language?: string;
}

interface SummaryResponse {
  summary: string;
  keyTopics: string[];
  participantCount: number;
  timeRange: {
    start: string;
    end: string;
  };
  model: string;
  usage: LLMResponse['usage'];
}
```

## 🔐 Authentication & Security

### Webhook Security

#### Secret Token Validation
```typescript
function validateWebhookSecurity(
  headers: Record<string, string>, 
  config: BotConfig
): boolean {
  const receivedToken = headers['x-telegram-bot-api-secret-token'];
  const expectedToken = config.telegram.secretToken;
  
  return receivedToken === expectedToken;
}
```

#### Request Validation
```typescript
interface RequestValidation {
  isValidTelegramRequest(body: any): boolean;
  sanitizeInput(input: string): string;
  checkRateLimit(userId: number, chatId: number, action: string): Promise<boolean>;
  isAuthorizedUser(userId: number, chatId: number, requiredRole?: string): Promise<boolean>;
}
```

### Rate Limiting

#### Implementation
```typescript
interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  maxRequests: number;        // Max requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}
```

## 📊 Analytics API

### Usage Tracking

#### Track Event
```typescript
function trackUsage(event: {
  chatId: number;
  userId?: number;
  action: string;
  details?: Record<string, any>;
}): Promise<void>;
```

#### Get Analytics
```typescript
interface AnalyticsQuery {
  chatId?: number;
  userId?: number;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

interface AnalyticsResult {
  totalEvents: number;
  uniqueUsers: number;
  topActions: Array<{
    action: string;
    count: number;
  }>;
  timeline: Array<{
    period: string;
    count: number;
  }>;
}
```

## 🔄 Error Handling

### Error Types

```typescript
enum BotErrorType {
  WEBHOOK_VALIDATION_FAILED = 'WEBHOOK_VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  LLM_API_ERROR = 'LLM_API_ERROR',
  TELEGRAM_API_ERROR = 'TELEGRAM_API_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  UNKNOWN_COMMAND = 'UNKNOWN_COMMAND',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS'
}

interface BotError {
  type: BotErrorType;
  message: string;
  details?: any;
  timestamp: Date;
  chatId?: number;
  userId?: number;
  requestId?: string;
}
```

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    type: string;
    message: string;
    code?: number;
    details?: any;
  };
  requestId: string;
  timestamp: string;
}
```

## 🧪 Testing API

### Test Endpoints

For development and testing purposes:

#### `POST /.netlify/functions/test-webhook`
Simulate webhook requests for testing.

#### `GET /.netlify/functions/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "database": "connected",
  "llm_providers": ["openai", "anthropic"],
  "features": ["summarization", "image_generation"]
}
```

## 📝 Example API Calls

### Create a Summary
```javascript
// Internal function call
const summary = await summarizeMessages({
  chatId: -1001234567890,
  hours: 24,
  maxLength: 2000,
  model: 'gpt-4'
});
```

### Generate an Image
```javascript
// Internal function call
const image = await generateImage({
  prompt: "beautiful landscape with mountains",
  provider: "openai",
  style: "natural",
  dimensions: "1024x1024"
});
```

### Query Statistics
```sql
-- Get chat activity for the last 7 days
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as message_count,
  COUNT(DISTINCT user_id) as active_users
FROM messages 
WHERE chat_id = -1001234567890 
  AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp)
ORDER BY date;
```

---

## 📞 Support

For API-related questions:
- Check the [Troubleshooting Guide](troubleshooting.md)
- Review [GitHub Issues](https://github.com/yourusername/telegram-ai-bot/issues)
- Join our [Developer Discord](https://discord.gg/developers)