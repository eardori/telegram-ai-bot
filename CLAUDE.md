# 📝 CLAUDE.md - 개발 컨텍스트 문서

## 📋 현재 할 일 목록 (TODO List) - 2025-01-10

### ✅ 완료된 작업 (COMPLETED)

#### 6. 사용자 피드백 시스템 ⭐ (2025-01-10 완료)
**목표:** 템플릿별 만족도 추적 및 품질 개선

**6.1. 데이터베이스 스키마** ✅
- `template_feedback` 테이블 (만족도 및 이유 저장)
- `v_template_feedback_stats` 뷰 (전체 통계)
- `v_recent_feedback_stats` 뷰 (최근 7일)
- `v_low_satisfaction_alerts` 뷰 (50% 미만 경고)
- `get_feedback_summary()` 함수 (트렌드 분석)
- SQL: `sql/025_user_feedback_system.sql`

**6.2. 결과 화면 피드백 버튼** ✅
- 모든 편집 결과 화면에 [👍 좋아요 / 👎 별로예요] 추가
- 불만족 시 자동 액션 제안 (다른 스타일 추천, 처음으로)
- 만족 시 감사 메시지 및 추천 유도

**6.3. 관리자 대시보드** ✅
- `/admin feedback [days]` - 피드백 통계 (기본 7일)
- 전체 통계 Top 10 (만족도순)
- 최근 트렌드 (개선/하락/안정/신규)
- 🚨 주의 필요 템플릿 알림 (만족도 50% 미만)

**비즈니스 임팩트:**
- 데이터 기반 템플릿 품질 개선
- 불만족 사용자 즉시 대응
- 인기/비인기 템플릿 파악

**배포 상태:** ✅ 코드 배포 완료
**다음 단계:** SQL 스키마 Supabase 실행 필요

---

#### 5. 버튼 네비게이션 UX 대개선 ⭐ (2025-01-10 완료)
**목표:** 일관성 있고 예측 가능한 버튼 구조로 사용자 경험 향상

**5.1. 결과 화면 버튼 통일** ✅
- 고정형/파라미터형/재편집 모두 동일한 버튼 구조
- [🔄 같은 스타일 다시] - 모든 템플릿에 추가
- [🎨 다른 옵션 선택] - 파라미터형만 조건부 표시
- [📂 카테고리에서 선택] - 빠른 스타일 탐색
- [🏠 처음으로] - 원본 이미지 + AI 추천 복귀

**5.2. 새 네비게이션 핸들러** ✅
- `back_to_categories`: 카테고리 선택 화면
- `back_to_start`: 원본 이미지 + AI 추천 (순환 구조)

**5.3. 불필요한 핸들러 제거** ✅
- ❌ `retry`: AI 재추천 (불필요한 단계)
- ❌ `rate`: 평가 기능 (미구현, 낮은 우선순위)

**5.4. 텍스트 일관성 확보** ✅
- "전체 38개 스타일 보기" → "📋 전체 스타일 보기" (동적 개수)
- "뒤로가기" → "⬅️ 뒤로"
- "카테고리로" → "📂 카테고리에서 선택"

**5.5. 캡션 간소화** ✅
- "💡 다음 액션" 섹션 제거 (버튼만으로 충분)
- 프롬프트 미리보기 제거 (불필요)
- 간결한 결과 메시지

**비즈니스 임팩트:**
- 사용자 혼란 감소 (5가지 → 1가지 버튼 레이아웃)
- 순환 네비게이션 (막다른 골목 제거)
- 예측 가능한 UX (모든 화면에서 동일한 버튼 텍스트)

**배포 상태:** ✅ 코드 배포 완료 (커밋: 783f38a)
**문서:** `docs/PROMPT_FLOW_DIAGRAM.md` 업데이트 완료

---

