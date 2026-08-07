import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from './env';

/**
 * Global config module: parses process.env exactly once and exposes the
 * validated, typed result under the ENV token.
 */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
