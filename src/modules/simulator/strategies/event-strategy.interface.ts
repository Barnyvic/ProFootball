import { EventType } from '../../matches/enums/event-type.enum';

export interface GeneratedEvent {
  type: EventType;
  team: 'home' | 'away';
  player: string;
  assistPlayer?: string;
  description: string;
}

export interface EventStrategy {
  shouldGenerate(minute: number, matchContext: MatchContext): boolean;
  generate(team: 'home' | 'away', matchContext: MatchContext): GeneratedEvent;
}

export interface MatchContext {
  minute: number;
  homeScore: number;
  awayScore: number;
  homeTeamName: string;
  awayTeamName: string;
  homePlayers: string[];
  awayPlayers: string[];
  status: string;
  eventsGenerated: { type: EventType; count: number }[];
}

export function getRandomPlayer(players: string[]): string {
  return players[Math.floor(Math.random() * players.length)];
}

export function getTwoRandomPlayers(players: string[]): [string, string] {
  const player1Index = Math.floor(Math.random() * players.length);
  let player2Index = Math.floor(Math.random() * players.length);
  
  while (player2Index === player1Index && players.length > 1) {
    player2Index = Math.floor(Math.random() * players.length);
  }

  return [players[player1Index], players[player2Index]];
}
