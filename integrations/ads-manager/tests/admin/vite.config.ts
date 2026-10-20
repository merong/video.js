import { defineConfig } from 'vite-plus';

export default defineConfig({
  cacheDir: 'integrations/ads-manager/tests/admin/.cache',
  test: {
    include: ['integrations/ads-manager/tests/admin/*.test.ts'],
    environment: 'jsdom',
    restoreMocks: true,
    unstubGlobals: true,
    clearMocks: true,
    watch: false,
  },
});
