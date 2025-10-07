# 📝 CLAUDE.md - 개발 컨텍스트 문서

## 🎯 프로젝트 상태 (2025-01-07)

### 현재 프로젝트: Pixie 업그레이드
**목표**: MultifulDobi → Pixie로 진화
**상세 계획**: `docs/PIXIE_MIGRATION_PLAN.md` (필독!)
**PRD 문서**: `Pixie - PRD.md`

### 구현 진행 상황
- [ ] **Phase 1**: 프롬프트 관리 시스템 (0%) - 파일 기반 + DB 하이브리드
- [ ] **Phase 2**: 토큰 경제 시스템 (0%) - 결제, 잔액, 거래내역
- [ ] **Phase 3**: 그룹 채팅 기능 (0%) - 모니터링, 요약, 컨텍스트 답변
- [ ] **Phase 4**: 관리자 대시보드 (0%) - 통계, 사용자 관리, 공지
- [ ] **Phase 5**: 세션 시스템 수정 (0%) - 기존 이슈 해결
- [ ] **Phase 6**: 최종 통합 테스트 (0%)

### 세션 재개 시 체크리스트
1. ✅ `docs/PIXIE_MIGRATION_PLAN.md` 읽기
2. ✅ 현재 Phase 진행률 확인
3. ✅ 해당 Phase의 "작업 내용" 섹션 검토
4. ✅ 테스트 체크리스트 확인
5. ✅ Git commit 전 테스트

---

## 🚨 최우선 해결 과제

### 1. 세션 기억 기능 미작동 이슈
**상태**: 🟡 Phase 5에서 해결 예정
**해결 방법**: webhook.ts에서 SessionManager 통합

**빠른 해결 방법** (Phase 5 작업 내용 참고):
```typescript
// netlify/functions/webhook.ts
import { SessionManager } from '../../src/session/SessionManager';
const sessionManager = SessionManager.getInstance();

// handleDobbyQuestion 함수 수정:
// 1. getOrCreateSession()
// 2. addMessage() - 사용자 메시지
// 3. getContextForAPI() - 컨텍스트 가져오기
// 4. Claude API 호출 (컨텍스트 포함)
// 5. addMessage() - 응답 저장
```

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
