-- =============================================================================
-- Version Management Schema
-- Version: 1.0.0
-- Description: Database schema for tracking bot versions and git commit history
-- Created: 2025-09-14
-- =============================================================================

-- Version History Table
-- Stores bot version information and git commit data
CREATE TABLE version_history (
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

    CONSTRAINT valid_deployment_env CHECK (deployment_environment IN ('production', 'staging', 'development')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'archived', 'deprecated'))
);

COMMENT ON TABLE version_history IS 'Version history and git commit tracking for the bot';
COMMENT ON COLUMN version_history.commit_hash IS 'Full SHA hash of the git commit';
COMMENT ON COLUMN version_history.features_added IS 'Array of new features in this version';
COMMENT ON COLUMN version_history.breaking_changes IS 'Array of breaking changes that require user attention';

-- Feature Change Log Table
-- Detailed tracking of individual feature changes
CREATE TABLE feature_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL, -- Links to version_history

    -- Feature information
    feature_name VARCHAR(255) NOT NULL,
    feature_type VARCHAR(50) NOT NULL, -- 'added', 'modified', 'deprecated', 'removed', 'fixed'
    feature_description TEXT NOT NULL,

    -- Impact assessment
    user_impact VARCHAR(50) DEFAULT 'minor', -- 'major', 'minor', 'patch'
    requires_user_action BOOLEAN DEFAULT false, -- Does user need to do something?
    user_action_description TEXT, -- What action is required?

    -- Related information
    related_commands TEXT[], -- Commands affected by this change
    documentation_updated BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    FOREIGN KEY (version_id) REFERENCES version_history(id) ON DELETE CASCADE,

    CONSTRAINT valid_feature_type CHECK (feature_type IN ('added', 'modified', 'deprecated', 'removed', 'fixed')),
    CONSTRAINT valid_user_impact CHECK (user_impact IN ('major', 'minor', 'patch'))
);

COMMENT ON TABLE feature_changes IS 'Detailed tracking of individual feature changes per version';
COMMENT ON COLUMN feature_changes.requires_user_action IS 'Whether users need to take action for this change';

-- Bot Configuration History Table
-- Track configuration changes over time
CREATE TABLE config_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL,

    -- Configuration details
    config_key VARCHAR(255) NOT NULL,
    config_value_old TEXT,
    config_value_new TEXT NOT NULL,
    change_reason TEXT,

    -- Change metadata
    changed_by VARCHAR(255), -- Who made the change
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    FOREIGN KEY (version_id) REFERENCES version_history(id) ON DELETE CASCADE
);

COMMENT ON TABLE config_history IS 'Track bot configuration changes across versions';

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Primary lookup indexes
CREATE INDEX idx_version_history_version ON version_history(version_number);
CREATE INDEX idx_version_history_commit ON version_history(commit_hash);
CREATE INDEX idx_version_history_date ON version_history(commit_date DESC);
CREATE INDEX idx_version_history_releases ON version_history(is_release, commit_date DESC) WHERE is_release = true;

-- Feature changes indexes
CREATE INDEX idx_feature_changes_version ON feature_changes(version_id);
CREATE INDEX idx_feature_changes_type ON feature_changes(feature_type);
CREATE INDEX idx_feature_changes_impact ON feature_changes(user_impact);

-- Config history indexes
CREATE INDEX idx_config_history_version ON config_history(version_id);
CREATE INDEX idx_config_history_key ON config_history(config_key);

-- =============================================================================
-- FUNCTIONS FOR VERSION MANAGEMENT
-- =============================================================================

