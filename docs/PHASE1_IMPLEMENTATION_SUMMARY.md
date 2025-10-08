# 🚀 Phase 1 MVP 구현 완료 요약

## ✅ 완료된 작업

### 1️⃣ 데이터베이스 스키마 (`sql/020_credit_system.sql`)

#### 생성된 테이블 (5개)

1. **`user_credits`** - 유저별 크레딧 잔액 및 구독 정보
   - `free_credits` - 무료 크레딧 (신규 가입 시 5개)
   - `paid_credits` - 충전 크레딧
   - `subscription_type` - 구독 플랜 (light/basic/pro/enterprise)
   - `subscription_status` - 구독 상태 (active/cancelled/expired)

2. **`credit_transactions`** - 모든 크레딧 거래 기록
   - `transaction_type` - purchase, usage, refund, bonus, signup
   - `credit_type` - free, paid, subscription
   - `amount` - 양수(충전), 음수(사용)
   - `related_template_key` - 사용한 템플릿 (usage인 경우)

3. **`credit_packages`** - 크레딧 패키지 정보
   ```
   starter  - 30회 / 100⭐
   popular  - 80회 / 200⭐ (BEST)
   value    - 250회 / 500⭐
   mega     - 600회 / 1000⭐ (HOT)
   ```

4. **`subscription_plans`** - 구독 플랜 정보
   ```
   light       - 30회/월 / 99⭐
   basic       - 100회/월 / 249⭐ (BEST)
   pro         - 300회/월 / 599⭐
   enterprise  - 1000회/월 / 1599⭐ (PRO)
   ```

5. **`group_free_trials`** - 그룹별 무료 체험 기록 (FOMO 전략)
   - 한 유저가 한 그룹에서 1회만 무료 체험 가능
   - `converted_to_paid` - 전환 여부 추적

#### 생성된 뷰 (1개)

- **`v_user_total_credits`** - 유저별 총 크레딧 조회 (free + paid + subscription)

#### 생성된 함수 (2개)

1. **`deduct_credit()`** - 크레딧 차감 (트랜잭션 안전)
   - 무료 크레딧 우선 사용
   - 잔액 부족 시 실패 반환
   - 거래 기록 자동 생성

2. **`add_credits()`** - 크레딧 충전
   - free/paid 타입 지원
   - 거래 기록 자동 생성

---

### 2️⃣ 핵심 서비스 구현

#### `src/services/auth-service.ts` - 인증 및 유저 관리

**주요 기능:**
- `registerUser()` - 신규 유저 등록 + 무료 5크레딧 지급
- `getUserWithCredits()` - 유저 정보 + 크레딧 조회
- `hasEnoughCredits()` - 크레딧 잔액 확인
- `updateLastActive()` - 마지막 활동 시간 업데이트

**신규 가입 플로우:**
```typescript
const { user, credits, isNewUser } = await registerUser(userId, username, firstName);

if (isNewUser) {
  // 새 유저: 5 무료 크레딧 자동 지급
  console.log(`New user: ${credits.free_credits} credits`);
}
```

---

#### `src/services/credit-manager.ts` - 크레딧 관리

**주요 기능:**
- `deductCredit()` - 크레딧 차감 (이미지 편집 시)
- `addCredits()` - 크레딧 충전 (구매 시)
- `getCreditBalance()` - 잔액 조회
- `getActivePackages()` - 크레딧 패키지 목록
- `getActiveSubscriptionPlans()` - 구독 플랜 목록
- `getTransactionHistory()` - 거래 내역 조회

**사용 예시:**
```typescript
// 크레딧 체크
const balance = await getCreditBalance(userId);
if (balance.total_credits < 1) {
  await ctx.reply('크레딧이 부족합니다!');
  return;
}

// 크레딧 차감
const result = await deductCredit(userId, 1, templateKey, editId);
if (!result.success) {
  await ctx.reply(result.message);
  return;
}

// 이미지 편집 실행...
```

---

#### `src/services/group-fomo-service.ts` - 그룹 FOMO 전략

