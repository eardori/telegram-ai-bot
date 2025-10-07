# 🚀 Pixie 업그레이드 마이그레이션 계획

## 📊 현재 상황 분석 (2025-01-07)

### 현재 봇: MultifulDobi_bot
**구현된 기능:**
- ✅ 기본 텔레그램 봇 (grammY)
- ✅ 1:1 대화 (도비야 [질문])
- ✅ 이미지 생성 (/imagine, 도비야 그려줘)
- ✅ AI 이미지 편집 (38개 프롬프트 템플릿)
- ✅ Supabase 데이터베이스 연동
- ✅ Render.com 배포
- ⚠️ 세션 관리 (구현됨, 미작동)

**기술 스택:**
- Node.js + TypeScript
- grammY (Telegram Bot Framework)
- Supabase (PostgreSQL)
- Google Gemini API
- Render.com 호스팅

### 목표: Pixie로 진화
**추가할 핵심 기능:**
1. **토큰 경제 시스템** (Payment)
2. **스마트 이미지 분석 및 추천**
3. **그룹 채팅 기능** (모니터링, 요약)
4. **사용자 프로필 및 히스토리**
5. **관리자 대시보드**
6. **리퍼럴 시스템**

---

## 📋 Phase 1: 프롬프트 관리 시스템 개선 (1-2일)

### 목표
기존 DB 기반 프롬프트를 파일 기반 하이브리드 구조로 전환하여 쉽게 추가/수정 가능하게 만들기

### 작업 내용

#### 1.1 프롬프트 파일 구조 생성
```bash
src/data/prompts/
├── index.ts                    # 통합 export
├── core/
│   ├── portrait-styling.json   # 인물 사진 (12개)
│   ├── 3d-figurine.json        # 3D/피규어 (5개)
│   ├── image-editing.json      # 이미지 편집 (11개)
│   ├── game-animation.json     # 게임/애니메이션 (2개)
│   └── creative-transform.json # 창의적 변환 (8개)
├── experimental/
│   └── trending-2025-01.json   # 실험용 프롬프트
└── seasonal/
    └── winter-2024.json        # 계절/이벤트 프롬프트
```

#### 1.2 JSON 스키마 정의
```json
{
  "version": "1.0.0",
  "category": "portrait_styling",
  "lastUpdated": "2025-01-07",
  "prompts": [
    {
      "key": "figurine_commercial",
      "nameKo": "🎭 피규어 만들기",
      "nameEn": "Commercial Figurine",
      "category": "3d_figurine",
      "subcategory": "collectible",
      "basePrompt": "Create a 1/7 scale commercialized figurine...",
      "minImages": 1,
      "maxImages": 1,
      "requiresFace": true,
      "minFaces": 1,
      "priority": 95,
      "tokensRequired": 10,
      "isActive": true,
      "tags": ["3d", "collectible", "chibi"]
    }
  ]
}
```

#### 1.3 PromptManager 클래스 구현
**파일:** `src/services/prompt-manager.ts`

```typescript
class PromptManager {
  private prompts: Map<string, PromptTemplate> = new Map();
  private lastLoadTime: number = 0;

  // 파일 시스템에서 로드
  async loadFromFiles(): Promise<void> {
    const corePrompts = await this.loadDirectory('src/data/prompts/core');
    const expPrompts = await this.loadDirectory('src/data/prompts/experimental');
    // ...
  }

  // DB와 동기화
  async syncToDatabase(): Promise<void> {
    // JSON → DB 업데이트
  }

  // Hot reload (개발 모드)
  enableHotReload(): void {
    if (process.env.NODE_ENV === 'development') {
      fs.watch('src/data/prompts', () => this.loadFromFiles());
    }
  }

  // 프롬프트 검색
  getByKey(key: string): PromptTemplate | null { }
  getByCategory(category: string): PromptTemplate[] { }
  getActive(): PromptTemplate[] { }
}
```

#### 1.4 CLI 도구 생성
**파일:** `scripts/prompt-tools.ts`

```typescript
// 1. 프롬프트 추가 도구
npm run prompt:add

// 2. DB 동기화 도구
npm run prompt:sync

// 3. 프롬프트 테스트 도구
npm run prompt:test <key>

// 4. 검증 도구
npm run prompt:validate
```

#### 1.5 Telegram 관리자 명령어 구현
**파일:** `src/handlers/admin-handler.ts`

