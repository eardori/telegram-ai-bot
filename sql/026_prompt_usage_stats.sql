-- =====================================================
-- Prompt Usage Statistics System
-- =====================================================
-- Purpose: Track template usage, success rate, and performance
-- Date: 2025-01-10
-- Author: Claude Code
-- Dependencies: credit_transactions, template_feedback

-- =====================================================
-- 1. Prompt Usage Statistics View
-- =====================================================

CREATE OR REPLACE VIEW v_prompt_usage_stats AS
WITH usage_data AS (
  SELECT
    ct.template_key,
    COUNT(*) as total_uses,
    MAX(ct.created_at) as last_used_at,
    MIN(ct.created_at) as first_used_at
  FROM credit_transactions ct
  WHERE ct.transaction_type = 'usage'
    AND ct.template_key IS NOT NULL
  GROUP BY ct.template_key
),
feedback_data AS (
  SELECT
    template_key,
    COUNT(*) as total_feedback,
    COUNT(CASE WHEN satisfied = true THEN 1 END) as positive_feedback,
    ROUND(
      COUNT(CASE WHEN satisfied = true THEN 1 END)::DECIMAL / COUNT(*) * 100,
      2
    ) as satisfaction_rate
  FROM template_feedback
  GROUP BY template_key
)
SELECT
  pt.template_key,
  pt.template_name_ko as template_name,
  pt.category,
  pt.is_active,

  -- Usage statistics
  COALESCE(ud.total_uses, 0) as total_uses,

  -- Feedback
  COALESCE(fd.total_feedback, 0) as total_feedback,
  COALESCE(fd.positive_feedback, 0) as positive_feedback,
  COALESCE(fd.satisfaction_rate, 0) as satisfaction_rate,

  -- Timestamps
  ud.last_used_at,
  ud.first_used_at,
  pt.created_at as template_created_at

FROM prompt_templates pt
LEFT JOIN usage_data ud ON pt.template_key = ud.template_key
LEFT JOIN feedback_data fd ON pt.template_key = fd.template_key

ORDER BY COALESCE(ud.total_uses, 0) DESC;

-- =====================================================
-- 2. Recent Usage View (Last 7 Days)
-- =====================================================

CREATE OR REPLACE VIEW v_recent_prompt_usage AS
SELECT
  ct.template_key,
  pt.template_name_ko as template_name,
  COUNT(*) as uses_last_7d
FROM credit_transactions ct
LEFT JOIN prompt_templates pt ON ct.template_key = pt.template_key
WHERE
  ct.transaction_type = 'usage'
  AND ct.created_at >= NOW() - INTERVAL '7 days'
  AND ct.template_key IS NOT NULL
GROUP BY ct.template_key, pt.template_name_ko
ORDER BY uses_last_7d DESC;

-- =====================================================
-- 3. Function: Get Detailed Template Stats
-- =====================================================

