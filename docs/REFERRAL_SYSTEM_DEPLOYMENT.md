# 🎁 추천인 시스템 배포 가이드

## 📋 목차
1. [개요](#개요)
2. [데이터베이스 설정](#데이터베이스-설정)
3. [테스트 시나리오](#테스트-시나리오)
4. [사용법](#사용법)
5. [관리자 모니터링](#관리자-모니터링)

---

## 🎯 개요

### 기능 요약
- **추천 코드 자동 생성**: MULTI + 5자리 숫자 (예: MULTI12345)
- **Deep Link 처리**: `/start ref_MULTI12345`
- **즉시 보상 지급**: 추천인 +10, 피추천인 +10 크레딧
- **계단식 마일스톤**: 5명/10명/25명/50명 달성 시 추가 보너스
- **실시간 알림**: DM으로 자동 알림

### 비즈니스 임팩트
- **CAC 절감**: $3-5 → $0.04 (99% 절감)
- **바이럴 계수**: K > 1 목표
- **자동 성장**: 한 번 구현하면 자동으로 사용자 획득

---

## 🗄️ 데이터베이스 설정

### 1단계: Supabase 대시보드 접속
```
https://supabase.com/dashboard/project/YOUR_PROJECT_ID/editor
```

### 2단계: SQL Editor에서 스크립트 실행
1. 왼쪽 메뉴에서 **SQL Editor** 클릭
2. **New query** 버튼 클릭
3. `sql/021_referral_system.sql` 파일 내용 전체 복사
4. 붙여넣기 후 **Run** 버튼 클릭 (또는 Cmd/Ctrl + Enter)

### 3단계: 실행 결과 확인
```sql
-- 테이블 생성 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('referrals', 'referral_milestones', 'referral_milestone_achievements');

-- 마일스톤 데이터 확인
SELECT * FROM referral_milestones ORDER BY required_referrals;

-- 기존 사용자들의 referral_code 생성 확인
SELECT id, username, referral_code FROM users LIMIT 10;
```

### 4단계: 트리거 작동 확인
새 사용자가 가입하면 자동으로 `referral_code`가 생성됩니다.

---

## 🧪 테스트 시나리오

### 시나리오 1: 기본 추천 흐름
1. **사용자 A가 추천 코드 확인**
   ```
   /referral
   ```
   - 추천 코드: MULTI12345
   - 추천 링크: `https://t.me/봇이름?start=ref_MULTI12345`

2. **사용자 B가 추천 링크로 가입**
   ```
   /start ref_MULTI12345
   ```
   - 사용자 B: "🎊 가입을 환영합니다! 10 크레딧을 받았습니다!"
   - 사용자 A: "🎉 새로운 친구 가입! 10 크레딧을 받았습니다."

3. **크레딧 확인**
   ```
   /credits
   ```
   - 사용자 A: +10 크레딧
   - 사용자 B: +10 크레딧

### 시나리오 2: 마일스톤 달성
1. **사용자 A가 5명 초대 완료**
   - 자동 알림: "🏆 마일스톤 달성! 브론즈 레벨에 도달했습니다!"
   - 보상: +20 크레딧

2. **통계 확인**
   ```
   /referral
   ```
   - 총 초대한 친구: 5명
   - 획득한 크레딧: 70회 (5×10 + 20 보너스)
   - 달성한 마일스톤: 1개

### 시나리오 3: 오류 처리
1. **자기 자신 추천**
   ```
   /start ref_MULTI12345  (본인 코드)
   ```
   - 오류: "자기 자신을 추천할 수 없습니다."

2. **이미 추천받은 사용자**
   ```
   /start ref_MULTI67890  (다른 코드)
   ```
   - 오류: "이미 다른 추천인을 통해 가입하셨습니다."

3. **잘못된 추천 코드**
   ```
   /start ref_INVALID123
   ```
   - 오류: "유효하지 않은 추천 코드입니다."

---

## 📱 사용법

### 일반 사용자

#### 1. 내 추천 코드 확인
```
/referral
```

**응답:**
```
🎁 친구 초대하고 크레딧 받기!

내 추천 코드: MULTI12345
추천 링크: https://t.me/봇이름?start=ref_MULTI12345

━━━━━━━━━━━━━━━━━━━━━━

📊 내 추천 현황:
• 총 초대한 친구: 3명
• 획득한 크레딧: 30회
• 달성한 마일스톤: 0개

🎯 다음 목표:
• 브론즈: 5명 초대
• 2명 남음
• 보상: 20 크레딧

💡 친구가 가입하면:
• 나: +10 크레딧
• 친구: +10 크레딧

🏆 마일스톤 보너스:
• 5명: +20 크레딧 (브론즈)
• 10명: +50 크레딧 (실버)
• 25명: +150 크레딧 (골드)
• 50명: +500 크레딧 + VIP 혜택 (플래티넘)

친구들에게 링크를 공유하세요! 🚀
```

#### 2. 친구 초대하기
- **공유 버튼 클릭**: Telegram 공유 UI 자동 열림
- **링크 복사**: 다른 앱에 붙여넣기

#### 3. 추천받아 가입하기
친구가 보낸 링크 클릭:
```
https://t.me/봇이름?start=ref_MULTI12345
```

---

## 👨‍💼 관리자 모니터링

### SQL 쿼리

#### 1. 전체 추천 통계
```sql
SELECT
  COUNT(*) AS total_referrals,
  SUM(CASE WHEN reward_granted THEN 1 ELSE 0 END) AS completed_referrals,
  COUNT(DISTINCT referrer_user_id) AS active_referrers,
  SUM(referrer_reward_credits) AS total_credits_given
FROM referrals;
```

#### 2. Top 10 추천인
```sql
SELECT
  u.id,
  u.username,
  u.referral_code,
  COUNT(r.id) AS total_referrals,
  SUM(r.referrer_reward_credits) AS total_earned
FROM users u
LEFT JOIN referrals r ON r.referrer_user_id = u.id AND r.reward_granted = true
GROUP BY u.id, u.username, u.referral_code
ORDER BY total_referrals DESC
LIMIT 10;
```

#### 3. 마일스톤 달성 현황
```sql
SELECT
  m.milestone_name,
  m.required_referrals,
  COUNT(a.id) AS users_achieved
FROM referral_milestones m
LEFT JOIN referral_milestone_achievements a ON a.milestone_id = m.id
GROUP BY m.id, m.milestone_name, m.required_referrals
ORDER BY m.required_referrals ASC;
```

#### 4. 최근 24시간 추천 활동
```sql
SELECT
  r.id,
  referrer.username AS referrer,
  referred.username AS referred,
  r.created_at,
  r.reward_granted
FROM referrals r
JOIN users referrer ON r.referrer_user_id = referrer.id
JOIN users referred ON r.referred_user_id = referred.id
WHERE r.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY r.created_at DESC;
```

#### 5. 추천 전환율 분석
```sql
-- 가입자 중 추천으로 온 비율
SELECT
  COUNT(DISTINCT u.id) AS total_users,
  COUNT(DISTINCT r.referred_user_id) AS referred_users,
  ROUND(
    COUNT(DISTINCT r.referred_user_id)::NUMERIC /
    NULLIF(COUNT(DISTINCT u.id), 0) * 100,
    2
  ) AS referral_percentage
FROM users u
LEFT JOIN referrals r ON r.referred_user_id = u.id;
```

---

## 🔧 문제 해결

### 문제 1: 추천 코드가 생성되지 않음
**증상**: 기존 사용자에게 `referral_code`가 없음

**해결:**
```sql
-- 수동으로 일괄 생성
UPDATE users
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;
```

### 문제 2: 보상이 지급되지 않음
**증상**: 추천 성공했지만 크레딧이 안 들어옴

**확인:**
```sql
-- 추천 기록 확인
SELECT * FROM referrals
WHERE referred_user_id = <user_id>;

-- 트랜잭션 확인
SELECT * FROM credit_transactions
WHERE user_id IN (<referrer_id>, <referred_id>)
  AND transaction_type = 'bonus'
ORDER BY created_at DESC;
```

**해결:**
보상이 `reward_granted = false`로 되어 있다면:
```sql
-- 수동으로 보상 지급
SELECT grant_referral_rewards(
  <referrer_user_id>,
  <referred_user_id>,
  '<referral_code>'
);
```

### 문제 3: 마일스톤이 자동으로 체크되지 않음
**증상**: 5명 초대했는데 브론즈 보상이 안 옴

**확인:**
```sql
-- 마일스톤 달성 확인
SELECT * FROM referral_milestone_achievements
WHERE user_id = <user_id>;

-- 추천 수 확인
SELECT COUNT(*) FROM referrals
WHERE referrer_user_id = <user_id>
  AND reward_granted = true;
```

**해결:**
```sql
-- 수동으로 마일스톤 체크
SELECT check_referral_milestones(<user_id>);
```

---

## 📊 성과 지표 (KPIs)

### 추적할 지표
1. **K-Factor (바이럴 계수)**
   - 목표: K > 1 (자가 성장)
   - 계산: (총 추천 수) / (총 사용자 수)

2. **CAC (고객 획득 비용)**
   - 이전: $3-5/user (광고)
   - 목표: $0.04/user (추천 보상 비용)

3. **추천 전환율**
   - 추천 링크 클릭 → 가입 비율
   - 목표: 30%+

4. **활성 추천인 비율**
   - 1명 이상 초대한 사용자 / 전체 사용자
   - 목표: 20%+

5. **평균 추천 수**
   - 추천인당 평균 초대 수
   - 목표: 3+

---

## 🚀 다음 단계

### 추가 개선 아이디어
1. **시즌별 이벤트**
   - 특정 기간 동안 보상 2배
   - 리더보드 이벤트

2. **추천 목표 설정**
   - "이번 주 3명 초대하면 +50 크레딧"

3. **소셜 증명**
   - "이미 1,234명이 친구를 초대했습니다!"

4. **추천 리더보드**
   - `/leaderboard` 명령어
   - Top 10 추천인 표시

5. **VIP 전용 혜택**
   - 50명 달성 시 특별 템플릿 제공
   - 우선 처리 큐

---

*최종 수정: 2025-01-10*
*작성자: Claude Code*
