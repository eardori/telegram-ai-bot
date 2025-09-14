import type { Environment } from '../types';
import type { LLMConfig, LLMProvider } from '../types/llm';
export declare function getLLMConfig(env: Environment): LLMConfig;
export declare function validateLLMConfig(config: LLMConfig): void;
export declare function getProviderModels(provider: LLMProvider): Record<string, any>;
export declare function getModelConfig(provider: LLMProvider, model: string): any;
export declare function getUseCaseConfig(useCase: 'summary' | 'translation' | 'qa' | 'chat'): Partial<LLMConfig>;
export declare function getEnvironmentLLMSettings(environment: string): {
    timeout: number;
    retryAttempts: number;
    logRequests: boolean;
    logResponses: boolean;
};
export declare function estimateCost(provider: LLMProvider, model: string, tokens: number): number;
export declare function getTokenLimit(provider: LLMProvider, model: string): number;
export declare function supportsFunctionCalling(provider: LLMProvider, model: string): boolean;
export declare function supportsStreaming(provider: LLMProvider): boolean;
//# sourceMappingURL=llm.d.ts.map