#### 4. 프롬프트 관리 시스템 ✅ (2025-01-10 완료)
- [x] **Phase 1: 긴급 프롬프트 수정**
  - outfit_swap 이미지 개수 불일치 수정 (Blocker)
  - clothing_change, hairstyle_change max_images 수정
  - album_9_photos, elegant_saree, multi_merge 개선
  - SQL: `sql/022_fix_prompt_issues.sql`

- [x] **Phase 2: 데이터베이스 스키마**
  - prompt_analysis_queue (분석 대기열)
  - prompt_approval_log (승인/거부 이력)
  - prompt_test_results (품질 추적)
  - Views & Functions 추가
  - SQL: `sql/023_prompt_management_system.sql`

- [x] **Phase 3: LLM 기반 분석 서비스**
  - Claude Sonnet 4.5 통합
  - 자동 제목/카테고리 분류
  - 파라미터 자동 감지 및 옵션 생성
  - 경고 및 개선 제안
  - 신뢰도 점수 계산
  - Service: `src/services/prompt-analysis-service.ts`

- [x] **Phase 4: 어드민 명령어**
  - `/admin prompt:add` - 새 프롬프트 추가
  - `/cancel` - 입력 취소
  - LLM 분석 후 승인/거부 버튼
  - 자동 DB 저장 및 Parameterized 템플릿 생성

**분석 결과:**
- 38개 프롬프트 전체 분석 완료
- 6개 Blocker/중요 이슈 발견 및 수정
- 7개 Parameterized 전환 권장 템플릿 식별

**비용:**
- 1회 분석: ~$0.017
- 월 50회: ~$0.85 (매우 저렴!)

**문서:**
- `docs/PROMPT_ANALYSIS_AND_IMPROVEMENTS.md` - 38개 프롬프트 분석
- `docs/PROMPT_MANAGEMENT_SYSTEM_PLAN.md` - 구현 계획

**배포 상태:** ✅ Supabase & Render.com 배포 완료
**커밋:** b875260

---

#### 1. 관리자 대시보드 시스템 ✅ (2025-01-09 완료)
- [x] `/admin` 또는 `/admin dashboard [24h|7d|30d]` - 통합 대시보드
  - 실시간 통계 (총 사용자, 활성 사용자, 신규 가입, 편집 횟수)
  - 수익 현황 (Telegram 수수료 30% 포함)
  - 크레딧 현황 (발행/사용/남은 크레딧)
- [x] `/admin user:search <user_id>` - 사용자 검색
  - 기본 정보 및 크레딧 현황
  - 구독 정보 및 VIP 상태
  - 사용 통계 (총 편집, 총 충전 금액, 선호 템플릿)
- [x] `/admin credit:grant <user_id> <amount> <reason>` - 크레딧 수동 지급
  - CS 보상 크레딧 지급
  - 자동 DM 알림
  - 관리자 활동 로그 기록
- [x] 실시간 알림 시스템
  - API 오류율 모니터링 (임계값: 5%)
  - 일일 API 비용 알림 (임계값: $50)
  - 결제 실패 추적
  - 매출 하락 경고 (임계값: 20%)

**구현된 파일:**
- `src/types/admin.types.ts` - 타입 정의
- `src/services/admin-dashboard.ts` - 대시보드 통계
- `src/services/admin-users.ts` - 사용자 검색
- `src/services/admin-credits.ts` - 크레딧 관리
- `src/services/admin-alerts.ts` - 알림 시스템
- `netlify/functions/webhook.ts` - 명령어 핸들러

**배포 상태:** ✅ Render.com에 배포 완료

#### 2. UI/UX 개선 - 버튼 최적화 ✅ (2025-01-10 완료)
- [x] 모든 버튼에서 이모지 제거
  - 모바일 화면에서 공간 절약
  - 텍스트 가독성 향상
- [x] 스마트 버튼 레이아웃 알고리즘 구현
  - 짧은 텍스트 (≤10자): 3개/행
  - 중간 텍스트 (11-20자): 2개/행
  - 긴 텍스트 (>20자): 1개/행
  - 총 40자 넘으면 자동 줄바꿈
