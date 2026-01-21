import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Subject, Observable } from 'rxjs';
import { MatchesRepository } from '../repositories/matches.repository';
import type { MatchEvent } from '../entities/match-event.entity';
import { type MatchEventPayload, type ScoreUpdatePayload, type MatchStatusPayload } from '../../../shared/events/event.interface';
import { EVENTS } from '../../../shared/common/constant/event.enum';

interface SSEMessage {
  id: string;
  type: string;
  data: unknown;
}

@Injectable()
export class MatchEventsService {
  private readonly logger = new Logger(MatchEventsService.name);

  private eventStreams: Map<string, Subject<SSEMessage>[]> = new Map();

  constructor(private readonly matchesRepository: MatchesRepository) {}

  async createEventStream(matchId: string, lastEventId?: string): Promise<Observable<SSEMessage>> {
    const match = await this.matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    const subject = new Subject<SSEMessage>();

    if (!this.eventStreams.has(matchId)) {
      this.eventStreams.set(matchId, []);
    }
    this.eventStreams.get(matchId)!.push(subject);

    this.logger.debug(`SSE client connected to match ${matchId}`);

    if (lastEventId) {
      const missedEvents = await this.matchesRepository.getEventsAfterId(matchId, lastEventId);
      missedEvents.forEach((event) => {
        subject.next({
          id: event.id,
          type: 'match_event',
          data: event,
        });
      });
    }

    return new Observable((observer) => {
      const subscription = subject.subscribe(observer);

      return () => {
        subscription.unsubscribe();
        this.removeStream(matchId, subject);
        this.logger.debug(`SSE client disconnected from match ${matchId}`);
      };
    });
  }

  private removeStream(matchId: string, subject: Subject<SSEMessage>): void {
    const streams = this.eventStreams.get(matchId);
    if (streams) {
      const index = streams.indexOf(subject);
      if (index > -1) {
        streams.splice(index, 1);
      }
      if (streams.length === 0) {
        this.eventStreams.delete(matchId);
      }
    }
  }

  private broadcastToMatch(matchId: string, message: SSEMessage): void {
    const streams = this.eventStreams.get(matchId);
    if (streams) {
      streams.forEach((subject) => subject.next(message));
    }
  }

  @OnEvent(EVENTS.MATCH_EVENT)
  async handleMatchEvent(payload: MatchEventPayload): Promise<void> {
    const event: MatchEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      matchId: payload.matchId,
      type: payload.type as MatchEvent['type'],
      minute: payload.minute,
      team: payload.team,
      player: payload.player,
      description: payload.description,
      timestamp: new Date(),
    };

    await this.matchesRepository.addEvent(payload.matchId, event);

    this.broadcastToMatch(payload.matchId, {
      id: event.id,
      type: 'match_event',
      data: {
        type: event.type,
        minute: event.minute,
        team: event.team,
        player: event.player,
        description: event.description,
      },
    });
  }

  @OnEvent(EVENTS.SCORE_UPDATE)
  handleScoreUpdate(payload: ScoreUpdatePayload): void {
    this.broadcastToMatch(payload.matchId, {
      id: `score_${Date.now()}`,
      type: 'score_update',
      data: {
        homeScore: payload.homeScore,
        awayScore: payload.awayScore,
      },
    });
  }

  @OnEvent(EVENTS.STATUS_CHANGE)
  handleStatusChange(payload: MatchStatusPayload): void {
    this.broadcastToMatch(payload.matchId, {
      id: `status_${Date.now()}`,
      type: 'status_change',
      data: {
        status: payload.status,
        minute: payload.minute,
      },
    });
  }

  getConnectedCount(matchId: string): number {
    return this.eventStreams.get(matchId)?.length || 0;
  }
}
