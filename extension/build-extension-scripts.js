/**
 * Build extension scripts as standalone IIFE bundles
 * No external imports, all dependencies inlined
 */
import { build } from 'vite';
import { resolve } from 'path';

const scripts = ['background', 'content', 'inpage'];

async function buildScript(scriptName) {
  await build({
    configFile: false,
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
