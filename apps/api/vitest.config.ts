import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { UserConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: UserConfig = {
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      enabled: false
    }
  },
  resolve: {
    alias: {
      '@workspace/shared': path.resolve(__dirname, '../..', 'packages/shared/src/index.ts')
    }
  }
};

export default config;
