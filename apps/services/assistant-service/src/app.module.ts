import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { ChatModule } from './chat/chat.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { ENV, Env } from './config/env';
import { RetrievalModule } from './retrieval/retrieval.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EmbeddingsModule,
    RetrievalModule,
    ChatModule,
    // Global default: 30 req/min per IP; /chat tightens to 10/min via @Throttle.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 30 }] }),
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_FILTER,
      inject: [ENV],
      useFactory: (env: Env) => new AllExceptionsFilter(env.NODE_ENV !== 'production'),
    },
  ],
})
export class AppModule {}
