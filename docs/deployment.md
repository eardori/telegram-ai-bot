# Deployment Guide

This guide provides comprehensive instructions for deploying the Telegram AI Bot to production environments.

## 📋 Prerequisites

Before deploying, ensure you have:

- ✅ Node.js 18.0.0 or higher installed
- ✅ A Telegram Bot Token from [@BotFather](https://t.me/botfather)
- ✅ Supabase project with database configured
- ✅ At least one LLM API key (OpenAI, Anthropic, etc.)
- ✅ Netlify account for deployment
- ✅ Domain name (optional, for custom webhook URL)

## 🚀 Deployment Steps

### 1. Pre-deployment Validation

Run the comprehensive deployment check:

```bash
# Install dependencies
npm install

# Validate environment configuration
node scripts/validate-env.js

# Check dependencies and security
node scripts/check-dependencies.js

# Run comprehensive deployment check
node scripts/deploy-check.js
```

If any checks fail, address the issues before proceeding.

### 2. Environment Configuration

#### 2.1 Required Environment Variables

Set these variables in your Netlify dashboard or deployment environment:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
TELEGRAM_SECRET_TOKEN=your_webhook_security_token_here

# Database Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# LLM Provider (at least one required)
OPENAI_API_KEY=sk-proj-1234567890abcdef...
CLAUDE_API_KEY=sk-ant-api-1234567890abcdef...

# Environment Settings
NODE_ENV=production
LOG_LEVEL=info
```

#### 2.2 Optional Environment Variables

```env
# Additional LLM Providers
GOOGLE_AI_API_KEY=AIzaSy...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
HUGGINGFACE_API_KEY=hf_...

# Bot Configuration
DEFAULT_SUMMARY_INTERVAL=6
MAX_SUMMARY_LENGTH=2000
MAX_IMAGE_REQUESTS_PER_USER=10
ADMIN_USER_IDS=123456789,987654321

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30

# Scheduled Tasks
SUMMARY_CRON_SCHEDULE="0 */6 * * *"
CLEANUP_CRON_SCHEDULE="0 2 * * *"
```

### 3. Database Setup

#### 3.1 Create Supabase Project

1. Go to [Supabase](https://supabase.com) and create a new project
2. Note down your project URL and API keys
3. Wait for the project to be fully provisioned

#### 3.2 Run Database Migrations

Execute the following SQL scripts in your Supabase SQL editor:

```sql
-- Create tables (from sql/init.sql)
-- Run each table creation script one by one
```

#### 3.3 Configure Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Service role can do everything" ON chats
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can do everything" ON messages
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can do everything" ON summaries
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can do everything" ON generated_images
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can do everything" ON rate_limits
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can do everything" ON usage_stats
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

### 4. Netlify Deployment

#### 4.1 Manual Deployment

1. **Build the project locally:**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify:**
   ```bash
   # Install Netlify CLI if not already installed
   npm install -g netlify-cli

   # Login to Netlify
   netlify login

   # Deploy
   netlify deploy --prod --dir=.
   ```

#### 4.2 Automatic Deployment via Git

1. **Connect Repository:**
   - Go to Netlify dashboard
   - Click "New site from Git"
   - Connect your GitHub/GitLab repository

2. **Configure Build Settings:**
   ```
   Build command: npm run build
   Publish directory: .
   Functions directory: netlify/functions
   Node.js version: 18.x
   ```

3. **Set Environment Variables:**
   - Go to Site settings → Environment variables
   - Add all required environment variables

4. **Enable Build Hooks (optional):**
   - Go to Site settings → Build & deploy → Build hooks
   - Create hooks for external triggers

#### 4.3 GitHub Actions Deployment

The project includes GitHub Actions workflows for automated deployment:

1. **Set Repository Secrets:**
   - `NETLIFY_SITE_ID`: Your Netlify site ID
   - `NETLIFY_AUTH_TOKEN`: Your Netlify personal access token
   - `TELEGRAM_BOT_TOKEN`: Your bot token
   - `TELEGRAM_SECRET_TOKEN`: Webhook security token
   - All other environment variables

2. **Deployment Triggers:**
   - Push to `main` branch → Production deployment
   - Push to `develop` branch → Development deployment
   - Pull requests → Preview deployment

### 5. Telegram Webhook Configuration

After successful deployment, configure the Telegram webhook:

```bash
# Replace with your actual values
NETLIFY_URL="https://your-site-name.netlify.app"
BOT_TOKEN="your_bot_token_here"
SECRET_TOKEN="your_secret_token_here"

# Set webhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "'${NETLIFY_URL}'/.netlify/functions/webhook",
    "secret_token": "'${SECRET_TOKEN}'",
    "allowed_updates": ["message", "callback_query", "inline_query"],
    "drop_pending_updates": true,
    "max_connections": 100
  }'
```

Verify webhook setup:
```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

### 6. LLM API Configuration

#### 6.1 OpenAI Setup

