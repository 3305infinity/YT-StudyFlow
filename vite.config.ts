import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './public/manifest.json';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    plugins: [react(), crx({ manifest: manifest as chrome.runtime.ManifestV3 })],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@features': path.resolve(__dirname, './src/features'),
        '@components': path.resolve(__dirname, './src/components'),
        '@lib': path.resolve(__dirname, './src/lib'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@store': path.resolve(__dirname, './src/store'),
        '@types': path.resolve(__dirname, './src/types'),
      },
    },

    build: {
      minify: 'terser' as const,
      terserOptions: {
        compress: {
          // Strip console/debugger from store builds only; keep them for dev builds.
          drop_console: isProd,
          drop_debugger: isProd,
        },
      },
    },

    server: {
      port: 5173,
      strictPort: true,
    },
  };
});
