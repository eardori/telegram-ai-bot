# Telegram AI Bot "Pixie" - Development Documentation

## 📋 Product Requirements Document (PRD)

### 제품 개요

**제품명**: Pixie (픽시)
**태그라인**: "Your AI Creative Assistant on Telegram"
**비전**: 텔레그램에서 가장 쉽고 재미있게 AI를 활용할 수 있는 창의적 도구

### 핵심 가치 제안

1. **즉각적 접근성**: 별도 앱 설치 없이 텔레그램에서 바로 사용
2. **트렌드 기반 템플릿**: 매주 업데이트되는 바이럴 이미지 스타일
3. **스마트 추천**: AI가 업로드된 이미지를 분석해 최적 스타일 추천
4. **그룹 채팅 도우미**: 대화 요약, 컨텍스트 기반 답변

### 타겟 사용자

- **Primary**: 20-35세 소셜미디어 활동이 활발한 사용자
- **Secondary**: 텔레그램 그룹 관리자/활발한 참여자
- **Tertiary**: AI 도구에 관심있는 얼리어답터

---

## 🎯 핵심 기능 명세

### Phase 1: MVP (Week 1-4)

#### 1. 이미지 변환 기능 `P0`

**트렌드 템플릿 (주간 업데이트)**
- 지브리 스타일 변환
- 3D 피규어/피규어 스타일
- 디즈니/픽사 애니메이션 스타일
- 웹툰/만화 스타일
- 레트로 8bit 스타일
- 사이버펑크 네온 스타일

**스마트 추천 시스템**
- 이미지 분석 (인물/풍경/사물 감지)
- 컨텍스트 기반 스타일 추천
- 사용자 히스토리 기반 개인화

#### 2. 1:1 채팅 LLM 기능 `P0`

- 텍스트 대화 (GPT-4, Claude, Gemini 스위칭)
- 이미지 생성 (텍스트 → 이미지)
- 컨텍스트 유지 (최근 10개 대화)

#### 3. 과금 시스템 `P0`

**토큰 시스템**
- 기본 크레딧: 50 토큰
- 이미지 변환: 10 토큰
- 이미지 생성: 15 토큰
- 텍스트 대화: 1 토큰

**결제 연동**
- Telegram Stars
- Stripe (외부 결제)

### Phase 2: 그룹 기능 (Week 5-8)

#### 4. 그룹 채팅 기능 `P1`

**대화 모니터링 모드**
```
/monitor_on  - 모니터링 시작
/monitor_off - 모니터링 종료
```

**요약 기능**
```
/summarize [숫자]    - 최근 N개 메시지 요약
/summarize_unread    - 안읽은 메시지 요약
```

**컨텍스트 답변**
```
@pixie [질문] - 대화 맥락 고려한 답변
```

#### 5. 추천 시스템 `P1`

- 친구 초대 보상: 초대당 20 토큰
- 일일 체크인 보상: 5 토큰
- 첫 구매 2배 보너스

---

## 💰 수익 모델

### 토큰 패키지

| 패키지 | 토큰 | 가격 | 보너스 |
|--------|------|------|--------|
| Starter Pack | 100 | $2.99 | - |
| Popular Pack | 300 | $7.99 | 7% |
| Pro Pack | 600 | $14.99 | 15% |
| Mega Pack | 1500 | $29.99 | 25% |

### 구독 모델 (Phase 3)

| 플랜 | 월 가격 | 혜택 |
|------|---------|------|
| Basic | $4.99 | 300 토큰 |
| Premium | $9.99 | 800 토큰 + 우선 처리 |
| Business | $19.99 | 2000 토큰 + API 액세스 |

---

## 📊 성공 지표 (3개월 목표)

- **MAU**: 10,000명
- **유료 전환율**: 8%
- **월 정기 결제**: $3,000+
- **일일 이미지 생성**: 500+
- **평균 세션 시간**: 5분
- **7일 리텐션**: 40%

---

## 🔧 기술 명세서

