"use strict";
/**
 * Dynamic Prompt Management System
 * Telegram Bot - Prompt Manager Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTemplate = processTemplate;
exports.getPrompt = getPrompt;
exports.getProcessedPrompt = getProcessedPrompt;
exports.getPrompts = getPrompts;
exports.createPrompt = createPrompt;
exports.updatePrompt = updatePrompt;
exports.archivePrompt = archivePrompt;
exports.trackPromptUsage = trackPromptUsage;
exports.getPromptWithFallback = getPromptWithFallback;
exports.getImagePrompt = getImagePrompt;
exports.getDobbyImagePrompt = getDobbyImagePrompt;
exports.getQAPrompt = getQAPrompt;
exports.getSystemMessage = getSystemMessage;
const supabase_1 = require("./supabase");
const prompt_types_1 = require("../types/prompt.types");
/**
 * Transform database row to Prompt interface
 * Handles both schema formats (database/schema.sql and combined-database-setup.sql)
 */
function transformPromptRow(row) {
    return {
        id: row.id,
        key: row.prompt_name || row.key, // Handle both column names
        name: row.prompt_name || row.name,
        type: row.prompt_type || row.type,
        template: row.prompt_text || row.template,
        description: row.metadata?.description || row.description || undefined,
        maxTokens: row.max_tokens || 2000,
        temperature: row.temperature || 0.7,
        variables: row.template_variables || row.variables || {},
        status: row.is_active !== false ? 'active' : 'inactive', // Convert boolean to status
        version: row.prompt_version || row.version || 1,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        createdBy: row.created_by || undefined
    };
}
/**
 * Process template with variables
 */
