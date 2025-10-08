# 📝 CLAUDE.md - 개발 컨텍스트 문서

## 📋 현재 할 일 목록 (TODO List) - 2025-01-09

### ✅ 완료된 작업 (COMPLETED)

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

**배포 상태:** ✅ Render.com에 배포 완료 (커밋: 3cce792)

#### 2. Telegram Stars 결제 시스템 ✅ (2025-01-09 완료)
- [x] Telegram 수수료 30% 반영하여 수익성 재계산
- [x] 크레딧 패키지 4종 구현
- [x] 구독 플랜 4종 구현
- [x] 결제 핸들러 및 테스트 완료
- **결론**: 가격 조정 불필요, 60-65% 순이익률 유지

### 🔥 다음 작업 (HIGH PRIORITY)

#### 3. 프롬프트 관리 시스템 (1-2일 예상)
**목표**: 템플릿 활성화/비활성화 및 사용 통계

**3.1. `/admin prompts` - 프롬프트 목록**
```typescript
// 기능:
- 전체 템플릿 목록 조회
- 템플릿별 사용 횟수 및 인기도
- 활성화 상태 표시
- 카테고리별 그룹화
```

**3.2. `/admin prompt:stats <template_key>` - 상세 통계**
```typescript
// 기능:
- 템플릿별 총 사용 횟수
- 최근 7일/30일 사용 추이
- 평균 처리 시간
- 성공률 (에러 없는 편집 비율)
- 사용자 만족도 (재사용률)
```

**3.3. `/admin prompt:toggle <template_key>` - 활성화 토글**
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

-- 사용 통계 뷰 생성
CREATE VIEW prompt_usage_stats AS ...
```

#### 4. 추천인 시스템 (2-3일 예상)
**목표**: 바이럴 성장 및 사용자 획득 비용 절감 (CAC $3-5 → $0.04)

**4.1. 추천 코드 생성 시스템**
```typescript
// 기능:
- 사용자별 고유 코드 자동 생성 (예: MULTI123)
- users.referral_code 필드 자동 설정 (DB 트리거)
- 코드 인코딩/디코딩 함수
```

**4.2. `/start <referral_code>` Deep Link 처리**
```typescript
// 기능:
- 가입 시 추천 코드 검증
- 추천인 + 피추천인 각 10 크레딧 지급
- 중복 방지 (referrals 테이블)
- 자동 DM 알림
```

**4.3. `/referral` 명령어 - 추천 통계**
```typescript
// 기능:
- 내 추천 코드 및 링크 표시
- 초대한 친구 수 확인
- 획득한 보상 크레딧 확인
- 공유 버튼 제공
```

**4.4. 계단식 보너스 시스템**
```typescript
// 추천 횟수 마일스톤:
- 5명: +20 크레딧
- 10명: +50 크레딧
- 25명: +150 크레딧
- 50명: VIP 혜택 + 500 크레딧
```

**데이터베이스:**
```sql
-- 사용자 테이블에 추천 코드 필드 추가
ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) UNIQUE;

-- 추천 코드 자동 생성 트리거
CREATE OR REPLACE FUNCTION set_user_referral_code() ...
CREATE TRIGGER trigger_set_referral_code ...

