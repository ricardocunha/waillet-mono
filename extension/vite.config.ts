import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    minify: false, // Disable minification for debugging
    sourcemap: true, // Generate source maps for debugging
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        inpage: resolve(__dirname, 'src/inpage.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Put background, content, and inpage scripts in src/ directory
          if (['background', 'content', 'inpage'].includes(chunkInfo.name)) {
            return 'src/[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});

