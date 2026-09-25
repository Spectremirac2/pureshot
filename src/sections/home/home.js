// Ana sayfa (#ana): sitenin tezi. Kahraman alanı + "1 vs 9" 3D diorama, canlı skor şeridi,
// meme sözlüğü, yetenek çubuğu portalları, günün esprisi, DOG Arşivi vitrini ve ziyaretçi defteri.

import './home.css';
import { h, clear, fmtNum, hashStr, seeded, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { ROUTES } from '../../core/routes.js';
import { store, agg } from '../../core/store.js';
import { pressDog } from '../../core/shell.js';
import { artUrl } from '../../core/assets.js';
import { ARCHETYPES } from '../../data/archetypes.js';
import * as jokeData from '../../data/jokes.js';
import { mountComments } from '../../components/comments.js';
import { portraitEl } from '../../components/portrait.js';
import { attachTilt } from '../../components/tilt.js';
import { SALON_GAMES, BADGES, earnedSet, badgeProgress, badgeHref, ensureBadgeWatcher } from '../../core/badges.js';
import { subscribeQuests, questStatus, msToReset, questStreak, fanXp, fanLevel, QUEST_XP } from '../../core/quests.js';

// Rozet bildirimleri: tekil küresel izleyici (Oyun Salonu da aynı çağrıyı yapar; ikincisi etkisiz)
ensureBadgeWatcher();

const KICK_URL = 'https://kick.com/cureshotkick';
let roLikeNoted = false;

// Espri arşivi boşken kullanılan küçük hayran yapımı yedek liste.
const FALLBACK_JOKES = [
  { id: 'hm-1', cat: 'kurye', text: 'Kurye kayboldu. Arama kurtarma ekibi yollandı, onlar da feed’ledi. Teşhis net: DOG DOG DOG.' },
  { id: 'hm-2', cat: 'destek', text: 'Support’a “ward al” dedik, Midas’la döndü. Harita hâlâ karanlık, Midas ise pırıl pırıl.' },
  { id: 'hm-3', cat: 'maraton', text: 'Normal insan için 24 saat bir gün eder. Bu yayında ise ısınma turu.' },
  { id: 'hm-4', cat: '1vdoquz', text: '1vDOQUZ aslında 1v10’dur. Kuryeyi hiç saymadık.' },
  { id: 'hm-5', cat: 'mid', text: '“Mid or feed” dedi. Sözünü tuttu: ikisini birden yaptı.' },
  { id: 'hm-6', cat: 'roshan', text: 'Aegis’i 9. dakikada aldı, 10. dakikada çeşmede bekliyordu. Aegis bile şaşırdı.' },
];

// Portal açıklamaları (bölüm kimliğine göre)
const PORTAL_TEXT = {
  espriler: 'Hayran yapımı DOG esprileri: oku, DOG’la, kendininkini duvara as.',
  oyunlar: 'Kısa, hızlı ve bolca tilt ettiren tarayıcı oyunları. Skor tablosu dahil.',
  quizler: 'Hangi DOG’sun? Dota bilgin kaç MMR? Birkaç soruda öğren.',
  arena: 'Dört takım arkadaşı ve beş rakip: dokuz DOG sana doğru geliyor. Elinde tek bir yay var.',
  karakterler: 'DOG Arşivi: pub maçlarının yaban hayatı için saha rehberi ve analizler.',
  'soru-cevap': 'Topluluğa sor, cevapla, en iyi cevabı işaretle. Build tartışması serbest.',
  galeri: 'fal.ai ile üretilmiş görseller ve döndürüp inceleyebileceğin 3D DOG müzesi.',
  kahramanlar: 'Dota kahramanlarının hayran yapımı DOG endeksi: pick’ten önce bir bak, sonra “ben demiştim” de.',
};

export default {
  mount(el, ctx) {
    const reduced = prefersReducedMotion();
    const cleanups = [];
    const root = h('div', { class: 'hm' });

    const hero = buildHero(ctx, cleanups, reduced);
    const body = h('div', { class: 'wrap hm-body' },
      buildLive(cleanups, reduced),
      buildDictionary(),
      buildPortals(ctx, cleanups),
      buildSalon(ctx, cleanups),
      buildJoke(ctx, cleanups),
      buildArchive(ctx),
      buildGuestbook(cleanups),
    );
    root.append(hero.el, body);
    el.appendChild(root);
    hero.start();

    return () => {
      for (const fn of cleanups) {
        try { fn(); } catch (e) { console.error(e); }
      }
      root.remove();
    };
  },
};

// ====================================================================== Kahraman alanı
function buildHero(ctx, cleanups, reduced) {
  const keyart = artUrl('hero-keyart');
  const stage = h('div', { class: 'hm-stage', 'aria-hidden': 'true' });
  const lines = ['DOG', 'DOG', 'DOG'].map((t, i) => h('span', { class: `hm-line hm-l${i + 1}`, style: { '--i': i }, 'aria-hidden': 'true' },
    h('span', { class: 'hm-ghost' }, t),
    h('span', { class: `stamp${i === 1 ? ' gold' : ''}` }, t),
  ));
  const title = h('h1', { class: 'display hm-title' }, h('span', { class: 'sr-only' }, 'DOG DOG DOG'), lines);

  let scene = null;
  let destroyed = false;

  const dogBtn = h('button', { class: 'btn primary lg hm-dogbtn', type: 'button' }, icon('paw', { size: 22, stroke: 2 }), 'DOG’la!');
  dogBtn.addEventListener('click', () => {
    pressDog(dogBtn);
    ctx.fx.stamp('DOG DOG DOG');
    if (scene) scene.react();
    if (!reduced) {
      title.classList.remove('is-hit');
      void title.offsetWidth;
      title.classList.add('is-hit');
    }
  });
  const arenaBtn = h('button', { class: 'btn ghost lg hm-arenabtn', type: 'button' },
    icon('bow', { size: 20 }), h('span', null, h('span', { class: 'meme' }, '1vDOQUZ'), ' Arenasına Gir'), h('span', { class: 'kbd', 'aria-hidden': 'true' }, 'R'));
  arenaBtn.addEventListener('click', () => { ctx.sound.click(); ctx.go('oyunlar', 'arena'); });

  const copy = h('div', { class: 'hm-copy' },
    h('p', { class: 'eyebrow hm-eyebrow' }, h('span', { class: 'hm-eyebrow-dot', 'aria-hidden': 'true' }), h('span', null, h('span', { lang: 'en' }, 'CureShotKick'), ' hayran üssü · Dota 2')),
    title,
    h('p', { class: 'lead hm-lead' },
      'En kısa yayını ', h('strong', null, '24 saat'), ' süren adamın hayran üssü. Takım feed’liyorsa, rakip trollüyorsa, kurye kaybolduysa: tek kelime yeter.'),
    h('div', { class: 'hm-cta' }, dogBtn, arenaBtn),
    h('a', { class: 'hm-kick', href: KICK_URL, target: '_blank', rel: 'noopener noreferrer' },
      h('span', { class: 'hm-kick-ico', 'aria-hidden': 'true' }, icon('kick', { size: 14, stroke: 2 })),
      'Kick’te izle', h('span', { class: 'hm-kick-url' }, 'kick.com/cureshotkick'), icon('arrowRight', { size: 14 })),
  );

  const capSub = h('span', { class: 'hm-cap-sub' }, 'Canlı diorama · DOG’lara tıkla');
  const caption = h('div', { class: 'hm-caption', 'aria-hidden': 'true' },
    h('span', { class: 'hm-cap-row' }, h('b', { class: 'hm-cap-one' }, '1'), h('i', null, 'vs'), h('b', { class: 'hm-cap-nine' }, '9')),
    capSub,
  );

  const el = h('section', { class: 'hm-hero', 'aria-label': 'Karşılama' },
    h('div', { class: 'hm-sky', 'aria-hidden': 'true' }),
    keyart ? h('img', { class: 'hm-art', src: keyart, alt: '', 'aria-hidden': 'true', decoding: 'async' }) : null,
    stage,
    h('div', { class: 'hm-scrim', 'aria-hidden': 'true' }),
    h('div', { class: 'wrap hm-hero-inner' }, copy),
    caption,
  );

  // Dioramanın sığacağı alan: masaüstünde metnin sağı, mobilde metnin altı.
  function getFocus(w, hh) {
    const hr = el.getBoundingClientRect();
    const cr = copy.getBoundingClientRect();
    let f;
    if (w >= 900) {
      const x0 = Math.min(w * 0.55, cr.right - hr.left - 24);
      const x1 = w - Math.max(16, (w - 1240) / 2);
      const y0 = 24;
      const y1 = hh - 64;
      f = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
    } else {
      const y0 = Math.min(cr.bottom - hr.top + 4, hh - 240);
      const y1 = hh - 64;
      f = { x: w / 2, y: (y0 + y1) / 2, w: w - 8, h: Math.max(200, y1 - y0) };
    }
    el.style.setProperty('--fx', `${((f.x / w) * 100).toFixed(1)}%`);
    el.style.setProperty('--fy', `${((f.y / hh) * 100).toFixed(1)}%`);
    return f;
  }

  function showFallback() {
    clear(stage);
    stage.appendChild(fallbackDiorama());
    getFocus(stage.clientWidth || 1, stage.clientHeight || 1);
    capSub.textContent = '1 kahraman · 9 DOG';
    el.classList.remove('hm-hero--3d');
    el.classList.add('hm-hero--flat');
  }

  function start() {
    import('./hero3d.js')
      .then((m) => {
        if (destroyed) return;
        scene = m.createHero3D(stage, {
          getFocus,
          reduced,
          pointerEl: el,
          onLost: () => {
            const s = scene;
            scene = null;
            try { if (s) s.destroy(); } catch { /* bağlam zaten kayıp */ }
            showFallback();
          },
          onPoke: (arch, x, y) => {
            ctx.sound.bark(0.9 + Math.random() * 0.4);
            ctx.fx.floatText(arch.name.toLocaleUpperCase('tr-TR'), x, y - 20, { size: 15, color: arch.color });
          },
        });
        if (!scene) showFallback();
        else el.classList.add('hm-hero--3d');
      })
      .catch((e) => {
        console.warn('3D sahne yüklenemedi', e);
        if (!destroyed) showFallback();
      });
  }

  cleanups.push(() => {
    destroyed = true;
    if (scene) scene.destroy();
    scene = null;
  });

  return { el, start };
}

/** WebGL yoksa: SVG diorama (altıgen ada, nehir, iki kristal, kahraman, 9 zıplayan DOG). */
function fallbackDiorama() {
  const cx = 300;
  const cy = 215;
  const pt = (k, dy = 0) => {
    const a = ((90 + 60 * k) * Math.PI) / 180;
    return `${(cx + Math.cos(a) * 210).toFixed(1)},${(cy + Math.sin(a) * 80 + dy).toFixed(1)}`;
  };
  const top = [0, 1, 2, 3, 4, 5].map((k) => pt(k)).join(' ');
  const side = [pt(1), pt(0), pt(5), pt(5, 24), pt(0, 24), pt(1, 24)].join(' ');
  const dogs = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const x = cx + Math.cos(a) * 128;
    const y = cy + Math.sin(a) * 48;
    dogs.push(`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><ellipse class="hm-fb-shadow" cx="0" cy="12" rx="15" ry="4.5"/>
      <g class="hm-fb-dog" style="animation-delay:${(i * 0.11).toFixed(2)}s"><path class="hm-fb-body" d="M-13 5c0-9 6-13 13-13s13 4 13 13c0 5-4 7-13 7s-13-2-13-7z"/>
      <path class="hm-fb-ear" d="M-11-4l-6-9 9 3zM11-4l6-9-9 3z"/>
      <circle class="hm-fb-eye" cx="-4.5" cy="0" r="2.2"/><circle class="hm-fb-eye" cx="4.5" cy="0" r="2.2"/></g></g>`);
  }
  const svg = `<svg class="hm-fb" viewBox="0 0 600 430" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <path class="hm-fb-rock" d="M118 279 L300 319 L482 279 L452 318 L400 352 L352 404 L300 426 L262 392 L208 356 L150 318 Z"/>
    <polygon class="hm-fb-side" points="${side}"/>
    <polygon class="hm-fb-top" points="${top}"/>
    <path class="hm-fb-river" d="M209 155 C 250 190, 280 205, 300 215 S 360 250, 391 275"/>
    <ellipse class="hm-fb-aura" cx="${cx}" cy="${cy}" rx="44" ry="17"/>
    <polygon class="hm-fb-crystal jade" points="165,188 182,236 165,250 148,236"/>
    <polygon class="hm-fb-crystal ember" points="432,122 450,166 434,184 416,166"/>
    <polygon class="hm-fb-crystal ember" points="452,148 462,172 452,182 443,172"/>
    <g class="hm-fb-hero"><path d="M300 170 l13 36 -13 12 -13 -12z"/><circle cx="300" cy="165" r="9"/></g>
    ${dogs.join('')}
  </svg>`;
  return h('div', { class: 'hm-fb-wrap', html: svg });
}