1. Get API key from [OpenAI](https://platform.openai.com/api-keys)
2. Set up billing and usage limits
3. Monitor usage in OpenAI dashboard

#### 6.2 Anthropic Claude Setup

1. Get API key from [Anthropic Console](https://console.anthropic.com/)
2. Configure rate limits and usage monitoring
3. Review Claude's usage policies

#### 6.3 Google AI Setup

1. Enable Google AI API in Google Cloud Console
2. Create service account and download credentials
3. Set up billing and quotas

### 7. Post-deployment Verification

#### 7.1 Health Check

```bash
# Check webhook endpoint
curl -X GET "https://your-site-name.netlify.app/.netlify/functions/webhook"

# Test bot functionality
# Send /start command to your bot in Telegram
```

#### 7.2 Monitor Logs

```bash
# Netlify CLI
netlify dev --live

# Or check Netlify dashboard → Functions → Logs
```

#### 7.3 Database Verification

Check that the bot is writing data to your Supabase database:

```sql
-- Check if chats are being created
SELECT * FROM chats ORDER BY created_at DESC LIMIT 5;

-- Check if messages are being stored
SELECT * FROM messages ORDER BY timestamp DESC LIMIT 10;
```

## 🔧 Configuration Options

### Netlify Configuration

#### netlify.toml

```toml
[build]
  command = "npm run build"
  functions = "netlify/functions"
  publish = "."

[build.environment]
  NODE_VERSION = "18"
  NPM_FLAGS = "--production=false"

[functions]
  node_bundler = "esbuild"
  
[functions."webhook"]
  included_files = ["src/**", "netlify/functions/**"]

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### Environment-specific Configuration

#### Production
```env
NODE_ENV=production
LOG_LEVEL=warn
RATE_LIMIT_STRICT=true
```

#### Staging
```env
NODE_ENV=staging
LOG_LEVEL=info
RATE_LIMIT_STRICT=false
```

#### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
RATE_LIMIT_STRICT=false
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Webhook Not Receiving Updates

**Symptoms:**
- Bot doesn't respond to messages
- No logs in Netlify functions

**Solutions:**
```bash
# Check webhook status
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

# Verify webhook URL is accessible
curl -X POST "https://your-site.netlify.app/.netlify/functions/webhook" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Reset webhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook"
# Then set it again
```

#### 2. Database Connection Issues

**Symptoms:**
- "Database connection failed" errors
- Data not being saved

**Solutions:**
```bash
# Test database connection
node -e "
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
client.from('chats').select('*').limit(1).then(console.log).catch(console.error);
"
```

#### 3. LLM API Issues

**Symptoms:**
- "API key invalid" errors
- Request timeouts

**Solutions:**
- Verify API keys are correct and have sufficient credits
- Check API rate limits and usage quotas
- Test API connectivity directly

#### 4. Build Failures

**Symptoms:**
- Netlify build fails
- TypeScript compilation errors

**Solutions:**
```bash
# Run build locally to debug
npm run build

# Check TypeScript configuration
npm run type-check

# Verify dependencies
npm audit fix
```

### Error Monitoring

#### Enable Structured Logging

```typescript
// Add to webhook.ts
const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  error: (message: string, error?: Error, meta?: any) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};
```

#### Set Up External Monitoring

Consider integrating with:
- **Sentry**: Error tracking and performance monitoring
- **LogRocket**: Session replay and debugging
- **DataDog**: Infrastructure and application monitoring

## 🔒 Security Considerations

### Production Security Checklist

- [ ] ✅ Webhook secret token configured
- [ ] ✅ Environment variables properly set
- [ ] ✅ Database RLS policies enabled
- [ ] ✅ API keys have minimal required permissions
- [ ] ✅ Rate limiting configured
- [ ] ✅ HTTPS only for all communications
- [ ] ✅ Regular security updates enabled
- [ ] ✅ Access logs monitoring enabled

### Security Headers

```javascript
// Add to your functions
export const handler = async (event, context) => {
  // ... your handler logic
  
  return {
    statusCode: 200,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'"
    },
    body: JSON.stringify({ success: true })
  };
};
```

## 📊 Performance Optimization

### Function Optimization

```typescript
// Use connection pooling for database
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        db: { schema: 'public' }
      }
    );
  }
  return supabaseClient;
}
```

### Caching Strategy

```typescript
// Implement in-memory caching for frequently accessed data
const cache = new Map();

export function getCachedData(key: string, ttlMs: number = 300000) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data;
  }
  return null;
}

export function setCachedData(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}
```

## 🔄 Maintenance

### Regular Tasks

#### Weekly
- Review error logs
- Check API usage and costs
- Monitor database storage usage

#### Monthly
- Update dependencies (`npm audit fix`)
- Review and rotate API keys
- Analyze usage patterns and optimize

#### Quarterly
- Security audit
- Performance review
- Backup and disaster recovery testing

### Backup Strategy

```sql
-- Automated database backups (set up in Supabase)
-- Or manual backup for critical data
pg_dump -h db.your-project.supabase.co \
        -U postgres \
        -d postgres \
        --data-only \
        --table=messages \
        --table=summaries > backup.sql
```

## 📈 Scaling Considerations

### Horizontal Scaling

- Use Netlify's automatic scaling for functions
- Consider CDN for static assets
- Implement database connection pooling

### Vertical Scaling

- Monitor function execution time and memory usage
- Optimize database queries with indexes
- Use background jobs for heavy processing

### Cost Management

- Set up billing alerts for all services
- Monitor API usage and implement caching
- Use cheaper alternatives for development/testing

---

## 📞 Support

If you encounter issues during deployment:

1. Check the [Troubleshooting Guide](troubleshooting.md)
2. Review [GitHub Issues](https://github.com/yourusername/telegram-ai-bot/issues)
3. Join our [Discord Community](https://discord.gg/your-invite)

For urgent production issues:
- **Email**: support@yourproject.com
- **Emergency**: Create a GitHub issue with `[URGENT]` tag