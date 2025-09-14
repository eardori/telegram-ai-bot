# Dynamic Prompt Management System

## Overview

This system allows you to manage prompts for your Telegram bot dynamically through a Supabase database. You can update prompts without redeployment, track usage analytics, and maintain different prompt versions.

## Features

- **Dynamic Prompt Loading**: Prompts are fetched from the database on each API call
- **Template Processing**: Support for variable substitution in prompts
- **Fallback System**: If database is unavailable, fallback to hardcoded prompts
- **Usage Analytics**: Track prompt usage, performance, and success rates
- **Version Control**: Maintain multiple versions of prompts
- **Type Safety**: Full TypeScript support

## Database Setup

### 1. Run the Schema Migration

Execute the following SQL in your Supabase SQL editor:

```bash
# Copy and paste the contents of schema.sql into Supabase SQL editor
cat database/schema.sql
```

### 2. Insert Initial Data

Execute the following SQL to insert default prompts:

```bash
# Copy and paste the contents of initial-data.sql into Supabase SQL editor
cat database/initial-data.sql
```

### 3. Environment Variables

Add these environment variables to your Netlify deployment:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Prompt Types

The system supports the following prompt types:

1. **image_generation**: Basic image generation prompts
2. **qa_system**: Q&A system prompts 
3. **dobby_image**: Dobby character image generation
4. **dobby_qa**: Dobby character Q&A responses
5. **error_message**: Error message templates
6. **system_message**: System/status messages

## Key Features

### Template Variables

Prompts support template variables using `{variable_name}` syntax:

```sql
-- Example prompt template
INSERT INTO prompts (key, template, variables) VALUES (
  'greeting',
  'Hello {user_name}! Welcome to {bot_name}.',
  '{"user_name": "", "bot_name": "AI Bot"}'
);
```

### Fallback System

If the database is unavailable, the system automatically falls back to hardcoded prompts to ensure bot functionality is never interrupted.

### Usage Analytics

Every prompt usage is tracked with:
- Response time
- Success/failure status
- Input variables used
- User and chat identification

## Default Prompts

The system comes with these pre-configured prompts:

### Image Generation
- `image_generation_base`: Simple image generation
- `image_generation_enhanced`: Enhanced with quality parameters
- `dobby_image_generation`: Dobby character themed images

### Q&A System
- `qa_system_base`: Standard Korean Q&A
- `dobby_qa_system`: Dobby character Q&A
- `qa_programming`: Programming-focused Q&A
- `qa_creative`: Creative and inspirational Q&A

### System Messages
- `dobby_processing_image`: Dobby image processing message
- `dobby_processing_qa`: Dobby Q&A processing message
- `dobby_success_image`: Dobby image success message
- `dobby_success_qa`: Dobby Q&A success message

### Error Messages
- `error_image_generation`: Image generation error template
- `error_qa_system`: Q&A error template

## Usage Examples

### Updating a Prompt

```sql
UPDATE prompts 
SET template = 'New template with {variable}', 
    variables = '{"variable": "default_value"}'
WHERE key = 'your_prompt_key';
```

### Creating a New Prompt

```sql
INSERT INTO prompts (key, name, type, template, description, variables) VALUES (
  'custom_prompt',
  'My Custom Prompt',
  'qa_system',
  'Answer this question: {question}',
  'Custom prompt for specific use case',
  '{"question": ""}'
);
```

### Viewing Usage Analytics

```sql
SELECT 
  p.key,
  p.name,
  COUNT(pu.*) as usage_count,
  AVG(pu.response_time_ms) as avg_response_time,
  (COUNT(CASE WHEN pu.success THEN 1 END) * 100.0 / COUNT(*)) as success_rate
FROM prompts p
LEFT JOIN prompt_usage pu ON p.id = pu.prompt_id
WHERE pu.used_at >= NOW() - INTERVAL '7 days'
GROUP BY p.id, p.key, p.name
ORDER BY usage_count DESC;
```

## API Integration

The bot automatically uses the new dynamic prompt system. Key functions:

- `getImagePrompt(userInput, style?)`: Get enhanced image generation prompt
- `getDobbyImagePrompt(userInput)`: Get Dobby-themed image prompt
- `getQAPrompt(question, isDobby?)`: Get Q&A prompt with settings
- `getSystemMessage(key, variables)`: Get system message with variables

## Best Practices

1. **Testing**: Always test prompt changes in a development environment first
2. **Versioning**: Keep track of prompt versions for rollback capabilities
3. **Analytics**: Monitor usage analytics to optimize prompt performance
4. **Fallbacks**: Ensure fallback prompts are always available
5. **Variables**: Use template variables for dynamic content
6. **Clear Naming**: Use descriptive keys and names for easy identification

## Troubleshooting

### Database Connection Issues
- Verify SUPABASE_URL and SUPABASE_ANON_KEY environment variables
- Check Supabase project status
- Review RLS (Row Level Security) policies

### Prompt Not Found
- Verify the prompt key exists in the database
- Check that the prompt status is 'active'
- Ensure RLS policies allow access

### Template Processing Errors
- Verify all required variables are provided
- Check template syntax for correct `{variable}` format
- Review variable types and defaults

## Security Considerations

- RLS policies are enabled on both tables
- Use environment variables for sensitive configuration
- Monitor usage logs for unusual patterns
- Regularly review and update prompt content for safety