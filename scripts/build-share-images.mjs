// Paylaşım önizlemesi ve uygulama simgeleri → public/
//   favicon.svg            sekme simgesi: köz degradeli altıgen + pati (sitedeki .hud-crest ile aynı motif)
//   apple-touch-icon.png   180×180 (iOS ana ekran)
//   icon-192.png, icon-512.png   web manifest simgeleri (maskable: motif güvenli alanın içinde)
//   og.jpg                 1200×630 Open Graph / Twitter kartı: fal.ai ana görseli + başlık
//
// og.jpg sitenin kendi alt küme fontlarıyla (src/assets/fonts) Chromium'da çizilir; bu yüzden
// Playwright tarayıcısı gerekir (npx playwright install chromium). Simgeler için yalnızca sharp yeter.
// Kullanım: npm run build:share   (yalnızca simgeler: node scripts/build-share-images.mjs --simgeler)

import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const PUB = ROOT + 'public/';
const onlyIcons = process.argv.includes('--simgeler');
mkdirSync(PUB, { recursive: true });

// Renkler: src/styles/tokens.css (--bg, --grad-ember, --on-ember)
const BG = '#0d0b14';
const EMBER = ['#ff9a3d', '#ff6a2b', '#e0354b'];
const ON_EMBER = '#1a0d05';

// Pati: src/core/icons.js 'paw' geometrisi (24×24), küçük boyutta okunsun diye dolgulu
const PAW = `<g fill="${ON_EMBER}" stroke="${ON_EMBER}" stroke-width="0.9" stroke-linejoin="round">
    <circle cx="6.5" cy="9" r="2.1"/><circle cx="10" cy="5.5" r="2.1"/><circle cx="14" cy="5.5" r="2.1"/><circle cx="17.5" cy="9" r="2.1"/>
    <path d="M7.5 17c0-3 2-5.5 4.5-5.5s4.5 2.5 4.5 5.5c0 1.7-1.3 2.5-2.6 2.5-1 0-1.3-.6-1.9-.6s-.9.6-1.9.6c-1.3 0-2.6-.8-2.6-2.5z"/>
  </g>`;

