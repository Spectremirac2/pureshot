// 1vDOQUZ Arena 2.0 — oyun simülasyonu (görüntüden bağımsız).
// Sabit zaman adımıyla ilerler; görüntü katmanı (3D ya da 2D yedek) durumu okur ve emit() olaylarından efekt üretir.
//
// Genişletme noktaları (bkz. docs/oyunlar/arena.md → Mimari):
//   createGame(emit, config)  config = { mode: 'endless'|'story', heroId, seed, modifiers: {}, waves: null|[…], objectives: [] }
//   g.on(type, fn) / g.off     olay veri yolu: runStart, waveStart, waveEnd, unitKilled, bossKilled, itemBought,
//                              levelUp, runEnd (+ görsel olaylar: hit, kill, fx, …)
//   g.hooks                    { beforeDamage, afterDamage, onKill, onStep } dizileri
//   Hasar: combat.js dealDamage · Durumlar: combat.js applyStatus

import { buildWave, waveScale, thinkDog, tryBite, archOf, TYPE_IDS, DOG_TYPES } from './dogs.js';
import { heroOf, xpFor, MAX_LEVEL, TALENT_LEVELS, HERO_IDS } from './heroes.js';
import { ITEMS, SLOTS, RUNES, RUNE_IDS } from './items.js';
import { ABILITIES, abilityCtx } from './abilities.js';
import { DMG, applyStatus, dealDamage, newStatus, tickStatus, slowMul, mitigation } from './combat.js';
import { makeCreep, makeRoshan, makeTowers, thinkCreep, thinkRoshan, stepTowers, collide } from './units.js';
import { ARENA_R, PLAY_R, DOG_GATES, FOUNTAIN, RUNE_SPOTS, DIRE_GATE, TOWER_R, ROSHAN_PIT, pushOut } from './map.js';
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
const LAST_HIT = 10; // son vuruş altın bonusu (+dalga)
const HERO_R = 0.35;

/** Varsayılan koşu ayarı. modifiers: startGold, startLevel, heroHp, heroDmg, enemyHp, enemyDmg, gold, xp (çarpanlar). */
export const DEFAULT_CONFIG = { mode: 'endless', heroId: 'okcu', seed: null, modifiers: {}, waves: null, objectives: [] };

/**
 * Varsayılan dalga üreticisi. Hikâye modu config.waves ile aynı şemada dalga verebilir:
 *   { dogs: ['feed', …], elites: n, creepSquads: n, boss: null|'roshan' }
 */
