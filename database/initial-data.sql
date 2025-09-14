-- Initial prompt data for Telegram Bot
-- Insert default prompts for immediate use

-- Image Generation Prompts
INSERT INTO prompts (key, name, type, template, description, variables, max_tokens) VALUES 
(
    'image_generation_base',
    'Basic Image Generation',
    'image_generation',
    '{user_input}',
    'Direct image generation prompt without modifications',
    '{"user_input": ""}',
    1
),
(
    'image_generation_enhanced',
    'Enhanced Image Generation with Style',
    'image_generation',
    'Create a high-quality, detailed image of: {user_input}. Style: {style}. Quality: professional, sharp focus, highly detailed, 8k resolution.',
    'Enhanced image generation with quality and style improvements',
    '{"user_input": "", "style": "photorealistic"}',
    1
),
(
    'dobby_image_generation',
    'Dobby Character Image Generation',
    'dobby_image',
    'Create a magical, high-quality image of: {user_input}. Style: Harry Potter universe inspired, magical atmosphere, detailed, fantasy art, 8k resolution.',
    'Image generation with Dobby character context and magical theme',
    '{"user_input": ""}',
    1
);

-- Q&A System Prompts
INSERT INTO prompts (key, name, type, template, description, variables, max_tokens, temperature) VALUES 
(
    'qa_system_base',
    'Basic Q&A System',
    'qa_system',
    '다음 질문에 대해 정확하고 도움이 되는 답변을 한국어로 제공해주세요:

질문: {question}

답변할 때 다음을 고려해주세요:
- 정확하고 최신 정보 제공
- 구체적이고 실용적인 답변
- 필요하다면 단계별 설명
- 친근하고 이해하기 쉬운 톤

답변:',
    'Standard Korean Q&A prompt for general questions',
    '{"question": ""}',
    2000,
    0.7
),
(
    'dobby_qa_system',
    'Dobby Character Q&A',
    'dobby_qa',
    '도비는 충실한 하우스 엘프입니다. 주인님의 질문에 정중하고 도움이 되는 답변을 한국어로 드리겠습니다.

주인님의 질문: {question}

도비의 답변 방식:
- 정확하고 최신 정보를 제공합니다
- 구체적이고 실용적인 답변을 드립니다
- 필요시 단계별로 설명합니다
- 항상 정중하고 충실한 태도를 유지합니다
- "도비는...", "주인님께..." 등의 표현을 자연스럽게 사용합니다

도비의 답변:',
    'Dobby character Q&A with house-elf personality',
    '{"question": ""}',
    2000,
    0.8
);

-- Error Message Prompts
INSERT INTO prompts (key, name, type, template, description, variables, max_tokens) VALUES 
(
    'error_image_generation',
    'Image Generation Error Message',
    'error_message',
    '❌ 이미지 생성 중 오류가 발생했습니다: {error_message}

🔧 가능한 해결 방법:
• 잠시 후 다시 시도해주세요
• 더 간단한 설명으로 다시 요청해보세요
• 부적절한 내용이 포함되지 않았는지 확인해주세요

💡 도움이 필요하시면 /start 명령어로 사용법을 확인하세요.',
    'Error message template for image generation failures',
    '{"error_message": "알 수 없는 오류"}',
    500
),
(
    'error_qa_system',
    'Q&A System Error Message',
    'error_message',
    '❌ 답변 생성 중 오류가 발생했습니다: {error_message}

🔧 가능한 해결 방법:
• 잠시 후 다시 질문해보세요
• 더 구체적으로 질문해보세요
• 다른 방식으로 질문을 표현해보세요

💡 계속 문제가 발생하면 관리자에게 문의하세요.',
    'Error message template for Q&A system failures',
    '{"error_message": "알 수 없는 오류"}',
    500
);

-- System Message Prompts
INSERT INTO prompts (key, name, type, template, description, variables, max_tokens) VALUES 
(
    'dobby_processing_image',
    'Dobby Image Processing Message',
    'system_message',
    '🧙‍♀️ **도비가 그림을 그리고 있습니다!**

🎨 그릴 내용: "{user_input}"

⚡ 마법으로 이미지를 생성하고 있습니다...
✨ 도비는 항상 최선을 다합니다!',
    'Processing message while Dobby generates images',
    '{"user_input": ""}',
    200
),
(
    'dobby_processing_qa',
    'Dobby Q&A Processing Message',
    'system_message',
    '🧙‍♀️ **도비가 생각하고 있습니다!**

❓ 질문: "{question}"

🧠 도비가 열심히 답을 찾고 있습니다...
✨ 잠시만 기다려주세요!',
    'Processing message while Dobby processes Q&A',
    '{"question": ""}',
    200
),
(
    'dobby_success_image',
    'Dobby Image Success Message',
    'system_message',
    '🧙‍♀️ **도비가 그림을 완성했습니다!**

🎨 "{user_input}"

✨ Google Imagen 4.0으로 마법처럼 생성
🏠 도비는 언제나 주인님을 위해 최선을 다합니다!
⏰ {timestamp}

💡 다른 그림도 "도비야, ~~~ 그려줘"라고 말씀해주세요!',
    'Success message when Dobby completes image generation',
    '{"user_input": "", "timestamp": ""}',
    300
),
(
    'dobby_success_qa',
    'Dobby Q&A Success Message',
    'system_message',
    '🧙‍♀️ **도비의 답변입니다!**

❓ **질문:** {question}

💡 **도비의 답변:**
{answer}

---
🏠 도비는 언제나 주인님을 위해 준비되어 있습니다!
💬 더 궁금한 것이 있으면 "도비야, ~~~ 알려줘"라고 말씀해주세요!
⏰ {timestamp}',
    'Success message template for Dobby Q&A responses',
    '{"question": "", "answer": "", "timestamp": ""}',
    500
);

-- Advanced prompts for specific scenarios
INSERT INTO prompts (key, name, type, template, description, variables, max_tokens, temperature) VALUES 
(
    'qa_programming',
    'Programming Q&A',
    'qa_system',
    '프로그래밍 질문에 대해 전문적이고 실용적인 답변을 한국어로 제공해주세요:

질문: {question}

답변 시 포함할 요소:
- 정확한 기술적 설명
- 실제 사용 가능한 코드 예시 (가능한 경우)
- 모범 사례와 주의사항
- 추가 학습 자료나 참고 링크 제안
- 단계별 구현 방법

답변:',
    'Specialized prompt for programming and technical questions',
    '{"question": ""}',
    3000,
    0.6
),
(
    'qa_creative',
    'Creative Q&A',
    'qa_system',
    '창의적이고 영감을 주는 답변을 한국어로 제공해주세요:

질문: {question}

답변 특징:
- 창의적이고 독창적인 아이디어 제시
- 실용적이면서도 흥미로운 접근법
- 구체적인 예시와 함께 설명
- 긍정적이고 격려하는 톤
- 추가 아이디어나 발전 방향 제안

답변:',
    'Creative and inspirational Q&A prompt',
    '{"question": ""}',
    2500,
    1.0
);

-- Set all prompts as active initially
UPDATE prompts SET status = 'active' WHERE status IS NULL;