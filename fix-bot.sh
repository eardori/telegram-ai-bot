#!/bin/bash

echo "🔧 Quick Bot Fix Script"
echo "======================="

echo "Enter your bot token:"
read -s BOT_TOKEN

# 1. Delete old webhook
echo "1. Removing old webhook..."
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook" > /dev/null

# 2. Clear pending updates
echo "2. Clearing pending updates..."
curl -s -X GET "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-1" > /dev/null

# 3. Set new webhook
echo "3. Setting new webhook..."
RESPONSE=$(curl -s -X POST \
  "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://tg-aibot.netlify.app/.netlify/functions/webhook"}')

echo "$RESPONSE" | python3 -m json.tool

# 4. Verify
echo "4. Verifying webhook..."
sleep 2
INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
echo "$INFO" | python3 -m json.tool

echo ""
echo "✅ Bot webhook reset complete!"
echo "📱 Now test your bot in Telegram with /start"