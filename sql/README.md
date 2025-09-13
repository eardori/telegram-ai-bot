# Telegram Bot Database Schema

이 디렉토리는 Supabase PostgreSQL 데이터베이스의 스키마와 마이그레이션 파일들을 포함합니다.

## 📁 파일 구조

```
sql/
├── README.md                   # 이 파일 - 데이터베이스 설정 가이드
├── 001_initial_schema.sql      # 초기 테이블 스키마 생성
├── 002_indexes.sql             # 성능 최적화를 위한 인덱스
├── 003_rls_policies.sql        # Row Level Security 정책
├── 004_functions.sql           # 데이터베이스 함수 및 저장 프로시저
└── 005_initial_data.sql        # 초기 데이터 및 개발용 샘플 데이터
```

## 🗂️ 데이터베이스 스키마 개요

### 핵심 테이블

#### `chat_groups`
- 텔레그램 챗 그룹 정보 저장
- 봇이 활성화된 모든 그룹/개인 채팅 추적

#### `messages`
- 모든 텔레그램 메시지 저장
- 요약 생성을 위한 메시지 내용 보관
- 처리 상태 및 메시지 유형 추적

#### `summaries`
- AI가 생성한 대화 요약 저장
- LLM 제공자별 성능 및 비용 메트릭 포함

#### `generated_images`
- AI로 생성된 이미지 정보 저장
- 생성 파라미터 및 비용 추적

#### `chat_settings`
- 채팅별 봇 설정 (요약 주기, 언어 등)
- 관리자 권한 및 콘텐츠 필터링 옵션

#### `user_preferences`
- 사용자별 개인 설정
- 개인정보보호 설정 및 사용 제한

### 시스템 테이블

#### `bot_activity_log`
- 모든 봇 활동 로그
- 오류 추적 및 성능 모니터링

#### `api_usage`
- 외부 API 사용량 및 비용 추적
- OpenAI, Claude, DALL-E 등 API 호출 기록

## 🚀 설치 및 설정

### 1. Supabase 프로젝트 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트 URL과 API 키 확인
3. SQL Editor에서 마이그레이션 실행

### 2. 마이그레이션 실행

**중요**: 파일들을 반드시 순서대로 실행해야 합니다.

#### 방법 1: Supabase Dashboard 사용

1. Supabase Dashboard → SQL Editor
2. 각 파일을 순서대로 열어 실행:

```sql
-- 1. 기본 스키마 생성
-- 001_initial_schema.sql 내용을 붙여넣고 실행

-- 2. 인덱스 생성 (성능 향상)
-- 002_indexes.sql 내용을 붙여넣고 실행

-- 3. 보안 정책 설정
-- 003_rls_policies.sql 내용을 붙여넣고 실행

-- 4. 함수 및 저장 프로시저
-- 004_functions.sql 내용을 붙여넣고 실행

-- 5. 초기 데이터 (개발용)
-- 005_initial_data.sql 내용을 붙여넣고 실행
```

#### 방법 2: Supabase CLI 사용

```bash
# Supabase CLI 설치
npm install -g supabase

# 프로젝트 연결
supabase init
supabase login
supabase link --project-ref your-project-ref

# 마이그레이션 실행
supabase db reset
```

#### 방법 3: psql 사용

```bash
# PostgreSQL 클라이언트로 직접 연결
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres"

# 파일 실행
\i 001_initial_schema.sql
\i 002_indexes.sql
\i 003_rls_policies.sql
\i 004_functions.sql
\i 005_initial_data.sql
```

### 3. 데이터베이스 사용자 설정

```sql
-- 봇 서비스용 사용자 생성 (애플리케이션 전용)
CREATE USER bot_service_user WITH PASSWORD 'your-secure-password';
GRANT bot_service TO bot_service_user;

-- 분석용 사용자 생성 (읽기 전용)
CREATE USER analytics_user WITH PASSWORD 'your-analytics-password';
GRANT analytics TO analytics_user;

-- 관리자 사용자 생성
CREATE USER bot_admin_user WITH PASSWORD 'your-admin-password';
GRANT bot_admin TO bot_admin_user;
```

## 🔐 보안 설정

### Row Level Security (RLS)

모든 테이블에 RLS가 활성화되어 있으며, 다음 역할 기반 접근 제어를 사용합니다:

- **`bot_service`**: 봇 애플리케이션용 - 모든 데이터에 대한 읽기/쓰기 권한
- **`analytics`**: 분석용 - 모든 데이터에 대한 읽기 전용 권한
- **`bot_admin`**: 관리자용 - 모든 권한 포함 유지보수 기능
- **`authenticated`**: 일반 사용자 - 자신의 데이터만 접근 가능

### 환경 변수 설정

`.env` 파일에 다음 변수들을 설정하세요:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database Connection (bot service)
DATABASE_URL=postgresql://bot_service_user:password@db.your-project.supabase.co:5432/postgres
```

## 📊 데이터베이스 모니터링

### 성능 모니터링 쿼리

```sql
-- 테이블 크기 확인
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 인덱스 사용률 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
ORDER BY idx_tup_read DESC;

-- 느린 쿼리 확인 (PostgreSQL 설정 필요)
SELECT 
    query,
    mean_exec_time,
    calls,
    total_exec_time
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

### 데이터베이스 상태 확인 함수

```sql
-- 종합 상태 확인
SELECT * FROM get_database_health();

-- 봇 성능 메트릭
SELECT * FROM get_bot_performance_metrics(7); -- 최근 7일

-- API 사용량 분석
SELECT * FROM get_api_usage_summary(30, 'openai'); -- OpenAI 최근 30일
```

## 🛠️ 유지보수

### 정기 유지보수 작업

```sql
-- 1. 통계 업데이트 (매주)
ANALYZE;

-- 2. 인덱스 재구성 (매월)
REINDEX DATABASE postgres;

-- 3. 오래된 데이터 정리 (매월)
SELECT cleanup_old_data();

-- 4. 테이블 최적화 (매월)
SELECT maintenance_vacuum_analyze();
```

### 백업 및 복원

```bash
# 백업 생성
pg_dump "postgresql://postgres:password@db.your-project.supabase.co:5432/postgres" > backup.sql

# 백업에서 복원
psql "postgresql://postgres:password@db.your-project.supabase.co:5432/postgres" < backup.sql

# Supabase CLI 사용 (권장)
supabase db dump -f backup.sql
supabase db reset --restore-backup backup.sql
```

## 📈 데이터 보존 정책

### 자동 데이터 정리

- **메시지**: 2년 후 내용을 `[archived]`로 변경
- **활동 로그**: 6개월 후 삭제
- **API 사용 기록**: 1년 후 삭제 (청구 목적으로 보관)
- **생성된 이미지**: 무기한 보관 (사용자 요청시 삭제)

### GDPR 준수

```sql
-- 사용자 데이터 삭제 (GDPR 요청시)
SELECT delete_user_data(user_id);

-- 데이터 수집 동의 철회
UPDATE user_preferences 
SET allow_data_collection = false 
WHERE user_id = ?;
```

## 🚨 트러블슈팅

### 일반적인 문제들

#### 1. RLS 정책 오류
```sql
-- 현재 사용자 역할 확인
SELECT current_user, current_setting('role');

-- RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'messages';
```

#### 2. 성능 문제
```sql
-- 느린 쿼리 식별
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- 인덱스 누락 확인
EXPLAIN ANALYZE SELECT * FROM messages WHERE chat_id = ?;
```

#### 3. 연결 문제
```sql
-- 현재 연결 수 확인
SELECT count(*) FROM pg_stat_activity;

-- 잠금 대기 확인
SELECT * FROM pg_stat_activity WHERE waiting = true;
```

### 로그 분석

```sql
-- 오류 로그 확인
SELECT * FROM bot_activity_log 
WHERE status = 'error' 
AND created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- 성능 이슈 추적
SELECT 
    activity_type,
    AVG(duration_ms) as avg_duration,
    COUNT(*) as count,
    MAX(duration_ms) as max_duration
FROM bot_activity_log 
WHERE duration_ms IS NOT NULL 
AND created_at >= NOW() - INTERVAL '1 day'
GROUP BY activity_type
ORDER BY avg_duration DESC;
```

## 📞 지원

### 개발팀 문의
- 스키마 관련 이슈: 데이터베이스 팀
- 성능 관련 이슈: DevOps 팀
- 보안 관련 이슈: 보안 팀

### 유용한 링크
- [Supabase 문서](https://supabase.com/docs)
- [PostgreSQL 문서](https://www.postgresql.org/docs/)
- [그래미(grammY) 텔레그램 봇 프레임워크](https://grammy.dev/)

---

**마지막 업데이트**: 2025-09-10
**스키마 버전**: 1.0.0