```typescript
// 관리자 전용 명령어
/admin_prompt list              # 프롬프트 목록
/admin_prompt enable <key>      # 활성화
/admin_prompt disable <key>     # 비활성화
/admin_prompt stats <key>       # 통계 확인
/admin_reload                   # 파일 다시 로드
/admin_test <key> [이미지]     # 프롬프트 테스트

// 환경변수에 관리자 ID 설정
ADMIN_USER_IDS=123456789,987654321
```

**관리자 인증 미들웨어:**
```typescript
function isAdmin(ctx: Context): boolean {
  const adminIds = process.env.ADMIN_USER_IDS?.split(',').map(Number) || [];
  return adminIds.includes(ctx.from?.id || 0);
}

bot.command('admin_prompt', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ 관리자 권한이 필요합니다.');
  }
  // 관리자 기능 실행
});
```

### 테스트 시나리오
1. ✅ JSON 파일에서 새 프롬프트 추가
2. ✅ `/admin_reload` 명령어로 즉시 반영
3. ✅ DB와 동기화 확인
4. ✅ 사용자에게 새 프롬프트 노출 확인

---

## 📋 Phase 2: 토큰 경제 시스템 (2-3일)

### 2.1 데이터베이스 스키마 추가

**파일:** `sql/010_token_system.sql`

```sql
-- 사용자 프로필 확장
ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens INTEGER DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT;

-- 거래 기록
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES users(telegram_id),
    type VARCHAR(50) NOT NULL, -- 'purchase', 'usage', 'referral', 'daily_check'
    tokens INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 토큰 패키지
CREATE TABLE IF NOT EXISTS token_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tokens INTEGER NOT NULL,
    price_usd DECIMAL(10,2) NOT NULL,
    bonus_percentage INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 패키지 데이터
INSERT INTO token_packages (name, tokens, price_usd, bonus_percentage) VALUES
('Starter Pack', 100, 2.99, 0),
('Popular Pack', 300, 7.99, 7),
('Pro Pack', 600, 14.99, 15),
('Mega Pack', 1500, 29.99, 25);

-- 인덱스
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```

### 2.2 TokenManager 클래스 구현

**파일:** `src/services/token-manager.ts`

```typescript
class TokenManager {
  // 토큰 차감
  async deduct(userId: number, amount: number, reason: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (user.tokens < amount) {
      return false; // 잔액 부족
    }

    await supabase.rpc('deduct_tokens', {
      user_id: userId,
      amount: amount,
      reason: reason
    });

    return true;
  }

  // 토큰 추가
  async add(userId: number, amount: number, reason: string): Promise<void> {
    await supabase.rpc('add_tokens', {
      user_id: userId,
      amount: amount,
      reason: reason
    });
  }

  // 잔액 조회
  async getBalance(userId: number): Promise<number> {
    const { data } = await supabase
      .from('users')
      .select('tokens')
      .eq('telegram_id', userId)
      .single();

    return data?.tokens || 0;
  }

  // 거래 내역
  async getTransactions(userId: number, limit = 10): Promise<Transaction[]> {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }
}
```

### 2.3 이미지 편집에 토큰 시스템 통합

**수정 파일:** `src/handlers/image-edit-handler.ts`

```typescript
async function handleEditSelection(ctx: Context, templateKey: string, sessionId: string) {
  // 기존 코드...

  // 토큰 확인 (새로 추가)
  const template = await templateMatcher.getTemplateByKey(templateKey);
  const requiredTokens = template?.tokensRequired || 10;

  const hasEnoughTokens = await tokenManager.deduct(
    ctx.from!.id,
    requiredTokens,
    `Image edit: ${templateKey}`
  );

  if (!hasEnoughTokens) {
    await ctx.reply(
      '❌ 토큰이 부족합니다!\n\n' +
      `필요한 토큰: ${requiredTokens}\n` +
      `현재 잔액: ${await tokenManager.getBalance(ctx.from!.id)}\n\n` +
      '/buy 명령어로 토큰을 구매하세요.'
    );
    return;
  }

  // 이미지 편집 진행...
}
```

### 2.4 사용자 명령어 추가

**파일:** `src/handlers/token-handler.ts`

