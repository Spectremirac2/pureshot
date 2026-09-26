// 1vDOQUZ Arena 3.0 — birim tanımları (DOG'lar, Dire creep'leri, orman birimleri, bosslar, kuleler) ve yapay zekâları.
//
// UNITS tek tablo: can, hız, hasar, zırh (Dota zırh puanı), büyü direnci (0..1), saldırı türü, menzil,
// ödül (bounty: altın/XP/puan), model anahtarı, ai (THINK tablosundaki düşünce fonksiyonu).
// Hikâye modu görevleri (runConfig.mission.waves) birimleri ve bossları kimlikle doğurur:
//   { units: [{ id: 'boss_general', at: 'dire' }, { id: 'neutral_wolf', n: 3, at: { x, z } }] } — bkz. game.js spawnUnit.

import { DOG_TYPES } from './dogs.js';
import { ROSHAN_PIT, DIRE_GATE, TOWER_R, TOWER_SPOTS, CAMPS, DOG_GATES, PLAY_R, pushOut } from './map.js';
import { DMG, applyStatus, dealDamage, newStatus, cantAttack } from './combat.js';

const DOG_BASE = { kind: 'dog', ai: 'dog', armor: 0, magicResist: 0, attackType: 'melee', bounty: { gold: 38, xp: 45, score: 100 }, model: 'model-dog', height: 0.9 };

export const UNITS = {
  ...Object.fromEntries(Object.entries(DOG_TYPES).map(([id, T]) => [`dog_${id}`, { ...DOG_BASE, id: `dog_${id}`, type: id, hp: T.hp, speed: T.speed, dmg: T.dmg, r: T.r, name: T.short }])),
  creep_melee: {
    id: 'creep_melee', kind: 'creep', ai: 'creep', type: 'melee', name: 'Dire Piyadesi', short: 'PİYADE',
    hp: 250, speed: 3.05, dmg: 21, armor: 2.5, magicResist: 0, attackType: 'melee', range: 0.55, atkRate: 1.15, windup: 0.28, r: 0.4,
    bounty: { gold: 30, xp: 22, score: 30 }, model: 'model-creep-melee', height: 0.95,
  },
  creep_ranged: {
    id: 'creep_ranged', kind: 'creep', ai: 'creep', type: 'ranged', name: 'Dire Büyücüsü', short: 'BÜYÜCÜ',
    hp: 175, speed: 3.0, dmg: 24, armor: 0, magicResist: 0.1, attackType: 'ranged', range: 4.4, atkRate: 1.5, windup: 0.32, r: 0.38, proj: 'orb',
    bounty: { gold: 36, xp: 26, score: 40 }, model: 'model-creep-ranged', height: 0.95,
  },
  // ------------------------------------------------------------ orman
  neutral_wolf: {
    id: 'neutral_wolf', kind: 'neutral', ai: 'neutral', type: 'wolf', name: 'Orman Kurdu', short: 'KURT',
    hp: 360, speed: 4.4, dmg: 26, armor: 1, magicResist: 0, attackType: 'melee', range: 0.6, atkRate: 1.05, windup: 0.24, r: 0.44,
    bounty: { gold: 24, xp: 30, score: 25 }, model: 'model-neutral-wolf', height: 0.9, color: '#b9b2a4',
  },
  neutral_alpha: {
    id: 'neutral_alpha', kind: 'neutral', ai: 'neutral', type: 'alpha', name: 'Alfa Kurt', short: 'ALFA KURT',
    hp: 640, speed: 4.5, dmg: 40, armor: 3, magicResist: 0.1, attackType: 'melee', range: 0.7, atkRate: 1.1, windup: 0.26, r: 0.55,
    crit: 0.2, critMul: 1.8, scale: 1.3,
    bounty: { gold: 42, xp: 52, score: 45 }, model: 'model-neutral-wolf', height: 0.9, color: '#e9b949',
  },
  neutral_harpy: {
    id: 'neutral_harpy', kind: 'neutral', ai: 'neutral', type: 'harpy', name: 'Harpi', short: 'HARPİ',
    hp: 300, speed: 3.9, dmg: 24, armor: 0, magicResist: 0.2, attackType: 'ranged', range: 4.2, atkRate: 1.6, windup: 0.3, r: 0.42, proj: 'spark',
    storm: { cd: 8, tele: 0.7, dmg: 70, r: 5.5 },
    bounty: { gold: 28, xp: 34, score: 30 }, model: 'model-neutral-harpy', height: 1.1, color: '#9fe8ff',
  },
  // ------------------------------------------------------------ bosslar
  boss_roshan: {
    id: 'boss_roshan', kind: 'boss', ai: 'roshan', type: 'roshan', name: 'Kaya Canavarı', short: 'ROSHAN', color: '#e9b949', glyph: 'skull',
    hp: 2600, speed: 3.4, dmg: 78, armor: 6.5, magicResist: 0.25, attackType: 'melee', range: 0.75, atkRate: 1.55, windup: 0.42, r: 1.05,
    bounty: { gold: 350, xp: 500, score: 1000 }, model: 'model-roshan', height: 3.0, ccCap: 0.35, statusRes: 0.3,
    slam: { cd: 7.5, tele: 1.1, r: 3.3, dmg: 140 }, roar: { cd: 13, tele: 0.95, r: 5.4, stun: 1.25, dmg: 35 },
    hint: 'Çukurunun yanında yere vurur (kırmızı halka) ve kükrer (sarı halka: sersemletir). Düşerse Aegis ve Peynir bırakır.',
  },
  boss_feedalfa: {
    id: 'boss_feedalfa', kind: 'boss', ai: 'feedalfa', type: 'feedalfa', name: 'Feed Alfa', short: 'FEED ALFA', color: '#ff7a3d', glyph: 'paw',
    hp: 3000, speed: 4.5, dmg: 66, armor: 3, magicResist: 0.15, attackType: 'melee', range: 0.9, atkRate: 1.2, windup: 0.35, r: 0.95,
    bounty: { gold: 380, xp: 560, score: 1400 }, model: 'model-dog', height: 2.2, scale: 2.4, ccCap: 0.6, statusRes: 0.25,
    dash: { cd: 7, tele: 0.95, len: 10, w: 1.4, speed: 16, stun: 0.6 },
    hint: 'Dev Feed Köpeği. Çizgi boyunca körlemesine dalar (kırmızı şerit: yana çekil), yavrularını çağırır, canı yarıya inince öfkelenir.',
  },
  boss_shadow: {
    id: 'boss_shadow', kind: 'boss', ai: 'shadow', type: 'shadow', name: 'Gölge Ulusu', short: 'GÖLGE ULUSU', color: '#8b6cff', glyph: 'moon',
    hp: 3400, speed: 4.2, dmg: 72, armor: 4, magicResist: 0.3, attackType: 'melee', range: 0.9, atkRate: 1.25, windup: 0.35, r: 0.95,
    bounty: { gold: 420, xp: 640, score: 1600 }, model: 'model-dog', height: 2.0, scale: 2.2, ccCap: 0.6, statusRes: 0.25,
    stealth: { cd: 12, dur: 3.5 }, pounce: { tele: 0.85, r: 2.1 }, howl: { cd: 16, tele: 0.9, r: 5.5, fear: 1.3, dmg: 60 },
    hint: 'Wardsız DOG’ların lideri. Karanlığa karışıp kaybolur (Görüş Tozu açar), ardından sıçrar; ulumasıyla korkutur. Gece daha güçlüdür.',
  },
  boss_general: {
    id: 'boss_general', kind: 'boss', ai: 'general', type: 'general', name: 'Dire Generali', short: 'DİRE GENERALİ', color: '#e0354b', glyph: 'greatsword',
    hp: 4600, speed: 3.6, dmg: 92, armor: 6, magicResist: 0.25, attackType: 'melee', range: 1.0, atkRate: 1.6, windup: 0.55, r: 1.1,
    bounty: { gold: 480, xp: 760, score: 2000 }, model: 'model-boss-general', height: 2.6, ccCap: 0.6, statusRes: 0.3,
    cleave: { r: 2.8, arc: 1.95 }, warcry: { cd: 16, tele: 0.8, r: 8, dur: 7, dmg: 0.4, armor: 6 }, summon: { cd: 20, cd2: 12 },
    hint: 'Önündeki yayı yarar (koni uyarısı), savaş narasıyla kendini ve creep’leri güçlendirir, takviye çağırır.',
  },
  boss_ancient: {
    id: 'boss_ancient', kind: 'boss', ai: 'ancient', type: 'ancient', name: 'Sonsuz Pub’ın Kalbi', short: 'PUB’IN KALBİ', color: '#ff3b6b', glyph: 'ancient',
    hp: 7000, speed: 0, dmg: 55, armor: 8, magicResist: 0.35, attackType: 'ranged', range: 8.5, atkRate: 1.8, windup: 0.3, r: 1.6, proj: 'orb',
    bounty: { gold: 800, xp: 1200, score: 3000 }, model: 'model-boss-ancient', height: 3.2, ccCap: 0.2, statusRes: 0.5, stationary: true,
    pulse: { cd: 6.5, tele: 1.5, inner: 4.2, outer: 9.5, dmg: 120 }, dogs: { cd: 15, n: 3 }, shieldAt: [0.7, 0.35], guards: 4,
    hint: 'Kıpırdamaz ama nabız atar: içte ve dışta sırayla patlayan halkalar (güvenli bölgeye geç). DOG dalgaları doğurur; kalkan evresinde muhafızlarını indir.',
  },
  // ------------------------------------------------------------ kuleler
  tower_radiant: {
    id: 'tower_radiant', kind: 'tower', side: 'radiant', name: 'Radiant Kulesi', hp: 1500, armor: 5.5, magicResist: 0.5,
    attackType: 'ranged', range: 5.4, dmg: 50, atkRate: 1.2, proj: 'tower-r', model: 'model-tower-radiant', height: 3.6,
  },
  tower_dire: {
    id: 'tower_dire', kind: 'tower', side: 'dire', name: 'Dire Kulesi', hp: 1300, armor: 7, magicResist: 0.5,
    attackType: 'ranged', range: 5.0, dmg: 34, atkRate: 1.5, lockOn: 0.8, proj: 'tower-d', model: 'model-tower-dire', height: 3.6,
    bounty: { gold: 220, xp: 150, score: 500 },
  },
};

