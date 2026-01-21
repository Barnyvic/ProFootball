import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../shared/database/supabase/supabase.service';
import { Team } from '../entities/team.entity';
import { TeamRow } from '../interfaces/team-row.interface';

@Injectable()
export class TeamsRepository {
  private readonly logger = new Logger(TeamsRepository.name);
  private readonly tableName = 'teams';

  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(): Promise<Team[]> {
    const rows = await this.supabaseService.findMany<TeamRow>(this.tableName, {
      orderBy: { column: 'name', ascending: true },
    });

    return rows.map((row) => this.toTeam(row));
  }

  async findById(id: string): Promise<Team | null> {
    const row = await this.supabaseService.findById<TeamRow>(this.tableName, id);

    if (!row) {
      return null;
    }

    return this.toTeam(row);
  }

  async findByShortName(shortName: string): Promise<Team | null> {
    const rows = await this.supabaseService.findMany<TeamRow>(this.tableName, {
      filter: { short_name: shortName },
      limit: 1,
    });

    if (rows.length === 0) {
      return null;
    }

    return this.toTeam(rows[0]);
  }

  async create(team: Omit<Team, 'id'>): Promise<Team> {
    const row = await this.supabaseService.insert<TeamRow>(this.tableName, {
      name: team.name,
      short_name: team.shortName,
      ...(team.logoUrl !== undefined ? { logo_url: team.logoUrl } : {}),
    });

    return this.toTeam(row);
  }

  async createMany(teams: Omit<Team, 'id'>[]): Promise<Team[]> {
    const client = this.supabaseService.getClient();
    const data = teams.map((team) => ({
      name: team.name,
      short_name: team.shortName,
      logo_url: team.logoUrl || null,
    }));

    const { data: rows, error } = await client.from(this.tableName).insert(data).select();

    if (error) {
      this.logger.error(`Database insert error: ${error.message}`);
      throw error;
    }

    return rows.map((row) => this.toTeam(row as TeamRow));
  }

  private toTeam(row: TeamRow): Team {
    return {
      id: row.id,
      name: row.name,
      shortName: row.short_name,
      logoUrl: row.logo_url ?? undefined,
    };
  }
}
