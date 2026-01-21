import {
  Controller,
  Get,
  Param,
  Sse,
  Headers,
  MessageEvent,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatchesService } from '../services/matches.service';
import { MatchEventsService } from '../services/match-events.service';
import { MatchListResponseDto } from '../dto/match-response.dto';
import { MatchDetailDto } from '../dto/match-detail.dto';

@Controller('api/matches')
export class MatchesController {
  private readonly logger = new Logger(MatchesController.name);

  constructor(
    private readonly matchesService: MatchesService,
    private readonly matchEventsService: MatchEventsService,
  ) {}

  @Get()
  async getAllMatches(): Promise<MatchListResponseDto> {
    this.logger.debug('GET /api/matches');
    return await this.matchesService.getAllMatches();
  }

  @Get('live')
  async getLiveMatches(): Promise<MatchListResponseDto> {
    this.logger.debug('GET /api/matches/live');
    return await this.matchesService.getLiveMatches();
  }

  @Get(':id')
  async getMatchById(@Param('id') id: string): Promise<MatchDetailDto> {
    this.logger.debug(`GET /api/matches/${id}`);
    return await this.matchesService.getMatchById(id);
  }

  @Sse(':id/events/stream')
  async streamEvents(
    @Param('id') id: string,
    @Headers('last-event-id') lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    this.logger.debug(`SSE connection established for match ${id}`);

    if (!(await this.matchesService.matchExists(id))) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    const stream = await this.matchEventsService.createEventStream(id, lastEventId);
    return stream.pipe(
      map((event) => ({
        id: event.id,
        type: event.type,
        data: event.data as object,
        retry: 5000,
      })),
    );
  }
}
