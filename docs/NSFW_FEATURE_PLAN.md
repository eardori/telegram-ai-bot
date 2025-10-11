# 🔞 NSFW 이미지 편집 기능 구현 계획

**작성일**: 2025-01-10
**현재 상태**: ❌ Cloudflare 차단으로 미작동
**목표**: Replicate API를 통한 NSFW 콘텐츠 생성 기능 복원

---

## 📋 현재 상황 분석

### 기존 구현 상태
- ✅ Replicate API 통합 완료 (`src/services/replicate-service.ts`)
- ✅ 명령어 구현: `/nsfw_imagine`, `/nsfw_video`
- ❌ **Cloudflare가 Render.com IP 차단** → API 호출 실패 (403 Forbidden)

### 문제 상세
```
Error: 403 Cloudflare 차단
원인: Render.com의 공용 IP가 Cloudflare 블랙리스트에 등재
상태: Replicate 지원팀 문의 중 (응답 대기)
```

### 영향도
- 사용자: NSFW 콘텐츠 생성 불가
- 비즈니스: 프리미엄 기능 제공 불가 → 수익 기회 손실
- 현재 수익 모델은 일반 이미지 편집만 가능

---

## 🎯 해결 방안

### 옵션 A: Cloudflare 우회 (추천) ⭐
**방법**: 프록시 서버 또는 전용 IP 사용

#### A-1: 프록시 서버 (빠른 해결)
```typescript
// Replicate API 호출 시 프록시 사용
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
  fetch: (url, options) => {
    return fetch(url, {
      ...options,
      // 프록시 설정
      agent: new HttpsProxyAgent(process.env.PROXY_URL!)
    });
  }
});
```

**프록시 서비스 옵션**:
1. **Bright Data** ($500/월) - 엔터프라이즈급
2. **Oxylabs** ($300/월) - 안정적
3. **SmartProxy** ($75/월) - 저렴
4. **자체 AWS EC2** (~$50/월) - 완전 제어

**장점**:
- 빠른 구현 (1-2일)
- Replicate API 변경 불필요
- 다른 API에도 재사용 가능

**단점**:
- 추가 비용 ($75-500/월)
- 프록시 안정성 의존

---

#### A-2: Render.com 전용 IP (Clean)
```
Render.com에서 전용 IP 구매
- 비용: $20-50/월
- Cloudflare 블랙리스트 없음
- 가장 깨끗한 해결책
```

**장점**:
- 근본적 해결
- 추가 코드 불필요
- Cloudflare 우회 완전 해결

**단점**:
- Render.com이 전용 IP 제공하는지 확인 필요
- 설정 시간 소요 (1-3일)

---

### 옵션 B: 대체 API 사용
**Replicate 대신 다른 NSFW 이미지 생성 API 사용**

#### B-1: Stability AI (Stable Diffusion)
```typescript
// https://platform.stability.ai/
const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text_prompts: [{ text: prompt }],
    cfg_scale: 7,
    height: 1024,
    width: 1024,
    samples: 1,
    steps: 50
  })
});
```

**비용**: $0.002-0.01/이미지
**장점**: 안정적, Cloudflare 이슈 없음
**단점**: Replicate보다 비쌈

---

#### B-2: RunPod (Serverless GPU)
```typescript
// https://www.runpod.io/
// 자체 모델 배포 가능
const response = await fetch('https://api.runpod.ai/v2/{endpoint_id}/runsync', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    input: { prompt }
  })
});
```

**비용**: $0.0002-0.001/초 (GPU 사용 시간)
**장점**: 저렴, 완전 제어, Cloudflare 이슈 없음
**단점**: 초기 설정 복잡 (모델 배포 필요)

---

