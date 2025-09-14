-- EMERGENCY FIX: Run immediately on Supabase

-- 1. Add missing column
ALTER TABLE tracked_messages
ADD COLUMN IF NOT EXISTS contains_url BOOLEAN DEFAULT FALSE;

-- 2. Add missing prompt (simplified for speed)
INSERT INTO prompts (prompt_type, prompt_name, prompt_text, template_variables, metadata)
VALUES (
    'image_generation',
    'image_generation_enhanced',
    '{user_request}',
    '["user_request"]',
    '{"description": "Enhanced image generation - simplified for speed", "style": "direct", "quality": "balanced"}'
)
ON CONFLICT (prompt_type, prompt_name) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    template_variables = EXCLUDED.template_variables,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- 3. Verify all prompts exist
SELECT prompt_name, prompt_type, LENGTH(prompt_text) as length
FROM prompts
WHERE prompt_type = 'image_generation'
ORDER BY prompt_name;

-- Expected:
-- dobby_image_generation
-- general_image_generation
-- image_generation_enhanced