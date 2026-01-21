import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EventType } from '../../matches/enums/event-type.enum';
import { MatchesRepository } from '../../matches/repositories/matches.repository';
import { EventBusService } from '../../../shared/events/event-bus.service';
import { RedisService } from '../../../shared/cache/redis.service';
import { GoalStrategy } from '../strategies/goal.strategy';
import { CardStrategy } from '../strategies/card.strategy';
import { SubstitutionStrategy } from '../strategies/substitution.strategy';
import { MatchContext, GeneratedEvent } from '../strategies/event-strategy.interface';

@Injectable()
export class EventGeneratorService {
  private readonly logger = new Logger(EventGeneratorService.name);
  private readonly eventCountsKeyPrefix = 'match:event_counts:';

  constructor(
    private readonly matchesRepository: MatchesRepository,
    private readonly eventBusService: EventBusService,
    private readonly redisService: RedisService,
    private readonly goalStrategy: GoalStrategy,
    private readonly cardStrategy: CardStrategy,
    private readonly substitutionStrategy: SubstitutionStrategy,
  ) {}

  async generateEvents(matchId: string): Promise<void> {
    const match = await this.matchesRepository.findById(matchId);
    if (!match) return;

    const context = await this.buildMatchContext(matchId, match);

    await this.tryGenerateEvent(matchId, this.goalStrategy, context);
    await this.tryGenerateEvent(matchId, this.cardStrategy, context);
    await this.tryGenerateEvent(matchId, this.substitutionStrategy, context);
    await this.maybeGenerateFoul(matchId, context);
    await this.maybeGenerateShot(matchId, context);
  }

  private async buildMatchContext(
    matchId: string,
    match: Awaited<ReturnType<MatchesRepository['findById']>>,
  ): Promise<MatchContext> {
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    const eventCounts = await this.getEventCounts(matchId);

    return {
      minute: match.minute,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      homePlayers: this.getTeamPlayers(match.homeTeam.name),
      awayPlayers: this.getTeamPlayers(match.awayTeam.name),
      status: match.status,
      eventsGenerated: Array.from(eventCounts.entries()).map(([type, count]) => ({
        type,
        count,
      })),
    };
  }

  private async tryGenerateEvent(
    matchId: string,
    strategy: { shouldGenerate: Function; generate: Function },
    context: MatchContext,
  ): Promise<void> {
    if (strategy.shouldGenerate(context.minute, context)) {
      const team = this.selectTeam(context);
      const event = strategy.generate(team, context) as GeneratedEvent;

      await this.emitEvent(matchId, event, context.minute);

      if (event.type === EventType.GOAL) {
        await this.updateScore(matchId, team);
      }
    }
  }

  private async maybeGenerateFoul(matchId: string, context: MatchContext): Promise<void> {
    if (Math.random() < 0.4) {
      const team = this.selectTeam(context);
      const players = team === 'home' ? context.homePlayers : context.awayPlayers;
      const teamName = team === 'home' ? context.homeTeamName : context.awayTeamName;
      const player = players[Math.floor(Math.random() * players.length)];

      await this.emitEvent(
        matchId,
        {
          type: EventType.FOUL,
          team,
          player,
          description: `Foul committed by ${player} (${teamName}).`,
        },
        context.minute,
      );

      const match = await this.matchesRepository.findById(matchId);
      if (match) {
        const fouls = { ...match.statistics.fouls };
        fouls[team]++;
        await this.matchesRepository.updateStatistics(matchId, { fouls });
      }
    }
  }

  private async maybeGenerateShot(matchId: string, context: MatchContext): Promise<void> {
    if (Math.random() < 0.25) {
      const team = this.selectTeam(context);
      const players = team === 'home' ? context.homePlayers : context.awayPlayers;
      const teamName = team === 'home' ? context.homeTeamName : context.awayTeamName;
      const player = players[Math.floor(Math.random() * players.length)];
      const onTarget = Math.random() < 0.35;

      await this.emitEvent(
        matchId,
        {
          type: EventType.SHOT,
          team,
          player,
          description: onTarget
            ? `Shot on target by ${player} (${teamName})!`
            : `Shot by ${player} (${teamName}) goes wide.`,
        },
        context.minute,
      );

      const match = await this.matchesRepository.findById(matchId);
      if (match) {
        const shots = { ...match.statistics.shots };
        const shotsOnTarget = { ...match.statistics.shotsOnTarget };
        shots[team]++;
        if (onTarget) {
          shotsOnTarget[team]++;
        }
        await this.matchesRepository.updateStatistics(matchId, { shots, shotsOnTarget });
      }
    }
  }

