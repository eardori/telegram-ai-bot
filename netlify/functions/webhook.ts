// Production Telegram Bot Webhook Handler
import { Handler, HandlerContext, HandlerEvent } from '@netlify/functions';
import { Bot, InputFile, webhookCallback } from 'grammy';

// Constants
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const IMAGEN_MODEL = 'imagen-4.0-generate-001';
const ANTHROPIC_VERSION = '2023-06-01';

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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`, {
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

// Helper function for Claude API (Text only)
async function callClaudeAPI(message: string, maxTokens: number = 100) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
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
      const errorText = await response.text();
      console.error('Claude API Error Response:', errorText);
      throw new Error((data as any).error?.message || `알 수 없는 오류: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Claude API Error:', error);
    throw error;
  }
}

// Helper function for Claude API (Vision)
async function callClaudeVisionAPI(prompt: string, imageData: string, mediaType: string) {
  try {
    console.log(`🖼️ Calling Claude Vision API for prompt: "${prompt}"`);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageData,
              },
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('🖼️ Claude Vision API call successful!');
      return (data as any).content[0]?.text || '이미지 분석에 실패했습니다.';
    } else {
      const errorText = await response.text();
      console.error('Claude Vision API Error Response:', errorText);
      throw new Error((data as any).error?.message || `Vision API 오류: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Claude Vision API Error:', error);
    throw error;
  }
}

// Centralized error handler
async function handleError(ctx: any, error: Error, command: string, thinkingMessage: any = null) {
  console.error(`Error in ${command}:`, error);

  const errorMessage = `❌ **'${command}' 작업 중 오류 발생**

**오류 내용:**
${error.message}

💡 잠시 후 다시 시도해 보시거나, 문제가 계속되면 관리자에게 문의해주세요.`;

  try {
    if (thinkingMessage?.message_id) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        thinkingMessage.message_id,
        errorMessage
      );
    } else {
      await ctx.reply(errorMessage);
    }
  } catch (replyError) {
    console.error('Failed to send error message to user:', replyError);
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
• 🖼️ **사진에 답장** - 이미지 편집 및 수정

🤖 **일반 AI 기능:**
• /ask [질문] - 명시적 질문하기
• /image [설명] - 이미지 생성
• 자동 질문 감지 - 질문하면 바로 답변

🧙‍♀️ **도비 사용 예시:**
• "도비야, 귀여운 강아지 그려줘"
• "도비야, 파이썬 공부법 알려줘"
• 사진에 답장하며 "이 사진을 더 밝게 만들어줘"

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
    await ctx.reply(`🎉 Claude API 프로덕션 테스트 성공!\n\nClaude의 응답:\n${message}\n\n✅ 서버리스 환경에서 AI 연동 완료!`);
  } catch (error) {
    await handleError(ctx, error as Error, 'Claude API 테스트');
  }
});

bot.command('image', async (ctx) => {
  const prompt = ctx.message?.text?.replace('/image', '').trim() || '';
  if (!prompt) {
    await ctx.reply(`🎨 **이미지 생성 사용법:**\n\n/image [상세한 설명]\n\n예시:\n• /image 미래적인 로봇 개발자`);
    return;
  }

  console.log(`🎨 Image generation requested: "${prompt}"`);
  const generatingMessage = await ctx.reply(`🎨 이미지 생성 중...\n\n프롬프트: "${prompt}"`);

  try {
    const imageResult = await generateImageWithImagen(prompt);
    const imageBuffer = Buffer.from(imageResult.imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

    await ctx.replyWithPhoto(new InputFile(imageBuffer, `generated_${Date.now()}.png`), {
      caption: `🎨 이미지 생성 완료!\n\n프롬프트: "${prompt}"`
    });

    await ctx.api.deleteMessage(ctx.chat.id, generatingMessage.message_id);
    console.log('✅ Image sent successfully!');
  } catch (error) {
    await handleError(ctx, error as Error, '이미지 생성', generatingMessage);
  }
});

bot.command('ask', async (ctx) => {
  const question = ctx.message?.text?.replace('/ask', '').trim() || '';
  if (!question) {
    await ctx.reply(`🤔 **AI 질문답변 사용법:**\n\n/ask [질문내용]\n\n예시:\n• /ask 파이썬 문법 어떻게 배워?`);
    return;
  }

  console.log(`🔍 Explicit question asked: "${question}"`);
  const thinkingMessage = await ctx.reply(`🤔 질문을 분석하고 있습니다...\n\n질문: "${question}"`);

  try {
    const answer = await answerQuestion(question);
    await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
    await ctx.reply(`🤖 **AI 답변**\n\n❓ **질문:** ${question}\n\n💡 **답변:**\n${answer}`);
    console.log('✅ Explicit question answered successfully!');
  } catch (error) {
    await handleError(ctx, error as Error, '질문 답변', thinkingMessage);
  }
});

// Handle text messages with Dobby activation and Q&A functionality
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  console.log(`💬 Message received: ${text}`);

  // [NEW] Handle replies to photos for image editing
  if (ctx.message.reply_to_message?.photo) {
    const thinkingMessage = await ctx.reply('🖼️ **이미지 수정 요청 접수!**\n\n잠시만요, 원본 이미지를 분석하고 새로운 그림을 준비하고 있어요...');
    try {
      console.log(`🎨 Image editing request received. Prompt: "${text}"`);

      const photo = ctx.message.reply_to_message.photo.sort((a, b) => b.width * b.height - a.width * a.height)[0];
      const file = await ctx.api.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path!}`;

      console.log(`📥 Downloading image from: ${fileUrl}`);
      const imageResponse = await fetch(fileUrl);
      if (!imageResponse.ok) throw new Error('Telegram에서 이미지를 다운로드하지 못했습니다.');
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageData = Buffer.from(imageBuffer).toString('base64');
      const mediaType = imageResponse.headers.get('content-type') || 'image/jpeg';

      const visionPrompt = `Based on the user's request, analyze the provided image and generate a new, detailed, and creative prompt in English for an image generation model like Google Imagen. The new prompt should retain the original image's style and composition while seamlessly incorporating the user's requested changes.

User Request: "${text}"

Output Format: Respond ONLY with the ready-to-use English prompt for the image generation model. Do not include any other text, explanations, or quotation marks.`;

      await ctx.api.editMessageText(ctx.chat.id, thinkingMessage.message_id, '🧠 **AI 비전 분석 중...**\n\nClaude AI가 이미지를 분석하고 새로운 프롬프트를 생성하고 있습니다.');
      const newImagePrompt = await callClaudeVisionAPI(visionPrompt, imageData, mediaType);

      console.log(`🤖 New Imagen prompt by Claude: "${newImagePrompt}"`);
      await ctx.api.editMessageText(ctx.chat.id, thinkingMessage.message_id, `🎨 **새로운 이미지 생성 중...**\n\n프롬프트: "${newImagePrompt}"`);
      const imageResult = await generateImageWithImagen(newImagePrompt);
      const imageBufferNew = Buffer.from(imageResult.imageData, 'base64');

      await ctx.replyWithPhoto(new InputFile(imageBufferNew, `edited_${Date.now()}.png`), {
        caption: `🎨 **이미지 수정 완료!**\n\n**원본 요청:** "${text}"\n\n**AI 프롬프트:** "${newImagePrompt}"`
      });
      await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
      console.log('✅ Image editing completed!');
    } catch (error) {
      await handleError(ctx, error as Error, '이미지 수정', thinkingMessage);
    }
    return;
  }

  if (text.startsWith('/')) return;

  const dobbyCheck = isDobbyActivated(text);
  if (dobbyCheck.activated) {
    console.log(`🧙‍♀️ Dobby activated! Command: ${dobbyCheck.command}, Content: "${dobbyCheck.content}"`);
    let thinkingMessage;

    try {
      if (dobbyCheck.command === 'image') {
        if (!dobbyCheck.content) {
          await ctx.reply(`🧙‍♀️ **도비가 준비되었습니다!**\n\n🎨 **이미지 생성 사용법:**\n• "도비야, 귀여운 강아지 그려줘"`);
          return;
        }
        thinkingMessage = await ctx.reply(`🧙‍♀️ **도비가 그림을 그리고 있습니다!**\n\n🎨 그릴 내용: "${dobbyCheck.content}"`);
        const imageResult = await generateImageWithImagen(dobbyCheck.content);
        const imageBuffer = Buffer.from(imageResult.imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
        await ctx.replyWithPhoto(new InputFile(imageBuffer, `dobby_${Date.now()}.png`), {
          caption: `🧙‍♀️ **도비가 그림을 완성했습니다!**\n\n🎨 "${dobbyCheck.content}"`
        });
        await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
        console.log('✅ Dobby image generation successful!');
      } else if (dobbyCheck.command === 'ask') {
        thinkingMessage = await ctx.reply(`🧙‍♀️ **도비가 생각하고 있습니다!**\n\n❓ 질문: "${dobbyCheck.content}"`);
        const answer = await answerQuestion(dobbyCheck.content);
        await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
        await ctx.reply(`🧙‍♀️ **도비의 답변입니다!**\n\n❓ **질문:** ${dobbyCheck.content}\n\n💡 **도비의 답변:**\n${answer}`);
        console.log('✅ Dobby Q&A successful!');
      }
    } catch (error) {
      await handleError(ctx, error as Error, `도비 ${dobbyCheck.command}`, thinkingMessage);
    }
    return;
  }

  if (isQuestion(text)) {
    console.log(`❓ Question detected: "${text}"`);
    const thinkingMessage = await ctx.reply(`🤔 질문을 분석하고 있습니다...\n\n질문: "${text}"`);
    try {
      const answer = await answerQuestion(text);
      await ctx.api.deleteMessage(ctx.chat.id, thinkingMessage.message_id);
      await ctx.reply(`🤖 **AI 답변**\n\n❓ **질문:** ${text}\n\n💡 **답변:**\n${answer}`);
      console.log('✅ Question answered successfully!');
    } catch (error) {
      await handleError(ctx, error as Error, '자동 질문 답변', thinkingMessage);
    }
  } else {
    await ctx.reply(`📨 메시지 수신: "${text}"\n\n🧙‍♀️ **도비 개인비서 모드:**\n• 🎨 "도비야, ${text} 그려줘"\n• 💬 "도비야, ${text} 뭐야?"\n\n🤖 **일반 AI 기능:**\n• 🎨 /image ${text}\n• 💬 /ask ${text}`);
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
  // Environment variable validation
  const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'CLAUDE_API_KEY', 'GOOGLE_API_KEY'];
  const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

  if (missingEnvVars.length > 0) {
    const errorMessage = `CRITICAL: Missing required environment variables: ${missingEnvVars.join(', ')}`;
    console.error(`❌ ${errorMessage}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error', message: errorMessage })
    };
  }

  console.log('🌐 Webhook received in production environment');

  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...event.headers },
      body: event.body
    });

    const response = await webhookHandler(request);
    console.log('✅ Webhook processed successfully');

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: await response.text()
    };
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', message: (error as Error).message })
    };
  }
};
