/**
 * Post-build script to create Firefox distribution
 *
 * Copies the Chrome dist/ to dist-firefox/ and replaces the manifest
 * with the Firefox-specific one (background.scripts instead of service_worker,
 * gecko addon ID, etc.)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chromeDistDir = path.join(__dirname, 'dist');
const firefoxDistDir = path.join(__dirname, 'dist-firefox');
const firefoxManifestSrc = path.join(__dirname, 'public', 'manifest.firefox.json');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  console.log('Building Firefox extension...\n');

  // Verify Chrome dist exists
  if (!fs.existsSync(chromeDistDir)) {
    throw new Error('Chrome dist/ not found. Run "npm run build" first.');
  }

  // Clean previous Firefox dist
  if (fs.existsSync(firefoxDistDir)) {
    fs.rmSync(firefoxDistDir, { recursive: true, force: true });
    console.log('Cleaned previous dist-firefox/');
  }

  // Copy Chrome dist to Firefox dist
  copyRecursive(chromeDistDir, firefoxDistDir);
  console.log('Copied dist/ to dist-firefox/');

  // Replace manifest.json with Firefox version
  const firefoxManifest = fs.readFileSync(firefoxManifestSrc, 'utf-8');
  fs.writeFileSync(path.join(firefoxDistDir, 'manifest.json'), firefoxManifest);

  // Also replace the nested copy if it exists
  const nestedManifest = path.join(firefoxDistDir, 'src', 'manifest.json');
  if (fs.existsSync(nestedManifest)) {
    fs.writeFileSync(nestedManifest, firefoxManifest);
  }

  console.log('Replaced manifest.json with Firefox version');
  console.log('\n✅ Firefox build complete! Output: dist-firefox/');
  console.log('\nTo load in Firefox:');
  console.log('  1. Open about:debugging#/runtime/this-firefox');
  console.log('  2. Click "Load Temporary Add-on..."');
  console.log('  3. Select dist-firefox/manifest.json');
  console.log('\nOr use web-ext:');
  console.log('  npx web-ext run --source-dir=./dist-firefox');

} catch (err) {
  console.error('❌ Firefox build failed:', err.message);
  process.exit(1);
}
