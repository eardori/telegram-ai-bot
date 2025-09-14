# 🔄 비동기 처리 방안 (타임아웃 우회)

## 개요
Netlify 10초 타임아웃을 우회하기 위한 비동기 이미지 생성 처리 방안

## 핵심 원리
```
Telegram → Webhook → 즉시 "처리중" 응답 (1초)
             └→ 백그라운드 작업
                    ├→ 이미지 생성 (15-30초)
                    └→ Telegram API 직접 호출
```

**타임아웃이 무의미해집니다!**

## 구현 복잡도: ⭐⭐⭐⭐⭐ (매우 복잡)

## 상세 구현 계획

### 1. 기본 구조 변경

```typescript
// 현재 (동기식)
const imageResult = await generateImageWithImagen(content);
await ctx.replyWithPhoto(imageResult);

// 변경 (비동기식)
const processingMsg = await ctx.reply("🎨 그림을 그리는 중... 잠시 후 전송됩니다!");

// 백그라운드 실행
setTimeout(async () => {
  try {
    const imageResult = await generateImageWithImagen(content);

    // Telegram API 직접 호출
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: createFormData(chatId, imageResult)
    });

    // 처리중 메시지 삭제
    await deleteMessage(chatId, processingMsg.message_id);
  } catch (error) {
    await sendErrorMessage(chatId, error);
  }
}, 0);

return { statusCode: 200 }; // 즉시 응답
```

### 2. 필요한 헬퍼 함수

```typescript
// FormData 생성 (이미지 전송용)
function createFormData(chatId: number, imageData: string) {
  const form = new FormData();
  form.append('chat_id', chatId.toString());
  form.append('photo', Buffer.from(imageData, 'base64'), 'image.png');
  form.append('caption', '✨ 완성된 이미지입니다!');
  return form;
}

// 에러 메시지 전송
async function sendErrorMessage(chatId: number, error: any) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `❌ 이미지 생성 실패: ${error.message}`
    })
  });
}

// 메시지 삭제
async function deleteMessage(chatId: number, messageId: number) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId
    })
  });
}
```

### 3. 작업 추적 시스템

```typescript
// 상태 추적을 위한 DB 테이블
CREATE TABLE image_jobs (
  job_id TEXT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  message_id BIGINT,
  prompt TEXT NOT NULL,
  status TEXT DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

// 작업 추적 함수
async function trackImageGeneration(chatId: number, messageId: number, prompt: string) {
  const jobId = `${chatId}_${Date.now()}`;

  await supabase.from('image_jobs').insert({
    job_id: jobId,
    chat_id: chatId,
    message_id: messageId,
    prompt: prompt,
    status: 'processing'
  });

  processImageAsync(jobId, chatId, messageId, prompt);
}
```

### 4. 진행 상태 업데이트

```typescript
async function processImageAsync(jobId: string, chatId: number, messageId: number, prompt: string) {
  try {
    // 10초 후 상태 업데이트
    setTimeout(async () => {
      await updateMessage(chatId, messageId, "⏳ 90% 완료... 잠시만요!");
    }, 10000);

    const imageResult = await generateImageWithImagen(prompt);

    // 이미지 전송
    await sendImage(chatId, imageResult);

    // DB 상태 업데이트
    await supabase.from('image_jobs')
      .update({
        status: 'completed',
        completed_at: new Date()
      })
      .eq('job_id', jobId);

    // 처리중 메시지 삭제
    await deleteMessage(chatId, messageId);

  } catch (error) {
    // 실패 처리
    await supabase.from('image_jobs')
      .update({
        status: 'failed',
        error_message: error.message
      })
      .eq('job_id', jobId);

    await updateMessage(chatId, messageId, `❌ 실패: ${error.message}`);
  }
}
```

## 장단점

### 장점
- ✅ Netlify 10초 제한 완전 우회
- ✅ 사용자 경험 개선 (즉시 응답)
- ✅ 실패시 재시도 가능
- ✅ 진행 상태 표시 가능

### 단점
- ❌ 매우 복잡한 구현
- ❌ 디버깅 어려움
- ❌ Netlify Functions 메모리 제한
- ❌ 실행 후 Functions 종료로 추적 어려움
- ❌ FormData 처리 복잡

## 더 간단한 대안

### Option A: Worker 서비스 분리
```
Netlify → Queue (SQS/PubSub) → Worker (별도 서버) → Telegram
```

### Option B: Webhook Retry 활용
```typescript
if (!request.headers['x-retry-count']) {
  await ctx.reply("처리중...");
  return {
    statusCode: 429,
    headers: { 'Retry-After': '5' }
  };
}
// 재시도시 실제 처리
```

## 복잡도 비교
| 방법 | 복잡도 | 안정성 | 추천도 |
|------|--------|--------|--------|
| 현재 (동기) | ⭐⭐ | ❌ | ❌ |
| 비동기 처리 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| GCP 이전 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 프롬프트 단순화 | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

## 결론
비동기 처리는 가능하지만 복잡도가 높아 GCP 이전이나 프롬프트 단순화를 먼저 시도하는 것을 추천