**주요 기능:**
- `hasUsedGroupFreeTrial()` - 그룹 무료 체험 사용 여부 확인
- `recordGroupFreeTrial()` - 무료 체험 기록
- `markAsConverted()` - 전환 완료 표시
- `getGroupStats()` - 그룹 전환율 통계
- `generateFOMOMessage()` - FOMO 메시지 생성

**FOMO 전략 플로우:**
```typescript
// 그룹에서 비등록 유저가 버튼 클릭
if (!isRegistered) {
  const hasUsed = await hasUsedGroupFreeTrial(userId, groupId);

  if (hasUsed) {
    // 이미 사용 → 가입 유도
    await ctx.reply(generateFOMOMessage(['김철수', '박영희'], true));
  } else {
    // 첫 체험 → 무료로 제공
    await recordGroupFreeTrial(userId, groupId, templateKey);
    await processImageEdit(ctx, templateKey);
    await ctx.reply(generateTrialSuccessMessage());
  }
}
```

---

## 📊 새로운 가격표 (실제 비용 $0.002 반영)

### 크레딧 패키지

| 패키지 | 크레딧 | 가격 | 회당 가격 | 할인율 | 마진 |
|--------|--------|------|-----------|--------|------|
| 스타터 | 30회 | 100⭐ ($1.30) | $0.043 | - | 95.4% |
| 인기팩 ⭐ | 80회 | 200⭐ ($2.60) | $0.033 | 24% | 93.8% |
| 가치팩 | 250회 | 500⭐ ($6.50) | $0.026 | 40% | 92.3% |
| 메가팩 💎 | 600회 | 1000⭐ ($13.00) | $0.022 | 50% | 90.8% |

### 구독 플랜

| 플랜 | 크레딧/월 | 가격/월 | 회당 가격 | 마진 |
|------|-----------|---------|-----------|------|
| 라이트 | 30회 | 99⭐ ($1.29) | $0.043 | 95.3% |
| 베이직 ⭐ | 100회 | 249⭐ ($3.24) | $0.032 | 93.8% |
| 프로 💎 | 300회 | 599⭐ ($7.79) | $0.026 | 92.3% |
| 엔터프라이즈 🏆 | 1000회 | 1599⭐ ($20.79) | $0.021 | 90.4% |

**중요 변경사항:**
- ❌ **무제한 플랜 폐지** (적자 리스크)
- ✅ 모든 플랜을 정량제로 변경
- ✅ 여전히 90%+ 마진 유지

---

## 🎯 다음 단계 (Phase 2)

### 즉시 실행 필요

#### 1. 데이터베이스 마이그레이션
```bash
# Supabase SQL Editor에서 실행
cat sql/020_credit_system.sql
# 전체 SQL 복사 후 실행
```

#### 2. 기존 코드 통합
- [ ] **webhook.ts 수정**
  - 사진 업로드 시 유저 등록 체크
  - 이미지 편집 전 크레딧 체크
  - 크레딧 차감 로직 추가
  - 그룹 채팅 FOMO 전략 적용

- [ ] **크레딧 소진 시 안내**
  - 충전 패키지 표시
  - Telegram Stars 결제 버튼

#### 3. 테스트
```
1. 신규 유저 → 5 크레딧 확인
2. 이미지 편집 5회 → 크레딧 소진
3. 소진 시 안내 메시지 확인
4. 그룹에서 비등록 유저 → 1회 무료 체험
5. 2번째 시도 → 가입 유도 메시지
```

---

## 📁 생성된 파일

### SQL
- `sql/020_credit_system.sql` - 전체 스키마 (5 테이블, 1 뷰, 2 함수)

### TypeScript 서비스
- `src/services/auth-service.ts` - 유저 인증 및 등록
- `src/services/credit-manager.ts` - 크레딧 관리
- `src/services/group-fomo-service.ts` - 그룹 FOMO 전략

### JavaScript (빌드 완료)
- `dist/src/services/auth-service.js`
- `dist/src/services/credit-manager.js`
- `dist/src/services/group-fomo-service.js`

---

## 💡 핵심 인사이트

