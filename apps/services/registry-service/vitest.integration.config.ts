import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Integration test config. Assumes postgres + redis from
 * infra/docker/docker-compose.dev.yml are reachable at DATABASE_URL/REDIS_URL
 * (defaults: postgres://orbit:orbit@localhost:5433/orbit, redis://localhost:6380).
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.integration.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
