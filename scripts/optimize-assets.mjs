// assets-src/raw/ → src/assets/fal/ : görselleri WebP'ye çevirir, GLB'leri sıkıştırır.
// Kullanım: node scripts/optimize-assets.mjs   (sharp ve @gltf-transform/cli gerekir)
import { readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const SRC = 'assets-src/raw';
const OUT = 'src/assets/fal';
mkdirSync(OUT, { recursive: true });

const rules = [
  { test: /^hero-keyart/, width: 2400, quality: 78 },
  { test: /^poster-/, width: 1600, quality: 80 },
  { test: /^portrait-/, width: 768, quality: 80 },
  { test: /^texture-/, width: 1024, quality: 86 },
];

for (const file of readdirSync(SRC)) {
  const key = file.replace(/\.[^.]+$/, '');
  const src = `${SRC}/${file}`;
  if (file.endsWith('.glb')) {
    const out = `${OUT}/${key}.glb`;
    execFileSync('npx', ['gltf-transform', 'optimize', src, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024'], { stdio: 'inherit' });
    console.log(`${key}.glb  ${(statSync(src).size / 1024).toFixed(0)} KB → ${(statSync(out).size / 1024).toFixed(0)} KB`);
    continue;
  }
  const rule = rules.find((r) => r.test.test(key));
  if (!rule) continue;
  const out = `${OUT}/${key}.webp`;
  await sharp(src).resize({ width: rule.width, withoutEnlargement: true }).webp({ quality: rule.quality, effort: 5 }).toFile(out);
  console.log(`${key}.webp  ${(statSync(src).size / 1024).toFixed(0)} KB → ${(statSync(out).size / 1024).toFixed(0)} KB`);
}
