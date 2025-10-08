"use strict";
/**
 * Parameterized Template Service
 *
 * Handles templates that require user parameter selection
 * (e.g., background style, outfit type, expression)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isParameterizedTemplate = isParameterizedTemplate;
exports.getTemplateWithParameters = getTemplateWithParameters;
exports.buildPromptWithParameters = buildPromptWithParameters;
exports.getParameterOption = getParameterOption;
exports.getAllParameterizedTemplates = getAllParameterizedTemplates;
const supabase_1 = require("../utils/supabase");
/**
 * Check if template requires parameters
 */
async function isParameterizedTemplate(templateKey) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('prompt_templates')
            .select('template_type')
            .eq('template_key', templateKey)
            .single();
        if (error || !data) {
            console.error('❌ Error checking template type:', error);
            return false;
        }
        return data.template_type === 'parameterized';
    }
    catch (error) {
        console.error('❌ Error in isParameterizedTemplate:', error);
        return false;
    }
}
/**
 * Get template with all parameters and options
 */
async function getTemplateWithParameters(templateKey) {
    try {
        // Get template
        const { data: template, error: templateError } = await supabase_1.supabase
            .from('prompt_templates')
            .select('template_key, template_name_ko, template_type, base_prompt')
            .eq('template_key', templateKey)
            .eq('is_active', true)
            .single();
        if (templateError || !template) {
            console.error('❌ Error fetching template:', templateError);
            return null;
        }
        // Get parameters
        const { data: parameters, error: paramError } = await supabase_1.supabase
            .from('template_parameters')
            .select('*')
            .eq('template_key', templateKey)
            .order('display_order', { ascending: true });
        if (paramError) {
            console.error('❌ Error fetching parameters:', paramError);
            return null;
        }
        // Get options for each parameter
        const parametersWithOptions = await Promise.all((parameters || []).map(async (param) => {
            const { data: options, error: optError } = await supabase_1.supabase
                .from('template_parameter_options')
                .select('*')
                .eq('parameter_id', param.id)
                .order('display_order', { ascending: true });
            if (optError) {
                console.error(`❌ Error fetching options for parameter ${param.id}:`, optError);
                return { ...param, options: [] };
            }
            return { ...param, options: options || [] };
        }));
        return {
            ...template,
            parameters: parametersWithOptions
        };
    }
    catch (error) {
        console.error('❌ Error in getTemplateWithParameters:', error);
        return null;
    }
}
/**
 * Build final prompt by substituting parameters
 */
function buildPromptWithParameters(basePrompt, parameters) {
    let finalPrompt = basePrompt;
    // Replace {parameter_key} with prompt_fragment
    for (const [key, value] of Object.entries(parameters)) {
        const placeholder = `{${key}}`;
        finalPrompt = finalPrompt.replace(placeholder, value);
    }
    return finalPrompt;
}
/**
 * Get option by keys
 */
async function getParameterOption(templateKey, parameterKey, optionKey) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('template_parameters_full')
            .select('*')
            .eq('template_key', templateKey)
            .eq('parameter_key', parameterKey)
            .eq('option_key', optionKey)
            .single();
        if (error || !data) {
            console.error('❌ Error fetching parameter option:', error);
            return null;
        }
        return {
            id: data.option_id,
            parameter_id: data.parameter_id,
            option_key: data.option_key,
            option_name_ko: data.option_name,
            option_name_en: null,
            prompt_fragment: data.prompt_fragment,
            emoji: data.emoji,
            display_order: data.option_order
        };
    }
    catch (error) {
        console.error('❌ Error in getParameterOption:', error);
        return null;
    }
}
/**
 * Get all parameterized templates
 */
async function getAllParameterizedTemplates() {
    try {
        const { data: templates, error } = await supabase_1.supabase
            .from('prompt_templates')
            .select('template_key')
            .eq('template_type', 'parameterized')
            .eq('is_active', true);
        if (error || !templates) {
            console.error('❌ Error fetching parameterized templates:', error);
            return [];
        }
        const results = await Promise.all(templates.map(t => getTemplateWithParameters(t.template_key)));
        return results.filter((t) => t !== null);
    }
    catch (error) {
        console.error('❌ Error in getAllParameterizedTemplates:', error);
        return [];
    }
}
