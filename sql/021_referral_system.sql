-- ============================================================================
-- Referral System Database Schema
-- ============================================================================
-- 추천인 시스템: 바이럴 성장 및 CAC 절감
-- CAC: $3-5 → $0.04 (99% 절감)
-- Created: 2025-01-10
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. users 테이블에 referral_code 필드 추가
-- ----------------------------------------------------------------------------
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- ----------------------------------------------------------------------------
-- 2. referrals 테이블 확인 및 업데이트
-- ----------------------------------------------------------------------------
-- referrals 테이블이 이미 존재하는지 확인하고, 없으면 생성
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,

  -- 추천인 & 피추천인
  referrer_user_id BIGINT NOT NULL REFERENCES users(id),  -- 추천한 사람
  referred_user_id BIGINT NOT NULL REFERENCES users(id),  -- 추천받은 사람
  referral_code VARCHAR(20) NOT NULL,                     -- 사용된 추천 코드

  -- 보상 정보
  referrer_reward_credits INT DEFAULT 10,                 -- 추천인 보상
  referred_reward_credits INT DEFAULT 10,                 -- 피추천인 보상
  reward_granted BOOLEAN DEFAULT false,                   -- 보상 지급 여부
  reward_granted_at TIMESTAMP,

  -- 메타데이터
  created_at TIMESTAMP DEFAULT NOW(),

  -- 유니크 제약: 한 사람은 한 번만 추천받을 수 있음
  UNIQUE(referred_user_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. referral_milestones: 계단식 보너스 시스템
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_milestones (
  id SERIAL PRIMARY KEY,
  milestone_name VARCHAR(50) NOT NULL,
  required_referrals INT NOT NULL,
  bonus_credits INT NOT NULL,
  special_reward TEXT,                    -- VIP 혜택 등 특별 보상
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

-- 기본 마일스톤 데이터 삽입
INSERT INTO referral_milestones (milestone_name, required_referrals, bonus_credits, special_reward, display_order)
VALUES
  ('브론즈', 5, 20, null, 1),
  ('실버', 10, 50, null, 2),
  ('골드', 25, 150, null, 3),
  ('플래티넘', 50, 500, 'VIP 혜택 (우선 처리, 특별 템플릿)', 4)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. referral_milestone_achievements: 사용자별 마일스톤 달성 기록
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_milestone_achievements (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  milestone_id INT NOT NULL REFERENCES referral_milestones(id),

  -- 달성 정보
  achieved_at TIMESTAMP DEFAULT NOW(),
  bonus_credits_granted INT NOT NULL,
  special_reward_granted TEXT,

  -- 유니크 제약: 한 마일스톤은 한 번만 달성 가능
  UNIQUE(user_id, milestone_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_milestone_achievements_user ON referral_milestone_achievements(user_id);

-- ----------------------------------------------------------------------------
-- 5. 함수: 추천 코드 자동 생성
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  v_code VARCHAR(20);
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- MULTI + 5자리 랜덤 숫자 (예: MULTI12345)
    v_code := 'MULTI' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');

    -- 중복 체크
    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = v_code) INTO v_exists;

    -- 중복 아니면 반환
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 6. 트리거: 신규 가입 시 자동으로 referral_code 생성
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_user_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  -- referral_code가 없으면 자동 생성
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code = generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (INSERT 시에만)
DROP TRIGGER IF EXISTS trigger_set_referral_code ON users;
CREATE TRIGGER trigger_set_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_referral_code();

-- ----------------------------------------------------------------------------
-- 7. 함수: 추천 보상 지급
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION grant_referral_rewards(
  p_referrer_user_id BIGINT,
  p_referred_user_id BIGINT,
  p_referral_code VARCHAR(20)
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  referrer_credits INT,
  referred_credits INT
) AS $$
DECLARE
  v_referral_id INT;
  v_referrer_reward INT := 10;
  v_referred_reward INT := 10;
  v_referrer_new_balance INT;
  v_referred_new_balance INT;
BEGIN
  -- 1. referrals 테이블에 기록 생성
  INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, referrer_reward_credits, referred_reward_credits)
  VALUES (p_referrer_user_id, p_referred_user_id, p_referral_code, v_referrer_reward, v_referred_reward)
  RETURNING id INTO v_referral_id;

  -- 2. 추천인에게 크레딧 지급
  UPDATE user_credits
  SET free_credits = free_credits + v_referrer_reward,
      updated_at = NOW()
  WHERE user_id = p_referrer_user_id
  RETURNING (free_credits + paid_credits) INTO v_referrer_new_balance;

  -- 트랜잭션 기록
  INSERT INTO credit_transactions (user_id, transaction_type, credit_type, amount, balance_after, description)
  VALUES (p_referrer_user_id, 'bonus', 'free', v_referrer_reward, v_referrer_new_balance,
          '친구 추천 보상: ' || p_referred_user_id);

  -- 3. 피추천인에게 크레딧 지급
  UPDATE user_credits
  SET free_credits = free_credits + v_referred_reward,
      updated_at = NOW()
  WHERE user_id = p_referred_user_id
  RETURNING (free_credits + paid_credits) INTO v_referred_new_balance;

  -- 트랜잭션 기록
  INSERT INTO credit_transactions (user_id, transaction_type, credit_type, amount, balance_after, description)
  VALUES (p_referred_user_id, 'bonus', 'free', v_referred_reward, v_referred_new_balance,
          '추천 가입 보상 (추천인: ' || p_referrer_user_id || ')');

  -- 4. 보상 지급 표시
  UPDATE referrals
  SET reward_granted = true,
      reward_granted_at = NOW()
  WHERE id = v_referral_id;

  -- 5. 마일스톤 체크
  PERFORM check_referral_milestones(p_referrer_user_id);

  -- 6. 성공 반환
  RETURN QUERY SELECT
    true,
    '추천 보상 지급 완료',
    v_referrer_reward,
    v_referred_reward;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 8. 함수: 마일스톤 달성 체크
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_referral_milestones(p_user_id BIGINT)
RETURNS void AS $$
DECLARE
  v_referral_count INT;
  v_milestone RECORD;
  v_already_achieved BOOLEAN;
  v_new_balance INT;
BEGIN
  -- 1. 현재까지 추천한 친구 수 계산
  SELECT COUNT(*) INTO v_referral_count
  FROM referrals
  WHERE referrer_user_id = p_user_id
    AND reward_granted = true;

  -- 2. 달성 가능한 마일스톤 찾기
  FOR v_milestone IN
    SELECT * FROM referral_milestones
    WHERE required_referrals <= v_referral_count
      AND is_active = true
    ORDER BY required_referrals ASC
  LOOP
    -- 이미 달성했는지 체크
    SELECT EXISTS(
      SELECT 1 FROM referral_milestone_achievements
      WHERE user_id = p_user_id AND milestone_id = v_milestone.id
    ) INTO v_already_achieved;

    -- 아직 달성 안 했으면 보상 지급
    IF NOT v_already_achieved THEN
      -- 크레딧 지급
      UPDATE user_credits
      SET free_credits = free_credits + v_milestone.bonus_credits,
          updated_at = NOW()
      WHERE user_id = p_user_id
      RETURNING (free_credits + paid_credits) INTO v_new_balance;

      -- 트랜잭션 기록
      INSERT INTO credit_transactions (user_id, transaction_type, credit_type, amount, balance_after, description)
      VALUES (p_user_id, 'bonus', 'free', v_milestone.bonus_credits, v_new_balance,
              '마일스톤 달성: ' || v_milestone.milestone_name || ' (' || v_milestone.required_referrals || '명 추천)');

      -- 마일스톤 달성 기록
      INSERT INTO referral_milestone_achievements (user_id, milestone_id, bonus_credits_granted, special_reward_granted)
      VALUES (p_user_id, v_milestone.id, v_milestone.bonus_credits, v_milestone.special_reward);

      -- 로그 출력
      RAISE NOTICE '사용자 %가 마일스톤 "%" 달성! 보너스 % 크레딧 지급',
        p_user_id, v_milestone.milestone_name, v_milestone.bonus_credits;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 9. 뷰: 사용자별 추천 통계
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_user_referral_stats AS
SELECT
  u.id AS user_id,
  u.referral_code,
  COUNT(r.id) AS total_referrals,
  COUNT(CASE WHEN r.reward_granted THEN 1 END) AS rewarded_referrals,
  SUM(CASE WHEN r.reward_granted THEN r.referrer_reward_credits ELSE 0 END) AS total_earned_credits,
  MAX(r.created_at) AS last_referral_at,
  (
    SELECT COUNT(*) FROM referral_milestone_achievements
    WHERE user_id = u.id
  ) AS milestones_achieved
FROM users u
LEFT JOIN referrals r ON r.referrer_user_id = u.id
GROUP BY u.id, u.referral_code;

-- ----------------------------------------------------------------------------
-- 10. 기존 사용자에게 referral_code 일괄 생성
-- ----------------------------------------------------------------------------
-- 기존 사용자 중 referral_code가 없는 경우 생성
UPDATE users
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- ----------------------------------------------------------------------------
-- 완료!
-- ----------------------------------------------------------------------------
-- 추천인 시스템 데이터베이스 스키마 생성 완료
-- 다음: ReferralService 구현 및 Telegram 명령어 통합
-- ----------------------------------------------------------------------------
