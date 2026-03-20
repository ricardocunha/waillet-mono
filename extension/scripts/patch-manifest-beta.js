import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '..', 'dist');
const manifestPaths = [
  path.join(distDir, 'manifest.json'),
  path.join(distDir, 'src', 'manifest.json'),
];

function patchManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return;
  }

  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw);

  const betaSuffix = ' BETA';
  if (typeof manifest.name === 'string' && !manifest.name.endsWith(betaSuffix)) {
    manifest.name = `${manifest.name}${betaSuffix}`;
  }

  const betaNotice = 'THIS EXTENSION IS FOR BETA TESTING.';
  if (typeof manifest.description === 'string' && !manifest.description.includes(betaNotice)) {
    manifest.description = `${manifest.description.replace(/\s+$/, '')} ${betaNotice}`;
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✅ Patched beta manifest: ${manifestPath}`);
}

let patched = false;
for (const manifestPath of manifestPaths) {
  const exists = fs.existsSync(manifestPath);
  patchManifest(manifestPath);
  if (exists) {
    patched = true;
  }
}

if (!patched) {
  console.warn('⚠️ No manifest.json found in dist/. Run the build first.');
}
