import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['test/**/*.test.js'], testTimeout: 900000, hookTimeout: 900000, pool: 'forks' },
});
