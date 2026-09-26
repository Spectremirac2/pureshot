// 1vDOQUZ Arena 2.0 — birim tanımları (DOG'lar, Dire creep'leri, Roshan, kuleler) ve creep/Roshan/kule yapay zekâsı.
//
// UNITS tek tablo: can, hız, hasar, zırh (armor, 0..1 fiziksel azaltma), büyü direnci (magicResist), saldırı türü,
// menzil, ödül (bounty: altın/XP/puan), model anahtarı. Yeni bir boss ya da creep türü eklemek için buraya satır
// ekleyip bir think fonksiyonu yazmak yeterli (bkz. docs/oyunlar/arena.md → Mimari).

import { DOG_TYPES } from './dogs.js';
import { ROSHAN_PIT, DIRE_GATE, TOWER_R, TOWER_SPOTS, pushOut } from './map.js';
import { DMG, applyStatus, dealDamage, newStatus } from './combat.js';

const DOG_BASE = { kind: 'dog', armor: 0, magicResist: 0, attackType: 'melee', bounty: { gold: 38, xp: 45, score: 100 }, model: 'model-dog', height: 0.9 };

export const UNITS = {
  ...Object.fromEntries(Object.entries(DOG_TYPES).map(([id, T]) => [`dog_${id}`, { ...DOG_BASE, id: `dog_${id}`, type: id, hp: T.hp, speed: T.speed, dmg: T.dmg, r: T.r, name: T.short }])),
  creep_melee: {
    id: 'creep_melee', kind: 'creep', type: 'melee', name: 'Dire Piyadesi', short: 'PİYADE',
    hp: 250, speed: 3.05, dmg: 21, armor: 0.12, magicResist: 0, attackType: 'melee', range: 0.55, atkRate: 1.15, windup: 0.28, r: 0.4,
    bounty: { gold: 30, xp: 22, score: 30 }, model: 'model-creep-melee', height: 0.95,
  },
  creep_ranged: {
    id: 'creep_ranged', kind: 'creep', type: 'ranged', name: 'Dire Büyücüsü', short: 'BÜYÜCÜ',
    hp: 175, speed: 3.0, dmg: 24, armor: 0, magicResist: 0.1, attackType: 'ranged', range: 4.4, atkRate: 1.5, windup: 0.32, r: 0.38, proj: 'orb',
    bounty: { gold: 36, xp: 26, score: 40 }, model: 'model-creep-ranged', height: 0.95,
  },
  boss_roshan: {
    id: 'boss_roshan', kind: 'boss', type: 'roshan', name: 'Kaya Canavarı', short: 'ROSHAN',
    hp: 2600, speed: 3.4, dmg: 78, armor: 0.3, magicResist: 0.25, attackType: 'melee', range: 0.75, atkRate: 1.55, windup: 0.42, r: 1.05,
    bounty: { gold: 350, xp: 500, score: 1000 }, model: 'model-roshan', height: 3.0,
    slam: { cd: 7.5, tele: 1.1, r: 3.3, dmg: 140 }, roar: { cd: 13, tele: 0.95, r: 5.4, stun: 1.25, dmg: 35 },
  },
  tower_radiant: {
    id: 'tower_radiant', kind: 'tower', side: 'radiant', name: 'Radiant Kulesi', hp: 1500, armor: 0.25, magicResist: 0.5,
    attackType: 'ranged', range: 5.4, dmg: 50, atkRate: 1.2, proj: 'tower-r', model: 'model-tower-radiant', height: 3.6,
  },
  tower_dire: {
    id: 'tower_dire', kind: 'tower', side: 'dire', name: 'Dire Kulesi', hp: 1300, armor: 0.3, magicResist: 0.5,
    attackType: 'ranged', range: 5.0, dmg: 34, atkRate: 1.5, lockOn: 0.8, proj: 'tower-d', model: 'model-tower-dire', height: 3.6,
    bounty: { gold: 220, xp: 150, score: 500 },
  },
};

/** Dalga ölçeği: creep'ler ve Roshan için. */
export const creepScale = (wave) => ({ hp: 1 + 0.2 * (wave - 1) + 0.012 * (wave - 1) ** 2, dmg: 1 + 0.11 * (wave - 1) });

