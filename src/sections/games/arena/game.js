// 1vDOQUZ Arena — oyun simülasyonu (görüntüden bağımsız).
// Sabit zaman adımıyla ilerler; görüntü katmanı (3D ya da 2D yedek) durumu okur ve
// emit() ile gönderilen olaylardan efekt üretir.

import { DOG_TYPES, buildWave, waveScale, thinkDog, tryBite, archOf } from './dogs.js';

export const ARENA_R = 13.2; // duvarın iç yarıçapı
export const PLAY_R = 12.3; // oynanabilir yarıçap
export const GATE_ANGLES = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
export const STEP = 1 / 60;

export const ABIL = {
  q: { cd: 0.26, chargeTime: 1.2, manaMin: 5, manaMax: 18 },
  w: { cd: 12, mana: 45, dur: 3, speed: 1.6, evade: 0.8 },
  e: { cd: 0.8, charges: 3, heal: 150, dur: 6, regen: 22 },
  r: { cd: 30, mana: 120, radius: 8, stun: 0.7, fear: 2.2 },
};

const PLAYER = { hp: 640, mana: 300, speed: 5.3, hpRegen: 1.5, manaRegen: 9 };
const MULTI = [null, null, ['DOUBLE KILL', 50], ['TRIPLE KILL', 150], ['ULTRA KILL', 300], ['RAMPAGE!', 500]];

