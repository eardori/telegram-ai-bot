const express = require('express');
const { handler } = require('./netlify/functions/webhook');

const app = express();
const PORT = process.env.PORT || 10000;

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', req.body);

    // Convert Express request to Netlify-style event
    const event = {
      body: JSON.stringify(req.body),
      headers: req.headers,
      httpMethod: 'POST',
      path: '/webhook'
    };

    // Call the existing webhook handler
    const result = await handler(event);

    // Send response
    res.status(result.statusCode).send(result.body);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
  console.log(`🔗 Webhook URL: https://YOUR-APP.onrender.com/webhook`);
  console.log(`📍 Set this URL in Telegram: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-APP.onrender.com/webhook`);
});