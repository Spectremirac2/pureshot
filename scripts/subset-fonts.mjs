// Fontları sitenin gerçekten kullandığı glif kümesine indirger.
//   node_modules/@fontsource/<aile>/files/<aile>-latin(-ext)-<kalınlık>-normal.woff2
//     → src/assets/fonts/<aile>-<kalınlık>.woff2   (latin + latin-ext birleşik, tek dosya/kalınlık)
//     → src/styles/fonts.css                       (@font-face kuralları; aile adları eskisiyle aynı)
//
// Glif kümesi: src/**/*.{js,css} + index.html içindeki tüm ASCII dışı karakterler (\uXXXX kaçışları dahil)
// ∪ Temel Latin ∪ Latin-1 Ek ∪ Türkçe harfler ∪ sık noktalama/oklar. Kullanıcı metninde başka alfabeler
// (Kiril, Yunan…) görünürse tarayıcı sistem fontuna düşer; bu bilinçli bir tercihtir.
//
// Gerekenler: Python 3 + fonttools + brotli  →  pip install --user fonttools brotli
// Kullanım:   npm run build:fonts   (ya da: node scripts/subset-fonts.mjs)
// Yeni bir ASCII dışı karakter (ör. yeni bir simge) eklendiğinde yeniden çalıştırılmalıdır.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT_DIR = join(ROOT, 'src/assets/fonts');
const CSS_OUT = join(ROOT, 'src/styles/fonts.css');
const PY = process.env.PYTHON || 'python3';

// Kullanılan aile + kalınlıklar (tarayıcı turunda document.fonts ile doğrulandı; bkz. docs/OPTIMIZASYON.md).
// Unbounded: başlıklar (800/900) · Cinzel: lore/etiketler (700) · Barlow: gövde (400–700) · JetBrains Mono: sayılar (500/700)
const FACES = [
  { family: 'Unbounded', pkg: 'unbounded', weights: [800, 900] },
  { family: 'Cinzel', pkg: 'cinzel', weights: [700] },
  { family: 'Barlow', pkg: 'barlow', weights: [400, 500, 600, 700] },
  { family: 'JetBrains Mono', pkg: 'jetbrains-mono', weights: [500, 700] },
];

// ------------------------------------------------------------------ glif kümesi
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const base = new Set([
  ...range(0x20, 0x7e), // Temel Latin
  ...range(0xa0, 0xff), // Latin-1 Ek (Ç ç Ö ö Ü ü â î û …)
  ...[...'ĞğİıŞşÂâÎîÛû'].map((c) => c.codePointAt(0)), // Türkçe
  0x0307, // birleşik üst nokta ('İ'.toLocaleLowerCase() → i̇)
  ...[...'‘’‚“”„–—―…•·‹›«»′″€₺™№†‡‰−×÷±≈≠≤≥←→↑↓↔↗↘⇄✓✔✕✗★☆♥♦●○◆◇■□▲△▼▽►◄▸◂▾▴'].map((c) => c.codePointAt(0)),
]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) yield* walk(abs);
    else yield abs;
  }
}

function collect() {
  const set = new Set(base);
  const files = [...walk(join(ROOT, 'src'))].filter((f) => /\.(js|css)$/.test(f));
  files.push(join(ROOT, 'index.html'));
  const add = (cp) => { if (cp > 0x7e) set.add(cp); };
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const ch of text) add(ch.codePointAt(0));
    // JS kaçışları: ç, \u{1F600}, \xE7
    for (const m of text.matchAll(/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g)) add(parseInt(m[1] || m[2] || m[3], 16));
    // CSS kaçışları: content: '\2192'
    if (f.endsWith('.css')) for (const m of text.matchAll(/\\([0-9a-fA-F]{4,6})\s?/g)) add(parseInt(m[1], 16));
  }
  return { set, files: files.length };
}

// ------------------------------------------------------------------ araçlar
function checkTools() {
  try {
    execFileSync(PY, ['-c', 'import fontTools, brotli'], { stdio: 'pipe' });
  } catch {
    console.error('fonttools/brotli bulunamadı. Kurulum: pip install --user fonttools brotli');
    process.exit(1);
  }
}

function hex(cp) {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}

// ------------------------------------------------------------------ çalıştır
checkTools();
const { set, files } = collect();
const cps = [...set].sort((a, b) => a - b);
const tmp = mkdtempSync(join(tmpdir(), 'subset-fonts-'));
const unicodesFile = join(tmp, 'unicodes.txt');
writeFileSync(unicodesFile, cps.map(hex).join('\n') + '\n');
console.log(`${files} dosya tarandı · ${cps.length} karakter (${cps.filter((c) => c > 0xff).length} tanesi Latin-1 dışı)`);

mkdirSync(OUT_DIR, { recursive: true });
const css = [
  '/* Bu dosya scripts/subset-fonts.mjs tarafından üretilir; elle düzenlemeyin (npm run build:fonts). */',
  '/* Alt küme fontlar: sitenin kullandığı glifler (Türkçe dahil), tek dosya/kalınlık. */',
];
let total = 0;
let before = 0;
try {
  for (const face of FACES) {
    for (const w of face.weights) {
      const dir = join(ROOT, 'node_modules/@fontsource', face.pkg, 'files');
      const srcs = ['latin', 'latin-ext'].map((s) => join(dir, `${face.pkg}-${s}-${w}-normal.woff2`));
      for (const s of srcs) {
        if (!existsSync(s)) throw new Error('Kaynak font yok: ' + relative(ROOT, s) + ' (npm ci?)');
        before += statSync(s).size;
      }
      const merged = join(tmp, `${face.pkg}-${w}.ttf`);
      const out = join(OUT_DIR, `${face.pkg}-${w}.woff2`);
      // latin önce: aynı kod noktası iki dosyada varsa latin sürümü kalır
      execFileSync(PY, ['-m', 'fontTools.merge', ...srcs, `--output-file=${merged}`], { stdio: 'pipe' });
      execFileSync(PY, [
        '-m', 'fontTools.subset', merged,
        `--unicodes-file=${unicodesFile}`,
        // tnum: .num/.mono sınıfları; frac/numr/dnom sitede kullanılmıyor (varsayılan olarak da kapalı)
        '--layout-features+=tnum',
        '--layout-features-=frac,numr,dnom',
        '--flavor=woff2',
        `--output-file=${out}`,
      ], { stdio: 'pipe' });
      const size = statSync(out).size;
      total += size;
      console.log(`  ${relative(ROOT, out)}  ${(size / 1024).toFixed(1)} KB`);
      css.push(
        '@font-face {',
        `  font-family: '${face.family}';`,
        '  font-style: normal;',
        '  font-display: swap;',
        `  font-weight: ${w};`,
        `  src: url(../assets/fonts/${face.pkg}-${w}.woff2) format('woff2');`,
        '}',
      );
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
writeFileSync(CSS_OUT, css.join('\n') + '\n');
console.log(`${relative(ROOT, CSS_OUT)} yazıldı · toplam ${(total / 1024).toFixed(1)} KB (kaynak latin+latin-ext: ${(before / 1024).toFixed(1)} KB)`);
