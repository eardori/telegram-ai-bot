# 데이터베이스 스키마 문서

## 📋 개요
이 문서는 Telegram AI Bot의 전체 데이터베이스 스키마를 정의합니다.
최종 업데이트: 2025-09-14

## 🗄️ 현재 스키마 구조

### 1. 핵심 테이블

#### 1.1 bot_activity_log
봇의 모든 활동을 기록하는 로그 테이블
```sql
CREATE TABLE bot_activity_log (
    id BIGSERIAL PRIMARY KEY,
    activity_type TEXT NOT NULL,
    activity_description TEXT,
    user_id BIGINT,
    chat_id BIGINT,
    message_id BIGINT,
    status TEXT DEFAULT 'success',
    error_code TEXT,
    error_message TEXT,
    request_data JSONB,
    response_data JSONB,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.2 user_preferences
사용자별 환경설정 저장
```sql
CREATE TABLE user_preferences (
    user_id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    language_code TEXT DEFAULT 'ko',
    timezone TEXT DEFAULT 'Asia/Seoul',
    notification_enabled BOOLEAN DEFAULT TRUE,
    auto_summary_enabled BOOLEAN DEFAULT TRUE,
    summary_interval_hours INTEGER DEFAULT 6,
    max_summary_length INTEGER DEFAULT 2000,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.3 chat_groups
채팅방 정보 관리
```sql
CREATE TABLE chat_groups (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT UNIQUE NOT NULL,
    chat_title TEXT,
    chat_type TEXT CHECK (chat_type IN ('private', 'group', 'supergroup', 'channel')),
    is_active BOOLEAN DEFAULT TRUE,
    member_count INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. 프롬프트 관리 테이블

#### 2.1 prompts
동적 프롬프트 관리
```sql
CREATE TABLE prompts (
    id BIGSERIAL PRIMARY KEY,
    prompt_type TEXT NOT NULL CHECK (prompt_type IN ('image_generation', 'qa_system', 'summarization', 'custom')),
    prompt_name TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    prompt_version INTEGER DEFAULT 1,
    template_variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    usage_count BIGINT DEFAULT 0,
    average_response_time_ms DECIMAL,
    success_rate DECIMAL DEFAULT 100.0,
    created_by TEXT DEFAULT 'system',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(prompt_type, prompt_name)
);
```

#### 2.2 prompt_usage_analytics
프롬프트 사용 분석
```sql
CREATE TABLE prompt_usage_analytics (
    id BIGSERIAL PRIMARY KEY,
    prompt_id BIGINT REFERENCES prompts(id) ON DELETE CASCADE,
    user_id BIGINT,
    chat_id BIGINT,
    template_variables_used JSONB,
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. 추적 시스템 테이블

#### 3.1 user_chat_tracking
사용자별 채팅 추적 상태 (확장됨)
```sql
CREATE TABLE user_chat_tracking (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    is_tracking BOOLEAN DEFAULT FALSE,
    tracking_started_at TIMESTAMPTZ,       -- 누락된 컬럼 (수정 필요)
    tracking_stopped_at TIMESTAMPTZ,        -- 누락된 컬럼 (수정 필요)
    auto_summary_enabled BOOLEAN DEFAULT TRUE,
    summary_language TEXT DEFAULT 'ko',
    max_session_duration_hours INTEGER DEFAULT 24,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    total_sessions_created INTEGER DEFAULT 0,
    total_messages_tracked INTEGER DEFAULT 0,

    -- 컨텍스트 관련 (신규 추가 예정)
    conversation_context JSONB DEFAULT '{}',
    personality_profile JSONB DEFAULT '{}',
    communication_style VARCHAR(50) DEFAULT 'casual',
    interests TEXT[] DEFAULT '{}',
    last_context_summary TEXT,
    context_updated_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, chat_id)
);
```

#### 3.2 tracking_sessions
추적 세션 관리 (확장됨)
```sql
CREATE TABLE tracking_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'stopped', 'expired', 'summarized')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),  -- 누락된 컬럼 (수정 필요)
    first_name TEXT,                        -- 누락된 컬럼 (수정 필요)
    last_name TEXT,                         -- 누락된 컬럼 (수정 필요)
    username TEXT,                          -- 누락된 컬럼 (수정 필요)
    duration_minutes INTEGER,
    total_messages_collected INTEGER DEFAULT 0,
    meaningful_messages_collected INTEGER DEFAULT 0,
    unique_participants INTEGER DEFAULT 1,
    auto_summary_enabled BOOLEAN DEFAULT TRUE,
    summary_language TEXT DEFAULT 'ko',
    session_metadata JSONB DEFAULT '{}',

    -- 컨텍스트 관련 (신규 추가 예정)
    context_before JSONB,
    context_after JSONB,
    context_learnings JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (user_id, chat_id) REFERENCES user_chat_tracking(user_id, chat_id)
);
```

#### 3.3 tracked_messages
추적된 메시지 저장
```sql
CREATE TABLE tracked_messages (
    id BIGSERIAL PRIMARY KEY,
    tracking_session_id UUID REFERENCES tracking_sessions(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    username TEXT,
    user_first_name TEXT,
    user_last_name TEXT,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'photo', 'video', 'document', 'sticker', 'voice', 'other')),
    message_timestamp TIMESTAMPTZ NOT NULL,
    tracking_recorded_at TIMESTAMPTZ DEFAULT NOW(),
    is_meaningful BOOLEAN DEFAULT TRUE,
    is_bot_message BOOLEAN DEFAULT FALSE,
    is_command BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    is_forwarded BOOLEAN DEFAULT FALSE,
    contains_media BOOLEAN DEFAULT FALSE,    -- 누락된 컬럼 (수정 필요)
    reply_to_message_id BIGINT,
    reply_to_content TEXT,
    sentiment_score DECIMAL,
    topic_tags TEXT[] DEFAULT '{}',
    message_metadata JSONB DEFAULT '{}',

    UNIQUE(tracking_session_id, message_id)
);
```

#### 3.4 conversation_summaries
대화 요약 저장
```sql
CREATE TABLE conversation_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_session_id UUID REFERENCES tracking_sessions(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    summary_text TEXT NOT NULL,
    summary_language TEXT DEFAULT 'ko',
    message_count INTEGER NOT NULL,
    participant_count INTEGER DEFAULT 1,
    time_period_start TIMESTAMPTZ NOT NULL,
    time_period_end TIMESTAMPTZ NOT NULL,
    key_topics TEXT[] DEFAULT '{}',
    key_decisions TEXT[] DEFAULT '{}',
    key_questions TEXT[] DEFAULT '{}',
    summary_metadata JSONB DEFAULT '{}',
    processing_time_ms INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tracking_session_id)
);
```

### 4. 신규 추가 예정 테이블 (통합 컨텍스트 시스템)

#### 4.1 user_message_context
사용자별 메시지 컨텍스트 (신규)
```sql
CREATE TABLE IF NOT EXISTS user_message_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,

    -- 메시지 컨텍스트
    message_content TEXT NOT NULL,
    message_timestamp TIMESTAMPTZ NOT NULL,
    bot_response TEXT,

    -- 컨텍스트 분석
    intent_detected VARCHAR(100),
    emotion_detected VARCHAR(50),
    topics_mentioned TEXT[],

    -- 추적 연결
    tracking_session_id UUID REFERENCES tracking_sessions(id),
    is_tracked BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (user_id, chat_id) REFERENCES user_chat_tracking(user_id, chat_id),
    UNIQUE(user_id, chat_id, message_id)
);
```

#### 4.2 context_learning_history
컨텍스트 학습 히스토리 (신규)
```sql
CREATE TABLE IF NOT EXISTS context_learning_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    tracking_session_id UUID REFERENCES tracking_sessions(id),

    -- 학습 내용
    learning_type VARCHAR(50),
    learning_content JSONB NOT NULL,
    confidence_score DECIMAL(3,2),

    -- 적용 상태
    is_applied BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (user_id, chat_id) REFERENCES user_chat_tracking(user_id, chat_id)
);
```

### 5. 버전 관리 테이블 (계획됨)

#### 5.1 version_history
버전 히스토리 추적
```sql
CREATE TABLE IF NOT EXISTS version_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_number VARCHAR(50) NOT NULL,
    commit_hash VARCHAR(64) NOT NULL UNIQUE,
    commit_message TEXT,
    commit_author VARCHAR(255),
    commit_date TIMESTAMPTZ NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 📊 인덱스

### 기본 인덱스
```sql
-- Bot activity log
CREATE INDEX idx_bot_activity_log_user_id ON bot_activity_log(user_id);
CREATE INDEX idx_bot_activity_log_chat_id ON bot_activity_log(chat_id);
CREATE INDEX idx_bot_activity_log_created_at ON bot_activity_log(created_at);

-- User preferences
CREATE INDEX idx_user_preferences_username ON user_preferences(username);

-- Chat groups
CREATE INDEX idx_chat_groups_chat_id ON chat_groups(chat_id);

-- Tracking
CREATE INDEX idx_user_chat_tracking_user_chat ON user_chat_tracking(user_id, chat_id);
CREATE INDEX idx_tracking_sessions_user_chat ON tracking_sessions(user_id, chat_id);
CREATE INDEX idx_tracked_messages_session_id ON tracked_messages(tracking_session_id);
```

## 🔧 현재 적용 필요한 수정사항

### fix-tracking-schema.sql 내용
```sql
-- Add missing columns to user_chat_tracking table
ALTER TABLE user_chat_tracking
ADD COLUMN IF NOT EXISTS tracking_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tracking_stopped_at TIMESTAMPTZ;

-- Add missing columns to tracking_sessions table
ALTER TABLE tracking_sessions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS username TEXT;

-- Add missing column to tracked_messages table
ALTER TABLE tracked_messages
ADD COLUMN IF NOT EXISTS contains_media BOOLEAN DEFAULT FALSE;

-- Update existing sessions without expires_at
UPDATE tracking_sessions
SET expires_at = started_at + INTERVAL '7 days'
WHERE expires_at IS NULL;
```

## 🚀 마이그레이션 순서

1. **즉시 적용 필요** (fix-tracking-schema.sql)
   - 현재 봇 기능 정상화를 위해 필수

2. **Phase 1 적용** (컨텍스트 기초)
   - user_chat_tracking 테이블 확장
   - user_message_context 테이블 생성

3. **Phase 2 적용** (학습 시스템)
   - context_learning_history 테이블 생성
   - tracking_sessions 테이블 확장

4. **Phase 3 적용** (버전 관리)
   - version_history 테이블 생성

## 📝 스키마 관리 규칙

1. **명명 규칙**
   - 테이블명: snake_case, 복수형
   - 컬럼명: snake_case
   - 인덱스명: idx_테이블명_컬럼명

2. **타입 규칙**
   - ID: BIGSERIAL 또는 UUID
   - 시간: TIMESTAMPTZ
   - JSON 데이터: JSONB
   - 텍스트 배열: TEXT[]

3. **제약조건**
   - 모든 테이블에 PRIMARY KEY 필수
   - 외래키는 명시적으로 정의
   - UNIQUE 제약은 비즈니스 로직에 따라

4. **기본값**
   - 생성시간: DEFAULT NOW()
   - Boolean: 명시적 DEFAULT 값
   - JSONB: DEFAULT '{}' 또는 '[]'

## 🔗 관련 문서

- [INTEGRATED_CONTEXT_TRACKING.md](./INTEGRATED_CONTEXT_TRACKING.md) - 통합 컨텍스트 설계
- [CONTEXT.md](./CONTEXT.md) - 프로젝트 컨텍스트
- [combined-database-setup.sql](./combined-database-setup.sql) - 초기 설정 스크립트