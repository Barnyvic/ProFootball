import { Injectable } from '@nestjs/common';
import { EventType } from '../../matches/enums/event-type.enum';
import {
  EventStrategy,
  GeneratedEvent,
  MatchContext,
  getTwoRandomPlayers,
} from './event-strategy.interface';

@Injectable()
export class SubstitutionStrategy implements EventStrategy {
  private readonly baseProbability = 0.08;

  shouldGenerate(minute: number, matchContext: MatchContext): boolean {
    if (minute < 55) {
      return false;
    }

    if (minute === 46) {
      return Math.random() < 0.4;
    }
    const subCount = matchContext.eventsGenerated.filter(
      (e) => e.type === EventType.SUBSTITUTION,
    ).length;

    if (subCount >= 10) {
      return false;
    }

    let probability = this.baseProbability;

    if (minute > 75) {
      probability *= 2;
    }

    return Math.random() < probability;
  }

  generate(team: 'home' | 'away', matchContext: MatchContext): GeneratedEvent {
    const players =
      team === 'home' ? matchContext.homePlayers : matchContext.awayPlayers;
    const teamName =
      team === 'home' ? matchContext.homeTeamName : matchContext.awayTeamName;

    const [playerOut, playerIn] = getTwoRandomPlayers(players);

    return {
      type: EventType.SUBSTITUTION,
      team,
      player: playerIn,
      assistPlayer: playerOut,
      description: `Substitution for ${teamName}: ${playerIn} comes on for ${playerOut}.`,
    };
  }
}