-- referrals 테이블 활용 (이미 존재)
```

**예상 효과:**
- CAC: $3-5 → **$0.04** (99% 절감)
- 바이럴 계수 K: 0.9 → 목표 K > 1

### 🟢 백로그 작업 (LOW PRIORITY)

#### 5. 고급 분석 시스템 (1-2개월 내)
- `/admin revenue` - 수익 분석 (패키지/구독별)
- `/admin users` - 사용자 성장 추이
- 전환율 분석 (무료→유료, 크레딧→구독)
- 리텐션 분석 (DAU, WAU, MAU)

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

### 최근 완료된 작업
- ✅ (2025-10-09) Telegram 수수료 30% 반영하여 수익성 재계산
- ✅ (2025-10-09) `/credits` 명령어 추가 (사용자 크레딧 확인)
- ✅ (2025-10-09) `/help`에 어드민 전용 섹션 추가
- ✅ (2025-10-09) `/whoami` 명령어 추가 (User ID 확인)
- ✅ (2025-10-09) 결제 핸들러 등록 순서 수정 (버튼 작동 수정)
- ✅ (2025-10-09) 결제 시스템 테스트 완료 (100 Stars)

---

## 🎯 프로젝트 상태 (2025-10-09)

### 현재 진행 상황

#### ✅ 완료된 주요 시스템
1. **AI 기반 이미지 분석 및 추천 시스템** (2025-10-08 완료)
   - Gemini 2.0 Flash를 활용한 이미지 분석
   - AI 창의적 제안 3개 자동 생성
   - 템플릿 추천 다양성 개선

2. **결제 시스템 (Telegram Stars)** (2025-10-09 완료)
   - 크레딧 패키지 4종 (30/80/250/600회)
   - 구독 플랜 4종 (라이트/베이직/프로/엔터프라이즈)
   - 결제 핸들러 구현 및 테스트 완료
   - 수익성 분석 완료 (60-65% 순이익률)

3. **크레딧 시스템** (2025-10-09 완료)
   - 무료/충전/구독 크레딧 분리
   - 자동 차감 및 트랜잭션 로그
   - 그룹 FOMO 전략 (1회 무료 체험)
   - `/credits` 명령어로 잔액 확인

#### 🔜 다음 단계
**Phase 1 어드민 기능 구현** (2-3시간 예상)
- `/admin` - 통합 대시보드
- `/admin user:search` - 사용자 검색
- `/admin credit:grant` - 크레딧 수동 지급

자세한 내용은 상단 "현재 할 일 목록 (TODO List)" 참고

### ⚡ 작업 순서 (사용자 승인)
1. ✅ **Gemini API 전환** - 완료 (2025-10-08)
2. ✅ **AI 추천 시스템 구현** - 완료 (2025-10-08)
   - 이미지 분석 프롬프트 재설계 (구조적 데이터 + AI 제안)
   - AI 창의적 제안 3개 자동 생성
   - 버튼 레이아웃 재구성 (AI 추천 최상단)
   - AI suggestion 핸들러 추가
   - 템플릿 추천 다양성 개선
3. ✅ **이미지 편집 기능 개선** - Week 1 완료
   - 카테고리별 UI 구현
   - 페이지네이션 개선 (6개/페이지)
   - 프롬프트 최적화 (카테고리별)
   - API 비용 추적 시스템
4. 🔜 **세션 기억 기능** - 이후 진행 예정

### 🆕 Replicate 통합 추가 (2025-01-08)
**목적**: NSFW 이미지/비디오 생성 기능
**상세**: `docs/PIXIE_MIGRATION_PLAN.md` - Phase 1, Section 1.3
**필수 학습**: https://replicate.com/docs

**주요 기능:**
- `/nsfw_imagine` - NSFW 이미지 생성
- `/nsfw_video` - NSFW 비디오 생성
- `/animate` - 이미지 애니메이션 변환
- Webhook 비동기 처리 (긴 작업용)
- 일일 제한: 5회/일
- 토큰 비용: 20-30 토큰

**환경변수 추가 필요:**
```
REPLICATE_API_TOKEN=r8_...
REPLICATE_WEBHOOK_URL=https://your-bot.onrender.com/api/replicate/webhook
```

**패키지 설치:**
```bash
npm install replicate
npm install --save-dev @types/replicate
```

### 구현 진행 상황
- [x] **Phase 5**: 세션 시스템 수정 (100%) ✅ 완료! (2025-01-08)
- [x] **Phase 1-B**: Replicate 통합 (100%) ✅ 완료! (2025-01-08)
- [ ] **Phase 1-A**: 프롬프트 관리 (0%) - 파일 기반 시스템 ← 다음 작업
- [ ] **Phase 2**: 토큰 경제 시스템 (0%) - 결제, 잔액, 거래내역
- [ ] **Phase 3**: 그룹 채팅 기능 (0%) - 모니터링, 요약, 컨텍스트 답변
- [ ] **Phase 4**: 관리자 대시보드 (0%) - 통계, 사용자 관리, 공지
- [ ] **Phase 6**: 최종 통합 테스트 (0%)

### 세션 재개 시 체크리스트
1. ✅ `docs/PIXIE_MIGRATION_PLAN.md` 읽기
2. ✅ 현재 Phase 진행률 확인
3. ✅ 해당 Phase의 "작업 내용" 섹션 검토
4. ✅ 테스트 체크리스트 확인
5. ✅ Git commit 전 테스트

---

## 🚨 최우선 해결 과제

### 1. 이미지 편집 기능 개선 (2025-10-08 진행 중)
**상태**: 🟡 진행 중
**커밋**: 7b6969a (Gemini API 전환 완료)
**상세 계획**: `docs/IMAGE_EDIT_IMPROVEMENT_PLAN.md`

**완료된 사항**:
- ✅ Replicate → Gemini 전환 완료
- ✅ 폴라로이드 템플릿 테스트 성공
- ✅ InputFile 방식으로 직접 전송
- ✅ 에러 핸들링 개선

**진행 중**:
- ⏳ 다른 템플릿들 테스트
- ⏳ 프롬프트 최적화
- ⏳ 카테고리별 UI 구현
- ⏳ 페이지네이션 개선
- ⏳ API 비용 추적

### 2. 세션 기억 기능 미작동 이슈 (보류)
**상태**: 🔵 보류 (이미지 편집 우선)
**커밋**: 80ca066
**해결 방법**: 인메모리 대화 컨텍스트 관리 시스템 구현

**구현 내용**:
```typescript
// netlify/functions/webhook.ts
// 1. ConversationContext 인터페이스 추가
// 2. conversationContexts Map으로 사용자별 대화 저장
// 3. 최근 10개 메시지 (5회 대화) 유지
// 4. 30분 TTL로 자동 정리
// 5. callClaudeAPI에 conversationHistory 파라미터 추가
// 6. answerQuestion에서 context 저장/조회
```

**테스트 시나리오**:
1. "도비야, 오늘 날씨 어때?" → 첫 질문
2. "그럼 우산 가져가야 할까?" → 이전 대화 참조
3. "어제는 어땠어?" → 이전 대화 참조

**주의사항**:
- 인메모리 저장이므로 서버 재시작 시 초기화됨
- 추후 DB 기반 영구 저장으로 업그레이드 가능 (Phase 1+ 작업)

### 2. 템플릿 불일치 문제 (✅ 해결됨)
**해결일**: 2025-01-07
**커밋**: c8e2243
**내용**: DB 템플릿 ID와 하드코딩 템플릿 불일치 수정

---

## 🎯 현재 진행 중인 작업

### Pixie 업그레이드 프로젝트
**시작일**: 2025-01-07
**예상 완료**: 2주

#### Phase 1: 프롬프트 관리 시스템 (1-2일)
**목표**: JSON 파일 기반으로 쉽게 프롬프트 추가/수정

**핵심 구조**:
```
src/data/prompts/
├── core/               # 핵심 프롬프트 (38개)
├── experimental/       # 실험용 프롬프트
└── seasonal/          # 계절/이벤트 프롬프트
```

**주요 기능**:
- JSON → DB 자동 동기화
- Hot reload (개발 모드)
- CLI 도구 (add, sync, test, validate)
- Telegram 관리자 명령어

**Telegram 관리자 명령어**:
```
/admin_prompt list              # 프롬프트 목록
/admin_prompt enable <key>      # 활성화
/admin_prompt disable <key>     # 비활성화
/admin_reload                   # 파일 다시 로드
/admin_test <key>              # 프롬프트 테스트
```

**관리자 인증**: 환경변수 `ADMIN_USER_IDS`에 Telegram user ID 추가

---

## 🔧 프로젝트 구성

### Git 설정 및 배포

**⚠️ 중요: SSH 키 권한 문제**

현재 SSH 키 (`~/.ssh/id_ed25519.pub`)가 `kevinoh87` 계정과 연결되어 있어 `eardori/telegram-ai-bot` 저장소에 push할 수 없습니다.

**해결 방법:**

1. **방법 1**: eardori GitHub 계정에 현재 SSH 키 추가
   ```bash
   # 공개 키 출력
   cat ~/.ssh/id_ed25519.pub
   # → ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICESKFgj94YQUtywEZg8SPrJ4+oka5domdKftnjbpTQu kevin.oh@onda.me

   # GitHub (eardori 계정) > Settings > SSH and GPG keys > New SSH key
   # 위 공개 키를 추가
   ```

2. **방법 2**: eardori 계정용 새 SSH 키 생성
   ```bash
   ssh-keygen -t ed25519 -C "eardori@gmail.com" -f ~/.ssh/id_ed25519_eardori

   # SSH config 설정 (~/.ssh/config)
   Host github-eardori
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519_eardori

   # 원격 저장소 URL 변경
   git remote set-url origin git@github-eardori:eardori/telegram-ai-bot.git
   ```

3. **방법 3**: Personal Access Token 사용 (HTTPS)
   ```bash
   # GitHub (eardori 계정) > Settings > Developer settings > Personal access tokens
   # repo 권한으로 토큰 생성

   git remote set-url origin https://github.com/eardori/telegram-ai-bot.git
   git push origin main
   # Username: eardori
   # Password: [생성한 Personal Access Token]
   ```

**현재 Git 설정:**
```bash
# 사용자 설정 (올바름)
user.name: eardori
user.email: eardori@gmail.com

