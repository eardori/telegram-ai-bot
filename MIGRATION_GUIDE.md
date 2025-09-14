# 🚀 Netlify → Render 이전 가이드

## 📋 이전 단계

### 1. Render 계정 생성
1. [render.com](https://render.com) 방문
2. GitHub로 로그인

### 2. 새 Web Service 생성
1. Dashboard → New → Web Service
2. GitHub 저장소 연결: `eardori/telegram-ai-bot`
3. 설정:
   - **Name**: telegram-ai-bot
   - **Region**: Singapore (한국과 가까움)
   - **Branch**: main
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/server.js`

### 3. 환경변수 복사
Netlify Dashboard에서 복사 → Render Environment 탭에 붙여넣기:
- `BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CLAUDE_API_KEY`
- `GOOGLE_API_KEY`

### 4. 배포
자동으로 시작됩니다. 약 5분 소요.

### 5. Telegram Webhook 업데이트
배포 완료 후 URL 확인 (예: `https://telegram-ai-bot.onrender.com`)

터미널에서 실행:
```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://telegram-ai-bot.onrender.com/webhook"}'
```

## ✅ 장점
- **15분 타임아웃** - 이미지 생성 충분
- **무료 750시간/월** - 봇 운영에 충분
- **자동 배포** - GitHub push시 자동
- **환경변수 그대로 사용**

## ⚠️ 주의사항
- 15분 비활성시 슬립 (첫 요청시 10-30초 지연)
- 해결: Health check 서비스 사용 (UptimeRobot 등)

## 🔄 롤백 방법
만약 문제 발생시:
1. Netlify로 돌아가기 가능
2. Webhook URL만 다시 변경하면 됨

## 📊 비용 비교
| 플랫폼 | 무료 한도 | 타임아웃 | 월 비용 |
|--------|----------|----------|---------|
| Netlify | 무제한 | 10초 | $0 |
| Render | 750시간 | 15분 | $0 |
| Railway | $5 크레딧 | 무제한 | ~$5 |
| Vercel Pro | - | 60초 | $20 |

## 🎯 결론
**Render**가 가장 적합:
- 코드 수정 최소화
- 충분한 타임아웃
- 무료로 운영 가능