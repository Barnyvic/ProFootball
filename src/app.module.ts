import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AppConfigModule } from './shared/config/config.module';
import { SupabaseModule } from './shared/database/supabase/supabase.module';
import { CacheModule } from './shared/cache/cache.module';
import { EventsModule } from './shared/events/events.module';
import { MatchesModule } from './modules/matches/matches.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ChatModule } from './modules/chat/chat.module';
import { SimulatorModule } from './modules/simulator/simulator.module';

@Module({
  imports: [
    AppConfigModule,
    SupabaseModule,
    CacheModule,
    EventsModule,
    MatchesModule,
    RealtimeModule,
    ChatModule,
    SimulatorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
