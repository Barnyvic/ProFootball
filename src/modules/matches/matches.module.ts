import { Module } from '@nestjs/common';
import { MatchesController } from './controllers/matches.controller';
import { MatchesService } from './services/matches.service';
import { MatchEventsService } from './services/match-events.service';
import { MatchesRepository } from './repositories/matches.repository';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, MatchEventsService, MatchesRepository],
  exports: [MatchesService, MatchEventsService, MatchesRepository],
})
export class MatchesModule {}
