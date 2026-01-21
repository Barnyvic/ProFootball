import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MatchesRepository } from '../../matches/repositories/matches.repository';
import { TeamsRepository } from '../../matches/repositories/teams.repository';
import { MatchStatus } from '../../matches/enums/match-status.enum';
import { EventGeneratorService } from './event-generator.service';
import { MatchLifecycleService } from './match-lifecycle.service';
import { Team } from '../../matches/entities/team.entity';

interface SimulatedMatch {
  id: string;
  intervalId?: NodeJS.Timeout;
}

@Injectable()
export class MatchSimulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchSimulatorService.name);

  private simulatedMatches: SimulatedMatch[] = [];
  private readonly matchCount = 4;
  private simulationSpeed: number;
  private teams: Team[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly matchesRepository: MatchesRepository,
    private readonly teamsRepository: TeamsRepository,
    private readonly eventGeneratorService: EventGeneratorService,
    private readonly matchLifecycleService: MatchLifecycleService,
  ) {
    this.simulationSpeed = this.configService.get<number>('simulation.speed') || 1;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(
      `Match Simulator starting with ${this.matchCount} matches at ${this.simulationSpeed}x speed`,
    );
    try {
      await this.loadTeams();
      await this.initializeMatches();
    } catch (error) {
      this.logger.error(
        `Match Simulator failed to initialize (did you run the Supabase migration?): ${error}`,
      );
      this.logger.warn('Match Simulator disabled until database schema is available.');
    }
  }

  onModuleDestroy(): void {
    this.stopAllSimulations();
    this.logger.log('Match Simulator stopped');
  }

  private async loadTeams(): Promise<void> {
    this.teams = await this.teamsRepository.findAll();

    if (this.teams.length === 0) {
      this.logger.warn('No teams found in database. Seeding teams...');
      await this.seedTeams();
      this.teams = await this.teamsRepository.findAll();
    }

    if (this.teams.length < 2) {
      this.logger.error('Not enough teams in database. Need at least 2 teams.');
      return;
    }

    this.logger.log(`Loaded ${this.teams.length} teams from database`);
  }

  private async seedTeams(): Promise<void> {
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

  private async initializeMatches(): Promise<void> {
    if (this.teams.length < 2) {
      this.logger.error('Cannot initialize matches: not enough teams');
      return;
    }

    const shuffledTeams = [...this.teams].sort(() => Math.random() - 0.5);

    for (let i = 0; i < this.matchCount && i * 2 + 1 < shuffledTeams.length; i++) {
      const homeTeam = shuffledTeams[i * 2];
      const awayTeam = shuffledTeams[i * 2 + 1];

      const startDelay = i * 2000;

      setTimeout(async () => {
        await this.createAndStartMatch(homeTeam, awayTeam);
      }, startDelay);
    }
  }

  private async createAndStartMatch(homeTeam: Team, awayTeam: Team): Promise<void> {
    const match = await this.matchesRepository.create(homeTeam, awayTeam, new Date());

    this.logger.log(
      `Created match: ${homeTeam.name} vs ${awayTeam.name} (ID: ${match.id})`,
    );

    setTimeout(() => {
      this.matchLifecycleService.startMatch(match.id);
      this.startMatchSimulation(match.id);
    }, 1000);
  }

  private startMatchSimulation(matchId: string): void {
    const intervalMs = 1000 / this.simulationSpeed;

    const intervalId = setInterval(async () => {
      try {
        await this.tickMatch(matchId);
      } catch (error) {
        this.stopMatchSimulation(matchId);
        this.logger.error(
          `Error while simulating match ${matchId} (Supabase/network issue?): ${error}`,
        );
      }
    }, intervalMs);

    this.simulatedMatches.push({ id: matchId, intervalId });

    this.logger.log(`Match ${matchId} simulation started`);
  }

  private async tickMatch(matchId: string): Promise<void> {
    const match = await this.matchesRepository.findById(matchId);
    if (!match) {
      this.stopMatchSimulation(matchId);
      return;
    }

    const newStatus = await this.matchLifecycleService.checkAndTransition(
      matchId,
      match.minute,
    );

    if (newStatus === MatchStatus.FULL_TIME) {
      this.logger.log(
        `Match ${matchId} finished: ${match.homeTeam.shortName} ${match.homeScore}-${match.awayScore} ${match.awayTeam.shortName}`,
      );
      this.stopMatchSimulation(matchId);

      this.scheduleNewMatch();
      return;
    }

    if (newStatus === MatchStatus.HALF_TIME) {
      setTimeout(async () => {
        await this.matchesRepository.updateMinute(matchId, 46);
      }, 2000 / this.simulationSpeed);
      return;
    }

    if (await this.matchLifecycleService.isPlayable(matchId)) {
      await this.eventGeneratorService.generateEvents(matchId);
    }

    await this.matchesRepository.updateMinute(matchId, match.minute + 1);
  }

  private stopMatchSimulation(matchId: string): void {
    const index = this.simulatedMatches.findIndex((m) => m.id === matchId);
    if (index !== -1) {
      const simMatch = this.simulatedMatches[index];
      if (simMatch.intervalId) {
        clearInterval(simMatch.intervalId);
      }
      this.simulatedMatches.splice(index, 1);

      this.eventGeneratorService.clearMatchEvents(matchId).catch((error) => {
        this.logger.error(`Failed to clear event counts for match ${matchId}: ${error}`);
      });

      this.logger.log(`Match ${matchId} simulation stopped`);
    }
  }

  private async scheduleNewMatch(): Promise<void> {
    const playingTeamIds = new Set<string>();
    const activeMatches = (await this.matchesRepository.findAll()).filter((m) =>
      [
        MatchStatus.NOT_STARTED,
        MatchStatus.FIRST_HALF,
        MatchStatus.HALF_TIME,
        MatchStatus.SECOND_HALF,
      ].includes(m.status),
    );

    activeMatches.forEach((m) => {
      playingTeamIds.add(m.homeTeam.id);
      playingTeamIds.add(m.awayTeam.id);
    });

    const availableTeams = this.teams.filter((t) => !playingTeamIds.has(t.id));

    if (availableTeams.length >= 2) {
      const shuffled = availableTeams.sort(() => Math.random() - 0.5);

      setTimeout(async () => {
        await this.createAndStartMatch(shuffled[0], shuffled[1]);
      }, 5000 / this.simulationSpeed);
    } else {
      setTimeout(() => {
        this.scheduleNewMatch();
      }, 10000 / this.simulationSpeed);
    }
  }

  private stopAllSimulations(): void {
    this.simulatedMatches.forEach((match) => {
      if (match.intervalId) {
        clearInterval(match.intervalId);
      }
    });
    this.simulatedMatches = [];
  }

  getStatus(): {
    activeMatches: number;
    simulationSpeed: number;
    matchIds: string[];
  } {
    return {
      activeMatches: this.simulatedMatches.length,
      simulationSpeed: this.simulationSpeed,
      matchIds: this.simulatedMatches.map((m) => m.id),
    };
  }
}