-- Function to get the latest version information
CREATE OR REPLACE FUNCTION get_latest_version()
RETURNS TABLE(
    version_number VARCHAR(50),
    commit_hash_short VARCHAR(12),
    commit_message TEXT,
    commit_date TIMESTAMP WITH TIME ZONE,
    deployed_at TIMESTAMP WITH TIME ZONE,
    features_count INTEGER,
    fixes_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vh.version_number,
        vh.commit_hash_short,
        vh.commit_message,
        vh.commit_date,
        vh.deployed_at,
        array_length(vh.features_added, 1) as features_count,
        array_length(vh.bugs_fixed, 1) as fixes_count
    FROM version_history vh
    WHERE vh.status = 'active'
    ORDER BY vh.commit_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_latest_version() IS 'Get the latest active version information';

-- Function to get version history for display
CREATE OR REPLACE FUNCTION get_version_history(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
    version_number VARCHAR(50),
    commit_hash_short VARCHAR(12),
    commit_message TEXT,
    commit_date TIMESTAMP WITH TIME ZONE,
    features_added TEXT[],
    bugs_fixed TEXT[],
    is_release BOOLEAN,
    days_ago INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vh.version_number,
        vh.commit_hash_short,
        vh.commit_message,
        vh.commit_date,
        vh.features_added,
        vh.bugs_fixed,
        vh.is_release,
        (EXTRACT(EPOCH FROM (NOW() - vh.commit_date)) / 86400)::INTEGER as days_ago
    FROM version_history vh
    WHERE vh.status = 'active'
    ORDER BY vh.commit_date DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_version_history() IS 'Get paginated version history for display';

-- Function to parse and store git commit information
CREATE OR REPLACE FUNCTION store_git_commit(
    p_version_number VARCHAR(50),
    p_commit_hash VARCHAR(64),
    p_commit_message TEXT,
    p_author_name VARCHAR(255),
    p_author_email VARCHAR(255),
    p_commit_date TIMESTAMP WITH TIME ZONE,
    p_files_changed INTEGER DEFAULT 0,
    p_lines_added INTEGER DEFAULT 0,
    p_lines_deleted INTEGER DEFAULT 0,
    p_features_added TEXT[] DEFAULT '{}',
    p_bugs_fixed TEXT[] DEFAULT '{}',
    p_breaking_changes TEXT[] DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    version_id UUID;
    commit_hash_short VARCHAR(12);
BEGIN
    -- Extract short hash (first 12 characters)
    commit_hash_short := LEFT(p_commit_hash, 12);

    -- Insert version record
    INSERT INTO version_history (
        version_number,
        commit_hash,
        commit_hash_short,
        commit_message,
        commit_author_name,
        commit_author_email,
        commit_date,
        files_changed,
        lines_added,
        lines_deleted,
        features_added,
        bugs_fixed,
        breaking_changes,
        deployed_at
    ) VALUES (
        p_version_number,
        p_commit_hash,
        commit_hash_short,
        p_commit_message,
        p_author_name,
        p_author_email,
        p_commit_date,
        p_files_changed,
        p_lines_added,
        p_lines_deleted,
        p_features_added,
        p_bugs_fixed,
        p_breaking_changes,
        NOW() -- Mark as deployed now
    ) RETURNING id INTO version_id;

    RETURN version_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION store_git_commit() IS 'Parse and store git commit information as a version record';

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Update timestamp trigger
CREATE TRIGGER update_version_history_updated_at BEFORE UPDATE ON version_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Latest Release View
CREATE VIEW latest_release AS
SELECT
    vh.version_number,
    vh.commit_hash_short,
    vh.commit_message,
    vh.commit_date,
    vh.deployed_at,
    vh.features_added,
    vh.bugs_fixed,
    vh.breaking_changes,
    vh.release_notes,
    (EXTRACT(EPOCH FROM (NOW() - vh.commit_date)) / 86400)::INTEGER as days_ago
FROM version_history vh
WHERE vh.is_release = true AND vh.status = 'active'
ORDER BY vh.commit_date DESC
LIMIT 1;

COMMENT ON VIEW latest_release IS 'Information about the latest tagged release';

-- Recent Changes View
CREATE VIEW recent_changes AS
SELECT
    vh.version_number,
    vh.commit_hash_short,
    vh.commit_message,
    vh.commit_date,
    vh.features_added,
    vh.bugs_fixed,
    fc.feature_name,
    fc.feature_type,
    fc.feature_description,
    fc.user_impact
FROM version_history vh
LEFT JOIN feature_changes fc ON vh.id = fc.version_id
WHERE vh.commit_date >= NOW() - INTERVAL '30 days'
    AND vh.status = 'active'
ORDER BY vh.commit_date DESC, fc.created_at DESC;

COMMENT ON VIEW recent_changes IS 'All changes from the last 30 days with feature details';

-- =============================================================================
-- INITIAL DATA SEEDING
-- =============================================================================

-- Insert current version as initial record
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
    status
) VALUES (
    '1.0.0',
    'initial-setup-' || generate_random_uuid()::TEXT,
    'initial',
    'Initial bot deployment with version management system',
    'System',
    'system@bot.local',
    NOW(),
    ARRAY['Version management system', 'Help command enhancements', 'Tracking verification'],
    ARRAY[],
    true,
    NOW(),
    'active'
);

-- Log successful schema creation
INSERT INTO bot_activity_log (
    activity_type,
    activity_description,
    status
) VALUES (
    'schema_extension',
    'Version management schema created successfully',
    'success'
);