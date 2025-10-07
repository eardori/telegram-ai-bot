# 📝 CLAUDE.md - 개발 컨텍스트 문서

## 🎯 프로젝트 상태 (2025-01-08)

### 현재 프로젝트: Pixie 업그레이드
**목표**: MultifulDobi → Pixie로 진화
**상세 계획**: `docs/PIXIE_MIGRATION_PLAN.md` (필독!)
**PRD 문서**: `Pixie - PRD.md`

### ⚡ 작업 순서 (사용자 승인)
1. **Phase 5: 세션 수정** (1-2시간) ← 먼저 진행
2. **Phase 1: 프롬프트 + Replicate** (2-3일)

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
- [ ] **Phase 1**: 프롬프트 관리 + Replicate (0%) - 파일 기반 + NSFW 기능 ← 다음 작업
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

### 1. 세션 기억 기능 미작동 이슈 ✅ 해결 완료! (2025-01-08)
**상태**: 🟢 해결됨
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

# Image Generation
NANO_BANAFO_API_KEY=
NANO_BANAFO_API_URL=

# Admin
ADMIN_USER_IDS=123456789,987654321

# Payment (Phase 2에서 추가)
PAYMENT_PROVIDER_TOKEN=

# Features
NODE_ENV=production
ENABLE_HOT_RELOAD=false
```

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

### 2025년 1월 7일
- 🎯 Pixie 업그레이드 프로젝트 시작
- 📄 PIXIE_MIGRATION_PLAN.md 작성
- 📝 CLAUDE.md 업데이트
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

## 🎯 다음 작업

### 즉시 시작 가능
1. **Phase 1 시작**: 프롬프트 관리 시스템
   ```bash
   mkdir -p src/data/prompts/{core,experimental,seasonal}
   ```

2. **38개 프롬프트를 JSON으로 변환**
   - `sql/009_insert_prompt_templates.sql` 참고
   - 5개 카테고리 파일 생성

3. **PromptManager 클래스 구현**
   - `src/services/prompt-manager.ts`

4. **관리자 명령어 구현**
   - `src/handlers/admin-handler.ts`

### 작업 순서
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

각 Phase 완료 후:
1. Git commit + tag
2. 테스트
3. CLAUDE.md 진행률 업데이트
4. 다음 Phase 시작

---

*최종 수정: 2025년 1월 7일*
*다음 작업: Phase 1 시작*
*상세 계획: docs/PIXIE_MIGRATION_PLAN.md 참고*