function base(g, U, x, z) {
  return {
    id: g.nextId(), kind: U.kind, type: U.type, def: U,
    x, z, vx: 0, vz: 0, kx: 0, kz: 0, face: Math.atan2(-x, -z), r: U.r,
    maxHp: U.hp, hp: U.hp, speed: U.speed, dmg: U.dmg, armor: U.armor, magicResist: U.magicResist,
    st: newStatus(), scale: 1, seed: Math.random() * 100,
    windup: 0, attackCd: 0.6, lunge: 0, hitFlash: 0, spawnT: 0.5, dead: false, deathT: 0,
    status: null, dist: 99, vis: 1, bounty: { ...U.bounty }, counted: false, tgt: null, retarget: 0, aggroT: 0,
  };
}

export function makeCreep(g, type, wave, x, z) {
  const U = UNITS[type === 'ranged' ? 'creep_ranged' : 'creep_melee'];
  const s = creepScale(wave);
  const e = base(g, U, x, z);
  e.maxHp = e.hp = Math.round(U.hp * s.hp * (g.mods.enemyHp || 1));
  e.dmg = U.dmg * s.dmg * (g.mods.enemyDmg || 1);
  e.bounty.gold = U.bounty.gold + 2 * (wave - 1);
  e.bounty.xp = U.bounty.xp + 3 * (wave - 1);
  e.spawnT = 0.7;
  return e;
}

export function makeRoshan(g, k) {
  const U = UNITS.boss_roshan;
  const e = base(g, U, ROSHAN_PIT.x, ROSHAN_PIT.z);
  e.maxHp = e.hp = Math.round((U.hp + 1500 * (k - 1)) * (g.mods.enemyHp || 1));
  e.dmg = (U.dmg + 22 * (k - 1)) * (g.mods.enemyDmg || 1);
  e.bounty = { gold: U.bounty.gold + 60 * (k - 1), xp: U.bounty.xp + 100 * (k - 1), score: U.bounty.score + 500 * (k - 1) };
  e.slamDmg = U.slam.dmg + 40 * (k - 1);
  e.slamCd = 4;
  e.roarCd = 6.5;
  e.cast = null;
  e.spawnT = 1.6;
  e.counted = true;
  e.bossImmune = true;
  e.face = Math.PI * 0.25; // çukurdan arenaya bakar
  e.k = k;
  return e;
}

