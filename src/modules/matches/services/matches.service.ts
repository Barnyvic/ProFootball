import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MatchesRepository } from '../repositories/matches.repository';
import { Match } from '../entities/match.entity';
import { MatchEvent } from '../entities/match-event.entity';
import { MatchStatus } from '../enums/match-status.enum';
import { MatchListResponseDto, MatchListItemDto, TeamResponseDto } from '../dto/match-response.dto';
import { MatchDetailDto, MatchEventDto, TeamDetailDto } from '../dto/match-detail.dto';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(private readonly matchesRepository: MatchesRepository) {}

  async getAllMatches(): Promise<MatchListResponseDto> {
    const matches = await this.matchesRepository.findAll();

    const matchDtos: MatchListItemDto[] = matches.map((match) => this.toMatchListItem(match));

    return {
      matches: matchDtos,
      total: matchDtos.length,
    };
  }

  async getLiveMatches(): Promise<MatchListResponseDto> {
    const liveStatuses = [MatchStatus.FIRST_HALF, MatchStatus.HALF_TIME, MatchStatus.SECOND_HALF];
    const matches = (await this.matchesRepository.findAll()).filter((m) =>
      liveStatuses.includes(m.status),
    );

    return {
      matches: matches.map((m) => this.toMatchListItem(m)),
      total: matches.length,
    };
  }

  async getMatchById(id: string): Promise<MatchDetailDto> {
    const match = await this.matchesRepository.findById(id);

    if (!match) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    return this.toMatchDetail(match);
  }

  async getMatchEntity(id: string): Promise<Match | null> {
    return await this.matchesRepository.findById(id);
  }

  async getMatchEvents(id: string): Promise<MatchEvent[]> {
    const match = await this.matchesRepository.findById(id);

    if (!match) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    return match.events;
  }

  async getEventsAfterId(matchId: string, lastEventId: string): Promise<MatchEventDto[]> {
    const events = await this.matchesRepository.getEventsAfterId(matchId, lastEventId);
    return events.map((e) => this.toMatchEventDto(e));
  }

  async matchExists(id: string): Promise<boolean> {
    const match = await this.matchesRepository.findById(id);
    return match !== null;
  }


  private toMatchListItem(match: Match): MatchListItemDto {
    return {
      id: match.id,
      homeTeam: this.toTeamResponse(match.homeTeam),
      awayTeam: this.toTeamResponse(match.awayTeam),
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      minute: match.minute,
      status: match.status,
      startTime: match.startTime.toISOString(),
    };
  }

  private toMatchDetail(match: Match): MatchDetailDto {
    return {
      id: match.id,
      homeTeam: this.toTeamDetail(match.homeTeam),
      awayTeam: this.toTeamDetail(match.awayTeam),
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      minute: match.minute,
      status: match.status,
      startTime: match.startTime.toISOString(),
      events: match.events.map((e) => this.toMatchEventDto(e)),
      statistics: match.statistics,
    };
  }

  private toTeamResponse(team: { id: string; name: string; shortName: string; logoUrl?: string }): TeamResponseDto {
    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      logoUrl: team.logoUrl,
    };
  }

  private toTeamDetail(team: { id: string; name: string; shortName: string; logoUrl?: string }): TeamDetailDto {
    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      logoUrl: team.logoUrl,
    };
  }

  private toMatchEventDto(event: MatchEvent): MatchEventDto {
    return {
      id: event.id,
      type: event.type,
      minute: event.minute,
      team: event.team,
      player: event.player,
      assistPlayer: event.assistPlayer,
      description: event.description,
      timestamp: event.timestamp.toISOString(),
    };
  }
}
