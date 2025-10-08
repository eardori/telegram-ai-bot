-- =============================================================================
-- PARAMETERIZED TEMPLATES SYSTEM
-- Version: 1.0.0
-- Description: Support templates with user-selectable parameters
-- =============================================================================

-- Add template_type column to existing prompt_templates table
ALTER TABLE prompt_templates
ADD COLUMN IF NOT EXISTS template_type VARCHAR(20) DEFAULT 'fixed';

COMMENT ON COLUMN prompt_templates.template_type IS 'Template type: fixed (no parameters) or parameterized (requires parameter selection)';

-- Create template_parameters table
CREATE TABLE IF NOT EXISTS template_parameters (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(50) NOT NULL REFERENCES prompt_templates(template_key) ON DELETE CASCADE,
    parameter_key VARCHAR(50) NOT NULL,
    parameter_name_ko VARCHAR(100) NOT NULL,
    parameter_name_en VARCHAR(100),
    parameter_type VARCHAR(20) NOT NULL DEFAULT 'select', -- 'select' | 'text' | 'color'
    is_required BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(template_key, parameter_key)
);

COMMENT ON TABLE template_parameters IS 'Parameters for parameterized templates (e.g., background_style, outfit_type)';
COMMENT ON COLUMN template_parameters.parameter_key IS 'Unique key for this parameter (used in prompt substitution)';
COMMENT ON COLUMN template_parameters.parameter_type IS 'Type of parameter input: select (dropdown), text (free input), color (color picker)';

-- Create template_parameter_options table
CREATE TABLE IF NOT EXISTS template_parameter_options (
    id SERIAL PRIMARY KEY,
    parameter_id INTEGER NOT NULL REFERENCES template_parameters(id) ON DELETE CASCADE,
    option_key VARCHAR(50) NOT NULL,
    option_name_ko VARCHAR(100) NOT NULL,
    option_name_en VARCHAR(100),
    prompt_fragment TEXT NOT NULL,
    emoji VARCHAR(10),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(parameter_id, option_key)
);

COMMENT ON TABLE template_parameter_options IS 'Selectable options for each parameter';
COMMENT ON COLUMN template_parameter_options.prompt_fragment IS 'Text fragment to insert into the base prompt when this option is selected';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_parameters_template_key ON template_parameters(template_key);
CREATE INDEX IF NOT EXISTS idx_template_parameter_options_parameter_id ON template_parameter_options(parameter_id);

-- Create view for easy querying
CREATE OR REPLACE VIEW template_parameters_full AS
SELECT
    tp.id as template_id,
    tp.template_key,
    tp.template_name_ko as template_name,
    tp.template_type,
    param.id as parameter_id,
    param.parameter_key,
    param.parameter_name_ko as parameter_name,
    param.parameter_type,
    param.is_required,
    param.display_order as parameter_order,
    opt.id as option_id,
    opt.option_key,
    opt.option_name_ko as option_name,
    opt.prompt_fragment,
    opt.emoji,
    opt.display_order as option_order
FROM prompt_templates tp
LEFT JOIN template_parameters param ON tp.template_key = param.template_key
LEFT JOIN template_parameter_options opt ON param.id = opt.parameter_id
WHERE tp.template_type = 'parameterized' AND tp.is_active = true
ORDER BY tp.template_key, param.display_order, opt.display_order;

COMMENT ON VIEW template_parameters_full IS 'Complete view of parameterized templates with all parameters and options';