CREATE OR REPLACE FUNCTION get_template_stats(
  p_template_key TEXT,
  p_days INT DEFAULT 30
)
RETURNS TABLE (
  -- Basic info
  template_key TEXT,
  template_name TEXT,
  category TEXT,
  is_active BOOLEAN,

  -- Overall stats
  total_uses BIGINT,
  total_feedback BIGINT,

  -- Recent stats (p_days)
  recent_uses BIGINT,
  recent_feedback BIGINT,

  -- Success rate (placeholder - will be NULL)
  success_rate NUMERIC,
  recent_success_rate NUMERIC,

  -- Satisfaction
  satisfaction_rate NUMERIC,
  recent_satisfaction_rate NUMERIC,

  -- Performance (placeholder - will be NULL)
  avg_processing_time_ms NUMERIC,
  recent_avg_processing_time_ms NUMERIC,

  -- Timestamps
  first_used_at TIMESTAMP,
  last_used_at TIMESTAMP,
  last_feedback_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  WITH overall_stats AS (
    SELECT
      COUNT(*) as total,
      MIN(ct.created_at) as first_use,
      MAX(ct.created_at) as last_use
    FROM credit_transactions ct
    WHERE ct.template_key = p_template_key
      AND ct.transaction_type = 'usage'
  ),
  recent_stats AS (
    SELECT
      COUNT(*) as total
    FROM credit_transactions ct
    WHERE ct.template_key = p_template_key
      AND ct.transaction_type = 'usage'
      AND ct.created_at >= NOW() - (p_days || ' days')::INTERVAL
  ),
  feedback_stats AS (
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN satisfied = true THEN 1 END) as positive,
      MAX(created_at) as last_feedback
    FROM template_feedback
    WHERE template_key = p_template_key
  ),
  recent_feedback_stats AS (
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN satisfied = true THEN 1 END) as positive
    FROM template_feedback
    WHERE template_key = p_template_key
      AND created_at >= NOW() - (p_days || ' days')::INTERVAL
  )
  SELECT
    pt.template_key,
    pt.template_name_ko,
    pt.category,
    pt.is_active,

    -- Overall
    os.total,
    fs.total,

    -- Recent
    rs.total,
    rfs.total,

    -- Success rates (NULL for now - no success tracking in credit_transactions)
    NULL::NUMERIC,
    NULL::NUMERIC,

    -- Satisfaction rates
    CASE WHEN fs.total > 0 THEN
      ROUND(fs.positive::DECIMAL / fs.total * 100, 2)
    ELSE NULL END,
    CASE WHEN rfs.total > 0 THEN
      ROUND(rfs.positive::DECIMAL / rfs.total * 100, 2)
    ELSE NULL END,

    -- Performance (NULL for now - no processing time in credit_transactions)
    NULL::NUMERIC,
    NULL::NUMERIC,

    -- Timestamps
    os.first_use,
    os.last_use,
    fs.last_feedback

  FROM prompt_templates pt
  CROSS JOIN overall_stats os
  CROSS JOIN recent_stats rs
  CROSS JOIN feedback_stats fs
  CROSS JOIN recent_feedback_stats rfs
  WHERE pt.template_key = p_template_key;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. Function: Get Popular Templates
-- =====================================================

CREATE OR REPLACE FUNCTION get_popular_templates(
  p_days INT DEFAULT 7,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  rank INT,
  template_key TEXT,
  template_name TEXT,
  uses BIGINT,
  satisfaction_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH usage_counts AS (
    SELECT
      ct.template_key,
      pt.template_name_ko,
      COUNT(*) as use_count
    FROM credit_transactions ct
    LEFT JOIN prompt_templates pt ON ct.template_key = pt.template_key
    WHERE ct.transaction_type = 'usage'
      AND ct.created_at >= NOW() - (p_days || ' days')::INTERVAL
      AND ct.template_key IS NOT NULL
    GROUP BY ct.template_key, pt.template_name_ko
  ),
  feedback_rates AS (
    SELECT
      template_key,
      ROUND(
        COUNT(CASE WHEN satisfied = true THEN 1 END)::DECIMAL / COUNT(*) * 100,
        2
      ) as sat_rate
    FROM template_feedback
    WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY template_key
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY uc.use_count DESC)::INT,
    uc.template_key,
    uc.template_name_ko,
    uc.use_count,
    COALESCE(fr.sat_rate, 0)
  FROM usage_counts uc
  LEFT JOIN feedback_rates fr ON uc.template_key = fr.template_key
  ORDER BY uc.use_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Verification Queries
-- =====================================================

-- Check overall stats view
SELECT * FROM v_prompt_usage_stats LIMIT 5;

-- Check recent usage view
SELECT * FROM v_recent_prompt_usage LIMIT 5;

-- Check detailed stats function
SELECT * FROM get_template_stats('pixar_3d', 30);

-- Check popular templates function
SELECT * FROM get_popular_templates(7, 10);

-- =====================================================
-- End of Prompt Usage Statistics Schema
-- =====================================================
