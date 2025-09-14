# Chat Tracking System Deployment Guide

## 🚀 Overview

This guide will walk you through deploying the complete chat tracking and summarization system for your Telegram bot. The system includes:

- **Per-user conversation tracking** - Each user can independently start/stop tracking
- **AI-powered summarization** - Claude-powered intelligent conversation summaries
- **Dobby personality responses** - Harry Potter-inspired friendly interactions
- **Automatic cleanup** - Self-maintaining database with cleanup routines
- **Error handling** - Comprehensive error recovery and graceful degradation

## 📋 Prerequisites

### Environment Requirements
- Node.js 18+ 
- Supabase account and database
- Claude API key (Anthropic)
- Google Imagen API key
- Telegram Bot Token
- Netlify account (for deployment)

### Required Environment Variables
```bash
# Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
CLAUDE_API_KEY=your_claude_api_key
GOOGLE_API_KEY=your_google_api_key

# Database Configuration  
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📊 Database Setup

### 1. Run Database Migrations

Execute the SQL files in order:

```bash
# Navigate to sql directory
cd sql/

# Run migrations in order
psql -h your-supabase-host -U postgres -d postgres -f 001_initial_schema.sql
psql -h your-supabase-host -U postgres -d postgres -f 002_indexes.sql  
psql -h your-supabase-host -U postgres -d postgres -f 003_rls_policies.sql
psql -h your-supabase-host -U postgres -d postgres -f 004_functions.sql
psql -h your-supabase-host -U postgres -d postgres -f 005_initial_data.sql
psql -h your-supabase-host -U postgres -d postgres -f 006_chat_tracking_schema.sql
```

### 2. Verify Database Setup

Check that all tables were created:

```sql
-- Verify core tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'chat_groups', 
  'user_chat_tracking', 
  'tracking_sessions', 
  'tracked_messages', 
  'conversation_summaries'
);

-- Verify functions exist  
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
  'expire_old_tracking_sessions',
  'cleanup_old_tracking_data'
);
```

### 3. Set Up Row Level Security (RLS)

If using RLS policies, ensure they're configured for your use case:

```sql
-- Enable RLS on sensitive tables
ALTER TABLE user_chat_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;
```

## 🔧 Code Deployment

### 1. Install Dependencies

```bash
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Deploy to Netlify

```bash
# Deploy to production
npm run deploy

# Or use Netlify CLI
netlify deploy --prod --dir=dist
```

### 4. Set Webhook URL

Update your Telegram bot webhook URL:

```bash
curl -X POST "https://api.telegram.org/bot{BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-netlify-site.netlify.app/.netlify/functions/webhook"}'
```

## ✅ Testing the Deployment

### 1. Basic Functionality Test

Test basic bot functionality:

```
/start
/test
/health
```

### 2. Tracking System Test

Test the tracking system:

```
# Start tracking
도비야, 대화 추적 시작해줘

# Send some test messages
안녕하세요!
테스트 메시지입니다.
이것은 추적될 메시지입니다.

# Check status  
도비야, 상태

# Generate summary
도비야, 요약해줘

# Stop tracking
도비야, 대화 추적 그만해줘
```

### 3. Command Tests

Test all command variations:

```
# Slash commands
/track_start
/track_status  
/summarize
/track_stop

# Natural language commands
도비야, 대화 추적 시작해줘
도비야, 대화 추적 그만해줘  
도비야, 요약해줘
도비야, 상태
```

## 🔍 Monitoring & Maintenance

### 1. Health Checks

Monitor system health:

```bash
# Check system health
/health

# Run maintenance 
/maintenance
```

### 2. Database Monitoring

Monitor key metrics:

```sql
-- Active tracking sessions
SELECT COUNT(*) as active_sessions 
FROM tracking_sessions 
WHERE status = 'active';

-- Messages tracked today
SELECT COUNT(*) as messages_today
FROM tracked_messages 
WHERE tracking_recorded_at >= CURRENT_DATE;

-- Summaries generated today
SELECT COUNT(*) as summaries_today
FROM conversation_summaries 
WHERE created_at >= CURRENT_DATE;
```

### 3. Automated Cleanup

