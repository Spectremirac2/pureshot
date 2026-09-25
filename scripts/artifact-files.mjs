// dist/ içeriğini claude.ai Artifact yayını için dosya eşlemesine çevirir.
// Kullanım: node scripts/artifact-files.mjs  → JSON: { "assets/app.js": "dist/assets/app.js", ... }
// .woff yedek fontları atlanır (CSS içinde woff2 gömülü olduğu için tarayıcı onları hiç istemez).
// .glb dosyaları Artifact'ta sunulmaz; yerlerine .glb.json kopyaları yayınlanır.
// Paylaşım önizlemesi ve uygulama simgeleri (public/: og.jpg, favicon.svg, *.png, manifest) atlanır:
// Artifact sayfası kendi iskeletini kullandığı için artifact.html bunlara başvurmaz.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SHARE_FILES = /^(og\.(jpe?g|png)|favicon\.(svg|ico)|apple-touch-icon\.png|icon-\d+\.png|manifest\.webmanifest|\.nojekyll)$/;

const out = {};
let total = 0;
function walk(dir, rel = '') {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, r);
    else {
      if (name === 'index.html' || name === 'artifact.html' || name.endsWith('.woff') || name.endsWith('.glb')) continue;
      if (!rel && SHARE_FILES.test(name)) continue;
      out[r] = abs;
      total += st.size;
    }
  }
}
walk('dist');
console.log(JSON.stringify(out, null, 2));
console.error(`${Object.keys(out).length} dosya, toplam ${(total / 1024 / 1024).toFixed(2)} MB`);
