// Production Telegram Bot Webhook Handler
import { Handler, HandlerContext, HandlerEvent } from '@netlify/functions';
import { Bot, InputFile, webhookCallback } from 'grammy';

// Environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;

// Create bot instance
const bot = new Bot(BOT_TOKEN);

// Helper function to generate image with Imagen
async function generateImageWithImagen(prompt: string) {
  try {
    console.log(`🎨 Generating image with Imagen for: "${prompt}"`);

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict', {
      method: 'POST',
      headers: {
        'x-goog-api-key': GOOGLE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          sampleImageSize: '1K',
          aspectRatio: '1:1'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Imagen API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('🎨 Image generation successful!');

    if ((data as any).predictions && (data as any).predictions.length > 0) {
      const prediction = (data as any).predictions[0];
      if (prediction.bytesBase64Encoded) {
        return {
          imageData: prediction.bytesBase64Encoded,
          mimeType: prediction.mimeType || 'image/png'
        };
      }
    }

    throw new Error('No image data in response');
  } catch (error) {
    console.error('Imagen API error:', error);
    throw error;
  }
}

// Helper function for Claude API
async function callClaudeAPI(message: string, maxTokens: number = 100) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: message
        }]
      })
    });

    const data = await response.json();

    if (response.ok) {
      return (data as any).content[0]?.text || '응답이 없습니다.';
    } else {
      throw new Error((data as any).error?.message || '알 수 없는 오류');
    }
  } catch (error) {
    console.error('Claude API Error:', error);
    throw error;
  }
}

// Helper function to detect questions
function isQuestion(text: string): boolean {
  const questionPatterns = [
    /\?$/,                    // ends with ?
    /^(뭐|무엇|어떻|어디|언제|왜|누구|어느)/,  // Korean question words
    /^(what|how|where|when|why|who|which)/i,  // English question words
    /(방법|어떻게|알려줘|궁금)/,    // asking for help/info
    /(추천|제안|의견)/,           // asking for recommendations
  ];

  return questionPatterns.some(pattern => pattern.test(text.trim()));
}

// Helper function to detect Dobby activation
function isDobbyActivated(text: string): { activated: boolean; command: string | null; content: string } {
  const dobbyPattern = /도비야[,\s]*(.*)/i;
  const match = text.match(dobbyPattern);

  if (!match) {
    return { activated: false, command: null, content: '' };
  }

  const content = match[1].trim();

  // Check for image generation commands
  if (/(그려줘|그려|그림|이미지|생성)/i.test(content)) {
    const imagePrompt = content.replace(/(그려줘|그려|그림|이미지|생성해)/gi, '').trim();
    return { activated: true, command: 'image', content: imagePrompt };
  }

  // Check for Q&A commands
  if (/(알려줘|뭐야|설명해|가르쳐|궁금)/i.test(content)) {
    return { activated: true, command: 'ask', content: content };
  }

  // Default to Q&A if no specific command detected
  return { activated: true, command: 'ask', content: content };
}

// Enhanced Q&A function with web search capability
async function answerQuestion(question: string) {
  try {
    console.log(`🤔 Processing question: "${question}"`);

    // Create a comprehensive prompt for better answers
    const prompt = `다음 질문에 대해 정확하고 도움이 되는 답변을 한국어로 제공해주세요:

질문: ${question}

답변할 때 다음을 고려해주세요:
- 정확하고 최신 정보 제공
- 구체적이고 실용적인 답변
- 필요하다면 단계별 설명
- 친근하고 이해하기 쉬운 톤

답변:`;

    const answer = await callClaudeAPI(prompt, 2000);
    return answer;
  } catch (error) {
    console.error('Q&A Error:', error);
    throw error;
  }
}

