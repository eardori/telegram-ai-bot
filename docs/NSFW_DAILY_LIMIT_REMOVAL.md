# NSFW 일일 한도 제거 - 설계 문서

**작성일:** 2025-01-10
**버전:** 1.0
**상태:** ✅ 구현 완료

---

## 📋 목차

1. [문제 상황](#문제-상황)
2. [근본 원인 분석](#근본-원인-분석)
3. [해결 방안](#해결-방안)
4. [구현 내용](#구현-내용)
5. [비즈니스 임팩트](#비즈니스-임팩트)
6. [배포 가이드](#배포-가이드)

---

## 🚨 문제 상황

### 사용자 신고
```
❌ 일일 사용 한도 초과

오늘 사용 가능한 NSFW 크레딧을 모두 사용했습니다.

📊 오늘의 사용량:
• 사용: 0회
• 한도: 5회
• 남은 횟수: 0회
```

**문제점:**
- 사용: **0회**인데 한도 초과 메시지 표시
- NSFW 기능을 전혀 사용할 수 없음
- 성인 인증 완료했음에도 차단됨

---

## 🔍 근본 원인 분석

### 1. NULL 값 처리 버그

**SQL 함수:** `check_nsfw_daily_limit()`

```sql
-- Line 105-113: users.nsfw_daily_limit 조회
SELECT u.nsfw_daily_limit INTO v_user_limit
FROM users u WHERE u.id = p_user_id;

-- Line 136: 한도 체크
(v_used_today < v_user_limit) as can_use
```

**문제:**
- `nsfw_daily_limit`이 `NULL`인 경우
- `(0 < NULL)` = `NULL` (PostgreSQL)
- `NULL`은 boolean context에서 `FALSE`로 처리
- 결과: `can_use = false` (잘못된 차단!)

**왜 NULL인가?**
- `ALTER TABLE` 실행 전 생성된 기존 사용자
- 또는 SQL 스크립트가 Supabase에 미실행

---

### 2. 중복 제한 문제

**현재 시스템:**
1. ✅ **크레딧 시스템:** 일반 이미지 편집과 동일하게 크레딧 차감
2. ❌ **NSFW 일일 한도:** 추가로 5회/일 제한

**문제:**
- 무료 사용자: 총 5 크레딧 (이미 제한됨)
- 유료 사용자: 30~600 크레딧인데 NSFW는 5회만? (불합리!)
- VIP 사용자: Unlimited 크레딧인데 NSFW는 5회만? (불합리!)

**결론:** NSFW 일일 한도는 **불필요한 중복 제한**

---

## ✅ 해결 방안

### Step 1: NULL 방어 (즉시 적용)

**목적:** 긴급 버그 수정

**수정 내용:**
```sql
-- BEFORE:
SELECT u.nsfw_daily_limit INTO v_user_limit

-- AFTER:
SELECT COALESCE(u.nsfw_daily_limit, 5) INTO v_user_limit
```

**효과:**
- NULL 값에도 정상 작동
- 기본값 5로 안전하게 처리

---

### Step 2: 일일 한도 완전 제거 (장기적 개선)

**목적:** 중복 제한 제거, UX 개선

**이유:**
1. **크레딧 시스템으로 이미 제어**
   - 무료: 5 크레딧 (충분히 제한됨)
   - 유료: 30~600 크레딧 (한도 5는 너무 적음)
   - VIP: Unlimited (한도 불필요)

2. **일관성**
   - 일반 템플릿: 크레딧만 체크
   - NSFW 템플릿: 크레딧 + 일일 한도 (불일치!)

3. **비즈니스 임팩트**
   - 유료 사용자 만족도 향상
   - 불필요한 제한 제거

**수정 내용:**
- `canUseNSFW()`: 일일 한도 체크 제거
- `webhook.ts`: 한도 초과 핸들러 제거

**남은 체크:**
- ✅ 성인 인증 (필수)
- ✅ 크레딧 (checkCreditsBeforeEdit)
- ❌ 일일 한도 (제거!)

---

## 🛠️ 구현 내용

### 1. SQL 스크립트 (sql/031_fix_nsfw_daily_limit.sql)

```sql
-- NULL 방어 추가
SELECT COALESCE(u.nsfw_daily_limit, 5) INTO v_user_limit

-- 기존 NULL 값 업데이트
UPDATE users SET nsfw_daily_limit = 5 WHERE nsfw_daily_limit IS NULL;
```

---

### 2. TypeScript 코드 수정

#### **src/services/nsfw-safety.ts**

```typescript
async canUseNSFW(userId: number): Promise<...> {
  // 1. 성인 인증 체크 (유지)
  const consentStatus = await this.checkConsent(userId);

  if (!consentStatus.consent_given) {
    return { allowed: false, reason: 'no_consent' };
  }

  // 2. 일일 한도 체크 (제거!)
  // ❌ const limitCheck = await this.checkDailyLimit(userId);
  // ❌ if (!limitCheck.can_use) { return { allowed: false }; }

  // All checks passed
  return { allowed: true };
}
```

#### **netlify/functions/webhook.ts**

```typescript
// NSFW 템플릿 선택 시
if (template.category === 'nsfw') {
  const accessCheck = await nsfwSafetyService.canUseNSFW(userId);

  // 동의 체크만 수행
  if (!accessCheck.allowed && accessCheck.reason === 'no_consent') {
    // 동의 다이얼로그 표시
    return;
  }

  // ❌ 일일 한도 초과 핸들러 제거
  // if (accessCheck.reason === 'daily_limit_exceeded') { ... }
}

// 크레딧 체크 (기존대로 유지)
const creditCheck = await checkCreditsBeforeEdit(ctx, templateKey);
```

---

## 💼 비즈니스 임팩트

### Before (일일 한도 5회)

| 사용자 유형 | 크레딧 | NSFW 일일 한도 | 실제 사용 가능 |
|------------|--------|---------------|---------------|
| 무료       | 5      | 5회           | 5회 (크레딧 제한) |
| 베이직     | 30     | 5회           | **5회** ⚠️ |
| 프로       | 80     | 5회           | **5회** ⚠️ |
| VIP        | 무제한  | 5회           | **5회** ⚠️ |

**문제:** 유료 사용자가 돈을 내고도 5회만 사용 가능!

---

### After (일일 한도 제거)

| 사용자 유형 | 크레딧 | NSFW 일일 한도 | 실제 사용 가능 |
|------------|--------|---------------|---------------|
| 무료       | 5      | 제거          | 5회 (크레딧 제한) |
| 베이직     | 30     | 제거          | **30회** ✅ |
| 프로       | 80     | 제거          | **80회** ✅ |
| VIP        | 무제한  | 제거          | **무제한** ✅ |

**개선:**
- 유료 사용자가 크레딧만큼 사용 가능
- 합리적인 제한
- 사용자 만족도 향상

---

## 📦 배포 가이드

### 1. Supabase SQL 실행

**파일:** `sql/031_fix_nsfw_daily_limit.sql`

**실행 순서:**
```bash
# Supabase Dashboard → SQL Editor
# 1. check_nsfw_daily_limit 함수 재생성 (COALESCE 추가)
# 2. UPDATE users SET nsfw_daily_limit = 5 WHERE nsfw_daily_limit IS NULL
```

**검증:**
```sql
-- NULL 값이 없는지 확인
SELECT COUNT(*) FROM users WHERE nsfw_daily_limit IS NULL;
-- 결과: 0

-- 함수 테스트
SELECT * FROM check_nsfw_daily_limit(139680303);
-- 결과: can_use=true, daily_limit=5, used_today=0
```

---

### 2. 코드 배포

**변경된 파일:**
- `src/services/nsfw-safety.ts` - 일일 한도 체크 제거
- `netlify/functions/webhook.ts` - 한도 초과 핸들러 제거

**배포 명령:**
```bash
npm run build
git add -A
git commit -m "fix: NSFW 일일 한도 제거 및 NULL 방어"
git push origin main
# → Render.com 자동 배포 (2-3분)
```

---

### 3. 테스트 시나리오

#### Test 1: 신규 사용자 (NULL 방어 테스트)
```
1. 새 계정으로 봇 시작
2. 사진 업로드
3. 🔞 성인 전용 클릭
4. 동의 다이얼로그 → "예" 클릭
5. NSFW 템플릿 선택
✅ 예상: 정상 작동 (한도 초과 메시지 없음)
```

#### Test 2: 기존 사용자 (일일 한도 제거 테스트)
```
1. 이미 동의한 계정
2. NSFW 템플릿 6회 연속 사용
✅ 예상: 크레딧 소진까지 사용 가능 (5회 제한 없음)
```

#### Test 3: 유료 사용자 (무제한 사용)
```
1. 베이직/프로 구독 사용자
2. NSFW 템플릿 30회 사용
✅ 예상: 크레딧만 체크 (일일 한도 없음)
```

---

## 📊 모니터링

### 확인 사항

1. **에러 로그:**
   ```bash
   # Render.com Logs
   grep "NSFW" logs | grep "ERROR"
   ```

2. **사용 통계:**
   ```sql
   -- NSFW 일일 사용량 (제한 없이 증가하는지 확인)
   SELECT DATE(created_at), COUNT(*)
   FROM nsfw_usage_log
   GROUP BY DATE(created_at)
   ORDER BY DATE(created_at) DESC
   LIMIT 7;
   ```

3. **크레딧 차감:**
   ```sql
   -- NSFW 편집도 크레딧 차감되는지 확인
   SELECT * FROM credit_transactions
   WHERE description LIKE '%NSFW%'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

---

## 🔄 롤백 계획

만약 문제 발생 시:

```sql
-- Step 1: 일일 한도 다시 활성화
-- src/services/nsfw-safety.ts의 주석 해제
-- webhook.ts의 한도 체크 복원

-- Step 2: 재배포
npm run build && git add -A && git commit -m "revert: NSFW 일일 한도 복원" && git push
```

---

## 📝 결론

### 변경 사항 요약

| 항목 | Before | After |
|------|--------|-------|
| NULL 방어 | ❌ 없음 | ✅ COALESCE 추가 |
| NSFW 일일 한도 | ❌ 5회 | ✅ 제거 (크레딧만) |
| 무료 사용자 | 5회 | 5회 (동일) |
| 유료 사용자 | 5회 | 30~600회 (개선!) |
| VIP 사용자 | 5회 | 무제한 (개선!) |

### 기대 효과

1. ✅ **버그 수정:** NULL 값으로 인한 차단 해결
2. ✅ **UX 개선:** 유료 사용자 만족도 향상
3. ✅ **시스템 일관성:** 크레딧 시스템으로 통일
4. ✅ **비즈니스 임팩트:** 구독 가치 증대

---

**작성자:** Claude Code
**최종 수정:** 2025-01-10
