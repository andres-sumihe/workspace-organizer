import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const API_PROXY_TARGET = process.env.VITE_API_PROXY ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        // Keep the original path when proxying so requests like
        // /api/v1/workspaces are forwarded to the backend as
        // http://localhost:4000/api/v1/workspaces (no path stripping).
        // Removing the rewrite prevents the backend from receiving
        // requests missing the /api prefix which previously caused 404s.
        // (No rewrite function here intentionally.)
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src')
    }
  },
  preview: {
    port: 4173
  }
});
