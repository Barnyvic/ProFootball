import { MatchStatus } from '../enums/match-status.enum';

export class TeamResponseDto {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string;
}

export class MatchListItemDto {
  id: string;
  homeTeam: TeamResponseDto;
  awayTeam: TeamResponseDto;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: MatchStatus;
  startTime: string;
}

export class MatchListResponseDto {
  matches: MatchListItemDto[];
  total: number;
}
