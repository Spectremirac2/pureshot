// 24 Saat Maraton — yayın simülasyonu. Saat 00:00’dan 24:00’e akar (1 oyun saati ≈ 11 sn, kit createRunner:
// sekme gizlenince durur). Enerji, Chat Moodu ve Tilt dengede kalsın; maç at, çay iç, chat’e cevap ver, mola ver
// ya da 1vDOQUZ dene. Olay kartları (src/data/maraton.js) saati durdurur ve seçim ister.
// Enerji 0 → yayın biter. 24:00 → “Maraton tamam!” (yayıncının en kısa yayını zaten 24 saat).
// Skor = zirve izleyici; 24:00’e ulaşılamazsa zirve × yayınlanan saat / 24.
// Simülasyon çekirdeği (createSim) DOM’suzdur: denge testleri geliştirme kancasıyla tarayıcıda koşar.
// Belge: docs/oyunlar/maraton.md

import './maraton.css';
import { h, clear, fmtNum, clamp, pick, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { itemIconUrl, heroPortraitUrl } from '../../core/assets.js';
import { MR_EVENTS, MR_CHAT, MR_USERS, MR_TITLES } from '../../data/maraton.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, submitResult, revealInView, isTyping, tok, memeText } from './kit.js';
import { pbNote, addPbNote, haptic } from './juice.js';

// ------------------------------------------------------------------ denge
const SEC_PER_HOUR = 11; // gerçek saniye / oyun saati → 24 saat ≈ 4,4 dk (+ olay kartları)
const DAY = 24;
const V0 = 1000; // taban izleyici
const START = { energy: 100, mood: 62, tilt: 8, mmr: 5000, viewers: 950 };
const MATCH_LEN = [0.72, 0.92]; // saat (≈ 43–55 dk)
const CD = { tea: 2, chat: 0.6, rest: 3, quad: 3 }; // bekleme (oyun saati)
const REST_H = 0.5; // “5 dk” mola aslında yarım saat
const IDLE_GRACE = 0.2; // maç arası bu kadar sürerse chat sıkılmaya başlar
const EVENT_GAP = [1.7, 2.7];
const DRAIN = { match: 6.6, idle: 4.6 }; // enerji / saat
const TEA = { base: 16, window: 6, fade: 0.15, min: 0.4 };
const REST = { e: 56, t: 20 }; // mola boyunca / saat
const LOW_E = 22; // bu enerjinin altında açık uyarı (yalnızca arayüz; simülasyona etkisi yok)

// İzleyici gün eğrisi: gece düşer, sabah dipte, akşam en yüksek
const CURVE = [[0, 0.95], [3, 0.62], [6, 0.45], [9, 0.55], [12, 0.7], [15, 0.78], [18, 0.92], [21, 1.12], [24, 1.2]];
function dayCurve(hr) {
  for (let i = 1; i < CURVE.length; i++) {
    const [h1, v1] = CURVE[i];
    const [h0, v0] = CURVE[i - 1];
    if (hr <= h1) {
      const t = (hr - h0) / (h1 - h0);
      return v0 + (v1 - v0) * (0.5 - Math.cos(Math.PI * t) / 2);
    }
  }
  return CURVE[CURVE.length - 1][1];
}

const FIXED = MR_EVENTS.filter((e) => typeof e.at === 'number').sort((a, b) => a.at - b.at);
const RANDOM = MR_EVENTS.filter((e) => typeof e.at !== 'number');

// ------------------------------------------------------------------ simülasyon çekirdeği (DOM yok)
/**
 * createSim({ rnd, on }) → { s, step(dtSaat), act(id), can(id), choose(i), resume(), winChance(), quadChance(), teaGain(), score() }
 * on(tür, veri): 'matchStart' | 'matchEnd' | 'dog' | 'quad' | 'tea' | 'reply' | 'rest' | 'away' | 'awayEnd' | 'event' | 'end'
 */
export function createSim({ rnd = Math.random, on = () => {} } = {}) {
  const rr = (a, b) => a + rnd() * (b - a);
  const s = {
    hour: 0,
    energy: START.energy,
    mood: START.mood,
    tilt: START.tilt,
    mmr: START.mmr,
    viewers: START.viewers,
    peak: START.viewers,
    peakHour: 0,
    hype: 0,
    fame: 0,
    match: null,
    away: null,
    deferAway: 0,
    nextWinMod: 0,
    idleSince: 0,
    cd: { tea: 0, chat: 0, rest: 0, quad: 0 },
    teaTimes: [],
    nextEventAt: rr(1.3, 2.1),
    used: new Set(),
    pending: null,
    over: null,
    log: [],
    stats: { wins: 0, losses: 0, dogs: 0, teas: 0, chats: 0, breaks: 0, quadOk: 0, quadFail: 0, events: 0, streak: 0, bestStreak: 0, mmr0: START.mmr, minEnergy: START.energy, idleH: 0 },
  };

  const fix = () => {
    s.energy = clamp(s.energy, 0, 100);
    s.mood = clamp(s.mood, 0, 100);
    s.tilt = clamp(s.tilt, 0, 100);
    s.hype = clamp(s.hype, 0, 3);
    s.fame = clamp(s.fame, 0, 2);
    s.stats.minEnergy = Math.min(s.stats.minEnergy, s.energy);
  };

  const idle = () => !s.match && !s.away;
  const bored = () => idle() && s.hour - s.idleSince > IDLE_GRACE;

  function drainRate() {
    if (s.away) return 0;
    let r = s.match ? DRAIN.match : DRAIN.idle;
    if (s.hour >= 2 && s.hour < 8) r *= 1.25; // gece yorgunluğu
    r *= 1 + Math.max(0, s.hour - 12) / 36; // maraton yorgunluğu (24:00’te ×1,33)
    if (s.tilt > 60) r *= 1.1;
    // Lobide uzun beklemek uyutur: 30 dk’dan sonra boşta geçen her saat yorgunluğu artırır (en çok ×2,2)
    if (!s.match) r *= 1 + Math.min(1.2, Math.max(0, s.hour - s.idleSince - 0.5) * 0.6);
    return r;
  }

  function viewerTarget() {
    const moodF = 0.35 + 1.25 * (s.mood / 100);
    const st = s.away ? 0.72 : bored() ? 0.88 : 1;
    const finale = s.hour >= 22 ? 1 + (s.hour - 22) * 0.12 : 1;
    return V0 * dayCurve(s.hour) * moodF * (1 + s.fame) * (1 + s.hype) * st * finale;
  }

  function teaCount() {
    return s.teaTimes.filter((t) => s.hour - t < TEA.window).length;
  }
  function teaGain() {
    return Math.round(TEA.base * Math.max(TEA.min, 1 - TEA.fade * teaCount()));
  }

  function winChance(m = s.match) {
    const mod = m ? m.winMod : s.nextWinMod;
    return clamp(0.58 - Math.max(0, s.tilt - 20) * 0.0035 + (s.energy < 25 ? -0.1 : 0) + mod, 0.08, 0.92);
  }
  function quadChance() {
    return clamp(0.4 - s.tilt * 0.003 + (s.energy - 50) * 0.002 + (s.mood - 50) * 0.001, 0.1, 0.6);
  }

  function startAway(minutes, kind, label) {
    if (s.match) { s.deferAway += minutes; return; }
    const until = Math.max(s.away ? s.away.until : s.hour, s.hour) + minutes / 60;
    s.away = { kind, until, len: minutes / 60, label, eRate: kind === 'rest' ? REST.e : 0, tRate: kind === 'rest' ? REST.t : 0 };
    on('away', { kind, minutes });
  }

  function dogMoment(src) {
    s.stats.dogs++;
    s.mood += 10;
    s.hype += 0.35;
    s.fame += 0.015;
    s.tilt += 6;
    if (s.match) s.match.winMod -= 0.08;
    fix();
    on('dog', { src });
  }

  /** Olay/aksiyon etkisini uygular; gerçekleşen farkları döndürür. */
  function applyFx(fx = {}) {
    const before = { e: s.energy, m: s.mood, t: s.tilt, mmr: s.mmr, v: s.viewers };
    if (fx.e) s.energy += fx.e;
    if (fx.m) s.mood += fx.m;
    if (fx.t) s.tilt += fx.t;
    if (fx.mmr) s.mmr += fx.mmr;
    if (fx.hype) s.hype += fx.hype;
    if (fx.fame) s.fame += fx.fame;
    if (fx.v) s.viewers = Math.max(50, s.viewers * (1 + fx.v));
    if (fx.win) {
      if (s.match) s.match.winMod += fx.win;
      else s.nextWinMod += fx.win;
    }
    fix();
    if (fx.dog) dogMoment('event');
    if (fx.away) startAway(fx.away, 'away', 'Yayın arası');
    return {
      e: Math.round(s.energy - before.e),
      m: Math.round(s.mood - before.m),
      t: Math.round(s.tilt - before.t),
      mmr: Math.round(s.mmr - before.mmr),
      v: Math.round(s.viewers - before.v),
      hype: fx.hype || 0,
      win: fx.win || 0,
      away: fx.away || 0,
      dog: fx.dog || 0,
    };
  }

  function eligible(ev) {
    if (s.used.has(ev.id)) return false;
    if (ev.phase === 'match' && !(s.match && s.match.prog < 0.8)) return false;
    if (ev.phase === 'idle' && s.match) return false;
    if (ev.hours && !(s.hour >= ev.hours[0] && s.hour < ev.hours[1])) return false;
    const n = ev.need || {};
    if (n.energyBelow != null && !(s.energy < n.energyBelow)) return false;
    if (n.tiltAbove != null && !(s.tilt > n.tiltAbove)) return false;
    if (n.dogs != null && s.stats.dogs < n.dogs) return false;
    // Uzun yayın arası isteyen “her an” olayları maç ortasında gelmesin (erteleme yerine başka olay)
    if (s.match && ev.phase === 'any' && ev.choices.every((c) => (c.fx && c.fx.away) || (c.ok && c.ok.fx.away))) return false;
    return true;
  }

  function trigger(ev) {
    s.used.add(ev.id);
    s.stats.events++;
    s.pending = { ev, chosen: null };
    on('event', { ev });
  }

  function tryRandomEvent() {
    if (s.away) { s.nextEventAt = s.hour + 0.25; return; }
    const pool = RANDOM.filter(eligible);
    if (!pool.length) { s.nextEventAt = s.hour + 0.3; return; }
    // Maçtaysak maç olaylarına ağırlık ver
    const w = pool.map((e) => (e.weight || 1) * (s.match && e.phase === 'match' ? 1.8 : 1));
    let r = rnd() * w.reduce((a, b) => a + b, 0);
    let ev = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { ev = pool[i]; break; } }
    s.nextEventAt = s.hour + rr(EVENT_GAP[0], EVENT_GAP[1]);
    trigger(ev);
  }

  function endMatch() {
    const m = s.match;
    s.match = null;
    s.idleSince = s.hour;
    const win = m.quad === 'ok' || rnd() < winChance(m);
    const d = 21 + Math.floor(rnd() * 9);
    const st = s.stats;
    if (win) {
      s.mmr += d;
      s.mood += 7;
      s.tilt -= 12;
      s.hype += 0.18;
      s.fame += 0.01;
      st.wins++;
      st.streak = Math.max(1, st.streak + 1);
      if (st.streak >= 3) s.hype += 0.2;
    } else {
      s.mmr -= d;
      s.mood -= 5;
      s.tilt += 9;
      st.losses++;
      st.streak = Math.min(-1, st.streak - 1);
      if (st.streak <= -3) s.tilt += 5;
    }
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    s.log.push({ win, dog: m.dog, quad: m.quad });
    fix();
    on('matchEnd', { win, d, quad: m.quad, streak: st.streak });
    if (s.deferAway) { const mins = s.deferAway; s.deferAway = 0; startAway(mins, 'away', 'Yayın arası'); }
  }

  function end(why) {
    if (s.over) return;
    s.over = why;
    on('end', { why });
  }

  function step(dt) {
    if (s.over || s.pending) return;
    const h0 = s.hour;
    s.hour = Math.min(DAY, s.hour + dt);
    if (idle()) s.stats.idleH += s.hour - h0; // lobide boş geçen süre (bitiş nedeni için)
    s.energy -= drainRate() * dt;
    if (s.away) { s.energy += s.away.eRate * dt; s.tilt -= s.away.tRate * dt; }
    const target = s.match ? 66 : s.away ? 42 : bored() ? 34 : 55;
    s.mood += (target - s.mood) * (1 - Math.exp(-0.55 * dt));
    if (s.tilt > 50) s.mood -= (s.tilt - 50) * 0.12 * dt;
    if (s.energy < 25) s.mood -= 4 * dt;
    s.tilt -= (s.match ? 5 : 8) * dt;
    s.hype *= Math.exp(-dt / 0.9);
    fix();
    const tv = viewerTarget();
    s.viewers += (tv - s.viewers) * (1 - Math.exp(-dt / 0.3));
    if (s.viewers > s.peak) { s.peak = s.viewers; s.peakHour = s.hour; }

    if (s.match) {
      const m = s.match;
      m.prog += dt / m.len;
      if (!m.dogRolled && m.prog >= m.dogAt) {
        m.dogRolled = true;
        if (rnd() < 0.3 + s.tilt * 0.002) { m.dog = true; dogMoment('match'); }
      }
      if (m.prog >= 1) endMatch();
    }
    if (s.away && s.hour >= s.away.until) {
      const k = s.away.kind;
      s.away = null;
      s.idleSince = s.hour;
      on('awayEnd', { kind: k });
    }
    if (s.energy <= 0) { end('asleep'); return; }
    if (s.hour >= DAY) { end('done'); return; }
    for (const ev of FIXED) {
      if (!s.used.has(ev.id) && h0 < ev.at && s.hour >= ev.at) { trigger(ev); return; }
    }
    if (s.hour >= s.nextEventAt) tryRandomEvent();
  }

  function can(id) {
    if (s.over || s.pending) return false;
    if (id === 'match') return idle();
    if (id === 'tea') return s.hour >= s.cd.tea;
    if (id === 'chat') return s.hour >= s.cd.chat;
    if (id === 'rest') return idle() && s.hour >= s.cd.rest;
    if (id === 'quad') return !!(s.match && !s.match.quad && s.match.prog < 0.85 && s.hour >= s.cd.quad);
    return false;
  }

  function act(id) {
    if (!can(id)) return null;
    const st = s.stats;
    if (id === 'match') {
      s.match = { len: rr(MATCH_LEN[0], MATCH_LEN[1]), prog: 0, winMod: s.nextWinMod, dogAt: rr(0.3, 0.75), dogRolled: false, dog: false, quad: null };
      s.nextWinMod = 0;
      s.energy -= 1;
      fix();
      on('matchStart', {});
      return { id };
    }
    if (id === 'tea') {
      const n = teaCount();
      const gain = teaGain();
      s.energy += gain;
      s.tilt += n >= 2 ? 3 : -2; // çok çay: çarpıntı
      s.mood += 2;
      s.cd.tea = s.hour + CD.tea;
      s.teaTimes.push(s.hour);
      st.teas++;
      fix();
      on('tea', { gain, n });
      return { id, gain };
    }
    if (id === 'chat') {
      s.mood += s.match ? 7 : 10;
      s.energy -= 2;
      if (s.match) s.match.winMod -= 0.02; // chat’e bakarken bir creep kaçtı
      s.cd.chat = s.hour + CD.chat;
      st.chats++;
      fix();
      on('reply', {});
      return { id };
    }
    if (id === 'rest') {
      s.tilt -= 8;
      s.cd.rest = s.hour + CD.rest;
      st.breaks++;
      fix();
      startAway(REST_H * 60, 'rest', 'Mola');
      on('rest', {});
      return { id };
    }
    if (id === 'quad') {
      const p = quadChance();
      const ok = rnd() < p;
      s.cd.quad = s.hour + CD.quad;
      s.energy -= 6;
      if (ok) {
        s.match.quad = 'ok';
        s.hype += 1.0;
        s.mood += 18;
        s.fame += 0.08;
        st.quadOk++;
      } else {
        s.match.quad = 'fail';
        s.tilt += 22;
        s.mood -= 4;
        s.hype += 0.15;
        s.match.winMod -= 0.25;
        st.quadFail++;
      }
      fix();
      on('quad', { ok, p });
      return { id, ok };
    }
    return null;
  }

  /** Bekleyen olayda seçim: { text, fx (gerçekleşen farklar), ok (şanslı seçimde) } */
  function choose(i) {
    const p = s.pending;
    if (!p || p.chosen) return null;
    const c = p.ev.choices[i];
    if (!c) return null;
    let text = c.text;
    let fx = c.fx;
    let ok = null;
    if (c.chance != null) {
      ok = rnd() < c.chance;
      const branch = ok ? c.ok : c.no;
      text = branch.text;
      fx = branch.fx;
    }
    const d = applyFx(fx);
    p.chosen = { i, text, d, ok };
    return p.chosen;
  }

  function resume() {
    if (!s.pending) return;
    s.pending = null;
    if (s.energy <= 0) end('asleep');
  }

  function score() {
    const peak = Math.round(s.peak);
    return s.over === 'done' ? peak : Math.round(peak * Math.min(1, s.hour / DAY));
  }

  return { s, step, act, can, choose, resume, winChance, quadChance, teaGain, score, viewerTarget };
}

