# 🔧 관리자 기능 개발 계획

## 📋 목차
1. [현재 구현된 기능](#현재-구현된-기능)
2. [Phase 1: 기본 어드민 대시보드](#phase-1-기본-어드민-대시보드)
3. [Phase 2: 프롬프트 관리 시스템](#phase-2-프롬프트-관리-시스템)
4. [Phase 3: 사용자 및 크레딧 관리](#phase-3-사용자-및-크레딧-관리)
5. [Phase 4: 고급 분석 및 모니터링](#phase-4-고급-분석-및-모니터링)
6. [구현 우선순위](#구현-우선순위)

---

## ✅ 현재 구현된 기능

### 명령어
- ✅ `/apicost` - API 사용량 및 비용 통계
- ✅ `/whoami` - User ID 확인
- ✅ `/track_start` - 대화 추적 시작
- ✅ `/track_stop` - 대화 추적 중지
- ✅ `/track_status` - 추적 상태 확인
- ✅ `/summarize` - 대화 요약 생성
- ✅ `/health` - 시스템 상태 확인
- ✅ `/maintenance` - 유지보수 모드

### 데이터베이스 시스템
- ✅ `prompts` 테이블 - 동적 프롬프트 관리
- ✅ `prompt_usage_analytics` - 프롬프트 사용 분석
- ✅ `bot_activity_log` - 봇 활동 로그
- ✅ `user_preferences` - 사용자 설정
- ✅ `tracking_sessions` - 대화 추적 세션
- ✅ `conversation_summaries` - 대화 요약

### 유틸리티 함수
- ✅ `src/utils/prompt-admin.ts` - 프롬프트 관리 유틸리티
  - bulkCreatePrompts()
  - exportPrompts()
  - getPromptStats()
  - cleanupOldUsageData()
  - duplicatePrompt()
  - validatePromptTemplate()
  - generateUsageReport()

---

## 🎯 Phase 1: 기본 어드민 대시보드 (1-2주)

### 1.1 통합 대시보드 명령어 `/admin`

**기능:**
```
/admin 또는 /admin dashboard
→ 실시간 시스템 상태 대시보드 표시
```

**표시 정보:**
```
📊 Multiful Bot 관리자 대시보드

🔢 실시간 통계 (24시간):
• 총 사용자: 1,234명
• 활성 사용자: 456명
• 이미지 편집: 789회
• 크레딧 충전: 123건

💰 수익 현황 (24시간):
• 총 매출: $234.56 (16,432⭐)
• 순이익: $145.67 (Telegram 수수료 제외)
• API 비용: -$8.90
• 서버 비용: -$1.17/일

💳 크레딧 현황:
• 총 발행: 45,678 크레딧
• 사용됨: 23,456 크레딧 (51%)
• 남은 크레딧: 22,222 크레딧

⚠️ 알림:
• ❌ 3건의 결제 실패
• ⚡ API 응답 시간 증가 (평균 2.3초)

[💳 크레딧 관리] [📊 상세 분석] [🔧 시스템 설정]
```

**구현:**
```typescript
// src/services/admin-dashboard.ts

export async function getAdminDashboard(): Promise<DashboardData> {
  const [
    userStats,
    revenueStats,
    creditStats,
    systemAlerts
  ] = await Promise.all([
    getUserStats24h(),
    getRevenueStats24h(),
    getCreditStats(),
    getSystemAlerts()
  ]);

  return {
    userStats,
    revenueStats,
    creditStats,
    systemAlerts
  };
}
```

### 1.2 사용자 통계 명령어 `/admin users`

**기능:**
```
/admin users
→ 사용자 관련 상세 통계
```

**표시 정보:**
```
👥 사용자 통계

📈 성장 추이:
• 신규 가입 (오늘): 45명
• 신규 가입 (이번 주): 234명
• 신규 가입 (이번 달): 1,023명

💰 전환율:
• 무료 → 유료 전환율: 12.3% (목표: 10%)
• 크레딧 → 구독 전환율: 28.5% (목표: 25%)

🎯 활성 사용자:
• DAU: 456명
• WAU: 1,234명
• MAU: 3,456명

📊 사용자 분류:
• 무료 사용자: 2,890명 (84%)
• 크레딧 구매: 445명 (13%)
• 구독 사용자: 121명 (3%)

[📋 사용자 목록] [🔍 검색] [📊 상세 보기]
```

### 1.3 수익 분석 명령어 `/admin revenue`

**기능:**
```
/admin revenue [period]
→ 수익 상세 분석 (period: today|week|month|all)
```

**표시 정보:**
```
💰 수익 분석 (이번 달)

📊 총 수익:
• 총 매출: $3,456.78
• Telegram 수수료 (30%): -$1,037.03
• 순매출: $2,419.75
• API 비용: -$234.56
• 순이익: $2,185.19

📦 패키지별 매출:
• 스타터 팩: $456.78 (321건)
• 인기 팩: $1,234.56 (567건)
• 가치 팩: $789.12 (123건)
• 메가 팩: $976.32 (89건)

📅 구독 매출:
• 라이트 플랜: $234.56 (234명)
• 베이직 플랜: $567.89 (189명)
• 프로 플랜: $345.67 (45명)
• 엔터프라이즈: $89.12 (4명)

📈 예상 MRR: $1,237.24

[📊 그래프 보기] [📥 엑셀 다운로드]
```

**구현:**
```typescript
export async function getRevenueAnalysis(period: 'today' | 'week' | 'month' | 'all'): Promise<RevenueData> {
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select(`
      *,
      credit_packages(package_name_ko, price_stars),
      subscription_plans(plan_name_ko, price_stars)
    `)
    .gte('created_at', getStartDate(period))
    .eq('transaction_type', 'purchase');

  // Calculate revenue with Telegram fee
  const telegramFee = 0.3; // 30%
  const starToUSD = 0.013;

  // ... calculation logic
}
```

---

## 🎨 Phase 2: 프롬프트 관리 시스템 (1주)

### 2.1 프롬프트 목록 `/admin prompts`

**기능:**
```
/admin prompts [type]
→ 프롬프트 목록 및 관리 (type: all|qa|image|summary)
```

**표시 정보:**
```
🎨 프롬프트 관리

📝 활성 프롬프트 (38개):
┌─────────────────────────────────────┐
│ 🎭 3D 피규어 (figurine_commercial)  │
│ 사용: 1,234회 | 성공률: 98.5%       │
│ [✏️ 수정] [📊 통계] [❌ 비활성화]   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🌍 배경 변경 (background_replace)   │
│ 사용: 987회 | 성공률: 99.2%         │
│ [✏️ 수정] [📊 통계] [❌ 비활성화]   │
└─────────────────────────────────────┘

[➕ 새 프롬프트] [📥 Import] [📤 Export]
```

### 2.2 프롬프트 편집 `/admin prompt:edit`

**기능:**
```
봇과의 대화형 프롬프트 편집
```

**워크플로우:**
```
1. 관리자: /admin prompt:edit figurine_commercial

2. 봇:
현재 프롬프트 내용:
─────────────────────
{current_prompt_text}
─────────────────────

수정할 내용을 입력하세요:
[전체 수정] [변수 변경] [설정 변경] [취소]

3. 관리자: [전체 수정] 선택

4. 봇: 새로운 프롬프트 텍스트를 입력하세요:

5. 관리자: {new_prompt_text}

6. 봇:
✅  프롬프트 업데이트 완료!

미리보기:
{new_prompt_text}

[✔️ 확인] [❌ 취소] [🧪 테스트]
```

### 2.3 프롬프트 통계 `/admin prompt:stats`

**기능:**
```
/admin prompt:stats <prompt_key>
→ 특정 프롬프트의 상세 통계
```

**표시 정보:**
```
📊 프롬프트 통계: 3D 피규어

📈 사용 현황 (지난 7일):
• 총 사용: 1,234회
• 성공: 1,215회 (98.5%)
• 실패: 19회 (1.5%)

⏱️ 성능:
• 평균 응답 시간: 2.3초
• 최소: 1.1초
• 최대: 8.7초

💰 비용:
• 총 비용: $2.468
• 평균 비용: $0.002/회

⚠️ 최근 에러 (19건):
1. Timeout error (8건)
2. Invalid image format (6건)
3. API rate limit (5건)

📊 사용 패턴:
[시간대별 그래프]
[요일별 그래프]

[🔄 프롬프트 최적화 제안]
```

---

## 💳 Phase 3: 사용자 및 크레딧 관리 (1-2주)

### 3.1 사용자 검색 `/admin user:search`

**기능:**
```
/admin user:search <user_id|username>
→ 특정 사용자 정보 조회
```

**표시 정보:**
```
👤 사용자 정보

기본 정보:
• User ID: 123456789
• Username: @john_doe
• 이름: John Doe
• 가입일: 2025-01-15
• 마지막 활동: 2시간 전

💳 크레딧 현황:
• 무료 크레딧: 2회
• 충전 크레딧: 25회
• 구독 크레딧: 100회/월 (베이직 플랜)
• 총 사용 가능: 127회

📊 사용 통계:
• 총 편집: 456회
• 총 충전 금액: $45.67
• 평균 편집/주: 23회
• 선호 템플릿: 3D 피규어 (78%)

🎯 상태:
• VIP 사용자: ✅
• 구독 상태: 활성
• 다음 갱신: 2025-02-15

[➕ 크레딧 지급] [📝 메모 추가] [🚫 제재]
```

### 3.2 크레딧 수동 지급 `/admin credit:grant`

**기능:**
```
/admin credit:grant <user_id> <amount> <reason>
→ 특정 사용자에게 크레딧 수동 지급
```

**예시:**
```
/admin credit:grant 123456789 100 "CS 보상"

✅ 크레딧 지급 완료

• 대상: John Doe (@john_doe)
• 지급 크레딧: 100회
• 사유: CS 보상
• 지급 전: 27회
• 지급 후: 127회

사용자에게 DM 발송됨.
```

### 3.3 크레딧 회수 `/admin credit:revoke`

**기능:**
```
/admin credit:revoke <user_id> <amount> <reason>
→ 부정 사용자 크레딧 회수
```

### 3.4 일괄 크레딧 지급 `/admin credit:bulk`

**기능:**
```
/admin credit:bulk <csv_file> 또는 <condition>
→ 특정 조건의 사용자들에게 일괄 지급
```

**예시:**
```
/admin credit:bulk condition:"가입 7일 이내, 결제 없음" amount:5

조건 매칭 사용자: 234명
지급할 총 크레딧: 1,170회

미리보기:
• User 123: +5회
• User 456: +5회
• User 789: +5회
...

[✅ 실행] [❌ 취소]
```

---

## 📊 Phase 4: 고급 분석 및 모니터링 (2-3주)

### 4.1 실시간 알림 시스템

**자동 알림 조건:**
```typescript
// src/services/admin-alerts.ts

const ALERT_CONDITIONS = {
  // 수익 관련
  dailyRevenueDrop: {
    threshold: -20, // 전날 대비 20% 감소
    action: 'notify_admin'
  },

  // 시스템 관련
  apiErrorRate: {
    threshold: 5, // 5% 이상 에러율
    action: 'urgent_notify'
  },

  highApiCost: {
    threshold: 50, // 일일 $50 초과
    action: 'notify_admin'
  },

  // 사용자 관련
  massiveChurn: {
    threshold: 30, // 30% 이상 이탈
    action: 'urgent_notify'
  },

  paymentFailures: {
    threshold: 10, // 10건 이상 결제 실패
    action: 'notify_admin'
  }
};
```

**알림 예시:**
```
🚨 긴급 알림!

⚠️ API 에러율 급증
• 현재 에러율: 8.5%
• 정상 범위: <5%
• 주요 에러: Timeout (67%)

📊 영향:
• 영향받은 사용자: 45명
• 실패한 요청: 123건
• 예상 손실: $15.67

[🔍 상세 로그] [🔧 긴급 조치]
```

### 4.2 A/B 테스트 시스템

**기능:**
```
/admin abtest:create
→ 프롬프트/가격/UI A/B 테스트 생성
```

**예시:**
```
📊 A/B 테스트 생성

테스트 이름: 3D 피규어 프롬프트 개선

A (기존):
{current_prompt}

B (신규):
{new_prompt}

설정:
• 테스트 기간: 7일
• 트래픽 분할: 50/50
• 성공 지표: 사용자 만족도, 재사용률
• 최소 샘플: 100명/그룹

[🚀 테스트 시작] [❌ 취소]
```

### 4.3 코호트 분석

**기능:**
```
/admin cohort <start_date>
→ 특정 기간 가입 코호트 분석
```

**표시 정보:**
```
📊 코호트 분석: 2025년 1월 가입자

👥 코호트 크기: 1,234명

💰 전환율:
• 첫 구매까지: 평균 3.2일
• 전환율 (7일): 8.5%
• 전환율 (30일): 12.3%

💸 LTV (Lifetime Value):
• 평균 LTV: $8.67
• 상위 10% LTV: $45.23
• 하위 50% LTV: $1.30

📈 리텐션:
• Day 1: 78%
• Day 7: 45%
• Day 30: 28%
• Day 90: 15%

🎯 인사이트:
• 첫 5회 사용 후 리텐션 +35%
• 구독 전환까지 평균 23일
• 주말 가입자 리텐션 +15%
```

### 4.4 자동 최적화 제안

**기능:**
AI가 데이터 기반으로 최적화 제안

**예시:**
```
🤖 AI 최적화 제안

1. 💡 인기 팩 가격 조정
   현재: 80회 / 200 Stars
   제안: 100회 / 200 Stars (+25% 크레딧)
   근거: 전환율 +18% 예상 (A/B 테스트 결과)

2. 🎨 프롬프트 개선
   대상: background_replace
   문제: 실패율 5.2% (평균 대비 +3.1%)
   제안: 타임아웃 설정 증가 + 에러 핸들링 개선

3. 📅 프로모션 타이밍
   제안: 목요일 저녁 8시 푸시 알림
   근거: 해당 시간대 전환율 +42%

4. 🎁 크레딧 보너스 이벤트
   대상: 14일 미접속 유저 (234명)
   제안: 5 크레딧 무료 지급
   예상 복귀율: 23% (과거 데이터 기반)

[✅ 제안 적용] [🔄 재분석] [❌ 무시]
```

---

## 🎯 구현 우선순위

### 🔥 High Priority (즉시 착수)
1. **Phase 1.1**: `/admin` 통합 대시보드
2. **Phase 3.2**: `/admin credit:grant` 수동 크레딧 지급
3. **Phase 3.1**: `/admin user:search` 사용자 검색

### 🟡 Medium Priority (1-2주 내)
4. **Phase 1.2**: `/admin users` 사용자 통계
5. **Phase 1.3**: `/admin revenue` 수익 분석
6. **Phase 2.1**: `/admin prompts` 프롬프트 목록

### 🟢 Low Priority (1개월 내)
7. **Phase 2.2**: 프롬프트 편집 시스템
8. **Phase 4.1**: 실시간 알림 시스템
9. **Phase 4.2**: A/B 테스트 시스템
10. **Phase 4.3**: 코호트 분석

---

## 📁 파일 구조 (예상)

```
src/
├── services/
│   ├── admin-dashboard.ts      # 대시보드 데이터 조회
│   ├── admin-users.ts          # 사용자 관리
│   ├── admin-credits.ts        # 크레딧 관리
│   ├── admin-revenue.ts        # 수익 분석
│   ├── admin-prompts.ts        # 프롬프트 관리
│   ├── admin-alerts.ts         # 알림 시스템
│   └── admin-analytics.ts      # 고급 분석
│
├── handlers/
│   └── admin-handlers.ts       # /admin 명령어 핸들러
│
└── types/
    └── admin.types.ts          # 어드민 타입 정의
```

---

## 🔐 보안 고려사항

### 1. 권한 레벨 시스템
```typescript
enum AdminLevel {
  VIEWER = 1,      // 통계만 볼 수 있음
  OPERATOR = 2,    // 크레딧 지급 가능
  MANAGER = 3,     // 프롬프트 수정 가능
  SUPER_ADMIN = 4  // 모든 권한
}

// 환경변수
ADMIN_USER_IDS=123456789:4,987654321:3
```

### 2. 감사 로그 (Audit Log)
```sql
CREATE TABLE admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id BIGINT NOT NULL,
  action_type TEXT NOT NULL,
  action_details JSONB,
  target_user_id BIGINT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. 2FA (선택사항)
```
/admin 명령어 실행 시 OTP 코드 요구
```

---

## 🚀 첫 단계 구현 제안

**바로 시작할 수 있는 것:**

1. **`/admin` 기본 대시보드** (2-3시간)
   - 실시간 통계만 표시 (DB 쿼리)
   - 버튼은 나중에 연결

2. **`/admin user:search`** (1-2시간)
   - User ID로 정보 조회
   - 크레딧 잔액 표시

3. **`/admin credit:grant`** (1-2시간)
   - 수동 크레딧 지급
   - 트랜잭션 로그 기록

**이 3개만 구현해도 당장 운영에 큰 도움이 됩니다!**

---

작성일: 2025-10-09
다음 업데이트: Phase 1 구현 완료 후
