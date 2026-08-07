import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': r('./src'),
      '@orbit/shared/db': r('../../packages/shared/src/db/schema.ts'),
      '@orbit/shared': r('../../packages/shared/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright specs live in e2e/ and are NOT part of `test`.
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    clearMocks: true,
  },
});
