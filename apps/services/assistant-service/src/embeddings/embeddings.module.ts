import { Global, Module } from '@nestjs/common';
import { ENV, Env } from '../config/env';
import { EmbeddingsFactory } from './embeddings.factory';

export const EMBEDDINGS = Symbol('EMBEDDINGS');

@Global()
@Module({
  providers: [
    {
      provide: EMBEDDINGS,
      inject: [ENV],
      useFactory: (env: Env) => EmbeddingsFactory.create(env),
    },
  ],
  exports: [EMBEDDINGS],
})
export class EmbeddingsModule {}
