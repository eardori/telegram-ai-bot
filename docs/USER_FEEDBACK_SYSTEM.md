# 📊 User Feedback System - 배포 및 사용 가이드

**작성일:** 2025-01-10
**상태:** ✅ 코드 배포 완료 | ⏳ SQL 스키마 실행 필요

---

## 📋 목차

1. [개요](#개요)
2. [Supabase SQL 실행](#supabase-sql-실행)
3. [기능 소개](#기능-소개)
4. [사용 방법](#사용-방법)
5. [테스트 시나리오](#테스트-시나리오)
6. [모니터링 쿼리](#모니터링-쿼리)
7. [문제 해결](#문제-해결)

---

## 🎯 개요

### 목적
- 템플릿별 사용자 만족도 추적
- 데이터 기반 템플릿 품질 개선
- 불만족 사용자 즉시 대응

### 주요 기능
1. **결과 화면 피드백 버튼** - 모든 편집 결과에 👍/👎 추가
2. **관리자 대시보드** - `/admin feedback` 명령어
3. **자동 알림** - 만족도 50% 미만 템플릿 경고
4. **트렌드 분석** - 개선/하락/안정/신규 템플릿 추적

---

## 🚀 Supabase SQL 실행

### 1단계: Supabase Dashboard 접속

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. 좌측 메뉴에서 **SQL Editor** 클릭

### 2단계: SQL 스크립트 실행

```sql
-- 파일: sql/025_user_feedback_system.sql
-- 아래 전체 내용을 복사하여 실행
```

**실행 순서:**
1. SQL Editor에서 **New Query** 클릭
2. `sql/025_user_feedback_system.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기
4. 우측 하단 **Run** 버튼 클릭 (또는 `Ctrl+Enter`)

### 3단계: 실행 확인

```sql
-- 1. 테이블 생성 확인
SELECT COUNT(*) as feedback_count FROM template_feedback;
-- 결과: 0 (정상)

-- 2. 뷰 생성 확인
SELECT * FROM v_template_feedback_stats LIMIT 5;
-- 결과: 빈 결과 (정상 - 아직 피드백 없음)

-- 3. 함수 생성 확인
SELECT * FROM get_feedback_summary(7);
-- 결과: 빈 결과 (정상 - 아직 피드백 없음)
```

---

## 🎨 기능 소개

### 1. 결과 화면 피드백 버튼

**위치:** 모든 편집 결과 화면 (3곳)
- 고정형 템플릿 결과
- 파라미터형 템플릿 결과
- 재편집 결과

**버튼:**
- [👍 좋아요] - 만족 피드백
- [👎 별로예요] - 불만족 피드백

**동작:**

#### 만족 시 (👍)
```
🎉 좋아해 주셔서 감사합니다!

친구들에게도 공유해주세요!
/referral 명령어로 친구 초대 링크를 받아보세요.

5명 초대 시 20 크레딧 보너스!
```

#### 불만족 시 (👎)
```
😔 아쉽네요! 더 나은 결과를 위해 도와드리겠습니다.

어떤 부분이 만족스럽지 않으셨나요?
```

**자동 액션 제안:**
- [🎨 다른 스타일 추천받기] - 카테고리 선택 화면으로
- [🏠 처음으로] - 원본 이미지 + AI 추천으로

---

### 2. 관리자 대시보드

#### 명령어

```bash
/admin feedback [기간]
```

**예시:**
- `/admin feedback` - 최근 7일 (기본값)
- `/admin feedback 30` - 최근 30일
- `/admin feedback 90` - 최근 90일

#### 출력 예시

```
📊 **사용자 피드백 대시보드**

**전체 통계 (Top 10)**
1. 🟢 Pixar 3D
   만족도: 92% (46👍 / 4👎)
   총 피드백: 50회

2. 🟡 아웃핏 스왑
   만족도: 68% (34👍 / 16👎)
   총 피드백: 50회

3. 🔴 배경 제거
   만족도: 42% (21👍 / 29👎)
   총 피드백: 50회

**최근 7일 트렌드**
📈 Pixar 3D: 92% (improving)
➡️ 아웃핏 스왑: 68% (stable)
📉 배경 제거: 42% (declining)

🚨 **주의 필요한 템플릿**
(만족도 50% 미만, 피드백 10개 이상)

🔴 배경 제거
   만족도: 42%
   불만족: 29회 / 총 50회

사용법: `/admin feedback [기간]`
예시: `/admin feedback 30` (최근 30일)
```

#### 만족도 색상 코드

- 🟢 **초록** - 80% 이상 (우수)
- 🟡 **노랑** - 60-79% (양호)
- 🔴 **빨강** - 60% 미만 (개선 필요)

#### 트렌드 이모지

- 📈 **improving** - 이전 기간 대비 +10% 이상
- 📉 **declining** - 이전 기간 대비 -10% 이상
- ➡️ **stable** - 변화 ±10% 이내
- 🆕 **new** - 이전 기간 데이터 없음

---

## 🧪 테스트 시나리오

### 시나리오 1: 만족 피드백 (정상 플로우)

1. 사진 업로드
2. 스타일 선택 (예: Pixar 3D)
3. 편집 완료 후 [👍 좋아요] 클릭
4. 감사 메시지 확인
5. 관리자 대시보드 확인:
   ```bash
   /admin feedback
   ```
6. Pixar 3D 만족도 증가 확인

### 시나리오 2: 불만족 피드백 + 액션

1. 사진 업로드
2. 스타일 선택 (예: 배경 제거)
3. 편집 완료 후 [👎 별로예요] 클릭
4. "어떤 부분이 만족스럽지 않으셨나요?" 메시지 확인
5. [🎨 다른 스타일 추천받기] 클릭
6. 카테고리 선택 화면으로 이동 확인
7. 관리자 대시보드 확인:
   ```bash
   /admin feedback
   ```
8. 배경 제거 만족도 감소 확인

### 시나리오 3: 경고 알림 테스트

**목표:** 만족도 50% 미만 템플릿이 "주의 필요" 섹션에 표시되는지 확인

1. 특정 템플릿(예: 배경 제거)에 대해 10회 이상 피드백 입력
   - 6회 이상 👎 (불만족)
   - 4회 이하 👍 (만족)
2. 관리자 대시보드 확인:
   ```bash
   /admin feedback
   ```
3. 🚨 주의 필요한 템플릿 섹션에 "배경 제거" 표시 확인
4. 만족도 50% 미만 확인

---

## 📊 모니터링 쿼리

### 1. 전체 피드백 현황

```sql
SELECT
  template_key,
  template_name,
  total_feedback,
  positive_count,
  negative_count,
  satisfaction_rate,
  last_feedback_at
FROM v_template_feedback_stats
ORDER BY total_feedback DESC;
```

### 2. 최근 7일 트렌드

```sql
SELECT * FROM get_feedback_summary(7);
```

### 3. 주의 필요한 템플릿

```sql
SELECT
  template_key,
  template_name,
  total_feedback,
  negative_count,
  satisfaction_rate
FROM v_low_satisfaction_alerts;
```

### 4. 특정 템플릿 피드백 상세

```sql
SELECT
  user_id,
  satisfied,
  feedback_reason,
  created_at
FROM template_feedback
WHERE template_key = 'pixar_3d'
ORDER BY created_at DESC
LIMIT 20;
```

### 5. 일별 피드백 추이

```sql
SELECT
  DATE(created_at) as feedback_date,
  COUNT(*) as total_feedback,
  COUNT(CASE WHEN satisfied = true THEN 1 END) as positive_count,
  COUNT(CASE WHEN satisfied = false THEN 1 END) as negative_count,
  ROUND(
    COUNT(CASE WHEN satisfied = true THEN 1 END)::DECIMAL / COUNT(*) * 100,
    2
  ) as satisfaction_rate
FROM template_feedback
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY feedback_date DESC;
```

---

## 🔧 문제 해결

### 문제 1: 피드백 버튼이 안 보여요

**원인:**
- 코드 배포는 되었지만, Render가 아직 재시작 안 됨
- 또는 캐싱 문제

**해결:**
1. Render.com Dashboard 접속
2. 프로젝트 선택
3. **Manual Deploy** → **Deploy latest commit** 클릭
4. 5-10분 대기 후 재시도

### 문제 2: `/admin feedback` 명령어가 작동 안 해요

**원인:**
- SQL 스키마가 실행되지 않음

**해결:**
1. Supabase Dashboard → SQL Editor
2. `sql/025_user_feedback_system.sql` 전체 실행
3. 확인:
   ```sql
   SELECT COUNT(*) FROM template_feedback;
   ```

### 문제 3: 피드백을 클릭하면 "에러 발생" 메시지가 나와요

**원인:**
- 데이터베이스 연결 문제
- 또는 callback_query 핸들러 충돌

**해결:**
1. Render 로그 확인:
   ```bash
   # Render Dashboard → Logs
   ```
2. 에러 메시지 확인 후 디버깅
3. Supabase 연결 확인:
   ```sql
   SELECT NOW();
   ```

### 문제 4: 통계가 실시간으로 업데이트 안 돼요

**원인:**
- 뷰(View)는 실시간이지만, 캐싱이나 네트워크 지연

**해결:**
- 정상 동작입니다. 뷰는 실시간 쿼리이므로 다시 호출하면 최신 데이터 표시됩니다.
- 10-30초 대기 후 `/admin feedback` 재실행

---

## 🎯 다음 단계

### Phase 2: 프롬프트 관리 시스템

피드백 시스템이 정상 작동하면, 다음 기능 추가 권장:

1. **`/admin prompt:stats <template_key>`** - 템플릿별 상세 통계
   - 총 사용 횟수
   - 평균 처리 시간
   - 성공률
   - 만족도 (피드백 시스템 연동)

2. **`/admin prompt:toggle <template_key>`** - 템플릿 활성화/비활성화
   - 만족도 낮은 템플릿 임시 비활성화
   - A/B 테스트

3. **자동 알림** - 만족도 급락 시 즉시 알림
   - 만족도 50% 미만 → 관리자 DM
   - 7일 내 20% 하락 → 관리자 DM

---

## 📚 관련 문서

- `sql/025_user_feedback_system.sql` - 데이터베이스 스키마
- `CLAUDE.md` - 전체 프로젝트 컨텍스트
- `docs/ADMIN_FEATURES_PLAN.md` - 관리자 기능 전체 계획
- `docs/REFERRAL_SYSTEM_DEPLOYMENT.md` - 추천인 시스템

---

*최종 수정: 2025년 1월 10일*
*작성자: Claude Code*
