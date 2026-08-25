import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  server: {
    // Same-origin in dev: the browser only ever talks to :5173, so there is no
    // CORS and no base-URL env var to get wrong between dev and prod.
    proxy: {
      '/api': 'http://localhost:3000',
      '/mock-crm': 'http://localhost:3000',
      '/leads': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
