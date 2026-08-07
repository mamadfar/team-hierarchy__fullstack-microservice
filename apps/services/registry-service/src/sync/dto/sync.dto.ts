import { ApiProperty } from '@nestjs/swagger';

export class SyncTriggerResponseDto {
  @ApiProperty({ example: 'ok' }) status!: string;
  @ApiProperty({ example: 12 }) runId!: number;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      trigger: 'manual',
      pages: 3,
      companies: 3,
      domains: 6,
      tribes: 19,
      teams: 81,
      links: 30,
      docsRebuilt: 81,
      rowErrors: [],
    },
  })
  stats!: Record<string, unknown>;
}