### ✅ 완료된 것
1. **데이터베이스 스키마** - 5개 테이블, 트랜잭션 안전 함수
2. **인증 시스템** - 신규 가입 시 무료 5크레딧 자동 지급
3. **크레딧 관리** - 조회/차감/충전 완전 구현
4. **FOMO 전략** - 그룹별 무료 체험 추적
5. **새로운 가격표** - 실제 비용 반영, 90%+ 마진 유지

### ⚠️ 미완성 (Phase 2)
1. **webhook.ts 통합** - 기존 코드에 크레딧 체크 추가
2. **결제 시스템** - Telegram Stars API 연동
3. **구독 관리** - 자동 갱신, 만료 처리
4. **리퍼럴** - 친구 초대 보너스
5. **관리자 대시보드** - 통계 및 모니터링

### 🚨 주의사항
1. **SQL 먼저 실행** - Supabase에서 스키마 생성 필수
2. **환경 변수 확인** - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
3. **트랜잭션 안전** - `deduct_credit()` 함수가 동시성 처리
4. **무제한 플랜 없음** - 모두 정량제로 변경

---

## 🎓 사용 가이드

### 신규 유저 등록
```typescript
import { registerUser } from './services/auth-service';

const { user, credits, isNewUser } = await registerUser(
  ctx.from.id,
  ctx.from.username,
  ctx.from.first_name
);

if (isNewUser) {
  await ctx.reply(
    `🎉 가입을 환영합니다!\n\n` +
    `🎁 무료 크레딧 ${credits.free_credits}개를 드렸습니다!\n` +
    `지금 바로 사진을 업로드하여 AI 편집을 시작하세요!`
  );
}
```

### 크레딧 체크 및 차감
```typescript
import { getCreditBalance, deductCredit } from './services/credit-manager';

// 1. 잔액 확인
const balance = await getCreditBalance(userId);

if (balance.total_credits < 1) {
  // 크레딧 소진 → 충전 안내
  await showPurchaseOptions(ctx);
  return;
}

// 2. 이미지 편집 전 크레딧 차감
const result = await deductCredit(userId, 1, templateKey);

if (!result.success) {
  await ctx.reply(`❌ ${result.message}`);
  return;
}

// 3. 이미지 편집 실행
await processImageEdit(ctx, templateKey);

// 4. 남은 크레딧 알림
await ctx.reply(
  `✅ 편집 완료!\n\n` +
  `💳 남은 크레딧: ${result.remaining_credits}회`
);
```

### 그룹 FOMO 전략
```typescript
import {
  hasUsedGroupFreeTrial,
  recordGroupFreeTrial,
  generateFOMOMessage,
  generateTrialSuccessMessage
} from './services/group-fomo-service';

// 그룹 채팅에서
if (ctx.chat.type !== 'private') {
  const userId = ctx.from.id;
  const groupId = ctx.chat.id;

  // 등록 여부 확인
  const { user, credits } = await getUserWithCredits(userId);

  if (!user || credits.total_credits === 0) {
    // 비등록 유저
    const hasUsed = await hasUsedGroupFreeTrial(userId, groupId);

    if (hasUsed) {
      // 이미 사용 → 가입 유도
      await ctx.reply(generateFOMOMessage([], true));
      return;
    }

    // 첫 체험 → 무료로 제공
    await recordGroupFreeTrial(userId, groupId, templateKey);
    await processImageEdit(ctx, templateKey);
    await ctx.reply(generateTrialSuccessMessage());
  } else {
    // 등록 유저 → 정상 크레딧 차감
    const result = await deductCredit(userId, 1, templateKey);

    // 개인 DM으로 차감 알림
    await bot.api.sendMessage(
      userId,
      `✅ 크레딧 1회 차감\n💳 남은 크레딧: ${result.remaining_credits}회`
    );

    // 그룹에는 결과만 전송
    await processImageEdit(ctx, templateKey);
  }
}
```

---

## 📞 문의 및 지원

- 구현 관련 질문: GitHub Issues
- 데이터베이스 스키마 수정: `sql/020_credit_system.sql` 참고
- 가격 조정: `credit_packages`, `subscription_plans` 테이블 UPDATE

---

**작성일**: 2025-01-08
**버전**: Phase 1 MVP
**상태**: 구현 완료, 통합 대기
**다음 단계**: webhook.ts 통합 + Telegram Stars 결제
