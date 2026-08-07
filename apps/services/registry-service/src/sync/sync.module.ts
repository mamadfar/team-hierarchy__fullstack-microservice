import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { ConfluenceModule } from '../confluence/confluence.module';
import { TeamDocumentBuilder } from './document-builder';
import { SeedSource } from './seed-source';
import { SyncController } from './sync.controller';
import { SyncRepository } from './sync.repository';
import { SyncScheduler } from './sync.scheduler';
import { SyncService } from './sync.service';
import { SyncTokenGuard } from './sync-token.guard';

@Module({
  imports: [
    ConfluenceModule,
    ScheduleModule.forRoot(),
    // Applies only where ThrottlerGuard is used (POST /sync): 3 requests/min.
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 3 }] }),
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncRepository, SeedSource, TeamDocumentBuilder, SyncScheduler, SyncTokenGuard],
  exports: [SyncService],
})
export class SyncModule {}