// ------------------------------------------------------------------ biçimleme
const pad2 = (n) => String(n).padStart(2, '0');
function clockText(hr) {
  const mins = Math.min(DAY * 60, Math.floor(hr * 60 + 1e-6));
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}
function durText(hours) {
  const m = Math.max(0, Math.ceil(hours * 60 - 1e-6));
  if (m >= 60) return `${Math.floor(m / 60)} sa${m % 60 ? ` ${m % 60} dk` : ''}`;
  return `${m} dk`;
}
const signed = (n) => (n > 0 ? `+${fmtNum(n)}` : n < 0 ? `−${fmtNum(-n)}` : '0');

export const meta = {
  id: 'maraton',
  name: '24 Saat Maraton',
  short: 'Maraton',
  icon: 'hourglass',
  color: 'var(--ember)',
  kind: 'Yayın · Strateji',
  cat: 'yayin',
  blurb: 'Yirmi dört saatlik yayını ayakta tut: enerji, chat ve MMR dengede kalsın.',
  lore: '24 saat bitiş çizgisi değil; en kısa yayın. Çayı demle, DOG’lara hazır ol.',
  time: '~5 dk',
  diff: 2,
  unit: 'izleyici',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} izleyici`,
  rules: [
    'Saat 00:00’dan 24:00’e akar (1 oyun saati ≈ 11 sn). Enerji sıfırlanırsa yayın biter: uyuya kaldın.',
    'Maç at: MMR ve hype getirir ama enerji yakar. Takım arkadaşı DOG’larsa “DOG DOG DOG” anı chat’i coşturur.',
    'Çay iç (enerji), chat’e cevap ver (mood), mola ver (enerji ve tilt; izleyici düşer). Hepsinin bekleme süresi var.',
    '1vDOQUZ denemesi: maç sırasında büyük risk. Tutarsa izleyici patlar ve maç senin; tutmazsa tilt tavan.',
    'Olay kartında seç; kart açıkken saat durur. Skor = zirve izleyici; 24:00’e varamazsan yayınlanan saat oranında.',
    'Yayıncının en kısa yayını 24 saat: yani 24:00 bitiş çizgisi değil, asgari süre.',
  ],
  keys: [['1', 'Maç at'], ['2', 'Çay iç'], ['3', 'Chat’e cevap'], ['4', 'Mola ver'], ['5', '1vDOQUZ denemesi'], ['1 2', 'Olay kartında seçim'], ['P', 'Duraklat / devam']],
};

const ACTIONS = [
  { id: 'match', key: '1', name: 'Maç at', icon: 'swords' },
  { id: 'tea', key: '2', name: 'Çay iç', icon: 'tea' },
  { id: 'chat', key: '3', name: 'Chat’e cevap', icon: 'chat' },
  { id: 'rest', key: '4', name: 'Mola ver', icon: 'pause' },
  { id: 'quad', key: '5', name: '1vDOQUZ', icon: 'crown' },
];

const METERS = [
  { id: 'energy', label: 'Enerji', icon: 'bolt', good: 'high' },
  { id: 'mood', label: 'Chat Moodu', icon: 'chat', good: 'high' },
  { id: 'tilt', label: 'Tilt', icon: 'flame', good: 'low' },
];

// Etki çipleri: anahtar → [etiket, iyi yön]
const FX_LABEL = { e: ['Enerji', 1], m: ['Chat', 1], t: ['Tilt', -1], mmr: ['MMR', 1], v: ['İzleyici', 1], hype: ['Hype', 1], fame: ['Takipçi', 1], win: ['Maç şansı', 1], away: ['Yayın arası', 0], dog: ['DOG anı', 0] };

function fxChips(fx, { exact = false } = {}) {
  const out = [];
  for (const k of ['e', 'm', 't', 'mmr', 'v', 'hype', 'fame', 'win', 'away', 'dog']) {
    const v = fx[k];
    if (!v) continue;
    const [label, dirGood] = FX_LABEL[k];
    let text;
    let tone;
    if (k === 'away') { text = `${label} ${v} dk`; tone = 'neutral'; } else if (k === 'dog') { text = 'DOG DOG DOG'; tone = 'dog'; } else {
      const up = v > 0;
      tone = dirGood === 0 ? 'neutral' : (up ? 1 : -1) * dirGood > 0 ? 'good' : 'bad';
      if (exact && (k === 'e' || k === 'm' || k === 't' || k === 'mmr' || k === 'v')) text = `${label} ${signed(v)}`;
      else if (k === 'win') text = `${label} ${up ? '↑' : '↓'}`;
      else text = `${label} ${up ? '↑' : '↓'}`;
    }
    out.push(h('span', { class: `gm-mr-chip is-${tone}` }, text));
  }
  return out;
}

function artNode(art, cls = '') {
  if (art && art.item) {
    const url = itemIconUrl(art.item);
    if (url) return h('span', { class: `gm-mr-art is-item ${cls}` }, h('img', { src: url, alt: '', draggable: 'false', decoding: 'async' }));
  }
  if (art && art.hero) {
    const url = heroPortraitUrl(art.hero);
    if (url) return h('span', { class: `gm-mr-art is-hero ${cls}` }, h('img', { src: url, alt: '', draggable: 'false', decoding: 'async' }));
  }
  return h('span', { class: `gm-mr-art is-icon ${cls}` }, icon((art && art.icon) || 'sparkle', { size: 30 }));
}

// ------------------------------------------------------------------ oyun
export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();

  // ---------------------------------------------------------------- HUD
  const sClock = hudStat('Saat', '00:00', { ico: 'clock', cls: 'gm-stat-time', compact: true });
  const clockBar = h('span', { class: 'gm-timebar', 'aria-hidden': 'true' }, h('span'));
  sClock.el.appendChild(clockBar);
  const sViewers = hudStat('İzleyici', fmtNum(START.viewers), { ico: 'eye', cls: 'gm-stat-score gm-mr-hud-v' });
  const sPeak = hudStat('Zirve', fmtNum(START.viewers), { ico: 'crown' });
  const sMmr = hudStat('MMR', fmtNum(START.mmr), { ico: 'medal' });
  L.hud.append(sClock.el, sViewers.el, sPeak.el, sMmr.el);

  // ---------------------------------------------------------------- sahne
  const skyMark = h('span', { class: 'gm-mr-sky-mark', 'aria-hidden': 'true' }, icon('moon', { size: 14 }));
  const skyFill = h('span', { class: 'gm-mr-sky-fill', 'aria-hidden': 'true' });
  const sky = h('div', { class: 'gm-mr-sky', role: 'img', 'aria-label': 'Yayın saati 00:00' },
    h('span', { class: 'gm-mr-sky-track' }, skyFill, skyMark),
    h('span', { class: 'gm-mr-sky-ticks', 'aria-hidden': 'true' }, ['00', '06', '12', '18', '24'].map((t) => h('span', null, t))),
  );
  const pauseBtn = h('button', { class: 'btn ghost sm icon gm-mr-pause', type: 'button', 'aria-label': 'Duraklat (P)', title: 'Duraklat (P)' }, icon('pause', { size: 16 }));
  const live = h('span', { class: 'badge live gm-mr-live' }, 'CANLI');
  const statusText = h('span', { class: 'gm-mr-status-text' }, 'Yayın başlamak üzere');
  const statusSub = h('span', { class: 'gm-mr-status-sub' }, '');
  const statusBar = h('span', { class: 'gm-mr-status-bar', 'aria-hidden': 'true' }, h('span'));
  const status = h('div', { class: 'gm-mr-status', dataset: { mode: 'idle' } },
    h('span', { class: 'gm-mr-status-ico', 'aria-hidden': 'true' }),
    h('span', { class: 'gm-mr-status-body' }, statusText, statusSub),
    statusBar,
  );
  const top = h('div', { class: 'gm-mr-top' }, live, sky, pauseBtn);

  const meterEls = {};
  const meters = h('div', { class: 'gm-mr-meters' }, METERS.map((m) => {
    const fill = h('span', { class: 'gm-mr-meter-fill' });
    const val = h('span', { class: 'gm-mr-meter-val num' }, '0');
    const delta = h('span', { class: 'gm-mr-meter-delta num', 'aria-hidden': 'true' });
    const box = h('div', { class: `gm-mr-meter is-${m.id}`, role: 'meter', 'aria-label': m.label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
      h('span', { class: 'gm-mr-meter-label' }, icon(m.icon, { size: 14 }), m.label),
      val,
      delta,
      h('span', { class: 'gm-mr-meter-track' }, fill),
    );
    meterEls[m.id] = { box, fill, val, delta, last: null, shown: null };
    return box;
  }));

  const chatList = h('ol', { class: 'gm-mr-chat-list', 'aria-hidden': 'true' });
  const chatCount = h('span', { class: 'gm-mr-chat-count num' }, fmtNum(START.viewers));
  const chat = h('section', { class: 'gm-mr-chat', 'aria-label': 'Sohbet akışı' },
    h('header', { class: 'gm-mr-chat-head' },
      h('span', { class: 'gm-mr-chat-title' }, icon('chat', { size: 14 }), 'Chat'),
      h('span', { class: 'gm-mr-chat-viewers' }, icon('eye', { size: 12 }), chatCount),
    ),
    chatList,
  );

  const actBtns = {};
  const actions = h('div', { class: 'gm-mr-actions', role: 'group', 'aria-label': 'Aksiyonlar' }, ACTIONS.map((a) => {
    const sub = h('span', { class: 'gm-mr-act-sub' }, '');
    const cdFill = h('span', { class: 'gm-mr-act-cd', 'aria-hidden': 'true' });
    const b = h('button', { class: `gm-mr-act is-${a.id}`, type: 'button', dataset: { act: a.id } },
      cdFill,
      h('span', { class: 'kbd gm-mr-act-key' }, a.key),
      h('span', { class: 'gm-mr-act-ico', 'aria-hidden': 'true' }, icon(a.icon, { size: 24 })),
      h('span', { class: 'gm-mr-act-name' }, memeText(a.name)),
      sub,
    );
    b.addEventListener('click', () => doAct(a.id));
    actBtns[a.id] = { b, sub, cdFill, lastSub: '' };
    return b;
  }));
  const deck = h('div', { class: 'gm-mr-deck' }, actions);

  const logList = h('ol', { class: 'gm-mr-log-list' });
  const logBox = h('div', { class: 'gm-mr-log' },
    h('span', { class: 'gm-mr-log-title' }, 'Maçlar'),
    logList,
    h('span', { class: 'gm-mr-log-empty xsmall dim' }, 'Henüz maç yok'),
  );

  const field = h('div', { class: 'gm-mr-field', dataset: { state: 'intro' } },
    h('div', { class: 'gm-mr-a-top' }, top, status),
    meters,
    chat,
    deck,
    logBox,
  );
  L.stage.appendChild(field);

  // ---------------------------------------------------------------- durum
  let state = 'intro'; // intro | play | end | dead
  let sim = null;
  let runner = null;
  let closeOverlay = null;
  let closePause = null;
  let paused = false;
  let hotkeysOff = false;
  let speed = 1;
  let shownViewers = START.viewers;
  let nextChatAt = 0;
  let evCard = null;
  let evTimer = 0;
  let lastMode = '';
  let lowWarned = false;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };

  function say(m) { L.live.textContent = m; }
  /** HUD istatistikleri + sahne birlikte sığıyorsa ikisini de görünür alana getirir (yoksa sahnenin üstü öncelikli). */
  function revealPlay() {
    if (!field.isConnected) return;
    const css = (n, f) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)); return Number.isFinite(v) ? v : f; };
    const minTop = css('--hud-h', 56) + 8;
    const maxBottom = window.innerHeight - css('--bar-h', 84) - 8;
    const fr = field.getBoundingClientRect();
    const hr = L.hud.getBoundingClientRect();
    const top = fr.bottom - hr.top <= maxBottom - minTop ? hr.top : fr.top;
    let dy = 0;
    if (fr.bottom > maxBottom) dy = fr.bottom - maxBottom;
    if (top - dy < minTop) dy = top - minTop;
    if (Math.abs(dy) < 2) return;
    try { window.scrollBy({ top: dy, behavior: reduced ? 'instant' : 'smooth' }); } catch { window.scrollBy(0, dy); }
  }
  function restart(elm, cls) { elm.classList.remove(cls); void elm.offsetWidth; elm.classList.add(cls); }
  function pt(elm, fy = 0.3) { const r = elm.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * fy]; }

  // ---------------------------------------------------------------- chat
  let lastUser = '';
  function chatLine(kind, { text, user, me = false, burst = false } = {}) {
    const pool = MR_CHAT[kind] || MR_CHAT.match;
    let u = user || pick(MR_USERS);
    if (u === lastUser && !user) u = pick(MR_USERS);
    lastUser = u;
    const li = h('li', { class: `gm-mr-msg${me ? ' is-me' : ''}${kind === 'dog' ? ' is-dog' : ''}${kind === 'quad' ? ' is-quad' : ''}` },
      h('span', { class: 'gm-mr-msg-user', style: { '--uc': userColor(u) } }, me ? 'Yayıncı' : u),
      h('span', { class: 'gm-mr-msg-text' }, memeText(text || pick(pool))),
    );
    if (!reduced && !burst) li.classList.add('enter');
    chatList.appendChild(li);
    while (chatList.children.length > 14) chatList.firstChild.remove();
  }
  function userColor(u) {
    let n = 0;
    for (let i = 0; i < u.length; i++) n = (n * 31 + u.charCodeAt(i)) >>> 0;
    return ['#ff9a3d', '#43d6a0', '#8b7cff', '#e9b949', '#62c8ff', '#ff7a8b', '#b7f25a', '#f6d98a'][n % 8];
  }
  function burst(kind, n, delay = 140) {
    for (let i = 0; i < n; i++) later(() => { if (state === 'play' || state === 'end') chatLine(kind, { burst: true }); }, i * delay);
  }
  function ambientKind() {
    const s = sim.s;
    const r = Math.random();
    if (s.hype > 0.6 && r < 0.35) return 'hype';
    if (s.hour >= 22 && r < 0.4) return 'final';
    if (s.away) return 'away';
    if (s.energy < 25 && r < 0.4) return 'low';
    if (s.tilt > 55 && r < 0.4) return 'tilt';
    if (s.hour >= 1 && s.hour < 6 && r < 0.35) return 'night';
    if (s.hour >= 6 && s.hour < 10 && r < 0.3) return 'morning';
    return s.match ? 'match' : 'idle';
  }

  // ---------------------------------------------------------------- sinyaller
  function onSim(type, d) {
    if (state !== 'play') return;
    const s = sim.s;
    if (type === 'matchStart') {
      chatLine('match');
      ctx.sound.whoosh();
      say('Maç başladı.');
    } else if (type === 'matchEnd') {
      addLog(s.log[s.log.length - 1]);
      const [x, y] = pt(sMmr.el, 1);
      ctx.fx.floatText(`${d.win ? '+' : '−'}${d.d} MMR`, x, y, { color: d.win ? tok('--radiant') : tok('--dire'), size: 18 });
      sMmr.bump();
      if (d.win) { ctx.sound.good(); burst('win', 2); } else { ctx.sound.bad(); burst('loss', 2); }
      if (d.win && d.streak >= 3) {
        chatLine('hype', { text: `${d.streak} maçlık galibiyet serisi!` });
        if (d.streak === 3 || d.streak % 5 === 0) ctx.fx.stamp(`${d.streak} SERİ`, { variant: 'jade', ms: 900 });
      }
      say(d.win ? `Maç kazanıldı. MMR artı ${d.d}.` : `Maç kaybedildi. MMR eksi ${d.d}.`);
    } else if (type === 'dog') {
      ctx.fx.stamp('DOG DOG DOG');
      ctx.sound.dogdogdog();
      burst('dog', 4, 110);
      restart(field, 'is-dogflash');
      say('DOG DOG DOG! Takım arkadaşı DOG’ladı; chat coştu.');
    } else if (type === 'quad') {
      if (d.ok) {
        ctx.fx.stamp('1vDOQUZ', { variant: 'gold', ms: 1400 });
        ctx.sound.win();
        const [x, y] = pt(actBtns.quad.b, 0);
        ctx.fx.confetti(x, y, 60);
        burst('quad', 5, 120);
        say('1vDOQUZ! İzleyici patladı, maç senin.');
      } else {
        ctx.sound.bad();
        ctx.fx.shake(actBtns.quad.b);
        burst('quadFail', 2);
        say('1vDOQUZ denemesi tutmadı. Tilt yükseldi.');
      }
    } else if (type === 'tea') {
      ctx.sound.coin();
      chatLine('tea');
      const [x, y] = pt(meterEls.energy.box, 0.2);
      if (d.n >= 2) ctx.fx.floatText('çarpıntı', x + 40, y, { color: tok('--dire'), size: 14 });
      say(`Çay içildi: enerji artı ${d.gain}.`);
    } else if (type === 'reply') {
      ctx.sound.click();
      chatLine('reply', { me: true, text: pick(['Selam chat!', 'Soruna cevap: ward al!', 'Teşekkürler, iyi ki varsınız!', 'Bir maç daha, söz!', '24 saat en kısası, biliyorsunuz.', 'DOG DOG DOG demeyelim, hamleye bakalım.']) });
      later(() => { if (state === 'play') chatLine('reply'); }, 500);
    } else if (type === 'rest') {
      ctx.sound.click();
      chatLine('away', { text: '5 dk dedi…' });
      say('Mola verildi.');
    } else if (type === 'away') {
      if (d.kind !== 'rest') chatLine('away');
    } else if (type === 'awayEnd') {
      chatLine('idle', { text: d.kind === 'rest' ? 'geri geldi! 5 dk = 30 dk' : 'yayın geri geldi!' });
      ctx.sound.click();
    } else if (type === 'event') {
      showEvent(d.ev);
    } else if (type === 'end') {
      finish(d.why);
    }
  }

  function addLog(entry) {
    const li = h('li', { class: `gm-mr-pill ${entry.win ? 'is-w' : 'is-l'}`, title: entry.win ? 'Galibiyet' : 'Mağlubiyet' },
      entry.win ? 'G' : 'M',
      entry.dog ? h('i', { class: 'gm-mr-pill-dog', 'aria-hidden': 'true' }) : null,
      entry.quad === 'ok' ? h('i', { class: 'gm-mr-pill-quad', 'aria-hidden': 'true' }) : null,
    );
    logList.appendChild(li);
    logBox.classList.add('has');
    while (logList.children.length > 36) logList.firstChild.remove();
    logList.scrollLeft = logList.scrollWidth; // yalnızca yatay: sayfa kaymasın
  }

  // ---------------------------------------------------------------- aksiyon
  function doAct(id) {
    if (state !== 'play' || paused || !sim) return;
    if (sim.s.pending) return;
    const b = actBtns[id].b;
    if (!sim.can(id)) {
      ctx.sound.miss();
      if (!reduced) restart(b, 'nope');
      return;
    }
    restart(b, 'hit');
    sim.act(id);
    paint(0);
  }

  // ---------------------------------------------------------------- olay kartı
  function showEvent(ev) {
    ctx.sound.whoosh();
    actions.hidden = true;
    const s = sim.s;
    const choiceBtns = ev.choices.map((c, i) => {
      const chips = c.chance != null
        ? [h('span', { class: 'gm-mr-chip is-risk' }, `Risk · %${Math.round(c.chance * 100)} şans`)]
        : fxChips(c.fx || {});
      const b = h('button', { class: 'gm-mr-choice', type: 'button', dataset: { i: String(i) } },
        h('span', { class: 'kbd gm-mr-choice-key' }, String(i + 1)),
        h('span', { class: 'gm-mr-choice-body' },
          h('span', { class: 'gm-mr-choice-label' }, memeText(c.label)),
          h('span', { class: 'gm-mr-chips' }, chips),
        ),
      );
      b.addEventListener('click', () => pickChoice(i));
      return b;
    });
    const res = h('div', { class: 'gm-mr-ev-res', hidden: true });
    const card = h('article', { class: 'gm-mr-event', role: 'dialog', 'aria-label': ev.title },
      h('header', { class: 'gm-mr-ev-head' },
        artNode(ev.art),
        h('span', { class: 'gm-mr-ev-titles' },
          h('span', { class: 'gm-mr-ev-eyebrow' }, icon('bolt', { size: 12 }), `Olay · ${clockText(s.hour)} · saat durdu`),
          h('h3', { class: 'gm-mr-ev-title' }, memeText(ev.title)),
        ),
      ),
      h('p', { class: 'gm-mr-ev-text' }, memeText(ev.text)),
      h('div', { class: 'gm-mr-ev-choices' }, choiceBtns),
      res,
    );
    evCard = { card, choiceBtns, res, ev, done: false };
    field.dataset.ev = '1';
    deck.appendChild(card);
    if (!reduced) card.classList.add('enter');
    say(`Olay: ${ev.title}. ${ev.text} Seçenekler: 1, ${ev.choices[0].label}; 2, ${ev.choices[1] ? ev.choices[1].label : ''}.`);
    requestAnimationFrame(() => {
      revealInView(card);
      try { choiceBtns[0].focus({ preventScroll: true }); } catch { /* yok say */ }
    });
  }

  function pickChoice(i) {
    if (!evCard || evCard.done || state !== 'play') return;
    const out = sim.choose(i);
    if (!out) return;
    evCard.done = true;
    evCard.choiceBtns.forEach((b, j) => { b.disabled = true; b.classList.toggle('is-picked', j === i); });
    const tone = out.ok === true ? 'good' : out.ok === false ? 'bad' : '';
    const cont = h('button', { class: 'btn primary sm gm-mr-ev-go', type: 'button' }, icon('play', { size: 14 }), 'Devam');
    cont.addEventListener('click', closeEvent);
    evCard.res.replaceChildren(...[
      out.ok != null ? h('span', { class: `badge ${out.ok ? 'jade' : 'blood'}` }, out.ok ? 'Tuttu!' : 'Olmadı…') : null,
      h('p', { class: 'gm-mr-ev-out' }, memeText(out.text)),
      h('span', { class: 'gm-mr-chips' }, fxChips(out.d, { exact: true })),
      cont,
    ].filter(Boolean));
    evCard.res.dataset.tone = tone;
    evCard.res.hidden = false;
    if (out.ok === true) ctx.sound.good(); else if (out.ok === false) ctx.sound.bad(); else ctx.sound.click();
    say(out.text);
    paint(0);
    try { cont.focus({ preventScroll: true }); } catch { /* yok say */ }
    const card = evCard.card;
    requestAnimationFrame(() => revealInView(card));
    evTimer = later(closeEvent, 2600);
  }

  function closeEvent() {
    if (!evCard) return;
    if (evTimer) { clearTimeout(evTimer); timers.delete(evTimer); evTimer = 0; }
    evCard.card.remove();
    evCard = null;
    field.dataset.ev = '0';
    actions.hidden = false;
    if (sim && state === 'play') {
      sim.resume();
      // Mobilde kart sayfayı aşağı kaydırmış olabilir: sahnenin tamamı yeniden görünsün
      requestAnimationFrame(() => { if (state === 'play') revealPlay(); });
    }
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch { /* yok say */ }
  }

  // ---------------------------------------------------------------- çizim
  function levelOf(m, v) {
    if (m.good === 'high') return v >= 50 ? 'ok' : v >= 25 ? 'warn' : 'bad';
    return v <= 35 ? 'ok' : v <= 60 ? 'warn' : 'bad';
  }

  function paint(dt) {
    const s = sim.s;
    // HUD
    sClock.set(clockText(s.hour));
    clockBar.firstChild.style.transform = `scaleX(${s.hour / DAY})`;
    sClock.el.classList.toggle('low', s.energy < 20);
    shownViewers += (s.viewers - shownViewers) * (dt ? Math.min(1, dt * 5) : 1);
    sViewers.set(fmtNum(shownViewers));
    chatCount.textContent = fmtNum(shownViewers);
    sPeak.set(fmtNum(s.peak));
    sMmr.set(fmtNum(s.mmr));
    // gökyüzü
    const f = s.hour / DAY;
    skyFill.style.transform = `scaleX(${(1 - f).toFixed(4)})`;
    skyMark.style.left = `${(f * 100).toFixed(2)}%`;
    const day = s.hour >= 6 && s.hour < 19;
    if (skyMark.dataset.day !== String(day)) {
      skyMark.dataset.day = String(day);
      skyMark.replaceChildren(icon(day ? 'sun' : 'moon', { size: 14 }));
    }
    sky.setAttribute('aria-label', `Yayın saati ${clockText(s.hour)}`);
    // göstergeler
    for (const m of METERS) {
      const v = s[m.id];
      const me = meterEls[m.id];
      me.fill.style.transform = `scaleX(${(v / 100).toFixed(4)})`;
      const r = Math.round(v);
      if (me.shown !== r) {
        me.val.textContent = String(r);
        me.box.setAttribute('aria-valuenow', String(r));
        me.shown = r;
      }
      me.box.dataset.level = levelOf(m, v);
      if (me.last != null && Math.abs(v - me.last) >= 3) {
        const dlt = Math.round(v - me.last);
        me.delta.textContent = dlt > 0 ? `+${dlt}` : `−${-dlt}`;
        me.delta.dataset.tone = (dlt > 0) === (m.good === 'high') ? 'good' : 'bad';
        restart(me.delta, 'show');
      }
      me.last = v;
    }
    // durum satırı
    let mode;
    let text;
    let sub = '';
    let prog = 0;
    if (s.pending) { mode = 'event'; text = 'Karar anı'; sub = 'Saat durdu, olay kartında seçim yap'; } else if (s.match) {
      mode = 'match';
      text = 'Maç oynanıyor';
      prog = Math.min(1, s.match.prog);
      sub = `${Math.floor(prog * s.match.len * 60)}. dk · kazanma şansı ~%${Math.round(sim.winChance() * 100)}`;
    } else if (s.away) {
      mode = 'away';
      text = s.away.kind === 'rest' ? 'Mola (“5 dk”)' : s.away.label;
      prog = 1 - Math.max(0, s.away.until - s.hour) / s.away.len;
      sub = `${durText(s.away.until - s.hour)} kaldı`;
    } else {
      const idleFor = s.hour - s.idleSince;
      mode = idleFor > 0.2 ? 'bored' : 'idle';
      text = idleFor > 0.2 ? 'Lobide · chat sıkılıyor' : 'Lobide';
      sub = s.log.length ? 'Sıradaki maçı at (1)' : 'İlk maçı at (1) — yayın başladı!';
    }
    // Enerji kritik: bitişten önce açık uyarı (durum satırı + çay/mola düğmeleri nabız atar)
    const low = s.energy < LOW_E && !s.away && !s.pending;
    if (low) sub = s.match ? 'Enerji kritik! Çay iç (2); maç bitince mola ver (4)' : 'Enerji kritik! Çay (2) ya da mola (4)';
    if (low && !lowWarned) {
      lowWarned = true;
      ctx.sound.bad();
      haptic([30, 40, 30]);
      chatLine('low', { text: 'gözler kapanıyor… çay lazım' });
      say('Enerji kritik. Çay iç ya da mola ver, yoksa yayın biter.');
    } else if (s.energy > LOW_E + 14) {
      lowWarned = false;
    }
    if (status.dataset.low !== (low ? '1' : '0')) status.dataset.low = low ? '1' : '0';
    if (mode !== lastMode) { status.dataset.mode = mode; lastMode = mode; }
    if (statusText.textContent !== text) statusText.textContent = text;
    if (statusSub.textContent !== sub) statusSub.textContent = sub;
    statusBar.firstChild.style.transform = `scaleX(${prog.toFixed(4)})`;
    // aksiyonlar
    for (const a of ACTIONS) {
      const ab = actBtns[a.id];
      const ok = sim.can(a.id);
      let subText;
      let cdFrac = 0;
      const cdLeft = a.id === 'match' ? 0 : Math.max(0, s.cd[a.id] - s.hour);
      if (cdLeft > 0) cdFrac = cdLeft / CD[a.id];
      if (a.id === 'match') subText = s.match ? `maçta · %${Math.round(s.match.prog * 100)}` : s.away ? 'yayın arası' : 'MMR · hype';
      else if (a.id === 'tea') subText = cdLeft ? durText(cdLeft) : `+${sim.teaGain()} enerji`;
      else if (a.id === 'chat') subText = cdLeft ? durText(cdLeft) : '+ chat moodu';
      else if (a.id === 'rest') subText = s.match ? 'maç bitince' : cdLeft ? durText(cdLeft) : s.away ? 'yayın arası' : '+enerji −tilt';
      else subText = !s.match ? 'maç gerekli' : s.match.quad ? 'bu maçta denendi' : cdLeft ? durText(cdLeft) : s.match.prog >= 0.85 ? 'maç bitiyor' : `%${Math.round(sim.quadChance() * 100)} şans`;
      if (ab.lastSub !== subText) { ab.sub.textContent = subText; ab.lastSub = subText; }
      ab.b.setAttribute('aria-disabled', String(!ok));
      ab.b.classList.toggle('is-ready', ok);
      ab.cdFill.style.transform = `scaleX(${cdFrac.toFixed(4)})`;
      ab.b.setAttribute('aria-label', `${a.key}: ${a.name}, ${subText}`);
    }
    actBtns.match.b.classList.toggle('is-call', !s.match && !s.away && !s.pending && s.hour - s.idleSince > 0.05 && !(low && sim.can('rest')));
    actBtns.tea.b.classList.toggle('is-call', low && sim.can('tea'));
    actBtns.rest.b.classList.toggle('is-call', low && sim.can('rest'));
    field.dataset.hot = s.hype > 0.6 ? '1' : '0';
  }

  // ---------------------------------------------------------------- döngü
  function frame(dt) {
    if (state !== 'play' || paused || !sim) return;
    let rem = (dt / SEC_PER_HOUR) * speed;
    while (rem > 0 && !sim.s.pending && !sim.s.over && state === 'play') {
      const st = Math.min(rem, 0.02);
      sim.step(st);
      rem -= st;
    }
    if (state !== 'play') return;
    const s = sim.s;
    if (!s.pending && s.hour >= nextChatAt) {
      chatLine(ambientKind());
      const busy = Math.min(1.8, 0.7 + s.viewers / 2500);
      nextChatAt = s.hour + (0.09 + Math.random() * 0.13) / busy;
    }
    paint(dt);
  }

  // ---------------------------------------------------------------- akış
  function setPaused(on) {
    if (state !== 'play' || paused === !!on) return;
    paused = !!on;
    pauseBtn.replaceChildren(icon(paused ? 'play' : 'pause', { size: 16 }));
    pauseBtn.setAttribute('aria-label', paused ? 'Devam et (P)' : 'Duraklat (P)');
    field.dataset.paused = paused ? '1' : '0';
    if (paused) {
      const go = h('button', { class: 'btn primary lg', type: 'button', 'data-primary': '' }, icon('play', { size: 18 }), 'Devam et');
      go.addEventListener('click', () => { ctx.sound.click(); setPaused(false); });
      const node = h('div', { class: 'stack gm-mr-paused' },
        h('span', { class: 'eyebrow' }, `Duraklatıldı · ${clockText(sim.s.hour)}`),
        h('h2', { class: 'h2' }, 'Yayın beklemede'),
        h('p', { class: 'muted' }, 'Saat durdu. Chat seni bekliyor; enerji de.'),
        h('div', { class: 'row' }, go),
      );
      closePause = showOverlay(L.stage, node, { reveal: true });
      say('Oyun duraklatıldı.');
    } else {
      if (closePause) { closePause(); closePause = null; }
      say('Oyun devam ediyor.');
    }
  }
  pauseBtn.addEventListener('click', () => { ctx.sound.click(); setPaused(!paused); });

  function start() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    if (closePause) { closePause(); closePause = null; }
    if (evCard) { evCard.card.remove(); evCard = null; }
    field.dataset.ev = '0';
    for (const id of timers) clearTimeout(id);
    timers.clear();
    evTimer = 0;
    actions.hidden = false;
    paused = false;
    field.dataset.paused = '0';
    pauseBtn.replaceChildren(icon('pause', { size: 16 }));
    clear(chatList);
    clear(logList);
    logBox.classList.remove('has');
    for (const m of METERS) meterEls[m.id].last = null;
    sim = createSim({ on: onSim });
    shownViewers = sim.s.viewers;
    nextChatAt = 0.05;
    lastMode = '';
    lowWarned = false;
    state = 'play';
    field.dataset.state = 'play';
    L.stage.classList.add('playing');
    if (!hotkeysOff) { ctx.hotkeys(false); hotkeysOff = true; }
    if (runner) runner.destroy();
    runner = createRunner(frame);
    paint(0);
    chatLine('idle', { text: 'yayın başladı! 24 saat, başlıyoruz' });
    chatLine('idle', { text: 'DOG DOG DOG hazırlığı' });
    ctx.sound.whoosh();
    say('Yayın başladı. Saat 00:00. İlk maçı atmak için 1’e bas.');
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch { /* yok say */ }
    requestAnimationFrame(revealPlay);
  }

  function finish(why) {
    if (state !== 'play') return;
    state = 'end';
    field.dataset.state = 'end';
    L.stage.classList.remove('playing');
    if (evCard) { evCard.card.remove(); evCard = null; actions.hidden = false; }
    field.dataset.ev = '0';
    paint(0);
    const s = sim.s;
    const done = why === 'done';
    const score = sim.score();
    const saved = submitResult(meta, score);
    if (done) {
      store.me.patch((d) => { if (!d.picks) d.picks = {}; d.picks['maraton:tamam'] = (Number(d.picks['maraton:tamam']) || 0) + 1; });
      ctx.fx.stamp('24 SAAT!', { variant: 'jade', ms: 1400 });
      const [x, y] = pt(sky, 0.5);
      ctx.fx.confetti(x, y, 90);
      ctx.sound.win();
      burst('final', 4, 160);
      say('Maraton tamam! 24 saat bitti.');
    } else {
      ctx.fx.stamp('Zzz…', { ms: 1200 });
      ctx.sound.lose();
      chatLine('night', { text: 'uyuya kaldı… iyi uykular' });
      say('Enerji bitti, yayın erken kapandı.');
    }
    const st = s.stats;
    const summary = {
      done, hours: s.hour, peak: Math.round(s.peak), wins: st.wins, losses: st.losses, dogs: st.dogs, teas: st.teas,
      chats: st.chats, breaks: st.breaks, quadOk: st.quadOk, quadFail: st.quadFail, mmr: s.mmr - st.mmr0, bestStreak: st.bestStreak,
    };
    const title = MR_TITLES.find((t) => { try { return t.when(summary); } catch { return false; } }) || MR_TITLES[MR_TITLES.length - 1];
    const quip = done
      ? summary.peak >= 7000
        ? 'Yirmi dört saat, dev bir chat. Ve unutma: bu, en kısa yayındı.'
        : 'Maraton tamam! 24 saat bitti… yani en kısa yayın. Yarın 25 mi?'
      : s.hour >= 18
        ? 'Az kaldı! Göz kapakları finali bekleyemedi. Çayı erken demle, molayı atlama.'
        : s.hour >= 10
          ? 'Yarı yolu geçtin ama enerji bitti. Mola vermek de maratona dahil.'
          : 'DOG DOG DOG… “24 saat en kısası” derken bu yayın ısınma turu oldu. Çay, mola, tekrar!';
    // Yayın neden bitti? Enerji sıfırlandıysa nedenler ve tek bir somut öğüt
    let cause = null;
    if (!done) {
      const tip = st.teas === 0
        ? 'Hiç çay içmedin: Çay (2) +16 enerji verir, iki saatte bir hazır.'
        : st.breaks === 0 && s.hour >= 6
          ? 'Hiç mola vermedin: Mola (4) yarım saatte ~28 enerji verir, tilt’i de söndürür. Maç aralarında ver.'
          : st.idleH >= 1.5
            ? `Lobide ${durText(st.idleH)} boş bekledin: boş lobi enerjiyi hızla yer. Maçı erken at.`
            : st.chats >= 14
              ? `Chat’e ${st.chats} kez cevap verdin: her cevap −2 enerji. Moodu maçla da tutabilirsin.`
              : 'Enerji 35’in altına inince molayı, 70’in altına inince çayı düşün.';
      cause = h('div', { class: 'gm-mr-cause', role: 'note' },
        h('span', { class: 'gm-mr-cause-ico', 'aria-hidden': 'true' }, icon('bolt', { size: 18 })),
        h('span', { class: 'gm-mr-cause-text' },
          h('strong', null, `Enerji 0’a düştü: ${clockText(s.hour)}’da uyuya kaldın.`),
          h('span', { class: 'gm-mr-cause-facts xsmall' },
            `${st.teas} çay · ${st.breaks} mola · ${st.wins + st.losses} maç · lobide ${durText(st.idleH)}`),
          h('span', { class: 'gm-mr-cause-tip small' }, tip),
        ),
      );
    }
    const r = runner;
    later(() => {
      if (state !== 'end') return;
      if (r) r.destroy();
      if (runner === r) runner = null;
      const strip = h('ol', { class: 'gm-mr-log-list gm-mr-res-log', 'aria-label': `Maçlar: ${st.wins} galibiyet, ${st.losses} mağlubiyet` },
        s.log.map((e) => h('li', { class: `gm-mr-pill ${e.win ? 'is-w' : 'is-l'}` }, e.win ? 'G' : 'M',
          e.dog ? h('i', { class: 'gm-mr-pill-dog' }) : null, e.quad === 'ok' ? h('i', { class: 'gm-mr-pill-quad' }) : null)));
      const extra = h('div', { class: 'stack gm-mr-res-extra' },
        cause,
        h('div', { class: 'gm-mr-title' },
          h('span', { class: 'gm-mr-title-ico', 'aria-hidden': 'true' }, icon(done ? 'trophy' : 'moon', { size: 22 })),
          h('span', { class: 'gm-mr-title-text' },
            h('span', { class: 'eyebrow' }, 'Unvan'),
            h('strong', null, memeText(title.name)),
            h('span', { class: 'xsmall dim' }, title.desc),
          ),
        ),
        s.log.length ? strip : null,
        done ? null : h('p', { class: 'xsmall dim gm-result-note' },
          `Skor = zirve ${fmtNum(summary.peak)} × ${clockText(s.hour)} / 24 saat. 24:00’e varan maraton zirvenin tamamını alır.`),
      );
      const { node } = resultCard(meta, {
        score,
        saved,
        title: done ? 'Maraton tamam!' : 'Yayın erken bitti',
        stats: [
          ['Zirve', fmtNum(summary.peak)],
          ['Yayın', clockText(s.hour)],
          ['Maç', `${st.wins}G · ${st.losses}M`],
          ['MMR', signed(summary.mmr)],
          ['DOG anı', fmtNum(st.dogs)],
          [memeText('1vDOQUZ'), st.quadOk + st.quadFail ? `${st.quadOk}/${st.quadOk + st.quadFail}` : '—'],
        ],
        quip,
        extra,
        retryLabel: 'Yeni maraton',
        onRetry: start,
        onBack: () => nav && nav.back(),
      });
      addPbNote(node, pbNote({ score, prev: saved.prev, fmt: (n) => `${fmtNum(n)} izleyici` }));
      closeOverlay = showOverlay(L.stage, node, { reveal: true });
      if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
    }, done ? 1500 : 1300);
  }

  // ---------------------------------------------------------------- klavye
  function onKey(e) {
    if (state !== 'play') return;
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    if (document.querySelector('.modal-backdrop')) return;
    const k = (e.key || '').toLowerCase();
    if (k === 'p' || e.code === 'KeyP' || (k === 'escape' && !paused && !evCard)) {
      e.preventDefault();
      if (!e.repeat) setPaused(!paused);
      return;
    }
    if (paused) return;
    const digit = /^Digit([1-5])$/.exec(e.code || '') || /^Numpad([1-5])$/.exec(e.code || '');
    const n = digit ? Number(digit[1]) : /^[1-5]$/.test(e.key) ? Number(e.key) : 0;
    if (evCard) {
      if (!evCard.done && (n === 1 || n === 2 || k === 'a' || k === 'b')) {
        e.preventDefault();
        if (!e.repeat) pickChoice(n ? n - 1 : k === 'a' ? 0 : 1);
      } else if (evCard.done && (n || k === ' ' || k === 'enter')) {
        e.preventDefault();
        if (!e.repeat) closeEvent();
      }
      return;
    }
    if (n) {
      e.preventDefault();
      if (!e.repeat) doAct(ACTIONS[n - 1].id);
    }
  }
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- başlangıç
  function showIntro() {
    const legend = h('ul', { class: 'gm-mr-legend' }, ACTIONS.map((a) => h('li', null,
      h('span', { class: 'kbd' }, a.key),
      icon(a.icon, { size: 16 }),
      h('span', null, memeText(a.name)),
    )));
    const node = introCard(meta, {
      onStart: start,
      startLabel: 'Yayını başlat',
      extra: legend,
      note: 'Hedef: 24:00’e kadar yayında kal ve zirve izleyiciyi büyüt. Kısayollar 1–5, P duraklatır; sitenin kısayolları oyun boyunca kapalıdır.',
      rules: [meta.rules[0], meta.rules[1], meta.rules[3], meta.rules[4]],
    });
    closeOverlay = showOverlay(L.stage, node, { cls: 'gm-mr-ov' });
  }

  // İlk görünüm: sahne boş bir yayın ekranı gibi dursun
  sim = createSim({ on: () => {} });
  paint(0);
  chatLine('idle', { text: 'yayın ne zaman başlıyor?' });
  chatLine('idle', { text: '24 saatlik maraton geliyor' });
  chatLine('idle', { text: 'çaylar hazır mı' });
  showIntro();

  // Geliştirme kancası (yalnızca dev sunucusunda; üretim derlemesinde kod tamamen çıkarılır)
  if (import.meta.env.DEV) {
    window.__maraton = {
      get state() { return state; },
      get sim() { return sim; },
      speed(x) { speed = Math.max(0.1, Number(x) || 1); return speed; },
      act: doAct,
      choose: pickChoice,
      closeEvent,
      get event() { return evCard ? { id: evCard.ev.id, done: evCard.done } : null; },
      set(patch) { Object.assign(sim.s, patch); paint(0); },
      /** DOM’suz hızlı denge simülasyonu: n oyun, strateji adıyla. */
      simulate(strategy = 'balanced', n = 200) {
        const out = { done: 0, hours: [], peaks: [], scores: [], dogs: 0, wins: 0, losses: 0, teas: 0, quadOk: 0, quadFail: 0, events: 0 };
        for (let i = 0; i < n; i++) {
          const x = createSim();
          const s = x.s;
          let guard = 0;
          while (!s.over && guard++ < 100000) {
            if (s.pending) {
              const ch = s.pending.ev.choices;
              const pickI = strategy === 'random' ? Math.floor(Math.random() * ch.length) : strategy === 'naive' ? 0 : ch.findIndex((c) => (c.fx && (c.fx.e || 0) > 0)) >= 0 && s.energy < 45 ? ch.findIndex((c) => c.fx && (c.fx.e || 0) > 0) : 0;
              x.choose(pickI);
              x.resume();
              continue;
            }
            if (strategy === 'human') {
              // tepki gecikmeli, makul oyuncu: her karar ~1 sn arayla
              if (!x._t || s.hour - x._t > 0.09) {
                x._t = s.hour;
                if (!s.match && s.energy < 32 && x.can('rest')) x.act('rest');
                if (x.can('match')) x.act('match');
                else if (x.can('tea') && s.energy < 70) x.act('tea');
                else if (x.can('chat') && s.mood < 60) x.act('chat');
                else if (x.can('quad') && s.tilt < 25 && s.energy > 40 && s.match.prog > 0.3) x.act('quad');
              }
            } else if (strategy !== 'lazy') {
              if ((strategy === 'balanced' || strategy === 'random') && s.energy < 35 && x.can('rest')) x.act('rest');
              if (x.can('match')) x.act('match');
              if (strategy !== 'naive') {
                if (x.can('tea') && s.energy < 88) x.act('tea');
                if (x.can('chat') && s.mood < 75) x.act('chat');
                if (x.can('quad') && s.tilt < 30 && s.match.prog > 0.2) x.act('quad');
              }
            }
            x.step(0.02);
          }
          if (s.over === 'done') out.done++;
          out.hours.push(s.hour);
          out.peaks.push(Math.round(s.peak));
          (out.peakHours || (out.peakHours = [])).push(s.peakHour);
          (out.breaks || (out.breaks = [])).push(s.stats.breaks);
          (out.chats || (out.chats = [])).push(s.stats.chats);
          (out.dogList || (out.dogList = [])).push(s.stats.dogs);
          (out.mmrs || (out.mmrs = [])).push(s.mmr - s.stats.mmr0);
          out.scores.push(x.score());
          out.dogs += s.stats.dogs; out.wins += s.stats.wins; out.losses += s.stats.losses; out.teas += s.stats.teas;
          out.quadOk += s.stats.quadOk; out.quadFail += s.stats.quadFail; out.events += s.stats.events;
        }
        const avg = (a) => Math.round(a.reduce((p, c) => p + c, 0) / a.length);
        const q = (a, f) => { const b = a.slice().sort((m, k) => m - k); return b[Math.floor(f * (b.length - 1))]; };
        return {
          strategy, n, completion: out.done / n,
          hoursAvg: +(out.hours.reduce((a, b) => a + b, 0) / n).toFixed(1),
          peakAvg: avg(out.peaks), peakP10: q(out.peaks, 0.1), peakP90: q(out.peaks, 0.9),
          scoreAvg: avg(out.scores), scoreP10: q(out.scores, 0.1), scoreP50: q(out.scores, 0.5), scoreP90: q(out.scores, 0.9), scoreMax: Math.max(...out.scores),
          peakHourAvg: +(out.peakHours.reduce((a, b) => a + b, 0) / n).toFixed(1),
          breaksAvg: +(out.breaks.reduce((a, b) => a + b, 0) / n).toFixed(1),
          chatsAvg: +(out.chats.reduce((a, b) => a + b, 0) / n).toFixed(1), chatsP90: q(out.chats, 0.9),
          dogsP90: q(out.dogList, 0.9), mmrAvg: avg(out.mmrs),
          perGame: { dogs: +(out.dogs / n).toFixed(1), wins: +(out.wins / n).toFixed(1), losses: +(out.losses / n).toFixed(1), teas: +(out.teas / n).toFixed(1), quadOk: +(out.quadOk / n).toFixed(2), quadFail: +(out.quadFail / n).toFixed(2), events: +(out.events / n).toFixed(1) },
        };
      },
    };
  }

  return () => {
    state = 'dead';
    window.removeEventListener('keydown', onKey);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    if (runner) runner.destroy();
    runner = null;
    if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
    if (closeOverlay) closeOverlay();
    if (closePause) closePause();
    if (import.meta.env.DEV) delete window.__maraton;
    L.destroy();
  };
}
