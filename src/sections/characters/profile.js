// Yayıncı Profili — hayran yorumu oyuncu kartı + Maraton Saati.
// Yalnızca kullanıcının verdiği bilgiler: Kick'te Dota 2 yayını, "DOG DOG DOG" memesi, 1vDOQUZ esprisi,
// en kısa yayının bile 24 saat sürmesi. Buradaki her "stat" hayran şakasıdır.
import { h, clear, fmtClock, prefersReducedMotion, seeded, hashStr } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { artUrl } from '../../core/assets.js';
import { pressDog } from '../../core/shell.js';
import { s } from './util.js';

const KICK_URL = 'https://kick.com/cureshotkick';
const DISCLAIMER = 'Hayran yorumu · mizah amaçlıdır · gerçek istatistik değildir';

const STATS = [
  { name: 'DOG Radarı', value: '100/100', pct: 100, kind: 'ember', note: 'Kötü oynayan kimse radara girer: takım arkadaşı, rakip, fark etmez.' },
  { name: '1vDOQUZ Kapasitesi', value: '9/9', pct: 100, kind: 'gold', segments: 9, note: '4 takım arkadaşı + 5 rakip = dokuz. Hepsi aynı anda taşınır.' },
  { name: 'Maraton Dayanıklılığı', value: '∞', pct: 100, kind: 'jade', infinite: true, note: 'En kısa yayın bile 24 saat. Üst sınırı ölçmeye cesaret edemedik.' },
  { name: 'Sabır', value: 'ERR', pct: 72, kind: 'glitch', note: '24. saatte ölçüm cihazı pes etti.' },
  { name: 'Chat Enerjisi', value: 'MAX', pct: 100, kind: 'arcane', pulse: true, note: 'Birim: DOG/dakika. Ölçüm yöntemi: hayran tahmini.' },
];

const ABILITIES = [
  {
    key: 'P', slot: 'Pasif', name: 'DOG Radarı', icon: 'target', type: 'Pasif',
    lines: [['Menzil', 'Tüm harita'], ['Hedef', 'Kötü oynayan herkes'], ['Ayrım', 'Yapmaz']],
    desc: 'Takım arkadaşı, rakip ya da maçı trolleyen herhangi biri… Radar kimseyi kayırmaz. Kötü bir hamle algılandığı anda sinyal verir ve Q’yu hazır hale getirir.',
  },
  {
    key: 'Q', slot: 'Q', name: 'DOG DOG DOG', icon: 'paw', type: 'Hedefli · Anlık',
    lines: [['Hedef', 'Kötü oynayan / trolleyen'], ['Mana', '0'], ['Bekleme', 'Bir sonraki troll hamlesi']],
    desc: 'Üç kez üst üste teşhis koyar: DOG. DOG. DOG. Takım arkadaşına da rakibe de aynı etkiyi yapar; chat’te yankılanır.',
    cast: 'dog',
    castLabel: 'Q’yu kullan',
  },
  {
    key: 'W', slot: 'W', name: '1vDOQUZ', icon: 'bow', type: 'Kanalize',
    lines: [['Karşı taraf', '4 takım arkadaşı + 5 rakip'], ['Toplam', 'DOQUZ'], ['Süre', 'Maç bitene kadar']],
    desc: '“1v9”un yerel sürümü; “dokuz” Q ile yazılır. Dört takım arkadaşı ile beş rakibi aynı anda karşısına alır ve maçı tek başına taşımayı dener.',
    cast: '1v9',
    castLabel: 'W’yi kanalize et',
  },
  {
    key: 'E', slot: 'E', name: '24 Saat Maraton', icon: 'hourglass', type: 'Açılır-kapanır (kapanmıyor)',
    lines: [['Süre', 'En az 24 saat'], ['Bekleme', 'Bir sonraki yayın'], ['Yan etki', 'İzleyicide uykusuzluk']],
    desc: 'Yayın süresinin 24 saatin altına inmesini reddeder: en kısa yayın bile tam bir gün. Aşağıdaki Maraton Saati ile kendi dayanıklılığını ölçebilirsin.',
    cast: 'clock',
    castLabel: 'Maratonu hızlandır',
  },
  {
    key: 'R', slot: 'R', name: '…', icon: 'sparkle', type: 'Ultimate',
    lines: [['Bekleme', 'Bilinmiyor'], ['Açıklama', 'Yükleniyor…']],
    desc: 'Bu yeteneği henüz kimse görmedi. Efsaneye göre yayının 25. saatinde açılıyor; hayranlar hâlâ bekliyor. Açıklama yükleniyor… yükleniyor…',
    cast: 'ult',
    castLabel: 'R’ye bas',
  },
];

