# 🤖 Telegram AI Bot - 프로젝트 컨텍스트

## 🚨 CRITICAL: 개발 워크플로우 - 필수 준수사항

**⚠️ 절대 규칙: main 브랜치에 직접 커밋 금지!**

모든 개발은 반드시 브랜치 기반 워크플로우를 따라야 합니다:
1. main에서 feature 브랜치 생성
2. feature 브랜치에서 변경사항 작업
3. feature 브랜치를 원격에 푸시
4. main으로 Pull Request 생성
5. 리뷰 후에만 머지

**이것은 여러 개발자가 협업하는 팀 프로젝트입니다.**
**main 브랜치 직접 커밋은 엄격히 금지됩니다.**

자세한 내용은 `BRANCH_WORKFLOW.md` 참조

## 📋 프로젝트 개요
- **이름**: telegram-ai-bot
- **목적**: 텔레그램 그룹 채팅용 AI 봇 (대화 추적, 요약, 이미지 생성)
- **배포 환경**: Netlify Functions
- **데이터베이스**: Supabase (PostgreSQL)
- **AI 모델**: Claude 3.5 Sonnet, Google Imagen 4.0

## 🎨 이미지 편집 API - Google Gemini (중요!)

**⚠️ IMPORTANT: Google Gemini CAN edit and generate images!**

- **모델명**: `gemini-2.5-flash-image-preview` (이미지 생성/편집 전용 모델)
- **환경변수**: `GOOGLE_API_KEY` (별도 API 키 불필요)
- **기능**:
  - 이미지 편집 (img2img)
  - 이미지 생성 (text2img)
  - 스타일 변환
  - 멀티 이미지 합성
- **문서**: https://ai.google.dev/gemini-api/docs/image-generation
- **참고 파일**:
  - `GEMINI_IMAGE_EDITING.md` - 상세 구현 가이드
  - `src/services/nano-banafo-client.ts` - 구현 코드

**프롬프트 예시**:
```javascript
// 이미지 편집 요청
"Generate an edited version of this image with the following changes: [변경사항]
Return the edited image, not a text description."
```

## 🌐 배포 정보
- **Production URL**: https://tg-aibot.netlify.app
- **Webhook URL**: https://tg-aibot.netlify.app/.netlify/functions/webhook
- **Netlify Project ID**: 5d82d6eb-6bc7-424d-85be-4547137b48e6
- **Git Repository**: https://github.com/eardori/telegram-ai-bot

## 🔑 환경 변수
```bash
# 텔레그램 봇 설정
TELEGRAM_BOT_TOKEN=[Netlify에서 설정]
TELEGRAM_WEBHOOK_SECRET=[Netlify에서 설정]

# Supabase 데이터베이스
SUPABASE_URL=https://zcvkdaluliaszfxrpuvs.supabase.co
SUPABASE_ANON_KEY=[Netlify에서 설정]
SUPABASE_SERVICE_ROLE_KEY=[Netlify에서 설정]

# AI API 키들
CLAUDE_API_KEY=[Netlify에서 설정]
CLAUDE_MODEL=claude-3-sonnet-20240229
GOOGLE_API_KEY=[Netlify에서 설정]

# 봇 설정
NODE_ENV=development
LOG_LEVEL=info
DEFAULT_SUMMARY_INTERVAL=6
MAX_SUMMARY_LENGTH=2000
ADMIN_USER_IDS=123456789
```

## 🗃️ 데이터베이스 테이블 구조

### 1. 핵심 시스템 테이블

#### `bot_activity_log`
봇 활동 로그 및 디버깅 정보
```sql
- id (BIGSERIAL PRIMARY KEY)
- activity_type (TEXT) - 활동 유형
- activity_description (TEXT) - 활동 설명
- user_id (BIGINT) - 사용자 ID
- chat_id (BIGINT) - 채팅 ID
- message_id (BIGINT) - 메시지 ID
- status (TEXT DEFAULT 'success') - 처리 상태
- error_code (TEXT) - 에러 코드
- error_message (TEXT) - 에러 메시지
- request_data (JSONB) - 요청 데이터
- response_data (JSONB) - 응답 데이터
- processing_time_ms (INTEGER) - 처리 시간
- created_at (TIMESTAMPTZ DEFAULT NOW())
```

