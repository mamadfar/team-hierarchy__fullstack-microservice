import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Unit test config. SWC (not esbuild) so `emitDecoratorMetadata` works and
 * Nest decorators behave exactly as in the tsc build.
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
    include: ['src/**/__tests__/**/*.unit.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/cli/**',
        'src/main.ts',
        'src/**/dto/**',
        'src/**/*.module.ts',
      ],
      // Report-only: no failing threshold gate (target is >=80% lines).
    },
  },
});
