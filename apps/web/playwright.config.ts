import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke suite. Assumes the dev stack is already running
 * (`make dev-infra && make dev`, or `make docker-up`) with the web app on
 * http://localhost:3000. Run with `pnpm --filter @orbit/web test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
