// 1vDOQUZ Arena — Günlük Meydan Okuma: İstanbul gününün tohumundan kahraman, Lanet ve değiştiriciler.
// Herkes aynı gün aynı koşulda oynar (ustalık bonusu/varyant/özel çanta kapalı: progression.applyMeta mode 'daily').
// Saf modül (DOM yok). Yerel günlük rekor: csk:arena:daily:v1. Belge: docs/oyunlar/arena-hikaye.md → Günlük.

import { ls, seeded, hashStr } from '../../../core/dom.js';
import { HERO_IDS } from './heroes.js';

export const DAILY_KEY = 'arena:daily:v1';
const DAY = 86400e3;
const TZ = 3 * 3600e3; // İstanbul (UTC+3, yaz saati yok)

/** İstanbul takviminde gün numarası (progression.js ile aynı hesap). */
export const dayIndex = (now = Date.now()) => Math.floor((now + TZ) / DAY);
/** Sıfırlanmaya (İstanbul gece yarısı) kalan ms. */
export const msToReset = (now = Date.now()) => (dayIndex(now) + 1) * DAY - TZ - now;
/** “5 sa 12 dk” / “12 dk 04 sn” */
export function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h} sa ${String(m).padStart(2, '0')} dk` : `${m} dk ${String(sec).padStart(2, '0')} sn`;
}

/**
 * Günün değiştirici havuzu. modifiers: game.js / progression MODIFIER_KEYS anahtarları. Birbiriyle çelişenler `clash`.
 * Hepsi Sonsuz modun kurallarını değiştirir; skor çarpanı yalnız Lanet’ten gelir.
 */
export const DAILY_MODS = [
  { id: 'altin', name: 'Altın Yağmuru', desc: 'Altın kazancı +%30', modifiers: { gold: 1.3 } },
  { id: 'cam', name: 'Cam Top', desc: 'Canın −%20, hasarın +%25', modifiers: { heroHp: 0.8, heroDmg: 1.25 } },
  { id: 'gece', name: 'Uzun Gece', desc: 'Hep gece: görüş kısa, Wardsız DOG’lar güçlü', modifiers: { alwaysNight: true }, clash: ['sabah'] },
  { id: 'sabah', name: 'Bitmeyen Sabah', desc: 'Gece hiç gelmez', modifiers: { dayLen: 9999 }, clash: ['gece'] },
  { id: 'grev', name: 'Kurye Grevde', desc: 'Kurye yok: eşyalar yalnız çeşmede', modifiers: { noCourier: true } },
  { id: 'rosh', name: 'Aç Roshan', desc: 'Boss dalgası her 3 dalgada bir', modifiers: { roshanEvery: 3 } },
  { id: 'kalabalik', name: 'Kalabalık Sürü', desc: 'Her dalgada +2 elit DOG', modifiers: { extraElites: 2 } },
  { id: 'kamp', name: 'Uykucu Kamplar', desc: 'Orman kampları kapalı', modifiers: { noCamps: true } },
  { id: 'pahali', name: 'Zam Geldi', desc: 'Dükkân %25 pahalı', modifiers: { shopCost: 1.25 } },
  { id: 'bb', name: 'Geri Dönüş Yok', desc: 'Geri alma (buyback) kapalı', modifiers: { noBuyback: true } },
  { id: 'bilge', name: 'Bilge Kahraman', desc: 'XP +%35', modifiers: { xp: 1.35 } },
  { id: 'zengin', name: 'Zengin Başlangıç', desc: '+600 başlangıç altını', modifiers: { startGold: 600 } },
  { id: 'hizli', name: 'Hızlı Pati', desc: 'DOG’lar %12 hızlı', modifiers: { enemySpeed: 1.12 } },
];
const CURSE_ROLL = [1, 1, 2, 2, 3, 3, 4, 5];

/**
 * Günün koşulları: { day, seed, heroId, curse, mods: [{ id, name, desc }], modifiers, dateText }
 * Tüm kahramanlar (kilitliler dahil) çıkabilir: günlük modda misafir olarak oynanır (allowLocked).
 */
export function dailyChallenge(now = Date.now()) {
  const day = dayIndex(now);
  const seed = hashStr(`1vdoquz:gunluk:${day}`) >>> 0;
  const rnd = seeded(seed || 1);
  const heroes = Array.isArray(HERO_IDS) && HERO_IDS.length ? HERO_IDS : ['okcu', 'balta', 'buz', 'golge'];
  const heroId = heroes[Math.floor(rnd() * heroes.length)];
  const curse = CURSE_ROLL[Math.floor(rnd() * CURSE_ROLL.length)];
  const want = rnd() < 0.45 ? 1 : 2;
  // Lanetin zaten getirdiklerini (4: uzun geceler, 5: kurye yok) tekrar çekme
  const pool = DAILY_MODS.filter((M) => !(curse >= 4 && M.id === 'sabah') && !(curse >= 5 && M.id === 'grev'));
  const mods = [];
  while (mods.length < want && pool.length) {
    const M = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    if (mods.some((x) => (x.clash || []).includes(M.id) || (M.clash || []).includes(x.id))) continue;
    mods.push(M);
  }
  const modifiers = {};
  for (const M of mods) {
    for (const [k, v] of Object.entries(M.modifiers)) {
      if (typeof v === 'number' && typeof modifiers[k] === 'number') modifiers[k] = k === 'startGold' || k === 'extraElites' ? modifiers[k] + v : modifiers[k] * v;
      else modifiers[k] = v;
    }
  }
  const d = new Date(day * DAY);
  const dateText = `${d.getUTCDate()} ${['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][d.getUTCMonth()]}`;
  return { day, seed, heroId, curse, mods: mods.map(({ id, name, desc }) => ({ id, name, desc })), modifiers, dateText };
}

/** Günlük koşu yapılandırması (arena.js → applyMeta). */
export function dailyRunConfig(ch = dailyChallenge()) {
  return { mode: 'daily', heroId: ch.heroId, curse: ch.curse, seed: ch.seed, day: ch.day, modifiers: { ...ch.modifiers }, allowLocked: true };
}

// ------------------------------------------------------------------ yerel günlük rekor
/** { day, best, wave, heroId, runs } — yalnızca bugünün rekoru tutulur; gün değişince sıfırlanır. */
export function dailyBest(now = Date.now()) {
  const day = dayIndex(now);
  let v = null;
  try { v = ls.get(DAILY_KEY, null); } catch { v = null; }
  if (!v || typeof v !== 'object' || v.day !== day) return { day, best: 0, wave: 0, heroId: null, runs: 0 };
  const n = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0);
  return { day, best: n(v.best), wave: n(v.wave), heroId: typeof v.heroId === 'string' ? v.heroId.slice(0, 16) : null, runs: n(v.runs) };
}
/** Günlük koşuyu kaydet → { best, isBest, runs } */
export function recordDaily({ day, score, wave, heroId }, now = Date.now()) {
  const cur = dailyBest(now);
  const d = Number.isFinite(day) ? day : cur.day;
  const base = d === cur.day ? cur : { day: d, best: 0, wave: 0, heroId: null, runs: 0 };
  const s = Math.max(0, Math.floor(Number(score) || 0));
  const isBest = s > base.best;
  const next = { day: d, best: isBest ? s : base.best, wave: isBest ? Math.floor(Number(wave) || 0) : base.wave, heroId: isBest ? heroId : base.heroId, runs: base.runs + 1 };
  try { ls.set(DAILY_KEY, next); } catch { /* yok say */ }
  return { best: next.best, isBest, runs: next.runs, prev: base.best };
}
