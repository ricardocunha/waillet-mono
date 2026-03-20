/**
 * Build extension scripts as standalone IIFE bundles
 * No external imports, all dependencies inlined
 */
import { build, loadEnv } from 'vite';
import { resolve } from 'path';

const scripts = ['background', 'content', 'inpage'];
const mode = process.env.MODE || 'production';
const env = loadEnv(mode, process.cwd(), 'VITE_');
const apiBaseUrl = env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || '';

async function buildScript(scriptName) {
  await build({
    configFile: false,
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
    build: {
      lib: {
        entry: resolve(process.cwd(), `src/${scriptName}.ts`),
        name: scriptName,
        fileName: () => `${scriptName}.js`,
        formats: ['iife']
      },
      outDir: 'dist/src',
      emptyOutDir: false,
      minify: false,
      sourcemap: true,
      rollupOptions: {
        output: {
          extend: true,
          inlineDynamicImports: true,
        }
      }
    }
  });
  console.log(`✅ Built ${scriptName}.js`);
}

async function buildAll() {
  console.log('Building extension scripts as IIFE bundles...\n');

  for (const script of scripts) {
    await buildScript(script);
  }

  console.log('\n✅ All extension scripts built successfully!');
}

buildAll().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