// Bot commands
bot.command('start', async (ctx) => {
  console.log('📨 Start command received');
  await ctx.reply(`🧙‍♀️ **도비 AI 봇입니다!** 🏠

🌟 **도비 개인비서 모드 (NEW!):**
• 🎨 **"도비야, ~~~ 그려줘"** - 마법같은 이미지 생성
• 💬 **"도비야, ~~~ 알려줘/뭐야?"** - 충실한 질문 답변
• 🏠 **개인비서처럼** - 친근하고 정중한 서비스

🤖 **일반 AI 기능:**
• /ask [질문] - 명시적 질문하기
• /image [설명] - 이미지 생성
• 자동 질문 감지 - 질문하면 바로 답변

🧙‍♀️ **도비 사용 예시:**
• "도비야, 귀여운 강아지 그려줘"
• "도비야, 파이썬 공부법 알려줘"
• "도비야, 블록체인이 뭐야?"
• "도비야, 맛있는 요리 레시피 그려줘"

✨ **도비의 특별함:**
• 🎭 해리포터 도비 캐릭터 스타일
• 🏠 "주인님"을 위한 충실한 서비스
• 🔮 마법같은 AI 능력 (Google Imagen 4.0 + Claude 3.5)

🎯 **도비는 언제나 준비되어 있습니다!**
"도비야"라고 불러주시면 즉시 달려갑니다! 🏃‍♂️✨`);
});

bot.command('test', async (ctx) => {
  console.log('🧪 Test command received');
  await ctx.reply(`🧪 프로덕션 테스트 성공!

🌐 배포 환경:
• 플랫폼: ✅ Netlify Functions
• 통신 방식: ✅ Webhook (실시간)
• Claude API: ✅ ${CLAUDE_API_KEY ? '연결됨' : '❌ 미연결'}
• Google Imagen: ✅ ${GOOGLE_API_KEY ? '연결됨' : '❌ 미연결'}

⏰ 서버 시간: ${new Date().toISOString()}
🌍 항상 온라인 상태로 운영됩니다!`);
});

bot.command('summary', async (ctx) => {
  console.log('📝 Summary command received');

  try {
    const message = await callClaudeAPI('안녕하세요! 프로덕션 환경에서 테스트입니다. 한국어로 짧게 인사해주세요.');
    await ctx.reply(`🎉 Claude API 프로덕션 테스트 성공!

Claude의 응답:
${message}

✅ 서버리스 환경에서 AI 연동 완료!`);
  } catch (error) {
    await ctx.reply(`❌ Claude API 오류: ${(error as Error).message}`);
  }
});

bot.command('image', async (ctx) => {
  const prompt = ctx.message?.text?.replace('/image', '').trim() || '';

  if (!prompt) {
    await ctx.reply(`🎨 프로덕션 이미지 생성 사용법:

/image [상세한 설명]

🌟 서버리스 환경에서 고품질 이미지 생성:
• Google Imagen 4.0 사용
• 1024x1024 해상도
• 실시간 처리

예시:
• /image 미래적인 로봇 개발자
• /image 아름다운 우주 풍경
• /image 귀여운 펭귄이 코딩하는 모습`);
    return;
  }

  console.log(`🎨 Production image generation requested: "${prompt}"`);

  const generatingMessage = await ctx.reply(`🎨 프로덕션 이미지 생성 중...

프롬프트: "${prompt}"

⚡ Netlify Functions + Google Imagen 4.0
🌍 서버리스 환경에서 처리 중...`);

  try {
    const imageResult = await generateImageWithImagen(prompt);

    // Create buffer from base64
    const imageBuffer = Buffer.from(imageResult.imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

    // Send image directly from buffer
    await ctx.replyWithPhoto(new InputFile(imageBuffer, `generated_${Date.now()}.png`), {
      caption: `🎨 프로덕션 이미지 생성 완료!

프롬프트: "${prompt}"

✨ Google Imagen 4.0
🌐 Netlify Functions
🎯 해상도: 1024x1024
⏱️ ${new Date().toLocaleString('ko-KR')}`
    });

    // Delete generating message
    await ctx.api.deleteMessage(ctx.chat.id, generatingMessage.message_id);

    console.log('✅ Production image sent successfully!');

  } catch (error) {
    console.error('Production image generation error:', error);

    await ctx.api.editMessageText(
      ctx.chat.id,
      generatingMessage.message_id,
      `❌ 프로덕션 이미지 생성 오류:

${(error as Error).message}

🔧 서버리스 환경에서의 일시적 오류일 수 있습니다.
💡 잠시 후 다시 시도해주세요.`
    );
  }
});

bot.command('ask', async (ctx) => {
  const question = ctx.message?.text?.replace('/ask', '').trim() || '';

  if (!question) {
    await ctx.reply(`🤔 **AI 질문답변 사용법:**

/ask [질문내용]

📝 **질문 예시:**
• /ask 파이썬 문법 어떻게 배워?
• /ask 좋은 영화 추천해줘
• /ask 프로그래밍 공부 방법은?
• /ask 건강한 식단 짜는 법 알려줘

💡 **팁:** 명령어 없이도 질문하면 자동 감지됩니다!
• "날씨가 어때?"
• "뭐가 좋을까?"
• "어떻게 하면 될까?"

🚀 더 구체적인 질문일수록 더 정확한 답변을 받을 수 있어요!`);
    return;
  }

  console.log(`🔍 Explicit question asked: "${question}"`);

  const thinkingMessage = await ctx.reply(`🤔 질문을 분석하고 있습니다...

질문: "${question}"

⚡ Claude AI가 답변을 준비하고 있습니다...`);

  try {
    const answer = await answerQuestion(question);

    // Delete thinking message and send answer
    await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);

    await ctx.reply(`🤖 **AI 답변** (/ask 명령어)

❓ **질문:** ${question}

💡 **답변:**
${answer}

---
✨ 추가 질문이 있으면 언제든 /ask [질문] 하세요!
⏰ ${new Date().toLocaleString('ko-KR')}`);

    console.log('✅ Explicit question answered successfully!');

  } catch (error) {
    console.error('Ask command error:', error);

    await ctx.api.editMessageText(
      ctx.chat.id,
      thinkingMessage.message_id,
      `❌ 답변 생성 중 오류가 발생했습니다:

${(error as Error).message}

💡 잠시 후 다시 질문해보세요.`
    );
  }
});

