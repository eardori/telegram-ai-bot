# 🗄️ Supabase SQL 실행 가이드

**작성일:** 2025-01-10
**목적:** 피드백 시스템 활성화를 위한 SQL 스키마 실행

---

## 📋 실행할 SQL 파일

`sql/025_user_feedback_system.sql`

**내용:**
- ✅ `template_feedback` 테이블 (만족도 데이터)
- ✅ `v_template_feedback_stats` 뷰 (전체 통계)
- ✅ `v_recent_feedback_stats` 뷰 (최근 7일)
- ✅ `v_low_satisfaction_alerts` 뷰 (저만족도 경고)
- ✅ `get_feedback_summary()` 함수 (트렌드 분석)

---

## 🚀 실행 방법 (Step-by-Step)

### 1단계: Supabase Dashboard 접속

1. 브라우저에서 [https://supabase.com/dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. 좌측 메뉴 → **SQL Editor** 클릭

### 2단계: SQL 스크립트 복사

```bash
# 터미널에서 파일 내용 복사
cat sql/025_user_feedback_system.sql | pbcopy
```

또는 파일을 열어서 전체 내용 복사:
```
/Users/kevin/Codes/01_Multiful/bot-telegram/sql/025_user_feedback_system.sql
```

### 3단계: Supabase에서 실행

1. SQL Editor에서 **New Query** 클릭
2. 복사한 SQL 전체 붙여넣기
3. 우측 하단 **Run** 버튼 클릭 (또는 `Cmd+Enter`)
4. 성공 메시지 확인

### 4단계: 실행 확인

SQL Editor에서 아래 쿼리들을 실행하여 확인:

```sql
-- 1. 테이블 생성 확인
SELECT COUNT(*) as feedback_count FROM template_feedback;
-- 예상 결과: 0 (정상 - 아직 데이터 없음)

-- 2. 뷰 생성 확인
SELECT * FROM v_template_feedback_stats LIMIT 5;
-- 예상 결과: 빈 결과 (정상 - 아직 피드백 없음)

-- 3. 함수 생성 확인
SELECT * FROM get_feedback_summary(7);
-- 예상 결과: 빈 결과 (정상 - 아직 피드백 없음)

-- 4. 인덱스 확인
SELECT indexname FROM pg_indexes
WHERE tablename = 'template_feedback';
-- 예상 결과: 4개 인덱스
--   - idx_template_feedback_template_key
--   - idx_template_feedback_user_id
--   - idx_template_feedback_created_at
--   - idx_template_feedback_satisfied
```

---

## ✅ 실행 완료 체크리스트

- [ ] SQL 스크립트 실행 완료
- [ ] `template_feedback` 테이블 생성 확인
- [ ] 4개 뷰 생성 확인
- [ ] `get_feedback_summary()` 함수 생성 확인
- [ ] 인덱스 4개 생성 확인

---

## 🧪 테스트: 샘플 데이터 삽입 (선택)

실제 작동을 확인하려면 샘플 데이터를 삽입해보세요:

```sql
INSERT INTO template_feedback (user_id, chat_id, template_key, template_name, satisfied)
VALUES
  (139680303, 139680303, 'pixar_3d', 'Pixar 3D', true),
  (139680303, 139680303, 'pixar_3d', 'Pixar 3D', true),
  (139680303, 139680303, 'pixar_3d', 'Pixar 3D', true),
  (139680303, 139680303, 'pixar_3d', 'Pixar 3D', false),
  (139680303, 139680303, 'gta_style', 'GTA 스타일', true),
  (139680303, 139680303, 'gta_style', 'GTA 스타일', false),
  (139680303, 139680303, 'gta_style', 'GTA 스타일', false);
```

샘플 데이터 확인:

```sql
-- 전체 통계
SELECT * FROM v_template_feedback_stats;
-- 예상 결과:
--   pixar_3d: 4건, 75% 만족도
--   gta_style: 3건, 33% 만족도

-- 최근 7일
SELECT * FROM v_recent_feedback_stats;
-- 예상 결과: 동일 (모든 데이터가 최근 7일 내)

-- 저만족도 경고 (10건 미만이라 나타나지 않음)
SELECT * FROM v_low_satisfaction_alerts;
-- 예상 결과: 빈 결과 (피드백 10건 이상 필요)

-- 트렌드 분석
SELECT * FROM get_feedback_summary(7);
-- 예상 결과:
--   gta_style: 33%, trend='new'
--   pixar_3d: 75%, trend='new'
```

---

## 🎯 다음 단계: Telegram Bot 테스트

1. **봇에서 사진 편집**
   - 사진 업로드
   - 아무 스타일 선택 (예: Pixar 3D)
   - 편집 완료 후 👍 또는 👎 클릭

2. **관리자 명령어 테스트**
   ```
   /admin feedback
   ```
   - 방금 입력한 피드백이 표시되는지 확인
   - 통계가 정상적으로 계산되는지 확인

3. **데이터베이스 확인**
   ```sql
   SELECT * FROM template_feedback ORDER BY created_at DESC LIMIT 10;
   ```
   - Telegram에서 입력한 피드백이 실시간으로 저장되는지 확인

---

## 🔧 문제 해결

### 에러: "relation already exists"

**원인:** 테이블/뷰가 이미 존재함
**해결:** 정상입니다. `CREATE TABLE IF NOT EXISTS`를 사용하므로 무시됩니다.

### 에러: "function already exists"

**원인:** 함수가 이미 존재함
**해결:** 정상입니다. `CREATE OR REPLACE FUNCTION`을 사용하므로 덮어쓰기됩니다.

### 에러: "permission denied"

**원인:** Supabase 권한 부족
**해결:**
1. Supabase Dashboard → Settings → Database 확인
2. 프로젝트 소유자 계정으로 로그인했는지 확인

### 피드백 버튼이 안 보임

**원인:** Render 재배포 안 됨
**해결:**
1. Render.com Dashboard 접속
2. 프로젝트 선택
3. **Manual Deploy** → **Deploy latest commit**
4. 5-10분 대기

---

## 📊 예상 결과

### SQL 실행 후
- ✅ 0개 피드백 (정상 - 아직 사용자 입력 없음)
- ✅ 빈 통계 (정상)

### 첫 피드백 입력 후
- ✅ Telegram: "👍 감사합니다!" 메시지
- ✅ Database: `template_feedback` 테이블에 1건 저장
- ✅ `/admin feedback`: 해당 템플릿 통계 표시

### 10개 이상 피드백 누적 후
- ✅ `/admin feedback`: "주의 필요한 템플릿" 섹션 활성화
- ✅ 만족도 50% 미만 템플릿 자동 경고

---

## 📝 SQL 실행 로그 (기록용)

```
실행 일시: _____________
실행자: _____________
결과: [ ] 성공 [ ] 실패
비고: _____________________________________________
```

---

*최종 수정: 2025년 1월 10일*
