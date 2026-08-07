import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { ENV, type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);

  app.use(helmet());
  app.enableCors({ origin: env.WEB_ORIGIN, methods: ['GET', 'POST', 'OPTIONS'] });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Orbit Registry Service')
    .setDescription(
      'Confluence ingestion + team registry API. Read-only except POST /sync (app token).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(env.REGISTRY_PORT);
  Logger.log(`registry-service listening on :${env.REGISTRY_PORT} (docs at /docs)`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  // Crash fast with a clear message (e.g. invalid env, unreachable database).
  console.error('[registry-service] fatal boot error:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
