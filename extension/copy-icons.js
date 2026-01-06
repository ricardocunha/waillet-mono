import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source icon
const sourceIcon = path.join(__dirname, '../images/freepik__smart_wallet_with_ai_artificak_intellenge_ins (1).png');

// Destination icons (Chrome needs 16, 48, 128)
const icons = [
  'public/icons/icon-16.png',
  'public/icons/icon-48.png',
  'public/icons/icon-128.png'
];

try {
  // Ensure icons directory exists
  const iconsDir = path.join(__dirname, 'public/icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Copy to all sizes (browser will resize automatically)
  icons.forEach(icon => {
    const destPath = path.join(__dirname, icon);
    fs.copyFileSync(sourceIcon, destPath);
    console.log(`✅ Copied to ${icon}`);
  });

  console.log('✅ All icons copied successfully!');
} catch (err) {
  console.error('❌ Error copying icons:', err.message);
  process.exit(1);
}

