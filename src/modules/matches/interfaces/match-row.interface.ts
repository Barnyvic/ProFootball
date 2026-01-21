import { MatchStatistics } from '../entities/match.entity';

export interface MatchRow {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  minute: number;
  status: string;
  start_time: string;
  statistics: MatchStatistics;
  created_at: string;
  updated_at: string;
  home_team?: {
    id: string;
    name: string;
    short_name: string;
    logo_url?: string;
  };
  away_team?: {
    id: string;
    name: string;
    short_name: string;
    logo_url?: string;
  };
}

export interface MatchEventRow {
  id: string;
  match_id: string;
  type: string;
  minute: number;
  team: string;
  player?: string;
  assist_player?: string;
  description: string;
  timestamp: string;
  created_at: string;
}

