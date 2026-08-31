import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Agent cards are built when their module is imported, so the origin they
    // advertise has to be set before any import runs — assigning it inside a
    // test is already too late.
    env: {
      A2A_PUBLIC_ORIGIN: 'http://a2a.test',
    },
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` is a Next.js build-time guard with no runtime export;
      // stub it so server modules can be unit-tested under plain Node/vitest.
      'server-only': path.resolve(__dirname, './src/test/server-only-stub.ts'),
    },
  },
});