// ====================================================================== Canlı skor şeridi
function counter(numEl, reduced) {
  let cur = 0;
  let from = 0;
  let target = null;
  let start = 0;
  let raf = 0;
  const DUR = 900;
  const step = (now) => {
    const p = Math.min(1, (now - start) / DUR);
    const e = 1 - Math.pow(1 - p, 3);
    cur = from + (target - from) * e;
    numEl.textContent = fmtNum(cur);
    raf = p < 1 ? requestAnimationFrame(step) : 0;
  };
  return {
    set(v, suffix = '') {
      numEl.dataset.suffix = suffix;
      if (v === target) return;
      target = v;
      if (reduced || document.hidden) {
        cur = v;
        numEl.textContent = fmtNum(v);
        return;
      }
      from = cur;
      start = performance.now();
      if (!raf) raf = requestAnimationFrame(step);
    },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}

function buildLive(cleanups, reduced) {
  const cell = (key, iconName, label, tone) => {
    const num = h('span', { class: 'hm-live-num num', 'data-suffix': '' }, '0');
    const sub = h('span', { class: 'hm-live-sub' }, ' ');
    const node = h('div', { class: `hm-live-cell hm-tone-${tone}` },
      h('span', { class: 'hm-live-label' }, icon(iconName, { size: 15 }), label),
      num,
      sub,
    );
    return { node, num, sub, c: counter(num, reduced), key };
  };
  const dog = cell('dog', 'paw', 'Toplam DOG', 'ember');
  const fans = cell('fans', 'user', 'Hayran', 'gold');
  const jokes = cell('jokes', 'laugh', 'Topluluk esprisi', 'jade');
  const notes = cell('notes', 'chat', 'Defter imzası', 'arcane');
  cleanups.push(() => [dog, fans, jokes, notes].forEach((c) => c.c.stop()));

  const modeNote = h('span', { class: 'hm-live-mode' }, 'bağlanıyor…');
  const archiveCount = (jokeData.JOKES || []).length;

  let others = 0;
  const renderDog = () => {
    const mine = Number(store.me.get().dog) || 0;
    dog.c.set(others + mine);
    dog.sub.textContent = mine ? `senin payın: ${fmtNum(mine)}` : 'ilk DOG’u sen at';
  };
  cleanups.push(store.fans((all) => {
    const myId = store.uid() || 'me';
    others = agg.totalDog(all.filter((f) => f.id !== myId));
    renderDog();
    fans.c.set(all.length, all.length >= 1000 ? '+' : '');
    fans.sub.textContent = all.length > 1 ? 'sen dahil' : 'şimdilik sadece sen';
    modeNote.textContent = store.shared ? 'tüm hayranlar · canlı' : 'önizleme · bu cihaz';
  }));
  cleanups.push(store.me.subscribe(renderDog));
  cleanups.push(store.subscribe('jokes', { limit: 1000 }, (docs) => {
    jokes.c.set(docs.length, docs.length >= 1000 ? '+' : '');
    jokes.sub.textContent = archiveCount ? `+ ${fmtNum(archiveCount)} arşiv esprisi` : 'duvara ilk sen yaz';
  }));
  cleanups.push(store.subscribe('comments', { where: ['thread', 'guestbook'], orderBy: 'createdAt', dir: 'desc', limit: 100 }, (docs) => {
    notes.c.set(docs.length, docs.length >= 100 ? '+' : '');
    notes.sub.textContent = docs.length >= 100 ? 'son 100 imza' : 'aşağıda imzala';
  }));

  return h('section', { class: 'hm-live frame', 'aria-label': 'Canlı skor' },
    h('div', { class: 'hm-live-tag' },
      h('span', { class: 'hm-live-head' },
        h('span', { class: 'hm-live-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'hm-live-title' }, 'Canlı skor'),
      ),
      modeNote,
    ),
    h('div', { class: 'hm-live-cells' }, dog.node, fans.node, jokes.node, notes.node),
  );
}

// ====================================================================== Bölüm başlığı
function head(idx, eyebrow, title, note, actions) {
  return h('header', { class: 'hm-head' },
    h('div', { class: 'section-head' },
      h('span', { class: 'eyebrow' }, h('span', { class: 'hm-idx' }, idx), eyebrow),
      h('h2', { class: 'h1' }, title),
    ),
    note || actions ? h('div', { class: 'hm-head-side' }, note ? h('p', { class: 'muted small' }, note) : null, actions || null) : null,
  );
}

// ====================================================================== Meme sözlüğü
function buildDictionary() {
  const posterDog = artUrl('poster-dogdogdog');
  const posterDoq = artUrl('poster-1vdoquz');

  // --- DOG DOG DOG
  const dogMedia = posterDog
    ? h('div', { class: 'hm-dict-media hm-dict-media--img' }, h('img', { src: posterDog, alt: '“DOG DOG DOG” yazılı hayran posteri', loading: 'lazy', decoding: 'async' }))
    : h('div', { class: 'hm-dict-media hm-typo', 'aria-hidden': 'true' },
      h('div', { class: 'hm-typo-rows' }, Array.from({ length: 7 }, (_, i) => h('span', { class: i % 2 ? 'hm-typo-row alt' : 'hm-typo-row' }, 'DOG DOG DOG DOG DOG DOG'))),
      h('span', { class: 'stamp hm-typo-stamp' }, 'DOG DOG DOG'),
      h('span', { class: 'hm-typo-tag' }, icon('skull', { size: 14 }), 'Teşhis konuldu'),
    );
  const when = [
    ['skull', 'Takım arkadaşı 0/7 ile mid’de ısrar ediyorsa'],
    ['swords', 'Rakip oyunu trollüyor, üstüne bir de dans ediyorsa'],
    ['bolt', 'Kurye kayboldu, Blink dükkânda seni bekliyorsa'],
    ['ward', 'Support ward yerine Midas aldıysa'],
  ];
  const cardDog = h('article', { class: 'hm-dict hm-dict--dog frame' },
    dogMedia,
    h('div', { class: 'hm-dict-body' },
      h('div', { class: 'hm-dict-word' },
        h('h3', { class: 'hm-dict-title' }, 'DOG DOG DOG'),
        h('span', { class: 'hm-dict-pos' }, 'ünlem · üç kez söylenir'),
      ),
      h('p', { class: 'hm-dict-def' },
        'Takım arkadaşı, rakip ya da ortamdaki herhangi biri kötü oynadığında veya oyunu trollediğinde kurulan üç kelimelik teşhis cümlesi. Açıklama gerektirmez; ',
        h('em', null, 'durumu özetler.')),
      h('div', { class: 'hm-dict-when' },
        h('span', { class: 'hm-dict-label' }, 'Ne zaman söylenir?'),
        h('ul', { class: 'hm-when' }, when.map(([ic, t]) => h('li', null, h('span', { class: 'hm-when-ico', 'aria-hidden': 'true' }, icon(ic, { size: 16 })), t))),
      ),
      h('p', { class: 'hm-dict-ex' }, h('span', { class: 'hm-dict-label' }, 'Örnek'), '“Roshan’a beş kişi girdik, Aegis’i rakip aldı.” ', h('b', null, '— DOG DOG DOG.')),
    ),
  );

  // --- 1vDOQUZ
  const paws = (n, cls) => h('span', { class: `hm-eq-paws ${cls}` }, Array.from({ length: n }, () => icon('paw', { size: 18, stroke: 2 })));
  const cardDoq = h('article', { class: 'hm-dict hm-dict--doq' },
    posterDoq ? h('div', { class: 'hm-dict-media hm-dict-media--img short' }, h('img', { src: posterDoq, alt: '“1vDOQUZ” yazılı hayran posteri', loading: 'lazy', decoding: 'async' })) : null,
    h('div', { class: 'hm-dict-body' },
      h('div', { class: 'hm-dict-word' },
        h('h3', { class: 'hm-dict-title hm-doq' }, '1vDO', h('span', { class: 'hm-q' }, 'Q'), 'UZ'),
        h('span', { class: 'hm-dict-pos' }, 'isim · “bire dokuz”'),
      ),
      h('div', { class: 'hm-eq', role: 'img', 'aria-label': '1 kişi, 4 takım arkadaşı artı 5 rakibe karşı: toplam 9, yani DOQUZ.' },
        h('div', { class: 'hm-eq-one' }, h('b', null, '1'), h('span', null, 'sen')),
        h('span', { class: 'hm-eq-vs' }, 'vs'),
        h('div', { class: 'hm-eq-nine' },
          h('div', { class: 'hm-eq-row' }, paws(4, 'jade'), h('span', { class: 'hm-eq-lbl' }, '4 takım arkadaşı')),
          h('div', { class: 'hm-eq-row' }, paws(5, 'blood'), h('span', { class: 'hm-eq-lbl' }, '+ 5 rakip')),
          h('div', { class: 'hm-eq-sum' }, '= 9 = DO', h('span', { class: 'hm-q-inline' }, 'Q'), 'UZ'),
        ),
      ),
      h('p', { class: 'hm-dict-def small' }, '1v9: dört takım arkadaşın ve beş rakip, yani dokuz kişiye karşı oyunu tek başına taşımak. “Dokuz” burada Q ile yazılır; ', h('em', null, 'yazım hatası değil, karakter meselesi.')),
    ),
  );

  // --- 24 Saat
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const r1 = i % 6 === 0 ? 38 : 42;
    return `<line x1="${(60 + Math.cos(a) * r1).toFixed(2)}" y1="${(60 + Math.sin(a) * r1).toFixed(2)}" x2="${(60 + Math.cos(a) * 47).toFixed(2)}" y2="${(60 + Math.sin(a) * 47).toFixed(2)}"/>`;
  }).join('');
  const clock = h('div', { class: 'hm-clock', role: 'img', 'aria-label': '24 saatlik dolu kadran: en kısa yayın süresi' , html: `
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="hm-clock-track" cx="60" cy="60" r="53"/>
      <circle class="hm-clock-fill" cx="60" cy="60" r="53" pathLength="100"/>
      <g class="hm-clock-ticks">${ticks}</g>
    </svg>
    <span class="hm-clock-read"><b>24</b><span>saat · en az</span></span>` });
  const cardDay = h('article', { class: 'hm-dict hm-dict--day' },
    h('div', { class: 'hm-dict-body hm-day' },
      clock,
      h('div', { class: 'hm-day-text' },
        h('div', { class: 'hm-dict-word' },
          h('h3', { class: 'hm-dict-title' }, '24 Saat'),
          h('span', { class: 'hm-dict-pos' }, 'süre birimi · alt sınır'),
        ),
        h('p', { class: 'hm-dict-def small' }, 'Normal takvimde bir gün. Bu yayında ise en kısa yayının süresi. Burada “kısa yayın” dendiğinde 24 saat anlaşılır; gerisi maraton.'),
        h('p', { class: 'hm-dict-tip xsmall' }, icon('hourglass', { size: 14 }), 'Hayran kuralı: su, atıştırmalık ve şarj aleti yayından önce hazır olur.'),
      ),
    ),
  );

  return h('section', { class: 'hm-sec', 'aria-labelledby': 'hm-dict-h' },
    withId(head('01', 'Meme sözlüğü', 'Üssün üç temel kelimesi', 'Yeni gelenler için hızlı kurs. Sınavı yok, DOG’u var.'), 'hm-dict-h'),
    h('div', { class: 'hm-dict-grid' }, cardDog, cardDoq, cardDay),
  );
}

function withId(headEl, id) {
  const h2 = headEl.querySelector('h2');
  if (h2) h2.id = id;
  return headEl;
}

// ====================================================================== Portallar (yetenek slotları)
function buildPortals(ctx, cleanups) {
  const list = ROUTES.filter((r) => r.id !== 'ana' && !r.hidden);
  const keys = list.map((r) => r.key).join(' ');
  const cards = list.map((r) => {
    const ult = !!r.ultimate;
    const item = !ult && !!r.item;
    const kind = ult ? ' hm-slot--ult' : item ? ' hm-slot--item' : '';
    const card = h('a', {
      class: `hm-slot${kind}`,
      href: '#' + r.id,
      'aria-label': `${r.label} (kısayol ${r.key})`,
      'aria-describedby': `hm-slot-desc-${r.id}`,
    },
      h('span', { class: 'hm-slot-top' },
        h('span', { class: 'hm-slot-icon', 'aria-hidden': 'true' },
          icon(r.icon, { size: ult ? 48 : 28, stroke: ult ? 1.6 : 1.8 }),
        ),
        ult ? h('span', { class: 'badge gold hm-ult-badge' }, icon('sparkle', { size: 12 }), h('span', null, h('span', { lang: 'en' }, 'Ultimate'), ' · hazır')) : null,
        item ? h('span', { class: 'badge gold hm-item-badge' }, 'Eşya slotu') : null,
        h('span', { class: 'kbd hm-slot-kbd', 'aria-hidden': 'true' }, r.key),
      ),
      ult ? h('span', { class: 'hm-ult-nine', 'aria-hidden': 'true' }, Array.from({ length: 9 }, (_, i) => h('span', { class: i < 4 ? 'j' : 'b' }, icon('paw', { size: 16, stroke: 2 })))) : null,
      h('span', { class: 'hm-slot-text' },
        h('span', { class: 'hm-slot-title' }, r.label),
        h('span', { class: 'hm-slot-desc', id: `hm-slot-desc-${r.id}` }, PORTAL_TEXT[r.id] || ''),
      ),
      h('span', { class: 'hm-slot-go', 'aria-hidden': 'true' }, ult ? 'Ultiyi bas' : item ? 'Eşyayı kullan' : 'Işınlan', icon('arrowRight', { size: 14 })),
    );
    card.addEventListener('click', () => ctx.sound.click());
    cleanups.push(attachTilt(card, { max: ult ? 5 : item ? 3 : 9 }));
    return card;
  });
  return h('section', { class: 'hm-sec', 'aria-labelledby': 'hm-portal-h' },
    withId(head('02', 'Yetenek çubuğu', 'Nereye ışınlanıyoruz?', `Klavyede de çalışır: ${keys} · Üs için H.`), 'hm-portal-h'),
    h('div', { class: 'hm-slots' }, cards),
  );
}

// ====================================================================== Oyun Salonu'nda yeni
// Hafif vitrin: oyun modüllerini içe aktarmaz (ana sayfa paketi küçük kalsın); liste core/badges.js'teki
// SALON_GAMES kataloğundan gelir. Günlük sayaç İstanbul (UTC+3) gece yarısına sayar.
const DAY_MS = 86400000;
const msToIstanbulMidnight = (now = Date.now()) => DAY_MS - ((((now + 3 * 3600000) % DAY_MS) + DAY_MS) % DAY_MS);
function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
// DOGdle bulmaca numarası: #1 = 25 Eylül 2026 (İstanbul günü). dogdle.js'teki EPOCH ile aynı olmalı;
// ana sayfa oyun modülünü içe aktarmasın diye burada tekrarlanır.
const DOGDLE_EPOCH_DAY = Math.floor(Date.UTC(2026, 8, 25) / DAY_MS);
const dogdleNumber = (now = Date.now()) => Math.max(1, Math.floor((now + 3 * 3600000) / DAY_MS) - DOGDLE_EPOCH_DAY + 1);
/** DOGdle'ın yerel kaydından bugünkü durum (csk:dogdle:day = { n: bulmaca no, guesses, solved }); yoksa oynanmadı. */
function dogdleToday() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem('csk:dogdle:day') || 'null'); } catch { d = null; }
  if (!d || typeof d !== 'object' || d.n !== dogdleNumber()) return { done: false, guesses: 0 };
  const guesses = Array.isArray(d.guesses) ? d.guesses.length : 0;
  return { done: !!d.solved, guesses };
}

