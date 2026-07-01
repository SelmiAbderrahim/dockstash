import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const SERVER_PROXY_TARGET = process.env.SERVER_URL ?? 'http://localhost:5000';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  ssr: {
    // react-helmet-async ships CommonJS; bundle it into the SSR output so
    // Node's ESM loader doesn't choke on its named exports.
    noExternal: ['react-helmet-async'],
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: SERVER_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
