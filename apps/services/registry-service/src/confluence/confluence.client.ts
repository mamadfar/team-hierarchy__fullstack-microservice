import { Inject, Injectable, Optional } from '@nestjs/common';
import { z } from 'zod';

import { AppError } from '../common/app-error';
import { formatZodError } from '../common/zod-error';
import { ENV, Env } from '../config/env';
import { HttpClient } from './http-client';

/** Test hook: provide a pre-built HttpClient instead of the env-derived one. */
export const CONFLUENCE_HTTP = Symbol('CONFLUENCE_HTTP');

const PageResponseSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().default(''),
  body: z.object({
    storage: z.object({
      value: z.string(),
    }),
  }),
});

export interface ConfluencePage {
  id: string;
  title: string;
  /** body.storage.value — the XHTML storage format the parser consumes. */
  html: string;
}

/**
 * Read-only Confluence Cloud v2 client:
 * GET {CONFLUENCE_BASE_URL}/api/v2/pages/{id}?body-format=storage with
 * basic auth (service-account email + API token).
 */
@Injectable()
export class ConfluenceClient {
  private readonly http: HttpClient;

  constructor(
    @Inject(ENV) env: Env,
    @Optional() @Inject(CONFLUENCE_HTTP) http?: HttpClient,
  ) {
    this.http =
      http ??
      new HttpClient({
        baseURL: env.CONFLUENCE_BASE_URL || undefined,
        timeoutMs: 10_000,
        auth: { username: env.CONFLUENCE_EMAIL, password: env.CONFLUENCE_API_TOKEN },
        headers: { Accept: 'application/json' },
      });
  }

  async getPageStorage(pageId: string): Promise<ConfluencePage> {
    const data = await this.http.get<unknown>(`/api/v2/pages/${encodeURIComponent(pageId)}`, {
      params: { 'body-format': 'storage' },
    });
    const parsed = PageResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError(
        502,
        `Confluence page ${pageId}: unexpected response shape (${formatZodError(parsed.error)})`,
      );
    }
    return {
      id: String(parsed.data.id),
      title: parsed.data.title,
      html: parsed.data.body.storage.value,
    };
  }
}