const SAYI = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'];
/** "A, B, C ve D" */
const listTr = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} ve ${arr[arr.length - 1]}`);

function buildSalon(ctx, cleanups) {
  const games = SALON_GAMES.filter((g) => g.isNew);
  const daily = SALON_GAMES.find((g) => g.id === 'dogdle');

  // --- Günün meydan okuması
  let dailyCard = null;
  if (daily) {
    const clock = h('span', { class: 'hm-daily-clock num', 'aria-hidden': 'true' }, fmtCountdown(msToIstanbulMidnight()));
    const clockSr = h('span', { class: 'sr-only' });
    const status = h('span', { class: 'hm-daily-status' });
    const ctaText = h('span', null, 'Bugünün kahramanını bul');
    const cta = h('a', { class: 'btn gold hm-daily-cta', href: '#oyunlar--dogdle' }, icon('eye', { size: 18 }), ctaText, icon('arrowRight', { size: 16 }));
    const bestVal = h('b', { class: 'num' });
    const best = h('span', { class: 'hm-daily-best small' }, 'Rekorun: ', bestVal);
    const paintBest = (me) => {
      const v = me && me.scores ? me.scores.dogdle : null;
      best.hidden = typeof v !== 'number';
      bestVal.textContent = typeof v === 'number' ? `${fmtNum(v)} tahmin` : '';
    };
    paintBest(store.me.get());
    cleanups.push(store.me.subscribe(paintBest));
    cta.addEventListener('click', () => ctx.sound.click());
    dailyCard = h('article', { class: 'hm-daily frame', 'aria-labelledby': 'hm-daily-h' },
      h('div', { class: 'hm-daily-top' },
        h('span', { class: 'hm-daily-crest', 'aria-hidden': 'true' }, icon(daily.icon, { size: 30, stroke: 1.9 })),
        h('div', { class: 'hm-daily-titles' },
          h('span', { class: 'eyebrow' }, 'Günün meydan okuması'),
          h('h3', { class: 'hm-daily-title', id: 'hm-daily-h' }, daily.name),
        ),
      ),
      h('p', { class: 'hm-daily-text' }, 'Her gün gizli bir Dota 2 kahramanı. Özellikleri karşılaştır, en az tahminle bul; herkes aynı kahramanı arıyor.'),
      // Süs: örnek bir tahmin satırı (yeşil aynı, sarı yakın, kırmızı farklı)
      h('div', { class: 'hm-daily-demo', 'aria-hidden': 'true' },
        [['Özellik', 'g'], ['Saldırı', 'r'], ['Karmaşıklık', 'y'], ['Roller', 'y'], ['DOG%', 'r'], ['Tür', 'g']].map(([t, c], i) =>
          h('span', { class: `hm-daily-cell c-${c}`, style: { '--i': i } }, h('span', null, t)))),
      h('div', { class: 'hm-daily-timer' },
        h('span', { class: 'hm-daily-label' }, icon('hourglass', { size: 14 }), 'Yeni kahramana'),
        clock, clockSr,
        status,
      ),
      h('div', { class: 'hm-daily-foot' }, cta, best),
    );
    let lastMin = -1;
    const tick = () => {
      if (document.hidden) return;
      const ms = msToIstanbulMidnight();
      clock.textContent = fmtCountdown(ms);
      const min = Math.floor(ms / 60000);
      if (min === lastMin) return;
      lastMin = min;
      clockSr.textContent = `${Math.floor(min / 60)} saat ${min % 60} dakika`;
      const st = dogdleToday();
      status.className = `hm-daily-status ${st.done ? 'done' : 'todo'}`;
      status.textContent = st.done ? `Bugün çözüldü · ${st.guesses} tahmin` : st.guesses ? `${st.guesses} tahmin · devam et` : 'Bugün çözülmedi';
      ctaText.textContent = st.done ? 'Sonucuna bak' : st.guesses ? 'Kaldığın yerden devam et' : 'Bugünün kahramanını bul';
    };
    tick();
    const iv = setInterval(tick, 1000);
    cleanups.push(() => clearInterval(iv));
  }

  // --- Yeni oyunlar şeridi (salona en son gelen oyunlar; SALON_GAMES[].isNew)
  const played = new Map();
  const list = h('ul', { class: 'hm-new-list', 'aria-label': 'Salona yeni gelen oyunlar' },
    games.map((g) => {
      const state = h('span', { class: 'hm-new-state num' });
      played.set(g.id, { el: state, g });
      const a = h('a', { class: 'hm-new', href: `#oyunlar--${g.id}`, style: { '--gc': g.color } },
        h('span', { class: 'hm-new-ico', 'aria-hidden': 'true' }, icon(g.icon, { size: 22 })),
        h('span', { class: 'hm-new-text' },
          h('span', { class: 'hm-new-name' }, h('span', { class: 'hm-new-title' }, g.name), h('span', { class: 'hm-new-tag' }, 'Yeni')),
          h('span', { class: 'hm-new-sub' }, h('span', { class: 'hm-new-kind' }, g.kind || ''), state),
        ),
        h('span', { class: 'hm-new-go', 'aria-hidden': 'true' }, icon('arrowRight', { size: 16 })),
      );
      a.addEventListener('click', () => ctx.sound.click());
      return h('li', null, a);
    }),
  );

  // --- Günlük görevler (kompakt; ayrıntı profilde)
  const quests = buildQuests(ctx, cleanups);

  // --- Rozetler (kompakt)
  const count = h('b', { class: 'num' });
  const meter = h('span', { class: 'hm-bdg-meter', 'aria-hidden': 'true' }, h('span'));
  const icons = h('span', { class: 'hm-bdg-icons', 'aria-hidden': 'true' });
  const next = h('p', { class: 'hm-bdg-next small' });
  const badges = h('a', { class: 'hm-bdg', href: '#oyunlar--rozetler', 'aria-label': 'Rozetlerin' },
    h('span', { class: 'hm-bdg-head' },
      h('span', { class: 'eyebrow' }, 'Rozetlerin'),
      h('span', { class: 'hm-bdg-count' }, count, h('span', null, `/${BADGES.length}`)),
    ),
    meter,
    icons,
    next,
    h('span', { class: 'hm-bdg-go' }, 'Tüm rozetler', icon('arrowRight', { size: 14 })),
  );
  badges.addEventListener('click', () => ctx.sound.click());

  let lastKey = '';
  const paint = (me) => {
    const scores = (me && me.scores) || {};
    for (const [id, { el, g }] of played) {
      const v = scores[id];
      const has = typeof v === 'number';
      el.textContent = has ? (g.format ? g.format(v) : fmtNum(v)) : 'Dene';
      el.title = has ? `Rekorun: ${el.textContent}` : 'Henüz oynamadın';
      el.classList.toggle('on', has);
    }
    const got = earnedSet(me);
    const key = [...got].join(',') + '|' + JSON.stringify(scores) + '|' + (me.dog || 0);
    if (key === lastKey) return;
    lastKey = key;
    count.textContent = String(got.size);
    meter.firstChild.style.transform = `scaleX(${got.size / BADGES.length})`;
    const earned = BADGES.filter((b) => got.has(b.id));
    const shown = earned.slice(-7);
    icons.replaceChildren(
      ...shown.map((b) => h('span', { class: 'hm-bdg-ico on', style: { '--bc': b.color }, title: b.name }, icon(b.icon, { size: 18, stroke: 2 }))),
      ...Array.from({ length: Math.max(0, 7 - shown.length) }, () => h('span', { class: 'hm-bdg-ico' }, icon('lock', { size: 14 }))),
    );
    // Sıradaki hedef: ilerlemesi en yüksek kilitli rozet (yoksa listedeki ilk kilitli)
    const locked = BADGES.filter((b) => !got.has(b.id));
    let best = null;
    let bestPct = -1;
    for (const b of locked) {
      const p = badgeProgress(b, me);
      const pct = p && p.pct != null ? p.pct : 0;
      if (pct > bestPct) { best = b; bestPct = pct; }
    }
    if (best) {
      next.replaceChildren(h('span', { class: 'hm-bdg-next-lbl' }, 'Sıradaki: '), h('b', null, best.name), ' — ', best.how);
      badges.href = got.size ? '#oyunlar--rozetler' : badgeHref(best);
    } else {
      next.textContent = 'Hepsini topladın. Salonun gerçek 1vDOQUZ’u sensin.';
    }
  };
  paint(store.me.get());
  cleanups.push(store.me.subscribe(paint));

  const toSalon = h('a', { class: 'btn ghost', href: '#oyunlar' }, icon('gamepad', { size: 18 }), 'Oyun Salonu', icon('arrowRight', { size: 16 }));
  toSalon.addEventListener('click', () => ctx.sound.click());

  const n = games.length;
  const title = n ? `Salona ${SAYI[n] || n} yeni oyun geldi` : 'Oyun Salonu';
  const note = n ? `${listTr(games.map((g) => g.name))}. Günün görevleri XP, rekorların rozet kazandırır.` : 'Günün görevleri XP, rekorların rozet kazandırır.';
  return h('section', { class: 'hm-sec hm-salon', 'aria-labelledby': 'hm-salon-h' },
    withId(head('03', 'Oyun Salonu’nda yeni', title, note, h('div', { class: 'hm-head-actions' }, toSalon)), 'hm-salon-h'),
    h('div', { class: 'hm-salon-grid' },
      dailyCard ? h('div', { class: 'hm-salon-daily' }, dailyCard) : null,
      h('div', { class: 'hm-salon-new' }, list),
      h('div', { class: 'hm-salon-quests' }, quests),
      h('div', { class: 'hm-salon-badges' }, badges),
    ),
  );
}

