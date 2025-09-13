// Rate Limiting Utility

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

/**
 * Simple in-memory rate limiter
 * In production, you should use Redis or similar for distributed rate limiting
 */
export class MemoryRateLimiter {
  private storage: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: RateLimitConfig) {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a request is rate limited
   */
  async isRateLimited(key: string): Promise<{
    limited: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`;
    const now = Date.now();
    
    let entry = this.storage.get(fullKey);
    
    // If entry doesn't exist or has expired, create a new one
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
    }
    
    // Increment the count
    entry.count++;
    
    // Store the updated entry
    this.storage.set(fullKey, entry);
    
    const limited = entry.count > this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    
    return {
      limited,
      remaining,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getStatus(key: string): Promise<{
    count: number;
    remaining: number;
    resetTime: number;
  }> {
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

  /**
   * Reset rate limit for a specific key
   */
  async reset(key: string): Promise<void> {
    const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`;
    this.storage.delete(fullKey);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.storage.entries()) {
      if (now > entry.resetTime) {
        this.storage.delete(key);
      }
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
  } {
    const now = Date.now();
    let activeKeys = 0;
    let expiredKeys = 0;
    
    for (const entry of this.storage.values()) {
      if (now > entry.resetTime) {
        expiredKeys++;
      } else {
        activeKeys++;
      }
    }
    
    return {
      totalKeys: this.storage.size,
      activeKeys,
      expiredKeys,
    };
  }

  /**
   * Cleanup and destroy the rate limiter
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.storage.clear();
  }
}

/**
 * Multi-tier rate limiter with different limits for different actions
 */
export class TieredRateLimiter {
  private limiters: Map<string, MemoryRateLimiter> = new Map();

  constructor(private configs: Record<string, RateLimitConfig>) {
    for (const [tier, config] of Object.entries(configs)) {
      this.limiters.set(tier, new MemoryRateLimiter(config));
    }
  }

  /**
   * Check rate limit for a specific tier
   */
  async check(tier: string, key: string): Promise<{
    limited: boolean;
    remaining: number;
    resetTime: number;
    tier: string;
  }> {
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

  /**
   * Check multiple tiers and return the most restrictive result
   */
  async checkMultiple(tiers: string[], key: string): Promise<{
    limited: boolean;
    remaining: number;
    resetTime: number;
    restrictiveTier: string;
  }> {
    const results = await Promise.all(
      tiers.map(async (tier) => {
        const result = await this.check(tier, key);
        return { ...result, tier };
      })
    );

    // Find the most restrictive result (lowest remaining or already limited)
    const mostRestrictive = results.reduce((prev, curr) => {
      if (curr.limited && !prev.limited) return curr;
      if (!curr.limited && prev.limited) return prev;
      if (curr.remaining < prev.remaining) return curr;
      return prev;
    });

    return {
      limited: mostRestrictive.limited,
      remaining: mostRestrictive.remaining,
      resetTime: mostRestrictive.resetTime,
      restrictiveTier: mostRestrictive.tier,
    };
  }

  /**
   * Get stats for all tiers
   */
  getAllStats(): Record<string, ReturnType<MemoryRateLimiter['getStats']>> {
    const stats: Record<string, any> = {};
    
    for (const [tier, limiter] of this.limiters.entries()) {
      stats[tier] = limiter.getStats();
    }
    
    return stats;
  }

  /**
   * Reset rate limit for a key across all tiers
   */
  async resetAll(key: string): Promise<void> {
    await Promise.all(
      Array.from(this.limiters.values()).map(limiter => limiter.reset(key))
    );
  }

  /**
   * Destroy all limiters
   */
  destroy(): void {
    for (const limiter of this.limiters.values()) {
      limiter.destroy();
    }
    this.limiters.clear();
  }
}

/**
 * Create a rate limiter for Telegram bot usage
 */
export function createTelegramRateLimiter(): TieredRateLimiter {
  return new TieredRateLimiter({
    // User-level limits (per user across all chats)
    user: {
      maxRequests: 30,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'user',
    },
    
    // Chat-level limits (per chat for all users)
    chat: {
      maxRequests: 50,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'chat',
    },
    
    // Command-specific limits (for expensive operations)
    command: {
      maxRequests: 5,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'cmd',
    },
    
    // Summary generation limits (very expensive)
    summary: {
      maxRequests: 3,
      windowMs: 5 * 60 * 1000, // 5 minutes
      keyPrefix: 'summary',
    },
    
    // Global limits (across all users and chats)
    global: {
      maxRequests: 1000,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'global',
    },
  });
}

/**
 * Rate limiting middleware for different scenarios
 */
export class RateLimitMiddleware {
  constructor(private rateLimiter: TieredRateLimiter) {}

  /**
   * Check user rate limit
   */
  async checkUserLimit(userId: number): Promise<{
    allowed: boolean;
    reason?: string;
    resetTime?: number;
  }> {
    const result = await this.rateLimiter.check('user', userId.toString());
    
    return {
      allowed: !result.limited,
      reason: result.limited ? `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.` : undefined,
      resetTime: result.resetTime,
    };
  }

  /**
   * Check chat rate limit
   */
  async checkChatLimit(chatId: number): Promise<{
    allowed: boolean;
    reason?: string;
    resetTime?: number;
  }> {
    const result = await this.rateLimiter.check('chat', chatId.toString());
    
    return {
      allowed: !result.limited,
      reason: result.limited ? 'This chat is sending too many messages. Please slow down.' : undefined,
      resetTime: result.resetTime,
    };
  }

  /**
   * Check command-specific rate limit
   */
  async checkCommandLimit(userId: number, command: string): Promise<{
    allowed: boolean;
    reason?: string;
    resetTime?: number;
  }> {
    const key = `${userId}:${command}`;
    const result = await this.rateLimiter.check('command', key);
    
    return {
      allowed: !result.limited,
      reason: result.limited ? `You're using /${command} too frequently. Please wait a moment.` : undefined,
      resetTime: result.resetTime,
    };
  }

  /**
   * Check summary generation limit
   */
  async checkSummaryLimit(userId: number): Promise<{
    allowed: boolean;
    reason?: string;
    resetTime?: number;
  }> {
    const result = await this.rateLimiter.check('summary', userId.toString());
    
    return {
      allowed: !result.limited,
      reason: result.limited ? `Summary generation is rate limited. Please wait ${Math.ceil((result.resetTime - Date.now()) / 60000)} minutes.` : undefined,
      resetTime: result.resetTime,
    };
  }

  /**
   * Check multiple limits at once
   */
  async checkMultipleLimits(
    userId: number,
    chatId: number,
    command?: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    restrictiveTier?: string;
    resetTime?: number;
  }> {
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

  /**
   * Get human-readable reason for rate limit
   */
  private getReasonForTier(tier: string, resetTime: number): string {
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

// Global rate limiter instance
let globalRateLimiter: TieredRateLimiter | null = null;

/**
 * Get the global rate limiter instance
 */
export function getGlobalRateLimiter(): TieredRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = createTelegramRateLimiter();
  }
  return globalRateLimiter;
}

/**
 * Create rate limit middleware instance
 */
export function createRateLimitMiddleware(): RateLimitMiddleware {
  return new RateLimitMiddleware(getGlobalRateLimiter());
}