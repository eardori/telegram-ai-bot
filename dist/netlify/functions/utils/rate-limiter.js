"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitMiddleware = exports.TieredRateLimiter = exports.MemoryRateLimiter = void 0;
exports.createTelegramRateLimiter = createTelegramRateLimiter;
exports.getGlobalRateLimiter = getGlobalRateLimiter;
exports.createRateLimitMiddleware = createRateLimitMiddleware;
class MemoryRateLimiter {
    constructor(config) {
        this.config = config;
        this.storage = new Map();
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }
    async isRateLimited(key) {
        const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`;
        const now = Date.now();
        let entry = this.storage.get(fullKey);
        if (!entry || now > entry.resetTime) {
            entry = {
                count: 0,
                resetTime: now + this.config.windowMs,
            };
        }
        entry.count++;
        this.storage.set(fullKey, entry);
        const limited = entry.count > this.config.maxRequests;
        const remaining = Math.max(0, this.config.maxRequests - entry.count);
        return {
            limited,
            remaining,
            resetTime: entry.resetTime,
        };
    }
    async getStatus(key) {
        const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`;
        const now = Date.now();
        const entry = this.storage.get(fullKey);
        if (!entry || now > entry.resetTime) {
            return {
                count: 0,
                remaining: this.config.maxRequests,
                resetTime: now + this.config.windowMs,
            };
        }
        return {
            count: entry.count,
            remaining: Math.max(0, this.config.maxRequests - entry.count),
            resetTime: entry.resetTime,
        };
    }
    async reset(key) {
        const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`;
        this.storage.delete(fullKey);
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.storage.entries()) {
            if (now > entry.resetTime) {
                this.storage.delete(key);
            }
        }
    }
    getStats() {
        const now = Date.now();
        let activeKeys = 0;
        let expiredKeys = 0;
        for (const entry of this.storage.values()) {
            if (now > entry.resetTime) {
                expiredKeys++;
            }
            else {
                activeKeys++;
            }
        }
        return {
            totalKeys: this.storage.size,
            activeKeys,
            expiredKeys,
        };
    }
    destroy() {
        clearInterval(this.cleanupInterval);
        this.storage.clear();
    }
}
exports.MemoryRateLimiter = MemoryRateLimiter;
class TieredRateLimiter {
    constructor(configs) {
        this.configs = configs;
        this.limiters = new Map();
        for (const [tier, config] of Object.entries(configs)) {
            this.limiters.set(tier, new MemoryRateLimiter(config));
        }
    }
    async check(tier, key) {
        const limiter = this.limiters.get(tier);
        if (!limiter) {
            throw new Error(`Rate limiter tier '${tier}' not found`);
        }
        const result = await limiter.isRateLimited(key);
        return {
            ...result,
            tier,
        };
    }
    async checkMultiple(tiers, key) {
        const results = await Promise.all(tiers.map(async (tier) => {
            const result = await this.check(tier, key);
            return { ...result, tier };
        }));
        const mostRestrictive = results.reduce((prev, curr) => {
            if (curr.limited && !prev.limited)
                return curr;
            if (!curr.limited && prev.limited)
                return prev;
            if (curr.remaining < prev.remaining)
                return curr;
            return prev;
        });
        return {
            limited: mostRestrictive.limited,
            remaining: mostRestrictive.remaining,
            resetTime: mostRestrictive.resetTime,
            restrictiveTier: mostRestrictive.tier,
        };
    }
    getAllStats() {
        const stats = {};
        for (const [tier, limiter] of this.limiters.entries()) {
            stats[tier] = limiter.getStats();
        }
        return stats;
    }
    async resetAll(key) {
        await Promise.all(Array.from(this.limiters.values()).map(limiter => limiter.reset(key)));
    }
    destroy() {
        for (const limiter of this.limiters.values()) {
            limiter.destroy();
        }
        this.limiters.clear();
    }
}
exports.TieredRateLimiter = TieredRateLimiter;
function createTelegramRateLimiter() {
    return new TieredRateLimiter({
        user: {
            maxRequests: 30,
            windowMs: 60 * 1000,
            keyPrefix: 'user',
        },
        chat: {
            maxRequests: 50,
            windowMs: 60 * 1000,
            keyPrefix: 'chat',
        },
        command: {
            maxRequests: 5,
            windowMs: 60 * 1000,
            keyPrefix: 'cmd',
        },
        summary: {
            maxRequests: 3,
            windowMs: 5 * 60 * 1000,
            keyPrefix: 'summary',
        },
        global: {
            maxRequests: 1000,
            windowMs: 60 * 1000,
            keyPrefix: 'global',
        },
    });
}
class RateLimitMiddleware {
    constructor(rateLimiter) {
        this.rateLimiter = rateLimiter;
    }
    async checkUserLimit(userId) {
        const result = await this.rateLimiter.check('user', userId.toString());
        return {
            allowed: !result.limited,
            reason: result.limited ? `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.` : undefined,
            resetTime: result.resetTime,
        };
    }
    async checkChatLimit(chatId) {
        const result = await this.rateLimiter.check('chat', chatId.toString());
        return {
            allowed: !result.limited,
            reason: result.limited ? 'This chat is sending too many messages. Please slow down.' : undefined,
            resetTime: result.resetTime,
        };
    }
    async checkCommandLimit(userId, command) {
        const key = `${userId}:${command}`;
        const result = await this.rateLimiter.check('command', key);
        return {
            allowed: !result.limited,
            reason: result.limited ? `You're using /${command} too frequently. Please wait a moment.` : undefined,
            resetTime: result.resetTime,
        };
    }
    async checkSummaryLimit(userId) {
        const result = await this.rateLimiter.check('summary', userId.toString());
        return {
            allowed: !result.limited,
            reason: result.limited ? `Summary generation is rate limited. Please wait ${Math.ceil((result.resetTime - Date.now()) / 60000)} minutes.` : undefined,
            resetTime: result.resetTime,
        };
    }
    async checkMultipleLimits(userId, chatId, command) {
        const checks = [
            this.rateLimiter.check('user', userId.toString()),
            this.rateLimiter.check('chat', chatId.toString()),
            this.rateLimiter.check('global', 'all'),
        ];
        if (command) {
            checks.push(this.rateLimiter.check('command', `${userId}:${command}`));
        }
        const results = await Promise.all(checks);
        const limited = results.find(r => r.limited);
        if (limited) {
            return {
                allowed: false,
                reason: this.getReasonForTier(limited.tier, limited.resetTime),
                restrictiveTier: limited.tier,
                resetTime: limited.resetTime,
            };
        }
        return { allowed: true };
    }
    getReasonForTier(tier, resetTime) {
        const waitTime = Math.ceil((resetTime - Date.now()) / 1000);
        switch (tier) {
            case 'user':
                return `You're sending messages too quickly. Please wait ${waitTime} seconds.`;
            case 'chat':
                return `This chat is too active. Please wait ${waitTime} seconds.`;
            case 'command':
                return `You're using commands too frequently. Please wait ${waitTime} seconds.`;
            case 'summary':
                return `Summary generation is limited. Please wait ${Math.ceil(waitTime / 60)} minutes.`;
            case 'global':
                return `The bot is currently busy. Please wait ${waitTime} seconds.`;
            default:
                return `Rate limit exceeded. Please wait ${waitTime} seconds.`;
        }
    }
}
exports.RateLimitMiddleware = RateLimitMiddleware;
let globalRateLimiter = null;
function getGlobalRateLimiter() {
    if (!globalRateLimiter) {
        globalRateLimiter = createTelegramRateLimiter();
    }
    return globalRateLimiter;
}
function createRateLimitMiddleware() {
    return new RateLimitMiddleware(getGlobalRateLimiter());
}
//# sourceMappingURL=rate-limiter.js.map