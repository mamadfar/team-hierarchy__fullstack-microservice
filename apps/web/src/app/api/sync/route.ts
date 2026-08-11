import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/env';
import { HttpClient, HttpError } from '@/server/http-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let client: HttpClient | null = null;
let clientBaseUrl: string | null = null;

function getClient(baseURL: string): HttpClient {
  if (!client || clientBaseUrl !== baseURL) {
    client = new HttpClient({ baseURL, timeoutMs: 120_000 });
    clientBaseUrl = baseURL;
  }
  return client;
}

function tokenMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Allow:
 *  1) Bearer SYNC_APP_TOKEN (Confluence Automation / ops), or
 *  2) same-origin browser Refresh (Sec-Fetch-Site: same-origin / matching Origin).
 * Reject cross-site CSRF that would otherwise burn the registry sync quota.
 */
function isAuthorizedSyncRequest(req: NextRequest, syncAppToken: string): boolean {
  const header = req.headers.get('authorization');
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    const provided = header.slice(7).trim();
    if (provided && tokenMatches(provided, syncAppToken)) return true;
  }

  const site = req.headers.get('sec-fetch-site');
  if (site === 'same-origin') return true;

  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const requestHost = req.headers.get('host');
      if (requestHost && originHost === requestHost) return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Server-side proxy for the UI Refresh button + Confluence Automation.
 * Forwards to registry-service POST /sync with the SYNC_APP_TOKEN bearer —
 * the token stays on the server and never reaches the client bundle.
 */
export async function POST(req: NextRequest) {
  const env = getServerEnv();
  if (!isAuthorizedSyncRequest(req, env.syncAppToken)) {
    return NextResponse.json({ status: 401, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await getClient(env.registryApiUrl).post<unknown>(
      '/sync',
      {},
      {
        headers: { Authorization: `Bearer ${env.syncAppToken}` },
        // Browser abort (new Refresh) cancels the upstream registry call.
        signal: req.signal,
      },
    );
    return NextResponse.json(data ?? { status: 200, message: 'sync triggered' });
  } catch (error) {
    if (req.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }
    const status = error instanceof HttpError ? error.status : 502;
    // Forward operational registry messages (422 parse/structure errors) so the UI
    // can show how to fix the Confluence page. Never echo tokens or raw stacks.
    const message =
      error instanceof HttpError && error.message && !/bearer|token|authorization/i.test(error.message)
        ? error.message
        : 'Sync failed';
    return NextResponse.json({ status, message }, { status });
  }
}
