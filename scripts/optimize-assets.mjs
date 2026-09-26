// assets-src/raw/ → src/assets/fal/ : görselleri WebP'ye çevirir, GLB'leri sıkıştırır.
// Kullanım: node scripts/optimize-assets.mjs   (sharp ve @gltf-transform/cli gerekir)
//
// Ayarlar (Eylül 2026, bkz. docs/OPTIMIZASYON.md):
//   GLB: meshopt + WebP doku, en fazla 768×768 (1024'e göre model başına ~%25 daha küçük; müze ve ana sayfa
//        boyutunda fark görülmüyor). texture-arena: 1024 px, kalite 80 (taş dokusu; 86 → 80 ~%20 daha küçük).
//
// Ham kaynaklar (assets-src/raw/) git'e girmez; varsa bu betik depodaki src/assets/fal/ dosyalarını bayt bayt
// aynı üretir. Ham kaynak yoksa aynı ayarlar mevcut dosyalara --yerinde ile uygulanabilir: GLB'ler yeniden
// sadeleştirilmeden (üçgen sayısı aynı kalır) doku boyutu/kalitesi düşürülür. Sonuç en az %10 küçülmüyorsa
// dosya olduğu gibi kalır; böylece zaten işlenmiş dosyalar yeniden kodlanıp kalite kaybetmez.
//   node scripts/optimize-assets.mjs --yerinde
import { readdirSync, mkdirSync, statSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const SRC = 'assets-src/raw';
const OUT = 'src/assets/fal';
const inPlace = process.argv.includes('--yerinde');
mkdirSync(OUT, { recursive: true });

const GLB_TEXTURE_SIZE = '768';
// Ekranda küçük görünen birimler (creep'ler, kurye) 512² dokuyla yeterince net; ~%25 daha küçük dosya
const glbTextureSize = (file) => (/^model-(creep-|neutral-|courier)/.test(file.split('/').pop()) ? '512' : GLB_TEXTURE_SIZE);
const rules = [
  { test: /^hero-keyart/, width: 2400, quality: 78 },
  { test: /^poster-/, width: 1600, quality: 80 },
  { test: /^portrait-/, width: 768, quality: 80 },
  { test: /^texture-/, width: 1024, quality: 80 },
  // Arena hikâyesi: bölüm afişleri (16:9) ve diyalog kartlarındaki boss portreleri (küçük gösterilir)
  { test: /^story-boss-/, width: 512, quality: 78 },
  { test: /^story-ch/, width: 1280, quality: 76 },
];

const kb = (f) => (statSync(f).size / 1024).toFixed(0) + ' KB';

function optimizeGlb(src, out, extra = []) {
  execFileSync('npx', ['gltf-transform', 'optimize', src, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', glbTextureSize(out), ...extra], { stdio: 'inherit' });
}

if (inPlace) {
  // Mevcut çıktılar üzerinde: GLB dokuları + texture-* kalite ayarı
  for (const file of readdirSync(OUT)) {
    const path = `${OUT}/${file}`;
    const tmp = `${OUT}/.tmp-${file}`;
    const before = kb(path);
    if (file.endsWith('.glb')) {
      optimizeGlb(path, tmp, ['--simplify', 'false']);
    } else if (/^texture-.*\.webp$/.test(file)) {
      const rule = rules.find((r) => r.test.test(file));
      await sharp(path).resize({ width: rule.width, withoutEnlargement: true }).webp({ quality: rule.quality, effort: 6, smartSubsample: true }).toFile(tmp);
    } else continue;
    const gain = 1 - statSync(tmp).size / statSync(path).size;
    if (gain >= 0.1) renameSync(tmp, path);
    else rmSync(tmp);
    console.log(`${file}  ${before} → ${kb(path)}${gain >= 0.1 ? '' : ' (zaten işlenmiş, değişmedi)'}`);
  }
} else {
  for (const file of readdirSync(SRC)) {
    const key = file.replace(/\.[^.]+$/, '');
    const src = `${SRC}/${file}`;
    if (file.endsWith('.glb')) {
      const out = `${OUT}/${key}.glb`;
      optimizeGlb(src, out);
      console.log(`${key}.glb  ${kb(src)} → ${kb(out)}`);
      continue;
    }
    const rule = rules.find((r) => r.test.test(key));
    if (!rule) continue;
    const out = `${OUT}/${key}.webp`;
    await sharp(src).resize({ width: rule.width, withoutEnlargement: true }).webp({ quality: rule.quality, effort: 5 }).toFile(out);
    console.log(`${key}.webp  ${kb(src)} → ${kb(out)}`);
  }
}
