// Kendi DOG Analizini Çıkar — yerel, deterministik analiz (yapay zekâ yok).
// Girdiler → 6 statlık radar + her türün "imza profili"ne uzaklık → % benzerlik.
// Rapor metni şablonlardan, takma ada göre tohumlanmış çeşitlilikle üretilir.
import { h, clear, ls, cleanText, hashStr, seeded, copyText, prefersReducedMotion, clamp, fmtNum } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { agg } from '../../core/store.js';
import { ALL_TYPES, STAT_LABELS, byId } from '../../data/archetypes.js';
import { portraitEl } from '../../components/portrait.js';
import { radarSvg } from './radar.js';
import { pawsLevelEl, dogIndex, STAT_KEYS, GOOD_STATS, contrastColor } from './util.js';

const FORM_KEY = 'ch:analiz-form';

const SLIDERS = [
  { id: 'ward', label: 'Ward alma sıklığın', icon: 'ward', def: 40, words: ['Ward ne ki?', 'Nadiren, o da hediye', 'Arada bir', 'Sık sık', 'Ward makinesi'] },
  { id: 'death', label: 'Ölüm sayın', icon: 'skull', def: 50, words: ['Ölümsüz', 'Az ölürüm', 'Ortalama', 'Çeşmeye abone', 'Çeşme kiracısı'] },
  { id: 'chat', label: 'Chat’te yazma', icon: 'chat', def: 40, words: ['Sessiz sinema', '“gg wp” kadar', 'Ara ara laf', 'Paragraf paragraf', 'All chat romancısı'] },
  { id: 'farm', label: 'Farm tutkusu', icon: 'coin', def: 50, words: ['Önce takım', 'Dengeli', 'Kamp sever', 'Orman memuru', 'Farm’dan başka dünya yok'] },
  { id: 'pause', label: 'Pause kullanımın', icon: 'pause', def: 20, words: ['Hiç', 'Gerçek acil durumda', 'Su molası', 'Her savaşta', 'P tuşu sıkıştı'] },
  { id: 'map', label: 'Harita bakışı', icon: 'eye', def: 50, words: ['Harita nedir?', 'Arada bir', 'Ara sıra', 'Sık bakarım', 'Radar gözlü'] },
];
const wordFor = (sl, v) => sl.words[Math.min(4, Math.floor(v / 20))];

const ROLES = [
  { id: 1, label: 'Carry', sub: 'Poz. 1' },
  { id: 2, label: 'Mid', sub: 'Poz. 2' },
  { id: 3, label: 'Offlane', sub: 'Poz. 3' },
  { id: 4, label: 'Yarı destek', sub: 'Poz. 4' },
  { id: 5, label: 'Tam destek', sub: 'Poz. 5' },
];

// Her türün girdi uzayındaki imza profili (ward, death, chat, farm, pause, map) ve uyumlu roller
const SIG = {
  farm: { v: { ward: 15, death: 25, chat: 30, farm: 100, pause: 30, map: 15 }, roles: [1] },
  feed: { v: { ward: 10, death: 100, chat: 50, farm: 20, pause: 20, map: 5 }, roles: [2, 3] },
  pause: { v: { ward: 30, death: 40, chat: 65, farm: 50, pause: 100, map: 40 }, roles: [] },
  afk: { v: { ward: 5, death: 30, chat: 5, farm: 5, pause: 45, map: 0 }, roles: [] },
  kurye: { v: { ward: 15, death: 45, chat: 55, farm: 65, pause: 45, map: 25 }, roles: [1, 3] },
  rapier: { v: { ward: 15, death: 75, chat: 45, farm: 75, pause: 25, map: 25 }, roles: [1, 2] },
  mid: { v: { ward: 15, death: 70, chat: 80, farm: 55, pause: 30, map: 35 }, roles: [2] },
  ward: { v: { ward: 0, death: 55, chat: 40, farm: 80, pause: 25, map: 15 }, roles: [4, 5] },
  smurf: { v: { ward: 30, death: 50, chat: 85, farm: 60, pause: 35, map: 45 }, roles: [2, 3] },
  chat: { v: { ward: 20, death: 60, chat: 100, farm: 40, pause: 45, map: 30 }, roles: [] },
  legend: { v: { ward: 90, death: 10, chat: 40, farm: 60, pause: 10, map: 100 }, roles: [] },
};
const IN_KEYS = ['ward', 'death', 'chat', 'farm', 'pause', 'map'];
const WEIGHTS = { ward: 1, death: 1.1, chat: 1, farm: 1, pause: 0.9, map: 1 };

