import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../shared/cache/redis.service';

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  private readonly maxMessages = 10;
  private readonly windowSeconds = 10;

  private rateLimits: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(private readonly redisService: RedisService) {}

  async checkLimit(userId: string): Promise<boolean> {
    try {
      return await this.checkLimitRedis(userId);
    } catch {
      return this.checkLimitInMemory(userId);
    }
  }

  async getRemaining(userId: string): Promise<number> {
    try {
      const key = `ratelimit:chat:${userId}`;
      const count = await this.redisService.get(key);
      const currentCount = count ? parseInt(count, 10) : 0;
      return Math.max(0, this.maxMessages - currentCount);
    } catch {
      const limit = this.rateLimits.get(userId);
      if (!limit || limit.resetAt <= Date.now()) {
        return this.maxMessages;
      }
      return Math.max(0, this.maxMessages - limit.count);
    }
  }

  async resetLimit(userId: string): Promise<void> {
    try {
      const key = `ratelimit:chat:${userId}`;
      await this.redisService.del(key);
    } catch {
      this.rateLimits.delete(userId);
    }
  }

  private async checkLimitRedis(userId: string): Promise<boolean> {
    const key = `ratelimit:chat:${userId}`;
    const count = await this.redisService.incr(key);

    if (count === 1) {
      await this.redisService.expire(key, this.windowSeconds);
    }

    const allowed = count <= this.maxMessages;

    if (!allowed) {
      this.logger.debug(`Rate limit exceeded for user ${userId}: ${count}/${this.maxMessages}`);
    }

    return allowed;
  }

  private checkLimitInMemory(userId: string): boolean {
    const now = Date.now();
    const windowEnd = now + this.windowSeconds * 1000;

    let limit = this.rateLimits.get(userId);

    if (!limit || limit.resetAt <= now) {
      limit = { count: 0, resetAt: windowEnd };
      this.rateLimits.set(userId, limit);
    }

    limit.count++;

    const allowed = limit.count <= this.maxMessages;

    if (!allowed) {
      this.logger.debug(
        `Rate limit exceeded for user ${userId}: ${limit.count}/${this.maxMessages} (in-memory)`,
      );
    }

    return allowed;
  }
}
