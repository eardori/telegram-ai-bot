# 🚀 Google Cloud Platform 이전 계획

## 📋 개요
Netlify의 10초 타임아웃 제한을 해결하기 위한 GCP Cloud Run 이전 계획서

## 🎯 GCP 선택 이유

### Google 생태계 통합 장점
- **현재 사용 중인 Google 서비스:**
  - Gemini Vision API (이미지 분석)
  - Google Imagen 4.0 (이미지 생성)
  - Google API Key 통합 관리

### 성능 & 제한
- **타임아웃:** 60분 (vs Netlify 10초)
- **무료 한도:** 월 200만 요청
- **메모리:** 최대 32GB
- **CPU:** 최대 8 vCPU

## 📊 플랫폼 비교

| 기능 | Netlify | Render | GCP Cloud Run |
|------|---------|---------|---------------|
| 타임아웃 | 10초 | 15분 | **60분** |
| 무료 한도 | 무제한 | 750시간/월 | **200만 요청/월** |
| 콜드 스타트 | 없음 | 15분 후 | 설정 가능 |
| Google AI 통합 | ❌ | ❌ | **✅ 네이티브** |
| 예상 비용 | $0 | $0 | **$0-5** |

## 🛠️ 이전 단계

### Phase 1: 파일 준비

#### Dockerfile
```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

#### cloudbuild.yaml
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/telegram-bot', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/telegram-bot']
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'telegram-bot'
      - '--image=gcr.io/$PROJECT_ID/telegram-bot'
      - '--region=asia-northeast3'  # 서울
      - '--platform=managed'
      - '--timeout=3600'
      - '--memory=2Gi'
```

#### server.js
```javascript
const express = require('express');
const { handler } = require('./netlify/functions/webhook');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'healthy' });
});

app.post('/webhook', async (req, res) => {
  const event = {
    body: JSON.stringify(req.body),
    headers: req.headers,
    httpMethod: 'POST'
  };

  const result = await handler(event);
  res.status(result.statusCode).send(result.body);
});

app.listen(PORT);
```

### Phase 2: GCP 설정

```bash
# 1. gcloud CLI 설치
curl https://sdk.cloud.google.com | bash

# 2. 프로젝트 생성
gcloud projects create telegram-bot-kr

# 3. APIs 활성화
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# 4. 배포
gcloud run deploy telegram-bot \
  --source . \
  --region asia-northeast3 \
  --timeout 3600 \
  --memory 2Gi \
  --allow-unauthenticated
```

### Phase 3: 환경변수 설정

```bash
gcloud run services update telegram-bot \
  --set-env-vars="BOT_TOKEN=$BOT_TOKEN" \
  --set-env-vars="SUPABASE_URL=$SUPABASE_URL" \
  --set-env-vars="SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" \
  --set-env-vars="CLAUDE_API_KEY=$CLAUDE_API_KEY" \
  --set-env-vars="GOOGLE_API_KEY=$GOOGLE_API_KEY"
```

### Phase 4: Webhook 업데이트

```bash
# 새 URL 확인
gcloud run services describe telegram-bot --region asia-northeast3

# Telegram에 설정
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://telegram-bot-xxxxx-an.a.run.app/webhook"}'
```

## 💰 비용 최적화

- **최소 인스턴스:** 0 (콜드 스타트 허용)
- **최대 인스턴스:** 10
- **CPU 할당:** "요청 중에만"
- **리전:** asia-northeast3 (서울)

## 🔄 롤백 계획

문제 발생시 Netlify로 즉시 복구:
```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://tg-aibot.netlify.app/.netlify/functions/webhook"
```

## 📅 예상 일정

- 준비: 30분
- 코드 수정: 1시간
- 배포 & 테스트: 30분
- **총 소요시간: 2시간**

## ✅ 예상 결과

- 이미지 생성 타임아웃 해결
- Google AI 서비스 통합 최적화
- 월 200만 요청까지 무료
- 향후 확장성 확보