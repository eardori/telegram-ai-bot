-- =====================================================
-- User Feedback System
-- =====================================================
-- Purpose: Collect user satisfaction ratings for each template
-- Date: 2025-01-10
-- Author: Claude Code

-- =====================================================
-- 1. Template Feedback Table
-- =====================================================

CREATE TABLE IF NOT EXISTS template_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  template_key TEXT NOT NULL,
  template_name TEXT NOT NULL,

  -- Feedback
  satisfied BOOLEAN NOT NULL, -- true = 👍, false = 👎
  feedback_reason TEXT, -- Optional: why they're dissatisfied

  -- Context
  edit_result_id BIGINT, -- Link to image_edit_results if available
  processing_time_ms INT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_template_feedback_template_key
  ON template_feedback(template_key);

CREATE INDEX IF NOT EXISTS idx_template_feedback_user_id
  ON template_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_template_feedback_created_at
  ON template_feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_template_feedback_satisfied
  ON template_feedback(satisfied);

-- =====================================================
-- 2. Feedback Statistics View
-- =====================================================

CREATE OR REPLACE VIEW v_template_feedback_stats AS
SELECT
  template_key,
  template_name,
  COUNT(*) as total_feedback,
  COUNT(CASE WHEN satisfied = true THEN 1 END) as positive_count,
  COUNT(CASE WHEN satisfied = false THEN 1 END) as negative_count,
  ROUND(
    COUNT(CASE WHEN satisfied = true THEN 1 END)::DECIMAL / COUNT(*) * 100,
    2
  ) as satisfaction_rate,
  MAX(created_at) as last_feedback_at
FROM template_feedback
GROUP BY template_key, template_name
ORDER BY total_feedback DESC;

-- =====================================================
-- 3. Recent Feedback View (Last 7 Days)
-- =====================================================

CREATE OR REPLACE VIEW v_recent_feedback_stats AS
SELECT
  template_key,
  template_name,
  COUNT(*) as total_feedback,
  COUNT(CASE WHEN satisfied = true THEN 1 END) as positive_count,
  COUNT(CASE WHEN satisfied = false THEN 1 END) as negative_count,
  ROUND(
    COUNT(CASE WHEN satisfied = true THEN 1 END)::DECIMAL / COUNT(*) * 100,
    2
  ) as satisfaction_rate
FROM template_feedback
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY template_key, template_name
HAVING COUNT(*) >= 3 -- At least 3 feedback entries
ORDER BY satisfaction_rate ASC; -- Low satisfaction first

-- =====================================================
-- 4. Alert View: Templates with Low Satisfaction
-- =====================================================

CREATE OR REPLACE VIEW v_low_satisfaction_alerts AS
SELECT
  template_key,
  template_name,
  total_feedback,
  negative_count,
  satisfaction_rate,
  last_feedback_at
FROM v_template_feedback_stats
WHERE
  total_feedback >= 10 -- At least 10 feedback entries
  AND satisfaction_rate < 50 -- Less than 50% satisfied
ORDER BY satisfaction_rate ASC;

-- =====================================================
-- 5. Function: Get Feedback Summary for Admin
-- =====================================================

CREATE OR REPLACE FUNCTION get_feedback_summary(
  p_days INT DEFAULT 7
)
RETURNS TABLE (
  template_key TEXT,
  template_name TEXT,
  total_feedback BIGINT,
  satisfaction_rate NUMERIC,
  trend TEXT -- 'improving', 'declining', 'stable'
) AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      tf.template_key,
      tf.template_name,
      COUNT(*) as total,
      ROUND(
        COUNT(CASE WHEN satisfied = true THEN 1 END)::DECIMAL / COUNT(*) * 100,
        2
      ) as rate
    FROM template_feedback tf
    WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY tf.template_key, tf.template_name
  ),
  previous AS (
    SELECT
      tf.template_key,
      ROUND(
        COUNT(CASE WHEN satisfied = true THEN 1 END)::DECIMAL / COUNT(*) * 100,
        2
      ) as prev_rate
    FROM template_feedback tf
    WHERE
      created_at >= NOW() - (p_days * 2 || ' days')::INTERVAL
      AND created_at < NOW() - (p_days || ' days')::INTERVAL
    GROUP BY tf.template_key
  )
  SELECT
    r.template_key,
    r.template_name,
    r.total,
    r.rate,
    CASE
      WHEN p.prev_rate IS NULL THEN 'new'
      WHEN r.rate > p.prev_rate + 10 THEN 'improving'
      WHEN r.rate < p.prev_rate - 10 THEN 'declining'
      ELSE 'stable'
    END as trend
  FROM recent r
  LEFT JOIN previous p ON r.template_key = p.template_key
  ORDER BY r.rate ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Insert Sample Data (for testing)
-- =====================================================

-- Uncomment to insert sample data
/*
INSERT INTO template_feedback (user_id, chat_id, template_key, template_name, satisfied)
VALUES
  (123456, 123456, 'pixar_3d', 'Pixar 3D', true),
  (123456, 123456, 'pixar_3d', 'Pixar 3D', true),
  (123456, 123456, 'pixar_3d', 'Pixar 3D', false),
  (123456, 123456, 'anime_style', 'Anime Style', true),
  (123456, 123456, 'anime_style', 'Anime Style', false),
  (123456, 123456, 'anime_style', 'Anime Style', false);
*/

-- =====================================================
-- 7. Verification Queries
-- =====================================================

-- Check table created
SELECT COUNT(*) as feedback_count FROM template_feedback;

-- Check views
SELECT * FROM v_template_feedback_stats LIMIT 5;

-- Check function
SELECT * FROM get_feedback_summary(7);

-- =====================================================
-- End of User Feedback System Schema
-- =====================================================
