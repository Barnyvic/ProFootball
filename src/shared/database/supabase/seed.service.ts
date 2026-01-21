import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TeamsRepository } from '../../../modules/matches/repositories/teams.repository';
import { Team } from '../../../modules/matches/entities/team.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly teamsRepository: TeamsRepository) {}

  async onModuleInit(): Promise<void> {
    await this.seedTeams();
  }

  async seedTeams(): Promise<void> {
    const existingTeams = await this.teamsRepository.findAll();

    if (existingTeams.length > 0) {
      this.logger.log(`Teams already exist (${existingTeams.length} teams). Skipping seed.`);
      return;
    }

    const defaultTeams: Omit<Team, 'id'>[] = [
      { name: 'Manchester United', shortName: 'MUN', logoUrl: undefined },
      { name: 'Manchester City', shortName: 'MCI', logoUrl: undefined },
      { name: 'Liverpool', shortName: 'LIV', logoUrl: undefined },
      { name: 'Chelsea', shortName: 'CHE', logoUrl: undefined },
      { name: 'Arsenal', shortName: 'ARS', logoUrl: undefined },
      { name: 'Tottenham', shortName: 'TOT', logoUrl: undefined },
      { name: 'Newcastle United', shortName: 'NEW', logoUrl: undefined },
      { name: 'Aston Villa', shortName: 'AVL', logoUrl: undefined },
      { name: 'West Ham', shortName: 'WHU', logoUrl: undefined },
      { name: 'Brighton', shortName: 'BHA', logoUrl: undefined },
    ];

    try {
      await this.teamsRepository.createMany(defaultTeams);
      this.logger.log(`Successfully seeded ${defaultTeams.length} teams`);
    } catch (error) {
      this.logger.error(`Failed to seed teams: ${error}`);
    }
  }
}