// ====================================================================== Günlük görevler (kompakt kart)
// core/quests.js: subscribeQuests (ilerleme + tamamlanma), msToReset (İstanbul gece yarısı), fanXp/fanLevel.
function buildQuests(ctx, cleanups) {
  const clock = h('span', { class: 'hm-gv-clock num', 'aria-hidden': 'true' }, fmtCountdown(msToReset()));
  const clockSr = h('span', { class: 'sr-only' });
  const count = h('span', { class: 'hm-gv-count num' });
  const streak = h('span', { class: 'hm-gv-streak' });
  const rows = h('ol', { class: 'hm-gv-list', 'aria-label': 'Bugünün görevleri' });
  const lvlNum = h('span', { class: 'hm-lvl-n num' });
  const lvlRank = h('span', { class: 'hm-lvl-rank' });
  const lvlXp = h('span', { class: 'hm-lvl-xp num' });
  const lvlBar = h('span', { class: 'hm-lvl-bar', 'aria-hidden': 'true' }, h('span'));
  const lvl = h('a', { class: 'hm-lvl', href: '#profil', 'aria-label': 'Fan seviyen' },
    h('span', { class: 'hm-lvl-hex', 'aria-hidden': 'true' }, lvlNum),
    h('span', { class: 'hm-lvl-text' },
      h('span', { class: 'hm-lvl-top' }, h('span', { class: 'hm-lvl-k' }, 'Fan seviyen'), lvlRank),
      lvlBar,
      lvlXp,
    ),
  );
  const all = h('a', { class: 'hm-gv-all', href: '#profil--gorevler' }, 'Tüm görevler', icon('arrowRight', { size: 14 }));
  for (const a of [lvl, all]) a.addEventListener('click', () => ctx.sound.click());

  const card = h('article', { class: 'hm-quests', 'aria-labelledby': 'hm-gv-h' },
    h('div', { class: 'hm-gv-head' },
      h('div', { class: 'hm-gv-top' },
        h('span', { class: 'eyebrow' }, 'Günlük görevler'),
        h('span', { class: 'hm-gv-reset', title: 'Görevler İstanbul saatiyle gece yarısı yenilenir' },
          icon('hourglass', { size: 13 }), h('span', { class: 'hm-gv-reset-k', 'aria-hidden': 'true' }, 'Yeni görevler'), clock, clockSr,
        ),
      ),
      h('h3', { class: 'hm-gv-title', id: 'hm-gv-h' }, 'Bugünün görevleri', count),
    ),
    rows,
    h('div', { class: 'hm-gv-foot' }, streak, all),
    lvl,
  );

  // Satırlar kimliğe göre yerinde güncellenir (DOG görevine art arda basarken odak kaybolmasın)
  let ids = '';
  const byId = new Map();
  function rowFor(q) {
    const ico = h('span', { class: 'hm-gv-ico', 'aria-hidden': 'true' });
    const fill = h('span');
    const detail = h('span', { class: 'hm-gv-detail' });
    const num = h('span', { class: 'hm-gv-num num' });
    const attrs = { class: 'hm-gv', style: { '--qc': q.color || 'var(--ember)' } };
    const el = q.href
      ? h('a', { ...attrs, href: q.href })
      : h('button', { ...attrs, type: 'button', title: q.action === 'dog' ? 'Bas: DOG DOG DOG' : '' });
    el.append(
      ico,
      h('span', { class: 'hm-gv-text' },
        h('span', { class: 'hm-gv-name' }, memeText(q.text)),
        h('span', { class: 'hm-gv-bar', 'aria-hidden': 'true' }, fill),
        detail,
      ),
      num,
    );
    el.addEventListener('click', () => {
      if (q.action === 'dog') {
        pressDog(el);
        return;
      }
      ctx.sound.click();
    });
    const item = h('li', null, el);
    const r = { item, el, ico, fill, detail, num, doneShown: null };
    byId.set(q.id, r);
    return r;
  }
  function paintRow(q) {
    const r = byId.get(q.id);
    const pct = q.target ? Math.max(0, Math.min(1, q.progress / q.target)) : 0;
    r.el.classList.toggle('done', !!q.done);
    if (r.doneShown !== !!q.done) {
      r.doneShown = !!q.done;
      r.ico.replaceChildren(icon(q.done ? 'check' : q.icon || 'star', { size: 18, stroke: q.done ? 2.4 : 1.9 }));
    }
    r.fill.style.transform = `scaleX(${q.done ? 1 : pct})`;
    r.detail.textContent = q.done ? `Tamam · +${QUEST_XP} XP` : q.detail || q.hint || '';
    r.num.textContent = q.done ? '✓' : q.target > 1 ? `${fmtNum(q.progress)}/${fmtNum(q.target)}` : `0/${q.target}`;
    const state = q.done ? 'tamamlandı' : q.target > 1 ? `${fmtNum(q.progress)} / ${fmtNum(q.target)}` : 'yapılmadı';
    r.el.setAttribute('aria-label', `${q.text}: ${state}`);
  }
  function paintLevel() {
    const x = fanXp(store.me.get());
    const L = fanLevel(x.xp);
    lvl.style.setProperty('--rc', L.color);
    lvlNum.textContent = String(L.level);
    lvlRank.textContent = `Seviye ${L.level} · ${L.rank}`;
    lvlXp.textContent = `${fmtNum(L.into)}/${fmtNum(L.need)} XP · sonraki seviyeye ${fmtNum(L.need - L.into)} XP`;
    lvlBar.firstChild.style.transform = `scaleX(${Math.max(0, Math.min(1, L.pct))})`;
    lvl.setAttribute('aria-label', `Fan seviyen: Seviye ${L.level}, ${L.rank}. ${fmtNum(L.xp)} XP. Profiline git.`);
  }
  const paint = (status) => {
    const list = Array.isArray(status) ? status : [];
    const key = list.map((q) => q.id).join(',');
    if (key !== ids) {
      ids = key;
      byId.clear();
      rows.replaceChildren(...list.map((q) => rowFor(q).item));
    }
    list.forEach(paintRow);
    const done = list.filter((q) => q.done).length;
    count.textContent = `${done}/${list.length || 3}`;
    card.classList.toggle('all-done', list.length > 0 && done === list.length);
    const st = questStreak();
    streak.replaceChildren(
      icon('flame', { size: 14 }),
      st.current > 0 ? `Seri: ${fmtNum(st.current)} gün` : done === list.length && list.length ? 'Seri başladı' : 'Üçü de biterse seri başlar',
    );
    streak.classList.toggle('on', st.current > 0);
    paintLevel();
  };
  // İlk çizim hemen (abonelik ilk durumu kısa bir gecikmeyle verir), sonra her değişiklikte
  try { paint(questStatus()); } catch (e) { console.error(e); }
  cleanups.push(subscribeQuests(paint));

  let lastMin = -1;
  const tick = () => {
    if (document.hidden) return;
    const ms = msToReset();
    clock.textContent = fmtCountdown(ms);
    const min = Math.floor(ms / 60000);
    if (min !== lastMin) {
      lastMin = min;
      clockSr.textContent = `Görevler ${Math.floor(min / 60)} saat ${min % 60} dakika sonra yenilenir`;
    }
  };
  tick();
  const iv = setInterval(tick, 1000);
  cleanups.push(() => clearInterval(iv));
  return card;
}

