import { MatchStatus } from '../enums/match-status.enum';
import { EventType } from '../enums/event-type.enum';

export class MatchEventDto {
  id: string;
  type: EventType;
  minute: number;
  team: 'home' | 'away';
  player?: string;
  assistPlayer?: string;
  description: string;
  timestamp: string;
}

export class MatchStatisticsDto {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number };
  yellowCards: { home: number; away: number };
  redCards: { home: number; away: number };
}

export class TeamDetailDto {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string;
}

export class MatchDetailDto {
  id: string;
  homeTeam: TeamDetailDto;
  awayTeam: TeamDetailDto;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: MatchStatus;
  startTime: string;
  events: MatchEventDto[];
  statistics: MatchStatisticsDto;
}