/** Boss kimlikleri (kısa adla da doğurulabilir: 'roshan', 'feedalfa', 'shadow', 'general', 'ancient'). */
export const BOSS_IDS = ['boss_roshan', 'boss_feedalfa', 'boss_shadow', 'boss_general', 'boss_ancient'];
export const unitId = (id) => (UNITS[id] ? id : UNITS[`boss_${id}`] ? `boss_${id}` : UNITS[`dog_${id}`] ? `dog_${id}` : UNITS[`neutral_${id}`] ? `neutral_${id}` : UNITS[`creep_${id}`] ? `creep_${id}` : null);

/** Kamp dizilimleri (kamp kimliği → birimler). */
export const CAMP_UNITS = {
  kurt: ['neutral_alpha', 'neutral_wolf', 'neutral_wolf'],
  harpi: ['neutral_harpy', 'neutral_harpy'],
  koru: ['neutral_alpha', 'neutral_harpy', 'neutral_wolf'],
};

/** Dalga ölçeği: creep'ler, orman birimleri. */
export const creepScale = (wave) => ({ hp: 1 + 0.2 * (wave - 1) + 0.012 * (wave - 1) ** 2, dmg: 1 + 0.11 * (wave - 1) });
/** Boss güç seviyesi k (1, 2, 3…): can ve hasar çarpanı. */
export const bossScale = (k) => ({ hp: 1 + 0.55 * (k - 1), dmg: 1 + 0.28 * (k - 1), bounty: 1 + 0.2 * (k - 1) });

