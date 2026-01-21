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
  getAllMatches(): MatchListResponseDto {
    this.logger.debug('GET /api/matches');
    return this.matchesService.getAllMatches();
  }

  @Get('live')
  getLiveMatches(): MatchListResponseDto {
    this.logger.debug('GET /api/matches/live');
    return this.matchesService.getLiveMatches();
  }

  @Get(':id')
  getMatchById(@Param('id') id: string): MatchDetailDto {
    this.logger.debug(`GET /api/matches/${id}`);
    return this.matchesService.getMatchById(id);
  }

  @Sse(':id/events/stream')
  streamEvents(
    @Param('id') id: string,
    @Headers('last-event-id') lastEventId?: string,
  ): Observable<MessageEvent> {
    this.logger.debug(`SSE connection established for match ${id}`);

    if (!this.matchesService.matchExists(id)) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    return this.matchEventsService.createEventStream(id, lastEventId).pipe(
      map((event) => ({
        id: event.id,
        type: event.type,
        data: event.data as object,
        retry: 5000,
      })),
    );
  }
}
