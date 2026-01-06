import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    minify: false, // Disable minification for easier debugging
    sourcemap: true, // Generate source maps for debugging
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'background' ? 'src/[name].js' : 'assets/[name]-[hash].js';
        },
      },
    },
  },
});