// ====================================================================== Günün esprisi
function catLabel(cat) {
  const cats = jokeData.JOKE_CATEGORIES || [];
  for (const c of cats) {
    if (c && typeof c === 'object' && (c.id === cat || c.key === cat)) return c.label || c.name || cat;
    if (c === cat) return c;
  }
  return cat || 'Hayran esprisi';
}

/** "1vDOQUZ" yazımını büyük harf dönüşümünden korur (rozet/düğme gibi uppercase bağlamlar için). */
function memeText(s) {
  return String(s || '').split(/(1vDOQUZ)/).filter(Boolean).map((p) => (p === '1vDOQUZ' ? h('span', { class: 'meme' }, p) : p));
}

function buildJoke(ctx, cleanups) {
  const archive = Array.isArray(jokeData.JOKES) ? jokeData.JOKES.filter((j) => j && j.id && j.text) : [];
  const list = archive.length ? archive : FALLBACK_JOKES;
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  // Espri Duvarı'ndaki "Günün damgası" ile aynı tohum: iki sayfa aynı günün esprisini gösterir
  let idx = hashStr((archive.length ? 'jk-gunun-' : 'gunun-esprisi:') + dayKey) % list.length;
  const todayIdx = idx;

  const textEl = h('p', { class: 'hm-joke-text' });
  const catEl = h('span', { class: 'badge ember' });
  const noEl = h('span', { class: 'hm-joke-no num' });
  const kindEl = h('span', { class: 'hm-joke-kind' });
  const quote = h('blockquote', { class: 'hm-joke-quote', 'aria-live': 'polite' }, textEl);

  // Beğeni ve yorum anahtarları Espri Duvarı ile aynı: 'jk:' + id ve 'joke:' + id
  const likeN = h('span', { class: 'hm-joke-n num' });
  const likeBtn = h('button', { class: 'btn ghost hm-joke-like', type: 'button', 'aria-pressed': 'false', title: 'DOG’la (beğen)' },
    icon('paw', { size: 18, stroke: 2 }), h('span', null, 'DOG’la'), likeN);
  const cmtN = h('span', { class: 'hm-joke-n num' });
  const cmtBtn = h('button', { class: 'btn ghost hm-joke-cmt', type: 'button', 'aria-haspopup': 'dialog' },
    icon('chat', { size: 18 }), h('span', null, 'Yorumlar'), cmtN);

  let fansDocs = [];
  const paintLike = () => {
    const key = 'jk:' + list[idx].id;
    const myId = store.uid() || 'me';
    const mine = !!(store.me.get().likes || {})[key];
    const others = fansDocs.reduce((s, f) => s + (f.id !== myId && f.id !== 'me' && f.likes && f.likes[key] ? 1 : 0), 0);
    const n = others + (mine ? 1 : 0);
    likeBtn.setAttribute('aria-pressed', String(mine));
    likeBtn.classList.toggle('on', mine);
    likeN.textContent = n ? fmtNum(n) : '';
  };
  cleanups.push(store.fans((all) => { fansDocs = all; paintLike(); }));

  let unsubCmt = null;
  const watchComments = () => {
    if (unsubCmt) unsubCmt();
    cmtN.textContent = '';
    // mountComments ile aynı sorgu: store tek aboneliği paylaşır
    unsubCmt = store.subscribe('comments', { where: ['thread', 'joke:' + list[idx].id], orderBy: 'createdAt', dir: 'desc', limit: 100 }, (docs) => {
      cmtN.textContent = docs.length ? (docs.length >= 100 ? '99+' : fmtNum(docs.length)) : '';
    });
  };
  cleanups.push(() => { if (unsubCmt) unsubCmt(); unsubCmt = null; });

  const render = (animate) => {
    const j = list[idx];
    textEl.textContent = j.text;
    clear(catEl).appendChild(h('span', null, memeText(catLabel(j.cat))));
    noEl.textContent = `No. ${String(idx + 1).padStart(3, '0')} / ${String(list.length).padStart(3, '0')}`;
    kindEl.textContent = idx === todayIdx ? 'Günün esprisi' : 'Bonus espri';
    paintLike();
    watchComments();
    if (animate) {
      quote.classList.remove('pop-in');
      void quote.offsetWidth;
      quote.classList.add('pop-in');
    }
  };
  render(false);

  likeBtn.addEventListener('click', () => {
    const on = store.me.toggleLike('jk:' + list[idx].id);
    // Salt okunur paylaşımda beğeni yalnızca bu cihazda kalır: bir kez söyle
    if (on && !roLikeNoted && store.shared && !store.canWrite()) {
      roLikeNoted = true;
      ctx.fx.toast('Salt okunur görüntüleme: DOG’ların yalnızca bu cihazda sayılır, topluluk sayısına eklenmez.', 'ember');
    }
    if (on) {
      ctx.sound.bark(1.15);
      const r = likeBtn.getBoundingClientRect();
      ctx.fx.floatText('DOG!', r.left + r.width / 2, r.top, { size: 18 });
    } else ctx.sound.click();
    paintLike();
  });

  let closeModal = null;
  cmtBtn.addEventListener('click', () => {
    ctx.sound.click();
    const j = list[idx];
    const host = h('div');
    let destroy = null;
    const box = h('div', { class: 'hm-cmodal' },
      h('div', { class: 'hm-cmodal-head' },
        h('span', { class: 'eyebrow' }, 'Espri yorumları'),
        h('button', { class: 'btn ghost icon', type: 'button', 'aria-label': 'Kapat', onclick: () => closeModal && closeModal() }, icon('close', { size: 18 })),
      ),
      h('blockquote', { class: 'hm-cmodal-quote' }, j.text),
      host,
    );
    closeModal = ctx.fx.modal(box, {
      label: 'Espri yorumları',
      onClose: () => { if (destroy) destroy(); destroy = null; closeModal = null; },
    });
    destroy = mountComments(host, { threadId: 'joke:' + j.id, title: 'Yorumlar', compact: true, placeholder: 'Yorumun… (DOG DOG DOG serbest)' });
  });
  cleanups.push(() => { if (closeModal) closeModal(); });

  const again = h('button', { class: 'btn ghost', type: 'button' }, icon('refresh', { size: 18 }), 'Başka bir tane');
  again.addEventListener('click', () => {
    if (list.length > 1) {
      let n = idx;
      while (n === idx) n = Math.floor(Math.random() * list.length);
      idx = n;
    }
    ctx.sound.click();
    render(true);
  });
  const toWall = h('button', { class: 'btn primary', type: 'button' }, 'Espri Duvarına git', icon('arrowRight', { size: 18 }));
  toWall.addEventListener('click', () => { ctx.sound.click(); ctx.go('espriler'); });

  const date = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  return h('section', { class: 'hm-joke', 'aria-label': 'Günün esprisi' },
    h('div', { class: 'hm-joke-side' },
      h('span', { class: 'hm-joke-mark', 'aria-hidden': 'true' }, '“'),
      h('span', { class: 'eyebrow' }, kindEl),
      h('span', { class: 'hm-joke-date num' }, date),
    ),
    h('div', { class: 'hm-joke-main' },
      h('div', { class: 'hm-joke-meta' }, h('span', { class: 'hm-joke-chan' }, '[Tümü]'), catEl, noEl),
      quote,
      h('div', { class: 'hm-joke-actions' },
        h('div', { class: 'hm-joke-react' }, likeBtn, cmtBtn),
        h('div', { class: 'hm-joke-nav' }, again, toWall),
      ),
      h('p', { class: 'xsmall dim' }, archive.length ? 'Hayran yapımı espri arşivinden; her gün başka bir tane.' : 'Hayran yapımı espriler; her gün başka bir tane.'),
    ),
  );
}

