import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EventBusService } from '../../../shared/events/event-bus.service';
import { ChatMessage } from '../entities/chat-message.entity';
import { SupabaseService } from '../../../shared/database/supabase/supabase.service';

interface SendMessageParams {
  matchId: string;
  userId: string;
  username: string;
  message: string;
}

interface ChatMessageRow {
  id: string;
  match_id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly tableName = 'chat_messages';
  private readonly maxMessagesPerRoom = 100;

  constructor(
    private readonly eventBusService: EventBusService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async sendMessage(params: SendMessageParams): Promise<string> {
    const { matchId, userId, username, message } = params;

    const sanitizedMessage = this.sanitizeMessage(message);
    const now = new Date();

    const chatMessageRow = await this.supabaseService.insert<ChatMessageRow>(
      this.tableName,
      {
        id: uuidv4(),
        match_id: matchId,
        user_id: userId,
        username,
        message: sanitizedMessage,
        created_at: now.toISOString(),
      },
    );

    this.logger.debug(`Message sent in match ${matchId} by ${username}`);

    this.eventBusService.emitChatMessage({
      matchId,
      messageId: chatMessageRow.id,
      userId,
      username,
      message: sanitizedMessage,
      timestamp: now,
    });

    const messageCount = await this.supabaseService.count(this.tableName, {
      match_id: matchId,
    });

    if (messageCount > this.maxMessagesPerRoom) {
      await this.cleanupOldMessages(matchId, messageCount - this.maxMessagesPerRoom);
    }

    return chatMessageRow.id;
  }

  async getMessages(matchId: string, limit: number = 50): Promise<ChatMessage[]> {
    const client = this.supabaseService.getClient();

    const { data: rows, error } = await client
      .from(this.tableName)
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      this.logger.error(`Database query error: ${error.message}`);
      return [];
    }

    return (rows || []).map((row) => this.toChatMessage(row as ChatMessageRow));
  }

  async getMessageCount(matchId: string): Promise<number> {
    return this.supabaseService.count(this.tableName, { match_id: matchId });
  }

  async clearMessages(matchId: string): Promise<void> {
    try {
      await this.supabaseService.delete(this.tableName, { match_id: matchId });
    } catch (error) {
      this.logger.error(`Failed to clear messages for match ${matchId}: ${error}`);
    }
  }

  private async cleanupOldMessages(matchId: string, countToRemove: number): Promise<void> {
    const client = this.supabaseService.getClient();

    const { data: oldMessages, error: selectError } = await client
      .from(this.tableName)
      .select('id')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
      .limit(countToRemove);

    if (selectError || !oldMessages || oldMessages.length === 0) {
      return;
    }

    const idsToDelete = oldMessages.map((msg) => msg.id);

    const { error: deleteError } = await client
      .from(this.tableName)
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      this.logger.error(`Failed to cleanup old messages: ${deleteError.message}`);
    }
  }

  private toChatMessage(row: ChatMessageRow): ChatMessage {
    return {
      id: row.id,
      matchId: row.match_id,
      userId: row.user_id,
      username: row.username,
      message: row.message,
      createdAt: new Date(row.created_at),
    };
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
