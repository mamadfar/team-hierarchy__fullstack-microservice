import { NextResponse } from 'next/server';
import { getServerEnv } from '@/env';
import { HttpClient, HttpError } from '@/server/http-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let client: HttpClient | null = null;

function getClient(baseURL: string): HttpClient {
  if (!client) client = new HttpClient({ baseURL, timeoutMs: 120_000 });
  return client;
}

/**
 * Server-side proxy for the UI Refresh button. Forwards to registry-service
 * POST /sync with the SYNC_APP_TOKEN bearer — the token stays on the server
 * and never reaches the client bundle.
 */
export async function POST() {
  const env = getServerEnv();
  try {
    const data = await getClient(env.registryApiUrl).post<unknown>(
      '/sync',
      {},
      { headers: { Authorization: `Bearer ${env.syncAppToken}` } },
    );
    return NextResponse.json(data ?? { status: 200, message: 'sync triggered' });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502;
    // Sanitized: no upstream details or token material.
    return NextResponse.json({ status, message: 'Sync failed' }, { status });
  }
}