### 기술 스택

```json
{
  "backend": {
    "runtime": "Node.js 20.x",
    "framework": "Express.js",
    "bot": "node-telegram-bot-api",
    "database": "PostgreSQL",
    "cache": "Redis",
    "storage": "AWS S3 / Cloudinary",
    "deployment": "Render.com"
  },
  "ai_services": {
    "llm": {
      "primary": "Gemini Nano",
      "fallback": ["gpt-3.5-turbo", "claude-3-haiku"]
    },
    "image": "Banana API / Replicate",
    "vision": "Google Vision API",
    "translation": "Google Translate API"
  }
}
```

### 시스템 아키텍처

```
┌─────────────────┐
│ Telegram Users  │
└────────┬────────┘
         │ Webhook
    ┌────▼─────┐
    │ Node.js  │
    │  Server  │
    └────┬─────┘
         │
    ┌────▼──────────────────────┐
    │     Request Router         │
    └─┬───────┬────────┬────────┘
      │       │        │
  ┌───▼──┐ ┌─▼──┐ ┌──▼───┐
  │Image │ │Chat│ │Group │
  │Service│ │Svc │ │ Svc  │
  └───┬──┘ └─┬──┘ └──┬───┘
      │      │       │
  ┌───▼──────▼───────▼───┐
  │   External APIs      │
  │ • Gemini/GPT/Claude  │
  │ • Banana/Replicate   │
  │ • Google Vision      │
  └──────────────────────┘
```

### 데이터베이스 스키마

```sql
-- Users Table
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    language VARCHAR(10) DEFAULT 'ko',
    tokens INTEGER DEFAULT 50,
    total_spent INTEGER DEFAULT 0,
    referral_code VARCHAR(20) UNIQUE,
    referred_by BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES users(id),
    type VARCHAR(50),
    tokens INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Image History Table
CREATE TABLE image_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES users(id),
    original_url TEXT,
    transformed_url TEXT,
    style VARCHAR(100),
    tokens_used INTEGER,
    processing_time INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Style Templates Table
CREATE TABLE style_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    prompt_template TEXT,
    category VARCHAR(50),
    is_trending BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    preview_url TEXT,
    tokens_required INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### API 엔드포인트

```yaml
Webhook:
  POST /webhook/:token

Image Processing:
  POST /api/image/analyze
  POST /api/image/transform
  GET  /api/image/styles
  GET  /api/image/history/:userId

Chat:
  POST /api/chat/message
  GET  /api/chat/history/:userId
  POST /api/chat/switch-model

Group Features:
  POST /api/group/monitor
  POST /api/group/summarize
  POST /api/group/context-query

Payment:
  POST /api/payment/purchase
  GET  /api/payment/packages
  POST /api/payment/webhook/telegram-stars
  POST /api/payment/webhook/stripe

User Management:
  GET  /api/user/profile
  POST /api/user/referral/claim
  GET  /api/user/referral/stats
```

---

## 💻 핵심 모듈 구현 예시

### 이미지 변환 모듈

```javascript
class ImageTransformer {
  constructor() {
    this.styles = {
      ghibli: {
        prompt: "Studio Ghibli style, anime, hand-drawn, soft colors, {analysis}",
        model: "stabilityai/stable-diffusion-xl-base-1.0",
        strength: 0.8
      },
      figure: {
        prompt: "3D figurine, toy, miniature, chibi style, {analysis}",
        model: "prompthero/openjourney-v4",
        strength: 0.85
      }
    };
  }

  async analyzeImage(imageUrl) {
    const analysis = await visionClient.analyze(imageUrl);
    return {
      hasPersons: analysis.faces.length > 0,
      scene: analysis.labels[0]?.description,
      recommendations: this.getRecommendedStyles(analysis)
    };
  }