#### B-3: Hugging Face Inference API
```typescript
// https://huggingface.co/inference-api
const response = await fetch(`https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ inputs: prompt })
});
```

**비용**: $0.001-0.005/이미지
**장점**: 무료 티어 있음, 다양한 모델 선택
**단점**: Rate limit 있음, 속도 느림 (Cold start)

---

### 옵션 C: Replicate 응답 대기 (현재 상태)
- Replicate 지원팀이 IP 화이트리스트 추가
- 예상 소요 시간: 1-2주
- **리스크**: 해결 보장 없음

---

## 💰 비용 분석

### 옵션별 월간 비용 (예상 사용량: 1000회/월)

| 옵션 | 초기 비용 | 월간 비용 | API 비용 | 총 비용 |
|------|----------|----------|---------|--------|
| **A-1: 프록시 (SmartProxy)** | $0 | $75 | $0 (Replicate 기존) | **$75** |
| **A-2: 전용 IP (Render)** | $0 | $50 | $0 (Replicate 기존) | **$50** ⭐ 추천 |
| **B-1: Stability AI** | $0 | $0 | $2-10 | **$2-10** 💰 최저 |
| **B-2: RunPod** | $50 (모델 배포) | $0 | $0.20-1 | **$1** 💰 |
| **B-3: Hugging Face** | $0 | $0 (Free tier) | $1-5 | **$1-5** 💰 |
| **C: Replicate 대기** | $0 | $0 | $0 | **$0** ⏳ 불확실 |

### 수익성 분석
- NSFW 기능 = 프리미엄 기능 = **5배 크레딧 소비** (또는 별도 요금)
- 월 1000회 사용 시:
  - 일반 크레딧: 1000회 = $13 매출 (0.013/회)
  - NSFW 크레딧: 1000회 = **$65 매출** (5배)
  - **순이익**: $65 - $50 (전용 IP) = **$15/월**

→ 최소 800명 MAU에서 각 1회씩만 사용해도 **수익 발생**

---

## 🏗️ 구현 계획

### 🥇 Phase 1: 빠른 복원 (2-3일) - 추천
**목표**: NSFW 기능 즉시 복원

#### Step 1: Render.com 전용 IP 구매
1. Render.com 대시보드 확인
2. 전용 IP 옵션 확인 및 구매 ($20-50/월)
3. DNS 설정 업데이트

**대안**: 전용 IP 불가 시 → SmartProxy 프록시 서비스 ($75/월)

#### Step 2: 기존 코드 테스트
```bash
# 전용 IP 설정 후
curl https://api.replicate.com/v1/predictions \
  -H "Authorization: Token $REPLICATE_API_TOKEN" \
  -d '{"version":"...","input":{"prompt":"test"}}'
```

#### Step 3: `/nsfw_imagine` 기능 활성화
- webhook.ts에서 주석 제거
- 에러 핸들링 개선
- 사용자 알림 추가

#### Step 4: 크레딧 차등 적용
```sql
-- sql/024_nsfw_credit_weights.sql
INSERT INTO template_credit_weights (template_key, base_credits, cost_multiplier) VALUES
  ('nsfw_imagine', 5, 5.0),
  ('nsfw_video', 10, 10.0);
