import { MatchStatus } from '../enums/match-status.enum';
import { MatchEvent } from './match-event.entity';
import { Team } from './team.entity';

export interface MatchStatistics {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number };
  yellowCards: { home: number; away: number };
  redCards: { home: number; away: number };
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: MatchStatus;
  startTime: Date;
  events: MatchEvent[];
  statistics: MatchStatistics;
  createdAt: Date;
  updatedAt: Date;
}

export function createDefaultStatistics(): MatchStatistics {
  return {
    possession: { home: 50, away: 50 },
    shots: { home: 0, away: 0 },
    shotsOnTarget: { home: 0, away: 0 },
    corners: { home: 0, away: 0 },
    fouls: { home: 0, away: 0 },
    yellowCards: { home: 0, away: 0 },
    redCards: { home: 0, away: 0 },
  };
}