function base(g, U, x, z) {
  return {
    id: g.nextId(), kind: U.kind, type: U.type, def: U,
    x, z, vx: 0, vz: 0, kx: 0, kz: 0, face: Math.atan2(-x, -z), r: U.r,
    maxHp: U.hp, hp: U.hp, speed: U.speed, dmg: U.dmg, armor: U.armor, magicResist: U.magicResist,
    crit: U.crit || 0, critMul: U.critMul || 0, statusRes: U.statusRes || 0, ccCap: U.ccCap || 0,
    st: newStatus(), scale: U.scale || 1, seed: Math.random() * 100,
    windup: 0, attackCd: 0.6, lunge: 0, hitFlash: 0, spawnT: 0.5, dead: false, deathT: 0,
    status: null, dist: 99, vis: 1, bounty: { ...U.bounty }, counted: false, tgt: null, retarget: 0, aggroT: 0,
    shield: 0, magShield: 0, armorBuff: 0, spellImmune: 0, invuln: 0, seen: true,
  };
}

export function makeCreep(g, type, wave, x, z) {
  const U = UNITS[type === 'ranged' ? 'creep_ranged' : 'creep_melee'];
  const s = creepScale(wave);
  const e = base(g, U, x, z);
  e.maxHp = e.hp = Math.round(U.hp * s.hp * (g.mods.enemyHp || 1));
  e.dmg = U.dmg * s.dmg * (g.mods.enemyDmg || 1) * (1 + 0.15 * (g.direMorale || 0));
  e.bounty.gold = U.bounty.gold + 2 * (wave - 1);
  e.bounty.xp = U.bounty.xp + 3 * (wave - 1);
  e.spawnT = 0.7;
  return e;
}

export function makeNeutral(g, id, wave, x, z, camp = null) {
  const U = UNITS[id];
  const s = creepScale(wave);
  const e = base(g, U, x, z);
  e.maxHp = e.hp = Math.round(U.hp * s.hp * (g.mods.enemyHp || 1));
  e.dmg = U.dmg * s.dmg * (g.mods.enemyDmg || 1);
  e.bounty.gold = U.bounty.gold + 2 * (wave - 1);
  e.bounty.xp = U.bounty.xp + 3 * (wave - 1);
  e.camp = camp;
  e.hx = x;
  e.hz = z;
  e.state = 'idle';
  e.stormCd = U.storm ? 3 + Math.random() * 3 : 0;
  e.face = Math.random() * Math.PI * 2;
  e.spawnT = 0.6;
  return e;
}

export function makeRoshan(g, k) {
  return makeBoss(g, 'boss_roshan', { k });
}

/** Boss yerleşim noktası: 'pit' | 'center' | 'dire' | 'gate' | {x, z}. */
export function bossSpot(g, U, at) {
  if (at && typeof at === 'object') return { x: at.x, z: at.z };
  const where = at || (U.ai === 'roshan' ? 'pit' : U.ai === 'ancient' ? 'center' : U.ai === 'general' ? 'dire' : 'gate');
  if (where === 'pit') return { x: ROSHAN_PIT.x, z: ROSHAN_PIT.z };
  if (where === 'center') return { x: 0, z: 0 };
  if (where === 'dire') return { x: DIRE_GATE.x * 0.88, z: DIRE_GATE.z * 0.88 };
  // en uzak DOG kapısı
  const p = g.player;
  let best = DOG_GATES[0];
  let bd = -1;
  for (const a of DOG_GATES) {
    const d = Math.hypot(Math.sin(a) * PLAY_R - p.x, Math.cos(a) * PLAY_R - p.z);
    if (d > bd) { bd = d; best = a; }
  }
  return { x: Math.sin(best) * (PLAY_R - 1.4), z: Math.cos(best) * (PLAY_R - 1.4) };
}

/** Boss üret. opts: { k (güç seviyesi), at, hp, dmg, counted } */
export function makeBoss(g, id, opts = {}) {
  const U = UNITS[id];
  const k = Math.max(1, opts.k || 1);
  const sc = bossScale(k);
  const spot = bossSpot(g, U, opts.at);
  const e = base(g, U, spot.x, spot.z);
  e.maxHp = e.hp = Math.round((opts.hp || U.hp) * sc.hp * (g.mods.enemyHp || 1) * (g.mods.bossHp || 1));
  e.dmg = (opts.dmg || U.dmg) * sc.dmg * (g.mods.enemyDmg || 1);
  e.bounty = { gold: Math.round(U.bounty.gold * sc.bounty), xp: Math.round(U.bounty.xp * sc.bounty), score: Math.round(U.bounty.score * sc.bounty) };
  e.k = k;
  e.cast = null;
  e.spawnT = 1.6;
  e.counted = opts.counted !== false;
  e.bossImmune = true;
  e.phase = 1;
  e.name = U.name;
  e.numY = U.height + 0.4;
  e.t1 = 3;
  e.t2 = 5;
  e.t3 = 8;
  if (U.ai === 'roshan') {
    e.slamDmg = U.slam.dmg + 40 * (k - 1);
    e.slamCd = 4;
    e.roarCd = 6.5;
    e.face = Math.PI * 0.25; // çukurdan arenaya bakar
    e.home = { x: ROSHAN_PIT.x, z: ROSHAN_PIT.z, leash: ROSHAN_PIT.leash };
  } else {
    e.face = Math.atan2(g.player.x - e.x, g.player.z - e.z);
    e.angry = true;
  }
  if (U.ai === 'ancient') { e.shieldIdx = 0; e.guards = 0; e.pulseKind = 'inner'; e.t1 = 4; e.t2 = 8; }
  if (U.ai === 'shadow') { e.t1 = 6; e.t2 = 9; }
  if (U.ai === 'general') { e.t1 = 8; e.t2 = 10; }
  if (U.ai === 'feedalfa') { e.t1 = 4; e.summoned = 0; }
  return e;
}

export function makeTowers(g, wave = 1) {
  return TOWER_SPOTS.map((s) => {
    const U = UNITS[s.side === 'radiant' ? 'tower_radiant' : 'tower_dire'];
    const hp = Math.round(U.hp * (1 + 0.12 * (wave - 1)));
    return {
      id: `tw-${s.id}`, kind: 'tower', spot: s.id, side: s.side, def: U, x: s.x, z: s.z, r: TOWER_R,
      hp, maxHp: hp, armor: U.armor, magicResist: U.magicResist, st: newStatus(), armorBuff: 0,
      cd: 1, tgt: null, dead: false, deadT: 0, hitFlash: 0, shotT: 0, barkT: 0,
    };
  });
}

