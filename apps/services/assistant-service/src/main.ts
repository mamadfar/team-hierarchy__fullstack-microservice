import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  // Validate the environment BEFORE Nest boots — crash fast with a clear message.
  const env = loadEnv();

  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: env.WEB_ORIGIN, methods: ['GET', 'POST'] });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Orbit assistant-service')
    .setDescription('RAG chat API: hybrid BM25 + pgvector retrieval, grounded team-routing answers.')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(env.ASSISTANT_PORT);
  new Logger('Bootstrap').log(
    `assistant-service listening on :${env.ASSISTANT_PORT} (docs at /docs, CORS origin ${env.WEB_ORIGIN})`,
  );
}

void bootstrap();
