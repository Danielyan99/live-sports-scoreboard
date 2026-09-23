// Renders scripts/og-image.svg to apps/web/public/og-image.png (1200×630), the link preview image.
// Run with: npm run og-image
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('./og-image.svg', import.meta.url));
const to = fileURLToPath(new URL('../apps/web/public/og-image.png', import.meta.url));

await sharp(from, { density: 144 }).resize(1200, 630).png({ compressionLevel: 9 }).toFile(to);
console.log(`Wrote ${to}`);