// ------------------------------------------------------------------ yardımcılar
function toward(u, tx, tz) {
  const dx = tx - u.x;
  const dz = tz - u.z;
  const L = Math.hypot(dx, dz) || 1;
  return [dx / L, dz / L, L];
}
const alive = (t) => t && !t.dead;
const STOP = { mx: 0, mz: 0, spd: 0 };
const heroOkFor = (g) => g.heroVisible && !g.player.dead && g.state !== 'dying';

function resolveAttack(e, g) {
  const t = e.tgt;
  if (!alive(t) || (t === g.player && !g.heroVisible)) return;
  const tr = t === g.player ? 0.35 : t.r;
  const d = Math.hypot(t.x - e.x, t.z - e.z) - tr - e.r;
  if (d > e.def.range + 0.6) return;
  e.lunge = 0.22;
  const dmg = e.dmg * (e.warCry > 0 ? 1 + (e.warCryK || 0.3) : 1);
  if (e.def.attackType === 'ranged') {
    g.fireProj({ from: e, kind: e.def.proj || 'orb', target: t, dmg, type: DMG.PHYS, speed: 11, y: 0.8 });
  } else {
    dealDamage(g, e, t, dmg, DMG.PHYS, { attack: true, src: e.kind });
  }
}

/** Ortak kontrol durumu: sersem/kök/korku/dönüşüm. Hareket niyeti ya da null döner. */
function ccIntent(e, g) {
  const st = e.st;
  if (st.stun > 0) { e.status = 'stun'; e.windup = 0; return STOP; }
  if (st.fear > 0) {
    e.status = 'fear';
    e.windup = 0;
    const [ux, uz] = toward(e, st.fearX, st.fearZ);
    return st.root > 0 ? STOP : { mx: -ux, mz: -uz, spd: e.speed };
  }
  if (st.root > 0) { e.status = 'frozen'; e.windup = 0; return STOP; }
  if (st.hex > 0) {
    e.status = 'hex';
    e.windup = 0;
    const a = g.time * 0.8 + e.seed;
    return { mx: Math.sin(a), mz: Math.cos(a), spd: e.speed };
  }
  void g;
  return null;
}

// ------------------------------------------------------------------ creep
export function thinkCreep(e, g, dt) {
  const p = g.player;
  const st = e.st;
  e.status = null;
  const cc = ccIntent(e, g);
  if (cc) return cc;
  if (e.retreat) {
    const [ux, uz, L] = toward(e, DIRE_GATE.x, DIRE_GATE.z);
    if (L < 1.1) e.gone = true;
    return { mx: ux, mz: uz, spd: e.speed * 1.1 };
  }
  if (g.state === 'idle' || g.state === 'over') return STOP;
  if (e.aggroT > 0) e.aggroT -= dt;
  if (e.attackCd > 0) e.attackCd -= dt;
  if (e.warCry > 0) e.warCry -= dt;
  e.retarget -= dt;
  const heroOk = heroOkFor(g);
  if (e.retarget <= 0 || !alive(e.tgt) || (e.tgt === p && !heroOk)) {
    e.retarget = 0.45;
    const dh = Math.hypot(p.x - e.x, p.z - e.z);
    let tgt = null;
    if (heroOk && (dh < 3.6 || e.aggroT > 0 || st.taunt > 0)) tgt = p;
    else {
      let bd = Infinity;
      for (const t of g.towers) {
        if (t.dead || t.side !== 'radiant') continue;
        const q = (t.x - e.x) ** 2 + (t.z - e.z) ** 2;
        if (q < bd) { bd = q; tgt = t; }
      }
      if (!tgt && heroOk) tgt = p;
    }
    e.tgt = tgt;
  }
  const t = e.tgt;
  if (!t) return STOP;
  const [ux, uz, L] = toward(e, t.x, t.z);
  e.dist = t === p ? L : Math.hypot(p.x - e.x, p.z - e.z);
  e.faceTo = Math.atan2(ux, uz);
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) resolveAttack(e, g);
    return STOP;
  }
  const tr = t === p ? 0.35 : t.r;
  if (L - tr - e.r <= e.def.range) {
    if (e.attackCd <= 0 && !cantAttack(e)) {
      e.windup = e.def.windup;
      e.attackCd = e.def.atkRate / (e.warCry > 0 ? 1.25 : 1);
      g.emit('windup', { foe: e });
    }
    return STOP;
  }
  return { mx: ux, mz: uz, spd: e.speed * (e.warCry > 0 ? 1.2 : 1) };
}