- [x] 적용 범위
  - AI 추천 버튼
  - 템플릿 선택 버튼
  - 카테고리 버튼
  - 액션 버튼 (다시 편집, 원본으로 등)
  - 페이지네이션 뷰

**배포 상태:** ✅ 커밋 2f55d8d

#### 3. 추천인 시스템 (바이럴 성장) ✅ (2025-01-10 완료)
**목표:** CAC $3-5 → $0.04 (99% 절감), 바이럴 계수 K > 1

**3.1. 추천 코드 자동 생성** ✅
- 사용자별 고유 코드: MULTI + 5자리 숫자 (예: MULTI12345)
- 신규 가입 시 자동 생성 (DB 트리거)
- 기존 사용자 일괄 생성 완료

**3.2. Deep Link 처리** ✅
- `/start ref_MULTI12345` 지원
- 추천인 + 피추천인 각 10 크레딧 즉시 지급
- 실시간 DM 알림 (양방향)
- 중복 방지 (한 사용자당 1회만)
- 자기 추천 차단

**3.3. 수동 코드 입력** ✅
- `/enter_code MULTI12345` 명령어
- `/referral`에 "추천 코드 입력하기" 버튼
- 형식 검증 (MULTI + 5자리)
- 이미 추천인 있으면 버튼 숨김

**3.4. `/referral` 명령어** ✅
- 내 추천 코드 및 링크 표시
- 통계: 총 초대 수, 획득 크레딧, 마일스톤 달성
- 다음 마일스톤 진행도 표시
- Telegram 공유 버튼 통합

**3.5. 계단식 보너스 시스템** ✅
- 브론즈 (5명): +20 크레딧
- 실버 (10명): +50 크레딧
- 골드 (25명): +150 크레딧
- 플래티넘 (50명): +500 크레딧 + VIP 혜택
- 자동 달성 체크 및 알림

**구현된 파일:**
- `sql/021_referral_system.sql` - DB 스키마
  - `referrals` 테이블
  - `referral_milestones` 테이블
  - `referral_milestone_achievements` 테이블
  - `v_user_referral_stats` 뷰
  - `grant_referral_rewards()` 함수
  - `check_referral_milestones()` 함수
- `src/services/referral-service.ts` - 비즈니스 로직
  - `processReferral()` - 추천 처리
  - `getReferralStats()` - 통계 조회
  - `formatReferralMessage()` - 메시지 포맷팅
- `docs/REFERRAL_SYSTEM_DEPLOYMENT.md` - 배포 가이드

**배포 상태:**
- ✅ 코드 배포 완료 (커밋: 4269d78, 7b7c300)
- ✅ Supabase SQL 실행 완료 (사용자 확인)
- ✅ Render.com 자동 재배포 완료

**예상 효과:**
- CAC: $3-5 → **$0.04** (99% 절감)
- 50명 초대 최대 비용: $1.44 vs 광고 $150
- 바이럴 계수 K > 1 → 자가 성장

---

### 🔥 다음 작업 (HIGH PRIORITY)

#### 7. 프롬프트 관리 시스템 Phase 2 (1일 예상)
**목표**: 템플릿 활성화/비활성화 및 사용 통계

**7.1. `/admin prompt:stats <template_key>` - 상세 통계**
```typescript
// 기능:
- 템플릿별 총 사용 횟수
- 최근 7일/30일 사용 추이
- 평균 처리 시간
- 성공률 (에러 없는 편집 비율)
- 사용자 만족도 (피드백 시스템 연동)
```

**7.2. `/admin prompt:toggle <template_key>` - 활성화 토글**
```typescript
// 기능:
- 템플릿 활성화/비활성화
- 비활성화 시 사용자에게 보이지 않음
- A/B 테스트용 플래그 설정
```

