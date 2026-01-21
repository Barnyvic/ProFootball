import { Injectable, Logger } from '@nestjs/common';
import { MatchesRepository } from '../../matches/repositories/matches.repository';
import { MatchStatus } from '../../matches/enums/match-status.enum';
import { EventBusService } from '../../../shared/events/event-bus.service';

@Injectable()
export class MatchLifecycleService {
  private readonly logger = new Logger(MatchLifecycleService.name);

  constructor(
    private readonly matchesRepository: MatchesRepository,
    private readonly eventBusService: EventBusService,
  ) {}

  async checkAndTransition(matchId: string, minute: number): Promise<MatchStatus | null> {
    const match = await this.matchesRepository.findById(matchId);
    if (!match) return null;

    const currentStatus = match.status;
    let newStatus: MatchStatus | null = null;

    switch (currentStatus) {
      case MatchStatus.NOT_STARTED:
        if (minute >= 0) {
          newStatus = MatchStatus.FIRST_HALF;
        }
        break;

      case MatchStatus.FIRST_HALF:
        if (minute >= 45) {
          newStatus = MatchStatus.HALF_TIME;
        }
        break;

      case MatchStatus.HALF_TIME:
        if (minute >= 46) {
          newStatus = MatchStatus.SECOND_HALF;
        }
        break;

      case MatchStatus.SECOND_HALF:
        if (minute >= 90) {
          newStatus = MatchStatus.FULL_TIME;
        }
        break;

      case MatchStatus.FULL_TIME:
        break;
    }

    if (newStatus && newStatus !== currentStatus) {
      await this.matchesRepository.updateStatus(matchId, newStatus);

      this.eventBusService.emitStatusChange({
        matchId,
        status: newStatus,
        minute,
      });

      this.logger.log(
        `Match ${matchId} transitioned from ${currentStatus} to ${newStatus} at minute ${minute}`,
      );

      return newStatus;
    }

    return null;
  }

  async startMatch(matchId: string): Promise<boolean> {
    const match = await this.matchesRepository.findById(matchId);
    if (!match || match.status !== MatchStatus.NOT_STARTED) {
      return false;
    }

    await this.matchesRepository.updateMinute(matchId, 0);
    await this.matchesRepository.updateStatus(matchId, MatchStatus.FIRST_HALF);

    this.eventBusService.emitStatusChange({
      matchId,
      status: MatchStatus.FIRST_HALF,
      minute: 0,
    });

    this.logger.log(`Match ${matchId} started`);
    return true;
  }

  async isPlayable(matchId: string): Promise<boolean> {
    const match = await this.matchesRepository.findById(matchId);
    if (!match) return false;

    return [MatchStatus.FIRST_HALF, MatchStatus.SECOND_HALF].includes(match.status);
  }

  async isHalfTime(matchId: string): Promise<boolean> {
    const match = await this.matchesRepository.findById(matchId);
    return match?.status === MatchStatus.HALF_TIME;
  }

  async isFinished(matchId: string): Promise<boolean> {
    const match = await this.matchesRepository.findById(matchId);
    return match?.status === MatchStatus.FULL_TIME;
  }

  getHalfTimeBreakDuration(): number {
    return 1;
  }
}
