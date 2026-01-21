import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MatchEventPayload, ScoreUpdatePayload, MatchStatusPayload, ChatMessagePayload, TypingPayload, UserRoomPayload } from './event.interface';
import { EVENTS } from '../common/constant/event.enum';


@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  emitMatchEvent(payload: MatchEventPayload): void {
    this.logger.debug(`Emitting match event: ${payload.type} for match ${payload.matchId}`);
    this.eventEmitter.emit(EVENTS.MATCH_EVENT, payload);
  }

  emitScoreUpdate(payload: ScoreUpdatePayload): void {
    this.logger.debug(
      `Emitting score update: ${payload.homeScore}-${payload.awayScore} for match ${payload.matchId}`,
    );
    this.eventEmitter.emit(EVENTS.SCORE_UPDATE, payload);
  }

  emitStatusChange(payload: MatchStatusPayload): void {
    this.logger.debug(`Emitting status change: ${payload.status} for match ${payload.matchId}`);
    this.eventEmitter.emit(EVENTS.STATUS_CHANGE, payload);
  }

  emitChatMessage(payload: ChatMessagePayload): void {
    this.logger.debug(`Emitting chat message in match ${payload.matchId}`);
    this.eventEmitter.emit(EVENTS.CHAT_MESSAGE, payload);
  }

  emitTyping(payload: TypingPayload): void {
    this.eventEmitter.emit(EVENTS.TYPING, payload);
  }

  emitUserJoined(payload: UserRoomPayload): void {
    this.logger.debug(`User ${payload.username} joined match ${payload.matchId}`);
    this.eventEmitter.emit(EVENTS.USER_JOINED, payload);
  }


  emitUserLeft(payload: UserRoomPayload): void {
    this.logger.debug(`User ${payload.username} left match ${payload.matchId}`);
    this.eventEmitter.emit(EVENTS.USER_LEFT, payload);
  }
}
