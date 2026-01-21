import { Injectable } from '@nestjs/common';
import { EventType } from '../../matches/enums/event-type.enum';
import {
  EventStrategy,
  GeneratedEvent,
  MatchContext,
  getRandomPlayer,
} from './event-strategy.interface';

@Injectable()
export class CardStrategy implements EventStrategy {
  private readonly yellowProbability = 0.04;
  private readonly redProbability = 0.001;

  shouldGenerate(minute: number, matchContext: MatchContext): boolean {
    let probability = this.yellowProbability;

    const scoreDiff = Math.abs(matchContext.homeScore - matchContext.awayScore);

    if (scoreDiff <= 1) {
      probability *= 1.3;
    }
    if (minute > 60) {
      probability *= 1.4;
    }

    return Math.random() < probability;
  }

  generate(team: 'home' | 'away', matchContext: MatchContext): GeneratedEvent {
    const players =
      team === 'home' ? matchContext.homePlayers : matchContext.awayPlayers;
    const teamName =
      team === 'home' ? matchContext.homeTeamName : matchContext.awayTeamName;

    const player = getRandomPlayer(players);
    const isRed = Math.random() < this.redProbability / this.yellowProbability;

    if (isRed) {
      return {
        type: EventType.RED_CARD,
        team,
        player,
        description: `RED CARD! ${player} of ${teamName} is sent off!`,
      };
    }

    const reasons = [
      'for a reckless challenge',
      'for dissent',
      'for a tactical foul',
      'for time wasting',
      'for unsporting behavior',
      'for a late challenge',
    ];
    const reason = reasons[Math.floor(Math.random() * reasons.length)];

    return {
      type: EventType.YELLOW_CARD,
      team,
      player,
      description: `Yellow card for ${player} (${teamName}) ${reason}.`,
    };
  }
}