Set up scheduled cleanup (run weekly):

```sql
-- Cleanup old data (keeps 30 days)
SELECT cleanup_old_tracking_data(30);

-- Expire old sessions
SELECT expire_old_tracking_sessions();
```

## 📝 Usage Instructions for Users

### Commands Available

**Natural Language (Recommended):**
- `도비야, 대화 추적 시작해줘` - Start tracking messages
- `도비야, 대화 추적 그만해줘` - Stop tracking messages  
- `도비야, 요약해줘` - Generate conversation summary
- `도비야, 상태` - Check tracking status

**Slash Commands:**
- `/track_start` - Start tracking
- `/track_stop` - Stop tracking
- `/summarize` - Generate summary
- `/track_status` - Check status

### How It Works

1. **Individual Control**: Each user controls their own tracking independently
2. **Smart Filtering**: Only meaningful messages are tracked (filters out short responses, commands, etc.)
3. **Automatic Cleanup**: Messages are cleaned up after summarization
4. **Session Expiry**: Sessions automatically expire after 7 days
5. **Error Recovery**: System automatically recovers from errors

## 🚨 Troubleshooting

### Common Issues

**"Database connection failed"**
- Check `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Verify database is accessible
- Run `/health` to check system status

**"Tracking session not found"**  
- User may not have active tracking session
- Run `/maintenance` to recover orphaned sessions
- Check with `/track_status`

**"Claude API error"**
- Verify `CLAUDE_API_KEY` is valid
- Check API rate limits
- Run `/health` to verify API connectivity

**"No messages to summarize"**
- Ensure tracking was active during conversation
- Check that meaningful messages exist (not just short responses)
- Verify session hasn't expired

### Recovery Commands

```bash
# System recovery
/maintenance    # Fixes data inconsistencies
/health        # Checks system status

# Manual cleanup (if needed)
SELECT expire_old_tracking_sessions();
SELECT cleanup_old_tracking_data(7); -- Keep 7 days
```

## 📈 Performance Optimization

### Database Optimization

```sql
-- Monitor slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%tracking%'
ORDER BY mean_time DESC;

-- Index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename IN ('tracking_sessions', 'tracked_messages');
```

### Rate Limiting

The system includes built-in rate limiting:
- Max 5 concurrent sessions per user
- Max 10 summaries per user per day
- Session auto-expire after 7 days

## 🔒 Security Considerations

1. **Row Level Security**: Enable RLS on sensitive tables
2. **API Key Management**: Store keys securely in environment variables
3. **Input Validation**: All user inputs are validated and sanitized
4. **Error Handling**: Errors don't expose sensitive information

## 📚 API Documentation

### Tracking Service

```typescript
// Start tracking
await trackingService.startTracking({
  user_id: 12345,
  chat_id: -67890,
  username: "user123",
  first_name: "John"
});

// Track message
await trackingService.trackMessage({
  session_id: "uuid",
  chat_id: -67890,
  message_id: 123,
  user_id: 12345,
  content: "Hello world",
  message_timestamp: new Date()
});

// Generate summary
const result = await summarizationService.generateSummary({
  user_id: 12345,
  chat_id: -67890,
  summary_language: "ko"
});
```

## 🎯 Success Metrics

Monitor these metrics for system health:

- **Active Sessions**: Number of users currently tracking
- **Summary Generation**: Summaries created per day/week
- **Error Rate**: Percentage of failed operations
- **Response Time**: Average time for summary generation
- **User Engagement**: Number of unique users using tracking

## 🆘 Support

For issues:

1. Check logs in Netlify Functions
2. Run system health check: `/health`
3. Try maintenance recovery: `/maintenance`  
4. Check database connectivity and API keys
5. Review error logs in `bot_activity_log` table

---

## 🎉 Congratulations!

Your chat tracking and summarization system is now deployed and ready to use! The system provides:

✅ **Per-user conversation tracking**  
✅ **AI-powered smart summarization**  
✅ **Dobby personality interactions**  
✅ **Automatic data management**  
✅ **Comprehensive error handling**  
✅ **Production-ready monitoring**  

Users can now track important conversations and get intelligent summaries with simple, natural language commands!