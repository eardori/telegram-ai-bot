#!/bin/bash

# Check deployment status for Telegram Bot on Render
echo "🚀 Checking deployment status..."
echo "================================"

# Check if webhook is responding
echo -n "Webhook endpoint: "
response=$(curl -s -o /dev/null -w "%{http_code}" "https://telegram-ai-bot-dqgz.onrender.com/webhook")
if [ "$response" = "405" ]; then
    echo "✅ Active (Method Not Allowed is expected for GET)"
elif [ "$response" = "200" ] || [ "$response" = "404" ]; then
    echo "⚠️  Service is up but webhook may not be configured"
else
    echo "❌ Not responding (HTTP $response)"
fi

echo ""
echo "📝 Latest commit deployed:"
git log --oneline -1

echo ""
echo "🔗 Deployment URL: https://dashboard.render.com/web/srv-ctbla1t6l47c73emh4o0"
echo ""
echo "To test the bot:"
echo "1. Open Telegram"
echo "2. Send a photo to @multiful_bot"
echo "3. Check if AI analysis and edit suggestions appear"