# 원격 저장소 (SSH로 설정됨)
origin: git@github.com:eardori/telegram-ai-bot.git

# 로컬 커밋 대기 중
- 80ca066: Phase 5 구현
- f371da3: 문서 업데이트
```

**배포 프로세스:**
1. 위 방법 중 하나로 SSH 키 또는 토큰 설정
2. `git push origin main` 실행
3. Render.com 자동 배포 대기 (2-3분)

---

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

# Replicate (NSFW 콘텐츠 생성) ← 새로 추가됨!
REPLICATE_API_TOKEN=r8_your_api_token_here
# Replicate 토큰 얻는 법: https://replicate.com/account/api-tokens

# Admin
ADMIN_USER_IDS=123456789,987654321

# Payment (Phase 2에서 추가)
PAYMENT_PROVIDER_TOKEN=

# Features
NODE_ENV=production
ENABLE_HOT_RELOAD=false
```

**⚠️ Replicate 설정 (Phase 1-B 완료):**
1. https://replicate.com 가입
2. https://replicate.com/account/api-tokens 에서 토큰 생성
3. Render.com 환경변수에 `REPLICATE_API_TOKEN` 추가
4. Supabase에서 SQL 실행: `sql/013_replicate_features.sql`

### 주요 파일 구조
```
bot-telegram/
├── docs/
│   ├── PIXIE_MIGRATION_PLAN.md  # 업그레이드 상세 계획
│   ├── IMAGE_EDIT_FEATURE_PLAN.md
│   └── PROMPT_TEMPLATES.md
├── src/
│   ├── data/prompts/            # 프롬프트 JSON 파일 (Phase 1)
│   ├── handlers/
│   │   ├── image-edit-handler.ts
│   │   ├── admin-handler.ts     # Phase 1에서 생성
│   │   ├── token-handler.ts     # Phase 2에서 생성
│   │   └── group-handler.ts     # Phase 3에서 생성
│   ├── services/
│   │   ├── prompt-manager.ts    # Phase 1에서 생성
│   │   ├── token-manager.ts     # Phase 2에서 생성
│   │   └── group-context-manager.ts  # Phase 3에서 생성
│   └── session/
│       └── SessionManager.ts    # Phase 5에서 수정
├── sql/
│   ├── 010_token_system.sql     # Phase 2
│   ├── 011_group_features.sql   # Phase 3
│   └── 012_statistics.sql       # Phase 4
├── scripts/
│   └── prompt-tools.ts          # Phase 1에서 생성
└── netlify/functions/
    └── webhook.ts               # Phase 5에서 수정
```

