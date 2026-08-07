import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChatRequestSchema, type ChatRequest, type ChatResponse } from '@orbit/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ChatRequestDto, ChatResponseDto } from './chat.dto';
import { ChatService } from './chat.service';

@ApiTags('chat')
@Controller()
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post('chat')
  @HttpCode(200)
  // 10 requests/min per IP — chat fans out to a paid LLM, keep it tight.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Ask Orbit which team should receive a ticket',
    description:
      'RAG chat: rewrites the question into a search query, retrieves the top team candidates (BM25 + pgvector, RRF-fused) and answers grounded strictly in them. Plain-text answer in the requested language plus up to 3 structured team refs.',
  })
  @ApiBody({ type: ChatRequestDto })
  @ApiOkResponse({ type: ChatResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (10/min per IP)' })
  async chat(
    @Body(new ZodValidationPipe(ChatRequestSchema)) body: ChatRequest,
  ): Promise<ChatResponse> {
    return this.chatService.chat(body);
  }
}
