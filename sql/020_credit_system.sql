-- ============================================================================
-- Credit System Database Schema
-- ============================================================================
-- Phase 1 MVP: User credits, transactions, packages, plans, group trials
-- Created: 2025-01-08
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. users: 기본 유저 테이블 (없을 경우 생성)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,                -- Telegram user ID
  username VARCHAR(255),                -- Telegram username (@username)
  first_name VARCHAR(255),              -- First name
  last_name VARCHAR(255),               -- Last name
  language_code VARCHAR(10),            -- Language preference (e.g., 'ko', 'en')
  is_premium BOOLEAN DEFAULT false,     -- Telegram Premium user
  is_bot BOOLEAN DEFAULT false,         -- Is this user a bot?

  -- Activity tracking
  last_active_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();

-- ----------------------------------------------------------------------------
-- 1. user_credits: 유저별 크레딧 잔액 및 구독 정보
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_credits (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),

  -- 크레딧 잔액
  free_credits INT DEFAULT 5,           -- 무료 크레딧 (신규 가입 시 지급)
  paid_credits INT DEFAULT 0,           -- 충전 크레딧
  subscription_credits INT DEFAULT 0,   -- 구독 크레딧 (-1 = 무제한, 실제로는 사용 안 함)

  -- 사용 통계
  total_used INT DEFAULT 0,             -- 총 사용량
  total_purchased INT DEFAULT 0,        -- 총 구매량

  -- 구독 정보
  subscription_type VARCHAR(50),        -- 'light', 'basic', 'pro', 'enterprise', null
  subscription_status VARCHAR(20),      -- 'active', 'cancelled', 'expired', null
  subscription_start_date TIMESTAMP,
  subscription_end_date TIMESTAMP,
  subscription_telegram_id VARCHAR(100), -- Telegram subscription ID

  -- 타임스탬프
  last_credit_purchase TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_credits_subscription ON user_credits(subscription_type, subscription_status);

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_user_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_user_credits_updated_at();

