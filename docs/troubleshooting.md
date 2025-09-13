# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Telegram AI Bot.

## 🚨 Quick Diagnostics

If your bot is not working, run these quick checks:

```bash
# 1. Validate your environment
node scripts/validate-env.js

# 2. Check dependencies
node scripts/check-dependencies.js

# 3. Run full deployment check
node scripts/deploy-check.js

# 4. Test the webhook endpoint
curl -X GET "https://your-site.netlify.app/.netlify/functions/webhook"
```

## 🔍 Common Issues

### 1. Bot Not Responding to Messages

#### Symptoms
- Messages sent to bot receive no response
- Bot appears offline
- No activity in Netlify function logs

#### Diagnosis Steps

1. **Check webhook status:**
   ```bash
   curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
   ```

2. **Verify webhook URL:**
   ```bash
   curl -X POST "https://your-site.netlify.app/.netlify/functions/webhook" \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

3. **Check Netlify function logs:**
   - Go to Netlify Dashboard → Site → Functions → webhook
   - Check recent invocations and error logs

#### Solutions

**A. Webhook not set or incorrect:**
```bash
# Delete existing webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"

# Set correct webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-site.netlify.app/.netlify/functions/webhook",
    "secret_token": "your_secret_token"
  }'
```

**B. Function not deployed:**
```bash
# Redeploy the function
npm run build
netlify deploy --prod
```

**C. Environment variables missing:**
- Check Netlify Dashboard → Site Settings → Environment Variables
- Ensure all required variables are set

**D. Secret token mismatch:**
- Verify `TELEGRAM_SECRET_TOKEN` in environment matches webhook setup
- Remove secret token temporarily for testing:
  ```bash
  curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://your-site.netlify.app/.netlify/functions/webhook"}'
  ```

### 2. Database Connection Issues

#### Symptoms
- "Database connection failed" errors
- Data not being saved
- Timeouts when accessing database

#### Diagnosis Steps

1. **Test database connection:**
   ```javascript
   // Create test script: test-db.js
   const { createClient } = require('@supabase/supabase-js');
   
   const supabase = createClient(
     process.env.SUPABASE_URL,
     process.env.SUPABASE_ANON_KEY
   );
   
   async function testConnection() {
     try {
       const { data, error } = await supabase
         .from('chats')
         .select('*')
         .limit(1);
       
       if (error) throw error;
       console.log('✅ Database connection successful');
       console.log('Sample data:', data);
     } catch (error) {
       console.error('❌ Database connection failed:', error.message);
     }
   }
   
   testConnection();
   ```

2. **Check Supabase project status:**
   - Go to Supabase Dashboard
   - Verify project is not paused
   - Check for any maintenance or outages

#### Solutions

**A. Invalid credentials:**
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in environment
- Check for typos or extra spaces
- Try regenerating keys in Supabase Dashboard

**B. Network issues:**
- Check if Supabase is accessible from Netlify
- Verify no firewall blocking connections

**C. Database permissions:**
```sql
-- Check if tables exist and are accessible
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Test insert permission
INSERT INTO chats (id, title, type) 
VALUES (-1001234567890, 'Test Chat', 'group')
ON CONFLICT (id) DO NOTHING;
```

**D. Row Level Security (RLS) issues:**
```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public';

-- Temporarily disable RLS for testing (not recommended for production)
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
```

### 3. LLM API Errors

#### Symptoms
- "API key invalid" errors
- "Rate limit exceeded" messages
- Summary or image generation fails

#### Diagnosis Steps

1. **Test API keys:**
   ```javascript
   // Test OpenAI
   const OpenAI = require('openai');
   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
   
   openai.models.list()
     .then(console.log)
     .catch(console.error);
   
   // Test Anthropic
   const Anthropic = require('@anthropic-ai/sdk');
   const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
   
   anthropic.messages.create({
     model: 'claude-3-haiku-20240307',
     max_tokens: 10,
     messages: [{ role: 'user', content: 'Hello' }]
   }).then(console.log).catch(console.error);
   ```

2. **Check API usage and limits:**
   - OpenAI: https://platform.openai.com/usage
   - Anthropic: https://console.anthropic.com/

#### Solutions

**A. Invalid API keys:**
- Regenerate API keys from provider dashboards
- Update environment variables
- Ensure no extra characters or spaces

**B. Insufficient credits/quota:**
- Add payment method to provider accounts
- Increase usage limits
- Monitor spending limits

**C. Rate limiting:**
- Implement exponential backoff in retry logic
- Reduce concurrent requests
- Use multiple API keys if allowed

**D. Model access issues:**
```javascript
// Check available models
const models = await openai.models.list();
console.log('Available models:', models.data.map(m => m.id));