function processTemplate(template, options) {
    const { variables, escapeHtml = false, allowUndefinedVariables = false, defaultValue = '' } = options;
    try {
        let processedTemplate = template;
        // Find all template variables in format {variable_name}
        const variablePattern = /\{([^}]+)\}/g;
        const matches = template.match(variablePattern);
        if (matches) {
            for (const match of matches) {
                const variableName = match.slice(1, -1); // Remove { and }
                let value = variables[variableName];
                if (value === undefined || value === null) {
                    if (allowUndefinedVariables) {
                        value = defaultValue;
                    }
                    else {
                        throw new prompt_types_1.TemplateProcessingError(`Missing variable: ${variableName}`);
                    }
                }
                // Convert to string
                let stringValue = String(value);
                // Escape HTML if requested
                if (escapeHtml) {
                    stringValue = stringValue
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                }
                // Replace all instances of this variable
                processedTemplate = processedTemplate.replace(new RegExp(match.replace(/[{}]/g, '\\$&'), 'g'), stringValue);
            }
        }
        return processedTemplate;
    }
    catch (error) {
        throw new prompt_types_1.TemplateProcessingError(`Failed to process template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Get prompt by key
 */
async function getPrompt(key) {
    try {
        console.log(`🔍 Fetching prompt: ${key}`);
        const { data, error } = await supabase_1.supabase
            .from('prompts')
            .select('*')
            .eq('prompt_name', key)
            .eq('is_active', true)
            .single();
        if (error) {
            console.error('Supabase error:', error);
            throw new Error(`Database error: ${error.message}`);
        }
        if (!data) {
            throw new prompt_types_1.PromptNotFoundError(key);
        }
        const prompt = transformPromptRow(data);
        console.log(`✅ Prompt fetched: ${prompt.name}`);
        return prompt;
    }
    catch (error) {
        console.error(`❌ Error fetching prompt ${key}:`, error);
        throw error;
    }
}
/**
 * Get processed prompt with variables
 */
async function getProcessedPrompt(key, variables, options) {
    try {
        const prompt = await getPrompt(key);
        // Merge default variables with provided variables
        const mergedVariables = { ...prompt.variables, ...variables };
        // Process template
        const processedTemplate = processTemplate(prompt.template, {
            variables: mergedVariables,
            allowUndefinedVariables: true,
            defaultValue: '',
            ...options
        });
        return {
            prompt,
            processedTemplate,
            variables: mergedVariables
        };
    }
    catch (error) {
        console.error(`❌ Error processing prompt ${key}:`, error);
        throw error;
    }
}
/**
 * Get multiple prompts
 */
async function getPrompts(options = {}) {
    try {
        let query = supabase_1.supabase.from('prompts').select('*');
        // Apply filters
        if (options.type) {
            query = query.eq('prompt_type', options.type);
        }
        if (options.status) {
            // Convert status to boolean for is_active column
            const isActive = options.status === 'active';
            query = query.eq('is_active', isActive);
        }
        else {
            query = query.eq('is_active', true); // Default to active prompts
        }
        if (options.keys && options.keys.length > 0) {
            query = query.in('prompt_name', options.keys);
        }
        // Apply ordering
        const orderBy = options.orderBy || 'updated_at';
        const orderDirection = options.orderDirection || 'desc';
        query = query.order(orderBy, { ascending: orderDirection === 'asc' });
        // Apply pagination
        if (options.limit) {
            query = query.limit(options.limit);
        }
        if (options.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
        }
        const { data, error } = await query;
        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }
        return (data || []).map(transformPromptRow);
    }
    catch (error) {
        console.error('❌ Error fetching prompts:', error);
        throw error;
    }
}
/**
 * Create new prompt
 */
async function createPrompt(request) {
    try {
        // Validate request
        if (!request.key || !request.name || !request.template) {
            throw new prompt_types_1.PromptValidationError('Key, name, and template are required');
        }
        const { data, error } = await supabase_1.supabase
            .from('prompts')
            .insert([{
                prompt_name: request.key,
                prompt_type: request.type,
                prompt_text: request.template,
                template_variables: request.variables || [],
                is_active: request.status === 'active',
                created_by: request.createdBy || 'system',
                metadata: {
                    description: request.description,
                    maxTokens: request.maxTokens || 2000,
                    temperature: request.temperature || 0.7
                }
            }])
            .select()
            .single();
        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }
        return transformPromptRow(data);
    }
    catch (error) {
        console.error('❌ Error creating prompt:', error);
        throw error;
    }
}
/**
 * Update existing prompt
 */
async function updatePrompt(key, request) {
    try {
        const updateData = {};
        if (request.name !== undefined)
            updateData.prompt_name = request.name;
        if (request.template !== undefined)
            updateData.prompt_text = request.template;
        if (request.variables !== undefined)
            updateData.template_variables = request.variables;
        if (request.status !== undefined)
            updateData.is_active = request.status === 'active';
        // Handle metadata updates
        if (request.description !== undefined || request.maxTokens !== undefined || request.temperature !== undefined) {
            // First get current metadata
            const { data: currentData } = await supabase_1.supabase
                .from('prompts')
                .select('metadata')
                .eq('prompt_name', key)
                .single();
            const currentMetadata = currentData?.metadata || {};
            const newMetadata = { ...currentMetadata };
            if (request.description !== undefined)
                newMetadata.description = request.description;
            if (request.maxTokens !== undefined)
                newMetadata.maxTokens = request.maxTokens;
            if (request.temperature !== undefined)
                newMetadata.temperature = request.temperature;
            updateData.metadata = newMetadata;
        }
        const { data, error } = await supabase_1.supabase
            .from('prompts')
            .update(updateData)
            .eq('prompt_name', key)
            .select()
            .single();
        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }
        if (!data) {
            throw new prompt_types_1.PromptNotFoundError(key);
        }
        return transformPromptRow(data);
    }
    catch (error) {
        console.error(`❌ Error updating prompt ${key}:`, error);
        throw error;
    }
}
/**
 * Delete prompt (soft delete by setting status to archived)
 */
async function archivePrompt(key) {
    try {
        const { error } = await supabase_1.supabase
            .from('prompts')
            .update({ is_active: false })
            .eq('prompt_name', key);
        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }
        console.log(`✅ Prompt archived: ${key}`);
    }
    catch (error) {
        console.error(`❌ Error archiving prompt ${key}:`, error);
        throw error;
    }
}
/**
 * Track prompt usage
 */
async function trackPromptUsage(request) {
    try {
        const { error } = await supabase_1.supabase
            .from('prompt_usage_analytics')
            .insert([{
                prompt_id: request.promptId,
                user_id: request.userId,
                chat_id: request.chatId,
                response_time_ms: request.responseTimeMs,
                tokens_used: request.tokensUsed,
                success: request.success,
                error_message: request.errorMessage,
                template_variables_used: request.inputVariables || {}
            }]);
        if (error) {
            console.error('Error tracking prompt usage:', error);
            // Don't throw error for usage tracking failures to avoid breaking bot functionality
        }
    }
    catch (error) {
        console.error('❌ Error tracking prompt usage:', error);
        // Silent fail for analytics
    }
}
/**
 * Get prompt with fallback
 * This function provides a fallback mechanism if the database is unavailable
 */
async function getPromptWithFallback(key, fallbackTemplate, variables = {}) {
    try {
        return await getProcessedPrompt(key, variables);
    }
    catch (error) {
        console.warn(`⚠️ Falling back to hardcoded prompt for ${key}:`, error);
        // Create a fallback prompt object
        const fallbackPrompt = {
            id: 'fallback',
            key,
            name: `Fallback: ${key}`,
            type: 'system_message',
            template: fallbackTemplate,
            maxTokens: 2000,
            temperature: 0.7,
            variables: {},
            status: 'active',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const processedTemplate = processTemplate(fallbackTemplate, {
            variables,
            allowUndefinedVariables: true,
            defaultValue: ''
        });
        return {
            prompt: fallbackPrompt,
            processedTemplate,
            variables
        };
    }
}
/**
 * Utility function to safely get a prompt for image generation
 */
async function getImagePrompt(userInput, style) {
    const startTime = Date.now();
    try {
        const processedPrompt = await getProcessedPrompt('image_generation_enhanced', {
            user_request: userInput, // Changed to user_request for consistency
            style: style || 'photorealistic'
        });
        // Track usage
        await trackPromptUsage({
            promptId: processedPrompt.prompt.id,
            responseTimeMs: Date.now() - startTime,
            success: true,
            inputVariables: { user_input: userInput, style: style || 'photorealistic' }
        });
        return processedPrompt.processedTemplate;
    }
    catch (error) {
        console.warn('⚠️ Database prompt not found, using fallback for getImagePrompt');
        // Simple fallback prompt for image generation
        const fallbackPrompt = `Create a high-quality, detailed image of: ${userInput}. Style: ${style || 'photorealistic'}, beautiful lighting, 8k resolution, professional photography.`;
        await trackPromptUsage({
            promptId: 'fallback',
            responseTimeMs: Date.now() - startTime,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            inputVariables: { user_request: userInput }
        });
        return fallbackPrompt;
    }
}
/**
 * Utility function to safely get a prompt for Dobby image generation
 */
async function getDobbyImagePrompt(userInput) {
    const startTime = Date.now();
    try {
        const processedPrompt = await getProcessedPrompt('dobby_image_generation', {
            user_request: userInput // Changed from user_input to user_request to match SQL template
        });
        await trackPromptUsage({
            promptId: processedPrompt.prompt.id,
            responseTimeMs: Date.now() - startTime,
            success: true,
            inputVariables: { user_request: userInput }
        });
        return processedPrompt.processedTemplate;
    }
    catch (error) {
        const fallback = `Create a magical, high-quality image of: ${userInput}. Style: Harry Potter universe inspired, magical atmosphere, detailed, fantasy art, 8k resolution.`;
        await trackPromptUsage({
            promptId: 'fallback',
            responseTimeMs: Date.now() - startTime,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            inputVariables: { user_request: userInput }
        });
        return fallback;
    }
}
/**
 * Utility function to safely get Q&A prompt
 */
async function getQAPrompt(question, isDobby = false) {
    const startTime = Date.now();
    const promptKey = isDobby ? 'dobby_qa_system' : 'qa_system_base';
    try {
        const processedPrompt = await getProcessedPrompt(promptKey, {
            question: question
        });
        await trackPromptUsage({
            promptId: processedPrompt.prompt.id,
            responseTimeMs: Date.now() - startTime,
            success: true,
            inputVariables: { question }
        });
        return {
            prompt: processedPrompt.processedTemplate,
            maxTokens: processedPrompt.prompt.maxTokens,
            temperature: processedPrompt.prompt.temperature
        };
    }
    catch (error) {
        // Fallback prompt based on whether it's Dobby or not
        const fallbackTemplate = isDobby
            ? `도비는 충실한 하우스 엘프입니다. 주인님의 질문에 정중하고 도움이 되는 답변을 한국어로 드리겠습니다.\n\n주인님의 질문: ${question}\n\n도비의 답변:`
            : `다음 질문에 대해 정확하고 도움이 되는 답변을 한국어로 제공해주세요:\n\n질문: ${question}\n\n답변:`;
        await trackPromptUsage({
            promptId: 'fallback',
            responseTimeMs: Date.now() - startTime,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            inputVariables: { question }
        });
        return {
            prompt: fallbackTemplate,
            maxTokens: 2000,
            temperature: isDobby ? 0.8 : 0.7
        };
    }
}
/**
 * Utility to get system messages with variables
 */
async function getSystemMessage(key, variables = {}) {
    try {
        const processedPrompt = await getProcessedPrompt(key, variables);
        return processedPrompt.processedTemplate;
    }
    catch (error) {
        console.warn(`⚠️ System message fallback for ${key}:`, error);
        // Basic fallback messages
        const fallbacks = {
            'dobby_processing_image': `🧙‍♀️ **도비가 그림을 그리고 있습니다!**\n\n🎨 그릴 내용: "${variables.user_input || ''}"\n\n⚡ 마법으로 이미지를 생성하고 있습니다...`,
            'dobby_processing_qa': `🧙‍♀️ **도비가 생각하고 있습니다!**\n\n❓ 질문: "${variables.question || ''}"\n\n🧠 도비가 열심히 답을 찾고 있습니다...`,
            'dobby_success_image': `🧙‍♀️ **도비가 그림을 완성했습니다!**\n\n🎨 "${variables.user_input || ''}"\n\n✨ 도비는 언제나 주인님을 위해 최선을 다합니다!`,
            'dobby_success_qa': `🧙‍♀️ **도비의 답변입니다!**\n\n❓ **질문:** ${variables.question || ''}\n\n💡 **도비의 답변:**\n${variables.answer || ''}`
        };
        return fallbacks[key] || `System message: ${key}`;
    }
}