  private selectTeam(context: MatchContext): 'home' | 'away' {
    return Math.random() < 0.55 ? 'home' : 'away';
  }

  private async emitEvent(matchId: string, event: GeneratedEvent, minute: number): Promise<void> {
    await this.incrementEventCount(matchId, event.type);

    const matchEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      matchId,
      type: event.type,
      minute,
      team: event.team,
      player: event.player,
      assistPlayer: event.assistPlayer,
      description: event.description,
      timestamp: new Date(),
    };

    await this.matchesRepository.addEvent(matchId, matchEvent);

    this.eventBusService.emitMatchEvent({
      matchId,
      type: event.type,
      minute,
      team: event.team,
      player: event.player,
      description: event.description,
    });

    this.logger.debug(`Event generated for match ${matchId}: ${event.type} at ${minute}'`);
  }

  private async updateScore(matchId: string, team: 'home' | 'away'): Promise<void> {
    const match = await this.matchesRepository.findById(matchId);
    if (!match) return;

    const homeScore = team === 'home' ? match.homeScore + 1 : match.homeScore;
    const awayScore = team === 'away' ? match.awayScore + 1 : match.awayScore;

    await this.matchesRepository.updateScore(matchId, homeScore, awayScore);

    this.eventBusService.emitScoreUpdate({
      matchId,
      homeScore,
      awayScore,
    });

    this.logger.log(`Score update: ${homeScore}-${awayScore} for match ${matchId}`);
  }

  private getTeamPlayers(teamName: string): string[] {
    const firstNames = [
      'James',
      'Marcus',
      'Kevin',
      'Mohamed',
      'Bruno',
      'Harry',
      'Raheem',
      'Mason',
      'Jadon',
      'Phil',
      'Declan',
      'Jack',
      'Bukayo',
      'Trent',
      'Jordan',
      'Andrew',
    ];

    const lastNames = [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
      'Rodriguez',
      'Martinez',
      'Wilson',
      'Anderson',
      'Taylor',
      'Thomas',
      'Moore',
      'Jackson',
    ];

    const players: string[] = [];
    for (let i = 0; i < 14; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      players.push(`${firstName} ${lastName}`);
    }

    return players;
  }

  async clearMatchEvents(matchId: string): Promise<void> {
    try {
      const key = this.getEventCountsKey(matchId);
      await this.redisService.del(key);
    } catch (error) {
      this.logger.error(`Failed to clear event counts for match ${matchId}: ${error}`);
    }
  }

  private getEventCountsKey(matchId: string): string {
    return `${this.eventCountsKeyPrefix}${matchId}`;
  }

  private async getEventCounts(matchId: string): Promise<Map<EventType, number>> {
    try {
      const key = this.getEventCountsKey(matchId);
      const client = this.redisService.getClient();
      const counts = await client.hgetall(key);

      const eventCounts = new Map<EventType, number>();
      for (const [eventType, countStr] of Object.entries(counts)) {
        const count = parseInt(countStr, 10);
        if (!isNaN(count)) {
          eventCounts.set(eventType as EventType, count);
        }
      }

      return eventCounts;
    } catch (error) {
      this.logger.error(`Failed to get event counts for match ${matchId}: ${error}`);
      return new Map();
    }
  }

  private async incrementEventCount(matchId: string, eventType: EventType): Promise<void> {
    try {
      const key = this.getEventCountsKey(matchId);
      const client = this.redisService.getClient();
      await client.hincrby(key, eventType, 1);
      await client.expire(key, 4 * 60 * 60);
    } catch (error) {
      this.logger.error(`Failed to increment event count for match ${matchId}: ${error}`);
    }
  }
}
