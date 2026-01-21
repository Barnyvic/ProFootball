import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MatchesRepository } from '../../matches/repositories/matches.repository';
import { MatchStatus } from '../../matches/enums/match-status.enum';
import { EventGeneratorService } from './event-generator.service';
import { MatchLifecycleService } from './match-lifecycle.service';
import { Team } from '../../matches/entities/team.entity';
import { v4 as uuidv4 } from 'uuid';

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

  private readonly teams: Team[] = [
    { id: uuidv4(), name: 'Manchester United', shortName: 'MUN', logoUrl: undefined },
    { id: uuidv4(), name: 'Manchester City', shortName: 'MCI', logoUrl: undefined },
    { id: uuidv4(), name: 'Liverpool', shortName: 'LIV', logoUrl: undefined },
    { id: uuidv4(), name: 'Chelsea', shortName: 'CHE', logoUrl: undefined },
    { id: uuidv4(), name: 'Arsenal', shortName: 'ARS', logoUrl: undefined },
    { id: uuidv4(), name: 'Tottenham', shortName: 'TOT', logoUrl: undefined },
    { id: uuidv4(), name: 'Newcastle United', shortName: 'NEW', logoUrl: undefined },
    { id: uuidv4(), name: 'Aston Villa', shortName: 'AVL', logoUrl: undefined },
    { id: uuidv4(), name: 'West Ham', shortName: 'WHU', logoUrl: undefined },
    { id: uuidv4(), name: 'Brighton', shortName: 'BHA', logoUrl: undefined },
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly matchesRepository: MatchesRepository,
    private readonly eventGeneratorService: EventGeneratorService,
    private readonly matchLifecycleService: MatchLifecycleService,
  ) {
    this.simulationSpeed = this.configService.get<number>('simulation.speed') || 1;
  }

  onModuleInit(): void {
    this.logger.log(
      `Match Simulator starting with ${this.matchCount} matches at ${this.simulationSpeed}x speed`,
    );
    this.initializeMatches();
  }

  onModuleDestroy(): void {
    this.stopAllSimulations();
    this.logger.log('Match Simulator stopped');
  }

  private initializeMatches(): void {
    const shuffledTeams = [...this.teams].sort(() => Math.random() - 0.5);

    for (let i = 0; i < this.matchCount && i * 2 + 1 < shuffledTeams.length; i++) {
      const homeTeam = shuffledTeams[i * 2];
      const awayTeam = shuffledTeams[i * 2 + 1];

      const startDelay = i * 2000;

      setTimeout(() => {
        this.createAndStartMatch(homeTeam, awayTeam);
      }, startDelay);
    }
  }

  private createAndStartMatch(homeTeam: Team, awayTeam: Team): void {
    const match = this.matchesRepository.create(homeTeam, awayTeam, new Date());

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

    const intervalId = setInterval(() => {
      this.tickMatch(matchId);
    }, intervalMs);

    this.simulatedMatches.push({ id: matchId, intervalId });

    this.logger.log(`Match ${matchId} simulation started`);
  }

  private tickMatch(matchId: string): void {
    const match = this.matchesRepository.findById(matchId);
    if (!match) {
      this.stopMatchSimulation(matchId);
      return;
    }

    const newStatus = this.matchLifecycleService.checkAndTransition(
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
      setTimeout(() => {
        this.matchesRepository.updateMinute(matchId, 46);
      }, 2000 / this.simulationSpeed);
      return;
    }

    if (this.matchLifecycleService.isPlayable(matchId)) {
      this.eventGeneratorService.generateEvents(matchId);
    }

    this.matchesRepository.updateMinute(matchId, match.minute + 1);
  }

  private stopMatchSimulation(matchId: string): void {
    const index = this.simulatedMatches.findIndex((m) => m.id === matchId);
    if (index !== -1) {
      const simMatch = this.simulatedMatches[index];
      if (simMatch.intervalId) {
        clearInterval(simMatch.intervalId);
      }
      this.simulatedMatches.splice(index, 1);

      this.eventGeneratorService.clearMatchEvents(matchId);

      this.logger.log(`Match ${matchId} simulation stopped`);
    }
  }

  private scheduleNewMatch(): void {
    const playingTeamIds = new Set<string>();
    const activeMatches = this.matchesRepository.findAll().filter((m) =>
      [MatchStatus.NOT_STARTED, MatchStatus.FIRST_HALF, MatchStatus.HALF_TIME, MatchStatus.SECOND_HALF].includes(m.status)
    );

    activeMatches.forEach((m) => {
      playingTeamIds.add(m.homeTeam.id);
      playingTeamIds.add(m.awayTeam.id);
    });

    const availableTeams = this.teams.filter((t) => !playingTeamIds.has(t.id));

    if (availableTeams.length >= 2) {
      const shuffled = availableTeams.sort(() => Math.random() - 0.5);

      setTimeout(() => {
        this.createAndStartMatch(shuffled[0], shuffled[1]);
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