const LEVEL_NAMES = ['DOG değil · 1vDOQUZ adayı', 'Yavru DOG', 'Hafif DOG', 'Orta boy DOG', 'Ciddi DOG', 'Saf DOG'];

// ---------------------------------------------------------------- hesap
export function userRadar(i) {
  const roleFarm = { 1: 15, 2: 8, 3: 0, 4: -10, 5: -15 }[i.role] || 0;
  const r = {
    feed: i.death,
    farm: i.farm * 0.9 + roleFarm,
    tilt: i.chat * 0.5 + i.death * 0.3 + i.pause * 0.2,
    chat: i.chat,
    harita: i.map * 0.75 + i.ward * 0.25,
    takim: i.ward * 0.4 + i.map * 0.2 + (100 - i.farm) * 0.25 + (100 - i.chat) * 0.15,
  };
  for (const k of STAT_KEYS) r[k] = Math.round(clamp(r[k], 0, 100));
  return r;
}

export function analyze(input) {
  const radar = userRadar(input);
  const di = dogIndex(radar);
  let ranked = ALL_TYPES.map((t) => {
    const sg = SIG[t.id];
    let d2 = 0;
    let ws = 0;
    for (const k of IN_KEYS) {
      d2 += WEIGHTS[k] * (input[k] - sg.v[k]) ** 2;
      ws += WEIGHTS[k];
    }
    let pct = 100 - Math.sqrt(d2 / ws) * 1.25;
    if (sg.roles.length) pct += sg.roles.includes(input.role) ? 8 : -5;
    return { t, pct: Math.round(clamp(pct, 3, 99)) };
  }).sort((a, b) => b.pct - a.pct || ALL_TYPES.indexOf(a.t) - ALL_TYPES.indexOf(b.t));
  // Efsane yalnızca gerçekten temiz oynayanlara: DOG indeksi yüksekse ilk sıradan iner
  if (ranked[0].t.id === 'legend' && di > 38) {
    const lg = ranked.shift();
    lg.pct = Math.min(lg.pct, ranked[0].pct - 1);
    ranked.splice(1, 0, lg);
  }
  const best = ranked[0];
  let level = di < 25 ? 0 : di < 38 ? 1 : di < 50 ? 2 : di < 62 ? 3 : di < 74 ? 4 : 5;
  if (best.t.id === 'legend') level = 0;
  else level = Math.max(1, level);
  return { input, radar, di, ranked, best, level };
}

