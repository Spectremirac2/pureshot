// DOG Çarkı: 10 rastgele kahramanlık canvas çark. Döner, durur, kararı damgayla ilan eder.
// "Bu kahramanla oynarsan DOG olma ihtimalin: %X" (topluluk endeksi + takma adına göre küçük kişisel sapma).

import { h, clear, shuffle, clamp, hashStr, prefersReducedMotion, rand } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { HEROES, ATTRS, tierOf } from '../../data/heroes.js';
import { crestSvg, mixHex, fontsReady } from './crest.js';

const SLICES = 10;
const VERDICT = {
  S: { stamp: 'DOG DOG DOG', variant: '', line: 'Pick ekranında bu kahramana basarsan takım sohbeti senin için çoktan “report” yazıyor.' },
  A: { stamp: 'DOG DOG', variant: '', line: 'Ağır DOG bölgesi. Seçebilirsin ama önce takımdan özür dile, sonra ward al.' },
  B: { stamp: 'YARI DOG', variant: 'gold', line: 'Yazı tura. Bu maçın DOG’u sen de olabilirsin, rakip de.' },
  C: { stamp: 'ŞÜPHELİ', variant: 'jade', line: 'Topluluk kaşını kaldırıyor ama sesini çıkarmıyor. Rahat oyna.' },
  D: { stamp: '1vDOQUZ', variant: 'gold', line: 'Masum bir seçim. Bu kahramanla dokuz DOG’u sırtında taşıyabilirsin.' },
};