export function makeTowers(g, wave = 1) {
  return TOWER_SPOTS.map((s) => {
    const U = UNITS[s.side === 'radiant' ? 'tower_radiant' : 'tower_dire'];
    const hp = Math.round(U.hp * (1 + 0.12 * (wave - 1)));
    return {
      id: `tw-${s.id}`, kind: 'tower', spot: s.id, side: s.side, def: U, x: s.x, z: s.z, r: TOWER_R,
      hp, maxHp: hp, armor: U.armor, magicResist: U.magicResist, st: newStatus(),
      cd: 1, tgt: null, dead: false, deadT: 0, hitFlash: 0, shotT: 0,
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

function resolveAttack(e, g) {
  const t = e.tgt;
  if (!alive(t) || (t === g.player && !g.heroVisible)) return;
  const tr = t === g.player ? 0.35 : t.r;
  const d = Math.hypot(t.x - e.x, t.z - e.z) - tr - e.r;
  if (d > e.def.range + 0.6) return;
  e.lunge = 0.22;
  if (e.def.attackType === 'ranged') {
    g.fireProj({ from: e, kind: e.def.proj || 'orb', target: t, dmg: e.dmg, type: DMG.PHYS, speed: 11, y: 0.8 });
  } else {
    dealDamage(g, e, t, e.dmg, DMG.PHYS, { attack: true, src: e.kind });
  }
}

// ------------------------------------------------------------------ creep
export function thinkCreep(e, g, dt) {
  const p = g.player;
  const st = e.st;
  e.status = null;
  if (st.stun > 0) { e.status = 'stun'; e.windup = 0; return STOP; }
  if (st.root > 0) { e.status = 'frozen'; e.windup = 0; return STOP; }
  if (st.fear > 0) {
    e.status = 'fear';
    const [ux, uz] = toward(e, p.x, p.z);
    return { mx: -ux, mz: -uz, spd: e.speed };
  }
  if (e.retreat) {
    const [ux, uz, L] = toward(e, DIRE_GATE.x, DIRE_GATE.z);
    if (L < 1.1) e.gone = true;
    return { mx: ux, mz: uz, spd: e.speed * 1.1 };
  }
  if (g.state === 'idle' || g.state === 'over') return STOP;
  if (e.aggroT > 0) e.aggroT -= dt;
  if (e.attackCd > 0) e.attackCd -= dt;
  e.retarget -= dt;
  const heroOk = g.heroVisible && !p.dead && g.state !== 'dying';
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
    if (e.attackCd <= 0) {
      e.windup = e.def.windup;
      e.attackCd = e.def.atkRate;
      g.emit('windup', { foe: e });
    }
    return STOP;
  }
  return { mx: ux, mz: uz, spd: e.speed };
}

// ------------------------------------------------------------------ Roshan
export function thinkRoshan(e, g, dt) {
  const p = g.player;
  const st = e.st;
  const U = e.def;
  e.status = null;
  if (st.stun > 0) { e.status = 'stun'; return STOP; }
  if (g.state === 'idle' || g.state === 'over') return STOP;
  const dp = Math.hypot(p.x - ROSHAN_PIT.x, p.z - ROSHAN_PIT.z);
  const heroOk = g.heroVisible && !p.dead && g.state !== 'dying';
  const engaged = heroOk && (dp < ROSHAN_PIT.leash + (e.angry ? 2.2 : 0.8) || st.taunt > 0);
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
          dealDamage(g, e, p, e.slamDmg, DMG.MAG, { src: 'slam' });
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
    const [hx, hz, hd] = toward(e, ROSHAN_PIT.x, ROSHAN_PIT.z);
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
    e.cast = { kind: 'roar', t: U.roar.tele, dur: U.roar.tele, r: U.roar.r };
    e.roarCd = U.roar.cd;
    g.emit('roshanTele', { foe: e, kind: 'roar', r: U.roar.r, t: U.roar.tele });
    return STOP;
  }
  if (e.slamCd <= 0 && L < U.slam.r - 0.5) {
    e.cast = { kind: 'slam', t: U.slam.tele, dur: U.slam.tele, r: U.slam.r };
    e.slamCd = U.slam.cd;
    g.emit('roshanTele', { foe: e, kind: 'slam', r: U.slam.r, t: U.slam.tele });
    return STOP;
  }
  if (L - 0.35 - e.r <= U.range) {
    if (e.attackCd <= 0) {
      e.windup = U.windup;
      e.attackCd = U.atkRate;
      g.emit('windup', { foe: e });
    }
    return STOP;
  }
  return { mx: ux, mz: uz, spd: e.speed };
}

// ------------------------------------------------------------------ kuleler
export function stepTowers(g, dt) {
  const p = g.player;
  const live = g.state === 'playing' || g.state === 'break' || g.state === 'dying';
  for (const t of g.towers) {
    if (t.hitFlash > 0) t.hitFlash -= dt;
    if (t.shotT > 0) t.shotT -= dt;
    if (t.dead) { t.deadT += dt; continue; }
    if (!live) continue;
    t.cd -= dt;
    const U = t.def;
    const R = U.range;
    if (t.side === 'radiant') {
      const cur = t.tgt;
      if (!(cur && !cur.dead && cur.spawnT <= 0 && Math.hypot(cur.x - t.x, cur.z - t.z) <= R + cur.r)) {
        t.tgt = null;
        let bd = Infinity;
        for (const e of g.foes) {
          if (e.dead || e.spawnT > 0 || e.demo) continue;
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
      const dmg = U.dmg * (1 + (t.side === 'dire' ? 0.1 : 0.14) * (g.wave - 1)) * (t.side === 'dire' ? g.mods.enemyDmg || 1 : 1);
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
