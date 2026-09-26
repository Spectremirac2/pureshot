// 1vDOQUZ Arena 3.0 — oyun simülasyonu (görüntüden bağımsız).
// Sabit zaman adımıyla ilerler; görüntü katmanı (3D ya da 2D yedek) durumu okur ve emit() olaylarından efekt üretir.
//
// Genişletme noktaları (bkz. docs/oyunlar/arena.md → Mimari):
//   createGame(emit, config)  config = { mode, heroId, seed, curse, modifiers, waves, objectives, meta, mission }
//   g.on(type, fn) / g.off     olay veri yolu (runStart, waveStart, waveEnd, unitKilled, bossKilled, itemBought,
//                              levelUp, objective, runEnd + görsel olaylar)
//   g.hooks                    { beforeDamage, afterDamage, onKill, onStep } dizileri
//   g.spawnUnit(id, opts)      hikâye görevleri için birim/boss doğurma (units.js kimlikleri)
//   Hasar: combat.js dealDamage · Durumlar: combat.js applyStatus

import { buildWave, waveScale, thinkDog, tryBite, archOf, TYPE_IDS, DOG_TYPES } from './dogs.js';
import { heroOf, xpFor, MAX_LEVEL, TALENT_LEVELS, HERO_IDS, ATTR, HERO_MR, ABILITY_MAX, STATS_MAX, abilityCap, attrAt } from './heroes.js';
import { ITEMS, SLOTS, RUNES, RUNE_IDS, NEUTRALS, NEUTRAL_IDS, neutralTier, NEUTRAL_PER_TIER, totalCost, isRecipe } from './items.js';
import { ABILITIES, abilityCtx, STATS_BONUS, targetingOf } from './abilities.js';
import { DMG, applyStatus, dealDamage, newStatus, tickStatus, slowMul, dispel, cantCast, cantAttack } from './combat.js';
import { UNITS, CAMP_UNITS, unitId, makeCreep, makeBoss, makeNeutral, makeTowers, THINK, stepTowers, collide } from './units.js';
import { ARENA_R, PLAY_R, DOG_GATES, FOUNTAIN, RUNE_SPOTS, DIRE_GATE, TOWER_R, ROSHAN_PIT, CAMPS, pushOut, steerAround } from './map.js';
import { seeded, shuffle } from '../../../core/dom.js';

export { ARENA_R, PLAY_R, GATE_ANGLES } from './map.js';
export { ABIL } from './abilities.js';
export const STEP = 1 / 60;

const MULTI = [null, null, ['DOUBLE KILL', 50], ['TRIPLE KILL', 150], ['ULTRA KILL', 300], ['RAMPAGE!', 500]];
const STREAK = { 3: 'KILLING SPREE', 4: 'DOMINATING', 5: 'MEGA KILL', 6: 'UNSTOPPABLE', 7: 'WICKED SICK', 8: 'MONSTER KILL', 9: 'GODLIKE', 10: 'BEYOND GODLIKE' };
export const BREAK_T = 16;
const FIRST_RUNE = 14;
const RUNE_EVERY = 40;
const MAX_CREEPS = 8;
const MAX_FOES = 40;
const LAST_HIT = 10; // son vuruş altın bonusu (+dalga)
const HERO_R = 0.35;
export const DAY_LEN = 120;
export const NIGHT_LEN = 120;
export const NIGHT_VISION = 8.5;
const TOWER_VISION = 6;
const WARD_VISION = 8;
const CAMP_EVERY = 60;
const FIRST_CAMP = 18;
export const BUYBACK_CD = 150;
const BUYBACK_WINDOW = 6;
const DEATH_LOSS = 0.4; // ölünce güvenilmez altının kaybedilen oranı
/** Sonsuz modda her 5. dalganın bossu (tek katlar Roshan). */
const ENDLESS_BOSSES = ['boss_feedalfa', 'boss_shadow', 'boss_general', 'boss_ancient'];

/**
 * Varsayılan koşu ayarı.
 * modifiers: startGold, startLevel, heroHp, heroDmg, enemyHp, enemyDmg, enemySpeed, bossHp, gold, xp (çarpanlar),
 *            shopCost (çarpan), noCourier, alwaysNight, dayLen, nightLen, roshanEvery, extraElites, noBuyback,
 *            noCamps, scoreMul, autoLearn
 * meta (progression.js applyMeta): { startItems: [id], mastery, variants: { abilityId: key }, bonus: { stat… } }
 * mission (story.js): { waves, objectives, boss, dialogue, victory: 'objectives'|'waves', failOnObjective }
 */
export const DEFAULT_CONFIG = { mode: 'endless', heroId: 'okcu', seed: null, curse: 0, modifiers: {}, waves: null, objectives: [], meta: null, mission: null };

/**
 * Lanet seviyeleri (1–10) → varsayılan değiştiriciler (birikimli). Açık `modifiers` alanları bunları ezer.
 * Skor çarpanı: 1 + 0,12 × lanet.
 */
export function curseMods(level = 0) {
  const n = Math.max(0, Math.min(10, Math.floor(level) || 0));
  const m = {};
  if (n <= 0) return m;
  if (n >= 1) m.enemySpeed = 1.1;
  if (n >= 2) m.enemyHp = 1.15;
  if (n >= 3) m.shopCost = 1.2;
  if (n >= 4) { m.dayLen = 60; m.nightLen = 180; }
  if (n >= 5) m.noCourier = true;
  if (n >= 6) m.enemyDmg = 1.2;
  if (n >= 7) m.roshanEvery = 4;
  if (n >= 8) m.extraElites = 2;
  if (n >= 9) m.alwaysNight = true;
  if (n >= 10) m.gold = 0.75;
  m.scoreMul = 1 + 0.12 * n;
  return m;
}
export const CURSE_TEXT = [
  '', 'DOG’lar %10 hızlı', 'Düşman canı +%15', 'Dükkân %20 pahalı', 'Geceler uzun', 'Kurye yok',
  'Düşman hasarı +%20', 'Roshan her 4 dalgada', '+2 elit', 'Hep gece', 'Altın −%25',
];

/**
 * Varsayılan dalga üreticisi. Hikâye modu mission.waves (ya da config.waves) ile aynı şemada dalga verebilir:
 *   { dogs: ['feed', …], elites: n, creepSquads: n, boss: null|'roshan'|'boss_general'|…, bossLevel: k,
 *     bossAt: 'pit'|'center'|'dire'|'gate'|{x,z}, units: [{ id, n, at, elite, counted, delay, k }],
 *     night: true|false, camps: true|false, text: 'duyuru' }
 */
export function defaultWave(n, mods = {}) {
  const every = mods.roshanEvery || 5;
  const ws = waveScale(n);
  const elites = Math.min(8, ws.elites + (mods.extraElites || 0));
  if (n % every === 0) {
    const idx = n / every;
    const boss = idx % 2 === 1 ? 'boss_roshan' : ENDLESS_BOSSES[(idx / 2 - 1) % ENDLESS_BOSSES.length];
    return { dogs: shuffle(TYPE_IDS).slice(0, boss === 'boss_roshan' ? 5 : 4), elites: Math.max(0, elites - 1), creepSquads: 0, boss, bossLevel: idx };
  }
  return { dogs: buildWave(n), elites, creepSquads: Math.min(3, 1 + Math.floor((n - 1) / 3)), boss: null };
}

