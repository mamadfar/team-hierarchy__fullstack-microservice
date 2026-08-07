import { Logger } from '@nestjs/common';
import { ChatAnthropic } from '@langchain/anthropic';
import { z } from 'zod';
import { ENV, Env } from '../config/env';

/** DI token: RoutingLlm instance, or null when ANTHROPIC_API_KEY is unset. */
export const LLM = Symbol('LLM');

/** What the answer call must return (structured output / tool call). */
export const AnswerDraftSchema = z.object({
  answer: z
    .string()
    .describe('Plain-text answer for the employee: 2-4 short sentences, no markdown.'),
  teams: z
    .array(
      z.object({
        queueKey: z.string().describe('Queue key copied EXACTLY from one of the candidate teams.'),
        confidence: z.number().min(0).max(1).describe('How confident the routing is, 0..1.'),
      }),
    )
    .max(3)
    .describe('1-3 recommended teams from the candidates, best match first.'),
});
export type AnswerDraft = z.infer<typeof AnswerDraftSchema>;

export type LlmMessage = [role: 'system' | 'human' | 'ai', content: string];

/**
 * Minimal structural interface over ChatAnthropic so unit/integration tests
 * can stub the LLM without network or API keys.
 */
export interface RoutingLlm {
  invoke(messages: LlmMessage[]): Promise<{ content: unknown }>;
  withStructuredOutput(
    schema: typeof AnswerDraftSchema,
    opts?: { name?: string },
  ): { invoke(messages: LlmMessage[]): Promise<AnswerDraft> };
}

export const llmProvider = {
  provide: LLM,
  inject: [ENV],
  useFactory: (env: Env): RoutingLlm | null => {
    const logger = new Logger('LlmProvider');
    if (!env.ANTHROPIC_API_KEY) {
      logger.warn(
        'ANTHROPIC_API_KEY not set — /chat runs in deterministic FALLBACK mode (retrieval-only answers)',
      );
      return null;
    }
    logger.log(`LLM: anthropic ${env.LLM_MODEL} (via LangChain)`);
    const model = new ChatAnthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.LLM_MODEL,
      temperature: 0.2,
      maxTokens: 600,
    });
    // ChatAnthropic satisfies RoutingLlm structurally (BaseMessageLike[]
    // accepts [role, content] tuples); the cast keeps our surface minimal.
    return model as unknown as RoutingLlm;
  },
};