// ====================================================================== DOG Arşivi vitrini
function buildArchive(ctx) {
  const now = new Date();
  const rnd = seeded(hashStr(`vitrin:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`));
  const pool = ARCHETYPES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = pool.slice(0, 5);

  const cards = picks.map((a) => h('a', {
    class: 'hm-arch',
    href: `#karakterler--${a.id}`,
    style: { '--c': a.color },
    'aria-label': `${a.name}: ${a.tagline}`,
  },
    h('span', { class: 'hm-arch-img' }, portraitEl(a, { alt: '' })),
    h('span', { class: 'hm-arch-body' },
      h('span', { class: 'hm-arch-lvl', title: `DOG seviyesi ${a.dogLevel}/5` },
        Array.from({ length: 5 }, (_, i) => h('span', { class: i < a.dogLevel ? 'on' : '' }, icon('paw', { size: 12, stroke: 2.2 }))),
      ),
      h('span', { class: 'hm-arch-name' }, a.name),
      h('span', { class: 'hm-arch-tag' }, a.tagline),
    ),
  ));

  const quiz = h('a', { class: 'hm-arch hm-arch--quiz', href: '#quizler--hangidog' },
    h('span', { class: 'hm-arch-img hm-quiz-art', 'aria-hidden': 'true' }, h('span', { class: 'hm-quiz-q' }, '?'), icon('paw', { size: 40, stroke: 1.6 })),
    h('span', { class: 'hm-arch-body' },
      h('span', { class: 'hm-arch-name' }, 'Hangi DOG’sun?'),
      h('span', { class: 'hm-arch-tag' }, 'Birkaç soru, dürüst cevaplar ve kaçınılmaz teşhis.'),
      h('span', { class: 'hm-arch-cta' }, 'Quize gir', icon('arrowRight', { size: 14 })),
    ),
  );

  const toQuiz = h('button', { class: 'btn gold', type: 'button' }, icon('quiz', { size: 18 }), 'Hangi DOG’sun?');
  toQuiz.addEventListener('click', () => { ctx.sound.click(); ctx.go('quizler', 'hangidog'); });
  const toAll = h('button', { class: 'btn ghost', type: 'button' }, 'Tüm arşiv', icon('arrowRight', { size: 18 }));
  toAll.addEventListener('click', () => { ctx.sound.click(); ctx.go('karakterler'); });

  return h('section', { class: 'hm-sec', 'aria-labelledby': 'hm-arch-h' },
    withId(head('04', 'DOG Arşivi', 'Pub’ların yaban hayatı', `Arşivde ${ARCHETYPES.length} tür kayıtlı; bugün vitrinde beşi var. Hepsi hayran yapımı mizah.`, h('div', { class: 'hm-head-actions' }, toQuiz, toAll)), 'hm-arch-h'),
    h('div', { class: 'hm-archs' }, cards, quiz),
  );
}