// ---------------------------------------------------------------- rapor şablonları
const OPENERS = [
  (n, p, t) => `Sayın ${n}, DOG radarımız seni %${p} benzerlikle “${t}” olarak işaretledi.`,
  (n, p, t) => `${n} için laboratuvar sonuçları çıktı: %${p} ${t}. Test iki kez tekrarlandı, sonuç değişmedi.`,
  (n, p, t) => `Bilim kurulumuz ${n} vakasını inceledi ve oy birliğiyle karar verdi: %${p} ${t}.`,
  (n, p, t) => `Kayıtlara geçsin: ${n}, %${p} oranında ${t}. Replay’ler de bunu doğruluyor.`,
];
const LEGEND_OPENERS = [
  (n, p) => `Sayın ${n}, radar önce arızalandı sandık: %${p} “1vDOQUZ Efsanesi”. Tekrar ölçtük. Aynı.`,
  (n, p) => `${n}, sen bir DOG değilsin. %${p} efsane çıktın; takımın bunu bilmiyor olabilir ama biz biliyoruz.`,
];
const WORST = {
  feed: [(v) => `Ölüm değerin ${v}/100: çeşme seni artık kiracı olarak kaydetti.`, (v) => `Feed metren ${v}/100 gösteriyor; düşman takım sana teşekkür kartı hazırlıyor.`],
  farm: [(v) => `Farm hırsın ${v}/100: ormandaki creep’ler seni ismiyle tanıyor.`, (v) => `Farm değerin ${v}/100. Takım savaşı mı? Önce şu kampı bitir, değil mi?`],
  tilt: [(v) => `Tilt değerin ${v}/100: klavyen senden resmî olarak şikâyetçi.`, (v) => `${v}/100 tilt ile ilk ölümde ekran kararıyor, ikincide mikrofon açılıyor.`],
  chat: [(v) => `Chat değerin ${v}/100: all chat’e yazdıkların bir roman serisine yetiyor.`, (v) => `${v}/100 chat enerjisi; son vuruş sayından çok mesaj sayın var.`],
  harita: [(v) => `Harita farkındalığın ${v}/100: mini harita senin için ekran koruyucu.`, (v) => `Harita değerin ${v}/100. Gank geldiğinde şaşırman bu yüzden.`],
  takim: [(v) => `Takım oyunun ${v}/100: “takım” kelimesini en çok maç sonu ekranında görüyorsun.`, (v) => `Takım oyunu ${v}/100. Dört kişi bir tarafa, sen öbür tarafa.`],
};
const BEST = {
  feed: [(v) => `Ama ölüm değerin ${v}/100 — çeşme seni hâlâ tanımıyor, tebrikler.`],
  farm: [(v) => `Farm hırsın ${v}/100 kadar mütevazı; takımın bundan memnun.`],
  tilt: [(v) => `Tilt değerin sadece ${v}/100: sakinliğin takımına ilaç gibi geliyor.`],
  chat: [(v) => `Chat değerin ${v}/100; mute tuşuna hiç ihtiyaç bırakmıyorsun.`],
  harita: [(v) => `Öte yandan harita bakışın ${v}/100 — mini haritayı gerçekten okuyan nadir türdensin.`],
  takim: [(v) => `Takım oyunun ${v}/100: takım arkadaşların seni gizli hazine gibi saklıyor.`],
};
const BEST_MEH = [
  (k, v) => `En az DOG yanın bile ${k} (${v}/100). Yine de bir başlangıç.`,
  (k, v) => `Kurtarıcı yanını aradık; en yakın aday ${k} (${v}/100). Aramaya devam.`,
];
const CLOSERS = [
  () => 'Bu rapor mizah amaçlıdır; MMR’ın bu rapordan etkilenmez (maalesef).',
  () => 'Bir dahaki maçta “DOG DOG DOG” duyarsan, bil ki bu rapor haklıydı.',
  () => 'Rapor sonucu kesin değildir; bir sonraki pub maçında yeniden doğrulanacaktır.',
];

function report(res, nick) {
  const rng = seeded(hashStr(nick.toLocaleLowerCase('tr') + '|' + res.best.t.id));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const bad = (k) => (GOOD_STATS.has(k) ? 100 - res.radar[k] : res.radar[k]);
  const sorted = STAT_KEYS.slice().sort((a, b) => bad(b) - bad(a));
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  const t = res.best.t;
  const lines = [];
  lines.push(t.id === 'legend' ? pick(LEGEND_OPENERS)(nick, res.best.pct) : pick(OPENERS)(nick, res.best.pct, t.name));
  if (bad(worst) >= 45) lines.push(pick(WORST[worst])(res.radar[worst]));
  if (bad(best) >= 45) lines.push(pick(BEST_MEH)(STAT_LABELS[best].toLocaleLowerCase('tr'), res.radar[best]));
  else lines.push(pick(BEST[best])(res.radar[best]));
  lines.push(`Türünün klasik repliği: ${t.chatQuote}`);
  lines.push(pick(CLOSERS)());
  return lines;
}

