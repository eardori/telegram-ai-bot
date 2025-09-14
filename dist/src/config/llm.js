"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLLMConfig = getLLMConfig;
exports.validateLLMConfig = validateLLMConfig;
exports.getProviderModels = getProviderModels;
exports.getModelConfig = getModelConfig;
exports.getUseCaseConfig = getUseCaseConfig;
exports.getEnvironmentLLMSettings = getEnvironmentLLMSettings;
exports.estimateCost = estimateCost;
exports.getTokenLimit = getTokenLimit;
exports.supportsFunctionCalling = supportsFunctionCalling;
exports.supportsStreaming = supportsStreaming;
function getLLMConfig(env) {
    const provider = env.LLM_PROVIDER;
    const model = env.LLM_MODEL;
    const baseConfig = {
        provider,
        model,
        maxTokens: 4096,
        temperature: 0.7,
        topP: 1.0,
        frequencyPenalty: 0,
        presencePenalty: 0,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
    };
    switch (provider) {
        case 'openai':
            return {
                ...baseConfig,
                apiKey: env.OPENAI_API_KEY || '',
                baseUrl: 'https://api.openai.com/v1',
            };
        case 'anthropic':
            return {
                ...baseConfig,
                apiKey: env.ANTHROPIC_API_KEY || '',
                baseUrl: 'https://api.anthropic.com',
                maxTokens: 8192,
            };
        case 'google':
            return {
                ...baseConfig,
                apiKey: env.GOOGLE_API_KEY || '',
                baseUrl: 'https://generativelanguage.googleapis.com/v1',
            };
        case 'azure':
            return {
                ...baseConfig,
                apiKey: env.AZURE_OPENAI_API_KEY || '',
                baseUrl: process.env.AZURE_OPENAI_ENDPOINT || '',
            };
        case 'huggingface':
            return {
                ...baseConfig,
                apiKey: env.HUGGINGFACE_API_KEY || '',
                baseUrl: 'https://api-inference.huggingface.co/models',
            };
        case 'ollama':
            return {
                ...baseConfig,
                apiKey: '',
                baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            };
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}
function validateLLMConfig(config) {
    const errors = [];
    if (!config.provider) {
        errors.push('LLM provider is required');
    }
    if (!config.model) {
        errors.push('LLM model is required');
    }
    if (config.provider !== 'ollama' && !config.apiKey) {
        errors.push(`API key is required for ${config.provider} provider`);
    }
    if (!config.baseUrl) {
        errors.push('Base URL is required');
    }
    if (config.maxTokens && (config.maxTokens < 1 || config.maxTokens > 32000)) {
        errors.push('Max tokens must be between 1 and 32000');
    }
    if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
        errors.push('Temperature must be between 0 and 2');
    }
    if (config.topP && (config.topP < 0 || config.topP > 1)) {
        errors.push('Top P must be between 0 and 1');
    }
    if (config.frequencyPenalty && (config.frequencyPenalty < -2 || config.frequencyPenalty > 2)) {
        errors.push('Frequency penalty must be between -2 and 2');
    }
    if (config.presencePenalty && (config.presencePenalty < -2 || config.presencePenalty > 2)) {
        errors.push('Presence penalty must be between -2 and 2');
    }
    if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
        errors.push('Timeout must be between 1000ms and 300000ms');
    }
    if (config.retryAttempts && (config.retryAttempts < 0 || config.retryAttempts > 10)) {
        errors.push('Retry attempts must be between 0 and 10');
    }
    if (config.retryDelay && (config.retryDelay < 100 || config.retryDelay > 10000)) {
        errors.push('Retry delay must be between 100ms and 10000ms');
    }
    if (errors.length > 0) {
        throw new Error(`LLM configuration validation failed:\n${errors.join('\n')}`);
    }
}
function getProviderModels(provider) {
    switch (provider) {
        case 'openai':
            return {
                'gpt-4': { maxTokens: 8192, costPer1kTokens: 0.03 },
                'gpt-4-turbo': { maxTokens: 128000, costPer1kTokens: 0.01 },
                'gpt-3.5-turbo': { maxTokens: 16385, costPer1kTokens: 0.0015 },
                'gpt-3.5-turbo-16k': { maxTokens: 16385, costPer1kTokens: 0.003 },
            };
        case 'anthropic':
            return {
                'claude-3-opus': { maxTokens: 200000, costPer1kTokens: 0.015 },
                'claude-3-sonnet': { maxTokens: 200000, costPer1kTokens: 0.003 },
                'claude-3-haiku': { maxTokens: 200000, costPer1kTokens: 0.00025 },
                'claude-instant-1': { maxTokens: 100000, costPer1kTokens: 0.0008 },
            };
        case 'google':
            return {
                'gemini-pro': { maxTokens: 32760, costPer1kTokens: 0.0005 },
                'gemini-pro-vision': { maxTokens: 16384, costPer1kTokens: 0.0025 },
            };
        case 'azure':
            return {
                'gpt-4': { maxTokens: 8192, costPer1kTokens: 0.03 },
                'gpt-35-turbo': { maxTokens: 4096, costPer1kTokens: 0.002 },
            };
        case 'huggingface':
            return {
                'microsoft/DialoGPT-large': { maxTokens: 1024, costPer1kTokens: 0 },
                'facebook/blenderbot-400M-distill': { maxTokens: 512, costPer1kTokens: 0 },
            };
        case 'ollama':
            return {
                'llama2': { maxTokens: 4096, costPer1kTokens: 0 },
                'codellama': { maxTokens: 4096, costPer1kTokens: 0 },
                'mistral': { maxTokens: 8192, costPer1kTokens: 0 },
            };
        default:
            return {};
    }
}
function getModelConfig(provider, model) {
    const providerModels = getProviderModels(provider);
    return providerModels[model] || { maxTokens: 4096, costPer1kTokens: 0.001 };
}
function getUseCaseConfig(useCase) {
    switch (useCase) {
        case 'summary':
            return {
                temperature: 0.3,
                topP: 0.9,
                maxTokens: 2048,
                frequencyPenalty: 0.1,
                presencePenalty: 0,
            };
        case 'translation':
            return {
                temperature: 0.2,
                topP: 0.8,
                maxTokens: 1024,
                frequencyPenalty: 0,
                presencePenalty: 0,
            };
        case 'qa':
            return {
                temperature: 0.1,
                topP: 0.9,
                maxTokens: 1024,
                frequencyPenalty: 0,
                presencePenalty: 0,
            };
        case 'chat':
            return {
                temperature: 0.7,
                topP: 1.0,
                maxTokens: 2048,
                frequencyPenalty: 0.1,
                presencePenalty: 0.1,
            };
        default:
            return {
                temperature: 0.7,
                topP: 1.0,
                maxTokens: 2048,
                frequencyPenalty: 0,
                presencePenalty: 0,
            };
    }
}
function getEnvironmentLLMSettings(environment) {
    switch (environment) {
        case 'development':
            return {
                timeout: 60000,
                retryAttempts: 1,
                logRequests: true,
                logResponses: true,
            };
        case 'staging':
            return {
                timeout: 30000,
                retryAttempts: 2,
                logRequests: false,
                logResponses: false,
            };
        case 'production':
            return {
                timeout: 20000,
                retryAttempts: 3,
                logRequests: false,
                logResponses: false,
            };
        default:
            return {
                timeout: 30000,
                retryAttempts: 3,
                logRequests: false,
                logResponses: false,
            };
    }
}
function estimateCost(provider, model, tokens) {
    const modelConfig = getModelConfig(provider, model);
    return (tokens / 1000) * modelConfig.costPer1kTokens;
}
function getTokenLimit(provider, model) {
    const modelConfig = getModelConfig(provider, model);
    return modelConfig.maxTokens;
}
function supportsFunctionCalling(provider, model) {
    switch (provider) {
        case 'openai':
            return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'].some(m => model.includes(m));
        case 'anthropic':
            return model.includes('claude-3');
        case 'azure':
            return ['gpt-4', 'gpt-35-turbo'].some(m => model.includes(m));
        default:
            return false;
    }
}
function supportsStreaming(provider) {
    return ['openai', 'anthropic', 'azure', 'ollama'].includes(provider);
}
//# sourceMappingURL=llm.js.map