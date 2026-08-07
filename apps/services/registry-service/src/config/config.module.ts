import { Global, Module } from '@nestjs/common';

import { ENV, parseEnv } from './env';

/** Provides the zod-validated env under the ENV token. Boot fails on invalid env. */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => parseEnv(process.env) }],
  exports: [ENV],
})
export class ConfigModule {}