const MILESTONES = [
  { h: 3, text: 'Chat ısınıyor.' },
  { h: 6, text: 'DOG radarı tam kapasite tarıyor.' },
  { h: 9, text: 'Kahvaltı mı akşam yemeği mi, chat karar veremiyor.' },
  { h: 12, text: 'Yayın daha yeni açıldı sayılır.' },
  { h: 15, text: '1vDOQUZ modu ısınma turlarını bitirdi.' },
  { h: 18, text: 'İzleyiciler vardiya değiştiriyor.' },
  { h: 21, text: 'Son düzlük… ama bu yayında “son” diye bir şey var mı?' },
  { h: 24, text: 'Tebrikler, en kısa yayın süresini tamamladın.' },
];

// ---------------------------------------------------------------- prosedürel altın okçu arması
function crestSvg() {
  const rnd = seeded(hashStr('cureshot-crest'));
  const cx = 200;
  const cy = 236;
  const hex = (r) => Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');
  const rays = Array.from({ length: 18 }, (_, i) => {
    const a0 = (i / 18) * Math.PI * 2;
    const a1 = a0 + 0.07;
    const R = 320;
    return s('polygon', {
      class: 'ch-crest-ray',
      points: `${cx},${cy} ${(cx + Math.cos(a0) * R).toFixed(1)},${(cy + Math.sin(a0) * R).toFixed(1)} ${(cx + Math.cos(a1) * R).toFixed(1)},${(cy + Math.sin(a1) * R).toFixed(1)}`,
      opacity: (0.05 + (i % 2) * 0.05).toFixed(2),
    });
  });
  const sparks = Array.from({ length: 34 }, () => s('circle', {
    class: 'ch-crest-spark',
    cx: (rnd() * 400).toFixed(1),
    cy: (300 + rnd() * 200).toFixed(1),
    r: (0.6 + rnd() * 1.8).toFixed(2),
    opacity: (0.3 + rnd() * 0.6).toFixed(2),
  }));

  return s('svg', { class: 'ch-crest', viewBox: '0 0 400 500', role: 'img', 'aria-label': 'Altın okçu arması (hayran yapımı)' },
    s('title', null, 'Altın okçu arması'),
    s('defs', null,
      s('radialGradient', { id: 'ch-crest-bg', cx: '50%', cy: '46%', r: '70%' },
        s('stop', { offset: '0%', 'stop-color': '#2f2447' }),
        s('stop', { offset: '100%', 'stop-color': '#0b0912' }),
      ),
      s('linearGradient', { id: 'ch-crest-gold', x1: '0', y1: '0', x2: '0', y2: '1' },
        s('stop', { offset: '0%', 'stop-color': '#f6d98a' }),
        s('stop', { offset: '55%', 'stop-color': '#e9b949' }),
        s('stop', { offset: '100%', 'stop-color': '#b9822a' }),
      ),
      s('linearGradient', { id: 'ch-crest-shield', x1: '0', y1: '0', x2: '0', y2: '1' },
        s('stop', { offset: '0%', 'stop-color': '#3a2618' }),
        s('stop', { offset: '100%', 'stop-color': '#140c10' }),
      ),
      s('filter', { id: 'ch-crest-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' },
        s('feGaussianBlur', { stdDeviation: '6' }),
      ),
    ),
    s('rect', { width: '400', height: '500', fill: 'url(#ch-crest-bg)' }),
    s('g', { class: 'ch-crest-rays' }, rays),
    // kalkan
    s('polygon', { points: hex(152), fill: 'url(#ch-crest-shield)', stroke: 'url(#ch-crest-gold)', 'stroke-width': '7', 'stroke-linejoin': 'round' }),
    s('polygon', { points: hex(134), fill: 'none', stroke: '#e9b949', 'stroke-opacity': '0.35', 'stroke-width': '1.5' }),
    // taç
    s('path', { d: 'M158 92 L166 60 L183 78 L200 50 L217 78 L234 60 L242 92 Z', fill: 'url(#ch-crest-gold)', stroke: '#1c1405', 'stroke-width': '2', 'stroke-linejoin': 'round' }),
    // yay + ok (çapraz)
    s('g', { transform: `rotate(-32 ${cx} ${cy})` },
      s('circle', { cx: '334', cy: String(cy), r: '16', fill: '#ff6a2b', opacity: '0.75', filter: 'url(#ch-crest-glow)' }),
      s('path', { d: `M236 ${cy - 124} Q322 ${cy} 236 ${cy + 124}`, fill: 'none', stroke: 'url(#ch-crest-gold)', 'stroke-width': '13', 'stroke-linecap': 'round' }),
      s('path', { d: `M236 ${cy - 124} Q322 ${cy} 236 ${cy + 124}`, fill: 'none', stroke: '#1c1405', 'stroke-opacity': '0.45', 'stroke-width': '2' }),
      s('polyline', { points: `236,${cy - 124} 150,${cy} 236,${cy + 124}`, fill: 'none', stroke: '#f3eadb', 'stroke-opacity': '0.85', 'stroke-width': '2' }),
      s('rect', { x: '270', y: String(cy - 17), width: '14', height: '34', rx: '3', fill: '#1c1405', stroke: 'url(#ch-crest-gold)', 'stroke-width': '2' }),
      s('line', { x1: '132', y1: String(cy), x2: '332', y2: String(cy), stroke: 'url(#ch-crest-gold)', 'stroke-width': '5', 'stroke-linecap': 'round' }),
      s('polygon', { points: `352,${cy} 322,${cy - 14} 330,${cy} 322,${cy + 14}`, fill: '#ff9a3d', stroke: '#1c1405', 'stroke-width': '1.5' }),
      s('polygon', { points: `132,${cy} 118,${cy - 14} 150,${cy - 14} 162,${cy}`, fill: '#e0354b' }),
      s('polygon', { points: `132,${cy} 118,${cy + 14} 150,${cy + 14} 162,${cy}`, fill: '#c2410c' }),
    ),
    // şerit
    s('polygon', { points: '62,398 338,398 356,420 338,442 62,442 44,420', fill: 'url(#ch-crest-gold)', stroke: '#1c1405', 'stroke-width': '2' }),
    s('text', { x: '200', y: '432', 'text-anchor': 'middle', class: 'ch-crest-word' }, '1vDOQUZ'),
    s('text', { x: '200', y: '474', 'text-anchor': 'middle', class: 'ch-crest-sub' }, 'HAYRAN ARMASI'),
    s('g', null, sparks),
  );
}