// ------------------------------------------------------------------ orman birimleri
export function thinkNeutral(e, g, dt) {
  const p = g.player;
  const U = e.def;
  e.status = null;
  const cc = ccIntent(e, g);
  if (cc) return cc;
  if (g.state === 'idle' || g.state === 'over') return STOP;
  if (e.attackCd > 0) e.attackCd -= dt;
  const camp = e.camp;
  const leash = camp ? camp.leash : 5;
  const dHome = Math.hypot(e.x - e.hx, e.z - e.hz);
  const heroOk = heroOkFor(g);
  if (e.state === 'return') {
    const [ux, uz, L] = toward(e, e.hx, e.hz);
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
    e.windup = 0;
    e.cast = null;
    if (L < 0.4) { e.state = 'idle'; e.hp = e.maxHp; }
    e.faceTo = Math.atan2(ux, uz);
    return L < 0.4 ? STOP : { mx: ux, mz: uz, spd: e.speed * 1.3 };
  }
  const engaged = heroOk && (e.aggroT > 0 || e.st.taunt > 0);
  if (e.aggroT > 0) e.aggroT -= dt;
  if (!engaged) {
    e.cast = null;
    if (dHome > 0.6) {
      const [ux, uz] = toward(e, e.hx, e.hz);
      return { mx: ux, mz: uz, spd: e.speed * 0.5 };
    }
    e.status = 'camp';
    e.faceTo = e.face + Math.sin(g.time * 0.3 + e.seed) * 0.01;
    return STOP;
  }
  if (dHome > leash && e.st.taunt <= 0) {
    e.state = 'return';
    e.aggroT = 0;
    g.emit('neutralLeash', { foe: e });
    return STOP;
  }
  // kampın geri kalanı da uyanır
  if (camp && !e.woke) {
    e.woke = true;
    for (const o of g.foes) if (o.camp === camp && !o.dead && o.state !== 'return') o.aggroT = Math.max(o.aggroT, 3);
  }
  const [ux, uz, L] = toward(e, p.x, p.z);
  e.dist = L;
  e.faceTo = Math.atan2(ux, uz);
  e.tgt = p;
  // Harpi fırtınası
  if (U.storm) {
    e.stormCd -= dt;
    if (e.cast) {
      e.cast.t -= dt;
      if (e.cast.t <= 0) {
        e.cast = null;
        if (Math.hypot(p.x - e.x, p.z - e.z) < U.storm.r + 0.5 && heroOk) {
          dealDamage(g, e, p, U.storm.dmg * (e.dmg / U.dmg), DMG.MAG, { src: 'storm' });
          g.emit('fx', { kind: 'zap', x0: e.x, z0: e.z, x1: p.x, z1: p.z });
        }
      }
      return STOP;
    }
    if (e.stormCd <= 0 && L < U.storm.r) {
      e.stormCd = U.storm.cd;
      e.cast = { kind: 'storm', t: U.storm.tele, dur: U.storm.tele, shape: 'mark', r: 0.9, follow: true };
      g.emit('bossTele', { foe: e, kind: 'storm' });
      return STOP;
    }
  }
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) resolveAttack(e, g);
    return STOP;
  }
  if (L - 0.35 - e.r <= U.range) {
    if (e.attackCd <= 0 && !cantAttack(e)) {
      e.windup = U.windup;
      e.attackCd = U.atkRate;
      g.emit('windup', { foe: e });
    }
    return STOP;
  }
  return { mx: ux, mz: uz, spd: e.speed };
}

// ------------------------------------------------------------------ boss ortakları
function bossPhase(g, e, phase, text) {
  e.phase = phase;
  e.phaseText = text;
  g.emit('bossPhase', { foe: e, boss: e.def.id, phase, text });
}
/** Boss yakın dövüş saldırısı (telgraflı). Dönen: niyet ya da null. */
function bossMelee(e, g, dt, L) {
  const U = e.def;
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) { e.tgt = g.player; resolveAttack(e, g); }
    return STOP;
  }
  if (L - 0.35 - e.r <= U.range) {
    if (e.attackCd <= 0 && !cantAttack(e)) {
      e.windup = U.windup;
      e.attackCd = U.atkRate * (e.enraged ? 0.8 : 1);
      g.emit('windup', { foe: e });
    }
    return STOP;
  }
  return null;
}
function tickBoss(e, dt) {
  if (e.attackCd > 0) e.attackCd -= dt;
  if (e.warCry > 0) { e.warCry -= dt; if (e.warCry <= 0) e.armorBuff = 0; }
  e.t1 -= dt;
  e.t2 -= dt;
  e.t3 -= dt;
}

// ------------------------------------------------------------------ Roshan
export function thinkRoshan(e, g, dt) {
  const p = g.player;
  const st = e.st;
  const U = e.def;
  e.status = null;
  if (st.stun > 0) { e.status = 'stun'; return STOP; }
  if (g.state === 'idle' || g.state === 'over') return STOP;
  const home = e.home || { x: ROSHAN_PIT.x, z: ROSHAN_PIT.z, leash: ROSHAN_PIT.leash };
  const dp = Math.hypot(p.x - home.x, p.z - home.z);
  const heroOk = heroOkFor(g);
  const engaged = heroOk && (dp < home.leash + (e.angry ? 2.2 : 0.8) || st.taunt > 0);
  const [ux, uz, L] = toward(e, p.x, p.z);
  e.dist = L;
  if (e.attackCd > 0) e.attackCd -= dt;
  e.slamCd -= dt;
  e.roarCd -= dt;
  if (e.cast) {
    e.cast.t -= dt;
    e.faceTo = Math.atan2(ux, uz);
    if (e.cast.t <= 0) {
      const c = e.cast;
      e.cast = null;
      const d = Math.hypot(p.x - e.x, p.z - e.z);
      if (c.kind === 'slam') {
        g.emit('roshanSlam', { foe: e, x: e.x, z: e.z, r: c.r });
        if (d < c.r + 0.3 && heroOk) {
          dealDamage(g, e, p, e.slamDmg, DMG.MAG, { src: 'slam', pierce: true });
          applyStatus(g, p, 'slow', 2, { k: 0.4 });
          const k = Math.max(0.2, 1 - d / c.r);
          p.kx += ((p.x - e.x) / (d || 1)) * 9 * k;
          p.kz += ((p.z - e.z) / (d || 1)) * 9 * k;
        }
      } else {
        g.emit('roshanRoar', { foe: e, x: e.x, z: e.z, r: c.r });
        if (d < c.r && heroOk) {
          dealDamage(g, e, p, U.roar.dmg, DMG.MAG, { src: 'roar' });
          if (applyStatus(g, p, 'stun', U.roar.stun)) g.emit('heroStunned', { t: U.roar.stun });
        }
      }
    }
    return STOP;
  }
  if (!engaged) {
    e.angry = false;
    e.windup = 0;
    const [hx, hz, hd] = toward(e, home.x, home.z);
    if (hd > 0.5) { e.status = 'home'; return { mx: hx, mz: hz, spd: e.speed * 1.2 }; }
    if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);
    e.status = 'sleep';
    e.faceTo = Math.PI * 0.25;
    return STOP;
  }
  e.angry = true;
  e.faceTo = Math.atan2(ux, uz);
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) { e.tgt = p; resolveAttack(e, g); }
    return STOP;
  }
  if (e.roarCd <= 0 && L < U.roar.r - 0.4) {
    e.cast = { kind: 'roar', t: U.roar.tele, dur: U.roar.tele, r: U.roar.r, shape: 'circle', color: 'gold' };
    e.roarCd = U.roar.cd;
    g.emit('roshanTele', { foe: e, kind: 'roar', r: U.roar.r, t: U.roar.tele });
    return STOP;
  }
  if (e.slamCd <= 0 && L < U.slam.r - 0.5) {
    e.cast = { kind: 'slam', t: U.slam.tele, dur: U.slam.tele, r: U.slam.r, shape: 'circle', color: 'blood' };
    e.slamCd = U.slam.cd;
    g.emit('roshanTele', { foe: e, kind: 'slam', r: U.slam.r, t: U.slam.tele });
    return STOP;
  }
  if (L - 0.35 - e.r <= U.range) {
    if (e.attackCd <= 0 && !cantAttack(e)) {
      e.windup = U.windup;
      e.attackCd = U.atkRate;
      g.emit('windup', { foe: e });
    }
    return STOP;
  }
  return { mx: ux, mz: uz, spd: e.speed };
}