**데이터베이스:**
```sql
-- prompt_templates 테이블에 통계 필드 추가
ALTER TABLE prompt_templates ADD COLUMN usage_count INT DEFAULT 0;
ALTER TABLE prompt_templates ADD COLUMN last_used_at TIMESTAMP;
ALTER TABLE prompt_templates ADD COLUMN success_rate DECIMAL(5,2);

-- 사용 통계 뷰 생성
CREATE VIEW prompt_usage_stats AS
SELECT
  template_key,
  COUNT(*) as total_uses,
  AVG(processing_time) as avg_processing_time,
  COUNT(CASE WHEN success = true THEN 1 END)::DECIMAL / COUNT(*) * 100 as success_rate
FROM credit_transactions
WHERE transaction_type = 'usage'
GROUP BY template_key;
```

---

#### 8. 그룹 FOMO 전략 개선 (1일 예상)
**목표**: 그룹 무료 체험 → 가입 전환율 최적화

**4.1. 전환율 추적 시스템**
```sql
-- group_free_trials 테이블에 이미 있음
ALTER TABLE group_free_trials ADD COLUMN IF NOT EXISTS conversion_funnel JSONB;
-- 단계별 추적: 체험 → 버튼 클릭 → 가입 → 첫 충전
```

**4.2. `/admin fomo` - 그룹별 전환율 대시보드**
```typescript
// 기능:
- 그룹별 무료 체험 사용자 수
- 가입 전환율 (%)
- 크레딧 구매 전환율 (%)
- 시간대별 분석
```

**4.3. 메시지 카피 A/B 테스트**
```typescript
// 현재: "지금 가입하고 5회 더 받기"
// A안: "친구들이 벌써 1,234명 가입! 5회 무료"
// B안: "24시간 한정! 지금 가입하면 10회"
// 전환율 추적하여 최적 메시지 선택
```

**4.4. 리마인더 시스템**
```typescript
// 무료 체험 후 미가입자에게:
- 3일 후: "아직 5회 무료 크레딧 안 받으셨어요?"
- 7일 후: "마지막 기회! 내일까지만 5회 무료"
```

#### 5. 프롬프트 관리 시스템 (1-2일 예상)
**목표**: 템플릿 활성화/비활성화 및 사용 통계

**5.1. `/admin prompts` - 프롬프트 목록**
```typescript
// 기능:
- 전체 템플릿 목록 조회 (38개)
- 템플릿별 사용 횟수 및 인기도
- 활성화 상태 표시
- 카테고리별 그룹화
```

**5.2. `/admin prompt:stats <template_key>` - 상세 통계**
```typescript
// 기능:
- 템플릿별 총 사용 횟수
- 최근 7일/30일 사용 추이
- 평균 처리 시간
- 성공률 (에러 없는 편집 비율)
- 사용자 만족도 (재사용률)
```

**5.3. `/admin prompt:toggle <template_key>` - 활성화 토글**
```typescript
// 기능:
- 템플릿 활성화/비활성화
- 비활성화 시 사용자에게 보이지 않음
- A/B 테스트용 플래그 설정
```

**데이터베이스:**
```sql
-- prompt_templates 테이블에 통계 필드 추가
ALTER TABLE prompt_templates ADD COLUMN usage_count INT DEFAULT 0;
ALTER TABLE prompt_templates ADD COLUMN last_used_at TIMESTAMP;
ALTER TABLE prompt_templates ADD COLUMN success_rate DECIMAL(5,2);

-- 사용 통계 뷰 생성
CREATE VIEW prompt_usage_stats AS
SELECT
  template_key,
  COUNT(*) as total_uses,
  AVG(processing_time) as avg_processing_time,
  COUNT(CASE WHEN success = true THEN 1 END)::DECIMAL / COUNT(*) * 100 as success_rate
FROM credit_transactions
WHERE transaction_type = 'usage'
GROUP BY template_key;
```

---