function suggestions(res) {
  const i = res.input;
  const out = [];
  const add = (need, text) => out.push({ need, text });
  add(100 - i.ward + (i.role >= 4 ? 25 : 0), i.role >= 4
    ? 'Destek oynuyorsan ward senin, kurye de senin; Midas ise hiç senin değil. Her dönüşte bir Observer al.'
    : 'Her ölümden sonra bir Observer Ward al. Ölüm sayın düşmese bile harita aydınlanır.');
  add(i.death, 'Savaşa girmeden önce üç şeye bak: mini harita, düşmanın BKB’si, kendi TP’n. Üçü de yoksa girme.');
  add(i.chat, 'Mute tuşunu önce kendine dene: yazdığın her paragraf bir last hit’e mal oluyor.');
  add(i.farm * 0.9 + (i.role === 1 ? 10 : 0), i.role === 1
    ? 'Carry’sin, tamam; ama 25. dakikadaki savaş da senin savaşın. Bir kamp daha, bir kule eksik demek.'
    : 'Takım ping’i bir farm kampı değil; ama oraya da altın düşüyor, merak etme.');
  add(i.pause, 'Pause’u kapı zili ve gerçek acil durumlar için sakla. Su içmek acil durum değil.');
  add(100 - i.map, 'Her creep dalgasında bir kez mini haritaya bak; kulen düştüğünde şaşırmazsın.');
  const picked = out.filter((x) => x.need >= 45).sort((a, b) => b.need - a.need).slice(0, 3).map((x) => x.text);
  const fallbacks = [
    'Aynen devam: bu gidişle takımın 1vDOQUZ umudu sensin.',
    'Takım arkadaşlarına ward almayı öğret; dünya daha aydınlık bir yer olur.',
    'Maraton maçlara hazırlan: bazı yayınlarda en kısa süre bile 24 saat.',
  ];
  while (picked.length < 3) picked.push(fallbacks[picked.length]);
  return picked;
}

function shareText(res, nick, lines) {
  const t = res.best.t;
  const bar = (n) => '■'.repeat(n) + '□'.repeat(5 - n);
  return [
    `DOG Analizi · ${nick}`,
    `Tür: ${t.name} (%${res.best.pct}) — ${t.title}`,
    `DOG seviyesi: ${res.level ? `${res.level}/5 ${bar(res.level)}` : 'DOG değil (1vDOQUZ adayı)'}`,
    `Radar: ${STAT_KEYS.map((k) => `${STAT_LABELS[k]} ${res.radar[k]}`).join(' · ')}`,
    lines[0],
    '— CureShot hayran üssü · mizah amaçlıdır',
  ].join('\n');
}

