import {
  ChatResponseSchema,
  RegistrySnapshotSchema,
  type ChatMessage,
  type ChatResponse,
  type Locale,
  type RegistrySnapshot,
} from '@orbit/shared';
import { clientEnv } from '@/env';

/**
 * Browser-side API access. Every response crossing the boundary is validated
 * with the shared zod schemas. (Server-side HTTP — the /api/sync proxy — uses
 * the axios HttpClient in src/server/http-client.ts instead.)
 */

export async function fetchRegistry(): Promise<RegistrySnapshot> {
  const res = await fetch(`${clientEnv.registryApiUrl}/registry`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET /registry failed with ${res.status}`);
  return RegistrySnapshotSchema.parse(await res.json());
}

export async function postChat(messages: ChatMessage[], lang: Locale): Promise<ChatResponse> {
  const res = await fetch(`${clientEnv.assistantApiUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ messages, lang }),
  });
  if (!res.ok) throw new Error(`POST /chat failed with ${res.status}`);
  return ChatResponseSchema.parse(await res.json());
}

/**
 * Triggers a registry sync through the app's own server-side proxy so the
 * SYNC_APP_TOKEN never reaches the browser.
 */
export async function postSync(): Promise<void> {
  const res = await fetch('/api/sync', { method: 'POST' });
  if (!res.ok) throw new Error(`POST /api/sync failed with ${res.status}`);
}
