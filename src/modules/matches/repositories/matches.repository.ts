import { Injectable, Logger } from '@nestjs/common';
import { Match, MatchStatistics, createDefaultStatistics } from '../entities/match.entity';
import { MatchEvent } from '../entities/match-event.entity';
import { MatchStatus } from '../enums/match-status.enum';
import { Team } from '../entities/team.entity';
import { SupabaseService } from '../../../shared/database/supabase/supabase.service';
import { TeamsRepository } from './teams.repository';
import { MatchEventRow, MatchRow } from '../interfaces/match-row.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MatchesRepository {
  private readonly logger = new Logger(MatchesRepository.name);
  private readonly tableName = 'matches';
  private readonly eventsTableName = 'match_events';

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly teamsRepository: TeamsRepository,
  ) {}

  async findAll(): Promise<Match[]> {
    const client = this.supabaseService.getClient();

    const { data: rows, error } = await client
      .from(this.tableName)
      .select(
        `
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name, logo_url),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name, logo_url)
      `,
      )
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Database query error: ${error.message}`);
      throw error;
    }

    const matches: Match[] = [];

    for (const row of (rows || [])) {
      const matchRow = row as MatchRow;
      const events = await this.getEventsForMatch(matchRow.id);
      matches.push(this.toMatch(matchRow, events));
    }

    return matches;
  }

  async findByStatus(status: MatchStatus): Promise<Match[]> {
    const allMatches = await this.findAll();
    return allMatches.filter((match) => match.status === status);
  }

  async findById(id: string): Promise<Match | null> {
    const client = this.supabaseService.getClient();

    const { data: row, error } = await client
      .from(this.tableName)
      .select(
        `
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name, logo_url),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name, logo_url)
      `,
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Database query error: ${error.message}`);
      throw error;
    }

    if (!row) {
      return null;
    }

    const matchRow = row as MatchRow;
    const events = await this.getEventsForMatch(id);

    return this.toMatch(matchRow, events);
  }

  async create(homeTeam: Team, awayTeam: Team, startTime?: Date): Promise<Match> {
    const id = uuidv4();
    const now = new Date();
    const start = startTime || now;

    const statistics = createDefaultStatistics();

    const matchRow = await this.supabaseService.insert<MatchRow>(this.tableName, {
      id,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      home_score: 0,
      away_score: 0,
      minute: 0,
      status: MatchStatus.NOT_STARTED,
      start_time: start.toISOString(),
      statistics: statistics,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    this.logger.debug(`Created match ${id}: ${homeTeam.name} vs ${awayTeam.name}`);

    return {
      id: matchRow.id,
      homeTeam,
      awayTeam,
      homeScore: matchRow.home_score,
      awayScore: matchRow.away_score,
      minute: matchRow.minute,
      status: matchRow.status as MatchStatus,
      startTime: new Date(matchRow.start_time),
      events: [],
      statistics: matchRow.statistics,
      createdAt: new Date(matchRow.created_at),
      updatedAt: new Date(matchRow.updated_at),
    };
  }

  async updateScore(id: string, homeScore: number, awayScore: number): Promise<Match | null> {
    const match = await this.findById(id);
    if (!match) return null;

    const matchRow = await this.supabaseService.update<MatchRow>(
      this.tableName,
      id,
      {
        home_score: homeScore,
        away_score: awayScore,
      },
    );

    return this.toMatch(matchRow, match.events);
  }

  async updateMinute(id: string, minute: number): Promise<Match | null> {
    const match = await this.findById(id);
    if (!match) return null;

    const matchRow = await this.supabaseService.update<MatchRow>(
      this.tableName,
      id,
      {
        minute,
      },
    );

    return this.toMatch(matchRow, match.events);
  }

  async updateStatus(id: string, status: MatchStatus): Promise<Match | null> {
    const match = await this.findById(id);
    if (!match) return null;

    const matchRow = await this.supabaseService.update<MatchRow>(
      this.tableName,
      id,
      {
        status,
      },
    );

    this.logger.debug(`Match ${id} status changed to ${status}`);

    return this.toMatch(matchRow, match.events);
  }

  async addEvent(id: string, event: MatchEvent): Promise<Match | null> {
    const match = await this.findById(id);
    if (!match) return null;

    await this.supabaseService.insert<MatchEventRow>(this.eventsTableName, {
      id: event.id,
      match_id: id,
      type: event.type,
      minute: event.minute,
      team: event.team,
      ...(event.player !== undefined ? { player: event.player } : {}),
      ...(event.assistPlayer !== undefined ? { assist_player: event.assistPlayer } : {}),
      description: event.description,
      timestamp: event.timestamp.toISOString(),
      created_at: event.timestamp.toISOString(),
    });

    const updatedMatch = await this.findById(id);
    return updatedMatch;
  }

  async updateStatistics(id: string, statistics: Partial<MatchStatistics>): Promise<Match | null> {
    const match = await this.findById(id);
    if (!match) return null;

    const updatedStatistics = { ...match.statistics, ...statistics };

    const matchRow = await this.supabaseService.update<MatchRow>(
      this.tableName,
      id,
      {
        statistics: updatedStatistics as MatchStatistics,
      },
    );

    return this.toMatch(matchRow, match.events);
  }

  async getEvents(id: string): Promise<MatchEvent[]> {
    return this.getEventsForMatch(id);
  }

  async getEventsAfterId(matchId: string, lastEventId: string): Promise<MatchEvent[]> {
    const client = this.supabaseService.getClient();

    const { data: lastEvent, error: lastEventError } = await client
      .from(this.eventsTableName)
      .select('timestamp')
      .eq('id', lastEventId)
      .single();

    if (lastEventError || !lastEvent) {
      return this.getEventsForMatch(matchId);
    }

    const { data: rows, error } = await client
      .from(this.eventsTableName)
      .select('*')
      .eq('match_id', matchId)
      .gt('timestamp', lastEvent.timestamp)
      .order('timestamp', { ascending: true });

    if (error) {
      this.logger.error(`Database query error: ${error.message}`);
      throw error;
    }

    return (rows || []).map((row) => this.toMatchEvent(row as MatchEventRow));
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.supabaseService.delete(this.tableName, { id });
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete match ${id}: ${error}`);
      return false;
    }
  }

  async count(): Promise<number> {
    return this.supabaseService.count(this.tableName);
  }

  private async getEventsForMatch(matchId: string): Promise<MatchEvent[]> {
    const client = this.supabaseService.getClient();

    const { data: rows, error } = await client
      .from(this.eventsTableName)
      .select('*')
      .eq('match_id', matchId)
      .order('timestamp', { ascending: true });

    if (error) {
      this.logger.error(`Database query error: ${error.message}`);
      return [];
    }

    return (rows || []).map((row) => this.toMatchEvent(row as MatchEventRow));
  }

  private toMatch(row: MatchRow, events: MatchEvent[]): Match {
    const homeTeam: Team = row.home_team
      ? {
          id: row.home_team.id,
          name: row.home_team.name,
          shortName: row.home_team.short_name,
          logoUrl: row.home_team.logo_url || undefined,
        }
      : { id: row.home_team_id, name: '', shortName: '', logoUrl: undefined };

    const awayTeam: Team = row.away_team
      ? {
          id: row.away_team.id,
          name: row.away_team.name,
          shortName: row.away_team.short_name,
          logoUrl: row.away_team.logo_url || undefined,
        }
      : { id: row.away_team_id, name: '', shortName: '', logoUrl: undefined };

    return {
      id: row.id,
      homeTeam,
      awayTeam,
      homeScore: row.home_score,
      awayScore: row.away_score,
      minute: row.minute,
      status: row.status as MatchStatus,
      startTime: new Date(row.start_time),
      events,
      statistics: row.statistics || createDefaultStatistics(),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private toMatchEvent(row: MatchEventRow): MatchEvent {
    return {
      id: row.id,
      matchId: row.match_id,
      type: row.type as MatchEvent['type'],
      minute: row.minute,
      team: row.team as 'home' | 'away',
      player: row.player || undefined,
      assistPlayer: row.assist_player || undefined,
      description: row.description,
      timestamp: new Date(row.timestamp),
    };
  }
}
