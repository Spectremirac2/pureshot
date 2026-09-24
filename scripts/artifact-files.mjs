// dist/ içeriğini claude.ai Artifact yayını için dosya eşlemesine çevirir.
// Kullanım: node scripts/artifact-files.mjs  → JSON: { "assets/app.js": "dist/assets/app.js", ... }
// .woff yedek fontları atlanır (CSS içinde woff2 gömülü olduğu için tarayıcı onları hiç istemez).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const out = {};
let total = 0;
function walk(dir, rel = '') {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, r);
    else {
      if (name === 'index.html' || name === 'artifact.html' || name.endsWith('.woff')) continue;
      out[r] = abs;
      total += st.size;
    }
  }
}
walk('dist');
console.log(JSON.stringify(out, null, 2));
console.error(`${Object.keys(out).length} dosya, toplam ${(total / 1024 / 1024).toFixed(2)} MB`);
