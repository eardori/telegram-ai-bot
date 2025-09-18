"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webhook_1 = require("../netlify/functions/webhook");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
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
app.post('/webhook', express_1.default.json(), async (req, res) => {
    console.log('🌐 Webhook received:', {
        method: req.method,
        body: JSON.stringify(req.body).substring(0, 200) + '...',
        headers: req.headers
    });
    // Send immediate response to Telegram to prevent timeout
    res.status(200).json({ ok: true });
    console.log('✅ Sent immediate 200 response to Telegram');
    // Process webhook in background
    setImmediate(async () => {
        try {
            // Convert Express request to Netlify-style event
            const event = {
                httpMethod: req.method,
                headers: req.headers,
                body: JSON.stringify(req.body),
                isBase64Encoded: false,
                path: req.path,
                queryStringParameters: req.query
            };
            // Call the existing webhook handler
            const response = await (0, webhook_1.handler)(event, {});
            if (response && 'statusCode' in response && response.statusCode === 200) {
                console.log('✅ Webhook processed successfully in background');
            }
            else if (response && 'statusCode' in response) {
                console.log('⚠️ Webhook processing completed with status:', response.statusCode);
            }
            else {
                console.log('⚠️ Webhook processing completed without response');
            }
        }
        catch (error) {
            console.error('❌ Background webhook processing error:', error);
            // Don't need to send response since we already sent 200
        }
    });
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
