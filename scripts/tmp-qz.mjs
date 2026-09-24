// GEÇİCİ: Quizler bölümü uçtan uca testi (qz ajanı). İş bitince silinecek.
import { chromium } from 'playwright';

const OUT = process.argv[2] || '/tmp';
const W = +(process.argv[3] || 1440);
const H = +(process.argv[4] || 900);
const only = process.argv[5] || 'all';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: W < 500 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);
const tag = W < 500 ? 'm' : 'd';

await page.goto('http://localhost:5173/#quizler', { waitUntil: 'load' });
await wait(1500);

async function overflow() {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

// ------------------------------------------------ Hangi DOG'sun
if (only === 'all' || only === 'hangidog') {
  await page.click('a.qz-card[href="#quizler--hangidog"]');
  await wait(500);
  log('hash after card click:', await page.evaluate(() => location.hash));
  for (let i = 0; i < 10; i++) {
    const q = await page.textContent('.qz-q');
    if (i === 3) {
      // geri dön testi
      await page.click('.qz-nav .btn');
      await wait(450);
      log('  back ->', await page.textContent('.qz-q'));
      await page.keyboard.press('2');
      await wait(600);
    }
    // legend'e yönelik: iyi oynayan seçenekleri bul (metin tabanlı) yoksa rastgele
    const opts = await page.$$('.qz-opt');
    const k = i % 2 === 0 ? 2 : 1;
    if (W < 500) await opts[k].tap(); else if (i % 3 === 0) await page.keyboard.press(String(k + 1)); else await opts[k].click();
    await wait(560);
    log(`  q${i + 1}: ${q}`);
  }
  await wait(1200);
  const name = await page.textContent('.qz-res-name');
  log('hangidog result:', name, 'overflow', await overflow());
  const src = await page.getAttribute('.qz-res-img', 'data-generated');
  log('  portrait:', src);
  await page.screenshot({ path: `${OUT}/hangidog-res-${tag}.png` });
  await page.screenshot({ path: `${OUT}/hangidog-res-${tag}-full.png`, fullPage: true });
  const pick = await page.evaluate(() => JSON.parse(localStorage.getItem('csk:me')).picks.hangidog);
  log('  stored pick:', pick);
  // Tekrar çöz
  await page.click('.qz-again');
  await wait(400);
  log('  after retry q:', await page.textContent('.qz-q'));
  // Quizler butonu
  await page.click('.qz-back');
  await wait(400);
  log('  back to hub hash:', await page.evaluate(() => location.hash));
}

// ------------------------------------------------ Bilgi
if (only === 'all' || only === 'bilgi') {
  await page.goto('http://localhost:5173/#quizler--bilgi', { waitUntil: 'load' });
  await wait(1200);
  await page.screenshot({ path: `${OUT}/bilgi-intro-${tag}.png` });
  await page.click('.qz-start');
  await wait(600);
  for (let i = 0; i < 10; i++) {
    if (i === 0) {
      await wait(1500);
      await page.screenshot({ path: `${OUT}/bilgi-q-${tag}.png` });
    }
    if (i === 4) {
      // süre dolsun
      log('  waiting for timeout…');
      await page.waitForSelector('.qz-reveal:not([hidden])', { timeout: 26000 });
      log('  timeout reveal:', (await page.textContent('.qz-reveal-head')).trim());
    } else {
      await page.keyboard.press(String((i % 4) + 1));
    }
    await wait(350);
    if (i === 1) await page.screenshot({ path: `${OUT}/bilgi-reveal-${tag}.png` });
    await page.keyboard.press('Enter');
    await wait(450);
  }
  await wait(1600);
  log('bilgi result:', (await page.textContent('.qz-big')).trim(), (await page.textContent('.qz-tier')).trim(), 'overflow', await overflow());
  await page.screenshot({ path: `${OUT}/bilgi-res-${tag}.png` });
  log('  score stored:', await page.evaluate(() => JSON.parse(localStorage.getItem('csk:me')).scores.bilgi));
  // yarıda bırakıp bölüm değiştir (zamanlayıcı temizliği)
  await page.click('.qz-scorecard .btn.primary');
  await wait(800);
  await page.evaluate(() => { location.hash = '#espriler'; });
  await wait(2500);
  log('  left mid-quiz, timer nodes:', await page.evaluate(() => document.querySelectorAll('.qz-timer').length));
}

// ------------------------------------------------ DOG mu
if (only === 'all' || only === 'dogmu') {
  await page.goto('http://localhost:5173/#quizler--dogmu', { waitUntil: 'load' });
  await wait(1200);
  await page.screenshot({ path: `${OUT}/dogmu-card-${tag}.png` });
  for (let i = 0; i < 10; i++) {
    if (i === 0 || i === 5) {
      // kaydırma
      const box = await page.boundingBox('.qz-dm-card');
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const dir = i === 0 ? -1 : 1;
      if (W < 500) {
        // dokunma ile kaydırma: pointer olaylarını CDP üzerinden sür
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
        for (let s = 1; s <= 10; s++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + dir * s * 18, y: cy + s }] });
          await wait(16);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        for (let s = 1; s <= 10; s++) { await page.mouse.move(cx + dir * s * 18, cy + s); await wait(16); }
        await page.mouse.up();
      }
      await wait(500);
      const v = await page.$('.qz-dm-verdict');
      log(`  swipe ${dir < 0 ? 'left(DOG)' : 'right(NOT)'} ->`, v ? 'verdict shown' : 'NO VERDICT');
      if (!v) { await page.keyboard.press('ArrowLeft'); await wait(500); }
    } else if (i % 3 === 0) {
      await page.click('.qz-dm-btn.not');
      await wait(450);
    } else {
      await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight');
      await wait(450);
    }
    if (i === 1) await page.screenshot({ path: `${OUT}/dogmu-verdict-${tag}.png` });
    await page.keyboard.press('Enter');
    await wait(450);
  }
  await wait(1200);
  log('dogmu result:', (await page.textContent('.qz-dm-result .qz-big')).trim(), (await page.textContent('.qz-tier')).trim(), 'overflow', await overflow());
  await page.screenshot({ path: `${OUT}/dogmu-res-${tag}.png` });
  const votes = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('csk:me')).picks).filter((k) => k.startsWith('dm:')).length);
  log('  votes stored:', votes);
}