### 🟢 백로그 작업 (LOW PRIORITY)

#### 6. 고급 분석 시스템 (1-2개월 내)
- `/admin revenue` - 수익 분석 (패키지/구독별)
- `/admin users` - 사용자 성장 추이
- 전환율 분석 (무료→유료, 크레딧→구독)
- 리텐션 분석 (DAU, WAU, MAU)
- 코호트 분석 (주차별 리텐션)

#### 7. 세션 기억 기능 개선 (보류)
**현재 상태**: Phase 5 인메모리 구현 완료, 실제 미작동
**문제**: webhook.ts에서 SessionManager 미통합
**우선순위**: 낮음 (다른 기능이 비즈니스 임팩트 더 큼)

---

## 📚 참고 문서

### 필독 문서 (작업 전 확인)
1. **`docs/ADMIN_FEATURES_PLAN.md`** - 어드민 기능 전체 계획
   - 4개 Phase 상세 설명
   - 구현 우선순위
   - 예상 소요 시간

2. **`docs/PROFITABILITY_ANALYSIS.md`** - 수익성 분석
   - Telegram 수수료 30% 반영
   - 패키지/구독별 순이익
   - 손익분기점 분석

3. **`docs/MONETIZATION_DESIGN.md`** - 결제 시스템 설계
   - Telegram Stars 통합
   - 크레딧 시스템
   - 구독 플랜

4. **`docs/REFERRAL_SYSTEM_DEPLOYMENT.md`** ⭐ NEW!
   - Supabase SQL 실행 방법
   - 테스트 시나리오 3가지
   - 사용자 가이드
   - 관리자 모니터링 쿼리
   - 문제 해결 가이드

### 최근 완료된 작업
- ✅ (2025-01-10) **추천인 시스템 완료** - 바이럴 성장 메커니즘
- ✅ (2025-01-10) **버튼 UI 개선** - 이모지 제거, 스마트 레이아웃
- ✅ (2025-01-09) 관리자 대시보드 시스템 구현
- ✅ (2025-01-09) Telegram 수수료 30% 반영 수익성 재계산
- ✅ (2025-01-09) `/credits` 명령어 추가
- ✅ (2025-01-09) `/help`에 어드민 전용 섹션 추가
- ✅ (2025-01-09) `/whoami` 명령어 추가

---

## 🎯 프로젝트 상태 (2025-01-10)

### 현재 진행 상황

#### ✅ 완료된 주요 시스템

1. **AI 기반 이미지 분석 및 추천 시스템** (2025-10-08 완료)
   - Gemini 2.0 Flash를 활용한 이미지 분석
   - AI 창의적 제안 3개 자동 생성
   - 템플릿 추천 다양성 개선

2. **결제 시스템 (Telegram Stars)** (2025-01-09 완료)
   - 크레딧 패키지 4종 (30/80/250/600회)
   - 구독 플랜 4종 (라이트/베이직/프로/엔터프라이즈)
   - 결제 핸들러 구현 및 테스트 완료
   - 수익성 분석 완료 (60-65% 순이익률)

3. **크레딧 시스템** (2025-01-09 완료)
   - 무료/충전/구독 크레딧 분리
   - 자동 차감 및 트랜잭션 로그
   - 그룹 FOMO 전략 (1회 무료 체험)
   - `/credits` 명령어로 잔액 확인

4. **관리자 대시보드** (2025-01-09 완료)
   - `/admin` - 통합 대시보드 (24h/7d/30d)
   - `/admin user:search` - 사용자 검색 및 상세 정보
   - `/admin credit:grant` - 크레딧 수동 지급
   - 실시간 알림 시스템 (API 오류, 비용, 매출)

5. **추천인 시스템 (바이럴 성장)** ⭐ (2025-01-10 완료)
   - 자동 추천 코드 생성 (MULTI12345)
   - Deep Link `/start ref_MULTI12345`
   - 수동 코드 입력 `/enter_code`
   - `/referral` 통계 및 공유
   - 계단식 보너스 (5/10/25/50명)
   - 실시간 알림 (양방향 DM)
   - **CAC: $3-5 → $0.04 (99% 절감)**