// ---------------------------------------------------------------- statlar
function statRow(st) {
  const bar = h('span', { class: `ch-pst-track is-${st.kind}${st.infinite ? ' is-inf' : ''}${st.pulse ? ' is-pulse' : ''}` },
    h('span', { class: 'ch-pst-fill', style: { width: st.pct + '%' } }),
    st.segments ? h('span', { class: 'ch-pst-seg', style: { '--n': String(st.segments) }, 'aria-hidden': 'true' }) : null,
  );
  return h('li', { class: 'ch-pst' },
    h('div', { class: 'ch-pst-top' },
      h('span', { class: 'ch-pst-name' }, st.name),
      h('span', { class: `ch-pst-val num is-${st.kind}` }, st.value),
    ),
    bar,
    h('p', { class: 'ch-pst-note' }, st.note),
  );
}

// ---------------------------------------------------------------- maraton saati
function mountMarathon(host, env) {
  const { ctx } = env;
  const DAY = 24 * 3600;
  const C = 2 * Math.PI * 104;
  const reduce = prefersReducedMotion();
  let virt = 0; // sanal saniye
  let speed = 1;
  let last = performance.now();
  let lap = 0;
  let lastReached = 0;

  const prog = s('circle', { class: 'ch-mara-prog', cx: '130', cy: '130', r: '104', 'stroke-dasharray': C.toFixed(2), 'stroke-dashoffset': C.toFixed(2) });
  const head = s('circle', { class: 'ch-mara-head', cx: '130', cy: '26', r: '7' });
  const ticks = s('g', { class: 'ch-mara-ticks' });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const r1 = 84;
    const r2 = i % 6 === 0 ? 74 : 79;
    ticks.appendChild(s('line', {
      x1: (130 + Math.cos(a) * r1).toFixed(1), y1: (130 + Math.sin(a) * r1).toFixed(1),
      x2: (130 + Math.cos(a) * r2).toFixed(1), y2: (130 + Math.sin(a) * r2).toFixed(1),
      class: i % 6 === 0 ? 'is-major' : '',
    }));
  }
  const hourLabels = [0, 6, 12, 18].map((hh) => {
    const a = (hh / 24) * Math.PI * 2 - Math.PI / 2;
    return s('text', { class: 'ch-mara-hl', x: (130 + Math.cos(a) * 60).toFixed(1), y: (130 + Math.sin(a) * 60 + 3.5).toFixed(1), 'text-anchor': 'middle' }, String(hh));
  });
  const nodes = MILESTONES.map((m) => {
    const a = (m.h / 24) * Math.PI * 2 - Math.PI / 2;
    return s('circle', { class: 'ch-mara-node', cx: (130 + Math.cos(a) * 104).toFixed(1), cy: (130 + Math.sin(a) * 104).toFixed(1), r: '5' });
  });
  const ring = s('svg', { class: 'ch-mara-ring', viewBox: '0 0 260 260', 'aria-hidden': 'true' },
    s('circle', { class: 'ch-mara-track', cx: '130', cy: '130', r: '104' }),
    ticks, hourLabels, prog, nodes, head,
  );

  const timeEl = h('span', { class: 'num ch-mara-time' }, '00:00:00');
  const lapEl = h('span', { class: 'ch-mara-lap' }, 'Tur 1');
  const speedTag = h('span', { class: 'badge ember ch-mara-speed', hidden: true }, '×3600');
  const msgEl = h('p', { class: 'ch-mara-msg', 'aria-live': 'polite' }, 'Yayın başladı: ısınma turu.');
  const msgHour = h('span', { class: 'ch-lore-label' }, '0. saat');
  const speedBtn = h('button', { class: 'btn primary', type: 'button', 'aria-pressed': 'false', id: 'ch-mara-fast' }, icon('bolt', { size: 18 }), h('span', null, '×3600 hızlandır'));
  const resetBtn = h('button', { class: 'btn ghost', type: 'button' }, icon('refresh', { size: 18 }), 'Sıfırla');
  const items = MILESTONES.map((m) => h('li', { class: 'ch-mara-item' },
    h('span', { class: 'num ch-mara-h' }, `${m.h}. saat`),
    h('span', null, m.text),
    h('span', { class: 'ch-mara-check', 'aria-hidden': 'true' }, icon('check', { size: 14, stroke: 2.4 })),
  ));

  const root = h('section', { class: 'panel ch-mara', 'aria-labelledby': 'ch-mara-title' },
    h('div', { class: 'ch-mara-dial' },
      ring,
      h('div', { class: 'ch-mara-center' }, timeEl, h('span', { class: 'num ch-mara-of' }, '/ 24:00:00'), h('span', { class: 'row ch-mara-meta' }, lapEl, speedTag)),
    ),
    h('div', { class: 'ch-mara-info' },
      h('span', { class: 'eyebrow' }, 'Maraton Saati'),
      h('h3', { class: 'h2', id: 'ch-mara-title' }, 'Sen de bir yayın süresi dayanabilir misin?'),
      h('p', { class: 'muted small' }, 'Halka, bu sayfayı açtığın andan beri geçen süreyle dolar. 24 saat = en kısa yayın. Beklemeye sabrın yoksa hızlandır: 1 saniye = 1 saat.'),
      h('div', { class: 'ch-mara-now' }, msgHour, msgEl),
      h('div', { class: 'row' }, speedBtn, resetBtn),
      h('ol', { class: 'ch-mara-list' }, items),
    ),
  );
  host.appendChild(root);

  function update() {
    const now = performance.now();
    virt += ((now - last) / 1000) * speed;
    last = now;
    const curLap = Math.floor(virt / DAY);
    const inLap = virt - curLap * DAY;
    if (curLap > lap) {
      lap = curLap;
      lastReached = -1;
      ctx.sound.win();
      const r = ring.getBoundingClientRect();
      if (r.width) ctx.fx.confetti(r.left + r.width / 2, r.top + r.height / 2, 70);
      ctx.fx.toast('24 saat tamam! Tebrikler, en kısa yayın süresini tamamladın.', 'jade', 3600);
    }
    const p = inLap / DAY;
    prog.setAttribute('stroke-dashoffset', (C * (1 - p)).toFixed(2));
    const a = p * Math.PI * 2 - Math.PI / 2;
    head.setAttribute('cx', (130 + Math.cos(a) * 104).toFixed(1));
    head.setAttribute('cy', (130 + Math.sin(a) * 104).toFixed(1));
    timeEl.textContent = fmtClock(inLap);
    lapEl.textContent = `Tur ${lap + 1}`;
    const hrs = inLap / 3600;
    let reached = 0;
    MILESTONES.forEach((m, i) => {
      const on = hrs >= m.h;
      nodes[i].classList.toggle('on', on);
      items[i].classList.toggle('on', on);
      if (on) reached = m.h;
    });
    if (reached !== lastReached) {
      lastReached = reached;
      if (reached) ctx.sound.tick();
      const m = MILESTONES.find((x) => x.h === reached);
      msgHour.textContent = m ? `${m.h}. saat` : `${lap ? `Tur ${lap + 1} · ` : ''}0. saat`;
      msgEl.textContent = m ? m.text : lap ? 'Yeni tur başladı. İkinci “en kısa yayın” yolda.' : 'Yayın başladı: ısınma turu.';
      items.forEach((it, i) => it.classList.toggle('is-now', MILESTONES[i].h === reached));
    }
  }

  function setSpeed(fast) {
    update();
    speed = fast ? 3600 : 1;
    speedBtn.setAttribute('aria-pressed', String(fast));
    speedBtn.lastChild.textContent = fast ? 'Normal hıza dön' : '×3600 hızlandır';
    speedTag.hidden = !fast;
    root.classList.toggle('is-fast', fast);
  }
  speedBtn.addEventListener('click', () => { ctx.sound.whoosh(); setSpeed(speed === 1); });
  resetBtn.addEventListener('click', () => {
    ctx.sound.click();
    virt = 0;
    lap = 0;
    lastReached = -1;
    last = performance.now();
    update();
  });

  update();
  const timer = setInterval(update, reduce ? 1000 : 200);

  return {
    fast() {
      if (speed === 1) setSpeed(true);
      root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    },
    destroy() { clearInterval(timer); root.remove(); },
  };
}

