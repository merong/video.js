import { defineConfig } from 'vite-plus';
import type { UserConfig as PackUserConfig } from 'vite-plus/pack';

import { baseConfig, type PackageBuildMode, packageBuildConfig, packageBuildModes } from '../../../build/pack.ts';
import { cachedTaskInputs, packageTestTask, workspaceTaskDependencies } from '../../../build/task.ts';

const createPackConfig = (mode: PackageBuildMode): PackUserConfig => ({
  ...packageBuildConfig(mode, 'neutral'),
  entry: {
    index: './src/index.ts',
    'dom/index': './src/dom/index.ts',
    'html/index': './src/html/index.ts',
    'html/define': './src/html/define.ts',
  },
});

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: 'vp pack',
        dependsOn: workspaceTaskDependencies(),
        cache: { input: cachedTaskInputs, output: ['dist/**'] },
      },
      'test:ci': packageTestTask(),
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  define: { __DEV__: 'true' },
  pack: [
    ...packageBuildModes.map(createPackConfig),
    {
      ...baseConfig,
      entry: { ads: './src/cdn.ts' },
      platform: 'browser',
      format: 'es',
      outDir: 'dist/cdn',
      dts: false,
      clean: true,
      hash: false,
      deps: { alwaysBundle: [/.*/], onlyBundle: false },
      treeshake: { moduleSideEffects: [{ test: /\/html\/define\.(?:ts|js)$/, sideEffects: true }] },
      define: { __DEV__: 'false' },
    },
  ],
});
