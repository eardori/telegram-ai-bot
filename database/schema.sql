-- Dynamic Prompt Management System for Telegram Bot
-- Created: 2025-09-13

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for prompt types
CREATE TYPE prompt_type AS ENUM (
    'image_generation',
    'qa_system',
    'dobby_image',
    'dobby_qa',
    'error_message',
    'system_message'
);

-- Create enum for prompt status
CREATE TYPE prompt_status AS ENUM (
    'active',
    'inactive',
    'archived'
);

-- Main prompts table
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Prompt identification
    key VARCHAR(100) UNIQUE NOT NULL, -- Unique identifier for each prompt
    name VARCHAR(200) NOT NULL,       -- Human-readable name
    type prompt_type NOT NULL,        -- Type of prompt
    
    -- Prompt content
    template TEXT NOT NULL,           -- Main prompt template with placeholders
    description TEXT,                 -- Description of what this prompt does
    
    -- Configuration
    max_tokens INTEGER DEFAULT 2000, -- Maximum tokens for AI responses
    temperature DECIMAL(2,1) DEFAULT 0.7, -- AI temperature setting
    
    -- Template variables (JSON)
    variables JSONB DEFAULT '{}',     -- Available template variables and their defaults
    
    -- Status and versioning
    status prompt_status DEFAULT 'active',
    version INTEGER DEFAULT 1,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100), -- User or system that created this
    
    -- Constraints
    CONSTRAINT prompts_max_tokens_check CHECK (max_tokens > 0 AND max_tokens <= 8000),
    CONSTRAINT prompts_temperature_check CHECK (temperature >= 0.0 AND temperature <= 2.0)
);

-- Create index on key for fast lookups
CREATE INDEX idx_prompts_key ON prompts(key);
CREATE INDEX idx_prompts_type ON prompts(type);
CREATE INDEX idx_prompts_status ON prompts(status);

-- Prompt usage analytics table (optional but useful)
CREATE TABLE prompt_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    
    -- Usage tracking
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id VARCHAR(100), -- Telegram user ID
    chat_id VARCHAR(100), -- Telegram chat ID
    
    -- Performance metrics
    response_time_ms INTEGER,
    tokens_used INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Request details
    input_variables JSONB DEFAULT '{}', -- Variables used in this request
    
    -- Indexes for analytics
    INDEX idx_prompt_usage_prompt_id (prompt_id),
    INDEX idx_prompt_usage_used_at (used_at),
    INDEX idx_prompt_usage_success (success)
);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_prompts_updated_at 
    BEFORE UPDATE ON prompts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create RLS (Row Level Security) policies for security
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_usage ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (you can customize this)
CREATE POLICY "Allow all operations for service role" ON prompts
    FOR ALL USING (true);

CREATE POLICY "Allow all operations for service role" ON prompt_usage
    FOR ALL USING (true);

-- Comments for documentation
COMMENT ON TABLE prompts IS 'Stores dynamic prompt templates for the Telegram bot';
COMMENT ON COLUMN prompts.key IS 'Unique identifier used in code to fetch specific prompts';
COMMENT ON COLUMN prompts.template IS 'Prompt template with placeholders like {user_input}, {context}';
COMMENT ON COLUMN prompts.variables IS 'JSON object defining available template variables and their defaults';
COMMENT ON COLUMN prompts.max_tokens IS 'Maximum tokens for AI API calls using this prompt';
COMMENT ON COLUMN prompts.temperature IS 'AI creativity setting (0.0 = deterministic, 2.0 = very creative)';

COMMENT ON TABLE prompt_usage IS 'Analytics and usage tracking for prompts';