  async transform(imageUrl, style, userId) {
    const analysis = await this.analyzeImage(imageUrl);
    const styleConfig = this.styles[style];
    const prompt = styleConfig.prompt.replace('{analysis}', analysis.scene);

    const result = await bananaClient.img2img({
      modelKey: styleConfig.model,
      imageUrl: imageUrl,
      prompt: prompt,
      strength: styleConfig.strength
    });

    return result;
  }
}
```

### 그룹 컨텍스트 관리

```javascript
class GroupContextManager {
  constructor() {
    this.activeGroups = new Map();
    this.contextWindow = 100;
  }

  async enableMonitoring(groupId) {
    this.activeGroups.set(groupId, {
      enabled: true,
      startTime: Date.now()
    });
  }

  async summarize(groupId, messageCount = 50) {
    const messages = await db.query(
      `SELECT content FROM group_context
       WHERE group_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [groupId, messageCount]
    );

    const prompt = `다음 대화를 요약해주세요:\n${messages.map(m => m.content).join('\n')}`;
    return await llmManager.complete(prompt);
  }
}
```

---

## 🚀 Vibe Coding 프롬프트

```markdown
# Pixie Bot - Vibe Coding Session

## 🎯 목표
Telegram AI 창의 도구 봇 개발 (이미지 변환 + LLM 대화)

## 🛠 기술 스택
- Node.js 20 + Express + node-telegram-bot-api
- PostgreSQL + Redis
- Gemini Nano (Banana API)
- Render.com 배포

## 📁 프로젝트 구조
pixie-bot/
├── src/
│   ├── bot/
│   │   ├── index.js
│   │   ├── commands/
│   │   └── keyboards/
│   ├── services/
│   │   ├── image.service.js
│   │   ├── llm.service.js
│   │   └── payment.service.js
│   ├── models/
│   └── utils/
├── .env
└── package.json

## ⚡ 4시간 구현 목표
1. Telegram 봇 연결 (/start 명령어)
2. 이미지 수신 → 분석 → 스타일 버튼
3. Banana API 호출 → 변환
4. 토큰 차감 로직
5. 기본 에러 핸들링

## 📝 코딩 원칙
- Async/await 사용
- 명확한 에러 메시지
- 즉각적인 사용자 피드백
- 환경변수 활용
- 모듈화 구조

준비되셨나요? 시작하겠습니다!
```

---

## 🗓 개발 로드맵

### Month 1: Foundation
- **Week 1-2**: MVP 개발 (이미지 변환, 기본 LLM)
- **Week 3**: 과금 시스템 구현
- **Week 4**: 베타 테스트 및 버그 수정

### Month 2: Enhancement
- **Week 5-6**: 그룹 채팅 기능
- **Week 7**: 추천 시스템 고도화
- **Week 8**: 성능 최적화

### Month 3: Growth
- **Week 9-10**: 마케팅 기능 (리퍼럴, 이벤트)
- **Week 11**: 구독 모델 도입
- **Week 12**: 스케일링 및 안정화

---

## 📈 모니터링 & 분석

### 추적 이벤트

```javascript
const events = {
  USER_SIGNUP: 'user.signup',
  IMAGE_TRANSFORM: 'image.transform',
  TOKEN_PURCHASE: 'token.purchase',
  REFERRAL_CLAIM: 'referral.claim',
  GROUP_SUMMARY: 'group.summary'
};
```

### A/B 테스트 계획

1. **스타일 추천**: 랜덤 vs AI 분석 vs 인기도
2. **온보딩**: 텍스트 vs 인터랙티브
3. **가격**: 다양한 패키지 테스트

---

## 🔒 보안 & 성능

### 보안
- Rate limiting: 60 req/min
- JWT 토큰 검증
- 이미지 크기 제한 (10MB)
- SQL Injection 방지

### 성능
- Redis 캐싱
- Cloudinary CDN
- Bull Queue 비동기 처리
- DB 인덱싱 최적화

---

## 📞 연락처 & 리소스

- **Documentation**: [내부 위키]
- **API Keys**: .env 파일 참조
- **Design Assets**: Figma 링크
- **Support**: @pixie_support

---

*Last Updated: 2024*
