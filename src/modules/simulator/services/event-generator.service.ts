import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EventType } from '../../matches/enums/event-type.enum';
import { MatchesRepository } from '../../matches/repositories/matches.repository';
import { EventBusService } from '../../../shared/events/event-bus.service';
import { GoalStrategy } from '../strategies/goal.strategy';
import { CardStrategy } from '../strategies/card.strategy';
import { SubstitutionStrategy } from '../strategies/substitution.strategy';
import { MatchContext, GeneratedEvent } from '../strategies/event-strategy.interface';

@Injectable()
export class EventGeneratorService {
  private readonly logger = new Logger(EventGeneratorService.name);

  private matchEventCounts: Map<string, Map<EventType, number>> = new Map();

  constructor(
    private readonly matchesRepository: MatchesRepository,
    private readonly eventBusService: EventBusService,
    private readonly goalStrategy: GoalStrategy,
    private readonly cardStrategy: CardStrategy,
    private readonly substitutionStrategy: SubstitutionStrategy,
  ) {}

  generateEvents(matchId: string): void {
    const match = this.matchesRepository.findById(matchId);
    if (!match) return;

    const context = this.buildMatchContext(matchId, match);

    this.tryGenerateEvent(matchId, this.goalStrategy, context);
    this.tryGenerateEvent(matchId, this.cardStrategy, context);
    this.tryGenerateEvent(matchId, this.substitutionStrategy, context);
    this.maybeGenerateFoul(matchId, context);
    this.maybeGenerateShot(matchId, context);
  }

  private buildMatchContext(
    matchId: string,
    match: ReturnType<MatchesRepository['findById']>,
  ): MatchContext {
    const eventCounts = this.matchEventCounts.get(matchId) || new Map();

    return {
      minute: match!.minute,
      homeScore: match!.homeScore,
      awayScore: match!.awayScore,
      homeTeamName: match!.homeTeam.name,
      awayTeamName: match!.awayTeam.name,
      homePlayers: this.getTeamPlayers(match!.homeTeam.name),
      awayPlayers: this.getTeamPlayers(match!.awayTeam.name),
      status: match!.status,
      eventsGenerated: Array.from(eventCounts.entries()).map(([type, count]) => ({
        type,
        count,
      })),
    };
  }

  private tryGenerateEvent(
    matchId: string,
    strategy: { shouldGenerate: Function; generate: Function },
    context: MatchContext,
  ): void {
    if (strategy.shouldGenerate(context.minute, context)) {
      const team = this.selectTeam(context);
      const event = strategy.generate(team, context) as GeneratedEvent;

      this.emitEvent(matchId, event, context.minute);

      if (event.type === EventType.GOAL) {
        this.updateScore(matchId, team);
      }
    }
  }

  private maybeGenerateFoul(matchId: string, context: MatchContext): void {
    if (Math.random() < 0.4) {
      const team = this.selectTeam(context);
      const players = team === 'home' ? context.homePlayers : context.awayPlayers;
      const teamName = team === 'home' ? context.homeTeamName : context.awayTeamName;
      const player = players[Math.floor(Math.random() * players.length)];

      this.emitEvent(
        matchId,
        {
          type: EventType.FOUL,
          team,
          player,
          description: `Foul committed by ${player} (${teamName}).`,
        },
        context.minute,
      );

      const match = this.matchesRepository.findById(matchId);
      if (match) {
        const fouls = { ...match.statistics.fouls };
        fouls[team]++;
        this.matchesRepository.updateStatistics(matchId, { fouls });
      }
    }
  }

  private maybeGenerateShot(matchId: string, context: MatchContext): void {
    if (Math.random() < 0.25) {
      const team = this.selectTeam(context);
      const players = team === 'home' ? context.homePlayers : context.awayPlayers;
      const teamName = team === 'home' ? context.homeTeamName : context.awayTeamName;
      const player = players[Math.floor(Math.random() * players.length)];
      const onTarget = Math.random() < 0.35;

      this.emitEvent(
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

      const match = this.matchesRepository.findById(matchId);
      if (match) {
        const shots = { ...match.statistics.shots };
        const shotsOnTarget = { ...match.statistics.shotsOnTarget };
        shots[team]++;
        if (onTarget) {
          shotsOnTarget[team]++;
        }
        this.matchesRepository.updateStatistics(matchId, { shots, shotsOnTarget });
      }
    }
  }

  private selectTeam(context: MatchContext): 'home' | 'away' {
    return Math.random() < 0.55 ? 'home' : 'away';
  }

  private emitEvent(matchId: string, event: GeneratedEvent, minute: number): void {
    if (!this.matchEventCounts.has(matchId)) {
      this.matchEventCounts.set(matchId, new Map());
    }
    const counts = this.matchEventCounts.get(matchId)!;
    counts.set(event.type, (counts.get(event.type) || 0) + 1);

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

  private updateScore(matchId: string, team: 'home' | 'away'): void {
    const match = this.matchesRepository.findById(matchId);
    if (!match) return;

    const homeScore = team === 'home' ? match.homeScore + 1 : match.homeScore;
    const awayScore = team === 'away' ? match.awayScore + 1 : match.awayScore;

    this.matchesRepository.updateScore(matchId, homeScore, awayScore);

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

  clearMatchEvents(matchId: string): void {
    this.matchEventCounts.delete(matchId);
  }
}