// Use a different model if current one isn't accessible
const response = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo', // fallback model
  messages: [{ role: 'user', content: 'test' }],
  max_tokens: 10
});
```

### 4. Function Timeout Issues

#### Symptoms
- Functions timing out (10-second limit on Netlify)
- Partial responses
- "Function execution timed out" errors

#### Diagnosis Steps

1. **Check function execution time:**
   - Review Netlify function logs for duration
   - Look for slow database queries
   - Monitor LLM API response times

2. **Identify bottlenecks:**
   ```javascript
   // Add timing logs
   console.time('database-query');
   const messages = await supabase.from('messages').select('*');
   console.timeEnd('database-query');
   
   console.time('llm-request');
   const summary = await llm.generateSummary(messages);
   console.timeEnd('llm-request');
   ```

#### Solutions

**A. Optimize database queries:**
```sql
-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_messages_chat_timestamp 
ON messages (chat_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_messages_recent 
ON messages (timestamp DESC) WHERE timestamp > NOW() - INTERVAL '7 days';
```

**B. Implement pagination:**
```javascript
// Instead of loading all messages at once
const pageSize = 100;
let offset = 0;
let allMessages = [];

while (true) {
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .order('timestamp', { ascending: false })
    .range(offset, offset + pageSize - 1);
    
  if (!messages || messages.length === 0) break;
  
  allMessages.push(...messages);
  offset += pageSize;
  
  if (messages.length < pageSize) break;
}
```

**C. Use background processing:**
```javascript
// For long-running tasks, use async processing
export const handler = async (event, context) => {
  // Start background task
  processLongTask(data).catch(console.error);
  
  // Return immediately
  return {
    statusCode: 200,
    body: JSON.stringify({ status: 'processing' })
  };
};
```

**D. Increase timeout (Netlify Pro plans only):**
```toml
# netlify.toml
[functions]
timeout = 26 # seconds (Pro plan only)
```

### 5. Memory Issues

#### Symptoms
- "Function out of memory" errors
- Performance degradation with large datasets
- Unexpected function crashes

#### Solutions

**A. Optimize memory usage:**
```javascript
// Process data in chunks instead of loading everything
async function processMessagesInChunks(messages, chunkSize = 50) {
  const results = [];
  
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    const processed = await processChunk(chunk);
    results.push(...processed);
    
    // Clear memory
    chunk.length = 0;
  }
  
  return results;
}
```

**B. Stream processing:**
```javascript
// Use streams for large data processing
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const messageStream = new Readable({
  objectMode: true,
  read() {
    // Fetch data in small batches
  }
});