// ------------------------------------------------------------------ Feed Alfa
export function thinkFeedAlfa(e, g, dt) {
  const p = g.player;
  const U = e.def;
  e.status = null;
  if (g.state === 'idle' || g.state === 'over') return STOP;
  tickBoss(e, dt);
  // evreler
  if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
    e.enraged = true;
    e.speed = U.speed * 1.3;
    bossPhase(g, e, 2, 'ÖFKE: daha hızlı dalar');
  }
  const wantPups = e.hp < e.maxHp * 0.66 ? (e.hp < e.maxHp * 0.33 ? 2 : 1) : 0;
  if (e.summoned < wantPups) {
    e.summoned += 1;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + e.seed;
      g.spawnDog('feed', { x: e.x + Math.sin(a) * 1.6, z: e.z + Math.cos(a) * 1.6, summon: true });
    }
    g.emit('bossSummon', { foe: e, text: 'Yavrular geldi!' });
  }
  // dalış
  if (e.dash) {
    const D = e.dash;
    const step = U.dash.speed * dt;
    e.x += D.ux * step;
    e.z += D.uz * step;
    D.left -= step;
    e.faceTo = Math.atan2(D.ux, D.uz);
    e.status = 'dash';
    if (!D.hit && heroOkFor(g) && Math.hypot(p.x - e.x, p.z - e.z) < e.r + 0.55) {
      D.hit = true;
      dealDamage(g, e, p, e.dmg * 1.6, DMG.PHYS, { src: 'dash' });
      applyStatus(g, p, 'stun', U.dash.stun);
      p.kx += D.ux * 7;
      p.kz += D.uz * 7;
    }
    if (D.left <= 0 || Math.hypot(e.x, e.z) > PLAY_R - 1) { e.dash = null; e.t1 = U.dash.cd * (e.enraged ? 0.6 : 1); }
    return STOP;
  }
  const cc = ccIntent(e, g);
  if (cc) { e.cast = null; return cc; }
  const [ux, uz, L] = toward(e, p.x, p.z);
  e.dist = L;
  e.faceTo = Math.atan2(ux, uz);
  if (!heroOkFor(g)) { e.cast = null; e.windup = 0; return { mx: ux, mz: uz, spd: e.speed * 0.4 }; }
  if (e.cast) {
    e.cast.t -= dt;
    if (e.cast.t <= 0) {
      const c = e.cast;
      e.cast = null;
      e.dash = { ux: Math.sin(c.ang), uz: Math.cos(c.ang), left: c.len, hit: false };
      g.emit('bossAct', { foe: e, kind: 'dash' });
    }
    return STOP;
  }
  if (e.t1 <= 0 && L < 11) {
    const len = Math.max(6, Math.min(U.dash.len, L + 3));
    e.cast = { kind: 'dash', t: U.dash.tele * (e.enraged ? 0.8 : 1), dur: U.dash.tele * (e.enraged ? 0.8 : 1), shape: 'line', ang: Math.atan2(ux, uz), len, w: U.dash.w, x: e.x, z: e.z, color: 'blood' };
    g.emit('bossTele', { foe: e, kind: 'dash' });
    return STOP;
  }
  const m = bossMelee(e, g, dt, L);
  if (m) return m;
  return { mx: ux, mz: uz, spd: e.speed };
}

// ------------------------------------------------------------------ Gölge Ulusu
export function thinkShadow(e, g, dt) {
  const p = g.player;
  const U = e.def;
  e.status = null;
  if (g.state === 'idle' || g.state === 'over') return STOP;
  tickBoss(e, dt);
  const night = g.isNight;
  e.nightBoost = night ? 1.25 : 1;
  if (e.phase === 1 && e.hp < e.maxHp * 0.5) bossPhase(g, e, 2, 'Karanlık derinleşiyor');
  // görünmezlik
  if (e.stealth > 0) {
    e.stealth -= dt;
    e.vis = Math.max(0.1, e.vis - dt * 2);
    if (e.stealth <= 0) { e.vis = 1; e.t3 = 0; }
  } else e.vis = Math.min(1, e.vis + dt * 2);
  const [ux, uz, L] = toward(e, p.x, p.z);
  e.dist = L;
  e.faceTo = Math.atan2(ux, uz);
  if (e.cast) {
    e.cast.t -= dt;
    if (e.cast.follow === false && e.cast.kind === 'pounce') { /* sabit nokta */ }
    if (e.cast.t <= 0) {
      const c = e.cast;
      e.cast = null;
      if (c.kind === 'pounce') {
        e.x = c.x - Math.sin(c.ang) * 0.4;
        e.z = c.z - Math.cos(c.ang) * 0.4;
        g.emit('bossAct', { foe: e, kind: 'pounce', x: c.x, z: c.z, r: c.r });
        if (heroOkFor(g) && Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.3) {
          dealDamage(g, e, p, e.dmg * 1.7 * e.nightBoost, DMG.PHYS, { src: 'pounce' });
          applyStatus(g, p, 'slow', 1.5, { k: 0.4 });
        }
      } else if (c.kind === 'howl') {
        g.emit('bossAct', { foe: e, kind: 'howl', x: e.x, z: e.z, r: c.r });
        if (heroOkFor(g) && Math.hypot(p.x - e.x, p.z - e.z) < c.r) {
          dealDamage(g, e, p, U.howl.dmg * (e.dmg / U.dmg), DMG.MAG, { src: 'howl' });
          if (applyStatus(g, p, 'fear', U.howl.fear, { x: e.x, z: e.z })) g.emit('heroFeared', { t: U.howl.fear });
        }
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          g.spawnDog('ward', { x: e.x + Math.sin(a) * 2, z: e.z + Math.cos(a) * 2, summon: true });
        }
      }
    }
    return STOP;
  }
  const cc = ccIntent(e, g);
  if (cc) return cc;
  if (!heroOkFor(g)) { e.windup = 0; return { mx: ux, mz: uz, spd: e.speed * 0.4 }; }
  // karanlığa karış
  if (e.t1 <= 0 && !(e.stealth > 0)) {
    e.stealth = U.stealth.dur;
    e.t1 = U.stealth.cd * (night ? 0.7 : 1) * (e.phase === 2 ? 0.8 : 1);
    e.t3 = 99;
    g.emit('bossAct', { foe: e, kind: 'stealth' });
  }
  // görünmezlikten çıkınca / yakınken sıçra
  if (!(e.stealth > 0) && e.t3 <= 0 && L < 7) {
    e.t3 = 99;
    e.cast = { kind: 'pounce', t: U.pounce.tele, dur: U.pounce.tele, shape: 'circle', r: U.pounce.r, x: p.x, z: p.z, ang: Math.atan2(ux, uz), color: 'arcane', fixed: true };
    g.emit('bossTele', { foe: e, kind: 'pounce' });
    return STOP;
  }
  if (e.t2 <= 0 && L < U.howl.r - 0.5 && !(e.stealth > 0)) {
    e.t2 = U.howl.cd;
    e.cast = { kind: 'howl', t: U.howl.tele, dur: U.howl.tele, shape: 'circle', r: U.howl.r, color: 'arcane' };
    g.emit('bossTele', { foe: e, kind: 'howl' });
    return STOP;
  }
  if (e.stealth > 0) return { mx: ux, mz: uz, spd: e.speed * 1.15 };
  const m = bossMelee(e, g, dt, L);
  if (m) return m;
  return { mx: ux, mz: uz, spd: e.speed * (night ? 1.1 : 1) };
}

