import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../shared/cache/redis.service';
import { EventBusService } from '../../../shared/events/event-bus.service';

@Injectable()
export class TypingIndicatorService {
  private readonly logger = new Logger(TypingIndicatorService.name);

  private readonly typingTtl = 5;

  private typingUsers: Map<string, Map<string, { username: string; expiresAt: number }>> =
    new Map();

  constructor(
    private readonly redisService: RedisService,
    private readonly eventBusService: EventBusService,
  ) {
    setInterval(() => this.cleanupExpiredTyping(), 1000);
  }

  async startTyping(matchId: string, userId: string, username: string): Promise<void> {
    try {
      const key = `typing:${matchId}:${userId}`;
      await this.redisService.set(key, username, this.typingTtl);
    } catch {
      this.setTypingInMemory(matchId, userId, username);
    }

    this.eventBusService.emitTyping({
      matchId,
      userId,
      username,
      isTyping: true,
    });
  }

  async stopTyping(matchId: string, userId: string, username: string): Promise<void> {
    try {
      const key = `typing:${matchId}:${userId}`;
      await this.redisService.del(key);
    } catch {
      this.removeTypingInMemory(matchId, userId);
    }

    this.eventBusService.emitTyping({
      matchId,
      userId,
      username,
      isTyping: false,
    });
  }

  async getTypingUsers(matchId: string): Promise<{ userId: string; username: string }[]> {
    try {
      const pattern = `typing:${matchId}:*`;
      const client = this.redisService.getClient();
      const keys = await client.keys(pattern);

      const users: { userId: string; username: string }[] = [];

      for (const key of keys) {
        const username = await this.redisService.get(key);
        if (username) {
          const userId = key.split(':')[2];
          users.push({ userId, username });
        }
      }

      return users;
    } catch {
      return this.getTypingInMemory(matchId);
    }
  }

  private setTypingInMemory(matchId: string, userId: string, username: string): void {
    if (!this.typingUsers.has(matchId)) {
      this.typingUsers.set(matchId, new Map());
    }

    this.typingUsers.get(matchId)!.set(userId, {
      username,
      expiresAt: Date.now() + this.typingTtl * 1000,
    });
  }

  private removeTypingInMemory(matchId: string, userId: string): void {
    this.typingUsers.get(matchId)?.delete(userId);
  }

  private getTypingInMemory(matchId: string): { userId: string; username: string }[] {
    const roomTyping = this.typingUsers.get(matchId);
    if (!roomTyping) return [];

    const now = Date.now();
    const users: { userId: string; username: string }[] = [];

    roomTyping.forEach((data, odUserId) => {
      if (data.expiresAt > now) {
        users.push({ userId: odUserId, username: data.username });
      }
    });

    return users;
  }

  private cleanupExpiredTyping(): void {
    const now = Date.now();

    this.typingUsers.forEach((roomTyping, matchId) => {
      roomTyping.forEach((data, odUserId) => {
        if (data.expiresAt <= now) {
          roomTyping.delete(odUserId);
        }
      });

      if (roomTyping.size === 0) {
        this.typingUsers.delete(matchId);
      }
    });
  }
}