---

## 📋 명령어 목록

### 기존 명령어
- `/start` - 봇 시작
- `/help` - 도움말
- `/imagine [프롬프트]` - 이미지 생성
- `/edit` - 이미지 편집
- `도비야 [질문]` - Q&A
- `도비야 [설명] 그려줘` - 이미지 생성
- `도비야 도움말` - 도비 도움말

### 새로 추가될 명령어

#### 사용자 명령어 (Phase 2-3)
- `/balance` - 토큰 잔액 확인
- `/buy` - 토큰 구매
- `/referral` - 추천 코드 확인
- `/monitor_on` - 그룹 모니터링 시작 (그룹 관리자만)
- `/monitor_off` - 그룹 모니터링 종료 (그룹 관리자만)
- `/summarize [N]` - 최근 N개 메시지 요약
- `@pixie [질문]` - 그룹 대화 컨텍스트 기반 답변

#### 관리자 명령어 (Phase 1, 4)
- `/admin_stats` - 시스템 통계
- `/admin_users [검색어]` - 사용자 검색
- `/admin_broadcast [메시지]` - 전체 공지
- `/admin_prompt list` - 프롬프트 목록
- `/admin_prompt enable <key>` - 프롬프트 활성화
- `/admin_prompt disable <key>` - 프롬프트 비활성화
- `/admin_reload` - 프롬프트 파일 다시 로드
- `/admin_test <key> [이미지]` - 프롬프트 테스트