// ---------------------------------------------------------------- sayfa
export function renderProfile(el, env) {
  const { ctx } = env;
  const art = artUrl('portrait-legend');
  let marathon = null;
  let castTimer = 0;

  const visual = art
    ? h('img', { class: 'ch-pro-img', src: art, alt: 'Altın okçu (hayran yapımı görsel)', width: '800', height: '1000', decoding: 'async' })
    : crestSvg();

  const artCol = h('div', { class: 'ch-pro-art frame' },
    h('span', { class: 'ch-pro-ribbon' }, icon('info', { size: 14 }), DISCLAIMER),
    h('div', { class: `ch-pro-visual${art ? ' is-img' : ''}` }, visual),
    h('div', { class: 'ch-pro-plate' },
      h('span', { class: 'ch-pro-plate-name' }, 'CureShotKick'),
      h('span', { class: 'ch-pro-plate-sub' }, 'Kick · Dota 2 · Maraton'),
    ),
  );

  // Yetenekler
  let selected = 0;
  const detail = h('div', { class: 'ch-abil-detail', 'aria-live': 'polite' });
  const slots = ABILITIES.map((ab, i) => {
    const b = h('button', {
      class: `ch-abil${ab.key === 'P' ? ' is-passive' : ''}${ab.key === 'R' ? ' is-ult' : ''}`,
      type: 'button',
      'aria-pressed': String(i === selected),
      'aria-label': `${ab.slot === 'Pasif' ? 'Pasif' : ab.slot + ' yeteneği'}: ${ab.name === '…' ? 'bilinmeyen ultimate' : ab.name}`,
    },
      h('span', { class: 'ch-abil-key' }, ab.slot === 'Pasif' ? 'P' : ab.slot),
      icon(ab.icon, { size: 26 }),
      h('span', { class: 'ch-abil-name' }, ab.name),
    );
    b.addEventListener('click', () => { ctx.sound.click(); select(i); });
    return b;
  });

  function cast(ab, btn) {
    if (ab.cast === 'dog') {
      pressDog(btn);
      ctx.fx.stamp('DOG DOG DOG');
    } else if (ab.cast === '1v9') {
      ctx.sound.charge(0.9);
      ctx.fx.stamp('1vDOQUZ', { variant: 'gold' });
    } else if (ab.cast === 'clock') {
      if (marathon) marathon.fast();
    } else if (ab.cast === 'ult') {
      ctx.sound.bad();
      ctx.fx.shake(btn);
      ctx.fx.toast('Yetenek bekleme süresinde. Kalan süre: bilinmiyor. Açıklama hâlâ yükleniyor…', 'blood');
    }
    btn.classList.remove('is-cast');
    void btn.offsetWidth;
    btn.classList.add('is-cast');
    clearTimeout(castTimer);
    castTimer = setTimeout(() => btn.classList.remove('is-cast'), 800);
  }

  function select(i) {
    selected = i;
    slots.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    const ab = ABILITIES[i];
    clear(detail);
    const castBtn = ab.cast
      ? h('button', { class: `btn sm ${ab.cast === 'ult' ? 'ghost' : 'primary'}`, type: 'button' }, icon(ab.icon, { size: 16 }), ab.castLabel)
      : null;
    if (castBtn) castBtn.addEventListener('click', () => cast(ab, castBtn));
    detail.append(
      h('div', { class: 'ch-abil-dhead' },
        h('span', { class: 'kbd' }, ab.slot === 'Pasif' ? 'P' : ab.slot),
        h('h4', { class: `ch-abil-dname${ab.name === '…' ? ' is-dots' : ''}` }, ab.name),
        h('span', { class: 'ch-lore-label' }, ab.type),
      ),
      h('p', { class: 'ch-abil-desc' }, ab.desc),
      h('dl', { class: 'ch-abil-lines' }, ab.lines.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))),
    );
    if (castBtn) detail.append(castBtn);
  }
  select(0);

  const main = h('div', { class: 'ch-pro-main' },
    h('span', { class: 'eyebrow' }, 'Hayran oyuncu kartı'),
    h('h2', { class: 'h1 ch-pro-name' }, 'CureShotKick'),
    h('div', { class: 'row ch-pro-tags' },
      h('span', { class: 'badge ch-kick-badge' }, icon('kick', { size: 12 }), 'Kick yayıncısı'),
      h('span', { class: 'badge ember' }, 'Dota 2'),
      h('span', { class: 'badge gold' }, 'Maraton yayınları'),
    ),
    h('p', { class: 'ch-pro-disc' }, icon('info', { size: 16 }), h('span', null, h('strong', null, DISCLAIMER + '. '), 'Bu kart hayranların sevgiyle hazırladığı bir şakadır; aşağıdaki “statlar” ölçülmedi, uyduruldu.')),
    h('div', { class: 'ch-pro-block' },
      h('h3', { class: 'ch-lore-label' }, 'Statlar'),
      h('ul', { class: 'ch-pro-stats' }, STATS.map(statRow)),
    ),
    h('div', { class: 'ch-pro-block' },
      h('h3', { class: 'ch-lore-label' }, 'Yetenekler'),
      h('div', { class: 'ch-abil-row', role: 'group', 'aria-label': 'Yetenekler' }, slots),
      detail,
    ),
    h('div', { class: 'row ch-pro-cta' },
      h('a', { class: 'btn primary lg ch-kick-btn', href: KICK_URL, target: '_blank', rel: 'noopener noreferrer' }, icon('kick', { size: 18 }), 'Kick’te izle'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => ctx.go('oyunlar', 'arena') }, icon('bow', { size: 18 }), '1vDOQUZ Arenası'),
    ),
  );

  const card = h('section', { class: 'ch-pro', 'aria-label': 'CureShotKick hayran oyuncu kartı' }, artCol, main);
  const maraHost = h('div', { class: 'ch-mara-host' });
  el.append(card, maraHost);
  marathon = mountMarathon(maraHost, env);

  return () => {
    clearTimeout(castTimer);
    if (marathon) marathon.destroy();
    marathon = null;
  };
}
