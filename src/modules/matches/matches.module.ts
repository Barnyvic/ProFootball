import { Module } from '@nestjs/common';
import { MatchesController } from './controllers/matches.controller';
import { MatchesService } from './services/matches.service';
import { MatchEventsService } from './services/match-events.service';
import { MatchesRepository } from './repositories/matches.repository';
import { TeamsRepository } from './repositories/teams.repository';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, MatchEventsService, MatchesRepository, TeamsRepository],
  exports: [MatchesService, MatchEventsService, MatchesRepository, TeamsRepository],
})
export class MatchesModule {}