6. **UI/UX 최적화** (2025-01-10 완료)
   - 버튼 이모지 제거 (모바일 공간 절약)
   - 스마트 레이아웃 알고리즘
   - 텍스트 길이 기반 자동 정렬

---

## 🔧 프로젝트 구성

### 환경 변수
```bash
# Telegram
BOT_TOKEN=
TELEGRAM_BOT_TOKEN=

# AI APIs
CLAUDE_API_KEY=
GOOGLE_API_KEY=

# Database
SUPABASE_URL=
SUPABASE_ANON_KEY=

# Admin
ADMIN_USER_IDS=123456789,987654321

# Features
NODE_ENV=production
```

### 주요 파일 구조
```
bot-telegram/
├── docs/
│   ├── ADMIN_FEATURES_PLAN.md
│   ├── PROFITABILITY_ANALYSIS.md
│   ├── MONETIZATION_DESIGN.md
│   └── REFERRAL_SYSTEM_DEPLOYMENT.md ⭐ NEW!
├── src/
│   ├── services/
│   │   ├── admin-dashboard.ts
│   │   ├── admin-users.ts
│   │   ├── admin-credits.ts
│   │   ├── admin-alerts.ts
│   │   ├── referral-service.ts ⭐ NEW!
│   │   ├── credit-manager.ts
│   │   └── group-fomo-service.ts
│   └── types/
│       └── admin.types.ts
├── sql/
│   ├── 020_credit_system.sql
│   └── 021_referral_system.sql ⭐ NEW!
└── netlify/functions/
    └── webhook.ts (2500+ lines)
```

---

## 📋 명령어 목록

### 일반 사용자 명령어
- `/start` - 봇 시작 (Deep Link 지원)
- `/help` - 도움말
- `/credits` - 💳 크레딧 잔액 확인
- `/referral` - 🎁 친구 초대하고 크레딧 받기
- `/enter_code` - 🔑 추천 코드 수동 입력
- `/terms` - 📜 이용 약관
- `/support` - 💬 고객 지원
- `/version` - 버전 히스토리

### 사진 편집 기능
- 사진 업로드 → AI 자동 분석 → 스타일 선택
- 38개 편집 스타일 제공
- 카테고리: 3D/피규어, 인물, 게임/애니, 이미지 편집, 창의적 변환
- 파라미터 템플릿: 배경 변경, 의상, 표정

### 관리자 명령어
- `/admin` - 📊 통합 대시보드
- `/admin user:search <id>` - 🔍 사용자 검색
- `/admin credit:grant <id> <amount> <reason>` - 💳 크레딧 지급
- `/apicost` - 💰 API 비용 통계
- `/whoami` - 👤 User ID 확인
- `/health` - 🏥 시스템 상태
- `/track_start`, `/track_stop`, `/track_status` - 대화 추적
- `/summarize` - 대화 요약

---

## 🚀 배포 정보

### 플랫폼
- **프로덕션**: Render.com (자동 배포)
- **데이터베이스**: Supabase

### 배포 프로세스
```bash
# 1. 코드 변경
npm run build

# 2. 커밋 및 푸시
git add .
git commit -m "feat: ..."
git push origin main

# 3. Render 자동 배포 (2-3분)
# Render.com이 자동으로 감지하고 배포

# 4. Supabase SQL 실행 (필요시)
# Supabase Dashboard → SQL Editor → 스크립트 실행
```

### 최근 배포
- ✅ 2025-01-10: 추천인 시스템 (커밋: 4269d78, 7b7c300)
- ✅ 2025-01-10: 버튼 UI 개선 (커밋: 2f55d8d)
- ✅ 2025-01-09: 관리자 대시보드 (커밋: 3cce792)

