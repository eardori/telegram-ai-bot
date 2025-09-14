-- Fix missing prompts for Dobby image generation

-- 1. dobby_processing_image prompt
INSERT INTO prompts (prompt_type, prompt_name, prompt_text, template_variables, metadata)
VALUES (
    'custom',
    'dobby_processing_image',
    '🧙‍♀️ **도비가 그림을 그리고 있습니다!**

🎨 주인님의 요청: "{user_input}"
✨ 도비가 마법으로 그림을 만들고 있어요...

⚡ 잠시만 기다려주세요!',
    '["user_input"]',
    '{"description": "Dobby processing message for image generation", "language": "Korean"}'
)
ON CONFLICT (prompt_type, prompt_name) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    template_variables = EXCLUDED.template_variables,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- 2. dobby_image_generation prompt (SIMPLIFIED FOR SPEED)
INSERT INTO prompts (prompt_type, prompt_name, prompt_text, template_variables, metadata)
VALUES (
    'image_generation',
    'dobby_image_generation',
    '{user_request}',
    '["user_request"]',
    '{"description": "Dobby style image generation prompt - simplified for faster generation", "style": "direct", "quality": "balanced"}'
)
ON CONFLICT (prompt_type, prompt_name) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    template_variables = EXCLUDED.template_variables,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- 3. dobby_success_image prompt
INSERT INTO prompts (prompt_type, prompt_name, prompt_text, template_variables, metadata)
VALUES (
    'custom',
    'dobby_success_image',
    '🧙‍♀️ **도비가 그림을 완성했습니다!**

🎨 주인님의 요청: "{user_input}"
💰 비용: {cost}
⏱️ 처리시간: {processing_time}ms
📅 {timestamp}

✨ 도비는 주인님이 마음에 들어하시길 바랍니다!',
    '["user_input", "cost", "processing_time", "timestamp"]',
    '{"description": "Dobby success message for image generation", "language": "Korean"}'
)
ON CONFLICT (prompt_type, prompt_name) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    template_variables = EXCLUDED.template_variables,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- 4. dobby_processing_qa prompt
INSERT INTO prompts (prompt_type, prompt_name, prompt_text, template_variables, metadata)
VALUES (
    'custom',
    'dobby_processing_qa',
    '🧙‍♀️ **도비가 생각하고 있습니다...**

💭 주인님의 질문: "{question}"
📚 도비가 열심히 답을 찾고 있어요...

⚡ 잠시만 기다려주세요!',
    '["question"]',
    '{"description": "Dobby processing message for Q&A", "language": "Korean"}'
)
ON CONFLICT (prompt_type, prompt_name) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    template_variables = EXCLUDED.template_variables,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- 5. dobby_success_qa prompt
INSERT INTO prompts (prompt_type, prompt_name, prompt_text, template_variables, metadata)
VALUES (
    'custom',
    'dobby_success_qa',
    '🧙‍♀️ **도비가 답변을 준비했습니다!**

💭 주인님의 질문: "{question}"

📝 도비의 답변:
{answer}

✨ 도움이 되셨기를 바랍니다, 주인님!',
    '["question", "answer"]',
    '{"description": "Dobby success message for Q&A", "language": "Korean"}'
)
ON CONFLICT (prompt_type, prompt_name) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    template_variables = EXCLUDED.template_variables,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Verify the prompts were created
SELECT prompt_name, prompt_type, is_active
FROM prompts
WHERE prompt_name LIKE 'dobby_%';