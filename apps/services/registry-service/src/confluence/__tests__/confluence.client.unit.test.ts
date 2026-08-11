import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../common/app-error';
import { parseEnv } from '../../config/env';
import { ConfluenceClient } from '../confluence.client';
import type { HttpClient } from '../http-client';

const env = parseEnv({
  MOCK_CONFLUENCE: 'false',
  CONFLUENCE_BASE_URL: 'https://org.atlassian.net/wiki',
  CONFLUENCE_EMAIL: 'svc-orbit@company.com',
  CONFLUENCE_API_TOKEN: 'token',
  CONFLUENCE_PAGE_IDS: '84213977',
  SYNC_APP_TOKEN: 'unit-test-sync-token-32chars-min!!',
});

describe('ConfluenceClient', () => {
  it('requests the v2 storage endpoint and normalizes the page shape', async () => {
    const get = vi.fn().mockResolvedValue({
      id: 84213977,
      title: 'NovaPay Team Registry',
      body: { storage: { value: '<table></table>' } },
    });
    const client = new ConfluenceClient(env, { get } as unknown as HttpClient);

    const page = await client.getPageStorage('84213977');
    expect(get).toHaveBeenCalledWith('/api/v2/pages/84213977', {
      params: { 'body-format': 'storage' },
    });
    expect(page).toEqual({
      id: '84213977',
      title: 'NovaPay Team Registry',
      html: '<table></table>',
    });
  });

  it('unexpected response shapes become a 502 AppError naming the page', async () => {
    const get = vi.fn().mockResolvedValue({ nope: true });
    const client = new ConfluenceClient(env, { get } as unknown as HttpClient);

    const failure = await client.getPageStorage('84213977').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).status).toBe(502);
    expect((failure as AppError).message).toContain('84213977');
  });
});