export function createGame(emit, config = {}) {
  let nextId = 1;
  const listeners = new Map();
  const g = {
    PLAY_R,
    dogGates: DOG_GATES,
    config: { ...DEFAULT_CONFIG, ...config },
    mods: {},
    state: 'idle', // idle | playing | break | dying | over
    time: 0,
    wave: 0,
    score: 0,
    kills: 0,
    shots: 0,
    hitShots: 0,
    waveShots: 0,
    waveHitShots: 0,
    waveDamage: 0,
    killsByType: {},
    chain: 0,
    lastKill: -10,
    bestChain: 0,
    streak: 0,
    firstBlood: false,
    foes: [],
    arrows: [],
    projs: [],
    bubbles: [],
    pickups: [],
    towers: [],
    runes: [],
    remnants: [],
    wards: [],
    zones: [],
    neutralOffer: null,
    rerollsLeft: 0,
    camps: [],
    courier: { state: 'home', x: FOUNTAIN.x, z: FOUNTAIN.z, y: 0, face: 0, items: [], t: 0 },
    queue: [],
    spawnT: 0,
    burst: 0,
    dogsLeft: 0,
    dogsTotal: 9,
    bossWave: false,
    bossId: null,
    breakT: 0,
    dyingT: 0,
    slowmo: 0,
    runeT: FIRST_RUNE,
    creepT: 0,
    squadsLeft: 0,
    ultKills: 0,
    damageTaken: 0,
    tangosUsed: 0,
    tangosStolen: 0,
    goldEarned: 0,
    lastHits: 0,
    denies: 0,
    creepKills: 0,
    neutralKills: 0,
    campsCleared: 0,
    runesTaken: 0,
    bossesKilled: 0,
    roshans: 0,
    towersDown: 0,
    buybacks: 0,
    deaths: 0,
    direMorale: 0,
    heroVisible: true,
    lastSeenX: 0,
    lastSeenZ: 0,
    target: null,
    lastAuto: true,
    isNight: false,
    dayT: 0,
    forceNight: null,
    campT: FIRST_CAMP,
    neutralDrops: { 1: 0, 2: 0, 3: 0 },
    neutralStash: [],
    objectives: [],
    H: null,
    heroId: 'okcu',
    player: null,
    stat: {},
    cds: { q: 0, w: 0, e: 0, r: 0 },
    cdMax: { q: 1, w: 1, e: 1, r: 1 },
    hooks: { beforeDamage: [], afterDamage: [], onKill: [], onStep: [] },
    rng: Math.random,
    timers: [],
  };
  g.nextId = () => nextId++;
  g.rand = () => g.rng();

  // ---------------------------------------------------------------- olay veri yolu
  g.on = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => g.off(type, fn);
  };
  g.off = (type, fn) => { listeners.get(type)?.delete(fn); };
  g.emit = (type, data) => {
    const d = data || {};
    emit(type, d);
    const a = listeners.get(type);
    if (a) for (const fn of a) { try { fn(d, g); } catch (e) { console.error(e); } }
    const all = listeners.get('*');
    if (all) for (const fn of all) { try { fn(type, d, g); } catch (e) { console.error(e); } }
  };
  /** Simülasyon zamanında gecikmeli iş (yetenek yankıları, boss dalgaları). */
  g.later = (t, fn) => { g.timers.push({ t, fn }); };
  /**
   * Alan etkisi (yetenek varyantları: ok yağmuru, gezgin tipi, çiçek alanı, koru, yem ikiz).
   * o: { kind, x, z, r, dur, every (sn), follow: 'hero'?, now (hemen bir kez), tick(g, zone) }
   */
  g.addZone = (o) => {
    const z = { id: nextId++, t: 0, acc: 0, every: 0.25, ...o };
    g.zones.push(z);
    if (z.now && z.tick) { try { z.tick(g, z); } catch (err) { console.error(err); } }
    g.emit('zone', { zone: z });
    return z;
  };

  // Boss'lara ek hasar (orman eşyası), yakın dövüş kahramanına blok dengesi
  g.hooks.beforeDamage.push((gg, s, t, a) => (s === gg.player && t.kind === 'boss' && gg.stat.bossDmg ? a * (1 + gg.stat.bossDmg) : undefined));

  // ---------------------------------------------------------------- kahraman
  function newPlayer(H) {
    return {
      hero: H.id,
      x: 0, z: 0, vx: 0, vz: 0, kx: 0, kz: 0, face: Math.PI, moving: 0,
      hp: 100, maxHp: 100, mana: 100, maxMana: 100,
      level: 1, xp: 0, gold: 0, goldR: 0,
      items: new Array(SLOTS).fill(null),
      neutral: null,
      tal: new Set(), talentChoice: {}, talentPending: [],
      abilityLv: { q: 1, w: 0, e: 0, r: 0 }, statsLv: 0, skillPoints: 0,
      st: newStatus(),
      charging: false, chargeT: 0, charge: 0, pendingFire: -1,
      aimX: 0, aimZ: -4,
      windrun: 0, windrunK: 1.6, windrunEv: 0.8, evadeBuff: 0, rapier: 0, tangoCharges: 0, tangoRegen: 0,
      heals: [],
      invis: 0, smokeT: 0, smokeK: 0, smokeBonus: null, guiseT: 0, guiseK: 0, guiseBonus: null, guiseHeal: 0,
      bkb: 0, haste: 0, hasteBuff: 0, hasteBuffK: 1, dd: 0, regenRune: 0, cyclone: 0, lsBuff: 0, lsBuffK: 1,
      callArmor: 0, callArmorK: 0, barkT: 0, barkArmor: 0, barkRegen: 0, barkBlock: 0, mekT: 0, mekArmor: 0,
      bonusArmor: 0, blockBuff: 0, shield: 0, shieldT: 0, magShield: 0, magShieldT: 0, eclipse: null,
      cullHaste: 0, auraT: 0, spinT: 0, helixIcd: 0, swing: 0, overload: false,
      channel: null, dance: null, ball: null,
      atkCd: 0, atkWind: 0, atkTarget: null,
      aegis: false, invuln: 0, hurtT: 0, recoil: 0, dead: false, reviveT: 0, lastHurt: -99,
      buybackCd: 0,
      inFountain: false, inRiver: false,
    };
  }

  function forAbilities(fn) {
    for (const key of ['q', 'w', 'e', 'r']) {
      const c = abilityCtx(g, key);
      if (c) fn(c.A, c);
    }
  }

  /** Türetilmiş statları özellikler, seviye, eşya, yetenek ağacı ve pasiflerden yeniden hesaplar. */
  function recalc() {
    const p = g.player;
    const H = g.H;
    const L = p.level;
    const b = H.base;
    const sum = {
      hp: 0, mana: 0, dmg: 0, dmgMul: 0, speed: 0, evasion: [], atkSpeed: 0, manaRegen: 0, hpRegen: 0, burn: 0, aghs: 0, spell: 0,
      crit: [], critMul: 0, cleave: 0, lifesteal: 0, spellLifesteal: 0, armor: 0, magicResist: [], statusRes: [],
      str: 0, agi: 0, int: 0, all: 0, primary: 0, block: 0, blockChance: 0, vision: 0, bossDmg: 0,
    };
    const add = (s) => {
      if (!s) return;
      for (const [k, v] of Object.entries(s)) {
        if (Array.isArray(sum[k])) sum[k].push(v);
        else if (k === 'critMul' || k === 'blockChance') sum[k] = Math.max(sum[k] || 0, v);
        else sum[k] = (sum[k] || 0) + v;
      }
    };
    for (const it of p.items) if (it) add(ITEMS[it.id]?.stat);
    if (p.neutral) add(NEUTRALS[p.neutral.id]?.stat);
    for (const lv of TALENT_LEVELS) {
      const i = p.talentChoice[lv];
      if (i != null && H.talents[lv]) add(H.talents[lv][i].stat);
    }
    if (g.meta && g.meta.bonus) add(g.meta.bonus);
    const m = g.mods;
    const extra = p.statsLv * STATS_BONUS.per + sum.all;
    const attr = {
      str: attrAt(H, 'str', L) + sum.str + extra + (H.attr === 'str' ? sum.primary : 0),
      agi: attrAt(H, 'agi', L) + sum.agi + extra + (H.attr === 'agi' ? sum.primary : 0),
      int: attrAt(H, 'int', L) + sum.int + extra + (H.attr === 'int' ? sum.primary : 0),
    };
    const prod = (list) => list.reduce((a, e) => a * (1 - e), 1);
    const ranged = !H.attack || H.attack.type === 'ranged';
    const aspd = attr.agi * ATTR.asPerAgi + sum.atkSpeed;
    const st = {
      str: attr.str, agi: attr.agi, int: attr.int, primary: H.attr,
      maxHp: Math.round((b.hp + attr.str * ATTR.hpPerStr + sum.hp) * (m.heroHp || 1)),
      maxMana: Math.round(b.mana + attr.int * ATTR.manaPerInt + sum.mana),
      hpRegen: b.hpRegen + attr.str * ATTR.regenPerStr + sum.hpRegen,
      manaRegen: b.manaRegen + attr.int * ATTR.mregenPerInt + sum.manaRegen,
      speed: b.speed + sum.speed,
      armor: b.armor + attr.agi * ATTR.armorPerAgi + sum.armor,
      evasion: 1 - (1 - (b.evasion || 0)) * prod(sum.evasion),
      magicResist: 1 - (1 - HERO_MR) * prod(sum.magicResist),
      statusRes: 1 - prod(sum.statusRes),
      dmgMul: 1 + sum.dmgMul,
      spellAmp: 1 + attr.int * ATTR.ampPerInt + sum.spell,
      atkDmg: (H.attack ? H.attack.dmg : H.baseDmg || 0) + attr[H.attr] * ATTR.dmgPerPrimary + sum.dmg,
      atkSpeed: aspd,
      atkRate: Math.max(0.25, (H.attack ? H.attack.bat : 1) / (1 + aspd / 100)),
      burn: sum.burn,
      aghs: sum.aghs > 0,
      crit: 1 - prod(sum.crit),
      critMul: Math.max(sum.critMul || 0, sum.crit.length ? 2 : 0),
      cleave: sum.cleave,
      lifesteal: sum.lifesteal,
      spellLifesteal: sum.spellLifesteal,
      block: sum.block * (ranged ? 0.5 : 1),
      blockChance: Math.min(1, sum.blockChance),
      vision: sum.vision,
      bossDmg: sum.bossDmg,
    };
    forAbilities((A, c) => { if (A.stats) A.stats(g, st, c); });
    g.stat = st;
    const dh = st.maxHp - p.maxHp;
    const dm = st.maxMana - p.maxMana;
    p.maxHp = st.maxHp;
    p.maxMana = st.maxMana;
    if (dh > 0) p.hp += dh;
    if (dm > 0) p.mana += dm;
    p.hp = Math.min(p.hp, p.maxHp);
    p.mana = Math.min(p.mana, p.maxMana);
  }
  g.recalc = recalc;

  g.setHero = (id) => {
    const H = heroOf(HERO_IDS.includes(id) ? id : 'okcu');
    g.H = H;
    g.heroId = H.id;
    g.player = newPlayer(H);
    g.stat = {};
    recalc();
    g.player.hp = g.player.maxHp;
    g.player.mana = g.player.maxMana;
    g.cds = { q: 0, w: 0, e: 0, r: 0 };
    g.cdMax = { q: 1, w: 1, e: 1, r: 1 };
    forAbilities((A, c) => { if (A.onLearn) A.onLearn(g, c); });
    g.emit('heroChange', { heroId: H.id });
  };

  g.hasItem = (id) => g.player.items.some((it) => it && it.id === id);
  g.doubleDmg = () => g.player.dd > 0 || g.player.rapier > 0;
  g.dmgMul = (spell) => g.stat.dmgMul * (g.doubleDmg() ? 2 : 1) * (spell ? g.stat.spellAmp : 1) * (g.mods.heroDmg || 1);
  g.canAct = () => {
    const p = g.player;
    return (g.state === 'playing' || g.state === 'break') && !p.dead && !(p.st.stun > 0) && !(p.st.hex > 0) && !(p.st.fear > 0) && !p.dance && !p.ball && !(p.cyclone > 0);
  };
  g.setCd = (key, v) => { g.cds[key] = v; g.cdMax[key] = Math.max(0.01, v); };
  g.breakInvis = () => {
    const p = g.player;
    if (p.invis > 0) { p.invis = 0; p.smokeT = 0; p.guiseT = 0; g.emit('invisEnd', {}); }
  };
  g.variant = (abilityId) => (g.meta && g.meta.variants ? g.meta.variants[abilityId] || null : null);

  /** Hedef seçimi: elle nişan noktasına yakın düşman, yoksa otomatik hedef, yoksa menzildeki en yakın. */
  g.pickTarget = (range) => {
    const p = g.player;
    const ok = (e) => e && !e.dead && e.kind !== 'tower' && e.spawnT <= 0 && !e.demo && e.seen !== false && !(e.invuln > 0 && e.kind !== 'boss') && Math.hypot(e.x - p.x, e.z - p.z) <= range + e.r;
    if (!g.lastAuto) {
      const f = g.foeNear(p.aimX, p.aimZ, 2.2);
      if (ok(f)) return f;
    }
    if (ok(g.target)) return g.target;
    return g.nearestFoe(p.x, p.z, range, null);
  };
  g.nearestFoe = (x, z, range, exclude) => {
    let best = null;
    let bd = Infinity;
    for (const e of g.foes) {
      if (e.dead || e.spawnT > 0 || e.demo || e === exclude || e.seen === false) continue;
      const d = Math.hypot(e.x - x, e.z - z) - e.r;
      if (d <= range && d < bd) { bd = d; best = e; }
    }
    return best;
  };
  /** Nişan noktası (menzile kırpılmış). */
  g.aimPoint = (range) => {
    const p = g.player;
    let dx = p.aimX - p.x;
    let dz = p.aimZ - p.z;
    const L = Math.hypot(dx, dz);
    if (L < 0.2) return { x: p.x + Math.sin(p.face) * Math.min(range, 4), z: p.z + Math.cos(p.face) * Math.min(range, 4) };
    if (L > range) { dx *= range / L; dz *= range / L; }
    return { x: p.x + dx, z: p.z + dz };
  };

  // ---------------------------------------------------------------- yetenek puanları
  g.abilityLevel = (key) => (key === 'stats' ? g.player.statsLv : g.player.abilityLv[key] || 0);
  g.maxAbilityLevel = (key) => {
    if (key === 'stats') return STATS_MAX;
    const A = ABILITIES[g.H.abilities[key]];
    return A ? Math.min(ABILITY_MAX[key], A.levels.length) : 0;
  };
  /** Bu yetenek şimdi öğrenilebilir mi? */
  g.canLearn = (key) => {
    const p = g.player;
    if (p.skillPoints <= 0) return false;
    if (key === 'stats') return p.statsLv < STATS_MAX;
    const lv = p.abilityLv[key] || 0;
    return lv < g.maxAbilityLevel(key) && lv < abilityCap(key, p.level);
  };
  g.learnable = () => ['q', 'w', 'e', 'r', 'stats'].filter((k) => g.canLearn(k));
  /** Yetenek puanı harca (Q W E R ya da 'stats' = özellik bonusu). */
  g.learn = (key) => {
    const p = g.player;
    if (!g.canLearn(key)) { g.emit('learnFail', { key }); return false; }
    p.skillPoints -= 1;
    if (key === 'stats') p.statsLv += 1;
    else {
      p.abilityLv[key] = (p.abilityLv[key] || 0) + 1;
      const c = abilityCtx(g, key);
      if (c && c.A.onLearn) c.A.onLearn(g, c);
    }
    recalc();
    g.emit('learn', { key, level: g.abilityLevel(key), points: p.skillPoints });
    return true;
  };
  /** Otomatik dağıtım: önce ulti, sonra kahramanın yapı sırası, en son özellik bonusu. */
  g.autoLearn = () => {
    const p = g.player;
    let guard = 30;
    while (p.skillPoints > 0 && guard-- > 0) {
      let k = null;
      if (g.canLearn('r')) k = 'r';
      else {
        const counts = { q: 0, w: 0, e: 0, r: 0 };
        for (const key of g.H.build || ['q', 'w', 'e']) {
          counts[key] += 1;
          if ((p.abilityLv[key] || 0) < counts[key] && g.canLearn(key)) { k = key; break; }
        }
        if (!k) k = ['q', 'w', 'e'].find((x) => g.canLearn(x)) || (g.canLearn('stats') ? 'stats' : null);
      }
      if (!k) break;
      g.learn(k);
    }
  };

  /** Genel yetenek kullanımı (Q W E R). */
  g.cast = (key) => {
    const p = g.player;
    const c = abilityCtx(g, key);
    if (!c) { if (g.canAct()) g.emit('unlearned', { key }); return false; }
    const { A, L } = c;
    const tg = targetingOf(g, key);
    if (tg === 'charge') { g.chargeStart(); return true; }
    if (!g.canAct()) return false;
    if (tg === 'passive') { g.emit('passive', { key }); return false; }
    if (cantCast(p)) { g.emit('silenced', { key }); return false; }
    if (p.channel) return false;
    if (g.cds[key] > 0) { g.emit('notReady', { key }); return false; }
    const mana = A.ownCost ? 0 : (L.mana || 0);
    if (p.mana < mana) { g.emit('noMana', { key }); return false; }
    if (A.canCast && !A.canCast(g, c)) return false;
    if (!A.cast(g, c)) return false;
    p.mana -= mana;
    if (!A.ownCost || L.cd) g.setCd(key, c.cd != null ? c.cd : L.cd);
    if (!A.keepInvis) g.breakInvis();
    forAbilities((B, cc) => { if (B.onCast) B.onCast(g, key, cc); });
    g.emit('cast', { key, id: A.id, hero: g.heroId, ult: !!A.ult });
    return true;
  };
  g.castW = () => g.cast('w');
  g.castE = () => g.cast('e');
  g.castR = () => g.cast('r');

  g.chargeStart = () => {
    const p = g.player;
    const c = abilityCtx(g, 'q');
    if (!c || c.A.targeting !== 'charge') return g.cast('q');
    if (c.A.tap && c.A.tap(g, c)) return true;
    if (!g.canAct() || p.charging) return false;
    if (cantCast(p)) { g.emit('silenced', { key: 'q' }); return false; }
    p.charging = true;
    p.chargeT = 0;
    p.charge = 0;
    g.emit('chargeStart', {});
    return true;
  };
  g.chargeCancel = () => {
    const p = g.player;
    if (!p.charging) return;
    p.charging = false;
    p.charge = 0;
    g.emit('chargeEnd', {});
  };
  g.chargeRelease = () => {
    const p = g.player;
    if (!p.charging) return;
    p.charging = false;
    const ch = p.charge;
    p.charge = 0;
    g.emit('chargeEnd', {});
    if (!g.canAct()) return;
    const c = abilityCtx(g, 'q');
    if (!c) return;
    if (g.cds.q > 0) p.pendingFire = ch;
    else c.A.fire(g, ch, c);
  };
  g.endChannel = (interrupted) => {
    const p = g.player;
    if (!p.channel) return;
    const key = p.channel.key;
    p.channel = null;
    g.emit('channelEnd', { key, interrupted });
  };

  /** HUD için yetenek slot durumu. */
  g.slotState = (key) => {
    const p = g.player;
    const lv = p.abilityLv[key] || 0;
    const A = ABILITIES[g.H.abilities[key]];
    const learn = g.canLearn(key);
    if (!lv) return { locked: true, lv: 0, max: A ? A.levels.length : 4, learn, cdFrac: 0, cdLeft: 0, extra: '' };
    const c = abilityCtx(g, key);
    const { L } = c;
    const base = {
      lv, max: A.levels.length, learn,
      cdFrac: g.cds[key] / (g.cdMax[key] || 1),
      cdLeft: g.cds[key],
      noMana: !A.ownCost && (L.mana || 0) > p.mana,
      extra: targetingOf(g, key) === 'passive' ? '' : String(L.mana || ''),
      passive: targetingOf(g, key) === 'passive',
      silenced: cantCast(p),
    };
    return A.hud ? { ...base, ...A.hud(g, c) } : base;
  };
  /** Balta'nın Kesin Hüküm eşiği (hazırsa), değilse 0 — etiketlerde "İNFAZ" işareti için. */
  g.execThreshold = () => {
    if (g.heroId !== 'balta' || g.cds.r > 0) return 0;
    const c = abilityCtx(g, 'r');
    return c ? c.A.threshold(g, c.L) : 0;
  };

  // ---------------------------------------------------------------- saldırı
  /** Kahraman saldırısı isabet ettikten sonra: eşya etkileri (şimşek, zırh kırma), pasifler. */
  function afterHeroAttack(target, dealt, opts = {}) {
    if (!target || target.kind === 'tower') return;
    const p = g.player;
    for (const it of p.items) {
      if (!it) continue;
      const pr = ITEMS[it.id].proc;
      if (!pr) continue;
      if (pr.kind === 'shred' && !target.dead) applyStatus(g, target, 'shred', pr.dur, { k: pr.k, pierce: true });
      if (pr.kind === 'chain' && !opts.noProc && g.rand() < pr.chance) chainLightning(target, pr);
    }
    if (p.tal.has('goDeso') && !target.dead) applyStatus(g, target, 'amp', 4, { k: 0.2 });
    forAbilities((A, c) => { if (A.onAttack) A.onAttack(g, target, { dmg: dealt, ...opts }, c); });
  }
  function chainLightning(first, pr) {
    const p = g.player;
    const hit = new Set();
    let cur = first;
    let px = p.x;
    let pz = p.z;
    for (let i = 0; i < pr.jumps && cur; i++) {
      hit.add(cur.id);
      g.emit('fx', { kind: 'zap', x0: px, z0: pz, x1: cur.x, z1: cur.z, hero: true });
      dealDamage(g, p, cur, pr.dmg * g.dmgMul(true), DMG.MAG, { src: 'chain' });
      px = cur.x;
      pz = cur.z;
      let next = null;
      let bd = pr.range;
      for (const e of g.foes) {
        if (e.dead || e.spawnT > 0 || hit.has(e.id) || e.seen === false) continue;
        const d = Math.hypot(e.x - px, e.z - pz);
        if (d < bd) { bd = d; next = e; }
      }
      cur = next;
    }
  }

  g.attackHit = (target, opts = {}) => {
    const p = g.player;
    if (!target || target.dead) return 0;
    let dmg = (g.stat.atkDmg + (opts.extra || 0)) * g.dmgMul(false);
    const isTower = target.kind === 'tower';
    let ambush = null;
    if (p.smokeBonus && !isTower) { dmg *= p.smokeBonus.mul; ambush = { stun: p.smokeBonus.stun }; p.smokeBonus = null; }
    let guise = null;
    if (p.guiseBonus && !isTower && p.invis > 0) { dmg += p.guiseBonus.dmg; guise = p.guiseBonus; p.guiseBonus = null; }
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    p.face = Math.atan2(dx, dz);
    p.swing = 1;
    const lsK = p.lsBuff > 0 ? p.lsBuffK : 1;
    const dealt = dealDamage(g, p, target, dmg, DMG.PHYS, {
      src: opts.src || 'attack', attack: true, forceCrit: !!opts.forceCrit, structure: isTower, knock: 0.45, dirX: dx / len, dirZ: dz / len,
      lifesteal: isTower ? 0 : (g.stat.lifesteal || 0) * lsK,
    });
    if (!isTower) {
      if (ambush && !target.dead) { applyStatus(g, target, 'stun', ambush.stun); g.emit('fx', { kind: 'ambush', foe: target }); }
      if (guise && !target.dead) { if (applyStatus(g, target, 'root', guise.root)) target.rootFx = 'vine'; g.emit('fx', { kind: 'leech', foe: target, dur: guise.root }); }
      if (g.stat.cleave > 0 && dealt > 0) {
        for (const e of g.foes) {
          if (e === target || e.dead || e.spawnT > 0) continue;
          const ex = e.x - target.x;
          const ez = e.z - target.z;
          if (ex * ex + ez * ez > 1.9 * 1.9) continue;
          if ((e.x - p.x) * dx + (e.z - p.z) * dz < -0.3) continue;
          dealDamage(g, p, e, dmg * g.stat.cleave, DMG.PHYS, { src: 'cleave', quiet: true });
        }
        g.emit('fx', { kind: 'cleave', x: target.x, z: target.z, face: p.face });
      }
    }
    g.breakInvis();
    afterHeroAttack(target, dealt, opts);
    return dealt;
  };

  function validTarget(t) {
    return t && !t.dead && (t.kind === 'tower' || (t.spawnT <= 0 && t.seen !== false));
  }
  function edgeDist(t) {
    const p = g.player;
    return Math.hypot(t.x - p.x, t.z - p.z) - (t.r || 0);
  }
  function chooseAttackTarget(range) {
    const p = g.player;
    if (g.focus && validTarget(g.focus) && edgeDist(g.focus) <= range && (g.focus.kind !== 'tower' || g.focus.side === 'dire' || g.focus.hp <= g.focus.maxHp * 0.12)) return g.focus;
    if (!g.lastAuto) {
      const f = g.foeNear(p.aimX, p.aimZ, 1.8);
      if (f && edgeDist(f) <= range) return f;
    }
    if (g.target && validTarget(g.target) && edgeDist(g.target) <= range) return g.target;
    const f = g.nearestFoe(p.x, p.z, range, null);
    if (f) return f;
    for (const t of g.towers) if (!t.dead && t.side === 'dire' && edgeDist(t) <= range) return t;
    // deny: canı %12'nin altındaki kendi kulen (Dire'a sevinç yok)
    for (const t of g.towers) if (!t.dead && t.side === 'radiant' && t.hp <= t.maxHp * 0.12 && edgeDist(t) <= range) return t;
    return null;
  }

  function stepAttack(dt, moving) {
    const p = g.player;
    const A = g.H.attack;
    if (!A) return;
    if (p.atkCd > 0) p.atkCd -= dt;
    if (p.atkWind > 0) {
      p.atkWind -= dt;
      if (p.atkWind <= 0) {
        const t = p.atkTarget;
        p.atkTarget = null;
        if (validTarget(t) && edgeDist(t) <= A.range + 0.7 && g.canAct() && !cantAttack(p)) {
          if (A.type === 'ranged') {
            const dmg = g.stat.atkDmg * g.dmgMul(false);
            let bonus = null;
            if (p.guiseBonus && p.invis > 0 && t.kind !== 'tower') { bonus = p.guiseBonus; p.guiseBonus = null; }
            g.fireProj({ from: p, kind: A.proj || 'ice', target: t, dmg: dmg + (bonus ? bonus.dmg : 0), type: DMG.PHYS, speed: 17, y: 1.25, heroAttack: true, guise: bonus });
            p.face = Math.atan2(t.x - p.x, t.z - p.z);
            p.swing = 1;
            g.breakInvis();
          } else g.attackHit(t);
        }
      }
      return;
    }
    if (!g.canAct() || cantAttack(p) || p.channel || p.charging || p.atkCd > 0) return;
    if (p.invis > 0 && moving) return; // görünmezken yürürken saldırma (pusu için dur)
    const t = chooseAttackTarget(A.range);
    if (!t) return;
    p.atkTarget = t;
    p.atkWind = A.type === 'ranged' ? 0.2 : 0.15;
    p.atkCd = g.stat.atkRate;
    p.face = Math.atan2(t.x - p.x, t.z - p.z);
  }

  // ---------------------------------------------------------------- mermiler
  g.fireProj = (o) => {
    const pr = {
      id: nextId++, kind: o.kind, x: o.x ?? o.from.x, z: o.z ?? o.from.z, y: o.y ?? 1,
      target: o.target, tx: o.target.x, tz: o.target.z, speed: o.speed || 14, dmg: o.dmg, type: o.type || DMG.PHYS,
      from: o.from, heroAttack: !!o.heroAttack, guise: o.guise || null, alive: true, life: 4,
    };
    g.projs.push(pr);
    g.emit('proj', { proj: pr });
    return pr;
  };
  function stepProjs(dt) {
    const p = g.player;
    for (let i = g.projs.length - 1; i >= 0; i--) {
      const pr = g.projs[i];
      pr.life -= dt;
      const t = pr.target;
      const tAlive = t && !t.dead && !(t === p && (p.dead || !g.heroVisible));
      if (tAlive) { pr.tx = t.x; pr.tz = t.z; }
      const dx = pr.tx - pr.x;
      const dz = pr.tz - pr.z;
      const L = Math.hypot(dx, dz);
      const stepLen = pr.speed * dt;
      pr.y += ((t === p ? 1.0 : 0.8) - pr.y) * Math.min(1, dt * 5);
      if (L <= stepLen + 0.25) {
        pr.x = pr.tx;
        pr.z = pr.tz;
        if (tAlive) {
          const hero = pr.heroAttack;
          const opts = { src: pr.kind, attack: true, structure: t.kind === 'tower' };
          if (hero) opts.lifesteal = (g.stat.lifesteal || 0) * (p.lsBuff > 0 ? p.lsBuffK : 1);
          const dealt = dealDamage(g, pr.from, t, pr.dmg, pr.type, opts);
          if (pr.kind === 'ice' && !t.dead && t !== p) applyStatus(g, t, 'slow', 0.8, { k: 0.15 });
          if (hero && t !== p) {
            if (pr.guise && !t.dead) { if (applyStatus(g, t, 'root', pr.guise.root)) t.rootFx = 'vine'; g.emit('fx', { kind: 'leech', foe: t, dur: pr.guise.root }); }
            afterHeroAttack(t, dealt, {});
          }
        }
        g.projs.splice(i, 1);
        g.emit('projEnd', { proj: pr, hit: tAlive });
        continue;
      }
      pr.x += (dx / L) * stepLen;
      pr.z += (dz / L) * stepLen;
      if (pr.life <= 0) { g.projs.splice(i, 1); g.emit('projEnd', { proj: pr, hit: false }); }
    }
  }

  // ---------------------------------------------------------------- hasar uygulama (combat.js çağırır)
  g.hurtHero = (a, type, source, opts = {}) => {
    const p = g.player;
    if (p.dead || p.invuln > 0 || p.cyclone > 0 || g.state === 'over' || g.state === 'idle') return 0;
    p.hp -= a;
    p.hurtT = 0.35;
    p.lastHurt = g.time;
    g.damageTaken += a;
    g.waveDamage += a;
    g.emit('hurt', { dmg: a, src: source, type });
    forAbilities((A, c) => { if (A.onHurt) A.onHurt(g, a, source, c); });
    if (p.channel && opts.src !== 'dot' && a > p.maxHp * 0.25) g.endChannel(true);
    if (p.hp <= 0) { p.hp = 0; playerDown(); }
    return a;
  };
  /** Geriye dönük adlar. */
  g.damageHero = (amount, type, source, opts) => dealDamage(g, source, g.player, amount, type, opts);
  g.hurtPlayer = (dmg, src, opts = {}) => {
    let d = dmg;
    if (src && src.type === 'ward' && g.isNight) d *= 1.3;
    return dealDamage(g, src, g.player, d, opts.type || DMG.PHYS, opts);
  };
  g.slowPlayer = (t) => {
    if (applyStatus(g, g.player, 'slow', t, { k: 0.45 })) g.emit('slowed', {});
  };
  g.heal = (amount, { quiet = false } = {}) => {
    const p = g.player;
    if (p.dead || !(amount > 0)) return;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    if (!quiet) g.emit('heal', { amount: Math.round(amount) });
  };

  g.hurtFoe = (e, a, type, source, opts = {}, crit = false) => {
    if (e.dead || e.spawnT > 0) return 0;
    if (e.kind === 'dog') {
      if (e.type === 'afk' && e.state === 'afk') { e.state = 'awake'; g.emit('wake', { foe: e }); }
      if (e.type === 'farm' && (e.state === 'farm' || e.state === 'flee')) applyStatus(g, e, 'stun', 0.25);
    }
    e.hp -= a;
    e.hitFlash = 0.16;
    const kb = e.kind === 'boss' ? 0.12 : 1;
    e.kx += (opts.dirX || 0) * (opts.knock ?? 0.6) * kb;
    e.kz += (opts.dirZ || 0) * (opts.knock ?? 0.6) * kb;
    if (source === g.player) {
      e.aggroT = 3;
      if (e.kind === 'boss') e.angry = true;
      if (e.kind === 'neutral' && e.state !== 'return') e.aggroT = 5;
    }
    if (!opts.quiet || a >= 60) g.emit('hit', { foe: e, dog: e, dmg: a, big: a >= 110, src: opts.src, crit, type });
    if (crit && source === g.player) g.emit('fx', { kind: 'crit', foe: e, dmg: a });
    if (e.hp <= 0) killFoe(e, source, opts);
    return a;
  };
  g.damageFoe = (e, amount, type, source, opts) => dealDamage(g, source, e, amount, type, opts);

  g.hurtTower = (t, a, type, source, opts = {}) => {
    if (t.dead) return 0;
    t.hp -= a;
    t.hitFlash = 0.14;
    if (!opts.quiet) g.emit('towerHit', { tower: t, dmg: a });
    if (t.hp <= 0) {
      t.hp = 0;
      t.dead = true;
      t.deadT = 0;
      const byHero = source === g.player;
      if (t.side === 'dire') {
        g.towersDown += 1;
        if (byHero) {
          const B = t.def.bounty;
          addGold(B.gold, true);
          g.addXp(B.xp);
          addScore(B.score);
        }
        progress('towers', 1);
      } else if (byHero) {
        // DENY: kendi kuleni son vuruşla yıktın — Dire creep'leri coşmaz
        g.denies += 1;
        g.addXp(80);
        g.emit('deny', { tower: t, x: t.x, z: t.z });
        failObjective('protect');
      } else {
        g.direMorale += 1;
        g.emit('direMorale', { n: g.direMorale });
        failObjective('protect');
      }
      g.emit('towerDown', { tower: t, byHero, deny: byHero && t.side === 'radiant' });
    }
    return a;
  };
  g.damageTower = (t, amount, type, source, opts) => dealDamage(g, source, t, amount, type, opts);

  // ---------------------------------------------------------------- ekonomi
  /** Altın ekle. reliable: güvenilir altın (ölünce kaybolmaz). Dönen: eklenen. */
  function addGold(n, reliable = false) {
    const v = Math.max(0, Math.round(n * (g.mods.gold || 1)));
    const p = g.player;
    p.gold += v;
    if (reliable) p.goldR += v;
    g.goldEarned += v;
    progress('gold', v);
    return v;
  }
  g.addGold = addGold;
  /** Harca: önce güvenilmez altın gider. */
  function spend(n) {
    const p = g.player;
    p.gold = Math.max(0, p.gold - n);
    p.goldR = Math.min(p.goldR, p.gold);
  }
  g.spend = spend;
  g.unreliable = () => Math.max(0, g.player.gold - g.player.goldR);
  function addScore(n) {
    g.score += Math.round(n * (g.mods.scoreMul || 1));
  }
  g.addScore = addScore;

  g.addXp = (n) => {
    const p = g.player;
    if (p.level >= MAX_LEVEL) return;
    p.xp += n * (g.mods.xp || 1);
    let up = false;
    while (p.level < MAX_LEVEL && p.xp >= xpFor(p.level)) {
      p.xp -= xpFor(p.level);
      p.level += 1;
      p.skillPoints += 1;
      up = true;
      if (TALENT_LEVELS.includes(p.level)) {
        p.talentPending.push(p.level);
        g.emit('talentReady', { level: p.level });
      }
      g.emit('levelUp', { level: p.level });
    }
    if (p.level >= MAX_LEVEL) p.xp = 0;
    if (up) {
      recalc();
      if (g.mods.autoLearn || g.autoSkill) g.autoLearn();
      progress('level', 0);
    }
  };

  g.chooseTalent = (level, idx) => {
    const p = g.player;
    const i = p.talentPending.indexOf(level);
    if (i < 0 || !g.H.talents[level] || !g.H.talents[level][idx]) return false;
    p.talentPending.splice(i, 1);
    p.talentChoice[level] = idx;
    p.tal.add(g.H.talents[level][idx].id);
    recalc();
    g.emit('talent', { level, idx, talent: g.H.talents[level][idx] });
    return true;
  };

  function killFoe(e, source, opts) {
    const p = g.player;
    e.dead = true;
    e.hp = 0;
    e.deathT = 0;
    e.cast = null;
    const byHero = source === p || (source && source.hero === g.heroId);
    const killer = byHero ? 'hero' : source && source.kind === 'tower' ? 'tower' : 'other';
    g.kills += 1;
    g.killsByType[e.type] = (g.killsByType[e.type] || 0) + 1;
    const B = e.bounty;
    let gold = 0;
    if (e.kind === 'boss') gold = addGold(B.gold, true);
    else if (e.kind === 'neutral') {
      if (byHero) { gold = addGold(B.gold + LAST_HIT * 0.5); g.lastHits += 1; }
      g.neutralKills += 1;
    } else if (byHero) {
      gold = addGold(B.gold + 2 * (g.wave - 1) + LAST_HIT + g.wave);
      g.lastHits += 1;
    } else gold = addGold(Math.round((B.gold + 2 * (g.wave - 1)) * 0.35));
    if (e.kind !== 'neutral' || byHero) g.addXp(B.xp + (e.kind === 'dog' ? 5 * (g.wave - 1) : 0));
    addScore(B.score);
    if (e.kind === 'creep') g.creepKills += 1;
    if (!e.summon || byHero) for (const it of p.items) if (it && (it.id === 'wand' || it.id === 'stick')) it.charges = Math.min(ITEMS[it.id].maxCharges, (it.charges || 0) + 1);
    if (opts.src === 'ult') g.ultKills += 1;
    if (e.counted) g.dogsLeft = Math.max(0, g.dogsLeft - 1);
    if (e.guardOf) e.guardOf.guards = Math.max(0, (e.guardOf.guards || 0) - 1);
    // Kurye Köpeği ganimeti: indirirsen çaldığı geri gelir (DENY)
    if (e.loot && byHero) {
      if (e.loot.gold) { p.gold += e.loot.gold; }
      if (e.loot.tango) {
        if (g.heroId === 'okcu' && p.abilityLv.e > 0) p.tangoCharges += e.loot.tango;
        else if (!addItem('tango')) p.gold += 45;
      }
      g.denies += 1;
      g.emit('lootBack', { foe: e, gold: e.loot.gold || 0, tango: e.loot.tango || 0 });
    }
    g.emit('kill', { foe: e, dog: e, by: killer, lastHit: byHero, gold, chain: g.chain });
    g.emit('unitKilled', { unit: e, type: e.type, id: e.def ? e.def.id : `dog_${e.type}`, kind: e.kind, by: killer, lastHit: byHero });
    progress('kill', 1, e);
    // Dota duyuruları: yalnızca DOG / boss ve kahramanın öldürdükleri
    if (byHero && (e.kind === 'dog' || e.kind === 'boss')) {
      if (!g.firstBlood) { g.firstBlood = true; g.emit('firstBlood', { foe: e }); }
      if (g.time - g.lastKill <= 1.8) g.chain += 1;
      else g.chain = 1;
      g.lastKill = g.time;
      g.bestChain = Math.max(g.bestChain, g.chain);
      if (g.chain >= 2) {
        const m = MULTI[Math.min(5, g.chain)];
        addScore(m[1]);
        g.emit('multikill', { n: g.chain, label: m[0], bonus: m[1], foe: e });
      }
      g.streak += 1;
      if (STREAK[g.streak]) {
        const bounty = addGold(20 * (g.streak - 2), true);
        g.emit('streak', { n: g.streak, label: STREAK[g.streak], gold: bounty });
      }
    }
    if (e.kind === 'dog' && e.type === 'rapier' && !e.thief && !e.summon) {
      const pk = { id: nextId++, kind: 'rapier', x: e.x, z: e.z, t: 0, life: 12 };
      g.pickups.push(pk);
      g.emit('drop', { pickup: pk });
    }
    if (e.thief) {
      const pk = { id: nextId++, kind: 'rapierItem', x: e.x, z: e.z, t: 0, life: Infinity };
      g.pickups.push(pk);
      g.emit('drop', { pickup: pk, rapierItem: true });
    }
    if (e.kind === 'neutral' && e.camp) campCheck(e.camp, byHero);
    if (e.kind === 'boss') {
      g.bossesKilled += 1;
      const id = e.def.id;
      if (id === 'boss_roshan') {
        g.roshans += 1;
        const ag = { id: nextId++, kind: 'aegis', x: e.x + 0.6, z: e.z + 0.6, t: 0, life: Infinity };
        const ch = { id: nextId++, kind: 'cheese', x: e.x - 0.8, z: e.z + 0.2, t: 0, life: Infinity };
        g.pickups.push(ag, ch);
        g.emit('roshanDown', { foe: e });
      } else {
        // diğer bosslar: garanti orman eşyası + ödül rünü
        dropNeutral(e.x, e.z, Math.max(2, neutralTier(g.wave)), true);
        g.emit('bossDown', { foe: e, boss: id });
      }
      for (const o of g.foes) if (o.summon && !o.dead) { o.gone = true; }
      g.emit('bossKilled', { boss: id === 'boss_roshan' ? 'roshan' : id, id, k: id === 'boss_roshan' ? g.roshans : g.bossesKilled, by: killer });
    }
    for (const fn of g.hooks.onKill) fn(g, e, source);
    forAbilities((A, c) => { if (A.onKill) A.onKill(g, e, c); });
    if (g.state === 'playing' && g.dogsLeft === 0 && g.queue.length === 0 && !g.pendingUnits) waveClear();
  }

  // ---------------------------------------------------------------- DOG'lar
  function makeDog(type, { x, z, wave = 1, elite = false, demo = false }) {
    const T = DOG_TYPES[type];
    const sc = waveScale(wave);
    const hpMul = sc.hp * (elite ? 1.6 : 1) * (g.mods.enemyHp || 1);
    const d = {
      id: nextId++, kind: 'dog', type, arch: archOf(type),
      x, z, vx: 0, vz: 0, kx: 0, kz: 0,
      face: Math.atan2(-x, -z),
      r: T.r * (elite ? 1.15 : 1),
      maxHp: Math.round(T.hp * hpMul), hp: 0,
      speed: T.speed * sc.speed * (elite ? 1.05 : 1) * (g.mods.enemySpeed || 1),
      dmg: T.dmg * sc.dmg * (elite ? 1.3 : 1) * (g.mods.enemyDmg || 1),
      armor: elite ? 2 : 0, magicResist: 0, armorBuff: 0, shield: 0, magShield: 0, spellImmune: 0, invuln: 0,
      elite, demo, scale: elite ? 1.15 : 1, seed: Math.random() * 100,
      state: 'go', t: 1.5 + Math.random() * 2,
      st: newStatus(), windup: 0, attackCd: 0.8, lunge: 0, hitFlash: 0,
      spawnT: demo ? 0 : 0.55, dead: false, deathT: 0,
      vis: 1, status: null, dist: 99, canBite: true, seen: true,
      farmT: 0, coinT: 1, stealCd: 0,
      bounty: { gold: 38 + (elite ? 20 : 0), xp: 45 + (elite ? 20 : 0), score: 100 },
      counted: !demo,
    };
    d.hp = d.maxHp;
    if (type === 'farm') d.state = 'farm';
    if (type === 'afk') d.state = 'afk';
    if (type === 'mid') d.state = 'guard';
    if (type === 'chat') d.t = 1.5 + Math.random();
    if (type === 'pause') d.t = 1.5 + Math.random() * 2;
    return d;
  }

  function spawnDog(type, elite) {
    const p = g.player;
    const gates = DOG_GATES.map((a) => {
      const gx = Math.sin(a) * (PLAY_R - 0.4);
      const gz = Math.cos(a) * (PLAY_R - 0.4);
      return { a, d: Math.hypot(gx - p.x, gz - p.z) };
    }).sort((a, b) => b.d - a.d);
    const gate = gates[g.rand() < 0.7 ? 0 : 1];
    const jitter = (Math.random() - 0.5) * 0.25;
    const x = Math.sin(gate.a + jitter) * (PLAY_R - 0.3);
    const z = Math.cos(gate.a + jitter) * (PLAY_R - 0.3);
    const d = makeDog(type, { x, z, wave: g.wave, elite });
    g.foes.push(d);
    g.emit('spawn', { foe: d, dog: d, gate: gate.a });
    return d;
  }
  /** Belirli yerde DOG doğur (boss çağırmaları, görevler). opts: { x, z, elite, summon, counted } */
  g.spawnDog = (type, opts = {}) => {
    if (g.foes.length >= MAX_FOES) return null;
    const t = DOG_TYPES[type] ? type : TYPE_IDS[Math.floor(g.rand() * TYPE_IDS.length)];
    const d = makeDog(t, { x: opts.x ?? 0, z: opts.z ?? 0, wave: Math.max(1, g.wave), elite: !!opts.elite });
    const r = Math.hypot(d.x, d.z);
    if (r > PLAY_R - 0.5) { d.x *= (PLAY_R - 0.5) / r; d.z *= (PLAY_R - 0.5) / r; }
    d.counted = !!opts.counted;
    d.summon = !!opts.summon;
    if (d.summon) d.bounty = { gold: Math.round(d.bounty.gold * 0.5), xp: Math.round(d.bounty.xp * 0.5), score: 40 };
    if (d.counted) { g.dogsLeft += 1; g.dogsTotal += 1; }
    if (type === 'farm' || type === 'afk' || type === 'mid') d.state = 'go';
    g.foes.push(d);
    g.emit('spawn', { foe: d, dog: d, summon: d.summon });
    return d;
  };
  g.spawnDogAtGate = (type, opts = {}) => {
    if (g.foes.length >= MAX_FOES) return null;
    const a = DOG_GATES[Math.floor(g.rand() * DOG_GATES.length)];
    return g.spawnDog(type, { ...opts, x: Math.sin(a) * (PLAY_R - 0.6), z: Math.cos(a) * (PLAY_R - 0.6) });
  };
  /** Creep doğur (boss takviyesi). types: ['melee','ranged'] · opts: { x, z, summon, counted } */
  g.spawnCreeps = (types, opts = {}) => {
    let alive = 0;
    for (const e of g.foes) if (e.kind === 'creep' && !e.dead) alive += 1;
    let k = 0;
    for (const t of types) {
      if (alive >= MAX_CREEPS || g.foes.length >= MAX_FOES) break;
      const a = Math.random() * Math.PI * 2;
      const x = (opts.x ?? DIRE_GATE.x) + Math.sin(a) * 1.4;
      const z = (opts.z ?? DIRE_GATE.z) + Math.cos(a) * 1.4;
      const e = makeCreep(g, t, Math.max(1, g.wave), x, z);
      e.summon = !!opts.summon;
      e.counted = !!opts.counted;
      if (e.counted) { g.dogsLeft += 1; g.dogsTotal += 1; }
      g.foes.push(e);
      g.emit('spawn', { foe: e, quiet: k > 0 });
      alive += 1;
      k += 1;
    }
    return k;
  };

  /**
   * Görev/senaryo için birim doğurma. id: units.js kimliği ya da kısa ad
   *   ('boss_general' | 'general' | 'roshan' | 'dog_feed' | 'feed' | 'neutral_wolf' | 'creep_melee' …)
   * opts: { n, at: 'pit'|'center'|'dire'|'gate'|'camp:<id>'|{x,z}, x, z, elite, counted (dalga sayacına girer),
   *         k (boss güç seviyesi), aggro (orman birimleri hemen saldırsın, varsayılan true) }
   * Dönen: doğan birimler dizisi.
   */
  g.spawnUnit = (idIn, opts = {}) => {
    const id = unitId(idIn);
    const out = [];
    if (!id) { console.warn('Arena: bilinmeyen birim', idIn); return out; }
    const U = UNITS[id];
    const n = Math.max(1, opts.n || 1);
    let at = opts.at;
    if (opts.x != null) at = { x: opts.x, z: opts.z };
    const campSpot = typeof at === 'string' && at.startsWith('camp:') ? CAMPS.find((c) => c.id === at.slice(5)) : null;
    const pos = (i) => {
      if (campSpot) return { x: campSpot.x + Math.sin(i * 2.1) * 1.2, z: campSpot.z + Math.cos(i * 2.1) * 1.2 };
      if (at && typeof at === 'object') return { x: at.x + (n > 1 ? Math.sin(i * 2.1) * 1.2 : 0), z: at.z + (n > 1 ? Math.cos(i * 2.1) * 1.2 : 0) };
      if (at === 'center') return { x: Math.sin(i * 2.1) * 1.5, z: Math.cos(i * 2.1) * 1.5 };
      if (at === 'pit') return { x: ROSHAN_PIT.x + Math.sin(i * 2.1), z: ROSHAN_PIT.z + Math.cos(i * 2.1) };
      if (at === 'dire') return { x: DIRE_GATE.x * 0.9 + Math.sin(i * 2.1), z: DIRE_GATE.z * 0.9 + Math.cos(i * 2.1) };
      const a = DOG_GATES[(i + Math.floor(g.rand() * 3)) % DOG_GATES.length];
      return { x: Math.sin(a) * (PLAY_R - 0.8), z: Math.cos(a) * (PLAY_R - 0.8) };
    };
    for (let i = 0; i < n; i++) {
      if (g.foes.length >= MAX_FOES) break;
      const pt = pos(i);
      let e = null;
      if (U.kind === 'dog') {
        e = g.spawnDog(U.type, { x: pt.x, z: pt.z, elite: !!opts.elite, counted: opts.counted !== false });
      } else if (U.kind === 'creep') {
        e = makeCreep(g, U.type, Math.max(1, g.wave), pt.x, pt.z);
        e.counted = opts.counted !== false;
        if (e.counted) { g.dogsLeft += 1; g.dogsTotal += 1; }
        g.foes.push(e);
        g.emit('spawn', { foe: e });
      } else if (U.kind === 'neutral') {
        e = makeNeutral(g, id, Math.max(1, g.wave), pt.x, pt.z, null);
        e.counted = opts.counted !== false;
        if (opts.aggro !== false) { e.aggroT = 999; e.woke = true; }
        if (e.counted) { g.dogsLeft += 1; g.dogsTotal += 1; }
        g.foes.push(e);
        g.emit('spawn', { foe: e });
      } else if (U.kind === 'boss') {
        e = makeBoss(g, id, { k: opts.k || opts.bossLevel || 1, at: at && at !== 'gate' ? at : undefined, counted: opts.counted !== false });
        if (e.counted) { g.dogsLeft += 1; g.dogsTotal += 1; }
        g.foes.push(e);
        g.emit('spawn', { foe: e, boss: true });
        g.emit('bossSpawn', { foe: e, boss: id });
        if (id === 'boss_roshan') g.emit('roshanSpawn', { foe: e });
      }
      if (e) out.push(e);
    }
    return out;
  };

  g.kuryeTouch = (d) => {
    const p = g.player;
    if (g.heroId === 'okcu' && p.tangoCharges > 0) {
      p.tangoCharges -= 1;
      g.tangosStolen += 1;
      d.loot = { ...(d.loot || {}), tango: ((d.loot && d.loot.tango) || 0) + 1 };
      g.emit('tangoStolen', { foe: d });
      return;
    }
    const tango = p.items.find((it) => it && it.id === 'tango');
    if (tango) {
      tango.charges -= 1;
      if (tango.charges <= 0) p.items[p.items.indexOf(tango)] = null;
      g.tangosStolen += 1;
      d.loot = { ...(d.loot || {}), tango: ((d.loot && d.loot.tango) || 0) + 1 };
      g.emit('tangoStolen', { foe: d });
      return;
    }
    const steal = Math.min(g.unreliable(), 18 + 4 * g.wave);
    if (steal > 0) {
      spend(steal);
      d.loot = { ...(d.loot || {}), gold: ((d.loot && d.loot.gold) || 0) + steal };
      g.emit('goldStolen', { foe: d, gold: steal });
      return;
    }
    dealDamage(g, d, p, d.dmg * 1.5, DMG.PHYS, { attack: true, src: 'kurye' });
  };
  g.spawnBubble = (d, ux, uz) => {
    const b = { id: nextId++, x: d.x + ux * 0.6, z: d.z + uz * 0.6, dx: ux, dz: uz, speed: 6.2, life: 3, owner: d, dmg: d.dmg * 0.6 };
    g.bubbles.push(b);
    g.emit('bubble', { bubble: b, foe: d, dog: d });
  };

  // ---------------------------------------------------------------- ölüm / Aegis / geri alma
  g.buybackCost = () => {
    const p = g.player;
    return Math.round(150 + 25 * p.level + 12 * Math.max(1, g.wave));
  };
  g.canBuyback = () => {
    const p = g.player;
    return !g.mods.noBuyback && p.buybackCd <= 0 && p.gold >= g.buybackCost();
  };

  function playerDown() {
    const p = g.player;
    p.charging = false;
    p.charge = 0;
    if (p.channel) g.endChannel(true);
    p.dance = null;
    p.ball = null;
    g.streak = 0;
    g.deaths += 1;
    failObjective('noDeath');
    if (p.aegis) {
      p.aegis = false;
      p.dead = true;
      p.reviveT = 1.3;
      g.emit('aegisUsed', {});
      return;
    }
    p.dead = true;
    // ölüm cezası: güvenilmez altının bir kısmı düşer
    const lost = Math.round(g.unreliable() * DEATH_LOSS);
    if (lost > 0) spend(lost);
    g.state = 'dying';
    const bb = g.canBuyback();
    g.dyingT = bb ? BUYBACK_WINDOW : 1.8;
    g.buybackOpen = bb;
    g.emit('death', { lost, buyback: bb ? { cost: g.buybackCost(), window: BUYBACK_WINDOW } : null });
  }
  /** Geri al (buyback): ölüm ekranında, altın öde ve çeşmede diril. */
  g.buyback = () => {
    const p = g.player;
    if (g.state !== 'dying' || !p.dead || !g.buybackOpen || !g.canBuyback()) return false;
    const cost = g.buybackCost();
    spend(cost);
    p.buybackCd = BUYBACK_CD;
    g.buybacks += 1;
    g.buybackOpen = false;
    g.state = g.dogsLeft === 0 && g.queue.length === 0 ? 'break' : 'playing';
    if (g.state === 'break' && !(g.breakT > 0)) g.breakT = BREAK_T;
    p.x = FOUNTAIN.x + 1.2;
    p.z = FOUNTAIN.z - 1.2;
    p.vx = 0; p.vz = 0; p.kx = 0; p.kz = 0;
    revive({ buyback: true, cost });
    return true;
  };

  function revive({ buyback = false, cost = 0 } = {}) {
    const p = g.player;
    p.dead = false;
    p.hp = p.maxHp;
    p.mana = p.maxMana;
    p.invuln = 2.5;
    dispel(g, p, { strong: true });
    if (!buyback) {
      for (const d of g.foes) {
        if (d.dead) continue;
        const dx = d.x - p.x;
        const dz = d.z - p.z;
        const L = Math.hypot(dx, dz) || 1;
        if (L < 6) {
          d.kx += (dx / L) * 4;
          d.kz += (dz / L) * 4;
          applyStatus(g, d, 'stun', 1);
          d.windup = 0;
          if (d.kind !== 'boss') d.cast = null;
        }
      }
    }
    // İlahi Kılıç düşer: Kurye Köpeği kapar
    const ri = p.items.findIndex((it) => it && it.id === 'rapier');
    if (ri >= 0) {
      p.items[ri] = null;
      recalc();
      const a = Math.random() * Math.PI * 2;
      const thief = makeDog('kurye', { x: p.x + Math.sin(a) * 1.4, z: p.z + Math.cos(a) * 1.4, wave: g.wave });
      thief.thief = true;
      thief.thiefT = 8;
      thief.counted = false;
      thief.spawnT = 0;
      thief.maxHp = thief.hp = Math.round(170 * waveScale(g.wave).hp);
      thief.speed = 5.2;
      thief.bounty = { gold: 0, xp: 0, score: 0 };
      g.foes.push(thief);
      g.emit('spawn', { foe: thief, dog: thief, quiet: true });
      g.emit('rapierStolen', { foe: thief });
    }
    g.emit('revive', { buyback, cost });
  }

  // ---------------------------------------------------------------- eşyalar ve dükkân
  g.atFountain = () => {
    const p = g.player;
    return Math.hypot(p.x - FOUNTAIN.x, p.z - FOUNTAIN.z) < FOUNTAIN.r + 0.6;
  };
  g.usedSlots = () => g.player.items.filter(Boolean).length + g.courier.items.length;
  g.itemCost = (id) => Math.round((ITEMS[id]?.cost || 0) * (g.mods.shopCost || 1));
  g.totalCost = (id) => Math.round(totalCost(id) * (g.mods.shopCost || 1));

  function addItem(id, extra = {}) {
    const p = g.player;
    const I = ITEMS[id];
    if (!I) return false;
    if (I.stack) {
      const ex = p.items.find((it) => it && it.id === id);
      if (ex) { ex.charges = (ex.charges || 0) + (I.charges || 1); return true; }
    }
    const i = p.items.indexOf(null);
    if (i < 0) return false;
    p.items[i] = { id, cd: 0, charges: I.charges != null ? I.charges : null, ...extra };
    recalc();
    return true;
  }
  g.addItem = addItem;

  /**
   * Satın alma planı: tarifli eşyada sahip olunan bileşenler (çantada, rezerve olmayan) düşülür.
   * Dönen: { cost, use: [çanta indeksleri], missing: [bileşen kimlikleri], slotsNeeded }
   */
  g.buyPlan = (id) => {
    const I = ITEMS[id];
    const p = g.player;
    if (!I) return null;
    if (!isRecipe(id)) return { cost: g.itemCost(id), use: [], missing: [], owned: [] };
    const taken = new Set();
    const use = [];
    const missing = [];
    for (const comp of I.components) {
      const idx = p.items.findIndex((it, k) => it && it.id === comp && !taken.has(k) && !it.reserved);
      if (idx >= 0) { taken.add(idx); use.push(idx); } else missing.push(comp);
    }
    let cost = g.itemCost(id);
    for (const m of missing) cost += g.totalCost(m);
    return { cost, use, missing, owned: use.map((k) => p.items[k].id) };
  };

  g.canBuy = (id) => {
    const I = ITEMS[id];
    if (!I || I.drop) return { ok: false, why: 'yok' };
    const plan = g.buyPlan(id);
    if (g.player.gold < plan.cost) return { ok: false, why: 'altın', plan };
    const stackable = I.stack && (g.hasItem(id) || g.courier.items.some((c) => c.id === id));
    // tarif: bileşenler yerini boşaltır, sonuç bir yuva kaplar
    const free = SLOTS - g.usedSlots() + plan.use.length;
    if (!stackable && free < 1) return { ok: false, why: 'çanta', plan };
    if (g.player.dead && g.state !== 'break') return { ok: false, why: 'ölü', plan };
    if (g.mods.noCourier && !g.atFountain() && g.state !== 'idle' && g.state !== 'break') return { ok: false, why: 'kurye', plan };
    return { ok: true, plan };
  };

  g.buy = (id) => {
    const I = ITEMS[id];
    const chk = g.canBuy(id);
    if (!chk.ok) { g.emit('buyFail', { item: I, why: chk.why }); return false; }
    const plan = chk.plan;
    const p = g.player;
    spend(plan.cost);
    const c = g.courier;
    const instant = g.atFountain() || g.state === 'idle' || (g.mods.noCourier && g.state === 'break');
    if (plan.use.length && instant) {
      // bileşenler çantada: anında birleşir
      for (const k of plan.use) p.items[k] = null;
      addItem(id);
      g.emit('combine', { item: I, from: plan.owned });
      g.emit('buy', { item: I, instant: true, combine: true });
    } else if (instant) {
      addItem(id);
      autoCombine();
      g.emit('buy', { item: I, instant: true });
    } else {
      // kurye getirir; sahip olunan bileşenler rezerve edilir, teslimde birleşir
      const reserved = [];
      for (const k of plan.use) { p.items[k].reserved = true; reserved.push(p.items[k]); }
      c.items.push({ id, reserved });
      if (c.state !== 'fly') {
        if (c.state === 'home') { c.x = FOUNTAIN.x; c.z = FOUNTAIN.z; }
        c.state = 'fly';
        c.t = 0;
        g.emit('courierDepart', {});
      }
      g.emit('buy', { item: I, courier: true });
    }
    g.emit('itemBought', { item: I.id, cost: plan.cost });
    progress('item', 0);
    return true;
  };

  /** Ücretsiz tarifler (Faz Botları, Güç Nalları…) bileşenler tamamlanınca kendiliğinden birleşir. */
  function autoCombine() {
    const p = g.player;
    let changed = true;
    let guard = 6;
    while (changed && guard-- > 0) {
      changed = false;
      for (const I of Object.values(ITEMS)) {
        if (!I.components || !I.components.length || (I.cost || 0) > 0) continue;
        const taken = new Set();
        let ok = true;
        for (const comp of I.components) {
          const idx = p.items.findIndex((it, k) => it && it.id === comp && !taken.has(k) && !it.reserved);
          if (idx < 0) { ok = false; break; }
          taken.add(idx);
        }
        if (!ok) continue;
        const from = [...taken].map((k) => p.items[k].id);
        for (const k of taken) p.items[k] = null;
        addItem(I.id);
        g.emit('combine', { item: I, from, auto: true });
        changed = true;
      }
    }
    recalc();
  }
  g.autoCombine = autoCombine;

  g.sell = (slot) => {
    const p = g.player;
    const it = p.items[slot];
    if (!it || it.reserved) return false;
    const I = ITEMS[it.id];
    const refund = Math.floor(g.totalCost(it.id) / 2);
    p.items[slot] = null;
    p.gold += refund;
    recalc();
    g.emit('sell', { item: I, gold: refund });
    return true;
  };

  g.useItem = (slot) => {
    const p = g.player;
    const it = p.items[slot];
    if (!it) return false;
    const I = ITEMS[it.id];
    if (!I.active) { g.emit('itemPassive', { item: I, slot }); return false; }
    if (it.reserved) { g.emit('itemNotReady', { item: I, slot }); return false; }
    if (!g.canAct() || p.channel) return false;
    if (it.cd > 0) { g.emit('itemNotReady', { item: I, slot }); return false; }
    if (I.active.mana && p.mana < I.active.mana) { g.emit('noMana', { item: I, slot }); return false; }
    if (!I.active.use(g, it)) return false;
    if (I.active.mana) p.mana -= I.active.mana;
    it.cd = I.active.cd;
    it.cdMax = I.active.cd;
    if (I.charges != null && !I.keepEmpty) {
      it.charges -= 1;
      if (it.charges <= 0) { p.items[slot] = null; recalc(); }
    }
    g.emit('itemUse', { item: I, slot });
    return true;
  };

  g.itemHeal = (amount, dur, tag = 'tango') => {
    g.player.heals.push({ hps: amount / dur, t: dur, tag });
    g.emit('itemHeal', { tag });
    return true;
  };
  g.useWand = (it, per = 16) => {
    const n = it.charges || 0;
    if (n <= 0) { g.emit('itemEmpty', { item: ITEMS[it.id] }); return false; }
    const p = g.player;
    p.hp = Math.min(p.maxHp, p.hp + per * n);
    p.mana = Math.min(p.maxMana, p.mana + per * n);
    it.charges = 0;
    g.emit('fx', { kind: 'wand', x: p.x, z: p.z, n, amount: per * n });
    return true;
  };
  /** Göz Açıp Kapayana: hareket ediyorsa hareket yönüne, değilse nişana. */
  g.blinkTo = (maxD) => {
    const p = g.player;
    if (g.time - p.lastHurt < 2) { g.emit('blinkBlocked', {}); return false; }
    if (p.st.root > 0) { g.emit('rooted', {}); return false; }
    let dx;
    let dz;
    const mv = Math.hypot(g.moveX, g.moveZ);
    if (g.lastAuto && mv > 0.2) { dx = (g.moveX / mv) * maxD; dz = (g.moveZ / mv) * maxD; }
    else {
      dx = p.aimX - p.x;
      dz = p.aimZ - p.z;
      const L = Math.hypot(dx, dz);
      if (L < 0.3) { dx = Math.sin(p.face) * maxD; dz = Math.cos(p.face) * maxD; }
      else if (L > maxD) { dx *= maxD / L; dz *= maxD / L; }
    }
    const x0 = p.x;
    const z0 = p.z;
    p.x += dx;
    p.z += dz;
    const r = Math.hypot(p.x, p.z);
    if (r > PLAY_R - 0.4) { p.x *= (PLAY_R - 0.4) / r; p.z *= (PLAY_R - 0.4) / r; }
    pushOut(p, HERO_R, g.towers);
    p.vx = 0;
    p.vz = 0;
    g.emit('fx', { kind: 'blink', x0, z0, x1: p.x, z1: p.z });
    return true;
  };
  g.blinkNextTo = (e) => {
    const p = g.player;
    let dx = p.x - e.x;
    let dz = p.z - e.z;
    const L = Math.hypot(dx, dz) || 1;
    dx /= L;
    dz /= L;
    p.x = e.x + dx * (e.r + 0.5);
    p.z = e.z + dz * (e.r + 0.5);
    pushOut(p, HERO_R, g.towers);
    const r = Math.hypot(p.x, p.z);
    if (r > PLAY_R - 0.4) { p.x *= (PLAY_R - 0.4) / r; p.z *= (PLAY_R - 0.4) / r; }
    p.vx = 0;
    p.vz = 0;
    p.face = Math.atan2(e.x - p.x, e.z - p.z);
  };
  g.bkbOn = (t) => {
    const p = g.player;
    p.bkb = t;
    dispel(g, p, { strong: true });
    g.emit('fx', { kind: 'bkb', x: p.x, z: p.z });
    return true;
  };
  g.cycloneSelf = (t) => {
    const p = g.player;
    p.cyclone = t;
    if (p.channel) g.endChannel(true);
    g.chargeCancel();
    dispel(g, p, { strong: false });
    g.emit('fx', { kind: 'cyclone', x: p.x, z: p.z, t });
    return true;
  };
  g.magShieldOn = (amount, t) => {
    const p = g.player;
    p.magShield = amount;
    p.magShieldT = t;
    g.emit('fx', { kind: 'magShield', x: p.x, z: p.z });
    return true;
  };
  g.buffHaste = (t, k, tag) => {
    const p = g.player;
    p.hasteBuff = t;
    p.hasteBuffK = k;
    g.emit('fx', { kind: tag || 'haste', x: p.x, z: p.z });
    return true;
  };
  g.buffLifesteal = (t, k) => {
    const p = g.player;
    p.lsBuff = t;
    p.lsBuffK = k;
    g.emit('fx', { kind: 'satanic', x: p.x, z: p.z });
    return true;
  };
  g.mekHeal = (amount, t, armor) => {
    const p = g.player;
    g.heal(amount);
    p.mekT = t;
    p.mekArmor = armor;
    for (const tw of g.towers) if (!tw.dead && tw.side === 'radiant' && Math.hypot(tw.x - p.x, tw.z - p.z) < 8) tw.hp = Math.min(tw.maxHp, tw.hp + amount * 1.5);
    g.emit('fx', { kind: 'mek', x: p.x, z: p.z });
    return true;
  };
  g.useDust = (r, t) => {
    const p = g.player;
    let n = 0;
    for (const e of g.foes) {
      if (e.dead || Math.hypot(e.x - p.x, e.z - p.z) > r) continue;
      e.revealT = t;
      if (e.stealth > 0) e.stealth = Math.min(e.stealth, 0.3);
      applyStatus(g, e, 'slow', t, { k: 0.2 });
      n += 1;
    }
    g.emit('fx', { kind: 'dust', x: p.x, z: p.z, r, n });
    return true;
  };
  g.placeWard = (life) => {
    const pt = g.aimPoint(6);
    if (g.wards.length >= 4) g.wards.shift();
    const w = { id: nextId++, x: pt.x, z: pt.z, t: 0, life };
    g.wards.push(w);
    g.emit('ward', { ward: w });
    return true;
  };
  g.refreshAll = () => {
    const p = g.player;
    for (const k of ['q', 'w', 'e', 'r']) g.cds[k] = 0;
    for (const it of p.items) if (it && it.id !== 'refresher') it.cd = 0;
    g.emit('fx', { kind: 'refresh', x: p.x, z: p.z });
    return true;
  };
  g.cheese = () => {
    const p = g.player;
    p.hp = p.maxHp;
    p.mana = p.maxMana;
    g.emit('fx', { kind: 'cheese', x: p.x, z: p.z });
    return true;
  };

  // ---------------------------------------------------------------- orman eşyaları
  function dropNeutral(x, z, tier, guaranteed = false) {
    if (!guaranteed && g.neutralDrops[tier] >= NEUTRAL_PER_TIER) return null;
    const owned = new Set([g.player.neutral && g.player.neutral.id, ...g.neutralStash, ...g.pickups.filter((k) => k.kind === 'neutral').map((k) => k.item)]);
    const pool = NEUTRAL_IDS.filter((id) => NEUTRALS[id].tier === tier && !owned.has(id));
    if (!pool.length) return null;
    const item = pool[Math.floor(g.rand() * pool.length)];
    g.neutralDrops[tier] = (g.neutralDrops[tier] || 0) + 1;
    // Kütüphane: Orman Sandığı / Harpi Hazinesi → 2–3 seçenek
    const nChoice = Math.max(1, Math.min(3, (g.pools && g.pools.neutralChoice) || 1));
    const choices = [item];
    const rest = pool.filter((id) => id !== item);
    while (choices.length < nChoice && rest.length) choices.push(rest.splice(Math.floor(g.rand() * rest.length), 1)[0]);
    const pk = { id: nextId++, kind: 'neutral', item, tier, x, z, t: 0, life: Infinity, choices: choices.length > 1 ? choices : null };
    g.pickups.push(pk);
    g.emit('neutralDrop', { pickup: pk, item: NEUTRALS[item] });
    return pk;
  }
  g.dropNeutral = dropNeutral;
  function takeNeutral(id, k = {}) {
    const p = g.player;
    if (!p.neutral) { p.neutral = { id }; recalc(); k.equipped = true; }
    else { g.neutralStash.push(id); k.stashed = true; }
    g.emit('neutralEquip', { item: NEUTRALS[id], stashed: !!k.stashed });
  }
  /** Seçenekli orman düşüşünde seçim (arayüz ya da test). */
  g.chooseNeutral = (id) => {
    const o = g.neutralOffer;
    if (!o || !o.choices.includes(id)) return false;
    g.neutralOffer = null;
    takeNeutral(id);
    return true;
  };
  /** Kütüphane: Yaşlı Koru Takası — molada, takılı orman eşyasını aynı kademeden başka biriyle değiştir. */
  g.canRerollNeutral = () => g.state === 'break' && g.rerollsLeft > 0 && !!g.player.neutral;
  g.rerollNeutral = () => {
    if (!g.canRerollNeutral()) return false;
    const p = g.player;
    const tier = NEUTRALS[p.neutral.id].tier;
    const owned = new Set([p.neutral.id, ...g.neutralStash]);
    const pool = NEUTRAL_IDS.filter((id) => NEUTRALS[id].tier === tier && !owned.has(id));
    if (!pool.length) return false;
    const old = p.neutral.id;
    p.neutral = { id: pool[Math.floor(g.rand() * pool.length)] };
    g.rerollsLeft -= 1;
    recalc();
    g.emit('neutralReroll', { from: NEUTRALS[old], item: NEUTRALS[p.neutral.id] });
    return true;
  };
  /** Stash'teki orman eşyasını tak (yuvadaki stash'e geçer). */
  g.equipNeutral = (id) => {
    const p = g.player;
    const i = g.neutralStash.indexOf(id);
    if (i < 0) return false;
    g.neutralStash.splice(i, 1);
    if (p.neutral) g.neutralStash.push(p.neutral.id);
    p.neutral = { id };
    recalc();
    g.emit('neutralEquip', { item: NEUTRALS[id] });
    return true;
  };

  // ---------------------------------------------------------------- orman kampları
  function resetCamps() {
    g.camps = CAMPS.map((c) => ({ ...c, alive: 0, cleared: 0, spawnedAt: -99 }));
  }
  function spawnCamp(c, force = false) {
    if (g.mods.noCamps && !force) return false;
    if (c.alive > 0) return false;
    const p = g.player;
    if (!force && Math.hypot(p.x - c.x, p.z - c.z) < 3) return false; // kamp üstündeysen dolmaz (Dota'daki gibi)
    const list = CAMP_UNITS[c.id] || ['neutral_wolf'];
    let k = 0;
    for (const id of list) {
      if (g.foes.length >= MAX_FOES) break;
      const a = (k / list.length) * Math.PI * 2 + 0.6;
      const e = makeNeutral(g, id, Math.max(1, g.wave), c.x + Math.sin(a) * 0.9, c.z + Math.cos(a) * 0.9, c);
      g.foes.push(e);
      g.emit('spawn', { foe: e, quiet: true });
      k += 1;
    }
    c.alive = k;
    c.spawnedAt = g.time;
    if (k) g.emit('campSpawn', { camp: c, n: k });
    return k > 0;
  }
  g.spawnCamp = spawnCamp;
  function campCheck(c, byHero) {
    c.alive = Math.max(0, c.alive - 1);
    if (c.alive === 0) {
      c.cleared += 1;
      if (byHero) {
        g.campsCleared += 1;
        progress('camps', 1);
        g.emit('campCleared', { camp: c });
        const tier = neutralTier(g.wave);
        if (g.rand() < 0.5 || g.campsCleared <= 1) dropNeutral(c.x, c.z, tier);
      }
    }
  }

  // ---------------------------------------------------------------- gece / gündüz ve görüş
  function stepDayNight(dt) {
    const m = g.mods;
    const dayLen = m.dayLen || DAY_LEN;
    const nightLen = m.nightLen || NIGHT_LEN;
    g.dayT += dt;
    const len = g.dayPhaseNight ? nightLen : dayLen;
    if (g.dayT >= len) {
      g.dayT = 0;
      g.dayPhaseNight = !g.dayPhaseNight;
    }
    const night = m.alwaysNight ? true : g.forceNight != null ? g.forceNight : g.dayPhaseNight;
    if (night !== g.isNight) {
      g.isNight = night;
      g.emit('dayNight', { night });
    }
  }
  /** Gece/gündüz bitimine kalan sn (arayüz). */
  g.dayLeft = () => {
    if (g.mods.alwaysNight || g.forceNight != null) return Infinity;
    const len = g.dayPhaseNight ? (g.mods.nightLen || NIGHT_LEN) : (g.mods.dayLen || DAY_LEN);
    return Math.max(0, len - g.dayT);
  };
  g.visionR = () => (g.isNight ? NIGHT_VISION + (g.stat.vision || 0) : 99);
  function updateVision(dt) {
    const p = g.player;
    const night = g.isNight;
    const vr = g.visionR();
    // dalganın son DOG'ları hep görünür (gece bulunamayan AFK/Mid dalgayı kilitlemesin)
    const lastFew = g.state === 'playing' && g.queue.length === 0 && g.dogsLeft <= 2;
    for (const e of g.foes) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      let seen = true;
      if (night && e.kind !== 'boss' && d > vr && !(lastFew && e.counted)) {
        seen = false;
        for (const t of g.towers) if (!t.dead && t.side === 'radiant' && Math.hypot(e.x - t.x, e.z - t.z) < TOWER_VISION) { seen = true; break; }
        if (!seen) for (const w of g.wards) if (Math.hypot(e.x - w.x, e.z - w.z) < WARD_VISION) { seen = true; break; }
      }
      if (seen && (e.type === 'ward' || e.kind === 'boss') && e.vis < 0.35 && !(e.revealT > 0) && d > 2.2) seen = false;
      e.seen = seen;
      if (e.revealT > 0) e.revealT -= dt;
    }
  }

  // ---------------------------------------------------------------- kurye
  function stepCourier(dt) {
    const c = g.courier;
    const p = g.player;
    c.t += dt;
    if (c.state === 'fly') {
      c.y += (1.9 - c.y) * Math.min(1, dt * 3);
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const L = Math.hypot(dx, dz);
      c.face = Math.atan2(dx, dz);
      if (L < 0.9 && !p.dead) {
        const got = [];
        while (c.items.length) {
          const entry = c.items[0];
          const I = ITEMS[entry.id];
          // rezerve bileşenler hâlâ çantadaysa birleştir
          const live = (entry.reserved || []).filter((r) => p.items.includes(r));
          if (live.length === (entry.reserved || []).length && live.length) {
            for (const r of live) p.items[p.items.indexOf(r)] = null;
            if (addItem(entry.id)) { got.push(I); c.items.shift(); g.emit('combine', { item: I, from: live.map((r) => r.id) }); continue; }
            for (const r of live) { r.reserved = false; addItem(r.id); }
            break;
          }
          for (const r of entry.reserved || []) r.reserved = false;
          if (addItem(entry.id)) { got.push(I); c.items.shift(); } else break;
        }
        autoCombine();
        g.emit('courierDeliver', { items: got });
        c.state = 'back';
        return;
      }
      const sp = 8.5 * dt;
      c.x += (dx / (L || 1)) * Math.min(sp, L);
      c.z += (dz / (L || 1)) * Math.min(sp, L);
    } else if (c.state === 'back') {
      const dx = FOUNTAIN.x - c.x;
      const dz = FOUNTAIN.z - c.z;
      const L = Math.hypot(dx, dz);
      c.face = Math.atan2(dx, dz);
      if (L < 0.5) { c.state = 'home'; c.y = 0; g.emit('courierHome', {}); return; }
      const sp = 8 * dt;
      c.x += (dx / (L || 1)) * Math.min(sp, L);
      c.z += (dz / (L || 1)) * Math.min(sp, L);
    }
  }

  // ---------------------------------------------------------------- rünler
  function spawnRune() {
    const spot = RUNE_SPOTS[Math.floor(g.rand() * RUNE_SPOTS.length)];
    const kind = RUNE_IDS[Math.floor(g.rand() * RUNE_IDS.length)];
    for (const r of g.runes) g.emit('runeGone', { rune: r });
    g.runes.length = 0;
    const r = { id: nextId++, kind, x: spot.x, z: spot.z, t: 0, spot: spot.id };
    g.runes.push(r);
    g.emit('rune', { rune: r, R: RUNES[kind] });
  }
  g.spawnRune = (kind) => {
    spawnRune();
    if (kind && RUNES[kind]) g.runes[0].kind = kind;
  };
  function takeRune(r) {
    const p = g.player;
    const R = RUNES[r.kind];
    switch (r.kind) {
      case 'haste': p.haste = R.dur; break;
      case 'dd': p.dd = R.dur; break;
      case 'regen': p.regenRune = R.dur; break;
      case 'invis': p.invis = Math.max(p.invis, R.dur); g.emit('invis', { t: R.dur }); break;
      case 'bounty': {
        const gold = addGold(55 + 15 * g.wave, true);
        g.addXp(60 + 10 * g.wave);
        r.gold = gold;
        break;
      }
      default: break;
    }
    g.runesTaken += 1;
    progress('runes', 1);
    g.emit('runeTaken', { rune: r, R });
  }

  // ---------------------------------------------------------------- görev hedefleri
  function initObjectives() {
    const list = (g.mission && g.mission.objectives) || g.config.objectives || [];
    g.objectives = list.map((o, i) => ({ id: o.id || `h${i + 1}`, ...o, n: o.n || 1, progress: 0, done: false, failed: false }));
  }
  function objEmit(o) {
    g.emit('objective', { id: o.id, done: o.done, failed: o.failed, progress: o.progress, n: o.n, obj: o });
  }
  function matchesKill(o, e) {
    if (!o.unit) return true;
    const u = o.unit;
    const id = e.def ? e.def.id : `dog_${e.type}`;
    return u === id || u === e.kind || u === e.type || u === `dog_${e.type}` || (u === 'boss' && e.kind === 'boss');
  }
  /** Hedef ilerlemesi: kind 'kill' | 'boss' | 'waves' | 'runes' | 'camps' | 'towers' | 'gold' | 'level' | 'item' | 'lastHits' */
  function progress(kind, amount, e) {
    if (!g.objectives.length || g.state === 'over') return;
    let changed = false;
    for (const o of g.objectives) {
      if (o.done || o.failed) continue;
      let v = null;
      if (kind === 'kill' && o.kind === 'kill' && matchesKill(o, e)) v = o.progress + amount;
      else if (kind === 'kill' && o.kind === 'boss' && e.kind === 'boss' && (!o.boss || unitId(o.boss) === e.def.id)) v = o.progress + 1;
      else if (kind === 'kill' && o.kind === 'lastHits') v = g.lastHits;
      else if (kind === o.kind && ['waves', 'runes', 'camps', 'towers'].includes(kind)) v = o.progress + amount;
      else if (kind === 'gold' && o.kind === 'gold') v = g.goldEarned;
      else if (kind === 'level' && o.kind === 'level') v = g.player.level;
      else if (kind === 'item' && o.kind === 'item') v = (g.player.items.some((it) => it && it.id === o.item) || g.courier.items.some((c) => c.id === o.item)) ? o.n : 0;
      if (v == null || v === o.progress) continue;
      o.progress = Math.min(o.n, v);
      if (o.progress >= o.n) o.done = true;
      changed = true;
      objEmit(o);
    }
    if (changed) checkMission();
  }
  g.progress = progress;
  function failObjective(kind) {
    for (const o of g.objectives) {
      if (o.kind !== kind || o.done || o.failed) continue;
      o.failed = true;
      objEmit(o);
      if (!o.optional && g.mission && g.mission.failOnObjective !== false) endRun(false);
    }
  }
  function stepObjectives(dt) {
    if (!g.objectives.length) return;
    for (const o of g.objectives) {
      if (o.done || o.failed) continue;
      if (o.kind === 'survive') {
        o.acc = (o.acc || 0) + dt;
        const v = Math.floor(o.acc);
        if (v !== o.progress) { o.progress = Math.min(o.t || o.n, v); if (o.progress >= (o.t || o.n)) o.done = true; o.n = o.t || o.n; objEmit(o); if (o.done) checkMission(); }
      } else if (o.kind === 'time') {
        o.acc = (o.acc || 0) + dt;
        if (o.acc > (o.t || 60)) { o.failed = true; objEmit(o); if (!o.optional && g.mission && g.mission.failOnObjective !== false) endRun(false); }
      }
    }
  }
  function checkMission() {
    if (!g.mission || g.state === 'over') return;
    const victory = g.mission.victory || (g.objectives.length ? 'objectives' : 'waves');
    if (victory !== 'objectives') return;
    const req = g.objectives.filter((o) => !o.optional && o.kind !== 'time' && o.kind !== 'noDeath' && o.kind !== 'protect');
    if (req.length && req.every((o) => o.done)) {
      for (const o of g.objectives) if ((o.kind === 'time' || o.kind === 'noDeath' || o.kind === 'protect') && !o.failed && !o.done) { o.done = true; o.progress = o.n; objEmit(o); }
      endRun(true);
    }
  }

  // ---------------------------------------------------------------- dalga akışı
  g.waveDef = (n) => {
    const W = (g.mission && g.mission.waves) || g.config.waves;
    if (Array.isArray(W)) {
      if (n <= W.length) return W[n - 1];
      if (g.config.mode === 'story' || g.mission) return null;
    }
    return defaultWave(n, g.mods);
  };

  function startWave(n) {
    const def = g.waveDef(n);
    if (!def) { endRun(true); return; }
    g.wave = n;
    g.queue = (def.dogs || []).slice();
    g.eliteLeft = def.elites || 0;
    g.spawnT = 0.9;
    g.burst = 3;
    const bossId = def.boss ? unitId(def.boss) : null;
    g.bossWave = !!bossId;
    g.bossId = bossId;
    g.dogsLeft = g.queue.length;
    g.dogsTotal = g.dogsLeft;
    g.waveShots = 0;
    g.waveHitShots = 0;
    g.waveDamage = 0;
    g.squadsLeft = def.creepSquads || 0;
    g.creepT = 5;
    g.state = 'playing';
    g.forceNight = def.night == null ? null : !!def.night;
    // boss dalgasından sonraki dalgada yıkılan kuleler yeniden dikilir
    if (n > 1 && g.lastBossWave === n - 1 && g.towers.some((t) => t.dead)) {
      const fresh = makeTowers(g, n);
      g.towers = g.towers.map((t, i) => (t.dead ? fresh[i] : t));
      g.direMorale = 0;
      g.emit('towersRebuilt', {});
    }
    if (bossId) {
      g.lastBossWave = n;
      g.spawnUnit(bossId, { k: def.bossLevel || Math.max(1, Math.floor(n / 5)), at: def.bossAt, counted: true });
    }
    // görev birimleri (gecikmeli olanlar sayaca baştan girer)
    g.pendingUnits = 0;
    for (const u of def.units || []) {
      if (u.delay > 0) {
        g.pendingUnits += 1;
        g.later(u.delay, () => { g.pendingUnits -= 1; if (g.state === 'playing' || g.state === 'dying') g.spawnUnit(u.id, u); });
      } else g.spawnUnit(u.id, u);
    }
    g.emit('waveStart', { wave: n, boss: bossId ? (bossId === 'boss_roshan' ? 'roshan' : bossId) : null, bossId, dogs: g.queue.length, text: def.text || null });
    if (def.camps && !g.mods.noCamps) for (const c of g.camps) spawnCamp(c);
  }

  function spawnSquad() {
    const n = g.wave;
    const comp = n < 4 ? ['melee', 'melee', 'ranged'] : n < 8 ? ['melee', 'melee', 'melee', 'ranged'] : ['melee', 'melee', 'melee', 'ranged', 'ranged'];
    let alive = 0;
    for (const e of g.foes) if (e.kind === 'creep' && !e.dead) alive += 1;
    let k = 0;
    for (const t of comp) {
      if (alive >= MAX_CREEPS || g.foes.length >= MAX_FOES) break;
      const x = DIRE_GATE.x - 0.6 * k + (Math.random() - 0.5) * 0.3;
      const z = DIRE_GATE.z + 0.6 * k + (Math.random() - 0.5) * 0.3;
      const e = makeCreep(g, t, n, x, z);
      g.foes.push(e);
      g.emit('spawn', { foe: e, quiet: k > 0 });
      alive += 1;
      k += 1;
    }
    if (k) g.emit('creepWave', { n: k });
  }

  function waveClear() {
    const p = g.player;
    g.state = 'break';
    g.breakT = BREAK_T;
    g.slowmo = 0.9;
    let eff;
    if (g.heroId === 'okcu') eff = g.waveShots ? g.waveHitShots / g.waveShots : 0;
    else eff = Math.max(0, 1 - g.waveDamage / Math.max(1, p.maxHp * 1.5));
    const bonus = 300 * g.wave;
    const effBonus = Math.round(eff * 400);
    addScore(bonus + effBonus);
    const gold = addGold(90 + 15 * g.wave, true);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
    p.mana = Math.min(p.maxMana, p.mana + p.maxMana * 0.5);
    if (g.heroId === 'okcu' && p.abilityLv.e > 0) {
      const c = abilityCtx(g, 'e');
      if (c && p.tangoCharges < c.L.charges) p.tangoCharges += 1;
    }
    for (const e of g.foes) {
      if (e.dead) continue;
      if (e.kind === 'creep') { e.retreat = true; e.windup = 0; }
      if (e.summon) e.gone = true;
    }
    g.bubbles.length = 0;
    g.forceNight = null;
    g.rerollsLeft = Math.max(0, Math.min(3, (g.pools && g.pools.neutralReroll) || 0));
    progress('waves', 1);
    g.emit('waveClear', { wave: g.wave, bonus, accBonus: effBonus, effBonus, acc: eff, eff, gold, boss: g.bossWave });
    g.emit('waveEnd', { wave: g.wave, bonus, effBonus, gold, boss: g.bossWave, bossId: g.bossId });
  }

  g.skipBreak = () => {
    if (g.state === 'break' && g.breakT > 3.2) { g.breakT = 3.2; return true; }
    return false;
  };

  function endRun(victory = false) {
    if (g.state === 'over') return;
    g.state = 'over';
    const report = g.report();
    report.victory = victory;
    g.emit('runEnd', { mode: g.config.mode, score: g.score, wave: g.wave, heroId: g.heroId, stats: report, victory, objectives: report.objectives, curse: g.config.curse || 0 });
    g.emit('gameOver', { report });
  }
  g.endRun = endRun;
  /** Hikâye/senaryo: koşuyu dışarıdan bitir (ör. diyalog sonrası). */
  g.finish = (victory) => endRun(!!victory);

  function resetWorld() {
    g.foes.length = 0;
    g.arrows.length = 0;
    g.projs.length = 0;
    g.pickups.length = 0;
    g.bubbles.length = 0;
    g.runes.length = 0;
    g.remnants.length = 0;
    g.wards.length = 0;
    g.zones.length = 0;
    g.timers.length = 0;
    g.neutralOffer = null;
    g.neutralStash = [];
    g.neutralDrops = { 1: 0, 2: 0, 3: 0 };
    g.courier = { state: 'home', x: FOUNTAIN.x, z: FOUNTAIN.z, y: 0, face: 0, items: [], t: 0 };
    g.towers = makeTowers(g, 1);
    resetCamps();
  }

  /** Yeni koşu. cfg: DEFAULT_CONFIG alanlarından istenenler. */
  g.start = (cfg = {}) => {
    g.config = { ...g.config, ...cfg };
    g.mission = g.config.mission || null;
    g.meta = g.config.meta || null;
    g.pools = (g.meta && g.meta.pools) || {};
    g.cosmetics = (g.meta && g.meta.cosmetics) || null;
    g.mods = { ...curseMods(g.config.curse), ...(g.config.modifiers || {}) };
    g.rng = g.config.seed != null ? seeded(Number(g.config.seed) || 1) : Math.random;
    resetWorld();
    g.setHero(g.config.heroId || g.heroId);
    Object.assign(g, {
      time: 0, wave: 0, score: 0, kills: 0, shots: 0, hitShots: 0, killsByType: {},
      chain: 0, lastKill: -10, bestChain: 0, streak: 0, firstBlood: false, slowmo: 0, ultKills: 0, damageTaken: 0,
      tangosUsed: 0, tangosStolen: 0, dyingT: 0, runeT: FIRST_RUNE, goldEarned: 0, lastHits: 0, denies: 0, creepKills: 0,
      neutralKills: 0, campsCleared: 0, runesTaken: 0, bossesKilled: 0, roshans: 0, towersDown: 0, buybacks: 0, deaths: 0,
      direMorale: 0, target: null, focus: null, isNight: false, dayT: 0, dayPhaseNight: false, forceNight: null,
      campT: FIRST_CAMP, lastBossWave: 0, pendingUnits: 0, buybackOpen: false,
    });
    const p = g.player;
    p.x = FOUNTAIN.x + 1.6;
    p.z = FOUNTAIN.z - 1.6;
    p.face = Math.PI * 0.75;
    if (g.mods.startGold) p.gold = g.mods.startGold;
    else if (g.meta && g.meta.startGold > 0) p.gold = g.meta.startGold;
    if (g.mods.startLevel > 1) g.addXp(Array.from({ length: g.mods.startLevel - 1 }, (_, i) => xpFor(i + 1)).reduce((a, b) => a + b, 0));
    for (const id of (g.meta && g.meta.startItems) || []) if (ITEMS[id]) addItem(id);
    initObjectives();
    if (g.mods.alwaysNight) { g.isNight = true; }
    g.emit('reset', {});
    g.emit('runStart', { heroId: g.heroId, config: g.config, mode: g.config.mode, mission: g.mission, curse: g.config.curse || 0 });
    for (const o of g.objectives) objEmit(o);
    startWave(1);
  };

  /** Tanıtım modu: menü arkasında dolaşan birkaç DOG, ortada seçili kahraman. */
  g.attract = (heroId) => {
    g.state = 'idle';
    resetWorld();
    g.isNight = false;
    g.meta = null;
    g.pools = {};
    g.cosmetics = null;
    if (heroId) g.config.heroId = heroId;
    g.setHero(g.config.heroId || g.heroId);
    g.player.face = Math.PI * 0.15;
    g.emit('reset', {});
    ['feed', 'farm', 'chat', 'rapier', 'kurye'].forEach((t, i) => {
      const a = Math.PI * (0.62 + i * 0.19);
      const d = makeDog(t, { x: Math.sin(a) * 7, z: Math.cos(a) * 7, demo: true });
      g.foes.push(d);
      g.emit('spawn', { foe: d, dog: d, quiet: true });
    });
  };

  g.report = () => {
    let topType = null;
    let topN = 0;
    for (const [t, n] of Object.entries(g.killsByType)) {
      if (DOG_TYPES[t] && n > topN) { topN = n; topType = t; }
    }
    const p = g.player;
    return {
      mode: g.config.mode,
      heroId: g.heroId,
      wave: g.wave,
      score: g.score,
      kills: g.kills,
      shots: g.shots,
      acc: g.shots ? g.hitShots / g.shots : 0,
      topType,
      topN,
      bestChain: g.bestChain,
      ultKills: g.ultKills,
      tangosStolen: g.tangosStolen,
      damageTaken: g.damageTaken,
      time: g.time,
      level: p.level,
      gold: g.goldEarned,
      lastHits: g.lastHits,
      denies: g.denies,
      creepKills: g.creepKills,
      neutralKills: g.neutralKills,
      camps: g.campsCleared,
      runes: g.runesTaken,
      roshans: g.roshans,
      bosses: g.bossesKilled,
      towers: g.towersDown,
      buybacks: g.buybacks,
      deaths: g.deaths,
      curse: g.config.curse || 0,
      items: p.items.filter(Boolean).map((it) => it.id),
      neutral: p.neutral ? p.neutral.id : null,
      talents: [...p.tal],
      abilities: { ...p.abilityLv },
      objectives: g.objectives.map((o) => ({ id: o.id, kind: o.kind, done: o.done, failed: o.failed, optional: !!o.optional, progress: o.progress, n: o.n })),
    };
  };

  // ---------------------------------------------------------------- adım
  /**
   * input: { mx, mz } hareket vektörü (dünya ekseninde, uzunluk ≤ 1),
   *        { aimX, aimZ } nişan noktası (null ise otomatik), auto: otomatik nişan
   */
  g.step = (dtReal, input) => {
    let dt = dtReal;
    if (g.slowmo > 0) {
      g.slowmo -= dtReal;
      dt = dtReal * 0.3;
    }
    if (g.state === 'dying') dt = dtReal * 0.35;
    g.time += dt;
    const p = g.player;
    g.moveX = input.mx || 0;
    g.moveZ = input.mz || 0;
    g.lastAuto = input.auto !== false;
    const live = g.state === 'playing' || g.state === 'break';

    for (const k of ['q', 'w', 'e', 'r']) if (g.cds[k] > 0) g.cds[k] = Math.max(0, g.cds[k] - dt);
    for (const it of p.items) if (it && it.cd > 0) it.cd = Math.max(0, it.cd - dt);
    if (p.buybackCd > 0) p.buybackCd = Math.max(0, p.buybackCd - dt);
    g.heroVisible = !p.dead && !(p.invis > 0) && !(p.cyclone > 0);
    if (g.heroVisible) { g.lastSeenX = p.x; g.lastSeenZ = p.z; }
    if (live) stepDayNight(dt);

    // zamanlayıcılar
    for (let i = g.timers.length - 1; i >= 0; i--) {
      const t = g.timers[i];
      t.t -= dt;
      if (t.t <= 0) { g.timers.splice(i, 1); try { t.fn(); } catch (err) { console.error(err); } }
    }

    // nişan
    const target = input.auto !== false ? g.autoTarget() : null;
    g.target = null;
    if (input.aimX != null && input.auto === false) {
      p.aimX = input.aimX;
      p.aimZ = input.aimZ;
      g.target = g.foeNear(p.aimX, p.aimZ, 1.8);
    } else if (target) {
      p.aimX = target.x;
      p.aimZ = target.z;
      g.target = target;
    } else if (input.mx || input.mz) {
      p.aimX = p.x + input.mx * 5;
      p.aimZ = p.z + input.mz * 5;
    }

    let moving = false;
    if (g.state === 'idle') {
      p.face += dt * 0.35;
    } else if (!p.dead) {
      tickStatus(g, p, dt);
      const stunned = p.st.stun > 0 || p.cyclone > 0;
      if (stunned || p.st.hex > 0 || p.st.fear > 0) {
        if (p.charging) g.chargeCancel();
        if (p.channel) g.endChannel(true);
        p.atkWind = 0;
      }
      if (p.st.silence > 0 && p.channel) g.endChannel(true);
      // hareket
      let mx = input.mx || 0;
      let mz = input.mz || 0;
      if (p.st.fear > 0) {
        const dx = p.x - p.st.fearX;
        const dz = p.z - p.st.fearZ;
        const L = Math.hypot(dx, dz) || 1;
        mx = dx / L;
        mz = dz / L;
      }
      const ml = Math.hypot(mx, mz);
      if (ml > 1) { mx /= ml; mz /= ml; }
      moving = ml > 0.15;
      if (p.channel && ml > 0.55 && p.channel.t > 0.3 && !p.tal.has('buWalk')) g.endChannel(true);
      let sp = g.stat.speed;
      if (p.haste > 0) sp *= 1.45;
      if (p.windrun > 0) sp *= p.windrunK || 1.6;
      if (p.smokeT > 0) sp *= 1 + (p.smokeK || 0.15);
      if (p.guiseT > 0 && p.invis > 0) sp *= 1 + (p.guiseK || 0);
      if (p.cullHaste > 0) sp *= 1.3;
      if (p.hasteBuff > 0) sp *= p.hasteBuffK;
      sp *= slowMul(p);
      if (p.charging) sp *= 0.45;
      if (p.channel) sp *= p.tal.has('buWalk') ? 0.6 : 0;
      if (stunned || p.st.root > 0 || p.dance || p.ball || p.eclipse) sp = 0;
      const k = Math.min(1, dt * 14);
      p.vx += (mx * sp - p.vx) * k;
      p.vz += (mz * sp - p.vz) * k;
      p.x += (p.vx + p.kx) * dt;
      p.z += (p.vz + p.kz) * dt;
      p.kx *= Math.max(0, 1 - dt * 6);
      p.kz *= Math.max(0, 1 - dt * 6);
      if (!p.ball) pushOut(p, HERO_R, g.towers);
      const pr = Math.hypot(p.x, p.z);
      if (pr > PLAY_R - 0.4) {
        p.x *= (PLAY_R - 0.4) / pr;
        p.z *= (PLAY_R - 0.4) / pr;
      }
      p.moving = Math.hypot(p.vx, p.vz) / 5.3;
      // yüz: nişana ya da harekete
      const adx = p.aimX - p.x;
      const adz = p.aimZ - p.z;
      const hasAim = Math.hypot(adx, adz) > 0.3;
      let want = p.face;
      const busy = p.atkWind > 0 || p.swing > 0.6 || p.dance || p.ball;
      if (!busy) {
        if (g.H.attack) {
          if (ml > 0.1) want = Math.atan2(mx, mz);
          else if (input.auto === false && hasAim) want = Math.atan2(adx, adz);
        } else if ((input.auto === false || g.target || p.charging) && hasAim) want = Math.atan2(adx, adz);
        else if (ml > 0.1) want = Math.atan2(mx, mz);
        let da = want - p.face;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        p.face += da * Math.min(1, dt * 16);
      }

      // yenilenme ve süreli etkiler
      p.inFountain = Math.hypot(p.x - FOUNTAIN.x, p.z - FOUNTAIN.z) < FOUNTAIN.r;
      let hpr = g.stat.hpRegen;
      let mpr = g.stat.manaRegen;
      if (p.inFountain) {
        const f = g.state === 'break' ? 0.14 : 0.035;
        hpr += p.maxHp * f;
        mpr += p.maxMana * f;
      }
      if (p.regenRune > 0) {
        hpr += p.maxHp * 0.07;
        mpr += p.maxMana * 0.07;
        if (p.hp >= p.maxHp && p.mana >= p.maxMana) p.regenRune = 0;
      }
      if (p.barkT > 0) hpr += p.barkRegen;
      for (let i = p.heals.length - 1; i >= 0; i--) {
        const hl = p.heals[i];
        hpr += hl.hps;
        hl.t -= dt;
        if (hl.t <= 0) p.heals.splice(i, 1);
      }
      p.hp = Math.min(p.maxHp, p.hp + hpr * dt);
      p.mana = Math.min(p.maxMana, p.mana + mpr * dt);
      for (const key of ['windrun', 'rapier', 'invuln', 'haste', 'dd', 'regenRune', 'bkb', 'callArmor', 'cullHaste', 'spinT', 'helixIcd', 'smokeT', 'barkT', 'mekT', 'magShieldT', 'shieldT', 'cyclone', 'hasteBuff', 'lsBuff']) {
        if (p[key] > 0) p[key] = Math.max(0, p[key] - dt);
      }
      if (p.magShieldT <= 0) p.magShield = 0;
      if (p.shieldT <= 0) p.shield = 0;
      p.evadeBuff = p.windrun > 0 ? p.windrunEv : 0;
      p.bonusArmor = (p.callArmor > 0 ? p.callArmorK : 0) + (p.barkT > 0 ? p.barkArmor : 0) + (p.mekT > 0 ? p.mekArmor : 0);
      p.blockBuff = p.barkT > 0 ? p.barkBlock : 0;
      if (p.invis > 0) {
        p.invis -= dt;
        if (p.invis <= 0) { p.invis = 0; p.guiseT = 0; g.emit('invisEnd', {}); }
      }
      // yetenek adımları (şarj, kanal, dans, top, Tango şarjı…)
      forAbilities((A, c) => { if (A.step) A.step(g, dt, c); });
      stepAttack(dt, moving);
      // Güneş Tacı yanması
      if (g.stat.burn > 0 && live) {
        p.burnAcc = (p.burnAcc || 0) + dt;
        if (p.burnAcc >= 0.5) {
          p.burnAcc -= 0.5;
          const bd = g.stat.burn * 0.5 * g.dmgMul(true);
          for (const e of g.foes) {
            if (e.dead || e.spawnT > 0 || e.demo || e.kind === 'neutral' && !(e.aggroT > 0)) continue;
            if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 <= (3.2 + e.r) ** 2) dealDamage(g, p, e, bd, DMG.MAG, { src: 'burn', quiet: true });
          }
        }
      }
      if (g.state === 'playing') addGoldPassive(dt);
    } else if (p.reviveT > 0) {
      p.reviveT -= dt;
      if (p.reviveT <= 0) revive();
    }
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 5);
    if (p.swing > 0) p.swing = Math.max(0, p.swing - dt * 4);

    // doğurma
    if (g.state === 'playing' && g.queue.length) {
      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        const t = g.queue.shift();
        const elite = g.eliteLeft > 0 && g.queue.length < g.eliteLeft + 2 && g.rand() < 0.7;
        if (elite) g.eliteLeft -= 1;
        spawnDog(t, elite);
        if (g.burst > 1) { g.burst -= 1; g.spawnT = 0.35; }
        else g.spawnT = waveScale(g.wave).interval;
      }
    }
    if (g.state === 'playing' && g.squadsLeft > 0) {
      g.creepT -= dt;
      if (g.creepT <= 0) {
        g.squadsLeft -= 1;
        g.creepT = 15;
        spawnSquad();
      }
    }
    // rünler, kamplar (oyun ve mola sırasında)
    if (live) {
      g.runeT -= dt;
      if (g.runeT <= 0) { g.runeT = RUNE_EVERY; spawnRune(); }
      for (let i = g.runes.length - 1; i >= 0; i--) {
        const r = g.runes[i];
        r.t += dt;
        if (!p.dead && (r.x - p.x) ** 2 + (r.z - p.z) ** 2 < 1.0) {
          g.runes.splice(i, 1);
          takeRune(r);
        }
      }
      g.campT -= dt;
      if (g.campT <= 0) {
        g.campT = CAMP_EVERY;
        for (const c of g.camps) spawnCamp(c);
      }
      stepObjectives(dt);
    }
    // ward'lar ve kalıntılar
    for (let i = g.wards.length - 1; i >= 0; i--) {
      const w = g.wards[i];
      w.t += dt;
      if (w.t >= w.life) { g.wards.splice(i, 1); g.emit('wardGone', { ward: w }); }
    }
    stepRemnants(dt);
    stepZones(dt);
    if (g.neutralOffer && live) {
      g.neutralOffer.t -= dt;
      if (g.neutralOffer.t <= 0) g.chooseNeutral(g.neutralOffer.choices[0]);
    }

    updateVision(dt);
    stepFoes(dt);
    stepArrows(dt);
    stepProjs(dt);
    stepBubbles(dt);
    stepPickups(dt);
    stepTowers(g, dt);
    stepCourier(dt);
    for (const fn of g.hooks.onStep) fn(g, dt);

    if (g.state === 'break') {
      const before = Math.ceil(g.breakT);
      g.breakT -= dt;
      const after = Math.ceil(g.breakT);
      if (after !== before && after <= 3 && after > 0) g.emit('countdown', { n: after });
      if (g.breakT <= 0) startWave(g.wave + 1);
    }
    if (g.state === 'playing' && g.dogsLeft === 0 && g.queue.length === 0 && !g.pendingUnits) waveClear();
    if (g.state === 'dying') {
      g.dyingT -= dtReal;
      if (g.dyingT <= 0) { g.buybackOpen = false; endRun(false); }
    }
  };

  let passiveAcc = 0;
  function addGoldPassive(dt) {
    passiveAcc += dt * 1.2;
    if (passiveAcc >= 1) {
      const n = Math.floor(passiveAcc);
      passiveAcc -= n;
      g.player.gold += n;
      g.goldEarned += n;
    }
  }

  function stepZones(dt) {
    const p = g.player;
    for (let i = g.zones.length - 1; i >= 0; i--) {
      const z = g.zones[i];
      z.t += dt;
      if (z.follow === 'hero' && !p.dead) { z.x = p.x; z.z = p.z; }
      z.acc += dt;
      let guard = 30;
      while (z.acc >= z.every && guard-- > 0) {
        z.acc -= z.every;
        if (z.tick) { try { z.tick(g, z); } catch (err) { console.error(err); } }
      }
      if (z.t >= z.dur || (z.follow === 'hero' && p.dead)) { g.zones.splice(i, 1); g.emit('zoneEnd', { zone: z }); }
    }
  }

  function stepRemnants(dt) {
    const p = g.player;
    for (let i = g.remnants.length - 1; i >= 0; i--) {
      const r = g.remnants[i];
      r.t += dt;
      if (r.t >= r.life) { g.remnants.splice(i, 1); g.emit('remnantGone', { rem: r }); continue; }
      if (r.t < r.arm) continue;
      if (r.seek) {
        // Gezgin Kalıntı: en yakın düşmana süzülür
        let best = null;
        let bd = 11;
        for (const e of g.foes) {
          if (e.dead || e.spawnT > 0 || e.demo || e.seen === false) continue;
          const d = Math.hypot(e.x - r.x, e.z - r.z);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          const step = Math.min(bd, 7 * dt);
          r.x += ((best.x - r.x) / (bd || 1)) * step;
          r.z += ((best.z - r.z) / (bd || 1)) * step;
        }
      }
      let trig = false;
      for (const e of g.foes) {
        if (e.dead || e.spawnT > 0 || e.demo) continue;
        if ((e.x - r.x) ** 2 + (e.z - r.z) ** 2 <= (r.trigger + e.r) ** 2) { trig = true; break; }
      }
      if (!trig) continue;
      g.remnants.splice(i, 1);
      const dmg = r.dmg * g.dmgMul(true);
      for (const e of g.foes) {
        if (e.dead || e.spawnT > 0 || e.demo) continue;
        if ((e.x - r.x) ** 2 + (e.z - r.z) ** 2 <= (r.radius + e.r) ** 2) dealDamage(g, p, e, dmg, DMG.MAG, { src: 'remnant' });
      }
      g.emit('fx', { kind: 'remnantBoom', x: r.x, z: r.z, r: r.radius });
    }
  }

  function stepFoes(dt) {
    const p = g.player;
    const list = g.foes;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      if (d.dead) {
        d.deathT += dt;
        if (d.deathT > (d.kind === 'boss' ? 2.4 : 1.0)) {
          list.splice(i, 1);
          g.emit('remove', { foe: d, dog: d });
        }
        continue;
      }
      if (d.gone) {
        list.splice(i, 1);
        if (d.kind === 'neutral' && d.camp) d.camp.alive = Math.max(0, d.camp.alive - 1);
        g.emit('remove', { foe: d, dog: d, gone: true });
        continue;
      }
      if (d.hitFlash > 0) d.hitFlash -= dt;
      if (d.lunge > 0) d.lunge -= dt;
      if (d.invuln > 0 && d.invuln < 9000) d.invuln -= dt;
      if (d.spawnT > 0) {
        d.spawnT -= dt;
        if (d.kind === 'dog' && !d.summon && !d.demo) {
          const L = Math.hypot(d.x, d.z) || 1;
          d.x -= (d.x / L) * dt * 1.6;
          d.z -= (d.z / L) * dt * 1.6;
        }
        continue;
      }
      tickStatus(g, d, dt);
      if (d.dead) continue;
      if (d.thief) {
        d.thiefT -= dt;
        if (d.thiefT <= 0 && Math.hypot(d.x, d.z) > PLAY_R - 1.3) {
          d.gone = true;
          g.emit('thiefEscaped', { foe: d });
          continue;
        }
      }
      let intent;
      let biting = false;
      if (d.kind === 'dog') {
        intent = thinkDog(d, g, dt);
        if (g.state === 'playing' || g.state === 'break') biting = tryBite(d, g, dt);
      } else {
        const fn = THINK[d.def.ai] || THINK.creep;
        intent = fn(d, g, dt);
        biting = d.windup > 0 || !!d.cast;
      }
      let mx = intent.mx;
      let mz = intent.mz;
      const spd = biting || d.def?.stationary ? 0 : intent.spd * slowMul(d);
      // ayrışma: birimler üst üste binmesin
      for (const o of list) {
        if (o === d || o.dead) continue;
        const dx = d.x - o.x;
        const dz = d.z - o.z;
        const L2 = dx * dx + dz * dz;
        const min = d.r + o.r;
        if (L2 < min * min && L2 > 1e-6) {
          const L = Math.sqrt(L2);
          const push = ((min - L) / min) * (d.kind === 'boss' ? 0.15 : o.kind === 'boss' ? 2.5 : 1.4);
          mx += (dx / L) * push;
          mz += (dz / L) * push;
        }
      }
      if (spd > 0 && d.status !== 'dash') [mx, mz] = steerAround(d, mx, mz, d.r, g.towers);
      const ml = Math.hypot(mx, mz);
      if (d.def?.stationary) {
        d.vx = 0; d.vz = 0; d.kx = 0; d.kz = 0;
      } else if (ml > 1e-4 && spd > 0) {
        const nx = mx / Math.max(1, ml);
        const nz = mz / Math.max(1, ml);
        const k = Math.min(1, dt * 10);
        d.vx += (nx * spd - d.vx) * k;
        d.vz += (nz * spd - d.vz) * k;
      } else {
        d.vx *= 1 - Math.min(1, dt * 10);
        d.vz *= 1 - Math.min(1, dt * 10);
        if (ml > 1e-4 && spd === 0) {
          d.x += (mx / Math.max(1, ml)) * dt * 1.2;
          d.z += (mz / Math.max(1, ml)) * dt * 1.2;
        }
      }
      d.x += (d.vx + d.kx) * dt;
      d.z += (d.vz + d.kz) * dt;
      d.kx *= Math.max(0, 1 - dt * 7);
      d.kz *= Math.max(0, 1 - dt * 7);
      // oyuncuyla iç içe geçme
      const dx = d.x - p.x;
      const dz = d.z - p.z;
      const L = Math.hypot(dx, dz) || 1;
      const min = d.r + 0.32;
      if (L < min && !p.dead && !p.ball && !(p.hasteBuff > 0 && p.hasteBuffK > 1.2)) {
        if (d.def?.stationary) { p.x = d.x - (dx / L) * min; p.z = d.z - (dz / L) * min; }
        else { d.x = p.x + (dx / L) * min; d.z = p.z + (dz / L) * min; }
      }
      collide(d, g, d.r);
      // yüz yönü
      let want = d.face;
      if (d.faceTo != null && d.kind !== 'dog') want = biting || spd === 0 ? d.faceTo : Math.hypot(d.vx, d.vz) > 0.3 ? Math.atan2(d.vx, d.vz) : d.faceTo;
      else if (d.status === 'dash' || d.windup > 0 || (d.canBite && d.dist < 3 && g.heroVisible)) want = Math.atan2(p.x - d.x, p.z - d.z);
      else if (Math.hypot(d.vx, d.vz) > 0.3) want = Math.atan2(d.vx, d.vz);
      let da = want - d.face;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      d.face += da * Math.min(1, dt * (d.kind === 'boss' ? 5 : 10));
      d.speedNow = Math.hypot(d.vx, d.vz);
    }
  }

  function stepArrows(dt) {
    const hits = [];
    for (let i = g.arrows.length - 1; i >= 0; i--) {
      const a = g.arrows[i];
      if (!a.alive) {
        g.arrows.splice(i, 1);
        continue;
      }
      const stepLen = a.speed * dt;
      hits.length = 0;
      for (const d of g.foes) {
        if (d.dead || d.spawnT > 0 || a.hitSet.has(d.id) || (d.kind === 'neutral' && d.state === 'return')) continue;
        const t = Math.max(0, Math.min(stepLen, (d.x - a.x) * a.dx + (d.z - a.z) * a.dz));
        const cx = a.x + a.dx * t;
        const cz = a.z + a.dz * t;
        const rr = d.r + (a.full ? 0.28 : 0.14);
        if ((d.x - cx) ** 2 + (d.z - cz) ** 2 < rr * rr) hits.push([t, d]);
      }
      for (const tw of g.towers) {
        if (tw.dead || tw.side !== 'dire' || a.hitSet.has(tw.id)) continue;
        const t = Math.max(0, Math.min(stepLen, (tw.x - a.x) * a.dx + (tw.z - a.z) * a.dz));
        const cx = a.x + a.dx * t;
        const cz = a.z + a.dz * t;
        if ((tw.x - cx) ** 2 + (tw.z - cz) ** 2 < (TOWER_R + 0.1) ** 2) hits.push([t, tw]);
      }
      hits.sort((u, v) => u[0] - v[0]);
      let stopAt = -1;
      for (const [t, d] of hits) {
        a.hitSet.add(d.id);
        const falloff = Math.pow(0.88, a.hits);
        const wasAlive = !d.dead;
        if (d.kind === 'tower') {
          dealDamage(g, g.player, d, a.dmg * falloff * 0.6, DMG.PHYS, { src: 'arrow', structure: true, attack: true, trueStrike: true, canCrit: false });
          a.hits += 1;
          stopAt = t;
          break;
        }
        const dealt = dealDamage(g, g.player, d, a.dmg * falloff, DMG.PHYS, { dirX: a.dx, dirZ: a.dz, knock: 0.8 + a.charge * 2.2, src: 'arrow', attack: true, trueStrike: true, lifesteal: (g.stat.lifesteal || 0) * (g.player.lsBuff > 0 ? g.player.lsBuffK : 1) * 0.6 });
        if (a.hits === 0) afterHeroAttack(d, dealt, { arrow: true });
        if (wasAlive && d.dead) a.kills += 1;
        a.hits += 1;
        if (a.hits > a.pierce) { stopAt = t; break; }
      }
      if (stopAt >= 0) {
        a.x += a.dx * stopAt;
        a.z += a.dz * stopAt;
        endArrow(a, false);
        continue;
      }
      a.x += a.dx * stepLen;
      a.z += a.dz * stepLen;
      a.traveled += stepLen;
      const r = Math.hypot(a.x, a.z);
      if (r > ARENA_R) endArrow(a, true);
      else if (a.traveled >= a.range) endArrow(a, false);
    }
  }

  function endArrow(a, wall) {
    a.alive = false;
    if (a.hits > 0) {
      g.hitShots += 1;
      g.waveHitShots += 1;
    }
    g.emit('arrowEnd', { arrow: a, wall });
  }

  function stepBubbles(dt) {
    const p = g.player;
    for (let i = g.bubbles.length - 1; i >= 0; i--) {
      const b = g.bubbles[i];
      b.life -= dt;
      b.x += b.dx * b.speed * dt;
      b.z += b.dz * b.speed * dt;
      let gone = b.life <= 0 || Math.hypot(b.x, b.z) > ARENA_R;
      if (!gone && !p.dead && !p.ball && (b.x - p.x) ** 2 + (b.z - p.z) ** 2 < 0.62 * 0.62) {
        if (!(p.windrun > 0 && g.rand() < 0.8)) {
          const dealt = dealDamage(g, b.owner, p, b.dmg, DMG.MAG, { src: 'report' });
          if (dealt > 0 && p.bkb <= 0) {
            g.slowPlayer(2.2);
            g.emit('bubbleHit', { bubble: b });
          }
        } else g.emit('evade', { hero: true });
        gone = true;
      }
      if (gone) {
        g.bubbles.splice(i, 1);
        g.emit('bubbleEnd', { bubble: b });
      }
    }
  }

  function stepPickups(dt) {
    const p = g.player;
    for (let i = g.pickups.length - 1; i >= 0; i--) {
      const k = g.pickups[i];
      k.t += dt;
      if (k.t > k.life) {
        g.pickups.splice(i, 1);
        g.emit('pickupGone', { pickup: k });
        continue;
      }
      if (p.dead || g.state === 'idle' || g.state === 'over') continue;
      const rad = k.kind === 'aegis' ? 1.1 : 0.9;
      const delay = k.kind === 'aegis' || k.kind === 'cheese' || k.kind === 'neutral' ? 1.0 : 0.6;
      if ((k.x - p.x) ** 2 + (k.z - p.z) ** 2 < rad * rad && k.t > delay) {
        if (k.kind === 'rapierItem') {
          if (!addItem('rapier')) continue; // çanta dolu: yerde bekler
        }
        g.pickups.splice(i, 1);
        if (k.kind === 'rapier') p.rapier = 8;
        if (k.kind === 'aegis') {
          if (p.aegis) {
            p.hp = p.maxHp;
            p.mana = p.maxMana;
            k.full = true;
          } else p.aegis = true;
        }
        if (k.kind === 'cheese') {
          if (!addItem('cheese')) { g.cheese(); k.eaten = true; }
        }
        if (k.kind === 'neutral') {
          if (k.choices && k.choices.length > 1) {
            // seçenekli düşme: oyuncu seçer (arayüz) — seçmezse 25 sn sonra ilki alınır
            g.neutralOffer = { choices: k.choices.slice(), t: 25, tier: k.tier };
            g.emit('neutralChoice', { choices: k.choices.map((id) => NEUTRALS[id]), tier: k.tier });
          } else takeNeutral(k.item, k);
        }
        g.emit('pickup', { pickup: k });
      }
    }
  }

  // ---------------------------------------------------------------- yardımcılar
  g.foeNear = (x, z, maxD = 99) => {
    let best = null;
    let bd = maxD * maxD;
    for (const d of g.foes) {
      if (d.dead || d.spawnT > 0 || d.demo || d.seen === false) continue;
      const q = (d.x - x) ** 2 + (d.z - z) ** 2;
      if (q < bd) { bd = q; best = d; }
    }
    return best;
  };
  g.dogNear = g.foeNear;

  g.autoTarget = () => {
    const p = g.player;
    let best = null;
    let bs = Infinity;
    for (const d of g.foes) {
      if (d.dead || d.spawnT > 0 || d.demo || d.seen === false) continue;
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      let s = dist;
      if (d.status === 'afk') s += 8;
      if (d.kind === 'boss' && !d.angry) s += 10;
      if (d.kind === 'boss' && d.invuln > 0) s += 12;
      if (d.kind === 'creep') s += 1.2;
      if (d.kind === 'neutral' && !(d.aggroT > 0)) s += 9;
      if (d.canBite && dist < 3) s -= 2;
      if (s < bs) { bs = s; best = d; }
    }
    return best;
  };
  /** Arayüz: en önemli canlı boss (üst çubuk). */
  g.activeBoss = () => {
    let best = null;
    for (const e of g.foes) {
      if (e.kind !== 'boss' || e.dead || e.demo) continue;
      if (!best || (e.counted && !best.counted) || (e.angry && !best.angry)) best = e;
    }
    return best;
  };

  // Geliştirme/test yardımcıları (arena.js yalnızca DEV'de dışa açar)
  g.dev = {
    wave(n) {
      for (const e of g.foes) if (!e.demo) { e.dead = true; e.deathT = 5; }
      g.queue.length = 0;
      g.wave = Math.max(0, n - 1);
      g.state = 'break';
      g.breakT = 0.01;
    },
    clear() {
      g.dogsLeft = Math.max(0, g.dogsLeft - g.queue.length);
      g.queue.length = 0;
      for (const e of [...g.foes]) {
        if (e.dead || !e.counted) continue;
        e.spawnT = 0;
        e.invuln = 0;
        e.shield = 0;
        dealDamage(g, g.player, e, e.hp + 10, DMG.PURE, { src: 'dev' });
      }
      if (g.state === 'playing' && g.dogsLeft === 0) waveClear();
    },
    gold(n = 5000) { addGold(n, true); },
    level(n) {
      const p = g.player;
      let guard = 30;
      while (p.level < Math.min(MAX_LEVEL, n) && guard-- > 0) { p.xp = xpFor(p.level); g.addXp(0); }
    },
    learnAll() { g.autoLearn(); },
    talents(pick = 0) { for (const lv of [...g.player.talentPending]) g.chooseTalent(lv, typeof pick === 'function' ? pick(lv) : pick); },
    roshan() {
      const [r] = g.spawnUnit('boss_roshan', { k: Math.max(1, Math.floor(g.wave / 5) || 1), counted: false });
      return r;
    },
    boss(id, opts = {}) { return g.spawnUnit(id, { counted: false, ...opts })[0] || null; },
    unit(id, opts = {}) { return g.spawnUnit(id, { counted: false, ...opts }); },
    camps() { for (const c of g.camps) spawnCamp(c, true); return g.camps.map((c) => c.alive); },
    neutral(id) {
      const tier = NEUTRALS[id] ? NEUTRALS[id].tier : neutralTier(g.wave);
      if (NEUTRALS[id]) {
        const pk = { id: nextId++, kind: 'neutral', item: id, tier, x: g.player.x + 1, z: g.player.z, t: 0, life: Infinity };
        g.pickups.push(pk);
        g.emit('neutralDrop', { pickup: pk, item: NEUTRALS[id] });
        return pk;
      }
      return dropNeutral(g.player.x + 1, g.player.z, tier, true);
    },
    night(v = true) { g.forceNight = v == null ? null : !!v; stepDayNight(0); return g.isNight; },
    rune(kind) { g.spawnRune(kind); },
    creeps() { spawnSquad(); },
    heal() { const p = g.player; p.hp = p.maxHp; p.mana = p.maxMana; },
    god(v = true) { g.mods.heroHp = v ? 50 : 1; recalc(); g.player.hp = g.player.maxHp; },
    kill() { const p = g.player; p.invuln = 0; p.aegis = false; dealDamage(g, 'dev', p, p.hp + 9999, DMG.PURE, { src: 'dev' }); },
  };

  g.setHero(g.config.heroId || 'okcu');
  return g;
}

export { ABILITIES, ROSHAN_PIT };
