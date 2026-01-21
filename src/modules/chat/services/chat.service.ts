import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EventBusService } from '../../../shared/events/event-bus.service';
import { ChatMessage } from '../entities/chat-message.entity';

interface SendMessageParams {
  matchId: string;
  userId: string;
  username: string;
  message: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  private messages: Map<string, ChatMessage[]> = new Map();

  private readonly maxMessagesPerRoom = 100;

  constructor(private readonly eventBusService: EventBusService) {}

  async sendMessage(params: SendMessageParams): Promise<string> {
    const { matchId, userId, username, message } = params;

    const chatMessage: ChatMessage = {
      id: uuidv4(),
      matchId,
      userId,
      username,
      message: this.sanitizeMessage(message),
      createdAt: new Date(),
    };

    if (!this.messages.has(matchId)) {
      this.messages.set(matchId, []);
    }

    const roomMessages = this.messages.get(matchId)!;
    roomMessages.push(chatMessage);

    if (roomMessages.length > this.maxMessagesPerRoom) {
      roomMessages.shift();
    }

    this.logger.debug(`Message sent in match ${matchId} by ${username}`);

    this.eventBusService.emitChatMessage({
      matchId,
      messageId: chatMessage.id,
      userId,
      username,
      message: chatMessage.message,
      timestamp: chatMessage.createdAt,
    });

    return chatMessage.id;
  }

  getMessages(matchId: string, limit: number = 50): ChatMessage[] {
    const messages = this.messages.get(matchId) || [];
    return messages.slice(-limit);
  }

  getMessageCount(matchId: string): number {
    return this.messages.get(matchId)?.length || 0;
  }

  clearMessages(matchId: string): void {
    this.messages.delete(matchId);
  }

  private sanitizeMessage(message: string): string {
    return message
      .trim()
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