// ====================================================================== Ziyaretçi defteri
function buildGuestbook(cleanups) {
  const box = h('div', { class: 'hm-gb-box panel raised' });
  cleanups.push(mountComments(box, {
    threadId: 'guestbook',
    title: 'Ziyaretçi Defteri',
    placeholder: 'Selam ver, DOG at, 24 saatlik yayına destek ol…',
  }));
  return h('section', { class: 'hm-sec hm-gb', 'aria-labelledby': 'hm-gb-h' },
    h('div', { class: 'hm-gb-intro' },
      withId(head('05', 'Ziyaretçi defteri', 'Üsse imzanı at'), 'hm-gb-h'),
      h('p', { class: 'muted' }, 'Hangi saatte katıldın, kaçıncı saatte uyudun, en son hangi DOG anına şahit oldun? Kısa bir not bırak.'),
      h('ul', { class: 'hm-gb-rules' },
        h('li', null, icon('check', { size: 16 }), 'DOG serbest, hakaret yasak.'),
        h('li', null, icon('check', { size: 16 }), 'Spoiler yok, flame yok, “report mid” de yok.'),
        h('li', null, icon('check', { size: 16 }), 'Takma adını yorum kutusunun altındaki ad düğmesinden değiştirebilirsin.'),
      ),
    ),
    box,
  );
}
