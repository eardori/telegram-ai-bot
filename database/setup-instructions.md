# Setup Instructions for Dynamic Prompt Management

## Quick Start

### 1. Create Database Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of `database/schema.sql`
4. Click **Run** to execute the schema

### 2. Insert Initial Prompts

1. In the same SQL Editor
2. Copy and paste the entire contents of `database/initial-data.sql`
3. Click **Run** to insert default prompts

### 3. Configure Environment Variables

Add these to your Netlify environment variables:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Deploy Updated Code

Deploy your updated webhook.ts with the dynamic prompt integration.

## Verification

### Test Database Connection

Run this query in Supabase SQL Editor to verify setup:

```sql
-- Check if prompts were inserted correctly
SELECT key, name, type, status FROM prompts WHERE status = 'active';

-- Should return 12+ prompts including:
-- - image_generation_base
-- - dobby_image_generation  
-- - qa_system_base
-- - dobby_qa_system
-- etc.
```

### Test Prompt Retrieval

You can test individual prompts:

```sql
-- Test specific prompt
SELECT * FROM prompts WHERE key = 'dobby_image_generation';

-- Test template processing (manually)
SELECT 
  key,
  template,
  variables
FROM prompts 
WHERE key = 'qa_system_base';
```

## Environment Variable Setup

### Netlify Dashboard

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** > **Environment variables**
3. Add the following variables:

| Variable | Value | Description |
|----------|--------|-------------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI...` | Your Supabase anonymous key |

### Finding Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **API**
3. Copy the **Project URL** (for `SUPABASE_URL`)
4. Copy the **anon public** key (for `SUPABASE_ANON_KEY`)

## Testing the System

### 1. Deploy and Test Bot

After deployment, test these commands:

```
/image cute cat drawing
도비야, 귀여운 강아지 그려줘
/ask 파이썬 공부 방법 알려줘
도비야, 블록체인이 뭐야?
```

### 2. Check Usage Analytics

Monitor prompt usage in Supabase:

```sql
-- View recent prompt usage
SELECT 
  p.key,
  p.name,
  pu.used_at,
  pu.success,
  pu.response_time_ms
FROM prompt_usage pu
JOIN prompts p ON p.id = pu.prompt_id
ORDER BY pu.used_at DESC
LIMIT 20;
```

### 3. Monitor Logs

Check your Netlify function logs for:
- `🔍 Fetching prompt: [key]`
- `✅ Prompt fetched: [name]`
- `⚠️ Falling back to hardcoded prompt`

## Customizing Prompts

### Update Existing Prompt

```sql
UPDATE prompts 
SET 
  template = 'Your new template with {variables}',
  variables = '{"new_variable": "default_value"}',
  description = 'Updated description'
WHERE key = 'your_prompt_key';
```

### Add New Prompt

```sql
INSERT INTO prompts (key, name, type, template, description, variables, max_tokens, temperature) 
VALUES (
  'my_custom_prompt',
  'My Custom Prompt', 
  'qa_system',
  'Please answer: {question}. Consider: {context}',
  'Custom prompt for specific use case',
  '{"question": "", "context": "general knowledge"}',
  1500,
  0.8
);
```

### Create Prompt Variations

```sql
-- Create a creative version of Q&A
INSERT INTO prompts (key, name, type, template, description, variables, temperature) 
VALUES (
  'qa_creative_writing',
  'Creative Writing Q&A',
  'qa_system',
  '창의적이고 영감을 주는 답변을 제공해주세요: {question}

답변 시 포함할 요소:
- 독창적인 아이디어와 관점
- 구체적인 예시와 스토리
- 감정적 연결과 공감
- 실용적인 조치 방안

답변:',
  'Creative and inspirational Q&A responses',
  '{"question": ""}',
  1.2  -- Higher temperature for more creativity
);
```

## Monitoring and Maintenance

### Performance Monitoring

```sql
-- Prompt performance analysis
SELECT 
  p.key,
  p.name,
  COUNT(*) as usage_count,
  AVG(pu.response_time_ms) as avg_response_time,
  (COUNT(CASE WHEN pu.success THEN 1 END)::float / COUNT(*) * 100) as success_rate
FROM prompts p
LEFT JOIN prompt_usage pu ON p.id = pu.prompt_id
WHERE pu.used_at >= NOW() - INTERVAL '7 days'
GROUP BY p.id, p.key, p.name
HAVING COUNT(*) > 0
ORDER BY usage_count DESC;
```

### Error Analysis

```sql
-- Check for failed prompts
SELECT 
  p.key,
  p.name,
  pu.error_message,
  pu.input_variables,
  pu.used_at
FROM prompt_usage pu
JOIN prompts p ON p.id = pu.prompt_id
WHERE pu.success = false
  AND pu.used_at >= NOW() - INTERVAL '24 hours'
ORDER BY pu.used_at DESC;
```

### Clean Up Old Usage Data

```sql
-- Delete usage data older than 30 days
DELETE FROM prompt_usage 
WHERE used_at < NOW() - INTERVAL '30 days';
```

## Troubleshooting

### Common Issues

1. **"Prompt not found" errors**
   - Check if prompt exists: `SELECT * FROM prompts WHERE key = 'your_key'`
   - Verify prompt status is 'active'

2. **Template processing errors**
   - Verify variable syntax: `{variable_name}`
   - Check that all required variables are provided

3. **Database connection issues**
   - Verify environment variables are set correctly
   - Check Supabase project status
   - Review RLS policies

4. **Fallback prompts being used**
   - Check network connectivity to Supabase
   - Verify API keys and permissions
   - Review function logs for specific errors

### Recovery Procedures

If the database becomes unavailable, the system will automatically use fallback prompts. To restore full functionality:

1. Check Supabase project status
2. Verify environment variables
3. Test database connection manually
4. Review and update RLS policies if needed

## Advanced Usage

### A/B Testing Prompts

```sql
-- Create two versions of the same prompt
INSERT INTO prompts (key, name, template, description) VALUES
('qa_system_v1', 'Q&A System v1', 'Standard template...', 'Original version'),
('qa_system_v2', 'Q&A System v2', 'Enhanced template...', 'Improved version');

-- Randomly choose between versions in your code
-- Then analyze performance to determine the winner
```

### Scheduled Prompt Updates

You can create scheduled functions in Supabase to automatically update prompts:

```sql
-- Example: Automatically archive old prompts
CREATE OR REPLACE FUNCTION archive_old_prompts()
RETURNS void AS $$
BEGIN
  UPDATE prompts 
  SET status = 'archived'
  WHERE updated_at < NOW() - INTERVAL '90 days'
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to run this function
SELECT cron.schedule('archive-old-prompts', '0 2 * * 0', 'SELECT archive_old_prompts();');
```