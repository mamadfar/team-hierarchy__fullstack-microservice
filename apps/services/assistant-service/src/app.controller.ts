import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ENV } from './config/env';
import type { Env } from './config/env';
import { RetrievalService } from './retrieval/retrieval.service';

class HealthIndexDto {
  @ApiProperty()
  ready!: boolean;

  @ApiProperty()
  docs!: number;
}

class HealthDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ description: 'true when GEMINI_API_KEY is configured (else fallback answers)' })
  llm!: boolean;

  @ApiProperty({ example: 'mock' })
  embeddings!: string;

  @ApiProperty({ type: HealthIndexDto })
  index!: HealthIndexDto;
}

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(RetrievalService) private readonly retrieval: RetrievalService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness + retrieval-index readiness' })
  @ApiOkResponse({ type: HealthDto })
  health(): HealthDto {
    return {
      status: 'ok',
      llm: Boolean(this.env.GEMINI_API_KEY),
      embeddings: this.env.EMBEDDING_PROVIDER,
      index: { ready: this.retrieval.isReady, docs: this.retrieval.docCount },
    };
  }
}
