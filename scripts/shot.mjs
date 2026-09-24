// Yerel ekran görüntüsü aracı: node scripts/shot.mjs <url> <çıktı.png> [genişlik] [yükseklik] [bekleme-ms]
import { chromium } from 'playwright';
const [url, out, w = '1440', hh = '900', wait = '1500'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +hh }, deviceScaleFactor: 1 });
// Paralel düzenlemelerde Vite HMR sayfayı çekim ortasında yenilemesin
await page.routeWebSocket(/.*/, () => {});
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out, fullPage: process.env.FULL === '1' });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
console.log(JSON.stringify({ errors, horizontalOverflow: overflow }));
await browser.close();
