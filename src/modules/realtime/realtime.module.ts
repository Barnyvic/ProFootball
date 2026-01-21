import { Module, forwardRef } from '@nestjs/common';
import { EventsGateway } from './gateways/events.gateway';
import { SubscriptionService } from './services/subscription.service';
import { BroadcastService } from './services/broadcast.service';
import { MatchesModule } from '../matches/matches.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    MatchesModule,
    forwardRef(() => ChatModule),
  ],
  providers: [EventsGateway, SubscriptionService, BroadcastService],
  exports: [SubscriptionService, BroadcastService],
})
export class RealtimeModule {}