// ------------------------------------------------------------------ Dire Generali
export function thinkGeneral(e, g, dt) {
  const p = g.player;
  const U = e.def;
  e.status = null;
  if (g.state === 'idle' || g.state === 'over') return STOP;
  tickBoss(e, dt);
  if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
    e.speed = U.speed * 1.2;
    e.enraged = true;
    bossPhase(g, e, 2, 'SON HÜCUM: takviyeler hızlandı');
  }
  const [ux, uz, L] = toward(e, p.x, p.z);
  e.dist = L;
  if (e.cast) {
    e.cast.t -= dt;
    if (e.cast.t <= 0) {
      const c = e.cast;
      e.cast = null;
      if (c.kind === 'cleave') {
        e.lunge = 0.3;
        g.emit('bossAct', { foe: e, kind: 'cleave', x: e.x, z: e.z, r: c.r, ang: c.ang, arc: c.arc });
        const dx = p.x - e.x;
        const dz = p.z - e.z;
        const d = Math.hypot(dx, dz);
        let da = Math.atan2(dx, dz) - c.ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (heroOkFor(g) && d < c.r + 0.35 && Math.abs(da) <= c.arc / 2 + 0.15) {
          dealDamage(g, e, p, e.dmg * (e.warCry > 0 ? 1 + U.warcry.dmg : 1), DMG.PHYS, { attack: true, src: 'cleave' });
        }
      } else if (c.kind === 'warcry') {
        e.warCry = U.warcry.dur;
        e.warCryK = U.warcry.dmg;
        e.armorBuff = U.warcry.armor;
        let n = 0;
        for (const o of g.foes) {
          if (o.dead || o.kind !== 'creep' || Math.hypot(o.x - e.x, o.z - e.z) > U.warcry.r) continue;
          o.warCry = U.warcry.dur;
          o.warCryK = 0.3;
          n += 1;
        }
        g.emit('bossAct', { foe: e, kind: 'warcry', x: e.x, z: e.z, r: U.warcry.r, n });
      }
    }
    return STOP;
  }
  // takviye
  if (e.t2 <= 0) {
    e.t2 = e.enraged ? U.summon.cd2 : U.summon.cd;
    const n = g.spawnCreeps(['melee', 'melee', 'ranged'], { x: e.x, z: e.z, summon: true });
    if (n) g.emit('bossSummon', { foe: e, text: 'Takviye geldi!' });
  }
  const cc = ccIntent(e, g);
  if (cc) return cc;
  e.faceTo = Math.atan2(ux, uz);
  if (!heroOkFor(g)) return { mx: ux, mz: uz, spd: e.speed * 0.5 };
  if (e.t1 <= 0) {
    e.t1 = U.warcry.cd;
    e.cast = { kind: 'warcry', t: U.warcry.tele, dur: U.warcry.tele, shape: 'circle', r: U.warcry.r, color: 'gold', soft: true };
    g.emit('bossTele', { foe: e, kind: 'warcry' });
    return STOP;
  }
  if (L - 0.35 - e.r <= U.cleave.r - 0.6) {
    if (e.attackCd <= 0 && !cantAttack(e)) {
      e.attackCd = U.atkRate * (e.enraged ? 0.8 : 1);
      e.cast = { kind: 'cleave', t: U.windup, dur: U.windup, shape: 'cone', r: U.cleave.r, ang: Math.atan2(ux, uz), arc: U.cleave.arc, color: 'blood' };
      g.emit('bossTele', { foe: e, kind: 'cleave' });
    }
    return STOP;
  }
  return { mx: ux, mz: uz, spd: e.speed * (e.warCry > 0 ? 1.15 : 1) };
}