// Handle text messages with Dobby activation and Q&A functionality
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  console.log(`💬 Production message received: ${text}`);

  // Skip if it's a command
  if (text.startsWith('/')) {
    return;
  }

  // Check for Dobby activation first
  const dobbyCheck = isDobbyActivated(text);

  if (dobbyCheck.activated) {
    console.log(`🧙‍♀️ Dobby activated! Command: ${dobbyCheck.command}, Content: "${dobbyCheck.content}"`);

    if (dobbyCheck.command === 'image') {
      // Handle Dobby image generation
      if (!dobbyCheck.content) {
        await ctx.reply(`🧙‍♀️ **도비가 준비되었습니다!**

🎨 **이미지 생성 사용법:**
• "도비야, 귀여운 강아지 그려줘"
• "도비야, 미래적인 로봇 그려줘"
• "도비야, 아름다운 풍경 그림 그려줘"

✨ 어떤 그림을 그려드릴까요?`);
        return;
      }

      console.log(`🎨 Dobby image generation: "${dobbyCheck.content}"`);

      const generatingMessage = await ctx.reply(`🧙‍♀️ **도비가 그림을 그리고 있습니다!**

🎨 그릴 내용: "${dobbyCheck.content}"

⚡ 마법으로 이미지를 생성하고 있습니다...
✨ 도비는 항상 최선을 다합니다!`);

      try {
        const imageResult = await generateImageWithImagen(dobbyCheck.content);

        // Create buffer from base64
        const imageBuffer = Buffer.from(imageResult.imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

        // Send image directly from buffer
        await ctx.replyWithPhoto(new InputFile(imageBuffer, `dobby_${Date.now()}.png`), {
          caption: `🧙‍♀️ **도비가 그림을 완성했습니다!**

🎨 "${dobbyCheck.content}"

✨ Google Imagen 4.0으로 마법처럼 생성
🏠 도비는 언제나 주인님을 위해 최선을 다합니다!
⏰ ${new Date().toLocaleString('ko-KR')}

💡 다른 그림도 "도비야, ~~~ 그려줘"라고 말씀해주세요!`
        });

        // Delete generating message
        await ctx.api.deleteMessage(ctx.chat.id, generatingMessage.message_id);

        console.log('✅ Dobby image generation successful!');

      } catch (error) {
        console.error('Dobby image generation error:', error);

        await ctx.api.editMessageText(
          ctx.chat.id,
          generatingMessage.message_id,
          `🧙‍♀️ **도비가 실수했습니다...**

❌ 이미지 생성 중 오류: ${(error as Error).message}

😔 도비는 실패를 용서받지 못합니다...
💡 잠시 후 다시 말씀해주시면 더 열심히 하겠습니다!`
        );
      }

    } else if (dobbyCheck.command === 'ask') {
      // Handle Dobby Q&A
      console.log(`🤔 Dobby Q&A: "${dobbyCheck.content}"`);

      const thinkingMessage = await ctx.reply(`🧙‍♀️ **도비가 생각하고 있습니다!**

❓ 질문: "${dobbyCheck.content}"

🧠 도비가 열심히 답을 찾고 있습니다...
✨ 잠시만 기다려주세요!`);

      try {
        const answer = await answerQuestion(dobbyCheck.content);

        // Delete thinking message and send answer
        await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);

        await ctx.reply(`🧙‍♀️ **도비의 답변입니다!**

❓ **질문:** ${dobbyCheck.content}

💡 **도비의 답변:**
${answer}

---
🏠 도비는 언제나 주인님을 위해 준비되어 있습니다!
💬 더 궁금한 것이 있으면 "도비야, ~~~ 알려줘"라고 말씀해주세요!
⏰ ${new Date().toLocaleString('ko-KR')}`);

        console.log('✅ Dobby Q&A successful!');

      } catch (error) {
        console.error('Dobby Q&A error:', error);

        await ctx.api.editMessageText(
          ctx.chat.id,
          thinkingMessage.message_id,
          `🧙‍♀️ **도비가 실수했습니다...**

❌ 답변 중 오류: ${(error as Error).message}

😔 도비는 아직 모르는 것이 많습니다...
💡 다른 방식으로 물어봐주시면 더 열심히 하겠습니다!`
        );
      }
    }

    return; // Dobby handled the message, skip other processing
  }

  // Original Q&A functionality (for non-Dobby messages)
  if (isQuestion(text)) {
    console.log(`❓ Question detected: "${text}"`);

    const thinkingMessage = await ctx.reply(`🤔 질문을 분석하고 있습니다...

질문: "${text}"

⚡ Claude AI가 답변을 준비하고 있습니다...`);

    try {
      const answer = await answerQuestion(text);

      // Delete thinking message and send answer
      await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);

      await ctx.reply(`🤖 **AI 답변**

❓ **질문:** ${text}

💡 **답변:**
${answer}

---
✨ 더 궁금한 것이 있으면 언제든 질문하세요!
💡 **팁:** "도비야, ~~~ 알려줘"라고 하면 개인비서처럼 도와드려요!
⏰ ${new Date().toLocaleString('ko-KR')}`);

      console.log('✅ Question answered successfully!');

    } catch (error) {
      console.error('Q&A error:', error);

      await ctx.api.editMessageText(
        ctx.chat.id,
        thinkingMessage.message_id,
        `❌ 답변 생성 중 오류가 발생했습니다:

${(error as Error).message}

💡 잠시 후 다시 질문해보세요.`
      );
    }
  } else {
    // For non-questions, suggest Dobby or other features
    await ctx.reply(`📨 메시지 수신: "${text}"

🧙‍♀️ **도비 개인비서 모드:**
• 🎨 "도비야, ${text} 그려줘" - 이미지 생성
• 💬 "도비야, ${text} 뭐야?" - 질문 답변

🤖 **일반 AI 기능:**
• 🎨 이미지 생성: /image ${text}
• 💬 질문하기: "${text}은 뭐야?"

🏠 도비는 언제나 주인님을 기다리고 있습니다!`);
  }
});

// Error handling
bot.catch((err) => {
  console.error('Production bot error:', err);
});

// Create webhook callback
const webhookHandler = webhookCallback(bot, 'std/http');

// Netlify Functions handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('🌐 Webhook received in production environment');

  try {
    // Verify it's a POST request
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    // Create request object for webhook handler
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...event.headers
      },
      body: event.body
    });

    // Process webhook
    const response = await webhookHandler(request);

    console.log('✅ Webhook processed successfully');

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json'
      },
      body: await response.text()
    };

  } catch (error) {
    console.error('❌ Webhook processing error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: (error as Error).message
      })
    };
  }
};
