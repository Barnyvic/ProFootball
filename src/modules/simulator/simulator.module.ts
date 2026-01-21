import { Module } from '@nestjs/common';
import { MatchSimulatorService } from './services/match-simulator.service';
import { EventGeneratorService } from './services/event-generator.service';
import { MatchLifecycleService } from './services/match-lifecycle.service';
import { GoalStrategy } from './strategies/goal.strategy';
import { CardStrategy } from './strategies/card.strategy';
import { SubstitutionStrategy } from './strategies/substitution.strategy';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [MatchesModule],
  providers: [
    MatchSimulatorService,
    EventGeneratorService,
    MatchLifecycleService,
    GoalStrategy,
    CardStrategy,
    SubstitutionStrategy,
  ],
  exports: [MatchSimulatorService],
})
export class SimulatorModule {}
