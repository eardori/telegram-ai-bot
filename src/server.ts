import express from 'express';
import { Bot, webhookCallback } from 'grammy';
import { handler } from '../netlify/functions/webhook';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Telegram AI Bot',
    timestamp: new Date().toISOString()
  });
});

// Webhook endpoint
app.post('/webhook', express.json(), async (req, res) => {
  console.log('🌐 Webhook received:', {
    method: req.method,
    body: JSON.stringify(req.body).substring(0, 200) + '...',
    headers: req.headers
  });

  try {
    // Convert Express request to Netlify-style event
    const event = {
      httpMethod: req.method,
      headers: req.headers as { [key: string]: string },
      body: JSON.stringify(req.body),
      isBase64Encoded: false,
      path: req.path,
      queryStringParameters: req.query as { [key: string]: string }
    };

    // Call the existing webhook handler
    const response = await handler(event as any, {} as any);

    // Send response
    if (response && response.statusCode && response.body) {
      res.status(response.statusCode).json(JSON.parse(response.body));
    } else {
      res.status(200).json({ ok: true });
    }
    console.log('✅ Webhook processed successfully');
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(200).json({ ok: true }); // Return 200 to prevent Telegram retry
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📨 Webhook endpoint: /webhook`);
  console.log(`🏥 Health check: /`);

  // Log environment status
  console.log('🔧 Environment variables status:');
  console.log('  BOT_TOKEN:', process.env.BOT_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('  GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('  CLAUDE_API_KEY:', process.env.CLAUDE_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.log('  SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✅ Set' : '❌ Missing');

  // Set webhook URL if in production
  if (process.env.RENDER_EXTERNAL_URL) {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/webhook`;
    console.log(`🔗 Setting webhook URL: ${webhookUrl}`);

    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (BOT_TOKEN) {
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      })
      .then(res => res.json())
      .then(data => console.log('✅ Webhook set:', data))
      .catch(err => console.error('❌ Failed to set webhook:', err));
    }
  }
});