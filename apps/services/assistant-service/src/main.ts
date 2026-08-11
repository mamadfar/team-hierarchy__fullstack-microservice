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

  if (env.NODE_ENV === 'production') {
    // One hop (LB / reverse proxy) so throttler sees the real client IP.
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  } else {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Orbit assistant-service')
      .setDescription(
        'RAG chat API: hybrid BM25 + pgvector retrieval, grounded team-routing answers.',
      )
      .setVersion('0.2.0')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  await app.listen(env.ASSISTANT_PORT);
  new Logger('Bootstrap').log(
    `assistant-service listening on :${env.ASSISTANT_PORT}` +
      (env.NODE_ENV === 'production' ? '' : ' (docs at /docs)') +
      ` (CORS origin ${env.WEB_ORIGIN})`,
  );
}

bootstrap().catch((error: unknown) => {
  console.error('[assistant-service] fatal boot error:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
