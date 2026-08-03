import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const SERVER_PROXY_TARGET = process.env.SERVER_URL ?? 'http://localhost:5000';

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
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
