import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('redis.url');

    if (!redisUrl) {
      this.logger.warn('Redis URL not configured. Cache features will be unavailable.');
      return;
    }

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });

    this.client.connect().catch((err) => {
      this.logger.error(`Redis connection failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.getClient().setex(key, ttlSeconds, value);
    } else {
      await this.getClient().set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  async del(key: string): Promise<number> {
    return this.getClient().del(key);
  }


  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.getClient().sadd(key, ...members);
  }


  async srem(key: string, ...members: string[]): Promise<number> {
    return this.getClient().srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.getClient().smembers(key);
  }

  async scard(key: string): Promise<number> {
    return this.getClient().scard(key);
  }


  async incr(key: string): Promise<number> {
    return this.getClient().incr(key);
  }


  async expire(key: string, seconds: number): Promise<number> {
    return this.getClient().expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.getClient().ttl(key);
  }

  async exists(key: string): Promise<number> {
    return this.getClient().exists(key);
  }
}