// ---------------------------------------------------------------- arayüz
export function renderAnalysis(el, env) {
  const { ctx, store } = env;
  const saved = ls.get(FORM_KEY, null) || {};
  const timers = [];
  const reduce = prefersReducedMotion();

  const nick = h('input', { class: 'input', id: 'ch-an-nick', name: 'nick', maxlength: '24', autocomplete: 'off', value: saved.nick || store.me.get().nick || '' });

  const inputs = {};
  const sliderRows = SLIDERS.map((sl) => {
    const v0 = Number.isFinite(saved[sl.id]) ? saved[sl.id] : sl.def;
    const id = 'ch-an-' + sl.id;
    const input = h('input', { class: 'ch-range', type: 'range', id, name: sl.id, min: '0', max: '100', step: '5', value: String(v0) });
    const out = h('output', { class: 'ch-range-out', for: id });
    const sync = () => {
      const v = Number(input.value);
      const w = wordFor(sl, v);
      out.textContent = '';
      out.append(h('span', { class: 'num' }, String(v)), ' · ', w);
      input.setAttribute('aria-valuetext', `${v}: ${w}`);
      input.style.setProperty('--v', v + '%');
    };
    input.addEventListener('input', sync);
    sync();
    inputs[sl.id] = input;
    return h('div', { class: 'ch-range-row' },
      h('div', { class: 'ch-range-top' },
        h('label', { for: id }, icon(sl.icon, { size: 16 }), sl.label),
        out,
      ),
      input,
    );
  });

  const role0 = [1, 2, 3, 4, 5].includes(saved.role) ? saved.role : 2;
  const roleInputs = [];
  const roles = h('fieldset', { class: 'ch-roles' },
    h('legend', { class: 'label' }, 'En çok oynadığın rol'),
    h('div', { class: 'ch-roles-row' },
      ROLES.map((r) => {
        const id = `ch-an-role-${r.id}`;
        const inp = h('input', { class: 'sr-only ch-role-in', type: 'radio', name: 'ch-an-role', id, value: String(r.id), checked: r.id === role0 });
        roleInputs.push(inp);
        return h('div', { class: 'ch-role' },
          inp,
          h('label', { for: id, class: 'ch-role-lb' }, h('span', { class: 'num ch-role-n' }, String(r.id)), h('span', { class: 'ch-role-name' }, r.label), h('span', { class: 'ch-role-sub' }, r.sub)),
        );
      }),
    ),
  );

  const submit = h('button', { class: 'btn primary lg block', type: 'submit', id: 'ch-an-go' }, icon('target', { size: 20 }), 'Analiz et');
  const form = h('form', { class: 'panel ch-an-form stack', id: 'ch-an-form', autocomplete: 'off', 'aria-labelledby': 'ch-an-title' },
    h('div', { class: 'stack ch-an-formhead' },
      h('span', { class: 'eyebrow' }, 'Kendi DOG analizini çıkar'),
      h('h2', { class: 'h2', id: 'ch-an-title' }, 'Dürüst ol. Radar anlıyor.'),
      h('p', { class: 'small muted' }, 'Tamamen tarayıcında, yapay zekâsız ve deterministik: aynı cevaplar hep aynı sonucu verir. Hiçbir replay incelenmedi.'),
    ),
    h('div', { class: 'field' }, h('label', { for: 'ch-an-nick' }, 'Takma adın'), nick),
    h('div', { class: 'ch-ranges' }, sliderRows),
    roles,
    submit,
  );

  const community = h('div', { class: 'panel tight ch-an-community' });
  const result = h('div', { class: 'ch-an-result', 'aria-live': 'polite' });

  // ---- boş durum
  function renderEmpty() {
    clear(result);
    result.append(h('div', { class: 'panel ch-an-empty' },
      h('div', { class: 'ch-an-ghost', 'aria-hidden': 'true' },
        radarSvg([{ stats: { feed: 50, farm: 50, tilt: 50, chat: 50, harita: 50, takim: 50 }, color: '#7f7592', label: '' }], { values: false, animate: false, title: 'Boş radar', compact: true }),
      ),
      h('p', { class: 'h3' }, 'Radar seni bekliyor.'),
      h('p', { class: 'small muted' }, 'Soldaki kaydırıcıları dürüstçe ayarla, rolünü seç ve “Analiz et”e bas. Sonuç kartını kopyalayıp chat’te paylaşabilirsin.'),
    ));
  }

  // ---- tarama anı
  const SCAN_LINES = ['Replay’ler inceleniyor…', 'Ward’lar sayılıyor…', 'All chat kayıtları okunuyor…', 'Pause tuşu parmak izine bakılıyor…'];
  function renderScan(done) {
    clear(result);
    const line = h('p', { class: 'ch-scan-line' }, SCAN_LINES[0]);
    const bar = h('span', { class: 'ch-scan-fill' });
    result.append(h('div', { class: 'panel ch-an-scan' },
      h('div', { class: 'ch-scope ch-scope-sm', 'aria-hidden': 'true' }, h('div', { class: 'ch-scope-disc' }, h('span', { class: 'ch-scope-sweep' }), h('span', { class: 'ch-scope-cross' }), h('span', { class: 'ch-scope-core' }))),
      h('div', { class: 'stack ch-scan-text' },
        h('span', { class: 'eyebrow' }, 'DOG radarı taranıyor'),
        line,
        h('span', { class: 'ch-scan-bar' }, bar),
      ),
    ));
    SCAN_LINES.forEach((t, i) => { if (i) timers.push(setTimeout(() => { line.textContent = t; }, i * 260)); });
    requestAnimationFrame(() => { bar.style.width = '100%'; });
    timers.push(setTimeout(done, 1050));
  }

  // ---- sonuç
  function renderResult(res, nm) {
    clear(result);
    const t = res.best.t;
    const lines = report(res, nm);
    const tips = suggestions(res);
    const share = shareText(res, nm, lines);
    const shareEl = h('pre', { class: 'ch-share', tabindex: '0', 'aria-label': 'Paylaşılabilir sonuç metni' }, share);
    const copyBtn = h('button', { class: 'btn gold', type: 'button' }, icon('copy', { size: 18 }), 'Sonucu kopyala');
    copyBtn.addEventListener('click', async () => {
      const ok = await copyText(share, shareEl);
      if (ok) { ctx.sound.coin(); ctx.fx.toast('Sonuç kartı panoya kopyalandı. Chat’e yapıştır, DOG’ları say.', 'jade'); }
      else ctx.fx.toast('Pano izni yok; metni seçtik, elle kopyalayabilirsin.', 'ember');
    });
    const colT = t.color;
    const colMe = contrastColor(t.color, '#ff6a2b');
    const others = res.ranked.slice(1, 3);

    const card = h('article', { class: `ch-res panel raised frame${t.id === 'legend' ? ' is-legend' : ''}`, style: { '--ch-c': colT }, 'aria-label': 'Analiz sonucu' },
      h('div', { class: 'ch-res-top' },
        h('a', { class: 'ch-res-art', href: '#karakterler--' + t.id, title: `${t.name} sayfasına git` }, portraitEl(t, { alt: `${t.name} portresi` })),
        h('div', { class: 'stack ch-res-head' },
          h('span', { class: 'eyebrow' }, `${nm} · DOG analizi`),
          h('div', { class: 'ch-res-pct' }, h('span', { class: 'num' }, `%${res.best.pct}`), h('span', { class: 'ch-res-pct-l' }, 'benzerlik')),
          h('h3', { class: 'ch-res-name' }, t.name),
          h('p', { class: 'ch-card-title' }, t.title),
          h('div', { class: 'row ch-res-level' }, pawsLevelEl(res.level, { size: 18 }), h('span', { class: 'ch-res-level-t' }, res.level ? `DOG seviyesi ${res.level}/5 · ${LEVEL_NAMES[res.level]}` : LEVEL_NAMES[0])),
        ),
      ),
      h('div', { class: 'ch-res-grid' },
        h('div', { class: 'ch-res-radar' },
          h('div', { class: 'row ch-vs-legend' },
            h('span', { class: 'ch-swatch is-dashed', style: { '--ch-c': colMe } }, 'Sen'),
            h('span', { class: 'ch-swatch', style: { '--ch-c': colT } }, t.name),
          ),
          radarSvg([{ stats: t.stats, color: colT, label: t.name }, { stats: res.radar, color: colMe, label: nm }], { title: `${nm} ve ${t.name} radar karşılaştırması` }),
        ),
        h('div', { class: 'stack ch-res-text' },
          h('div', { class: 'ch-res-report' }, lines.map((ln, i) => h('p', { class: i === 0 ? 'ch-res-lead' : '' }, ln))),
          h('div', { class: 'stack ch-res-tips' },
            h('h4', { class: 'ch-lore-label' }, 'Gelişim önerisi'),
            h('ol', { class: 'ch-tips' }, tips.map((tx, i) => h('li', null, h('span', { class: 'ch-tip-n num' }, String(i + 1)), h('span', null, tx)))),
          ),
          h('div', { class: 'stack ch-res-others' },
            h('h4', { class: 'ch-lore-label' }, 'Yakın türler'),
            others.map((o) => h('a', { class: 'ch-near', href: '#karakterler--' + o.t.id, style: { '--ch-c': o.t.color } },
              h('span', { class: 'ch-near-name' }, o.t.name),
              h('span', { class: 'ch-near-track' }, h('span', { style: { width: o.pct + '%' } })),
              h('span', { class: 'num ch-near-pct' }, `%${o.pct}`),
            )),
          ),
        ),
      ),
      h('div', { class: 'stack ch-res-share' },
        h('h4', { class: 'ch-lore-label' }, 'Paylaşılabilir sonuç kartı'),
        shareEl,
        h('div', { class: 'row' },
          copyBtn,
          h('a', { class: 'btn ghost', href: '#karakterler--' + t.id }, icon('arrowRight', { size: 18 }), 'Tür sayfası'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { ctx.sound.click(); renderEmpty(); form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); nick.focus({ preventScroll: true }); } }, icon('refresh', { size: 18 }), 'Yeniden analiz'),
        ),
      ),
    );
    result.append(card);
  }

  // ---- topluluk dağılımı
  const unsubFans = env.onFans((fans) => {
    const dist = agg.distribution(fans, 'analiz');
    const total = Object.values(dist).reduce((s, n) => s + n, 0);
    clear(community);
    community.append(h('div', { class: 'panel-head' }, h('h3', { class: 'ch-lore-label' }, 'Topluluk radarı'), h('span', { class: 'badge' }, `${fmtNum(total)} analiz`)));
    if (!total) {
      community.append(h('p', { class: 'small dim' }, 'Henüz kimse analiz olmadı. İlk DOG sen ol.'));
      return;
    }
    const rows = Object.entries(dist).map(([id, n]) => ({ t: byId(id), n })).filter((x) => x.t).sort((a, b) => b.n - a.n).slice(0, 5);
    community.append(h('ul', { class: 'ch-dist' }, rows.map((x) => h('li', { style: { '--ch-c': x.t.color } },
      h('span', { class: 'ch-dist-name' }, x.t.name),
      h('span', { class: 'ch-near-track' }, h('span', { style: { width: Math.round((x.n / total) * 100) + '%' } })),
      h('span', { class: 'num ch-near-pct' }, `%${Math.round((x.n / total) * 100)}`),
    ))));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nm = cleanText(nick.value, 24) || store.me.get().nick || 'Anonim';
    const roleIn = roleInputs.find((r) => r.checked);
    const input = { role: roleIn ? Number(roleIn.value) : 2 };
    for (const sl of SLIDERS) input[sl.id] = Number(inputs[sl.id].value);
    ls.set(FORM_KEY, { ...input, nick: nm });
    const res = analyze(input);
    store.me.patch((d) => { d.picks.analiz = res.best.t.id; });
    ctx.sound.whoosh();
    submit.disabled = true;
    const done = () => {
      submit.disabled = false;
      renderResult(res, nm);
      if (res.best.t.id === 'legend') {
        ctx.sound.win();
        ctx.fx.stamp('1vDOQUZ', { variant: 'gold' });
      } else {
        ctx.sound.dogdogdog();
      }
      if (window.matchMedia('(max-width: 900px)').matches) result.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    };
    while (timers.length) clearTimeout(timers.pop());
    if (reduce) done();
    else renderScan(done);
  });

  el.append(h('div', { class: 'ch-an' }, h('div', { class: 'stack ch-an-left' }, form, community), result));
  renderEmpty();

  return () => {
    while (timers.length) clearTimeout(timers.pop());
    unsubFans();
  };
}