---

## 🚀 배포 정보

### 플랫폼
- **개발**: Netlify (초기)
- **프로덕션**: Render.com (현재)
- **데이터베이스**: Supabase

### 배포 프로세스
1. `git push origin main`
2. Render 자동 배포 트리거
3. 약 2-3분 소요

### 빌드 명령어
```bash
npm run build       # TypeScript 컴파일
npm run dev        # 로컬 개발
npm run deploy     # 수동 배포 (필요시)
```

### Phase별 배포 전략
```bash
# Phase 1 배포 전
npm run prompt:sync          # 프롬프트 DB 동기화
npm run prompt:validate      # 검증

# Phase 2 배포 전
psql -f sql/010_token_system.sql  # 토큰 시스템 스키마

# Phase 3 배포 전
psql -f sql/011_group_features.sql

# Phase 4 배포 전
psql -f sql/012_statistics.sql
```

---

## ⚠️ 알려진 이슈

### 1. 세션 기억 기능 미작동 (Phase 5에서 해결 예정)
- 사용자가 연속으로 3개 이상 질문을 해도 컨텍스트 미유지
- webhook.ts에서 SessionManager 미사용
- Phase 5에서 통합 예정

### 2. 템플릿 불일치 (✅ 해결됨)
- DB와 하드코딩 템플릿 ID 불일치
- 2025-01-07 수정 완료

### 3. 도비 도움말 명령어 오탐지 (✅ 해결됨)
- "어떻게"가 포함된 질문이 도움말로 인식
- 정규식 수정으로 해결

### 4. 이미지 생성 타임아웃 (✅ 해결됨)
- 20초로 증가하여 해결

---

## 📝 개발 가이드라인

### 코드 스타일
- TypeScript 사용
- async/await 패턴
- 에러 핸들링 필수
- 한국어 주석 허용

### Phase별 작업 원칙
1. **한 Phase씩만 작업**: 다른 Phase 코드 건드리지 않기
2. **테스트 후 커밋**: 각 Phase 완료 시 Git tag 생성
3. **문서 업데이트**: CLAUDE.md 진행률 업데이트
4. **롤백 대비**: 각 Phase별 Git tag (`v1.0.0-phase1`)