---

## ⚠️ 알려진 이슈

### 1. 세션 기억 기능 미작동 (보류)
- 사용자가 연속으로 질문해도 컨텍스트 미유지
- Phase 5 인메모리 구현 완료, webhook.ts 통합 안 됨
- **우선순위**: 낮음 (다른 기능 우선)

### 2. 그룹 FOMO 전환율 미측정 (다음 작업)
- 무료 체험 → 가입 전환율 알 수 없음
- 메시지 최적화 불가
- **해결 예정**: Task 4 (그룹 FOMO 개선)

---

## 📝 개발 가이드라인

### 코드 스타일
- TypeScript 사용
- async/await 패턴
- 에러 핸들링 필수
- 한국어 주석 허용

### 커밋 메시지
```bash
# 형식
feat: 추천인 시스템 구현
fix: 버튼 이모지 제거
docs: 배포 가이드 작성

# 본문 (선택)
- 상세 변경 사항
- 영향받는 파일
- 테스트 결과
```

### 테스트
- 로컬 빌드 후 배포
- Telegram 실제 봇으로 확인
- 관리자 명령어는 ADMIN_USER_IDS 필수
- Supabase SQL 변경 시 별도 실행 필요

---

## 📞 연락처

### Telegram Bot
- **봇 이름**: @MultifulDobi_bot
- **개발자**: @eardori

### 이슈 리포트
- GitHub Issues 사용
- 상세한 재현 방법 포함
- 로그/스크린샷 첨부

---

## 🔄 업데이트 로그

### 2025년 1월 10일 (최신) ⭐
- 🎁 **추천인 시스템 완료**
  - 자동 추천 코드 생성 (MULTI12345)
  - Deep Link + 수동 입력 지원
  - 계단식 보너스 (5/10/25/50명)
  - CAC 99% 절감 ($3-5 → $0.04)
- 🎨 **버튼 UI 개선**
  - 이모지 제거 (모바일 최적화)
  - 스마트 레이아웃 알고리즘
  - 텍스트 길이 기반 자동 정렬

### 2025년 1월 9일
- 📊 **관리자 대시보드 구현**
  - `/admin` 통합 대시보드
  - `/admin user:search` 사용자 검색
  - `/admin credit:grant` 크레딧 지급
  - 실시간 알림 시스템

### 2025년 10월 8일 (이전)
- 🎨 이미지 편집 기능 개선
- ✅ Replicate → Gemini API 전환
- ✅ AI 기반 추천 시스템
- ✅ 카테고리별 UI 및 페이지네이션

---

## 🎯 다음 세션 작업 추천

### 옵션 A: 그룹 FOMO 개선 (빠른 성과)
**예상 소요**: 1일
**비즈니스 임팩트**: 🟡 중간-높음
- 전환율 추적 시스템
- `/admin fomo` 대시보드
- 메시지 A/B 테스트
- 리마인더 시스템

**장점:**
- 기존 그룹 체험 사용자 전환 가능
- 빠른 매출 증가 (전환율 10% → 20%)
- 데이터 기반 최적화

### 옵션 B: 프롬프트 관리 시스템
**예상 소요**: 1-2일
**비즈니스 임팩트**: 🟢 중간
- `/admin prompts` 목록 및 통계
- `/admin prompt:stats` 상세 분석
- `/admin prompt:toggle` 활성화 관리

**장점:**
- 인기 템플릿 파악
- A/B 테스트로 품질 개선
- 사용자 만족도 증가

### 추천: **옵션 A (그룹 FOMO 개선)**
이유:
1. 추천인 시스템과 시너지 (바이럴 + 전환)
2. 빠른 매출 증가 (기존 사용자 활용)
3. 데이터 수집하여 지속 최적화 가능

---

*최종 수정: 2025년 1월 10일*
*다음 작업: 그룹 FOMO 전략 개선 또는 프롬프트 관리 시스템*