```

---

### 🥈 Phase 2: 최적화 (1주) - 선택사항
**목표**: 비용 절감 및 품질 개선

#### Option 1: Stability AI 통합 (비용 절감)
```typescript
// src/services/stability-service.ts
export class StabilityService {
  async generateImage(prompt: string): Promise<string> {
    // Stability AI 호출
  }
}
```

#### Option 2: RunPod 자체 배포 (완전 제어)
```typescript
// 자체 Stable Diffusion 모델 배포
// 초기 설정 복잡하나 장기적으로 저렴
```

---

### 🥉 Phase 3: 프리미엄 기능화 (2주) - 선택사항
**목표**: NSFW를 프리미엄 수익원으로 전환

#### 가격 책정 전략

**옵션 A: 크레딧 차등 (간단)** ⭐ 추천
```
일반 이미지 편집: 1 크레딧
NSFW 이미지: 5 크레딧 (자동 적용)
NSFW 비디오: 10 크레딧
```

**옵션 B: 별도 애드온**
```
베이직/프로 플랜 + NSFW 애드온 (+99 Stars/월)
```

**옵션 C: 전용 플랜**
```
NSFW 프리미엄 플랜: 499 Stars/월
- 무제한 NSFW 이미지
- 월 50회 NSFW 비디오
```

#### 법적 안전장치
1. **연령 확인 시스템**
   ```typescript
   // 18세 이상 확인 (Telegram Premium 여부 등)
   if (!user.is_premium && !user.age_verified) {
     await ctx.reply('🔞 NSFW 기능은 18세 이상만 사용 가능합니다.');
     return;
   }
   ```

2. **이용 약관 업데이트**
   ```
   - NSFW 콘텐츠는 개인적 사용만 허용
   - 불법 콘텐츠 생성 시 계정 정지
   - 법적 책임은 사용자에게 있음
   ```

3. **사용 제한**
   ```typescript
   // 일일 NSFW 생성 제한
   const NSFW_DAILY_LIMIT = 10;
   ```

---

## 📋 작업 체크리스트

### 🟥 긴급 (즉시 시작)
- [ ] Render.com 전용 IP 옵션 확인
- [ ] 전용 IP 구매 또는 SmartProxy 가입
- [ ] Cloudflare 우회 테스트

### 🟨 중요 (1주 내)
- [ ] `/nsfw_imagine` 명령어 활성화
- [ ] `/nsfw_video` 명령어 활성화
- [ ] 크레딧 차등 시스템 구현 (5배)
- [ ] 연령 확인 시스템 추가
- [ ] 이용 약관 업데이트

### 🟩 선택 (2주 내)
- [ ] Stability AI 대체 API 연구
- [ ] RunPod 자체 배포 검토
- [ ] A/B 테스트 (Replicate vs Stability)
- [ ] NSFW 전용 플랜 설계

---

## 🎯 추천 액션 플랜

### 1️⃣ 즉시 시작 (오늘)
```
✅ Render.com 전용 IP 옵션 확인
✅ 대안 조사 (SmartProxy, AWS EC2)
✅ 예산 승인 ($50-75/월)
```

### 2️⃣ 내일부터
```
✅ 전용 IP 구매 및 설정
✅ Replicate API 테스트
✅ 코드 주석 제거 및 배포
```

### 3️⃣ 다음 주
```
✅ 크레딧 차등 시스템 구현
✅ 사용량 모니터링
✅ 수익성 분석
```

---

## 💡 핵심 결정 사항

### 질문 1: 어떤 해결 방안을 선택할까?
**추천**: **옵션 A-2 (Render 전용 IP)** 또는 **옵션 B-1 (Stability AI)**

- **Render 전용 IP** ($50/월) → 가장 깨끗한 해결, Replicate 유지
- **Stability AI** ($2-10/월) → 가장 저렴, API 교체 필요

### 질문 2: 크레딧을 얼마나 차감할까?
**추천**: **5배 (5 크레딧)**

- 이유: API 비용이 5배 이상 + 프리미엄 가치
- 사용자 수용 가능: 일반 1회 = NSFW 1회 (공평)

### 질문 3: 연령 확인을 어떻게 할까?
**추천**: **간단 확인 (체크박스) + 사용 제한**

```typescript
// 첫 사용 시 1회만 확인
if (!user.nsfw_age_verified) {
  await ctx.reply('🔞 18세 이상이신가요?', {
    reply_markup: new InlineKeyboard()
      .text('✅ 예 (18세 이상)', 'nsfw_age_confirm')
      .row()
      .text('❌ 아니오', 'nsfw_age_deny')
  });
}
```

---

## 📊 예상 성과

### 단기 (1개월)
- ✅ NSFW 기능 복원
- ✅ 프리미엄 사용자 확보 (예상 50-100명)
- ✅ 월 $15-30 순이익

### 중기 (3개월)
- 🎯 월 500-1000회 NSFW 사용
- 🎯 월 $50-100 순이익
- 🎯 전체 ARPU 20% 상승

### 장기 (6개월)
- 🚀 NSFW 전용 플랜 출시
- 🚀 월 $200-500 순이익
- 🚀 경쟁 차별화 포인트 확보

---

**다음 액션**: Render.com 전용 IP 옵션 확인 및 구매 결정

*최종 수정: 2025-01-10*
