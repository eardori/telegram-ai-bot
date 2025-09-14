-- URGENT: Simplify image generation prompts for faster response
-- Run this IMMEDIATELY on Supabase to fix timeout issues

-- 1. Simplify Dobby image generation prompt
UPDATE prompts
SET
    prompt_text = '{user_request}',
    metadata = '{"description": "Simplified for speed - direct pass-through", "style": "direct", "quality": "balanced", "updated_reason": "Netlify 10s timeout fix"}',
    updated_at = NOW()
WHERE prompt_name = 'dobby_image_generation'
AND prompt_type = 'image_generation';

-- 2. Add/Update general image generation prompt (simplified)
INSERT INTO prompts (prompt_type, prompt_name, prompt_text, template_variables, metadata)
VALUES (
    'image_generation',
    'general_image_generation',
    '{user_request}',
    '["user_request"]',
    '{"description": "General image generation - simplified for speed", "style": "direct", "quality": "balanced"}'
)
ON CONFLICT (prompt_type, prompt_name) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    template_variables = EXCLUDED.template_variables,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- 3. Verify the changes
SELECT
    prompt_name,
    prompt_type,
    LENGTH(prompt_text) as prompt_length,
    prompt_text,
    metadata->>'updated_reason' as update_reason
FROM prompts
WHERE prompt_type = 'image_generation'
ORDER BY prompt_name;

-- Expected result:
-- Both prompts should now be just '{user_request}' (length ~15)
-- Previous complex prompts were 100+ characters