import { Injectable, Logger } from '@nestjs/common';
import { Match, MatchStatistics, createDefaultStatistics } from '../entities/match.entity';
import { MatchEvent } from '../entities/match-event.entity';
import { MatchStatus } from '../enums/match-status.enum';
import { Team } from '../entities/team.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MatchesRepository {
  private readonly logger = new Logger(MatchesRepository.name);
  private matches: Map<string, Match> = new Map();

  findAll(): Match[] {
    return Array.from(this.matches.values());
  }

  findByStatus(status: MatchStatus): Match[] {
    return this.findAll().filter((match) => match.status === status);
  }

  findById(id: string): Match | null {
    return this.matches.get(id) || null;
  }

  create(homeTeam: Team, awayTeam: Team, startTime?: Date): Match {
    const id = uuidv4();
    const now = new Date();

    const match: Match = {
      id,
      homeTeam,
      awayTeam,
      homeScore: 0,
      awayScore: 0,
      minute: 0,
      status: MatchStatus.NOT_STARTED,
      startTime: startTime || now,
      events: [],
      statistics: createDefaultStatistics(),
      createdAt: now,
      updatedAt: now,
    };

    this.matches.set(id, match);
    this.logger.debug(`Created match ${id}: ${homeTeam.name} vs ${awayTeam.name}`);

    return match;
  }

  updateScore(id: string, homeScore: number, awayScore: number): Match | null {
    const match = this.matches.get(id);
    if (!match) return null;

    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.updatedAt = new Date();

    return match;
  }

  updateMinute(id: string, minute: number): Match | null {
    const match = this.matches.get(id);
    if (!match) return null;

    match.minute = minute;
    match.updatedAt = new Date();

    return match;
  }

  updateStatus(id: string, status: MatchStatus): Match | null {
    const match = this.matches.get(id);
    if (!match) return null;

    match.status = status;
    match.updatedAt = new Date();

    this.logger.debug(`Match ${id} status changed to ${status}`);

    return match;
  }

  addEvent(id: string, event: MatchEvent): Match | null {
    const match = this.matches.get(id);
    if (!match) return null;

    match.events.push(event);
    match.updatedAt = new Date();

    return match;
  }

  updateStatistics(id: string, statistics: Partial<MatchStatistics>): Match | null {
    const match = this.matches.get(id);
    if (!match) return null;

    match.statistics = { ...match.statistics, ...statistics };
    match.updatedAt = new Date();

    return match;
  }

  getEvents(id: string): MatchEvent[] {
    const match = this.matches.get(id);
    return match?.events || [];
  }

  getEventsAfterId(matchId: string, lastEventId: string): MatchEvent[] {
    const match = this.matches.get(matchId);
    if (!match) return [];

    const lastIndex = match.events.findIndex((e) => e.id === lastEventId);
    if (lastIndex === -1) return match.events;

    return match.events.slice(lastIndex + 1);
  }

  delete(id: string): boolean {
    return this.matches.delete(id);
  }

  clear(): void {
    this.matches.clear();
  }

  count(): number {
    return this.matches.size;
  }
}
