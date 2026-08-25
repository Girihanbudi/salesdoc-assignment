import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'api',
          root: './apps/api',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          // The first fastify.inject() pays a one-time boot cost that can pass
          // 5s on a cold machine. The tests themselves are milliseconds.
          testTimeout: 20_000,
        },
      },
      // Referenced by path so it inherits apps/web/vite.config.ts — the react
      // plugin and the `@/` alias — instead of duplicating them here.
      './apps/web',
    ],
  },
});
