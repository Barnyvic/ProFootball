import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type MatchEventPayload,
  type ScoreUpdatePayload,
  type MatchStatusPayload,
  type ChatMessagePayload,
  type TypingPayload,
  type UserRoomPayload,
} from '../../../shared/events/event.interface';
import { EVENTS } from '../../../shared/common/constant/event.enum';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);
  private server: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  broadcastToMatch(matchId: string, event: string, data: unknown): void {
    if (!this.server) {
      this.logger.warn('Server not initialized, cannot broadcast');
      return;
    }

    this.server.to(`match:${matchId}`).emit(event, data);
    this.logger.debug(`Broadcast to match:${matchId} - event:${event}`);
  }

  broadcastToChat(matchId: string, event: string, data: unknown): void {
    if (!this.server) {
      this.logger.warn('Server not initialized, cannot broadcast');
      return;
    }

    this.server.to(`chat:${matchId}`).emit(event, data);
    this.logger.debug(`Broadcast to chat:${matchId} - event:${event}`);
  }

  broadcastToAll(event: string, data: unknown): void {
    if (!this.server) {
      this.logger.warn('Server not initialized, cannot broadcast');
      return;
    }

    this.server.emit(event, data);
    this.logger.debug(`Broadcast to all - event:${event}`);
  }


  @OnEvent(EVENTS.MATCH_EVENT)
  handleMatchEvent(payload: MatchEventPayload): void {
    this.broadcastToMatch(payload.matchId, 'match_event', {
      matchId: payload.matchId,
      type: payload.type,
      minute: payload.minute,
      team: payload.team,
      player: payload.player,
      description: payload.description,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent(EVENTS.SCORE_UPDATE)
  handleScoreUpdate(payload: ScoreUpdatePayload): void {
    this.broadcastToMatch(payload.matchId, 'score_update', {
      matchId: payload.matchId,
      homeScore: payload.homeScore,
      awayScore: payload.awayScore,
    });
  }

  @OnEvent(EVENTS.STATUS_CHANGE)
  handleStatusChange(payload: MatchStatusPayload): void {
    this.broadcastToMatch(payload.matchId, 'status_change', {
      matchId: payload.matchId,
      status: payload.status,
      minute: payload.minute,
    });
  }

  @OnEvent(EVENTS.CHAT_MESSAGE)
  handleChatMessage(payload: ChatMessagePayload): void {
    this.broadcastToChat(payload.matchId, 'chat_message', {
      id: payload.messageId,
      matchId: payload.matchId,
      userId: payload.userId,
      username: payload.username,
      message: payload.message,
      timestamp: payload.timestamp.toISOString(),
    });
  }

  @OnEvent(EVENTS.TYPING)
  handleTyping(payload: TypingPayload): void {
    this.broadcastToChat(payload.matchId, 'typing', {
      matchId: payload.matchId,
      userId: payload.userId,
      username: payload.username,
      isTyping: payload.isTyping,
    });
  }

  @OnEvent(EVENTS.USER_JOINED)
  handleUserJoined(payload: UserRoomPayload): void {
    this.broadcastToChat(payload.matchId, 'user_joined', {
      matchId: payload.matchId,
      userId: payload.userId,
      username: payload.username,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent(EVENTS.USER_LEFT)
  handleUserLeft(payload: UserRoomPayload): void {
    this.broadcastToChat(payload.matchId, 'user_left', {
      matchId: payload.matchId,
      userId: payload.userId,
      username: payload.username,
      timestamp: new Date().toISOString(),
    });
  }
}