### Git 커밋 메시지
```bash
# Phase별 커밋
git commit -m "Phase 1: Implement file-based prompt system"
git commit -m "Phase 2: Add token economy system"

# 태그 생성
git tag v1.0.0-phase1
git push origin v1.0.0-phase1
```

### 테스트
- 각 Phase 완료 후 체크리스트 확인
- 로컬 테스트 후 배포
- Telegram 실제 봇으로 확인
- 로그 모니터링

---

## 📞 연락처

### Telegram Bot
- 봇 이름: @MultifulDobi_bot
- 개발 완료 후: @PixieAI_bot (예정)

### 이슈 리포트
- GitHub Issues 사용
- 상세한 재현 방법 포함
- 로그/스크린샷 첨부

---

## 🔄 업데이트 로그

### 2025년 10월 8일 (최신)
- 🎨 **AI 기반 이미지 분석 및 추천 시스템 구현 완료** ✅
  - 이미지 분석 시 AI가 3개 창의적 제안 자동 생성
  - 구조적 데이터 (JSON) + AI 제안 하이브리드 접근
  - AI 제안 최상단 배치 (✨ 아이콘)
  - 템플릿 추천 다양성 개선 (카테고리 중복 방지)
  - AI suggestion 전용 핸들러 추가
- ✅ API 비용 추적 시스템 배포 완료
- ✅ 카테고리별 UI 및 페이지네이션 구현
- ✅ 프롬프트 최적화 (카테고리별 특화)
- 📝 CLAUDE.md 업데이트 (AI 추천 시스템 반영)

### 2025년 10월 8일 (이전)
- 🎨 **이미지 편집 기능 개선 프로젝트 시작**
- ✅ Replicate → Gemini API 전환 완료
- ✅ 폴라로이드 템플릿 테스트 성공
- 📄 IMAGE_EDIT_IMPROVEMENT_PLAN.md 작성
- 🎯 우선순위 변경: 이미지 편집 > 세션 기억

### 2025년 1월 7일
- 🎯 Pixie 업그레이드 프로젝트 시작
- 📄 PIXIE_MIGRATION_PLAN.md 작성
- ✅ 템플릿 불일치 문제 해결

### 2024년 12월
- 세션 기억 기능 이슈 발견
- AI 사진 편집 기능 계획 수립
- 38개 프롬프트 템플릿 문서화
- 템플릿 DB 입력 완료

### 이전 업데이트
- Phase 1: 기본 명령어 구현
- Phase 2: 세션 시스템 구현 (미작동)
- Render.com 마이그레이션
- 타임아웃 이슈 해결

---

## 🎯 다음 작업 (이미지 편집 개선)

### Week 1: 즉시 시작 가능
1. ✅ **"전체 38개 스타일 보기" 핸들러 검증**
   - 버튼 존재 확인 완료
   - 핸들러 구현 여부 확인 필요

2. ⏳ **템플릿 다양성 테스트**
   - 리듬게임 캐릭터
   - 의상 교체
   - 표정 변경
   - 넨도로이드
   - 밤 인물사진

3. ⏳ **프롬프트 최적화 구현**
   - 카테고리별 특화 지시사항 추가
   - 이미지 분석 결과 활용
   - 품질 제어 파라미터 강화

### Week 2: UI/UX 및 추적
4. ⏳ **카테고리별 분류 UI**
   - 카테고리 버튼 추가
   - 카테고리 핸들러 구현

5. ⏳ **페이지네이션 개선**
   - 6개씩 표시 (2 rows × 3)
   - 이전/다음 버튼
   - 페이지 번호 표시

6. ⏳ **Gemini API 비용 추적**
   - API 사용 로그 테이블 생성
   - 비용 계산 함수 구현
   - 관리자 대시보드 명령어

### 작업 순서
상세 계획: `docs/IMAGE_EDIT_IMPROVEMENT_PLAN.md` 참고

---

*최종 수정: 2025년 10월 8일*
*다음 작업: "전체 스타일 보기" 핸들러 검증*
*상세 계획: docs/IMAGE_EDIT_IMPROVEMENT_PLAN.md 참고*
