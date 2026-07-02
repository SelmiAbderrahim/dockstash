import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/seed-superadmin.ts'],
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: true,
  minify: false,
});
