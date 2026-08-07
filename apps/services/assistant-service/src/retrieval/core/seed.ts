import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SeedFileSchema, type SeedFile } from '@orbit/shared';

/**
 * Load + zod-validate the canonical seed fixture. Tries a few roots because
 * callers run from different working directories (package scripts run from
 * the package dir, vitest from its configured root).
 */
export function loadSeedFile(explicitPath?: string): SeedFile {
  const candidates = explicitPath
    ? [explicitPath]
    : [
        resolve(process.cwd(), '../../../infra/db/seed/registry.json'),
        resolve(process.cwd(), 'infra/db/seed/registry.json'),
        // __dirname exists in the CJS build/tsx, but not under vitest's ESM runtime.
        ...(typeof __dirname !== 'undefined'
          ? [resolve(__dirname, '../../../../../../infra/db/seed/registry.json')]
          : []),
      ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`seed registry.json not found; tried:\n${candidates.join('\n')}`);
  }
  return SeedFileSchema.parse(JSON.parse(readFileSync(found, 'utf8')));
}
