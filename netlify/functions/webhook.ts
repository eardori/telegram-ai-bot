// Production Telegram Bot Webhook Handler
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { Bot, webhookCallback, InputFile } from 'grammy';

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
async function callClaudeAPI(message: string) {
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
        max_tokens: 100,
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

// Bot commands
bot.command('start', async (ctx) => {
  console.log('📨 Start command received');
  await ctx.reply(`🎨 프로덕션 AI 봇입니다! 🤖

🌟 24/7 작동하는 실제 서비스:
• /start - 봇 시작하기
• /test - 연결 테스트  
• /summary - Claude AI 테스트
• /image [설명] - 🎨 실제 이미지 생성

✨ Netlify Functions로 서버리스 운영
🚀 Webhook 방식으로 실시간 처리
💰 Google Imagen 4.0 + Claude 3.5 Sonnet

예시: /image 귀여운 우주 고양이`);
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

// Handle text messages
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  console.log(`💬 Production message received: ${text}`);
  
  if (!text.startsWith('/')) {
    await ctx.reply(`📨 메시지 수신: "${text}"

🎨 이미지로 만들어볼까요?
/image ${text}

🤖 또는 다른 기능:
• /test - 프로덕션 상태 확인
• /summary - Claude AI 테스트`);
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