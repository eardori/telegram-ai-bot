-- =============================================================================
-- Version Management Schema (Fixed for Supabase)
-- Version: 1.0.1
-- Description: Database schema for tracking bot versions and git commit history
-- Created: 2025-09-14
-- Fixed: Added IF NOT EXISTS and removed problematic COMMENT statements
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing objects if needed (optional - uncomment if you want to recreate)
-- DROP TABLE IF EXISTS config_history CASCADE;
-- DROP TABLE IF EXISTS feature_changes CASCADE;
-- DROP TABLE IF EXISTS version_history CASCADE;

-- Version History Table
-- Stores bot version information and git commit data
CREATE TABLE IF NOT EXISTS version_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Version information
    version_number VARCHAR(50) NOT NULL, -- e.g., "1.0.0", "1.1.0-beta"
    commit_hash VARCHAR(64) NOT NULL UNIQUE, -- Full git commit hash
    commit_hash_short VARCHAR(12) NOT NULL, -- Short commit hash (first 7-12 chars)

    -- Commit details
    commit_message TEXT NOT NULL,
    commit_author_name VARCHAR(255) NOT NULL,
    commit_author_email VARCHAR(255),
    commit_date TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Change information
    changes_description TEXT, -- Detailed description of changes
    features_added TEXT[], -- Array of new features
    bugs_fixed TEXT[], -- Array of bug fixes
    breaking_changes TEXT[], -- Array of breaking changes

    -- Release information
    is_release BOOLEAN DEFAULT false, -- Is this a tagged release?
    is_prerelease BOOLEAN DEFAULT false, -- Is this a pre-release (beta, alpha, etc)?
    release_notes TEXT, -- Formatted release notes

    -- Deployment information
    deployed_at TIMESTAMP WITH TIME ZONE, -- When this version was deployed
    deployment_environment VARCHAR(50) DEFAULT 'production', -- 'production', 'staging', 'development'

    -- File change statistics
    files_changed INTEGER DEFAULT 0,
    lines_added INTEGER DEFAULT 0,
    lines_deleted INTEGER DEFAULT 0,

    -- Status and metadata
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'archived', 'deprecated'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_deployment_environment CHECK (
        deployment_environment IN ('production', 'staging', 'development')
    ),
    CONSTRAINT valid_status CHECK (
        status IN ('active', 'archived', 'deprecated')
    )
);

-- Feature Changes Table
-- Stores individual feature changes for each version
CREATE TABLE IF NOT EXISTS feature_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES version_history(id) ON DELETE CASCADE,

    -- Change information
    change_type VARCHAR(50) NOT NULL, -- 'feature', 'bugfix', 'enhancement', 'breaking', 'security'
    change_category VARCHAR(100), -- e.g., 'UI', 'API', 'Database', 'Bot Commands'
    change_title VARCHAR(500) NOT NULL,
    change_description TEXT,

    -- Impact assessment
    impact_level VARCHAR(20) DEFAULT 'minor', -- 'minor', 'moderate', 'major', 'critical'
    affected_components TEXT[], -- Array of affected components

    -- Related information
    related_issue_id VARCHAR(100), -- GitHub issue ID if applicable
    related_pr_id VARCHAR(100), -- GitHub PR ID if applicable

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_change_type CHECK (
        change_type IN ('feature', 'bugfix', 'enhancement', 'breaking', 'security')
    ),
    CONSTRAINT valid_impact_level CHECK (
        impact_level IN ('minor', 'moderate', 'major', 'critical')
    )
);