const processStream = new Transform({
  objectMode: true,
  transform(message, encoding, callback) {
    // Process each message individually
    callback(null, processMessage(message));
  }
});
```

**C. Limit data scope:**
```javascript
// Only fetch necessary fields and recent data
const { data: recentMessages } = await supabase
  .from('messages')
  .select('content, user_id, timestamp') // Only required fields
  .gt('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24h only
  .order('timestamp', { ascending: false })
  .limit(1000); // Reasonable limit
```

### 6. Rate Limiting Issues

#### Symptoms
- "Rate limit exceeded" messages
- Users blocked from using commands
- Inconsistent rate limit behavior

#### Diagnosis Steps

1. **Check rate limit table:**
   ```sql
   SELECT * FROM rate_limits 
   WHERE expires_at > NOW() 
   ORDER BY expires_at DESC;
   ```

2. **Review rate limit configuration:**
   ```javascript
   // Check current settings
   console.log('Rate limit config:', {
     windowMs: process.env.RATE_LIMIT_WINDOW_MS,
     maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS
   });
   ```

#### Solutions

**A. Adjust rate limits:**
```env
# Increase limits if too restrictive
RATE_LIMIT_WINDOW_MS=60000  # 1 minute
RATE_LIMIT_MAX_REQUESTS=50  # 50 requests per minute
```

**B. Clear stuck rate limits:**
```sql
-- Clear expired rate limits
DELETE FROM rate_limits WHERE expires_at < NOW();

-- Clear all rate limits for testing (not recommended for production)
DELETE FROM rate_limits;
```

**C. Implement user-specific limits:**
```javascript
// Different limits for different user types
function getRateLimit(userId, chatId) {
  const isAdmin = process.env.ADMIN_USER_IDS?.split(',').includes(userId.toString());
  
  return {
    windowMs: 60000,
    maxRequests: isAdmin ? 100 : 30
  };
}
```

### 7. Command Not Working

#### Symptoms
- Specific commands don't respond
- "Unknown command" errors
- Commands work in some chats but not others

#### Diagnosis Steps

1. **Test command parsing:**
   ```javascript
   // Check if command is being detected
   const text = '/summary 24';
   const match = text.match(/^\/(\w+)(?:\s+(.+))?/);
   console.log('Command:', match?.[1]);
   console.log('Arguments:', match?.[2]);
   ```

2. **Verify command registration:**
   ```javascript
   // Check if command handler exists
   const commands = ['start', 'help', 'summary', 'image', 'stats'];
   commands.forEach(cmd => {
     console.log(`${cmd}: ${typeof handlers[cmd]}`);
   });
   ```

#### Solutions

**A. Fix command parsing:**
```javascript
// Ensure consistent command parsing
function parseCommand(text) {
  const match = text.trim().match(/^\/([a-zA-Z0-9_]+)(?:@\w+)?(?:\s+(.+))?$/);
  return match ? {
    command: match[1].toLowerCase(),
    args: match[2]?.trim() || ''
  } : null;
}
```

**B. Add command aliases:**
```javascript
// Support common variations
const commandAliases = {
  'summarize': 'summary',
  'sum': 'summary',
  'pic': 'image',
  'generate': 'image'
};

function resolveCommand(command) {
  return commandAliases[command] || command;
}
```

**C. Improve error handling:**
```javascript
// Provide helpful error messages
async function handleCommand(command, args, context) {
  try {
    const handler = commandHandlers[command];
    if (!handler) {
      return `Unknown command: /${command}. Type /help for available commands.`;
    }
    
    return await handler(args, context);
  } catch (error) {
    console.error(`Command error: ${command}`, error);
    return `Sorry, there was an error processing your command. Please try again later.`;
  }
}
```

## 🔧 Debug Mode

### Enable Debug Logging

```env
# Set detailed logging
LOG_LEVEL=debug
NODE_ENV=development
```

### Debug Webhook Requests

```javascript
// Add to webhook.ts for detailed request logging
export const handler = async (event, context) => {
  console.log('=== DEBUG REQUEST ===');
  console.log('Method:', event.httpMethod);
  console.log('Headers:', JSON.stringify(event.headers, null, 2));
  console.log('Body:', event.body);
  console.log('Query:', JSON.stringify(event.queryStringParameters));
  console.log('=====================');
  
  // ... rest of handler
};
```

### Test Individual Components

```javascript
// Create test files for individual features
// test-summary.js
const { summarizeMessages } = require('./netlify/functions/utils/llm');

async function testSummary() {
  const testMessages = [
    { user: 'Alice', content: 'Hello everyone!', timestamp: '2024-01-01T10:00:00Z' },
    { user: 'Bob', content: 'Hi Alice, how are you?', timestamp: '2024-01-01T10:01:00Z' }
  ];
  
  try {
    const result = await summarizeMessages(testMessages);
    console.log('Summary test passed:', result);
  } catch (error) {
    console.error('Summary test failed:', error);
  }
}

testSummary();
```

## 📞 Getting Help

### Self-Service Resources

1. **Review Logs:**
   - Netlify function logs
   - Supabase logs
   - Browser developer console

2. **Check Status Pages:**
   - [Netlify Status](https://www.netlifystatus.com/)
   - [Supabase Status](https://status.supabase.com/)
   - [OpenAI Status](https://status.openai.com/)
   - [Anthropic Status](https://status.anthropic.com/)

3. **Validate Configuration:**
   ```bash
   # Run all validation scripts
   node scripts/validate-env.js
   node scripts/check-dependencies.js
   node scripts/deploy-check.js
   ```

### Community Support

1. **GitHub Issues:**
   - Search existing issues: https://github.com/yourusername/telegram-ai-bot/issues
   - Create new issue with detailed information

2. **Discord Community:**
   - Join: https://discord.gg/your-invite
   - Use #troubleshooting channel

### Creating Effective Bug Reports

When seeking help, include:

1. **Environment Information:**
   ```bash
   # Run and include output
   node -v
   npm -v
   cat package.json | grep version
   ```

2. **Error Messages:**
   - Full error text
   - Stack traces
   - Function logs

3. **Steps to Reproduce:**
   - Exact commands or actions
   - Expected vs actual behavior
   - Minimal test case

4. **Configuration (sanitized):**
   - Environment variables (without secrets)
   - Relevant configuration files
   - Database schema if related

### Template for Bug Reports

```markdown
## Bug Description
[Clear description of the issue]

## Environment
- Node.js version: 
- Package version: 
- Deployment platform: Netlify
- Database: Supabase

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Error Messages
```
[Paste error messages here]
```

## Additional Context
[Any other relevant information]
```

---

## 🆘 Emergency Contacts

For critical production issues:
- **Email:** support@yourproject.com
- **Emergency:** Create GitHub issue with `[URGENT]` tag
- **Security Issues:** security@yourproject.com