export function defaultWave(n) {
  const boss = n % 5 === 0;
  if (boss) return { dogs: shuffle(TYPE_IDS).slice(0, 5), elites: Math.max(0, waveScale(n).elites - 1), creepSquads: 0, boss: 'roshan' };
  return { dogs: buildWave(n), elites: waveScale(n).elites, creepSquads: Math.min(3, 1 + Math.floor((n - 1) / 3)), boss: null };
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
    courier: { state: 'home', x: FOUNTAIN.x, z: FOUNTAIN.z, y: 0, face: 0, items: [], t: 0 },
    queue: [],
    spawnT: 0,
    burst: 0,
    dogsLeft: 0,
    dogsTotal: 9,
    bossWave: false,
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
    creepKills: 0,
    roshans: 0,
    towersDown: 0,
    heroVisible: true,
    lastSeenX: 0,
    lastSeenZ: 0,
    target: null,
    lastAuto: true,
    H: null,
    heroId: 'okcu',
    player: null,
    stat: {},
    cds: { q: 0, w: 0, e: 0, r: 0 },
    cdMax: { q: 1, w: 1, e: 1, r: 1 },
    hooks: { beforeDamage: [], afterDamage: [], onKill: [], onStep: [] },
    rng: Math.random,
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

  // ---------------------------------------------------------------- kahraman
  function newPlayer(H) {
    return {
      hero: H.id,
      x: 0, z: 0, vx: 0, vz: 0, kx: 0, kz: 0, face: Math.PI, moving: 0,
      hp: H.base.hp, maxHp: H.base.hp, mana: H.base.mana, maxMana: H.base.mana,
      level: 1, xp: 0, gold: 0,
      items: new Array(SLOTS).fill(null),
      tal: new Set(), talentChoice: {}, talentPending: [],
      abilityLv: { q: 1, w: 1, e: 1, r: 1 },
      st: newStatus(),
      charging: false, chargeT: 0, charge: 0, pendingFire: -1,
      aimX: 0, aimZ: -4,
      windrun: 0, rapier: 0, tangoCharges: 0, tangoRegen: 0,
      heals: [],
      invis: 0, smokeT: 0, smokeBonus: false, bkb: 0, haste: 0, dd: 0, regenRune: 0,
      callArmor: 0, cullHaste: 0, auraT: 0, spinT: 0, helixIcd: 0, swing: 0,
      channel: null, dance: null,
      atkCd: 0, atkWind: 0, atkTarget: null,
      aegis: false, invuln: 0, hurtT: 0, recoil: 0, dead: false, reviveT: 0, lastHurt: -99,
      inFountain: false, inRiver: false,
    };
  }

  function forAbilities(fn) {
    for (const key of ['q', 'w', 'e', 'r']) {
      const c = abilityCtx(g, key);
      if (c) fn(c.A, c);
    }
  }

  /** Türetilmiş statları seviye, eşya, yetenek ağacı ve pasiflerden yeniden hesaplar. */
  function recalc() {
    const p = g.player;
    const H = g.H;
    const L = p.level;
    const b = H.base;
    const sum = { hp: 0, mana: 0, dmg: 0, dmgMul: 0, speed: 0, evasion: [], atkSpeed: 0, manaRegen: 0, hpRegen: 0, burn: 0, aghs: 0, spell: 0, crit: 0, cleave: 0 };
    const add = (s) => {
      if (!s) return;
      for (const [k, v] of Object.entries(s)) {
        if (k === 'evasion') sum.evasion.push(v);
        else sum[k] = (sum[k] || 0) + v;
      }
    };
    for (const it of p.items) if (it) add(ITEMS[it.id]?.stat);
    for (const lv of TALENT_LEVELS) {
      const i = p.talentChoice[lv];
      if (i != null) add(H.talents[lv][i].stat);
    }
    const m = g.mods;
    const st = {
      maxHp: Math.round((b.hp + H.grow.hp * (L - 1) + sum.hp) * (m.heroHp || 1)),
      maxMana: Math.round(b.mana + H.grow.mana * (L - 1) + sum.mana),
      hpRegen: b.hpRegen + 0.12 * (L - 1) + sum.hpRegen,
      manaRegen: b.manaRegen + 0.18 * (L - 1) + sum.manaRegen,
      speed: b.speed + sum.speed,
      armor: b.armor,
      evasion: 1 - [b.evasion, ...sum.evasion].reduce((a, e) => a * (1 - e), 1),
      dmgMul: (1 + H.grow.dmg * (L - 1)) * (1 + sum.dmgMul),
      spellAmp: 1 + sum.spell,
      atkDmg: (H.attack ? H.attack.dmg : 0) + sum.dmg + 3 * (L - 1),
      atkRate: (H.attack ? H.attack.rate : 1) / (1 + sum.atkSpeed),
      burn: sum.burn,
      aghs: sum.aghs > 0,
      crit: sum.crit,
      critMul: 2,
      cleave: sum.cleave,
      lifesteal: sum.lifesteal || 0,
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
    forAbilities((A, c) => { if (A.init) A.init(g, c); });
    g.emit('heroChange', { heroId: H.id });
  };

  g.hasItem = (id) => g.player.items.some((it) => it && it.id === id);
  g.doubleDmg = () => g.player.dd > 0 || g.player.rapier > 0;
  g.dmgMul = (spell) => g.stat.dmgMul * (g.doubleDmg() ? 2 : 1) * (spell ? g.stat.spellAmp : 1) * (g.mods.heroDmg || 1);
  g.canAct = () => {
    const p = g.player;
    return (g.state === 'playing' || g.state === 'break') && !p.dead && !(p.st.stun > 0) && !p.dance;
  };
  g.setCd = (key, v) => { g.cds[key] = v; g.cdMax[key] = Math.max(0.01, v); };
  g.breakInvis = () => {
    const p = g.player;
    if (p.invis > 0) { p.invis = 0; p.smokeT = 0; g.emit('invisEnd', {}); }
  };

  /** Hedef seçimi: elle nişan noktasına yakın düşman, yoksa otomatik hedef, yoksa menzildeki en yakın. */
  g.pickTarget = (range) => {
    const p = g.player;
    const ok = (e) => e && !e.dead && e.spawnT <= 0 && !e.demo && Math.hypot(e.x - p.x, e.z - p.z) <= range + e.r;
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
      if (e.dead || e.spawnT > 0 || e.demo || e === exclude) continue;
      if (e.type === 'ward' && e.vis < 0.35) continue;
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

  /** Genel yetenek kullanımı (Q W E R). */
  g.cast = (key) => {
    const p = g.player;
    const c = abilityCtx(g, key);
    if (!c) return false;
    const { A, L } = c;
    if (A.targeting === 'charge') { g.chargeStart(); return true; }
    if (!g.canAct()) return false;
    if (A.targeting === 'passive') { g.emit('passive', { key }); return false; }
    if (p.st.silence > 0) { g.emit('silenced', { key }); return false; }
    if (p.channel) return false;
    if (g.cds[key] > 0) { g.emit('notReady', { key }); return false; }
    const mana = A.ownCost ? 0 : (L.mana || 0);
    if (p.mana < mana) { g.emit('noMana', { key }); return false; }
    if (A.canCast && !A.canCast(g, c)) return false;
    if (!A.cast(g, c)) return false;
    p.mana -= mana;
    if (!A.ownCost || L.cd) g.setCd(key, c.cd != null ? c.cd : L.cd);
    if (!A.keepInvis) g.breakInvis();
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
    if (!g.canAct() || p.charging) return false;
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
    const c = abilityCtx(g, key);
    if (!c) return {};
    const { A, L } = c;
    const p = g.player;
    const base = {
      cdFrac: g.cds[key] / (g.cdMax[key] || 1),
      cdLeft: g.cds[key],
      noMana: !A.ownCost && (L.mana || 0) > p.mana,
      extra: A.targeting === 'passive' ? '' : String(L.mana || ''),
      passive: A.targeting === 'passive',
    };
    return A.hud ? { ...base, ...A.hud(g, c) } : base;
  };
  /** Balta'nın Kesin Hüküm eşiği (hazırsa), değilse 0 — etiketlerde "İNFAZ" işareti için. */
  g.execThreshold = () => {
    if (g.heroId !== 'balta' || g.cds.r > 0) return 0;
    const c = abilityCtx(g, 'r');
    return c.A.threshold(g, c.L);
  };

  // ---------------------------------------------------------------- saldırı
  g.attackHit = (target, opts = {}) => {
    const p = g.player;
    if (!target || target.dead) return 0;
    let dmg = (g.stat.atkDmg + (opts.extra || 0)) * g.dmgMul(false);
    const crit = !!opts.forceCrit || (g.stat.crit > 0 && g.rand() < g.stat.crit);
    if (crit) dmg *= g.stat.critMul;
    const isTower = target.kind === 'tower';
    let ambush = false;
    if (p.smokeBonus && !isTower) { dmg *= 1.8; ambush = true; p.smokeBonus = false; }
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    p.face = Math.atan2(dx, dz);
    p.swing = 1;
    const dealt = dealDamage(g, p, target, dmg, DMG.PHYS, { src: opts.src || 'attack', crit, attack: true, structure: isTower, knock: 0.45, dirX: dx / len, dirZ: dz / len, lifesteal: isTower ? 0 : g.stat.lifesteal || 0 });
    if (!isTower) {
      if (ambush && !target.dead) { applyStatus(g, target, 'stun', 0.6); g.emit('fx', { kind: 'ambush', foe: target }); }
      if (g.stat.cleave > 0) {
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
      if (p.tal.has('goDeso')) applyStatus(g, target, 'amp', 4, { k: 0.2 });
      if (crit) g.emit('fx', { kind: 'crit', foe: target, dmg: Math.round(dealt) });
    }
    g.breakInvis();
    forAbilities((A, c) => { if (A.onAttack) A.onAttack(g, target, { dmg: dealt, crit }, c); });
    return dealt;
  };

  function validTarget(t) {
    return t && !t.dead && (t.kind === 'tower' || t.spawnT <= 0);
  }
  function edgeDist(t) {
    const p = g.player;
    return Math.hypot(t.x - p.x, t.z - p.z) - (t.r || 0);
  }
  function chooseAttackTarget(range) {
    const p = g.player;
    if (!g.lastAuto) {
      const f = g.foeNear(p.aimX, p.aimZ, 1.8);
      if (f && edgeDist(f) <= range) return f;
    }
    if (g.target && validTarget(g.target) && edgeDist(g.target) <= range) return g.target;
    const f = g.nearestFoe(p.x, p.z, range, null);
    if (f) return f;
    for (const t of g.towers) if (!t.dead && t.side === 'dire' && edgeDist(t) <= range) return t;
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
        if (validTarget(t) && edgeDist(t) <= A.range + 0.7 && g.canAct()) {
          if (A.type === 'ranged') {
            let dmg = g.stat.atkDmg * g.dmgMul(false);
            const crit = g.stat.crit > 0 && g.rand() < g.stat.crit;
            if (crit) dmg *= g.stat.critMul;
            g.fireProj({ from: p, kind: A.proj || 'ice', target: t, dmg, type: DMG.PHYS, speed: 17, y: 1.25, crit, heroAttack: true });
            p.face = Math.atan2(t.x - p.x, t.z - p.z);
            p.swing = 1;
            g.breakInvis();
          } else g.attackHit(t);
        }
      }
      return;
    }
    if (!g.canAct() || p.channel || p.charging || p.atkCd > 0) return;
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
      from: o.from, crit: !!o.crit, heroAttack: !!o.heroAttack, alive: true, life: 4,
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
          const opts = { src: pr.kind, attack: true, crit: pr.crit, structure: t.kind === 'tower' };
          dealDamage(g, pr.from, t, pr.dmg, pr.type, opts);
          if (pr.kind === 'ice' && !t.dead && t !== p) applyStatus(g, t, 'slow', 0.8, { k: 0.15 });
          if (pr.heroAttack && pr.crit && t !== p) g.emit('fx', { kind: 'crit', foe: t });
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

  // ---------------------------------------------------------------- hasar alma / verme (combat.js çağırır)
  g.damageHero = (amount, type, source, opts = {}) => {
    const p = g.player;
    if (p.dead || p.invuln > 0 || g.state === 'over' || g.state === 'idle') return 0;
    if (opts.attack && type === DMG.PHYS) {
      const ev = 1 - (1 - g.stat.evasion) * (1 - (p.windrun > 0 ? 0.8 : 0));
      if (ev > 0 && g.rand() < ev) { g.emit('evade', { src: source }); return 0; }
    }
    let a = amount;
    if (type === DMG.MAG && p.bkb > 0) a *= 0.4;
    if (type !== DMG.PURE) a *= (1 - g.stat.armor) * (p.callArmor > 0 ? 0.6 : 1);
    a = Math.max(1, Math.round(a));
    p.hp -= a;
    p.hurtT = 0.35;
    p.lastHurt = g.time;
    g.damageTaken += a;
    g.waveDamage += a;
    g.emit('hurt', { dmg: a, src: source, type });
    forAbilities((A, c) => { if (A.onHurt) A.onHurt(g, a, source, c); });
    if (p.hp <= 0) { p.hp = 0; playerDown(); }
    return a;
  };
  /** Geriye dönük uyum: DOG ısırıkları vb. */
  g.hurtPlayer = (dmg, src, opts = {}) => dealDamage(g, src, g.player, dmg, opts.type || DMG.PHYS, opts);
  g.slowPlayer = (t) => {
    if (applyStatus(g, g.player, 'slow', t, { k: 0.45 })) g.emit('slowed', {});
  };
  g.heal = (amount, { quiet = false } = {}) => {
    const p = g.player;
    if (p.dead) return;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    if (!quiet) g.emit('heal', { amount: Math.round(amount) });
  };

  g.damageFoe = (e, amount, type, source, opts = {}) => {
    if (e.dead || e.spawnT > 0) return 0;
    if (e.kind === 'dog') {
      if (e.type === 'afk' && e.state === 'afk') { e.state = 'awake'; g.emit('wake', { foe: e }); }
      if (e.type === 'farm' && (e.state === 'farm' || e.state === 'flee')) applyStatus(g, e, 'stun', 0.25);
    }
    let a = amount * mitigation(e, type);
    if (e.st.amp > 0) a *= 1 + e.st.ampK;
    a = Math.max(1, Math.round(a));
    e.hp -= a;
    e.hitFlash = 0.16;
    const kb = e.kind === 'boss' ? 0.12 : 1;
    e.kx += (opts.dirX || 0) * (opts.knock ?? 0.6) * kb;
    e.kz += (opts.dirZ || 0) * (opts.knock ?? 0.6) * kb;
    if (source === g.player) {
      e.aggroT = 3;
      if (e.kind === 'boss') e.angry = true;
    }
    if (!opts.quiet || a >= 60) g.emit('hit', { foe: e, dog: e, dmg: a, big: a >= 110, src: opts.src, crit: !!opts.crit });
    if (e.hp <= 0) killFoe(e, source, opts);
    return a;
  };

  g.damageTower = (t, amount, type, source, opts = {}) => {
    if (t.dead) return 0;
    if (t.side === 'radiant' && (source === g.player || !source || source.kind === 'tower')) return 0;
    if (t.side === 'dire' && source && source !== g.player && source.kind !== 'tower') return 0;
    if (type === DMG.MAG && !opts.structure) return 0; // büyüler binalara işlemez
    const a = Math.max(1, Math.round(amount * mitigation(t, type)));
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
          addGold(B.gold);
          g.addXp(B.xp);
          g.score += B.score;
        }
      }
      g.emit('towerDown', { tower: t, byHero });
    }
    return a;
  };

  function addGold(n) {
    const v = Math.round(n * (g.mods.gold || 1));
    g.player.gold += v;
    g.goldEarned += v;
    return v;
  }
  g.addGold = addGold;

  g.addXp = (n) => {
    const p = g.player;
    if (p.level >= MAX_LEVEL) return;
    p.xp += n * (g.mods.xp || 1);
    let up = false;
    while (p.level < MAX_LEVEL && p.xp >= xpFor(p.level)) {
      p.xp -= xpFor(p.level);
      p.level += 1;
      up = true;
      if (TALENT_LEVELS.includes(p.level)) {
        p.talentPending.push(p.level);
        g.emit('talentReady', { level: p.level });
      }
      g.emit('levelUp', { level: p.level });
    }
    if (up) recalc();
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
    const byHero = source === p || (source && source.hero === g.heroId);
    const killer = byHero ? 'hero' : source && source.kind === 'tower' ? 'tower' : 'other';
    g.kills += 1;
    g.killsByType[e.type] = (g.killsByType[e.type] || 0) + 1;
    const B = e.bounty;
    let gold = 0;
    if (e.kind === 'boss') gold = addGold(B.gold);
    else if (byHero) {
      gold = addGold(B.gold + 2 * (g.wave - 1) + LAST_HIT + g.wave);
      g.lastHits += 1;
    } else gold = addGold(Math.round((B.gold + 2 * (g.wave - 1)) * 0.35));
    g.addXp(B.xp + (e.kind === 'dog' ? 5 * (g.wave - 1) : 0));
    g.score += B.score;
    if (e.kind === 'creep') g.creepKills += 1;
    for (const it of p.items) if (it && it.id === 'wand') it.charges = Math.min(ITEMS.wand.maxCharges, (it.charges || 0) + 1);
    if (opts.src === 'ult') g.ultKills += 1;
    if (e.counted) g.dogsLeft = Math.max(0, g.dogsLeft - 1);
    g.emit('kill', { foe: e, dog: e, by: killer, lastHit: byHero, gold, chain: g.chain });
    g.emit('unitKilled', { unit: e, type: e.type, kind: e.kind, by: killer });
    // Dota duyuruları: yalnızca DOG / boss ve kahramanın öldürdükleri
    if (byHero && (e.kind === 'dog' || e.kind === 'boss')) {
      if (!g.firstBlood) { g.firstBlood = true; g.emit('firstBlood', { foe: e }); }
      if (g.time - g.lastKill <= 1.8) g.chain += 1;
      else g.chain = 1;
      g.lastKill = g.time;
      g.bestChain = Math.max(g.bestChain, g.chain);
      if (g.chain >= 2) {
        const m = MULTI[Math.min(5, g.chain)];
        g.score += m[1];
        g.emit('multikill', { n: g.chain, label: m[0], bonus: m[1], foe: e });
      }
      g.streak += 1;
      if (STREAK[g.streak]) g.emit('streak', { n: g.streak, label: STREAK[g.streak] });
    }
    if (e.kind === 'dog' && e.type === 'rapier' && !e.thief) {
      const pk = { id: nextId++, kind: 'rapier', x: e.x, z: e.z, t: 0, life: 12 };
      g.pickups.push(pk);
      g.emit('drop', { pickup: pk });
    }
    if (e.thief) {
      const pk = { id: nextId++, kind: 'rapierItem', x: e.x, z: e.z, t: 0, life: Infinity };
      g.pickups.push(pk);
      g.emit('drop', { pickup: pk, rapierItem: true });
    }
    if (e.kind === 'boss') {
      g.roshans += 1;
      const ag = { id: nextId++, kind: 'aegis', x: e.x + 0.6, z: e.z + 0.6, t: 0, life: Infinity };
      const ch = { id: nextId++, kind: 'cheese', x: e.x - 0.8, z: e.z + 0.2, t: 0, life: Infinity };
      g.pickups.push(ag, ch);
      g.emit('roshanDown', { foe: e });
      g.emit('bossKilled', { boss: 'roshan', k: g.roshans, by: killer });
    }
    for (const fn of g.hooks.onKill) fn(g, e, source);
    forAbilities((A, c) => { if (A.onKill) A.onKill(g, e, c); });
    if (g.state === 'playing' && g.dogsLeft === 0 && g.queue.length === 0) waveClear();
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
      speed: T.speed * sc.speed * (elite ? 1.05 : 1),
      dmg: T.dmg * sc.dmg * (elite ? 1.3 : 1) * (g.mods.enemyDmg || 1),
      armor: elite ? 0.1 : 0, magicResist: 0,
      elite, demo, scale: elite ? 1.15 : 1, seed: Math.random() * 100,
      state: 'go', t: 1.5 + Math.random() * 2,
      st: newStatus(), windup: 0, attackCd: 0.8, lunge: 0, hitFlash: 0,
      spawnT: demo ? 0 : 0.55, dead: false, deathT: 0,
      vis: 1, status: null, dist: 99, canBite: true,
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

  g.kuryeTouch = (d) => {
    const p = g.player;
    if (g.heroId === 'okcu' && p.tangoCharges > 0) {
      p.tangoCharges -= 1;
      g.tangosStolen += 1;
      g.emit('tangoStolen', { foe: d });
      return;
    }
    const tango = p.items.find((it) => it && it.id === 'tango');
    if (tango) {
      tango.charges -= 1;
      if (tango.charges <= 0) p.items[p.items.indexOf(tango)] = null;
      g.tangosStolen += 1;
      g.emit('tangoStolen', { foe: d });
      return;
    }
    const steal = Math.min(p.gold, 18 + 4 * g.wave);
    if (steal > 0) {
      p.gold -= steal;
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

  // ---------------------------------------------------------------- ölüm / Aegis
  function playerDown() {
    const p = g.player;
    p.charging = false;
    p.charge = 0;
    if (p.channel) g.endChannel(true);
    p.dance = null;
    g.streak = 0;
    if (p.aegis) {
      p.aegis = false;
      p.dead = true;
      p.reviveT = 1.3;
      g.emit('aegisUsed', {});
      return;
    }
    p.dead = true;
    g.state = 'dying';
    g.dyingT = 1.8;
    g.emit('death', {});
  }

  function revive() {
    const p = g.player;
    p.dead = false;
    p.hp = p.maxHp;
    p.mana = p.maxMana;
    p.invuln = 2.5;
    for (const k of ['stun', 'root', 'slow', 'silence']) p.st[k] = 0;
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
        d.cast = null;
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
    g.emit('revive', {});
  }

  // ---------------------------------------------------------------- eşyalar ve dükkân
  g.atFountain = () => {
    const p = g.player;
    return Math.hypot(p.x - FOUNTAIN.x, p.z - FOUNTAIN.z) < FOUNTAIN.r + 0.6;
  };
  g.usedSlots = () => g.player.items.filter(Boolean).length + g.courier.items.length;

  function addItem(id) {
    const p = g.player;
    const I = ITEMS[id];
    if (!I) return false;
    if (I.stack) {
      const ex = p.items.find((it) => it && it.id === id);
      if (ex) { ex.charges = (ex.charges || 0) + (I.charges || 1); return true; }
    }
    const i = p.items.indexOf(null);
    if (i < 0) return false;
    p.items[i] = { id, cd: 0, charges: I.charges != null ? I.charges : null };
    recalc();
    return true;
  }
  g.addItem = addItem;

  g.canBuy = (id) => {
    const I = ITEMS[id];
    if (!I || I.drop) return { ok: false, why: 'yok' };
    if (g.player.gold < I.cost) return { ok: false, why: 'altın' };
    const stackable = I.stack && (g.hasItem(id) || g.courier.items.includes(id));
    if (!stackable && g.usedSlots() >= SLOTS) return { ok: false, why: 'çanta' };
    if (g.player.dead && g.state !== 'break') return { ok: false, why: 'ölü' };
    return { ok: true };
  };

  g.buy = (id) => {
    const I = ITEMS[id];
    const chk = g.canBuy(id);
    if (!chk.ok) { g.emit('buyFail', { item: I, why: chk.why }); return false; }
    g.player.gold -= I.cost;
    const c = g.courier;
    if (g.atFountain() || g.state === 'idle') {
      addItem(id);
      g.emit('buy', { item: I, instant: true });
    } else {
      c.items.push(id);
      if (c.state !== 'fly') {
        if (c.state === 'home') { c.x = FOUNTAIN.x; c.z = FOUNTAIN.z; }
        c.state = 'fly';
        c.t = 0;
        g.emit('courierDepart', {});
      }
      g.emit('buy', { item: I, courier: true });
    }
    g.emit('itemBought', { item: I.id, cost: I.cost });
    return true;
  };

  g.sell = (slot) => {
    const p = g.player;
    const it = p.items[slot];
    if (!it) return false;
    const I = ITEMS[it.id];
    const refund = Math.floor((I.cost || 0) / 2);
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
  g.useWand = (it) => {
    const n = it.charges || 0;
    if (n <= 0) { g.emit('itemEmpty', { item: ITEMS.wand }); return false; }
    const p = g.player;
    p.hp = Math.min(p.maxHp, p.hp + 16 * n);
    p.mana = Math.min(p.maxMana, p.mana + 16 * n);
    it.charges = 0;
    g.emit('fx', { kind: 'wand', x: p.x, z: p.z, n });
    return true;
  };
  /** Göz Açıp Kapayana: hareket ediyorsa hareket yönüne, değilse nişana. */
  g.blinkTo = (maxD) => {
    const p = g.player;
    if (g.time - p.lastHurt < 2) { g.emit('blinkBlocked', {}); return false; }
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
    for (const k of ['stun', 'root', 'slow', 'silence', 'fear', 'taunt']) p.st[k] = 0;
    g.emit('fx', { kind: 'bkb', x: p.x, z: p.z });
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
          const id = c.items.shift();
          if (addItem(id)) got.push(ITEMS[id]);
          else { c.items.unshift(id); break; }
        }
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
        const gold = addGold(55 + 15 * g.wave);
        g.addXp(60 + 10 * g.wave);
        r.gold = gold;
        break;
      }
      default: break;
    }
    g.emit('runeTaken', { rune: r, R });
  }

  // ---------------------------------------------------------------- dalga akışı
  g.waveDef = (n) => {
    const W = g.config.waves;
    if (Array.isArray(W)) {
      if (n <= W.length) return W[n - 1];
      if (g.config.mode === 'story') return null;
    }
    return defaultWave(n);
  };

  function startWave(n) {
    const def = g.waveDef(n);
    if (!def) { endRun(true); return; }
    g.wave = n;
    g.queue = (def.dogs || []).slice();
    g.eliteLeft = def.elites || 0;
    g.spawnT = 0.9;
    g.burst = 3;
    g.bossWave = def.boss === 'roshan';
    g.dogsLeft = g.queue.length + (g.bossWave ? 1 : 0);
    g.dogsTotal = g.dogsLeft;
    g.waveShots = 0;
    g.waveHitShots = 0;
    g.waveDamage = 0;
    g.squadsLeft = def.creepSquads || 0;
    g.creepT = 5;
    g.state = 'playing';
    // Roshan dalgasından sonraki dalgada yıkılan kuleler yeniden dikilir
    if (n > 1 && (n - 1) % 5 === 0 && g.towers.some((t) => t.dead)) {
      const fresh = makeTowers(g, n);
      g.towers = g.towers.map((t, i) => (t.dead ? fresh[i] : t));
      g.emit('towersRebuilt', {});
    }
    if (g.bossWave) {
      const r = makeRoshan(g, Math.floor(n / 5));
      g.foes.push(r);
      g.emit('spawn', { foe: r, boss: true });
      g.emit('roshanSpawn', { foe: r });
    }
    g.emit('waveStart', { wave: n, boss: g.bossWave ? 'roshan' : null, dogs: g.queue.length });
  }

  function spawnSquad() {
    const n = g.wave;
    const comp = n < 4 ? ['melee', 'melee', 'ranged'] : n < 8 ? ['melee', 'melee', 'melee', 'ranged'] : ['melee', 'melee', 'melee', 'ranged', 'ranged'];
    let alive = 0;
    for (const e of g.foes) if (e.kind === 'creep' && !e.dead) alive += 1;
    let k = 0;
    for (const t of comp) {
      if (alive >= MAX_CREEPS) break;
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
    g.score += bonus + effBonus;
    const gold = addGold(90 + 15 * g.wave);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
    p.mana = Math.min(p.maxMana, p.mana + p.maxMana * 0.5);
    if (g.heroId === 'okcu' && p.tangoCharges < 3) p.tangoCharges += 1;
    for (const e of g.foes) if (e.kind === 'creep' && !e.dead) { e.retreat = true; e.windup = 0; }
    g.bubbles.length = 0;
    g.emit('waveClear', { wave: g.wave, bonus, accBonus: effBonus, effBonus, acc: eff, eff, gold, boss: g.bossWave });
    g.emit('waveEnd', { wave: g.wave, bonus, effBonus, gold, boss: g.bossWave });
  }

  g.skipBreak = () => {
    if (g.state === 'break' && g.breakT > 3.2) { g.breakT = 3.2; return true; }
    return false;
  };

  function endRun(victory = false) {
    g.state = 'over';
    const report = g.report();
    report.victory = victory;
    g.emit('runEnd', { score: g.score, wave: g.wave, heroId: g.heroId, stats: report, victory });
    g.emit('gameOver', { report });
  }

  function resetWorld() {
    g.foes.length = 0;
    g.arrows.length = 0;
    g.projs.length = 0;
    g.pickups.length = 0;
    g.bubbles.length = 0;
    g.runes.length = 0;
    g.courier = { state: 'home', x: FOUNTAIN.x, z: FOUNTAIN.z, y: 0, face: 0, items: [], t: 0 };
    g.towers = makeTowers(g, 1);
  }

  /** Yeni koşu. cfg: DEFAULT_CONFIG alanlarından istenenler. */
  g.start = (cfg = {}) => {
    g.config = { ...g.config, ...cfg };
    g.mods = { ...(g.config.modifiers || {}) };
    g.rng = g.config.seed != null ? seeded(Number(g.config.seed) || 1) : Math.random;
    resetWorld();
    g.setHero(g.config.heroId || g.heroId);
    Object.assign(g, {
      time: 0, wave: 0, score: 0, kills: 0, shots: 0, hitShots: 0, killsByType: {},
      chain: 0, lastKill: -10, bestChain: 0, streak: 0, firstBlood: false, slowmo: 0, ultKills: 0, damageTaken: 0,
      tangosUsed: 0, tangosStolen: 0, dyingT: 0, runeT: FIRST_RUNE, goldEarned: 0, lastHits: 0, creepKills: 0,
      roshans: 0, towersDown: 0, target: null,
    });
    const p = g.player;
    p.x = FOUNTAIN.x + 1.6;
    p.z = FOUNTAIN.z - 1.6;
    p.face = Math.PI * 0.75;
    if (g.mods.startGold) p.gold = g.mods.startGold;
    if (g.mods.startLevel > 1) g.addXp(Array.from({ length: g.mods.startLevel - 1 }, (_, i) => xpFor(i + 1)).reduce((a, b) => a + b, 0));
    g.emit('reset', {});
    g.emit('runStart', { heroId: g.heroId, config: g.config });
    startWave(1);
  };

  /** Tanıtım modu: menü arkasında dolaşan birkaç DOG, ortada seçili kahraman. */
  g.attract = (heroId) => {
    g.state = 'idle';
    resetWorld();
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
      creepKills: g.creepKills,
      roshans: g.roshans,
      towers: g.towersDown,
      items: p.items.filter(Boolean).map((it) => it.id),
      talents: [...p.tal],
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

    for (const k of ['q', 'w', 'e', 'r']) if (g.cds[k] > 0) g.cds[k] = Math.max(0, g.cds[k] - dt);
    for (const it of p.items) if (it && it.cd > 0) it.cd = Math.max(0, it.cd - dt);
    g.heroVisible = !p.dead && !(p.invis > 0);
    if (g.heroVisible) { g.lastSeenX = p.x; g.lastSeenZ = p.z; }

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
      const stunned = p.st.stun > 0;
      if (stunned) {
        if (p.charging) g.chargeCancel();
        if (p.channel) g.endChannel(true);
        p.atkWind = 0;
      }
      // hareket
      let mx = input.mx || 0;
      let mz = input.mz || 0;
      const ml = Math.hypot(mx, mz);
      if (ml > 1) { mx /= ml; mz /= ml; }
      moving = ml > 0.15;
      if (p.channel && ml > 0.55 && p.channel.t > 0.3 && !p.tal.has('buWalk')) g.endChannel(true);
      let sp = g.stat.speed;
      if (p.haste > 0) sp *= 1.45;
      if (p.windrun > 0) sp *= 1.6;
      if (p.smokeT > 0) sp *= 1.15;
      if (p.cullHaste > 0) sp *= 1.3;
      sp *= slowMul(p);
      if (p.charging) sp *= 0.45;
      if (p.channel) sp *= p.tal.has('buWalk') ? 0.6 : 0;
      if (stunned || p.st.root > 0 || p.dance) sp = 0;
      const k = Math.min(1, dt * 14);
      p.vx += (mx * sp - p.vx) * k;
      p.vz += (mz * sp - p.vz) * k;
      p.x += (p.vx + p.kx) * dt;
      p.z += (p.vz + p.kz) * dt;
      p.kx *= Math.max(0, 1 - dt * 6);
      p.kz *= Math.max(0, 1 - dt * 6);
      pushOut(p, HERO_R, g.towers);
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
      const busy = p.atkWind > 0 || p.swing > 0.6 || p.dance;
      if (!busy) {
        if (g.H.attack) {
          // saldıran kahramanlar yürüdükleri yöne bakar; saldırı kendi yönünü ayarlar
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
      for (let i = p.heals.length - 1; i >= 0; i--) {
        const hl = p.heals[i];
        hpr += hl.hps;
        hl.t -= dt;
        if (hl.t <= 0) p.heals.splice(i, 1);
      }
      p.hp = Math.min(p.maxHp, p.hp + hpr * dt);
      p.mana = Math.min(p.maxMana, p.mana + mpr * dt);
      for (const key of ['windrun', 'rapier', 'invuln', 'haste', 'dd', 'regenRune', 'bkb', 'callArmor', 'cullHaste', 'spinT', 'helixIcd', 'smokeT']) {
        if (p[key] > 0) p[key] = Math.max(0, p[key] - dt);
      }
      if (p.invis > 0) {
        p.invis -= dt;
        if (p.invis <= 0) { p.invis = 0; g.emit('invisEnd', {}); }
      }
      // yetenek adımları (şarj, kanal, dans, Tango şarjı…)
      forAbilities((A, c) => { if (A.step) A.step(g, dt, c); });
      stepAttack(dt, moving);
      // Güneş Tacı yanması
      if (g.stat.burn > 0 && (g.state === 'playing' || g.state === 'break')) {
        p.burnAcc = (p.burnAcc || 0) + dt;
        if (p.burnAcc >= 0.5) {
          p.burnAcc -= 0.5;
          const bd = g.stat.burn * 0.5 * g.dmgMul(true);
          for (const e of g.foes) {
            if (e.dead || e.spawnT > 0 || e.demo) continue;
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
    // rünler (oyun ve mola sırasında)
    if (g.state === 'playing' || g.state === 'break') {
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
    }

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
    if (g.state === 'dying') {
      g.dyingT -= dtReal;
      if (g.dyingT <= 0) endRun(false);
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
        g.emit('remove', { foe: d, dog: d, gone: true });
        continue;
      }
      if (d.hitFlash > 0) d.hitFlash -= dt;
      if (d.lunge > 0) d.lunge -= dt;
      if (d.spawnT > 0) {
        d.spawnT -= dt;
        if (d.kind !== 'boss') {
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
      } else if (d.kind === 'creep') {
        intent = thinkCreep(d, g, dt);
        biting = d.windup > 0;
      } else {
        intent = thinkRoshan(d, g, dt);
        biting = d.windup > 0 || !!d.cast;
      }
      let mx = intent.mx;
      let mz = intent.mz;
      const spd = biting ? 0 : intent.spd * slowMul(d);
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
      const ml = Math.hypot(mx, mz);
      if (ml > 1e-4 && spd > 0) {
        const nx = mx / Math.max(1, ml);
        const nz = mz / Math.max(1, ml);
        const k = Math.min(1, dt * 10);
        d.vx += (nx * spd - d.vx) * k;
        d.vz += (nz * spd - d.vz) * k;
      } else {
        d.vx *= 1 - Math.min(1, dt * 10);
        d.vz *= 1 - Math.min(1, dt * 10);
        if (ml > 1e-4 && spd === 0) {
          // yalnızca itilme
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
      if (L < min && !p.dead) {
        d.x = p.x + (dx / L) * min;
        d.z = p.z + (dz / L) * min;
      }
      collide(d, g, d.r);
      // yüz yönü
      let want = d.face;
      if (d.faceTo != null && (d.kind !== 'dog')) want = biting || spd === 0 ? d.faceTo : Math.hypot(d.vx, d.vz) > 0.3 ? Math.atan2(d.vx, d.vz) : d.faceTo;
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
        if (d.dead || d.spawnT > 0 || a.hitSet.has(d.id)) continue;
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
          dealDamage(g, g.player, d, a.dmg * falloff * 0.6, DMG.PHYS, { src: 'arrow', structure: true });
          a.hits += 1;
          stopAt = t;
          break;
        }
        dealDamage(g, g.player, d, a.dmg * falloff, DMG.PHYS, { dirX: a.dx, dirZ: a.dz, knock: 0.8 + a.charge * 2.2, src: 'arrow' });
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
      if (!gone && !p.dead && (b.x - p.x) ** 2 + (b.z - p.z) ** 2 < 0.62 * 0.62) {
        if (!(p.windrun > 0 && g.rand() < 0.8)) {
          dealDamage(g, b.owner, p, b.dmg, DMG.MAG, { src: 'report' });
          if (p.bkb <= 0) {
            g.slowPlayer(2.2);
            g.emit('bubbleHit', { bubble: b });
          }
        } else g.emit('evade', {});
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
      const delay = k.kind === 'aegis' || k.kind === 'cheese' ? 1.2 : 0.6;
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
        g.emit('pickup', { pickup: k });
      }
    }
  }

  // ---------------------------------------------------------------- yardımcılar
  g.foeNear = (x, z, maxD = 99) => {
    let best = null;
    let bd = maxD * maxD;
    for (const d of g.foes) {
      if (d.dead || d.spawnT > 0 || d.demo) continue;
      if (d.type === 'ward' && d.vis < 0.35) continue;
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
      if (d.dead || d.spawnT > 0 || d.demo) continue;
      if (d.type === 'ward' && d.vis < 0.35) continue;
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      let s = dist;
      if (d.status === 'afk') s += 8;
      if (d.kind === 'boss' && !d.angry) s += 10;
      if (d.kind === 'creep') s += 1.2;
      if (d.canBite && dist < 3) s -= 2;
      if (s < bs) { bs = s; best = d; }
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
        dealDamage(g, g.player, e, e.hp + 10, DMG.PURE, { src: 'dev' });
      }
      if (g.state === 'playing' && g.dogsLeft === 0) waveClear();
    },
    gold(n = 5000) { g.player.gold += n; },
    level(n) { const p = g.player; while (p.level < n) g.addXp(xpFor(p.level)); },
    roshan() {
      const r = makeRoshan(g, Math.max(1, Math.floor(g.wave / 5) || 1));
      r.counted = false;
      g.foes.push(r);
      g.emit('spawn', { foe: r, boss: true });
      g.emit('roshanSpawn', { foe: r });
      return r;
    },
    rune(kind) { g.spawnRune(kind); },
    creeps() { spawnSquad(); },
    heal() { const p = g.player; p.hp = p.maxHp; p.mana = p.maxMana; },
    god(v = true) { g.mods.heroHp = v ? 50 : 1; recalc(); g.player.hp = g.player.maxHp; },
  };

  g.setHero(g.config.heroId || 'okcu');
  return g;
}

export { ABILITIES, ROSHAN_PIT };
