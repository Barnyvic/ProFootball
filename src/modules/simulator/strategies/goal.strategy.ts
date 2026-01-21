import { Injectable } from '@nestjs/common';
import { EventType } from '../../matches/enums/event-type.enum';
import {
  EventStrategy,
  GeneratedEvent,
  MatchContext,
  getRandomPlayer,
  getTwoRandomPlayers,
} from './event-strategy.interface';

@Injectable()
export class GoalStrategy implements EventStrategy {
  private readonly baseProbability = 0.028;

  shouldGenerate(minute: number, matchContext: MatchContext): boolean {
    let probability = this.baseProbability;

    if (minute > 45) {
      probability *= 1.2;
    }

    if ((minute >= 43 && minute <= 45) || (minute >= 88 && minute <= 90)) {
      probability *= 1.5;
    }

    return Math.random() < probability;
  }

  generate(team: 'home' | 'away', matchContext: MatchContext): GeneratedEvent {
    const players =
      team === 'home' ? matchContext.homePlayers : matchContext.awayPlayers;
    const teamName =
      team === 'home' ? matchContext.homeTeamName : matchContext.awayTeamName;

    const [scorer, assist] = getTwoRandomPlayers(players);
    const hasAssist = Math.random() > 0.3;

    return {
      type: EventType.GOAL,
      team,
      player: scorer,
      assistPlayer: hasAssist ? assist : undefined,
      description: hasAssist
        ? `GOAL! ${scorer} scores for ${teamName}! Assisted by ${assist}.`
        : `GOAL! ${scorer} scores for ${teamName}!`,
    };
  }
}
