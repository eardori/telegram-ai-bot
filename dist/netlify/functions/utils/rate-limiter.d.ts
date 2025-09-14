interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    keyPrefix?: string;
}
export declare class MemoryRateLimiter {
    private config;
    private storage;
    private cleanupInterval;
    constructor(config: RateLimitConfig);
    isRateLimited(key: string): Promise<{
        limited: boolean;
        remaining: number;
        resetTime: number;
    }>;
    getStatus(key: string): Promise<{
        count: number;
        remaining: number;
        resetTime: number;
    }>;
    reset(key: string): Promise<void>;
    private cleanup;
    getStats(): {
        totalKeys: number;
        activeKeys: number;
        expiredKeys: number;
    };
    destroy(): void;
}
export declare class TieredRateLimiter {
    private configs;
    private limiters;
    constructor(configs: Record<string, RateLimitConfig>);
    check(tier: string, key: string): Promise<{
        limited: boolean;
        remaining: number;
        resetTime: number;
        tier: string;
    }>;
    checkMultiple(tiers: string[], key: string): Promise<{
        limited: boolean;
        remaining: number;
        resetTime: number;
        restrictiveTier: string;
    }>;
    getAllStats(): Record<string, ReturnType<MemoryRateLimiter['getStats']>>;
    resetAll(key: string): Promise<void>;
    destroy(): void;
}
export declare function createTelegramRateLimiter(): TieredRateLimiter;
export declare class RateLimitMiddleware {
    private rateLimiter;
    constructor(rateLimiter: TieredRateLimiter);
    checkUserLimit(userId: number): Promise<{
        allowed: boolean;
        reason?: string;
        resetTime?: number;
    }>;
    checkChatLimit(chatId: number): Promise<{
        allowed: boolean;
        reason?: string;
        resetTime?: number;
    }>;
    checkCommandLimit(userId: number, command: string): Promise<{
        allowed: boolean;
        reason?: string;
        resetTime?: number;
    }>;
    checkSummaryLimit(userId: number): Promise<{
        allowed: boolean;
        reason?: string;
        resetTime?: number;
    }>;
    checkMultipleLimits(userId: number, chatId: number, command?: string): Promise<{
        allowed: boolean;
        reason?: string;
        restrictiveTier?: string;
        resetTime?: number;
    }>;
    private getReasonForTier;
}
export declare function getGlobalRateLimiter(): TieredRateLimiter;
export declare function createRateLimitMiddleware(): RateLimitMiddleware;
export {};
//# sourceMappingURL=rate-limiter.d.ts.map