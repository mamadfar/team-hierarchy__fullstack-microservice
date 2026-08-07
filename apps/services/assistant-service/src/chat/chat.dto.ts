import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Swagger-only DTO classes. Runtime validation is done by the shared zod
 * schemas (ChatRequestSchema/ChatResponseSchema) via ZodValidationPipe —
 * these classes exist so /docs shows accurate request/response shapes.
 */
export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant';

  @ApiProperty({ maxLength: 4000, example: "I can't log in since this morning" })
  content!: string;
}

export class ChatRequestDto {
  @ApiProperty({ type: [ChatMessageDto], minItems: 1, maxItems: 20 })
  messages!: ChatMessageDto[];

  @ApiPropertyOptional({ enum: ['en', 'hu', 'fr', 'nl'], default: 'en' })
  lang?: 'en' | 'hu' | 'fr' | 'nl';
}

export class ChatTeamRefDto {
  @ApiProperty({ example: 'PLT-IAM' })
  queueKey!: string;

  @ApiProperty({ example: 'IAM Platform' })
  name!: string;

  @ApiProperty({ minimum: 0, maximum: 1, example: 0.85 })
  confidence!: number;
}

export class ChatResponseDto {
  @ApiProperty({ description: 'Plain text (no markdown), 2-4 sentences, in the requested language.' })
  answer!: string;

  @ApiProperty({ type: [ChatTeamRefDto], maxItems: 3 })
  teams!: ChatTeamRefDto[];
}