-- Configuration History Table
-- Stores configuration and environment changes
CREATE TABLE IF NOT EXISTS config_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID REFERENCES version_history(id) ON DELETE CASCADE,

    -- Configuration details
    config_type VARCHAR(100) NOT NULL, -- 'environment_variable', 'api_key', 'feature_flag', 'database_setting'
    config_key VARCHAR(255) NOT NULL,
    old_value TEXT, -- Previous value (encrypted/masked for sensitive data)
    new_value TEXT, -- New value (encrypted/masked for sensitive data)

    -- Change metadata
    changed_by VARCHAR(255),
    change_reason TEXT,
    is_sensitive BOOLEAN DEFAULT false, -- Whether this contains sensitive data

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_config_type CHECK (
        config_type IN ('environment_variable', 'api_key', 'feature_flag', 'database_setting')
    )
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_version_history_commit_hash ON version_history(commit_hash);
CREATE INDEX IF NOT EXISTS idx_version_history_version_number ON version_history(version_number);
CREATE INDEX IF NOT EXISTS idx_version_history_commit_date ON version_history(commit_date DESC);
CREATE INDEX IF NOT EXISTS idx_version_history_deployed_at ON version_history(deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_version_history_status ON version_history(status);

CREATE INDEX IF NOT EXISTS idx_feature_changes_version_id ON feature_changes(version_id);
CREATE INDEX IF NOT EXISTS idx_feature_changes_change_type ON feature_changes(change_type);
CREATE INDEX IF NOT EXISTS idx_feature_changes_impact_level ON feature_changes(impact_level);

CREATE INDEX IF NOT EXISTS idx_config_history_version_id ON config_history(version_id);
CREATE INDEX IF NOT EXISTS idx_config_history_config_type ON config_history(config_type);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to get version history with pagination
CREATE OR REPLACE FUNCTION get_version_history(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    version_number VARCHAR,
    commit_hash_short VARCHAR,
    commit_message TEXT,
    commit_author_name VARCHAR,
    commit_date TIMESTAMP WITH TIME ZONE,
    deployed_at TIMESTAMP WITH TIME ZONE,
    features_count BIGINT,
    bugs_count BIGINT,
    is_release BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vh.version_number,
        vh.commit_hash_short,
        vh.commit_message,
        vh.commit_author_name,
        vh.commit_date,
        vh.deployed_at,
        COALESCE(array_length(vh.features_added, 1), 0)::BIGINT as features_count,
        COALESCE(array_length(vh.bugs_fixed, 1), 0)::BIGINT as bugs_count,
        vh.is_release
    FROM version_history vh
    WHERE vh.status = 'active'
    ORDER BY vh.commit_date DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get the latest deployed version
CREATE OR REPLACE FUNCTION get_latest_version()
RETURNS TABLE (
    version_number VARCHAR,
    commit_hash_short VARCHAR,
    deployed_at TIMESTAMP WITH TIME ZONE,
    deployment_environment VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vh.version_number,
        vh.commit_hash_short,
        vh.deployed_at,
        vh.deployment_environment
    FROM version_history vh
    WHERE vh.deployed_at IS NOT NULL
        AND vh.status = 'active'
    ORDER BY vh.deployed_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to record a new version
CREATE OR REPLACE FUNCTION record_new_version(
    p_version_number VARCHAR,
    p_commit_hash VARCHAR,
    p_commit_message TEXT,
    p_commit_author_name VARCHAR,
    p_commit_author_email VARCHAR DEFAULT NULL,
    p_commit_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    p_features_added TEXT[] DEFAULT '{}',
    p_bugs_fixed TEXT[] DEFAULT '{}',
    p_is_release BOOLEAN DEFAULT false,
    p_deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_version_id UUID;
BEGIN
    INSERT INTO version_history (
        version_number,
        commit_hash,
        commit_hash_short,
        commit_message,
        commit_author_name,
        commit_author_email,
        commit_date,
        features_added,
        bugs_fixed,
        is_release,
        deployed_at
    ) VALUES (
        p_version_number,
        p_commit_hash,
        LEFT(p_commit_hash, 7),
        p_commit_message,
        p_commit_author_name,
        p_commit_author_email,
        p_commit_date,
        p_features_added,
        p_bugs_fixed,
        p_is_release,
        p_deployed_at
    ) RETURNING id INTO v_version_id;

    RETURN v_version_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get version statistics
CREATE OR REPLACE FUNCTION get_version_stats(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    total_versions BIGINT,
    total_releases BIGINT,
    total_features BIGINT,
    total_bugs_fixed BIGINT,
    avg_files_changed NUMERIC,
    avg_lines_added NUMERIC,
    avg_lines_deleted NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_versions,
        COUNT(*) FILTER (WHERE is_release = true)::BIGINT as total_releases,
        COALESCE(SUM(array_length(features_added, 1)), 0)::BIGINT as total_features,
        COALESCE(SUM(array_length(bugs_fixed, 1)), 0)::BIGINT as total_bugs_fixed,
        AVG(files_changed)::NUMERIC as avg_files_changed,
        AVG(lines_added)::NUMERIC as avg_lines_added,
        AVG(lines_deleted)::NUMERIC as avg_lines_deleted
    FROM version_history
    WHERE commit_date BETWEEN start_date AND end_date
        AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Recent Versions View
CREATE OR REPLACE VIEW recent_versions AS
SELECT
    vh.version_number,
    vh.commit_hash_short,
    vh.commit_message,
    vh.commit_author_name,
    vh.commit_date,
    vh.deployed_at,
    vh.is_release,
    COALESCE(array_length(vh.features_added, 1), 0) as features_count,
    COALESCE(array_length(vh.bugs_fixed, 1), 0) as bugs_count,
    vh.deployment_environment
FROM version_history vh
WHERE vh.commit_date > NOW() - INTERVAL '30 days'
    AND vh.status = 'active'
ORDER BY vh.commit_date DESC;

-- Release Versions View
CREATE OR REPLACE VIEW release_versions AS
SELECT
    vh.version_number,
    vh.commit_hash_short,
    vh.commit_message,
    vh.release_notes,
    vh.commit_date,
    vh.deployed_at,
    vh.features_added,
    vh.bugs_fixed,
    vh.breaking_changes
FROM version_history vh
WHERE vh.is_release = true
    AND vh.status = 'active'
ORDER BY vh.commit_date DESC;

-- =============================================================================
-- INITIAL SEED DATA
-- =============================================================================

-- Insert initial version (current production version)
INSERT INTO version_history (
    version_number,
    commit_hash,
    commit_hash_short,
    commit_message,
    commit_author_name,
    commit_author_email,
    commit_date,
    features_added,
    bugs_fixed,
    is_release,
    deployed_at,
    deployment_environment,
    release_notes
) VALUES (
    '2.0.0',
    'b3854bf1234567890abcdef1234567890abcdef',
    'b3854bf',
    'feat: Complete bot upgrade with version management',
    'System',
    'bot@telegram.com',
    NOW(),
    ARRAY[
        'Version management system',
        'Help command enhancement',
        'Natural language help triggers',
        'Photo analysis with Gemini Vision',
        'Cost tracking for all LLM calls',
        'Enhanced timeout handling',
        'Chat tracking and summarization'
    ],
    ARRAY[
        'Fixed bot responding without Dobby keyword',
        'Fixed timeout issues for image generation',
        'Fixed database column errors'
    ],
    true,
    NOW(),
    'production',
    'Major release with comprehensive feature upgrades including version management, improved help system, and enhanced AI capabilities.'
) ON CONFLICT (commit_hash) DO NOTHING;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Version management schema created successfully!';
    RAISE NOTICE 'Tables created: version_history, feature_changes, config_history';
    RAISE NOTICE 'Functions created: get_version_history, get_latest_version, record_new_version, get_version_stats';
    RAISE NOTICE 'Views created: recent_versions, release_versions';
    RAISE NOTICE 'Initial version 2.0.0 has been recorded';
END $$;