// ------------------------------------------------ Hayran
if (only === 'all' || only === 'hayran') {
  await page.goto('http://localhost:5173/#quizler--hayran', { waitUntil: 'load' });
  await wait(1200);
  for (let i = 0; i < 12; i++) {
    if (W < 500) {
      const opts = await page.$$('.qz-opt');
      await opts[i % 4].tap();
      await wait(350);
      if (i === 0) await page.screenshot({ path: `${OUT}/hayran-reveal-${tag}.png` });
      await page.tap('.qz-next');
    } else {
      await page.keyboard.press(String((i % 4) + 1));
      await wait(300);
      if (i === 0) await page.screenshot({ path: `${OUT}/hayran-reveal-${tag}.png` });
      await page.keyboard.press('Enter');
    }
    await wait(400);
  }
  await wait(1200);
  log('hayran result:', (await page.textContent('.qz-hayran-card .qz-big')).trim(), (await page.textContent('.qz-tier')).trim(), 'overflow', await overflow());
  await page.screenshot({ path: `${OUT}/hayran-res-${tag}.png` });
}

// ------------------------------------------------ Merkez (sonuçlarla)
await page.goto('http://localhost:5173/#quizler', { waitUntil: 'load' });
await wait(1500);
log('hub last results:', await page.$$eval('.qz-card-last', (els) => els.map((e) => e.textContent.trim())));
await page.screenshot({ path: `${OUT}/hub-after-${tag}.png` });
log('overflow', await overflow());
log('ERRORS', JSON.stringify(errors));
await browser.close();
