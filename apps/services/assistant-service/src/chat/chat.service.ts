import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { ChatRequest, ChatResponse } from '@orbit/shared';
import { AppError } from '../common/app-error';
import type { RetrievedTeam } from '../retrieval/core/hybrid';
import { RetrievalService } from '../retrieval/retrieval.service';
import { filterAnswerTeams } from './answer-filter';
import { buildFallbackResponse, buildNoMatchResponse } from './fallback';
import { AnswerDraftSchema, LLM, LlmMessage, RoutingLlm } from './llm.provider';
import {
  buildAnswerSystemPrompt,
  buildRewriteSystemPrompt,
  buildRewriteUserPrompt,
  findLastUserIndex,
  sanitizeRewrittenQuery,
} from './prompts';

/**
 * Chat pipeline: rewrite -> retrieve -> answer.
 *
 * Deliberately a LINEAR LangChain chain, not LangGraph (brief §6): there is
 * no branching state to manage — two sequential LLM calls with plain
 * fallbacks on failure. A graph runtime here would be pure ceremony; the
 * only "branch" (no API key / LLM error -> deterministic extractive answer)
 * is an ordinary try/catch.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(RetrievalService) private readonly retrieval: RetrievalService,
    @Optional() @Inject(LLM) private readonly llm: RoutingLlm | null,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const lastUserIndex = findLastUserIndex(request.messages);
    const lastUser = lastUserIndex >= 0 ? request.messages[lastUserIndex] : undefined;
    if (!lastUser) {
      throw new AppError(400, 'Invalid request: messages must contain at least one user message');
    }

    // (a) query rewrite — skipped (raw message) without an API key.
    const query = await this.rewriteQuery(request, lastUser.content);

    // (b) hybrid retrieval, top 8.
    const retrieved = await this.retrieval.retrieve(query);
    if (retrieved.length === 0) {
      this.logChat(request, lastUser.content, query, [], [], 'no-match');
      return buildNoMatchResponse(request.lang);
    }

    // (c) grounded structured answer — or the deterministic fallback.
    let response: ChatResponse;
    let mode: string;
    if (this.llm) {
      try {
        response = await this.answerWithLlm(request, retrieved);
        mode = 'llm';
      } catch (err) {
        this.logger.warn(
          `LLM answer failed, serving retrieval fallback: ${err instanceof Error ? err.message : String(err)}`,
        );
        response = buildFallbackResponse(request.lang, retrieved);
        mode = 'fallback-error';
      }
    } else {
      response = buildFallbackResponse(request.lang, retrieved);
      mode = 'fallback-offline';
    }

    this.logChat(
      request,
      lastUser.content,
      query,
      retrieved.map((t) => t.key),
      response.teams.map((t) => t.queueKey),
      mode,
    );
    return response;
  }

  private async rewriteQuery(request: ChatRequest, rawMessage: string): Promise<string> {
    if (!this.llm) return rawMessage;
    try {
      const result = await this.llm.invoke([
        ['system', buildRewriteSystemPrompt()],
        ['human', buildRewriteUserPrompt(request.messages)],
      ]);
      return sanitizeRewrittenQuery(contentToString(result.content), rawMessage);
    } catch (err) {
      this.logger.warn(
        `query rewrite failed, using raw message: ${err instanceof Error ? err.message : String(err)}`,
      );
      return rawMessage;
    }
  }

  private async answerWithLlm(
    request: ChatRequest,
    retrieved: RetrievedTeam[],
  ): Promise<ChatResponse> {
    if (!this.llm) throw new Error('LLM not configured');
    const system = buildAnswerSystemPrompt({ lang: request.lang, teams: retrieved });
    const history: LlmMessage[] = request.messages
      .slice(-8)
      .map((m): LlmMessage => [m.role === 'user' ? 'human' : 'ai', m.content]);

    const draft = await this.llm
      .withStructuredOutput(AnswerDraftSchema, { name: 'route_ticket' })
      .invoke([['system', system], ...history]);

    // Grounding enforcement: invented/unretrieved keys are dropped, names
    // come from the registry rows, cap 3.
    const teams = filterAnswerTeams(draft, retrieved);
    const answer = draft.answer.trim();
    if (answer.length === 0) {
      return buildFallbackResponse(request.lang, retrieved);
    }
    return { answer, teams };
  }

  /** Structured info log per Q — question, rewritten query, retrieved + answered keys. No PII beyond the question text itself. */
  private logChat(
    request: ChatRequest,
    question: string,
    rewritten: string,
    retrievedKeys: string[],
    answeredKeys: string[],
    mode: string,
  ): void {
    this.logger.log(
      JSON.stringify({
        event: 'chat',
        lang: request.lang,
        mode,
        q: question.slice(0, 200),
        rewritten: rewritten.slice(0, 200),
        retrieved: retrievedKeys,
        answered: answeredKeys,
      }),
    );
  }
}

function contentToString(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'object' && part !== null && 'text' in part
          ? String((part as { text: unknown }).text)
          : '',
      )
      .join(' ');
  }
  return String(content ?? '');
}