// ------------------------------------------------------------------ Sonsuz Pub'ın Kalbi
export function thinkAncient(e, g, dt) {
  const p = g.player;
  const U = e.def;
  e.status = null;
  if (g.state === 'idle' || g.state === 'over') return STOP;
  tickBoss(e, dt);
  e.faceTo = e.face + dt * 0.3;
  // kalkan evresi
  if (e.shieldIdx < U.shieldAt.length && e.hp < e.maxHp * U.shieldAt[e.shieldIdx]) {
    e.shieldIdx += 1;
    e.invuln = 9999;
    e.guards = 0;
    for (let i = 0; i < U.guards; i++) {
      const a = (i / U.guards) * Math.PI * 2 + e.seed;
      const d = g.spawnDog(['mid', 'rapier', 'smurf', 'feed'][i % 4], { x: e.x + Math.sin(a) * 3.2, z: e.z + Math.cos(a) * 3.2, elite: true, summon: true });
      if (d) { d.guardOf = e; e.guards += 1; }
    }
    bossPhase(g, e, e.phase + 1, 'KALKAN: muhafızları indir!');
  }
  if (e.invuln > 0 && e.guards <= 0) {
    e.invuln = 0;
    g.emit('bossShieldBreak', { foe: e });
  }
  // DOG dalgaları
  if (e.t2 <= 0) {
    e.t2 = U.dogs.cd;
    let alive = 0;
    for (const o of g.foes) if (o.kind === 'dog' && !o.dead) alive += 1;
    const n = Math.min(U.dogs.n, 9 - alive);
    for (let i = 0; i < n; i++) g.spawnDogAtGate(null, { summon: true });
    if (n > 0) g.emit('bossSummon', { foe: e, text: 'Pub yeni DOG’lar kustu' });
  }
  const heroOk = heroOkFor(g);
  const [ux, uz, L] = toward(e, p.x, p.z);
  e.dist = L;
  if (e.cast) {
    e.cast.t -= dt;
    if (e.cast.t <= 0) {
      const c = e.cast;
      e.cast = null;
      g.emit('bossAct', { foe: e, kind: 'pulse', x: e.x, z: e.z, r: c.r, inner: c.inner, ring: c.shape === 'ring' });
      const inZone = c.shape === 'ring' ? (L >= c.inner && L <= c.r) : L <= c.r;
      if (heroOk && inZone) {
        dealDamage(g, e, p, U.pulse.dmg * (e.dmg / U.dmg), DMG.MAG, { src: 'pulse' });
        applyStatus(g, p, 'slow', 1.5, { k: 0.35 });
      }
    }
  } else if (e.t1 <= 0) {
    e.t1 = U.pulse.cd * (e.invuln > 0 ? 1.3 : 1);
    const inner = e.pulseKind === 'inner';
    e.pulseKind = inner ? 'outer' : 'inner';
    e.cast = inner
      ? { kind: 'pulse', t: U.pulse.tele, dur: U.pulse.tele, shape: 'circle', r: U.pulse.inner, color: 'blood' }
      : { kind: 'pulse', t: U.pulse.tele, dur: U.pulse.tele, shape: 'ring', inner: U.pulse.inner, r: U.pulse.outer, color: 'blood' };
    g.emit('bossTele', { foe: e, kind: inner ? 'pulseIn' : 'pulseOut' });
  }
  // menzilli saldırı
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) { e.tgt = p; resolveAttack(e, g); }
  } else if (heroOk && L < U.range && e.attackCd <= 0 && !e.st.stun) {
    e.windup = U.windup;
    e.attackCd = U.atkRate;
  }
  void ux;
  void uz;
  return STOP;
}

/** Düşünce fonksiyonları (UNITS[...].ai). DOG'lar dogs.js thinkDog ile ayrı yürür. */
export const THINK = {
  creep: thinkCreep,
  neutral: thinkNeutral,
  roshan: thinkRoshan,
  feedalfa: thinkFeedAlfa,
  shadow: thinkShadow,
  general: thinkGeneral,
  ancient: thinkAncient,
};

// ------------------------------------------------------------------ kuleler
export function stepTowers(g, dt) {
  const p = g.player;
  const live = g.state === 'playing' || g.state === 'break' || g.state === 'dying';
  for (const t of g.towers) {
    if (t.hitFlash > 0) t.hitFlash -= dt;
    if (t.shotT > 0) t.shotT -= dt;
    if (t.dead) { t.deadT += dt; continue; }
    if (t.barkT > 0) {
      t.barkT -= dt;
      t.hp = Math.min(t.maxHp, t.hp + (t.barkRegen || 0) * dt);
      if (t.barkT <= 0) t.armorBuff = 0;
    }
    if (!live) continue;
    t.cd -= dt;
    const U = t.def;
    const R = U.range;
    if (t.side === 'radiant') {
      const cur = t.tgt;
      const okT = (e) => e && !e.dead && e.spawnT <= 0 && e.kind !== 'neutral' && e.seen !== false && !(e.vis < 0.3) && !(e.invuln > 0);
      if (!(okT(cur) && Math.hypot(cur.x - t.x, cur.z - t.z) <= R + cur.r)) {
        t.tgt = null;
        let bd = Infinity;
        for (const e of g.foes) {
          if (!okT(e) || e.demo) continue;
          const q = Math.hypot(e.x - t.x, e.z - t.z) - e.r;
          if (q <= R && q < bd) { bd = q; t.tgt = e; }
        }
      }
    } else {
      // Dire kulesi kahramana kilitlenmek için kısa bir süre ister (menzil halkası uyarır)
      const ok = g.heroVisible && !p.dead && Math.hypot(p.x - t.x, p.z - t.z) <= R + 0.3;
      t.lock = ok ? (t.lock || 0) + dt : 0;
      t.tgt = ok && t.lock >= (U.lockOn || 0) ? p : null;
    }
    if (t.tgt && t.cd <= 0) {
      t.cd = U.atkRate;
      t.shotT = 0.25;
      const dmg = U.dmg * (1 + (t.side === 'dire' ? 0.1 : 0.14) * ((g.scaleWave ? g.scaleWave() : g.wave) - 1)) * (t.side === 'dire' ? g.mods.enemyDmg || 1 : 1);
      g.fireProj({ from: t, kind: U.proj, target: t.tgt, dmg, type: DMG.PHYS, speed: 15, y: 3.1 });
      g.emit('towerShot', { tower: t, target: t.tgt });
    }
  }
}

/** Birim hareketi sonrası ortak çarpışma: ağaç/kule it, arenada tut. */
export function collide(u, g, rad) {
  pushOut(u, rad, g.towers);
  const r = Math.hypot(u.x, u.z);
  const lim = g.PLAY_R - rad * 0.5;
  if (r > lim) { u.x *= lim / r; u.z *= lim / r; }
}

export { CAMPS };
