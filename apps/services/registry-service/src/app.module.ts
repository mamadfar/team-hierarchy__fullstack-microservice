import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { ConfigModule } from './config/config.module';
import { ConfluenceModule } from './confluence/confluence.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { RegistryModule } from './registry/registry.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    ConfluenceModule,
    RegistryModule,
    SyncModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