export function createGame(emit) {
  let nextId = 1;
  const g = {
    PLAY_R,
    state: 'idle', // idle | playing | break | dying | over
    time: 0,
    wave: 0,
    score: 0,
    kills: 0,
    shots: 0,
    hitShots: 0,
    waveShots: 0,
    waveHitShots: 0,
    killsByType: {},
    chain: 0,
    lastKill: -10,
    bestChain: 0,
    dogs: [],
    arrows: [],
    pickups: [],
    bubbles: [],
    queue: [],
    spawnT: 0,
    burst: 0,
    dogsLeft: 0,
    dogsTotal: 9,
    breakT: 0,
    dyingT: 0,
    slowmo: 0,
    ultKills: 0,
    damageTaken: 0,
    tangosUsed: 0,
    tangosStolen: 0,
    player: null,
    cds: { q: 0, w: 0, e: 0, r: 0 },
    aimAuto: false,
    emit: (type, data) => emit(type, data || {}),
  };

  function newPlayer() {
    return {
      x: 0, z: 0, vx: 0, vz: 0, face: Math.PI, moving: 0,
      hp: PLAYER.hp, maxHp: PLAYER.hp, mana: PLAYER.mana, maxMana: PLAYER.mana,
      charging: false, chargeT: 0, charge: 0, pendingFire: -1,
      aimX: 0, aimZ: -4,
      windrun: 0, rapier: 0, slow: 0, tango: 0, tangoCharges: ABIL.e.charges, tangoRegen: 0,
      aegis: false, invuln: 0, hurtT: 0, recoil: 0, dead: false, reviveT: 0,
    };
  }
  g.player = newPlayer();

  // ---------------------------------------------------------------- köpekler
  function makeDog(type, { x, z, wave = 1, elite = false, demo = false }) {
    const T = DOG_TYPES[type];
    const sc = waveScale(wave);
    const hpMul = sc.hp * (elite ? 1.6 : 1);
    const d = {
      id: nextId++,
      type,
      arch: archOf(type),
      x, z, vx: 0, vz: 0,
      face: Math.atan2(-x, -z),
      r: T.r * (elite ? 1.15 : 1),
      maxHp: Math.round(T.hp * hpMul),
      hp: 0,
      speed: T.speed * sc.speed * (elite ? 1.05 : 1),
      dmg: T.dmg * sc.dmg * (elite ? 1.3 : 1),
      elite,
      demo,
      scale: elite ? 1.15 : 1,
      seed: Math.random() * 100,
      state: 'go', t: 1.5 + Math.random() * 2,
      stun: 0, fear: 0, windup: 0, attackCd: 0.8, lunge: 0, hitFlash: 0,
      spawnT: demo ? 0 : 0.55,
      dead: false, deathT: 0,
      vis: 1, status: null, dist: 99, canBite: true,
      farmT: 0, coinT: 1, stealCd: 0,
      kx: 0, kz: 0,
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
    // oyuncudan uzak kapılardan birini seç
    const gates = GATE_ANGLES.map((a) => {
      const gx = Math.sin(a) * (PLAY_R - 0.4);
      const gz = Math.cos(a) * (PLAY_R - 0.4);
      return { a, gx, gz, d: Math.hypot(gx - p.x, gz - p.z) };
    }).sort((a, b) => b.d - a.d);
    const gate = gates[Math.random() < 0.7 ? 0 : 1];
    const jitter = (Math.random() - 0.5) * 0.25;
    const x = Math.sin(gate.a + jitter) * (PLAY_R - 0.3);
    const z = Math.cos(gate.a + jitter) * (PLAY_R - 0.3);
    const d = makeDog(type, { x, z, wave: g.wave, elite });
    g.dogs.push(d);
    emit('spawn', { dog: d, gate: gate.a });
    return d;
  }

  function damageDog(d, dmg, { dirX = 0, dirZ = 0, knock = 0.6, src = 'arrow' } = {}) {
    if (d.dead || d.spawnT > 0) return false;
    if (d.type === 'afk' && d.state === 'afk') {
      d.state = 'awake';
      emit('wake', { dog: d });
    }
    if (d.type === 'farm' && (d.state === 'farm' || d.state === 'flee')) {
      // vurulan farmcı biraz sersemler; kovalamak ödüllendirilir
      d.stun = Math.max(d.stun, 0.25);
    }
    const amount = Math.round(dmg);
    d.hp -= amount;
    d.hitFlash = 0.16;
    d.kx += dirX * knock;
    d.kz += dirZ * knock;
    emit('hit', { dog: d, dmg: amount, big: amount >= 110, src });
    if (d.hp <= 0) killDog(d, src);
    return true;
  }

  function killDog(d, src) {
    d.dead = true;
    d.hp = 0;
    d.deathT = 0;
    g.kills += 1;
    g.dogsLeft = Math.max(0, g.dogsLeft - 1);
    g.killsByType[d.type] = (g.killsByType[d.type] || 0) + 1;
    g.score += 100;
    if (src === 'ult') g.ultKills += 1;
    // çoklu öldürme zinciri (Dota tarzı)
    if (g.time - g.lastKill <= 1.8) g.chain += 1;
    else g.chain = 1;
    g.lastKill = g.time;
    g.bestChain = Math.max(g.bestChain, g.chain);
    emit('kill', { dog: d, chain: g.chain });
    if (g.chain >= 2) {
      const m = MULTI[Math.min(5, g.chain)];
      g.score += m[1];
      emit('multikill', { n: g.chain, label: m[0], bonus: m[1], dog: d });
    }
    if (d.type === 'rapier') {
      const pk = { id: nextId++, kind: 'rapier', x: d.x, z: d.z, t: 0, life: 12 };
      g.pickups.push(pk);
      emit('drop', { pickup: pk });
    }
    if (g.state === 'playing' && g.dogsLeft === 0 && g.queue.length === 0) waveClear();
  }

  // ---------------------------------------------------------------- oyuncu
  g.hurtPlayer = (dmg, src) => {
    const p = g.player;
    if (p.dead || p.invuln > 0 || g.state === 'over' || g.state === 'idle') return;
    if (p.windrun > 0 && Math.random() < ABIL.w.evade) {
      emit('evade', { src });
      return;
    }
    const amount = Math.round(dmg);
    p.hp -= amount;
    p.hurtT = 0.35;
    g.damageTaken += amount;
    emit('hurt', { dmg: amount, src });
    if (p.hp <= 0) {
      p.hp = 0;
      playerDown();
    }
  };
  g.slowPlayer = (t) => {
    g.player.slow = Math.max(g.player.slow, t);
    emit('slowed', {});
  };
  g.kuryeTouch = (d) => {
    const p = g.player;
    if (p.tangoCharges > 0) {
      p.tangoCharges -= 1;
      g.tangosStolen += 1;
      emit('tangoStolen', { dog: d });
    } else {
      g.hurtPlayer(d.dmg * 1.5, d);
    }
  };
  g.spawnBubble = (d, ux, uz) => {
    const b = { id: nextId++, x: d.x + ux * 0.6, z: d.z + uz * 0.6, dx: ux, dz: uz, speed: 6.2, life: 3, owner: d.id, dmg: d.dmg * 0.6 };
    g.bubbles.push(b);
    emit('bubble', { bubble: b, dog: d });
  };

  function playerDown() {
    const p = g.player;
    p.charging = false;
    p.charge = 0;
    if (p.aegis) {
      p.aegis = false;
      p.dead = true;
      p.reviveT = 1.3;
      emit('aegisUsed', {});
      return;
    }
    p.dead = true;
    g.state = 'dying';
    g.dyingT = 1.8;
    emit('death', {});
  }

  function revive() {
    const p = g.player;
    p.dead = false;
    p.hp = p.maxHp;
    p.mana = p.maxMana;
    p.invuln = 2.5;
    for (const d of g.dogs) {
      if (d.dead) continue;
      const dx = d.x - p.x;
      const dz = d.z - p.z;
      const L = Math.hypot(dx, dz) || 1;
      if (L < 6) {
        d.kx += (dx / L) * 4;
        d.kz += (dz / L) * 4;
        d.stun = Math.max(d.stun, 1);
        d.windup = 0;
      }
    }
    emit('revive', {});
  }

  // ---------------------------------------------------------------- yetenekler
  g.chargeStart = () => {
    const p = g.player;
    if (!canAct()) return;
    if (p.charging) return;
    p.charging = true;
    p.chargeT = 0;
    p.charge = 0;
    emit('chargeStart', {});
  };
  g.chargeCancel = () => {
    const p = g.player;
    if (!p.charging) return;
    p.charging = false;
    p.charge = 0;
    emit('chargeEnd', {});
  };
  g.chargeRelease = () => {
    const p = g.player;
    if (!p.charging) return;
    p.charging = false;
    const c = p.charge;
    p.charge = 0;
    emit('chargeEnd', {});
    if (!canAct()) return;
    if (g.cds.q > 0) p.pendingFire = c;
    else fire(c);
  };

  function fire(c) {
    const p = g.player;
    const cost = ABIL.q.manaMin + (ABIL.q.manaMax - ABIL.q.manaMin) * c;
    if (p.mana < cost) {
      emit('noMana', { key: 'q' });
      return;
    }
    p.mana -= cost;
    let dx = p.aimX - p.x;
    let dz = p.aimZ - p.z;
    let L = Math.hypot(dx, dz);
    if (L < 0.3) {
      dx = Math.sin(p.face);
      dz = Math.cos(p.face);
      L = 1;
    }
    dx /= L;
    dz /= L;
    p.face = Math.atan2(dx, dz);
    p.recoil = 1;
    const full = c >= 0.97;
    const a = {
      id: nextId++,
      x: p.x + dx * 0.55,
      z: p.z + dz * 0.55,
      dx, dz,
      speed: 25 + 15 * c,
      range: 11 + 13 * c,
      traveled: 0,
      dmg: (34 + 112 * Math.pow(c, 1.15)) * (p.rapier > 0 ? 2 : 1),
      pierce: full ? 99 : Math.floor(c * 4),
      charge: c,
      full,
      hits: 0,
      kills: 0,
      hitSet: new Set(),
      alive: true,
      rapier: p.rapier > 0,
    };
    g.arrows.push(a);
    g.shots += 1;
    g.waveShots += 1;
    g.cds.q = ABIL.q.cd;
    emit('shoot', { arrow: a, charge: c });
  }

  g.castW = () => {
    const p = g.player;
    if (!canAct()) return false;
    if (g.cds.w > 0) { emit('notReady', { key: 'w' }); return false; }
    if (p.mana < ABIL.w.mana) { emit('noMana', { key: 'w' }); return false; }
    p.mana -= ABIL.w.mana;
    p.windrun = ABIL.w.dur;
    g.cds.w = ABIL.w.cd;
    emit('windrun', {});
    return true;
  };

  g.castE = () => {
    const p = g.player;
    if (!canAct()) return false;
    if (g.cds.e > 0) return false;
    if (p.tangoCharges <= 0) { emit('notReady', { key: 'e' }); return false; }
    p.tangoCharges -= 1;
    p.tango = ABIL.e.dur;
    g.cds.e = ABIL.e.cd;
    g.tangosUsed += 1;
    if (p.tangoRegen <= 0) p.tangoRegen = ABIL.e.regen;
    emit('tango', {});
    return true;
  };

  g.castR = () => {
    const p = g.player;
    if (!canAct()) return false;
    if (g.cds.r > 0) { emit('notReady', { key: 'r' }); return false; }
    if (p.mana < ABIL.r.mana) { emit('noMana', { key: 'r' }); return false; }
    p.mana -= ABIL.r.mana;
    g.cds.r = ABIL.r.cd;
    const dmg = 90 + 12 * g.wave;
    let n = 0;
    emit('ult', { x: p.x, z: p.z, radius: ABIL.r.radius });
    for (const d of g.dogs) {
      if (d.dead || d.spawnT > 0) continue;
      const dx = d.x - p.x;
      const dz = d.z - p.z;
      const L = Math.hypot(dx, dz) || 1;
      if (L > ABIL.r.radius) continue;
      n += 1;
      d.windup = 0;
      if (d.type === 'afk' && d.state === 'afk') d.state = 'awake';
      if (d.type === 'smurf' && d.state !== 'go') { d.state = 'go'; d.t = 2; }
      damageDog(d, dmg * (1 - (L / ABIL.r.radius) * 0.35), { dirX: dx / L, dirZ: dz / L, knock: 2.2, src: 'ult' });
      if (!d.dead) {
        d.stun = ABIL.r.stun;
        d.fear = ABIL.r.fear;
      }
    }
    emit('ultHit', { n });
    return true;
  };

  function canAct() {
    const p = g.player;
    return (g.state === 'playing' || g.state === 'break') && !p.dead;
  }

  // ---------------------------------------------------------------- dalga akışı
  function startWave(n) {
    g.wave = n;
    g.queue = buildWave(n);
    const sc = waveScale(n);
    // elitler: kuyruğun sonlarına işaret koy
    g.eliteLeft = sc.elites;
    g.spawnT = 0.9;
    g.burst = 3;
    g.dogsLeft = g.queue.length;
    g.dogsTotal = g.queue.length;
    g.waveShots = 0;
    g.waveHitShots = 0;
    g.state = 'playing';
    emit('waveStart', { wave: n });
  }

  function waveClear() {
    const p = g.player;
    g.state = 'break';
    g.breakT = 5.5;
    g.slowmo = 0.9;
    const acc = g.waveShots ? g.waveHitShots / g.waveShots : 0;
    const bonus = 300 * g.wave;
    const accBonus = Math.round(acc * 400);
    g.score += bonus + accBonus;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
    p.mana = Math.min(p.maxMana, p.mana + p.maxMana * 0.5);
    if (p.tangoCharges < ABIL.e.charges) p.tangoCharges += 1;
    if (!g.pickups.some((k) => k.kind === 'aegis')) {
      const pk = { id: nextId++, kind: 'aegis', x: 0, z: 0, t: 0, life: Infinity };
      g.pickups.push(pk);
    }
    emit('waveClear', { wave: g.wave, bonus, accBonus, acc });
  }

  g.start = () => {
    g.dogs.length = 0;
    g.arrows.length = 0;
    g.pickups.length = 0;
    g.bubbles.length = 0;
    g.player = newPlayer();
    g.cds = { q: 0, w: 0, e: 0, r: 0 };
    Object.assign(g, {
      time: 0, wave: 0, score: 0, kills: 0, shots: 0, hitShots: 0, killsByType: {},
      chain: 0, lastKill: -10, bestChain: 0, slowmo: 0, ultKills: 0, damageTaken: 0,
      tangosUsed: 0, tangosStolen: 0, dyingT: 0,
    });
    emit('reset', {});
    startWave(1);
  };

  /** Tanıtım modu: menü arkasında dolaşan birkaç DOG. */
  g.attract = () => {
    g.state = 'idle';
    g.dogs.length = 0;
    g.arrows.length = 0;
    g.pickups.length = 0;
    g.bubbles.length = 0;
    g.player = newPlayer();
    g.player.face = Math.PI * 0.85;
    emit('reset', {});
    ['feed', 'farm', 'chat', 'rapier', 'kurye'].forEach((t, i) => {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const d = makeDog(t, { x: Math.sin(a) * 6.5, z: Math.cos(a) * 6.5, demo: true });
      g.dogs.push(d);
      emit('spawn', { dog: d, quiet: true });
    });
  };

  g.report = () => {
    let topType = null;
    let topN = 0;
    for (const [t, n] of Object.entries(g.killsByType)) {
      if (n > topN) { topN = n; topType = t; }
    }
    return {
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

    // bekleme süreleri
    for (const k of ['q', 'w', 'e', 'r']) if (g.cds[k] > 0) g.cds[k] = Math.max(0, g.cds[k] - dt);
    if (p.pendingFire >= 0 && g.cds.q <= 0) {
      const c = p.pendingFire;
      p.pendingFire = -1;
      if (canAct()) fire(c);
    }

    // nişan
    const target = input.auto ? g.autoTarget() : null;
    g.target = null;
    if (input.aimX != null && !input.auto) {
      p.aimX = input.aimX;
      p.aimZ = input.aimZ;
      g.target = g.dogNear(p.aimX, p.aimZ, 1.8);
    } else if (target) {
      p.aimX = target.x;
      p.aimZ = target.z;
      g.target = target;
    } else if (input.mx || input.mz) {
      p.aimX = p.x + input.mx * 5;
      p.aimZ = p.z + input.mz * 5;
    }

    if (g.state === 'idle') {
      p.face += dt * 0.25;
    } else if (!p.dead) {
      // şarj
      if (p.charging) {
        p.chargeT += dt;
        p.charge = Math.min(1, p.chargeT / ABIL.q.chargeTime);
      }
      // hareket
      const slowMul = p.slow > 0 ? 0.55 : 1;
      const windMul = p.windrun > 0 ? ABIL.w.speed : 1;
      const chargeMul = p.charging ? 0.45 : 1;
      const sp = PLAYER.speed * slowMul * windMul * chargeMul;
      let mx = input.mx || 0;
      let mz = input.mz || 0;
      const ml = Math.hypot(mx, mz);
      if (ml > 1) { mx /= ml; mz /= ml; }
      const k = Math.min(1, dt * 14);
      p.vx += (mx * sp - p.vx) * k;
      p.vz += (mz * sp - p.vz) * k;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      const pr = Math.hypot(p.x, p.z);
      if (pr > PLAY_R - 0.4) {
        p.x *= (PLAY_R - 0.4) / pr;
        p.z *= (PLAY_R - 0.4) / pr;
      }
      p.moving = Math.hypot(p.vx, p.vz) / PLAYER.speed;
      // yüz: nişana ya da harekete
      const adx = p.aimX - p.x;
      const adz = p.aimZ - p.z;
      let want = p.face;
      if (!input.auto || g.target) {
        if (Math.hypot(adx, adz) > 0.3) want = Math.atan2(adx, adz);
      } else if (ml > 0.1) want = Math.atan2(mx, mz);
      let da = want - p.face;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      p.face += da * Math.min(1, dt * 16);

      // yenilenme ve etkiler
      p.hp = Math.min(p.maxHp, p.hp + PLAYER.hpRegen * dt + (p.tango > 0 ? (ABIL.e.heal / ABIL.e.dur) * dt : 0));
      p.mana = Math.min(p.maxMana, p.mana + PLAYER.manaRegen * dt);
      if (p.tango > 0) p.tango -= dt;
      if (p.windrun > 0) p.windrun -= dt;
      if (p.rapier > 0) p.rapier -= dt;
      if (p.slow > 0) p.slow -= dt;
      if (p.invuln > 0) p.invuln -= dt;
      if (p.tangoCharges < ABIL.e.charges) {
        if (p.tangoRegen <= 0) p.tangoRegen = ABIL.e.regen;
        p.tangoRegen -= dt;
        if (p.tangoRegen <= 0) {
          p.tangoCharges += 1;
          p.tangoRegen = p.tangoCharges < ABIL.e.charges ? ABIL.e.regen : 0;
          emit('tangoReady', {});
        }
      } else p.tangoRegen = 0;
    } else if (p.reviveT > 0) {
      p.reviveT -= dt;
      if (p.reviveT <= 0) revive();
    }
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 5);

    // doğurma
    if (g.state === 'playing' && g.queue.length) {
      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        const t = g.queue.shift();
        const elite = g.eliteLeft > 0 && g.queue.length < g.eliteLeft + 2 && Math.random() < 0.7;
        if (elite) g.eliteLeft -= 1;
        spawnDog(t, elite);
        if (g.burst > 1) { g.burst -= 1; g.spawnT = 0.35; }
        else g.spawnT = waveScale(g.wave).interval;
      }
    }

    stepDogs(dt);
    stepArrows(dt);
    stepBubbles(dt);
    stepPickups(dt);

    if (g.state === 'break') {
      const before = Math.ceil(g.breakT);
      g.breakT -= dt;
      const after = Math.ceil(g.breakT);
      if (after !== before && after <= 3 && after > 0) emit('countdown', { n: after });
      if (g.breakT <= 0) startWave(g.wave + 1);
    }
    if (g.state === 'dying') {
      g.dyingT -= dtReal;
      if (g.dyingT <= 0) {
        g.state = 'over';
        emit('gameOver', { report: g.report() });
      }
    }
  };

  function stepDogs(dt) {
    const p = g.player;
    const list = g.dogs;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      if (d.dead) {
        d.deathT += dt;
        if (d.deathT > 1.0) {
          list.splice(i, 1);
          emit('remove', { dog: d });
        }
        continue;
      }
      if (d.hitFlash > 0) d.hitFlash -= dt;
      if (d.lunge > 0) d.lunge -= dt;
      if (d.spawnT > 0) {
        d.spawnT -= dt;
        // kapıdan içeri yürür
        const L = Math.hypot(d.x, d.z) || 1;
        d.x -= (d.x / L) * dt * 1.6;
        d.z -= (d.z / L) * dt * 1.6;
        continue;
      }
      const intent = thinkDog(d, g, dt);
      let biting = false;
      if (g.state === 'playing' || g.state === 'break') biting = tryBite(d, g, dt);
      let mx = intent.mx;
      let mz = intent.mz;
      let spd = biting ? 0 : intent.spd;
      // ayrışma: köpekler üst üste binmesin
      for (const o of list) {
        if (o === d || o.dead) continue;
        const dx = d.x - o.x;
        const dz = d.z - o.z;
        const L2 = dx * dx + dz * dz;
        const min = d.r + o.r;
        if (L2 < min * min && L2 > 1e-6) {
          const L = Math.sqrt(L2);
          const push = (min - L) / min;
          mx += (dx / L) * push * 1.4;
          mz += (dz / L) * push * 1.4;
        }
      }
      const ml = Math.hypot(mx, mz);
      if (ml > 1e-4) {
        const nx = mx / Math.max(1, ml);
        const nz = mz / Math.max(1, ml);
        const k = Math.min(1, dt * 10);
        d.vx += (nx * spd - d.vx) * k;
        d.vz += (nz * spd - d.vz) * k;
      } else {
        d.vx *= 1 - Math.min(1, dt * 10);
        d.vz *= 1 - Math.min(1, dt * 10);
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
      const r = Math.hypot(d.x, d.z);
      if (r > PLAY_R - d.r * 0.5) {
        d.x *= (PLAY_R - d.r * 0.5) / r;
        d.z *= (PLAY_R - d.r * 0.5) / r;
      }
      // yüz yönü
      let want = d.face;
      if (d.status === 'dash' || d.windup > 0 || (d.canBite && d.dist < 3)) want = Math.atan2(p.x - d.x, p.z - d.z);
      else if (Math.hypot(d.vx, d.vz) > 0.3) want = Math.atan2(d.vx, d.vz);
      let da = want - d.face;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      d.face += da * Math.min(1, dt * 10);
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
      for (const d of g.dogs) {
        if (d.dead || d.spawnT > 0 || a.hitSet.has(d.id)) continue;
        const t = Math.max(0, Math.min(stepLen, (d.x - a.x) * a.dx + (d.z - a.z) * a.dz));
        const cx = a.x + a.dx * t;
        const cz = a.z + a.dz * t;
        const rr = d.r + (a.full ? 0.28 : 0.14);
        if ((d.x - cx) ** 2 + (d.z - cz) ** 2 < rr * rr) hits.push([t, d]);
      }
      hits.sort((u, v) => u[0] - v[0]);
      let stopAt = -1;
      for (const [t, d] of hits) {
        a.hitSet.add(d.id);
        const falloff = Math.pow(0.88, a.hits);
        const wasAlive = !d.dead;
        damageDog(d, a.dmg * falloff, { dirX: a.dx, dirZ: a.dz, knock: 0.8 + a.charge * 2.2 });
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
    emit('arrowEnd', { arrow: a, wall });
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
        if (!(p.windrun > 0 && Math.random() < ABIL.w.evade)) {
          g.hurtPlayer(b.dmg, b);
          g.slowPlayer(2.2);
          emit('bubbleHit', { bubble: b });
        } else emit('evade', {});
        gone = true;
      }
      if (gone) {
        g.bubbles.splice(i, 1);
        emit('bubbleEnd', { bubble: b });
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
        emit('pickupGone', { pickup: k });
        continue;
      }
      if (p.dead || g.state === 'idle' || g.state === 'over') continue;
      if ((k.x - p.x) ** 2 + (k.z - p.z) ** 2 < (k.kind === 'aegis' ? 1.1 : 0.9) ** 2 && k.t > (k.kind === 'aegis' ? 1.4 : 0.6)) {
        g.pickups.splice(i, 1);
        if (k.kind === 'rapier') p.rapier = 8;
        if (k.kind === 'aegis') {
          if (p.aegis) {
            p.hp = p.maxHp;
            p.mana = p.maxMana;
            k.full = true;
          } else p.aegis = true;
        }
        emit('pickup', { pickup: k });
      }
    }
  }

  // ---------------------------------------------------------------- yardımcılar
  g.dogNear = (x, z, maxD = 99) => {
    let best = null;
    let bd = maxD * maxD;
    for (const d of g.dogs) {
      if (d.dead || d.spawnT > 0 || d.demo) continue;
      if (d.type === 'ward' && d.vis < 0.35) continue;
      const q = (d.x - x) ** 2 + (d.z - z) ** 2;
      if (q < bd) { bd = q; best = d; }
    }
    return best;
  };

  g.autoTarget = () => {
    const p = g.player;
    // menzildeki en yakın, uyuyan AFK'ları en sona bırak
    let best = null;
    let bs = Infinity;
    for (const d of g.dogs) {
      if (d.dead || d.spawnT > 0 || d.demo) continue;
      if (d.type === 'ward' && d.vis < 0.35) continue;
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      let s = dist;
      if (d.status === 'afk') s += 8;
      if (d.canBite && dist < 3) s -= 2;
      if (s < bs) { bs = s; best = d; }
    }
    return best;
  };

  return g;
}
