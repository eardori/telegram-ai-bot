# 📝 CLAUDE.md - 개발 컨텍스트 문서

## 🚨 최우선 해결 과제

### 세션 기억 기능 미작동 이슈
**문제 발생일**: 2024년 12월
**상태**: 🔴 미해결

#### 문제 상황
- 사용자가 연속으로 3개 이상 질문을 해도 이전 대화 컨텍스트가 유지되지 않음
- 매번 새로운 대화처럼 응답이 생성됨
- Phase 2 세션 시스템 구현은 완료되었으나 실제 작동하지 않음

#### 구현된 내용
1. **데이터베이스 스키마** (`phase2-session-activation.sql`)
   - context_sessions 테이블
   - session_messages 테이블
   - context_compressions 테이블
   - 사용자가 Supabase에 성공적으로 배포함

2. **SessionManager 클래스** (`src/session/SessionManager.ts`)
   - 싱글톤 패턴으로 구현
   - getOrCreateSession() 메서드
   - addMessage() 메서드
   - getContextForAPI() 메서드

3. **Claude API 통합** (`src/utils/claude-api.ts`)
   - askClaude() 함수에 context 파라미터 추가
   - 실제 Claude API 호출 구현 (스텁 제거)

#### 문제 원인 (추정)
1. **webhook.ts에서 SessionManager 미사용**
   - 현재 Dobby Q&A 핸들러가 SessionManager를 import하지 않음
   - answerQuestion() 함수가 세션 컨텍스트를 전달하지 않음

2. **Claude API 호출 시 컨텍스트 누락**
   - callClaudeAPI() 함수가 독립적으로 작동
   - 이전 메시지 히스토리를 포함하지 않음

3. **데이터베이스 연결 미구성**
   - Supabase 클라이언트는 있으나 세션 관련 쿼리 미구현
   - webhook.ts에서 Supabase import 없음

#### 해결 방안
```typescript
// webhook.ts 수정 필요 사항
1. SessionManager import 및 초기화
2. Dobby Q&A 핸들러에서:
   - 세션 생성/조회
   - 사용자 메시지 저장
   - 컨텍스트와 함께 Claude API 호출
   - 응답 저장

3. callClaudeAPI() 수정:
   - context 파라미터 추가
   - messages 배열에 컨텍스트 포함
```

#### 테스트 시나리오
1. "도비야 오늘 날씨 어때?"
2. "그럼 우산 가져가야 할까?"
3. "어제는 어땠어?"
→ 2, 3번 질문에서 이전 대화 참조 여부 확인

---

## 🎯 현재 진행 중인 작업

### AI 기반 사진 편집 기능
**시작일**: 2024년 12월
**상태**: 🟡 계획 수립 완료

#### 완료된 사항
1. **문서화**
   - `docs/IMAGE_EDIT_FEATURE_PLAN.md` - 전체 구현 계획
   - `docs/PROMPT_TEMPLATES.md` - 38개 프롬프트 분석 및 활용 계획
   - `docs/IMPLEMENTATION_TASKS.md` - 상세 작업 리스트

2. **프롬프트 템플릿**
   - 38개 고품질 프롬프트 확보
   - 카테고리별 분류 완료
   - 템플릿 구조 설계

#### 다음 단계
1. 데이터베이스 스키마 생성
2. 38개 템플릿 DB 입력
3. 이미지 분석 서비스 구현

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

# 추가 필요 (사진 편집용)
NANO_BANAFO_API_KEY=
NANO_BANAFO_API_URL=
```

### 주요 파일 구조
```
/netlify/functions/webhook.ts  # 메인 봇 핸들러
/src/utils/supabase.ts         # DB 연결
/src/session/SessionManager.ts # 세션 관리 (미사용)
/src/utils/claude-api.ts       # Claude API (스텁)
```

---

## ⚠️ 알려진 이슈

### 1. 도비 도움말 명령어 오탐지 (해결됨)
- "어떻게"가 포함된 질문이 도움말로 인식되는 문제
- webhook.ts에서 정규식 수정으로 해결
- 커밋: 6664c7b

### 2. 이미지 생성 타임아웃 (해결됨)
- 8초 제한으로 실패
- 20초로 증가하여 해결
- Render.com은 30초 제한

### 3. GitHub Push 문제 (해결됨)
- HTTP 500 에러 발생
- 계정 권한 문제로 확인
- 현재 정상 작동

---

## 📋 명령어 목록

### 일반 명령어
- `/start` - 봇 시작
- `/help` - 도움말
- `/imagine [프롬프트]` - 이미지 생성
- `/edit` - 이미지 편집 (개발 예정)

### 도비 명령어
- `도비야 [질문]` - Q&A
- `도비야 [설명] 그려줘` - 이미지 생성
- `도비야 도움말` - 도비 도움말

### 관리자 명령어
- `/prompt` - 프롬프트 관리
- `/track` - 대화 추적
- `/summary` - 대화 요약

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

---

## 📝 개발 가이드라인

### 코드 스타일
- TypeScript 사용
- async/await 패턴
- 에러 핸들링 필수
- 한국어 주석 허용

### 커밋 메시지
- 한국어 또는 영어
- 명확한 변경 사항 설명
- 이슈 번호 참조 (있을 경우)

### 테스트
- 로컬 테스트 후 배포
- Telegram 실제 봇으로 확인
- 로그 모니터링

---

## 📞 연락처

### Telegram Bot
- 봇 이름: @MultifulDobi_bot
- 테스트 그룹: (필요시 생성)

### 이슈 리포트
- GitHub Issues 사용
- 상세한 재현 방법 포함
- 로그/스크린샷 첨부

---

## 🔄 업데이트 로그

### 2024년 12월
- 세션 기억 기능 이슈 발견
- AI 사진 편집 기능 계획 수립
- 38개 프롬프트 템플릿 문서화

### 이전 업데이트
- Phase 1: 기본 명령어 구현
- Phase 2: 세션 시스템 구현 (미작동)
- Render.com 마이그레이션
- 타임아웃 이슈 해결

---

*최종 수정: 2024년 12월*
*다음 리뷰: 사진 편집 기능 구현 후*