export function mountCark(host, env) {
  const { ctx, comm } = env;
  const reduced = prefersReducedMotion();
  const cleanups = [];
  let heroes = shuffle(HEROES).slice(0, SLICES);
  let rot = 0; // radyan; dilim i merkezi tepede ⇔ rot + i*step ≡ 0
  let spinning = false;
  let raf = 0;
  let lastTickSlice = null;
  let lastTickAt = 0;
  const step = (Math.PI * 2) / SLICES;

  const canvas = h('canvas', { class: 'hr-cark-canvas', role: 'img', 'aria-label': 'DOG Çarkı' });
  const g = canvas.getContext('2d');
  const wheelWrap = h('div', { class: 'hr-cark-wheel' }, canvas, h('span', { class: 'hr-cark-pin', 'aria-hidden': 'true' }));
  const spinBtn = h('button', { class: 'btn primary lg hr-cark-spin', type: 'button' }, icon('dice', { size: 20 }), 'Çarkı çevir');
  const shuffleBtn = h('button', { class: 'btn ghost', type: 'button' }, icon('refresh', { size: 18 }), 'Yeni kahramanlar');
  const legend = h('ol', { class: 'hr-cark-legend' });
  const result = h('div', { class: 'hr-cark-result panel raised frame', 'aria-live': 'polite' });

  function renderLegend() {
    clear(legend).append(...heroes.map((hero) => h('li', { class: `hr-a-${hero.attr}` }, h('span', { class: 'hr-dot' }), hero.name)));
    canvas.setAttribute('aria-label', `DOG Çarkı: ${heroes.map((x) => x.name).join(', ')}`);
  }

  function idle() {
    clear(result).append(
      h('span', { class: 'eyebrow' }, 'Kaderin çarkta'),
      h('p', { class: 'h3' }, 'Çevir, kahramanını al, DOG olma ihtimalini öğren.'),
      h('p', { class: 'small muted' }, 'Hesap: kahramanın Topluluk DOG Endeksi, üstüne takma adına göre küçük bir kişisel sapma. Bilimsel değil, bol DOG’lu.'),
    );
  }

  // ---------------------------------------------------------------- çizim
  let size = 400;
  function resize() {
    const w = Math.min(wheelWrap.getBoundingClientRect().width || 400, 480);
    size = Math.max(220, Math.round(w));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    const s = size;
    const cx = s / 2, cy = s / 2, R = s / 2 - 6;
    g.clearRect(0, 0, s, s);
    // dış halka
    g.beginPath();
    g.arc(cx, cy, R + 4, 0, Math.PI * 2);
    g.fillStyle = '#e9b949';
    g.fill();
    for (let i = 0; i < SLICES; i++) {
      const hero = heroes[i];
      const col = ATTRS[hero.attr].color;
      const mid = rot + i * step - Math.PI / 2;
      const a0 = mid - step / 2, a1 = mid + step / 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, R, a0, a1);
      g.closePath();
      const grad = g.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
      grad.addColorStop(0, mixHex(col, '#0d0b14', 0.78));
      grad.addColorStop(1, mixHex(col, '#0d0b14', i % 2 ? 0.35 : 0.5));
      g.fillStyle = grad;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(233,185,73,0.75)';
      g.stroke();
      // yazı
      g.save();
      g.translate(cx, cy);
      g.rotate(mid);
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      const name = hero.name.toUpperCase();
      const room = R * 0.6;
      let fs = s * 0.034;
      g.font = `800 ${fs.toFixed(1)}px Unbounded, "Arial Black", sans-serif`;
      const wText = g.measureText(name).width;
      if (wText > room) {
        fs = Math.max(s * 0.022, fs * (room / wText));
        g.font = `800 ${fs.toFixed(1)}px Unbounded, "Arial Black", sans-serif`;
      }
      g.fillStyle = '#fff3dc';
      g.shadowColor = 'rgba(0,0,0,0.7)';
      g.shadowBlur = 4;
      g.fillText(name, R - 12, 0, room);
      g.shadowBlur = 0;
      g.font = `700 ${Math.round(s * 0.026)}px "JetBrains Mono", monospace`;
      g.fillStyle = '#ffb27a';
      g.textAlign = 'left';
      g.fillText(`%${comm.get(hero.id).liveRound}`, R * 0.235, 0);
      g.restore();
    }
    // göbek
    g.beginPath();
    g.arc(cx, cy, R * 0.16, 0, Math.PI * 2);
    const hub = g.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, R * 0.16);
    hub.addColorStop(0, '#ff9a3d');
    hub.addColorStop(1, '#c2410c');
    g.fillStyle = hub;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#e9b949';
    g.stroke();
    g.font = `900 ${Math.round(s * 0.042)}px Unbounded, "Arial Black", sans-serif`;
    g.fillStyle = '#1a0d05';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('DOG', cx, cy + 1);
  }

  // ---------------------------------------------------------------- çevirme
  function spin() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    shuffleBtn.disabled = true;
    ctx.sound.whoosh();
    const target = Math.floor(Math.random() * SLICES);
    const TAU = Math.PI * 2;
    const base = rot - (((rot % TAU) + TAU) % TAU);
    const end = base + TAU * (5 + Math.floor(rand(0, 2))) - target * step + rand(-0.32, 0.32) * step;
    clear(result).append(h('span', { class: 'eyebrow' }, 'Çark dönüyor…'), h('p', { class: 'h3' }, 'Kader creep dalgası gibi geliyor.'));
    if (reduced) {
      rot = end;
      draw();
      finish(target);
      return;
    }
    const from = rot;
    const dur = 4600;
    const t0 = performance.now();
    const frame = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      rot = from + (end - from) * e;
      draw();
      const cur = Math.round(-rot / step);
      if (cur !== lastTickSlice) {
        lastTickSlice = cur;
        if (now - lastTickAt > 45) { ctx.sound.tick(); lastTickAt = now; }
      }
      if (k < 1) raf = requestAnimationFrame(frame);
      else { raf = 0; finish(target); }
    };
    raf = requestAnimationFrame(frame);
  }

  function finish(i) {
    spinning = false;
    spinBtn.disabled = false;
    shuffleBtn.disabled = false;
    const hero = heroes[i];
    const s = comm.get(hero.id);
    const nick = (ctx.store.me.get().nick || 'anon');
    const jitter = (hashStr(nick + ':' + hero.id) % 13) - 6;
    const x = clamp(Math.round(s.live + jitter), 1, 99);
    const t = tierOf(x);
    const v = VERDICT[t.id];
    clear(result).append(
      h('div', { class: 'hr-cark-hero' },
        crestSvg(hero, { value: x, cls: 'hr-crest-md' }),
        h('div', null,
          h('span', { class: 'eyebrow' }, 'Çarkın kararı'),
          h('p', { class: 'h2 hr-cark-name' }, hero.name),
        ),
      ),
      h('p', { class: 'hr-cark-odds' }, 'Bu kahramanla oynarsan DOG olma ihtimalin: ', h('strong', { class: `mono hr-tc-${t.id}` }, `%${x}`)),
      h('p', { class: `hr-cark-verdict hr-tc-${t.id}` }, `${t.id} · ${t.label}`),
      h('p', { class: 'small muted' }, v.line),
      h('p', { class: 'xsmall dim' }, `Topluluk endeksi %${s.liveRound} · kişisel sapma ${jitter >= 0 ? '+' : ''}${jitter}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn gold sm', type: 'button', onclick: () => env.openHero(hero.id) }, icon('eye', { size: 16 }), 'Dosyasını aç'),
      ),
    );
    ctx.fx.stamp(v.stamp, { variant: v.variant });
    if (t.id === 'S' || t.id === 'A') ctx.sound.dogdogdog();
    else if (t.id === 'D') ctx.sound.win();
    else ctx.sound.good();
  }

  spinBtn.addEventListener('click', spin);
  shuffleBtn.addEventListener('click', () => {
    if (spinning) return;
    heroes = shuffle(HEROES).slice(0, SLICES);
    ctx.sound.click();
    renderLegend();
    idle();
    draw();
  });

  host.append(
    h('section', { class: 'hr-cark', 'aria-label': 'DOG Çarkı' },
      h('div', { class: 'section-head hr-sub-head' },
        h('span', { class: 'eyebrow' }, 'Pick ekranı kararsızlığına son'),
        h('h2', { class: 'h2' }, 'DOG Çarkı'),
        h('p', { class: 'small muted' }, 'Kararsız kaldın mı? Çark senin yerine seçsin; sonucu da topluluk yorumlasın.'),
      ),
      h('div', { class: 'hr-cark-grid' },
        wheelWrap,
        h('div', { class: 'stack hr-cark-side' },
          h('div', { class: 'row hr-cark-actions' }, spinBtn, shuffleBtn),
          result,
          h('div', { class: 'hr-cark-legend-wrap' }, h('p', { class: 'eyebrow' }, 'Çarktaki kahramanlar'), legend),
        ),
      ),
    ),
  );

  renderLegend();
  idle();
  const ro = new ResizeObserver(() => resize());
  ro.observe(wheelWrap);
  resize();
  fontsReady().then(() => { if (canvas.isConnected) draw(); });
  let pending = 0;
  cleanups.push(comm.subscribe(() => {
    if (spinning) return;
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(draw);
  }));
  cleanups.push(() => { ro.disconnect(); cancelAnimationFrame(raf); cancelAnimationFrame(pending); });

  return {
    destroy() {
      for (const c of cleanups) { try { c(); } catch (e) { console.error(e); } }
      clear(host);
    },
  };
}