```typescript
// /balance - 잔액 확인
bot.command('balance', async (ctx) => {
  const balance = await tokenManager.getBalance(ctx.from.id);
  const transactions = await tokenManager.getTransactions(ctx.from.id, 5);

  let message = `💰 **토큰 잔액**: ${balance}\n\n`;
  message += '📋 **최근 거래:**\n';
  transactions.forEach(t => {
    message += `• ${t.type}: ${t.tokens > 0 ? '+' : ''}${t.tokens} (${formatDate(t.created_at)})\n`;
  });

  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// /buy - 토큰 구매
bot.command('buy', async (ctx) => {
  const packages = await getTokenPackages();

  const keyboard = new InlineKeyboard();
  packages.forEach(pkg => {
    keyboard.text(
      `${pkg.name} - ${pkg.tokens} 토큰 ($${pkg.price_usd})`,
      `buy:${pkg.id}`
    ).row();
  });

  await ctx.reply(
    '💎 **토큰 패키지 선택**\n\n' +
    '사진 편집: 10 토큰\n' +
    '이미지 생성: 15 토큰\n' +
    '대화: 1 토큰',
    { reply_markup: keyboard }
  );
});

// /referral - 추천 코드
bot.command('referral', async (ctx) => {
  const user = await getUser(ctx.from.id);
  const referralCode = user.referral_code || await generateReferralCode(ctx.from.id);

  await ctx.reply(
    `🎁 **추천 코드**: \`${referralCode}\`\n\n` +
    '친구를 초대하면 둘 다 20 토큰을 받아요!\n\n' +
    '사용법: `/start ${referralCode}`',
    { parse_mode: 'Markdown' }
  );
});
```

### 2.5 결제 연동 (Telegram Stars)

**파일:** `src/services/payment-service.ts`

```typescript
// Telegram Stars 결제 처리
bot.on('pre_checkout_query', async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on('message:successful_payment', async (ctx) => {
  const payment = ctx.message.successful_payment;
  const packageId = JSON.parse(payment.invoice_payload).packageId;

  const pkg = await getPackage(packageId);
  const bonusTokens = Math.floor(pkg.tokens * (pkg.bonus_percentage / 100));
  const totalTokens = pkg.tokens + bonusTokens;

  await tokenManager.add(
    ctx.from.id,
    totalTokens,
    `Purchase: ${pkg.name}`
  );

  await ctx.reply(
    `✅ 결제 완료!\n\n` +
    `기본 토큰: ${pkg.tokens}\n` +
    `보너스: +${bonusTokens}\n` +
    `총 획득: ${totalTokens} 토큰`
  );
});
```

---

## 📋 Phase 3: 그룹 채팅 기능 (3-4일)

### 3.1 그룹 컨텍스트 데이터베이스

**파일:** `sql/011_group_features.sql`

```sql
-- 그룹 설정
CREATE TABLE IF NOT EXISTS group_settings (
    group_id BIGINT PRIMARY KEY,
    monitoring_enabled BOOLEAN DEFAULT FALSE,
    auto_summarize BOOLEAN DEFAULT FALSE,
    language VARCHAR(10) DEFAULT 'ko',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 그룹 메시지 컨텍스트
CREATE TABLE IF NOT EXISTS group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    username VARCHAR(255),
    message_text TEXT,
    message_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 메시지 보관 기간 (7일)
CREATE INDEX idx_group_messages_created_at ON group_messages(created_at);
CREATE INDEX idx_group_messages_group_id ON group_messages(group_id, created_at DESC);

-- 자동 삭제 (7일 이상 된 메시지)
CREATE OR REPLACE FUNCTION delete_old_group_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM group_messages
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
```

### 3.2 GroupContextManager 구현

**파일:** `src/services/group-context-manager.ts`

```typescript
class GroupContextManager {
  // 모니터링 켜기/끄기
  async enableMonitoring(groupId: number, enabled: boolean): Promise<void> {
    await supabase
      .from('group_settings')
      .upsert({ group_id: groupId, monitoring_enabled: enabled });
  }

  // 메시지 저장
  async saveMessage(groupId: number, message: Message): Promise<void> {
    if (!await this.isMonitoring(groupId)) return;

    await supabase.from('group_messages').insert({
      group_id: groupId,
      user_id: message.from?.id,
      username: message.from?.username,
      message_text: message.text,
      message_id: message.message_id
    });
  }

  // 최근 N개 메시지 가져오기
  async getRecentMessages(groupId: number, count: number = 50): Promise<GroupMessage[]> {
    const { data } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(count);

    return data || [];
  }

  // 대화 요약
  async summarize(groupId: number, messageCount: number = 50): Promise<string> {
    const messages = await this.getRecentMessages(groupId, messageCount);

    const conversationText = messages
      .reverse()
      .map(m => `${m.username}: ${m.message_text}`)
      .join('\n');

    const prompt = `다음 그룹 대화를 3-5개 핵심 포인트로 요약해주세요:\n\n${conversationText}`;

    // Gemini로 요약 생성
    const summary = await callGeminiAPI(prompt);
    return summary;
  }
}
```

### 3.3 그룹 명령어 구현

**파일:** `src/handlers/group-handler.ts`

```typescript
// /monitor_on - 모니터링 시작
bot.command('monitor_on', async (ctx) => {
  if (ctx.chat?.type === 'private') {
    return ctx.reply('이 명령어는 그룹에서만 사용 가능합니다.');
  }

  // 관리자 권한 확인
  const member = await ctx.getChatMember(ctx.from!.id);
  if (!['creator', 'administrator'].includes(member.status)) {
    return ctx.reply('❌ 관리자만 사용할 수 있습니다.');
  }

  await groupManager.enableMonitoring(ctx.chat.id, true);
  await ctx.reply('✅ 대화 모니터링이 시작되었습니다.');
});

// /monitor_off - 모니터링 종료
bot.command('monitor_off', async (ctx) => {
  // 위와 동일한 권한 확인
  await groupManager.enableMonitoring(ctx.chat.id, false);
  await ctx.reply('⏹ 대화 모니터링이 종료되었습니다.');
});

// /summarize - 대화 요약
bot.command('summarize', async (ctx) => {
  if (ctx.chat?.type === 'private') {
    return ctx.reply('이 명령어는 그룹에서만 사용 가능합니다.');
  }

  const args = ctx.match?.toString().split(' ') || [];
  const messageCount = parseInt(args[0]) || 50;

  const statusMsg = await ctx.reply('📝 대화를 요약하는 중...');

  try {
    const summary = await groupManager.summarize(ctx.chat.id, messageCount);

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `📋 **대화 요약** (최근 ${messageCount}개 메시지)\n\n${summary}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      '❌ 요약 중 오류가 발생했습니다.'
    );
  }
});

// @pixie [질문] - 컨텍스트 기반 답변
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;

  // @pixie로 멘션되었을 때만 반응
  if (!text.startsWith('@pixie ')) return;

  const question = text.replace('@pixie ', '').trim();
  const recentMessages = await groupManager.getRecentMessages(ctx.chat.id, 20);

  const context = recentMessages
    .map(m => `${m.username}: ${m.message_text}`)
    .join('\n');

  const prompt = `
다음은 최근 그룹 대화입니다:
${context}

질문: ${question}

위 대화 맥락을 고려하여 답변해주세요.
`;

  const answer = await callGeminiAPI(prompt);
  await ctx.reply(answer, { reply_to_message_id: ctx.message.message_id });
});

// 모든 메시지 저장 (모니터링 중인 경우)
bot.on('message', async (ctx) => {
  if (ctx.chat?.type !== 'private') {
    await groupManager.saveMessage(ctx.chat.id, ctx.message);
  }
});
```

---

## 📋 Phase 4: 관리자 대시보드 & 통계 (2일)

### 4.1 통계 수집

**파일:** `sql/012_statistics.sql`

```sql
-- 일일 통계
CREATE TABLE IF NOT EXISTS daily_stats (
    date DATE PRIMARY KEY,
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    images_generated INTEGER DEFAULT 0,
    images_edited INTEGER DEFAULT 0,
    tokens_spent INTEGER DEFAULT 0,
    tokens_purchased INTEGER DEFAULT 0,
    revenue_usd DECIMAL(10,2) DEFAULT 0
);

-- 실시간 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_daily_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- 구현...
END;
$$ LANGUAGE plpgsql;
```

### 4.2 관리자 명령어

**파일:** `src/handlers/admin-dashboard.ts`

```typescript
// /admin_stats - 전체 통계
bot.command('admin_stats', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const stats = await getSystemStats();

  await ctx.reply(
    `📊 **시스템 통계** (${formatDate(new Date())})\n\n` +
    `👥 총 사용자: ${stats.totalUsers}\n` +
    `🆕 신규 (오늘): ${stats.newUsersToday}\n` +
    `✨ 활성 (오늘): ${stats.activeUsersToday}\n\n` +
    `🎨 이미지 생성: ${stats.imagesGenerated}\n` +
    `✏️ 이미지 편집: ${stats.imagesEdited}\n\n` +
    `💰 토큰 사용: ${stats.tokensSpent}\n` +
    `💎 토큰 구매: ${stats.tokensPurchased}\n` +
    `💵 수익: $${stats.revenue}`,
    { parse_mode: 'Markdown' }
  );
});

// /admin_users - 사용자 검색
bot.command('admin_users', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const query = ctx.match?.toString() || '';
  const users = await searchUsers(query);

  let message = `🔍 **사용자 검색 결과** (${users.length}명)\n\n`;
  users.slice(0, 10).forEach(u => {
    message += `• @${u.username} (${u.tokens} 토큰)\n`;
  });

  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// /admin_broadcast - 전체 공지
bot.command('admin_broadcast', async (ctx) => {
  if (!isAdmin(ctx)) return;

  const message = ctx.match?.toString();
  if (!message) {
    return ctx.reply('사용법: /admin_broadcast [메시지]');
  }

  const users = await getAllUsers();
  let sent = 0;

  for (const user of users) {
    try {
      await bot.api.sendMessage(user.telegram_id, message);
      sent++;
    } catch (error) {
      // 블락당했거나 봇 삭제한 경우
    }
  }

  await ctx.reply(`✅ ${sent}/${users.length}명에게 전송 완료`);
});
```

---

## 📋 Phase 5: 세션 시스템 수정 (1일)

### 5.1 기존 문제 해결

**문제:** webhook.ts에서 SessionManager를 사용하지 않음

**수정 파일:** `netlify/functions/webhook.ts`

```typescript
import { SessionManager } from '../../src/session/SessionManager';

const sessionManager = SessionManager.getInstance();

// 도비야 질문 핸들러 수정
async function handleDobbyQuestion(ctx: Context, question: string) {
  const userId = ctx.from!.id;
  const chatId = ctx.chat!.id;

  // 세션 생성/조회
  const session = await sessionManager.getOrCreateSession(userId, chatId);

  // 사용자 메시지 저장
  await sessionManager.addMessage(session.id, 'user', question);

  // 컨텍스트 가져오기
  const context = await sessionManager.getContextForAPI(session.id);

  // Claude API 호출 (컨텍스트 포함)
  const answer = await callClaudeAPI(question, context);

  // 응답 저장
  await sessionManager.addMessage(session.id, 'assistant', answer);

  await ctx.reply(answer);
}
```

---

## 📋 Phase 6: 최종 통합 및 테스트 (2일)

### 6.1 환경변수 업데이트

**파일:** `.env.example`

```bash
# Telegram
BOT_TOKEN=your_bot_token_here
TELEGRAM_BOT_TOKEN=your_bot_token_here

# AI APIs
CLAUDE_API_KEY=your_claude_key
GOOGLE_API_KEY=your_gemini_key

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# Image Generation
NANO_BANAFO_API_KEY=your_api_key
NANO_BANAFO_API_URL=https://api.banafo.ai

# Admin
ADMIN_USER_IDS=123456789,987654321

# Payment (Telegram Stars)
PAYMENT_PROVIDER_TOKEN=your_provider_token

# Features
NODE_ENV=production
ENABLE_HOT_RELOAD=false
```

### 6.2 통합 테스트 체크리스트

#### 프롬프트 관리 시스템
- [ ] JSON 파일에서 프롬프트 로드
- [ ] `/admin_reload` 명령어로 Hot reload
- [ ] `/admin_prompt list` 목록 확인
- [ ] DB 동기화 확인

#### 토큰 시스템
- [ ] 신규 사용자 50 토큰 지급
- [ ] 이미지 편집 시 토큰 차감
- [ ] `/balance` 명령어로 잔액 확인
- [ ] `/buy` 명령어로 패키지 구매
- [ ] 추천 코드 생성 및 사용

#### 그룹 기능
- [ ] `/monitor_on` 모니터링 시작
- [ ] 메시지 저장 확인
- [ ] `/summarize` 대화 요약
- [ ] `@pixie` 멘션 답변
- [ ] `/monitor_off` 모니터링 종료

#### 관리자 기능
- [ ] `/admin_stats` 통계 확인
- [ ] `/admin_users` 사용자 검색
- [ ] `/admin_broadcast` 공지 발송
- [ ] `/admin_prompt` 프롬프트 관리

#### 세션 시스템
- [ ] 연속 대화 컨텍스트 유지
- [ ] 3개 이상 질문 테스트
- [ ] 세션 만료 처리

---

## 🚀 배포 전략

### 1. 준비 단계
```bash
# 1. 의존성 설치
npm install

# 2. 빌드
npm run build

# 3. 환경변수 확인
cp .env.example .env
# .env 파일 수정

# 4. 데이터베이스 마이그레이션
psql -f sql/010_token_system.sql
psql -f sql/011_group_features.sql
psql -f sql/012_statistics.sql

# 5. 프롬프트 동기화
npm run prompt:sync
```

### 2. 단계별 배포
1. **Phase 1**: 프롬프트 시스템만 먼저 배포
2. **Phase 2**: 토큰 시스템 추가 (기존 사용자에게 50 토큰 지급)
3. **Phase 3**: 그룹 기능 추가
4. **Phase 4**: 관리자 기능 추가
5. **Phase 5**: 세션 수정 적용
6. **Phase 6**: 전체 통합 테스트

### 3. 롤백 계획
각 Phase마다 Git 태그 생성:
```bash
git tag v1.0.0-phase1
git tag v1.0.0-phase2
...
```

문제 발생 시 이전 버전으로 롤백:
```bash
git checkout v1.0.0-phase1
```

---

## 📝 CLAUDE.md 업데이트

프로젝트 루트의 `CLAUDE.md` 파일을 다음과 같이 업데이트합니다:

```markdown
# 📝 CLAUDE.md - 개발 컨텍스트 문서

## 🎯 프로젝트 상태 (2025-01-07)

### 현재 진행: Pixie 업그레이드
**목표**: MultifulDobi → Pixie로 진화
**계획 문서**: `docs/PIXIE_MIGRATION_PLAN.md`

### 구현 진행 상황
- [ ] Phase 1: 프롬프트 관리 시스템 (0%)
- [ ] Phase 2: 토큰 경제 시스템 (0%)
- [ ] Phase 3: 그룹 채팅 기능 (0%)
- [ ] Phase 4: 관리자 대시보드 (0%)
- [ ] Phase 5: 세션 시스템 수정 (0%)
- [ ] Phase 6: 최종 통합 테스트 (0%)

### 세션 재개 시 확인사항
1. `docs/PIXIE_MIGRATION_PLAN.md` 읽기
2. 현재 Phase 확인
3. 해당 Phase의 작업 내용 검토
4. 테스트 체크리스트 확인

---

## 🚨 알려진 이슈

### 1. 세션 기억 기능 미작동
**상태**: Phase 5에서 해결 예정
**해결 방법**: webhook.ts에서 SessionManager 통합

### 2. 템플릿 불일치 (해결됨)
**해결일**: 2025-01-07
**내용**: DB와 하드코딩 템플릿 불일치 수정

---

## 📋 새로운 명령어

### 사용자 명령어
- `/balance` - 토큰 잔액 확인
- `/buy` - 토큰 구매
- `/referral` - 추천 코드 확인
- `/monitor_on` - 그룹 모니터링 시작 (관리자만)
- `/monitor_off` - 그룹 모니터링 종료 (관리자만)
- `/summarize [N]` - 최근 N개 메시지 요약
- `@pixie [질문]` - 컨텍스트 기반 답변

### 관리자 명령어
- `/admin_stats` - 시스템 통계
- `/admin_users [검색어]` - 사용자 검색
- `/admin_broadcast [메시지]` - 전체 공지
- `/admin_prompt list` - 프롬프트 목록
- `/admin_prompt enable <key>` - 프롬프트 활성화
- `/admin_prompt disable <key>` - 프롬프트 비활성화
- `/admin_reload` - 프롬프트 파일 다시 로드
- `/admin_test <key>` - 프롬프트 테스트

---

*마지막 업데이트: 2025-01-07*
*다음 작업: Phase 1 시작*
```

---

## 🎯 다음 단계

이 문서를 읽은 후, 다음과 같이 진행하세요:

1. **Phase 1부터 시작**: 프롬프트 관리 시스템
2. **각 Phase 완료 후 Git commit**: 명확한 히스토리 유지
3. **테스트 후 다음 Phase**: 문제 없을 때만 진행
4. **CLAUDE.md 진행률 업데이트**: 세션 중단 대비

### 시작 명령어
```bash
# 1. 이 문서 확인
cat docs/PIXIE_MIGRATION_PLAN.md

# 2. Phase 1 시작
mkdir -p src/data/prompts/{core,experimental,seasonal}

# 3. 첫 번째 JSON 파일 생성
# (다음 세션에서 진행)
```
