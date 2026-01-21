import { Module, forwardRef } from '@nestjs/common';
import { ChatService } from './services/chat.service';
import { TypingIndicatorService } from './services/typing-indicator.service';
import { RateLimiterService } from './services/rate-limiter.service';

@Module({
  providers: [ChatService, TypingIndicatorService, RateLimiterService],
  exports: [ChatService, TypingIndicatorService, RateLimiterService],
})
export class ChatModule {}
