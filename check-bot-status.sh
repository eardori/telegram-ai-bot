#!/bin/bash

echo "🔍 Telegram Bot Status Check"
echo "============================"

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 봇 토큰 입력받기
echo -e "${YELLOW}Enter your Telegram Bot Token:${NC}"
read -s BOT_TOKEN

if [ -z "$BOT_TOKEN" ]; then
    echo -e "${RED}❌ Bot token is required${NC}"
    exit 1
fi

echo ""
echo "1️⃣ Checking Webhook Info..."
echo "----------------------------"
WEBHOOK_RESPONSE=$(curl -s -X GET "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
echo "$WEBHOOK_RESPONSE" | python3 -m json.tool

# Webhook URL 추출
WEBHOOK_URL=$(echo "$WEBHOOK_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('result', {}).get('url', 'Not set'))")
PENDING_COUNT=$(echo "$WEBHOOK_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('result', {}).get('pending_update_count', 0))")
LAST_ERROR=$(echo "$WEBHOOK_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('result', {}).get('last_error_message', 'None'))")

echo ""
echo "📊 Summary:"
echo "-----------"
echo -e "Webhook URL: ${GREEN}$WEBHOOK_URL${NC}"
echo -e "Pending Updates: ${YELLOW}$PENDING_COUNT${NC}"
echo -e "Last Error: ${RED}$LAST_ERROR${NC}"

echo ""
echo "2️⃣ Testing Webhook Endpoint..."
echo "--------------------------------"
if [ "$WEBHOOK_URL" != "Not set" ] && [ "$WEBHOOK_URL" != "" ]; then
    WEBHOOK_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEBHOOK_URL")
    if [ "$WEBHOOK_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ Webhook endpoint is accessible (HTTP $WEBHOOK_STATUS)${NC}"
    else
        echo -e "${RED}❌ Webhook endpoint returned HTTP $WEBHOOK_STATUS${NC}"
    fi
else
    echo -e "${RED}❌ No webhook URL set${NC}"
fi

echo ""
echo "3️⃣ Checking Recent Updates..."
echo "------------------------------"
UPDATES=$(curl -s -X GET "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=5")
UPDATE_COUNT=$(echo "$UPDATES" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('result', [])))")
echo -e "Recent updates in queue: ${YELLOW}$UPDATE_COUNT${NC}"

if [ "$UPDATE_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  There are unprocessed updates. The webhook might not be working.${NC}"
fi

echo ""
echo "4️⃣ Required Actions:"
echo "--------------------"

# 올바른 Webhook URL
CORRECT_WEBHOOK="https://tg-aibot.netlify.app/.netlify/functions/webhook"

if [ "$WEBHOOK_URL" != "$CORRECT_WEBHOOK" ]; then
    echo -e "${YELLOW}📌 Set correct webhook URL:${NC}"
    echo ""
    echo "curl -X POST \\"
    echo "  https://api.telegram.org/bot\${BOT_TOKEN}/setWebhook \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"url\": \"$CORRECT_WEBHOOK\"}'"
    echo ""
else
    echo -e "${GREEN}✅ Webhook URL is correctly set${NC}"
fi

echo ""
echo "5️⃣ Netlify Function Logs:"
echo "-------------------------"
echo "Check logs at: https://app.netlify.com/sites/tg-aibot/functions/webhook"
echo ""
echo "Or use Netlify CLI:"
echo "  netlify functions:log --name webhook"

echo ""
echo "6️⃣ Test Message:"
echo "----------------"
echo "Send a test message to your bot:"
echo "  1. Open Telegram"
echo "  2. Find your bot: @MultifulDobi_bot"
echo "  3. Send: /start"
echo "  4. Check logs for activity"