#### `user_preferences`
사용자별 설정 및 프리퍼런스
```sql
- user_id (BIGINT PRIMARY KEY)
- username (TEXT) - 텔레그램 유저명
- first_name (TEXT) - 이름
- last_name (TEXT) - 성
- language_code (TEXT DEFAULT 'ko') - 언어 코드
- timezone (TEXT DEFAULT 'Asia/Seoul') - 시간대
- notification_enabled (BOOLEAN DEFAULT TRUE) - 알림 설정
- auto_summary_enabled (BOOLEAN DEFAULT TRUE) - 자동 요약 설정
- summary_interval_hours (INTEGER DEFAULT 6) - 요약 주기
- max_summary_length (INTEGER DEFAULT 2000) - 최대 요약 길이
- preferences (JSONB DEFAULT '{}') - 기타 설정
- created_at, updated_at (TIMESTAMPTZ)
```

#### `chat_groups`
채팅 그룹 정보
```sql
- id (BIGSERIAL PRIMARY KEY)
- chat_id (BIGINT UNIQUE NOT NULL) - 텔레그램 채팅 ID
- chat_title (TEXT) - 채팅 제목
- chat_type (TEXT) - 채팅 유형 (private/group/supergroup/channel)
- is_active (BOOLEAN DEFAULT TRUE) - 활성 상태
- member_count (INTEGER DEFAULT 0) - 멤버 수
- settings (JSONB DEFAULT '{}') - 그룹별 설정
- created_at, updated_at (TIMESTAMPTZ)
```

### 2. 동적 프롬프트 관리 시스템

#### `prompts`
동적으로 변경 가능한 AI 프롬프트들
```sql
- id (BIGSERIAL PRIMARY KEY)
- prompt_type (TEXT) - 프롬프트 유형 (image_generation/qa_system/summarization/custom)
- prompt_name (TEXT NOT NULL) - 프롬프트 이름
- prompt_text (TEXT NOT NULL) - 프롬프트 내용
- prompt_version (INTEGER DEFAULT 1) - 버전
- template_variables (JSONB DEFAULT '[]') - 템플릿 변수 목록
- is_active (BOOLEAN DEFAULT TRUE) - 활성 상태
- usage_count (BIGINT DEFAULT 0) - 사용 횟수
- average_response_time_ms (DECIMAL) - 평균 응답 시간
- success_rate (DECIMAL DEFAULT 100.0) - 성공률
- created_by (TEXT DEFAULT 'system') - 생성자
- tags (TEXT[]) - 태그들
- metadata (JSONB DEFAULT '{}') - 메타데이터
- created_at, updated_at (TIMESTAMPTZ)
- UNIQUE(prompt_type, prompt_name)
```

#### `prompt_usage_analytics`
프롬프트 사용 분석 데이터
```sql
- id (BIGSERIAL PRIMARY KEY)
- prompt_id (BIGINT REFERENCES prompts(id))
- user_id (BIGINT) - 사용자 ID
- chat_id (BIGINT) - 채팅 ID
- template_variables_used (JSONB) - 사용된 템플릿 변수
- response_time_ms (INTEGER) - 응답 시간
- success (BOOLEAN DEFAULT TRUE) - 성공 여부
- error_message (TEXT) - 에러 메시지
- tokens_used (INTEGER) - 사용된 토큰 수
- created_at (TIMESTAMPTZ DEFAULT NOW())
```

### 3. 대화 추적 및 요약 시스템

#### `user_chat_tracking`
사용자별 채팅 추적 설정
```sql
- id (BIGSERIAL PRIMARY KEY)
- user_id (BIGINT NOT NULL) - 사용자 ID
- chat_id (BIGINT NOT NULL) - 채팅 ID
- username (TEXT) - 유저명
- first_name (TEXT) - 이름
- last_name (TEXT) - 성
- is_tracking (BOOLEAN DEFAULT FALSE) - 현재 추적 중인지 여부
- auto_summary_enabled (BOOLEAN DEFAULT TRUE) - 자동 요약 활성화
- summary_language (TEXT DEFAULT 'ko') - 요약 언어
- max_session_duration_hours (INTEGER DEFAULT 24) - 최대 세션 지속 시간
- last_activity_at (TIMESTAMPTZ DEFAULT NOW()) - 마지막 활동 시간
- total_sessions_created (INTEGER DEFAULT 0) - 생성한 총 세션 수
- total_messages_tracked (INTEGER DEFAULT 0) - 추적한 총 메시지 수
- created_at, updated_at (TIMESTAMPTZ)
- UNIQUE(user_id, chat_id)
```

