import { readFileSync } from 'node:fs';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite-plus';

// fonts.css starts with the web font `@import`, which must stay first; its absolute address works from any directory.
const DESIGN_CSS = ['components/fonts.css', 'tokens.css', 'components/bundle.css'] as const;

/** Emits `design.css` (fonts → tokens → bundle) beside the app for the public examples pages (contract D-6). */
function designCss(): Plugin {
  const files = DESIGN_CSS.map((file) => new URL(`../../../design/${file}`, import.meta.url));

  return {
    name: 'ads-design-css',
    apply: 'build',
    generateBundle() {
      const parts = files.map((file, index) => {
        this.addWatchFile(file.pathname);

        return `/* design/${DESIGN_CSS[index]} */\n${readFileSync(file, 'utf8').trim()}\n`;
      });

      this.emitFile({ type: 'asset', fileName: 'design.css', source: parts.join('\n') });
    },
  };
}

// One ES module plus one stylesheet, loaded by the vanilla PHP shell (`admin/app.php`) with fixed names.
export default defineConfig(({ command }) => ({
  plugins: [react(), designCss()],
  // Library mode leaves `process.env.NODE_ENV` in the React sources; tests keep React's development build for act().
  define: command === 'build' ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {},
  build: {
    lib: {
      entry: 'src/main.tsx',
      formats: ['es'],
      fileName: () => 'admin-app.js',
      cssFileName: 'admin-app',
    },
    outDir: '../public/assets/admin-app',
    // The output directory sits outside this package, so Vite will not clear it unless told to.
    emptyOutDir: true,
    copyPublicDir: false,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    unstubGlobals: true,
    clearMocks: true,
  },
}));