/** Altıgen + pati; `scale` motifin tuvale oranı, `bg` verilirse tam zemin. */
function markSvg(size, { scale = 1, bg = null } = {}) {
  const s = 64 * scale;
  const o = (64 - s) / 2;
  const hex = [[32, 0], [64, 16], [64, 48], [32, 64], [0, 48], [0, 16]].map(([x, y]) => `${(o + x * scale).toFixed(2)},${(o + y * scale).toFixed(2)}`).join(' ');
  const k = 1.75 * scale; // pati ölçeği (24 birim → ~26 px / 64)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${EMBER[0]}"/><stop offset=".45" stop-color="${EMBER[1]}"/><stop offset="1" stop-color="${EMBER[2]}"/></linearGradient></defs>
  ${bg ? `<rect width="64" height="64" fill="${bg}"/>` : ''}
  <polygon points="${hex}" fill="url(#g)"/>
  <g transform="translate(${(32 - 12 * k).toFixed(2)} ${(33 - 11.5 * k).toFixed(2)}) scale(${k.toFixed(3)})">
  ${PAW}
  </g>
</svg>
`;
}

const kb = (f) => (statSync(f).size / 1024).toFixed(1) + ' KB';

// ------------------------------------------------------------------ simgeler
writeFileSync(PUB + 'favicon.svg', markSvg(64).replace(/ width="64" height="64"/, ''));
await sharp(Buffer.from(markSvg(180, { scale: 0.74, bg: BG }))).png({ compressionLevel: 9, palette: true }).toFile(PUB + 'apple-touch-icon.png');
await sharp(Buffer.from(markSvg(192, { scale: 0.66, bg: BG }))).png({ compressionLevel: 9, palette: true }).toFile(PUB + 'icon-192.png');
await sharp(Buffer.from(markSvg(512, { scale: 0.66, bg: BG }))).png({ compressionLevel: 9, palette: true }).toFile(PUB + 'icon-512.png');
for (const f of ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) console.log(`public/${f}  ${kb(PUB + f)}`);

if (onlyIcons) process.exit(0);

// ------------------------------------------------------------------ og.jpg
const W = 1200, H = 630;
const art = readdirSync(ROOT + 'src/assets/fal').find((f) => /^hero-keyart.*\.webp$/.test(f));
if (!art) throw new Error('src/assets/fal/hero-keyart*.webp bulunamadı (npm run fetch:fal)');
// Ana görsel sağa yaslı: okçu ve DOG'lar sağda, sol taraf başlığa kalır
const bgJpeg = await sharp(ROOT + 'src/assets/fal/' + art).resize({ height: H }).jpeg({ quality: 92 }).toBuffer();
const { width: bgW } = await sharp(bgJpeg).metadata();
const font = (f) => `data:font/woff2;base64,${readFileSync(ROOT + 'src/assets/fonts/' + f).toString('base64')}`;
const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
@font-face { font-family: 'Unbounded'; font-weight: 900; src: url(${font('unbounded-900.woff2')}) format('woff2'); }
@font-face { font-family: 'Cinzel'; font-weight: 700; src: url(${font('cinzel-700.woff2')}) format('woff2'); }
@font-face { font-family: 'Barlow'; font-weight: 600; src: url(${font('barlow-600.woff2')}) format('woff2'); }
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: ${BG}; }
.bg { position: absolute; inset: 0; background: url(data:image/jpeg;base64,${bgJpeg.toString('base64')}) ${W - bgW}px 0 / auto 100% no-repeat; }
.shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(13,11,20,.96) 0%, rgba(13,11,20,.88) 30%, rgba(13,11,20,.35) 58%, rgba(13,11,20,0) 75%), linear-gradient(0deg, rgba(13,11,20,.7) 0%, rgba(13,11,20,0) 30%); }
.box { position: absolute; left: 64px; top: 70px; width: 600px; }
.brand { display: flex; align-items: center; gap: 16px; font: 700 20px/1 Cinzel, serif; letter-spacing: .28em; color: #e9b949; text-transform: uppercase; }
.brand svg { width: 52px; height: 52px; }
h1 { margin: 34px 0 0; font: 900 100px/.96 Unbounded, sans-serif; letter-spacing: -.01em; }
h1 span { display: block; width: max-content; -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 6px 18px rgba(255,106,43,.35)); }
/* ana sayfadaki kademeli üçlü başlık: köz, altın, kor */
h1 span:nth-child(1) { background-image: linear-gradient(135deg, ${EMBER[0]}, ${EMBER[1]}); }
h1 span:nth-child(2) { margin-left: 56px; background-image: linear-gradient(135deg, #f6d98a, #e9b949); }
h1 span:nth-child(3) { margin-left: 22px; background-image: linear-gradient(135deg, ${EMBER[1]}, ${EMBER[2]}); }
p { margin: 30px 0 0; font: 600 29px/1.3 Barlow, sans-serif; color: #f3eadb; }
p b { color: #ffb27a; font-weight: 600; }
</style></head><body><div class="bg"></div><div class="shade"></div>
<div class="box">
  <div class="brand">${markSvg(52)}CureShot · Hayran Üssü</div>
  <h1><span>DOG</span><span>DOG</span><span>DOG</span></h1>
  <p><b>1vDOQUZ</b> arenası, mini oyunlar, quizler, espri duvarı ve 127 kahramanlık DOG endeksi.</p>
</div></body></html>`;

const { chromium } = await import('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  await sharp(png).jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:2:0' }).toFile(PUB + 'og.jpg');
} finally {
  await browser.close();
}
console.log(`public/og.jpg  ${kb(PUB + 'og.jpg')} (${W}×${H})`);