#### `tracking_sessions`
대화 추적 세션들
```sql
- id (UUID PRIMARY KEY DEFAULT uuid_generate_v4())
- user_id (BIGINT NOT NULL) - 사용자 ID
- chat_id (BIGINT NOT NULL) - 채팅 ID
- status (TEXT DEFAULT 'active') - 상태 (active/stopped/expired/summarized)
- started_at (TIMESTAMPTZ DEFAULT NOW()) - 시작 시간
- ended_at (TIMESTAMPTZ) - 종료 시간
- duration_minutes (INTEGER) - 지속 시간 (분)
- total_messages_collected (INTEGER DEFAULT 0) - 수집한 총 메시지 수
- meaningful_messages_collected (INTEGER DEFAULT 0) - 의미있는 메시지 수
- unique_participants (INTEGER DEFAULT 1) - 고유 참여자 수
- auto_summary_enabled (BOOLEAN DEFAULT TRUE) - 자동 요약 활성화
- summary_language (TEXT DEFAULT 'ko') - 요약 언어
- session_metadata (JSONB DEFAULT '{}') - 세션 메타데이터
- created_at, updated_at (TIMESTAMPTZ)
- FOREIGN KEY (user_id, chat_id) REFERENCES user_chat_tracking(user_id, chat_id)
```

#### `tracked_messages`
추적된 메시지들
```sql
- id (BIGSERIAL PRIMARY KEY)
- tracking_session_id (UUID REFERENCES tracking_sessions(id))
- chat_id (BIGINT NOT NULL) - 채팅 ID
- message_id (BIGINT NOT NULL) - 메시지 ID
- user_id (BIGINT NOT NULL) - 사용자 ID
- username (TEXT) - 유저명
- user_first_name (TEXT) - 사용자 이름
- user_last_name (TEXT) - 사용자 성
- content (TEXT NOT NULL) - 메시지 내용
- message_type (TEXT DEFAULT 'text') - 메시지 유형
- message_timestamp (TIMESTAMPTZ NOT NULL) - 메시지 타임스탬프
- tracking_recorded_at (TIMESTAMPTZ DEFAULT NOW()) - 추적 기록 시간
- is_meaningful (BOOLEAN DEFAULT TRUE) - 의미있는 메시지 여부
- is_bot_message (BOOLEAN DEFAULT FALSE) - 봇 메시지 여부
- is_command (BOOLEAN DEFAULT FALSE) - 명령어 여부
- is_edited (BOOLEAN DEFAULT FALSE) - 편집된 메시지 여부
- is_forwarded (BOOLEAN DEFAULT FALSE) - 전달된 메시지 여부
- reply_to_message_id (BIGINT) - 답장 대상 메시지 ID
- reply_to_content (TEXT) - 답장 대상 내용
- sentiment_score (DECIMAL) - 감정 점수
- topic_tags (TEXT[]) - 주제 태그들
- message_metadata (JSONB DEFAULT '{}') - 메시지 메타데이터
- UNIQUE(tracking_session_id, message_id)
```

#### `conversation_summaries`
대화 요약 결과들
```sql
- id (UUID PRIMARY KEY DEFAULT uuid_generate_v4())
- tracking_session_id (UUID REFERENCES tracking_sessions(id))
- user_id (BIGINT NOT NULL) - 요청한 사용자 ID
- chat_id (BIGINT NOT NULL) - 채팅 ID
- summary_text (TEXT NOT NULL) - 요약 텍스트
- summary_language (TEXT DEFAULT 'ko') - 요약 언어
- message_count (INTEGER NOT NULL) - 요약된 메시지 수
- participant_count (INTEGER DEFAULT 1) - 참여자 수
- time_period_start (TIMESTAMPTZ NOT NULL) - 요약 시작 시간
- time_period_end (TIMESTAMPTZ NOT NULL) - 요약 종료 시간
- key_topics (TEXT[]) - 핵심 주제들
- key_decisions (TEXT[]) - 핵심 결정사항들
- key_questions (TEXT[]) - 핵심 질문들
- summary_metadata (JSONB DEFAULT '{}') - 요약 메타데이터
- processing_time_ms (INTEGER) - 처리 시간
- tokens_used (INTEGER) - 사용된 토큰 수
- created_at (TIMESTAMPTZ DEFAULT NOW())
- UNIQUE(tracking_session_id)
```