-- ----------------------------------------------------------------------------
-- 2. credit_transactions: 크레딧 거래 기록
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_transactions (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),

  -- 트랜잭션 정보
  transaction_type VARCHAR(20) NOT NULL,  -- 'purchase', 'usage', 'refund', 'bonus', 'signup'
  credit_type VARCHAR(20) NOT NULL,       -- 'free', 'paid', 'subscription'
  amount INT NOT NULL,                    -- 양수: 충전, 음수: 사용

  -- 잔액 (트랜잭션 후)
  balance_after INT NOT NULL,

  -- 결제 관련 (purchase인 경우)
  payment_provider VARCHAR(50),           -- 'telegram_stars'
  payment_amount DECIMAL(10, 2),          -- Stars 금액
  payment_currency VARCHAR(10),           -- 'XTR'
  payment_telegram_charge_id VARCHAR(100), -- Telegram charge ID
  package_key VARCHAR(50),                -- 구매한 패키지 키

  -- 사용 관련 (usage인 경우)
  related_template_key VARCHAR(100),
  related_edit_id INT,                    -- image_edit_results FK (soft reference)

  -- 메타데이터
  description TEXT,
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_date ON credit_transactions(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. credit_packages: 크레딧 패키지 정보
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_packages (
  id SERIAL PRIMARY KEY,
  package_key VARCHAR(50) UNIQUE NOT NULL,  -- 'starter', 'popular', 'value', 'mega'
  package_name_ko VARCHAR(100) NOT NULL,
  package_name_en VARCHAR(100),

  -- 패키지 상세
  credits INT NOT NULL,
  price_stars INT NOT NULL,
  bonus_credits INT DEFAULT 0,            -- 추가 보너스 (프로모션용)

  -- 마케팅
  is_popular BOOLEAN DEFAULT false,
  discount_percentage INT DEFAULT 0,
  badge VARCHAR(20),                      -- 'NEW', 'BEST', 'HOT', null

  -- 상태
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 새로운 가격표 삽입 (실제 비용 $0.002 반영)
INSERT INTO credit_packages (package_key, package_name_ko, package_name_en, credits, price_stars, is_popular, badge, display_order)
VALUES
  ('starter', '스타터 팩', 'Starter Pack', 30, 100, false, null, 1),
  ('popular', '인기 팩', 'Popular Pack', 80, 200, true, 'BEST', 2),
  ('value', '가치 팩', 'Value Pack', 250, 500, false, null, 3),
  ('mega', '메가 팩', 'Mega Pack', 600, 1000, false, 'HOT', 4)
ON CONFLICT (package_key) DO UPDATE SET
  package_name_ko = EXCLUDED.package_name_ko,
  credits = EXCLUDED.credits,
  price_stars = EXCLUDED.price_stars,
  is_popular = EXCLUDED.is_popular,
  badge = EXCLUDED.badge,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 4. subscription_plans: 구독 플랜 정보
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  plan_key VARCHAR(50) UNIQUE NOT NULL,  -- 'light', 'basic', 'pro', 'enterprise'
  plan_name_ko VARCHAR(100) NOT NULL,
  plan_name_en VARCHAR(100),

  -- 플랜 상세
  credits_per_month INT NOT NULL,        -- 월간 크레딧 (-1 = unlimited, 사용 안 함)
  price_stars INT NOT NULL,
  billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly'

  -- 혜택
  features JSONB,                        -- {"priority_processing": true, "no_watermark": true}
  description_ko TEXT,
  description_en TEXT,

  -- 마케팅
  is_popular BOOLEAN DEFAULT false,
  badge VARCHAR(20),                     -- 'BEST', 'NEW', null

  -- 상태
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 새로운 구독 플랜 삽입 (무제한 폐지)
INSERT INTO subscription_plans (plan_key, plan_name_ko, plan_name_en, credits_per_month, price_stars, is_popular, badge, display_order)
VALUES
  ('light', '라이트 플랜', 'Light Plan', 30, 99, false, null, 1),
  ('basic', '베이직 플랜', 'Basic Plan', 100, 249, true, 'BEST', 2),
  ('pro', '프로 플랜', 'Pro Plan', 300, 599, false, null, 3),
  ('enterprise', '엔터프라이즈', 'Enterprise', 1000, 1599, false, 'PRO', 4)
ON CONFLICT (plan_key) DO UPDATE SET
  plan_name_ko = EXCLUDED.plan_name_ko,
  credits_per_month = EXCLUDED.credits_per_month,
  price_stars = EXCLUDED.price_stars,
  is_popular = EXCLUDED.is_popular,
  badge = EXCLUDED.badge,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 5. group_free_trials: 그룹별 무료 체험 기록 (FOMO 전략)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_free_trials (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  group_id BIGINT NOT NULL,              -- Telegram group chat ID

  -- 체험 정보
  template_key VARCHAR(100),             -- 사용한 템플릿
  used_at TIMESTAMP DEFAULT NOW(),

  -- 전환 추적
  converted_to_paid BOOLEAN DEFAULT false,
  converted_at TIMESTAMP,

  -- 유니크 제약: 한 그룹에서 한 유저는 1회만
  UNIQUE(user_id, group_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_group_free_trials_user ON group_free_trials(user_id);
CREATE INDEX IF NOT EXISTS idx_group_free_trials_group ON group_free_trials(group_id);
CREATE INDEX IF NOT EXISTS idx_group_free_trials_converted ON group_free_trials(converted_to_paid);

-- ----------------------------------------------------------------------------
-- 뷰: 유저별 총 크레딧 조회
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_user_total_credits AS
SELECT
  user_id,
  free_credits,
  paid_credits,
  subscription_credits,
  (free_credits + paid_credits + COALESCE(NULLIF(subscription_credits, -1), 0)) AS total_credits,
  subscription_type,
  subscription_status
FROM user_credits;

-- ----------------------------------------------------------------------------
-- 함수: 크레딧 차감 (트랜잭션 안전)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deduct_credit(
  p_user_id BIGINT,
  p_amount INT,
  p_template_key VARCHAR(100) DEFAULT NULL,
  p_edit_id INT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  remaining_credits INT,
  message TEXT
) AS $$
DECLARE
  v_free_credits INT;
  v_paid_credits INT;
  v_subscription_credits INT;
  v_total INT;
  v_balance_after INT;
BEGIN
  -- 1. 현재 크레딧 조회 (FOR UPDATE로 Lock)
  SELECT
    uc.free_credits,
    uc.paid_credits,
    uc.subscription_credits
  INTO v_free_credits, v_paid_credits, v_subscription_credits
  FROM user_credits uc
  WHERE uc.user_id = p_user_id
  FOR UPDATE;

  -- 2. 유저 크레딧 없으면 실패
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'User credits not found';
    RETURN;
  END IF;

  -- 3. 총 크레딧 계산
  v_total := v_free_credits + v_paid_credits;

  -- 4. 크레딧 부족 체크
  IF v_total < p_amount THEN
    RETURN QUERY SELECT false, v_total, 'Insufficient credits';
    RETURN;
  END IF;

  -- 5. 차감 (무료 크레딧 우선 사용)
  IF v_free_credits >= p_amount THEN
    -- 무료 크레딧만으로 충분
    UPDATE user_credits
    SET
      free_credits = free_credits - p_amount,
      total_used = total_used + p_amount,
      updated_at = NOW()
    WHERE user_id = p_user_id;

    v_balance_after := v_free_credits - p_amount + v_paid_credits;

    -- 거래 기록
    INSERT INTO credit_transactions (user_id, transaction_type, credit_type, amount, balance_after, related_template_key, related_edit_id, description)
    VALUES (p_user_id, 'usage', 'free', -p_amount, v_balance_after, p_template_key, p_edit_id, 'Image edit usage');

  ELSE
    -- 무료 크레딧 + 충전 크레딧 사용
    DECLARE
      v_from_free INT := v_free_credits;
      v_from_paid INT := p_amount - v_free_credits;
    BEGIN
      UPDATE user_credits
      SET
        free_credits = 0,
        paid_credits = paid_credits - v_from_paid,
        total_used = total_used + p_amount,
        updated_at = NOW()
      WHERE user_id = p_user_id;

      v_balance_after := v_paid_credits - v_from_paid;

      -- 거래 기록 (2개: free + paid)
      IF v_from_free > 0 THEN
        INSERT INTO credit_transactions (user_id, transaction_type, credit_type, amount, balance_after, related_template_key, related_edit_id, description)
        VALUES (p_user_id, 'usage', 'free', -v_from_free, v_balance_after + v_from_paid, p_template_key, p_edit_id, 'Image edit usage (free credits)');
      END IF;

      INSERT INTO credit_transactions (user_id, transaction_type, credit_type, amount, balance_after, related_template_key, related_edit_id, description)
      VALUES (p_user_id, 'usage', 'paid', -v_from_paid, v_balance_after, p_template_key, p_edit_id, 'Image edit usage (paid credits)');
    END;
  END IF;

  -- 6. 성공 반환
  RETURN QUERY SELECT true, v_balance_after, 'Credits deducted successfully';
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 함수: 크레딧 충전
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id BIGINT,
  p_amount INT,
  p_credit_type VARCHAR(20),
  p_description TEXT DEFAULT NULL,
  p_package_key VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  new_balance INT,
  message TEXT
) AS $$
DECLARE
  v_new_balance INT;
BEGIN
  -- 1. 크레딧 추가
  IF p_credit_type = 'free' THEN
    UPDATE user_credits
    SET
      free_credits = free_credits + p_amount,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_credit_type = 'paid' THEN
    UPDATE user_credits
    SET
      paid_credits = paid_credits + p_amount,
      total_purchased = total_purchased + p_amount,
      last_credit_purchase = NOW(),
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    RETURN QUERY SELECT false, 0, 'Invalid credit type';
    RETURN;
  END IF;

  -- 2. 새 잔액 조회
  SELECT (free_credits + paid_credits) INTO v_new_balance
  FROM user_credits
  WHERE user_id = p_user_id;

  -- 3. 거래 기록
  INSERT INTO credit_transactions (user_id, transaction_type, credit_type, amount, balance_after, package_key, description)
  VALUES (p_user_id, 'purchase', p_credit_type, p_amount, v_new_balance, p_package_key, p_description);

  -- 4. 성공 반환
  RETURN QUERY SELECT true, v_new_balance, 'Credits added successfully';
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 완료!
-- ----------------------------------------------------------------------------
-- Phase 1 MVP 데이터베이스 스키마 생성 완료
-- 다음: Auth Service, Credit Manager 구현
-- ----------------------------------------------------------------------------