## 🔧 데이터베이스 함수들

### `expire_old_tracking_sessions()`
7일 이상 된 추적 세션들을 자동으로 만료시킴

### `cleanup_old_tracking_data(days_to_keep INTEGER DEFAULT 30)`
오래된 추적 데이터를 정리 (기본 30일 보관)

### `get_tracking_statistics()`
추적 시스템 통계 정보 반환
- 활성 세션 수
- 총 사용자 수
- 오늘 메시지 수
- 오늘 요약 수

## 📝 기본 프롬프트 데이터

### 이미지 생성 프롬프트
```
prompt_type: 'image_generation'
prompt_name: 'default_image_prompt'
template_variables: ["user_request"]
```

### 도비 QA 프롬프트
```
prompt_type: 'qa_system' 
prompt_name: 'dobby_personality_prompt'
template_variables: ["user_question"]
```

### 대화 요약 프롬프트
```
prompt_type: 'summarization'
prompt_name: 'conversation_summary_prompt'
template_variables: ["summary_language", "conversation_messages", "time_period", ...]
```

## 🎯 핵심 기능

### 1. 무한반복 버그 해결
- **위치**: `netlify/functions/webhook.ts:510-513`
- **해결**: `ctx.from?.is_bot || ctx.from?.id === ctx.me?.id` 체크
- **상태**: ✅ 완료

### 2. 동적 프롬프트 관리
- **실시간 프롬프트 변경** 가능 (재배포 불필요)
- **템플릿 변수 지원**: `{user_request}`, `{user_question}` 등
- **사용량 분석 및 성능 추적**

### 3. 대화 추적 시스템
- **자연어 명령어**: "도비야, 대화 추적 시작해줘"
- **슬래시 명령어**: `/track_start`, `/track_status`, `/summarize`, `/track_stop`
- **개별 사용자 제어**: 각 사용자가 독립적으로 추적 제어
- **자동 세션 만료**: 7일 후 자동 만료
- **스마트 필터링**: 의미있는 메시지만 추적

### 4. AI 요약 기능
- **Claude 3.5 Sonnet** 활용
- **구조화된 요약**: 주요 내용, 결정사항, 미해결 질문
- **한국어 최적화**
- **도비 캐릭터** 페르소나

## 🚨 주요 해결된 이슈들

### 1. 무한반복 버그
- **문제**: 봇이 자신의 메시지를 명령어로 인식
- **해결**: 봇 메시지 필터링 추가
- **결과**: 완전 해결됨

### 2. TypeScript 컴파일 에러
- **문제**: 중복 export 선언 및 타입 오류들
- **해결**: netlify.toml에서 빌드 단계 우회
- **배포**: TypeScript를 esbuild로 직접 번들링

### 3. Import 경로 오류
- **문제**: TrackingError 타입 import 경로 오류
- **해결**: 올바른 파일에서 import하도록 수정

## 📊 모니터링 및 유지보수

### 헬스체크 명령어
- `/health` - 시스템 상태 확인
- `/maintenance` - 자동 복구 실행

### 주요 모니터링 지표
- 활성 추적 세션 수
- 일일 메시지 추적 수
- 요약 생성 성공률
- API 응답 시간
- 에러 발생률

## 🎉 배포 완료 상태

- ✅ **무한반복 버그 해결**
- ✅ **데이터베이스 스키마 설계 완료**
- ✅ **프로덕션 배포 완료**: https://tg-aibot.netlify.app
- ✅ **웹훅 설정 완료**
- ⏳ **데이터베이스 스키마 적용 대기** (`combined-database-setup.sql` 실행 필요)

모든 핵심 시스템이 배포되었으며, SQL 스크립트만 실행하면 완전한 기능을 사용할 수 있습니다!