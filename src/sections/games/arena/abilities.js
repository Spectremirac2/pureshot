// 1vDOQUZ Arena 2.0 — yetenek kayıt defteri: her yetenek veri + etki fonksiyonları.
//
// Şema (bkz. docs/oyunlar/arena.md → Mimari):
//   id, hero, slot ('q'|'w'|'e'|'r'), name, desc, icon (arena.js glif anahtarı), ult?
//   targeting: 'none' | 'point' | 'unit' | 'passive' | 'charge' | 'channel'
//   levels: [{ mana, cd, …değerler }]  → şimdilik yalnızca 1. seviye kullanılır; L = levels[seviye-1]
//   cast(g, c) → bool     c = { A, L, key, p, cd } (c.cd değiştirilirse o bekleme uygulanır)
//   canCast?(g, c) → bool (hedef yoksa false; olayı kendisi yayar)
//   step?(g, dt, c)       her adım (kanal, dans, şarj…)
//   stats?(g, st, c)      pasif stat katkısı (recalc)
//   onAttack?(g, target, hit, c) · onHurt?(g, dmg, source, c) · onKill?(g, foe, c)
//   hud?(g, c) → { cdFrac, cdLeft, noMana, active, charging, charge, full, extra, passive }
// Hasar hep dealDamage(); durumlar applyStatus() ile.

import { DMG, applyStatus, dealDamage } from './combat.js';

const has = (g, id) => g.player.tal.has(id);
const inR = (a, b, r) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 <= r * r;

export const ABILITIES = {
  // ================================================================== OKÇU
  okcu_shot: {
    id: 'okcu_shot', hero: 'okcu', slot: 'q', icon: 'q', name: 'CureShot', targeting: 'charge',
    desc: 'Basılı tut: 1,2 sn’ye kadar şarj. Bırak: delip geçen ok. Şarj arttıkça hasar, menzil ve delme büyür.',
    costText: '5–18', cdText: '0,26 sn',
    levels: [{ cd: 0.26, chargeTime: 1.2, manaMin: 5, manaMax: 18 }],
    chargeTime(g, L) {
      let t = L.chargeTime;
      if (has(g, 'okCharge')) t *= 0.7;
      if (g.hasItem('butterfly')) t *= 0.8;
      return t;
    },
    step(g, dt, c) {
      const p = g.player;
      if (p.charging) {
        p.chargeT += dt;
        p.charge = Math.min(1, p.chargeT / this.chargeTime(g, c.L));
      }
      if (p.pendingFire >= 0 && g.cds.q <= 0) {
        const ch = p.pendingFire;
        p.pendingFire = -1;
        if (g.canAct()) this.fire(g, ch, c);
      }
    },
    fire(g, ch, c) {
      const p = g.player;
      const L = c.L;
      const cost = L.manaMin + (L.manaMax - L.manaMin) * ch;
      if (p.mana < cost) { g.emit('noMana', { key: 'q' }); return; }
      p.mana -= cost;
      let dx = p.aimX - p.x;
      let dz = p.aimZ - p.z;
      let len = Math.hypot(dx, dz);
      if (len < 0.3) { dx = Math.sin(p.face); dz = Math.cos(p.face); len = 1; }
      dx /= len;
      dz /= len;
      p.face = Math.atan2(dx, dz);
      p.recoil = 1;
      const full = ch >= 0.97;
      const dmg = (34 + 112 * Math.pow(ch, 1.15)) * g.dmgMul(false) * (has(g, 'okDmg') ? 1.15 : 1);
      const shoot = (ax, az, k) => {
        const a = {
          id: g.nextId(), x: p.x + ax * 0.55, z: p.z + az * 0.55, dx: ax, dz: az,
          speed: 25 + 15 * ch, range: 11 + 13 * ch, traveled: 0, dmg: dmg * k,
          pierce: full ? 99 : Math.floor(ch * 4), charge: ch, full, hits: 0, kills: 0, hitSet: new Set(), alive: true,
          rapier: g.doubleDmg(),
        };
        g.arrows.push(a);
        return a;
      };
      const main = shoot(dx, dz, 1);
      if (full && has(g, 'okMulti')) {
        for (const s of [-1, 1]) {
          const ang = Math.atan2(dx, dz) + s * 0.2;
          shoot(Math.sin(ang), Math.cos(ang), 0.7);
        }
      }
      g.shots += 1;
      g.waveShots += 1;
      g.setCd('q', L.cd);
      g.breakInvis();
      g.emit('shoot', { arrow: main, charge: ch });
    },
    hud(g, c) {
      const p = g.player;
      const L = c.L;
      return { cdFrac: g.cds.q / L.cd, cdLeft: 0, noMana: p.mana < L.manaMin, charging: p.charging, charge: p.charge, full: p.charging && p.charge >= 0.97, extra: String(Math.round(L.manaMin + (L.manaMax - L.manaMin) * (p.charging ? p.charge : 0))) };
    },
  },
  okcu_windrun: {
    id: 'okcu_windrun', hero: 'okcu', slot: 'w', icon: 'w', name: 'Rüzgâr Koşusu', targeting: 'none',
    desc: '3 sn boyunca %60 hız ve %80 kaçınma.',
    levels: [{ mana: 45, cd: 12, dur: 3, speed: 1.6, evade: 0.8 }],
    cast(g, c) {
      g.player.windrun = c.L.dur;
      if (has(g, 'okWind')) c.cd = c.L.cd - 4;
      g.emit('windrun', {});
      return true;
    },
    hud(g, c) { return { active: g.player.windrun > 0 }; },
  },
  okcu_tango: {
    id: 'okcu_tango', hero: 'okcu', slot: 'e', icon: 'e', name: 'Tango', targeting: 'none', ownCost: true,
    desc: '3 şarj. 6 sn boyunca 150 can yeniler. Şarjlar zamanla dolar.',
    costText: '0', cdText: 'şarj',
    levels: [{ mana: 0, cd: 0.8, charges: 3, heal: 150, dur: 6, regen: 22 }],
    init(g, c) { g.player.tangoCharges = c.L.charges; g.player.tangoRegen = 0; },
    cast(g, c) {
      const p = g.player;
      if (p.tangoCharges <= 0) { g.emit('notReady', { key: 'e' }); return false; }
      p.tangoCharges -= 1;
      g.itemHeal(c.L.heal, c.L.dur, 'tango');
      g.tangosUsed += 1;
      if (p.tangoRegen <= 0) p.tangoRegen = c.L.regen;
      g.emit('tango', {});
      return true;
    },
    step(g, dt, c) {
      const p = g.player;
      if (p.tangoCharges < c.L.charges) {
        if (p.tangoRegen <= 0) p.tangoRegen = c.L.regen;
        p.tangoRegen -= dt;
        if (p.tangoRegen <= 0) {
          p.tangoCharges += 1;
          p.tangoRegen = p.tangoCharges < c.L.charges ? c.L.regen : 0;
          g.emit('tangoReady', {});
        }
      } else p.tangoRegen = 0;
    },
    hud(g, c) {
      const p = g.player;
      return { cdFrac: p.tangoCharges > 0 ? g.cds.e / c.L.cd : p.tangoRegen / c.L.regen, cdLeft: p.tangoCharges > 0 ? 0 : p.tangoRegen, active: p.heals.some((x) => x.tag === 'tango'), extra: String(p.tangoCharges), noMana: false };
    },
  },
  okcu_dog: {
    id: 'okcu_dog', hero: 'okcu', slot: 'r', icon: 'r', name: 'DOG DOG DOG', targeting: 'none', ult: true,
    desc: 'Çevredeki herkese hasar, kısa sersemletme ve korku. Roshan bile irkilir.',
    levels: [{ mana: 120, cd: 30, radius: 8, stun: 0.7, fear: 2.2 }],
    cast(g, c) {
      const p = g.player;
      const L = c.L;
      const aghs = g.stat.aghs;
      const radius = L.radius + (has(g, 'okUlt') ? 3 : 0);
      if (aghs) c.cd = 18;
      const dmg = (90 + 12 * g.wave) * g.dmgMul(true);
      let n = 0;
      g.emit('ult', { x: p.x, z: p.z, radius });
      for (const d of g.foes) {
        if (d.dead || d.spawnT > 0) continue;
        const dx = d.x - p.x;
        const dz = d.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        if (len > radius) continue;
        n += 1;
        d.windup = 0;
        if (d.type === 'afk' && d.state === 'afk') d.state = 'awake';
        if (d.type === 'smurf' && d.state !== 'go') { d.state = 'go'; d.t = 2; }
        if (d.cast) d.cast = null;
        dealDamage(g, p, d, dmg * (1 - (len / radius) * 0.35), DMG.MAG, { dirX: dx / len, dirZ: dz / len, knock: 2.2, src: 'ult' });
        if (!d.dead) {
          applyStatus(g, d, 'stun', L.stun);
          applyStatus(g, d, 'fear', L.fear + (aghs ? 1 : 0));
        }
      }
      g.emit('ultHit', { n });
      return true;
    },
  },

  // ================================================================== BALTA
  balta_call: {
    id: 'balta_call', hero: 'balta', slot: 'q', icon: 'call', name: 'Savaş Çağrısı', targeting: 'none',
    desc: 'Çevredeki düşmanları üstüne çeker ve 2,4 sn sana kilitler (kaçanlar da döner). 3,5 sn %40 hasar azaltma.',
    levels: [{ mana: 55, cd: 11, radius: 3.4, taunt: 2.4, armor: 0.4, armorDur: 3.5 }],
    cast(g, c) {
      const p = g.player;
      const L = c.L;
      const R = L.radius + (has(g, 'baCall') ? 1.2 : 0);
      let n = 0;
      for (const e of g.foes) {
        if (e.dead || e.spawnT > 0 || !inR(e, p, R + e.r)) continue;
        n += 1;
        applyStatus(g, e, 'taunt', L.taunt);
        e.tgt = p;
        e.aggroT = L.taunt;
        const dx = p.x - e.x;
        const dz = p.z - e.z;
        const len = Math.hypot(dx, dz) || 1;
        const pull = e.kind === 'boss' ? 0.4 : 2.6;
        e.kx += (dx / len) * pull;
        e.kz += (dz / len) * pull;
      }
      p.callArmor = L.armorDur;
      g.emit('fx', { kind: 'taunt', x: p.x, z: p.z, r: R, n });
      return true;
    },
    hud(g) { return { active: g.player.callArmor > 0 }; },
  },
  balta_helix: {
    id: 'balta_helix', hero: 'balta', slot: 'w', icon: 'helix', name: 'Helezon', targeting: 'none',
    desc: 'Aktif: baltayla dönüp çevreye hasar ver. Pasif: vurulunca %24 şansla kendiliğinden döner.',
    levels: [{ mana: 20, cd: 3.5, radius: 2.5, dmg: 90, proc: 0.24, icd: 0.45 }],
    spin(g, L, free) {
      const p = g.player;
      const dmg = (L.dmg + (has(g, 'baSpin') ? 60 : 0)) * g.dmgMul(true);
      p.spinT = 0.42;
      for (const e of g.foes) {
        if (e.dead || e.spawnT > 0 || !inR(e, p, L.radius + e.r)) continue;
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        dealDamage(g, p, e, dmg, DMG.PURE, { src: 'helix', dirX: dx / len, dirZ: dz / len, knock: 0.9 });
      }
      g.emit('fx', { kind: 'spin', x: p.x, z: p.z, r: L.radius, free });
    },
    cast(g, c) { this.spin(g, c.L, false); return true; },
    onHurt(g, dmg, source, c) {
      const p = g.player;
      if (p.dead || p.helixIcd > 0 || !source || typeof source !== 'object' || source.kind === 'tower') return;
      if (g.rand() < c.L.proc) { p.helixIcd = c.L.icd; this.spin(g, c.L, true); }
    },
  },
  balta_hunger: {
    id: 'balta_hunger', hero: 'balta', slot: 'e', icon: 'hunger', name: 'Savaş Açlığı', targeting: 'unit',
    desc: 'Hedefe 8 sn boyunca saniyede hasar ve %30 yavaşlatma. Hedef ölürse açlık en yakın düşmana sıçrar.',
    levels: [{ mana: 45, cd: 8, range: 6, dur: 8, dps: 26, slow: 0.3 }],
    canCast(g, c) { c.target = g.pickTarget(c.L.range); if (!c.target) g.emit('noTarget', { key: c.key }); return !!c.target; },
    apply(g, e, dur, L) {
      applyStatus(g, e, 'dot', dur, { dps: L.dps * g.dmgMul(true), src: g.player, key: 'hunger' });
      applyStatus(g, e, 'slow', dur, { k: L.slow });
      e.hunger = true;
      g.emit('fx', { kind: 'hunger', foe: e });
    },
    cast(g, c) { this.apply(g, c.target, c.L.dur, c.L); return true; },
    onKill(g, foe, c) {
      if (!foe.hunger || !(foe.st.dot > 0.5)) return;
      const next = g.nearestFoe(foe.x, foe.z, 6, foe);
      if (next) this.apply(g, next, foe.st.dot, c.L);
    },
  },
  balta_cull: {
    id: 'balta_cull', hero: 'balta', slot: 'r', icon: 'cull', name: 'Kesin Hüküm', targeting: 'unit', ult: true,
    desc: 'Canı eşiğin altındaki düşmanı tek vuruşta infaz eder ve bekleme sıfırlanır. Eşik üstündekilere yalnızca hasar.',
    levels: [{ mana: 90, cd: 24, range: 2.3, base: 200, perLevel: 24, dmg: 150 }],
    threshold(g, L) { return L.base + L.perLevel * (g.player.level - 1) + (has(g, 'baCull') ? 120 : 0); },
    canCast(g, c) {
      const range = c.L.range + (g.stat.aghs ? 1.5 : 0);
      c.target = g.pickTarget(range);
      if (!c.target) g.emit('noTarget', { key: c.key });
      return !!c.target;
    },
    cast(g, c) {
      const p = g.player;
      const e = c.target;
      const thr = this.threshold(g, c.L);
      p.face = Math.atan2(e.x - p.x, e.z - p.z);
      p.swing = 1;
      if (e.hp <= thr) {
        g.emit('fx', { kind: 'execute', x: e.x, z: e.z, foe: e });
        dealDamage(g, p, e, e.hp + 1, DMG.PURE, { src: 'execute' });
        c.cd = 0.4;
        p.cullHaste = 3;
        if (g.stat.aghs) ABILITIES.balta_helix.spin(g, ABILITIES.balta_helix.levels[0], true);
        g.emit('cull', { foe: e, kill: true });
      } else {
        dealDamage(g, p, e, c.L.dmg * g.dmgMul(true), DMG.MAG, { src: 'cull' });
        g.emit('fx', { kind: 'chop', x: e.x, z: e.z });
        g.emit('cull', { foe: e, kill: false });
      }
      return true;
    },
  },

  // ================================================================== BUZ CADISI
  buz_nova: {
    id: 'buz_nova', hero: 'buz', slot: 'q', icon: 'nova', name: 'Buz Novası', targeting: 'point',
    desc: 'Hedef noktada buz patlaması: alan hasarı ve 3 sn %40 yavaşlatma.',
    levels: [{ mana: 70, cd: 5.5, range: 7.5, radius: 2.6, dmg: 125, slow: 0.4, slowDur: 3 }],
    cast(g, c) {
      const L = c.L;
      const pt = g.aimPoint(L.range);
      const dmg = L.dmg * g.dmgMul(true);
      if (has(g, 'buNova')) c.cd = L.cd - 2;
      for (const e of g.foes) {
        if (e.dead || e.spawnT > 0 || !inR(e, pt, L.radius + e.r)) continue;
        dealDamage(g, g.player, e, dmg, DMG.MAG, { src: 'nova' });
        applyStatus(g, e, 'slow', L.slowDur, { k: L.slow });
      }
      g.player.face = Math.atan2(pt.x - g.player.x, pt.z - g.player.z);
      g.player.swing = 1;
      g.emit('fx', { kind: 'nova', x: pt.x, z: pt.z, r: L.radius });
      return true;
    },
  },
  buz_chain: {
    id: 'buz_chain', hero: 'buz', slot: 'w', icon: 'chain', name: 'Buz Zinciri', targeting: 'unit',
    desc: 'Hedefi 2,2 sn dondurur (yürüyemez, ısıramaz) ve saniyede hasar verir.',
    levels: [{ mana: 55, cd: 9, range: 6.5, dur: 2.2, dps: 34 }],
    canCast(g, c) { c.target = g.pickTarget(c.L.range); if (!c.target) g.emit('noTarget', { key: c.key }); return !!c.target; },
    cast(g, c) {
      const e = c.target;
      const dur = c.L.dur + (has(g, 'buRoot') ? 1 : 0);
      applyStatus(g, e, 'root', dur);
      applyStatus(g, e, 'dot', dur, { dps: c.L.dps * g.dmgMul(true), src: g.player, key: 'frost' });
      e.windup = 0;
      g.player.face = Math.atan2(e.x - g.player.x, e.z - g.player.z);
      g.player.swing = 1;
      g.emit('fx', { kind: 'frost', foe: e, dur });
      return true;
    },
  },
  buz_aura: {
    id: 'buz_aura', hero: 'buz', slot: 'e', icon: 'aura', name: 'Mana Aurası', targeting: 'none',
    desc: 'Pasif: +3 mana/sn. Aktif: 3 sn boyunca hızlı mana ve can akışı.',
    levels: [{ mana: 0, cd: 18, regen: 3, dur: 3, mps: 36, hps: 26 }],
    stats(g, st, c) { st.manaRegen += c.L.regen; },
    cast(g, c) { g.player.auraT = c.L.dur; g.emit('fx', { kind: 'aura', x: g.player.x, z: g.player.z }); return true; },
    step(g, dt, c) {
      const p = g.player;
      if (p.auraT > 0) {
        p.auraT -= dt;
        p.mana = Math.min(p.maxMana, p.mana + c.L.mps * dt);
        p.hp = Math.min(p.maxHp, p.hp + c.L.hps * dt);
      }
    },
    hud(g) { return { active: g.player.auraT > 0 }; },
  },
  buz_field: {
    id: 'buz_field', hero: 'buz', slot: 'r', icon: 'field', name: 'Donduran Alan', targeting: 'channel', ult: true,
    desc: 'Kanal (4,2 sn): çevrende art arda buz patlamaları, alandaki herkes yavaşlar. Yürürsen kanal kesilir.',
    levels: [{ mana: 180, cd: 32, dur: 4.2, radius: 4.8, rate: 14, blast: 1.35, dmg: 62, slow: 0.35 }],
    cast(g, c) {
      g.player.channel = { id: this.id, key: 'r', t: 0, dur: c.L.dur, acc: 0, frz: 0 };
      g.emit('channelStart', { key: 'r', dur: c.L.dur });
      return true;
    },
    step(g, dt, c) {
      const p = g.player;
      const ch = p.channel;
      if (!ch || ch.id !== this.id) return;
      const L = c.L;
      ch.t += dt;
      if (ch.t >= ch.dur || p.dead) { g.endChannel(false); return; }
      ch.acc += dt * L.rate;
      const dmg = L.dmg * g.dmgMul(true) * (has(g, 'buField') ? 1.4 : 1);
      while (ch.acc >= 1) {
        ch.acc -= 1;
        let x;
        let z;
        const near = [];
        for (const e of g.foes) if (!e.dead && e.spawnT <= 0 && inR(e, p, L.radius)) near.push(e);
        if (near.length && g.rand() < 0.55) {
          const e = near[Math.floor(g.rand() * near.length)];
          x = e.x + (g.rand() - 0.5) * 1.4;
          z = e.z + (g.rand() - 0.5) * 1.4;
        } else {
          const a = g.rand() * Math.PI * 2;
          const r = Math.sqrt(g.rand()) * L.radius;
          x = p.x + Math.sin(a) * r;
          z = p.z + Math.cos(a) * r;
        }
        for (const e of near) if (inR(e, { x, z }, L.blast + e.r)) dealDamage(g, p, e, dmg, DMG.MAG, { src: 'field', quiet: e.kind === 'creep' });
        g.emit('fx', { kind: 'iceBlast', x, z, r: L.blast });
      }
      for (const e of g.foes) if (!e.dead && inR(e, p, L.radius)) applyStatus(g, e, 'slow', 0.3, { k: L.slow });
      if (g.stat.aghs) {
        ch.frz -= dt;
        if (ch.frz <= 0) {
          ch.frz = 1.5;
          for (const e of g.foes) if (!e.dead && inR(e, p, L.radius)) applyStatus(g, e, 'root', 0.6);
        }
      }
    },
    hud(g) { return { active: !!(g.player.channel && g.player.channel.id === 'buz_field') }; },
  },

  // ================================================================== GÖLGE
  golge_step: {
    id: 'golge_step', hero: 'golge', slot: 'q', icon: 'step', name: 'Gölge Adımı', targeting: 'unit',
    desc: 'Hedefin yanına ışınlan ve anında bir saldırı yap (kritik vurabilir).',
    levels: [{ mana: 40, cd: 6, range: 7.5, extra: 60 }],
    canCast(g, c) { c.target = g.pickTarget(c.L.range); if (!c.target) g.emit('noTarget', { key: c.key }); return !!c.target; },
    cast(g, c) {
      const p = g.player;
      const e = c.target;
      const x0 = p.x;
      const z0 = p.z;
      g.blinkNextTo(e);
      if (has(g, 'goStep')) c.cd = c.L.cd - 2;
      g.emit('fx', { kind: 'blink', x0, z0, x1: p.x, z1: p.z, shadow: true });
      g.attackHit(e, { extra: c.L.extra, src: 'step' });
      return true;
    },
  },
  golge_smoke: {
    id: 'golge_smoke', hero: 'golge', slot: 'w', icon: 'smoke', name: 'Duman Perdesi', targeting: 'none', keepInvis: true,
    desc: '4 sn görünmezlik ve +%15 hız. Dumandan çıkan ilk vuruş +%80 hasar ve 0,6 sn sersemletme.',
    levels: [{ mana: 45, cd: 15, dur: 4, haste: 0.15, bonus: 0.8, stun: 0.6 }],
    cast(g, c) {
      const p = g.player;
      p.invis = Math.max(p.invis, c.L.dur);
      p.smokeT = c.L.dur;
      p.smokeBonus = true;
      g.emit('fx', { kind: 'smoke', x: p.x, z: p.z });
      g.emit('invis', { t: c.L.dur });
      return true;
    },
    hud(g) { return { active: g.player.invis > 0 }; },
  },
  golge_crit: {
    id: 'golge_crit', hero: 'golge', slot: 'e', icon: 'crit', name: 'Kan Kokusu', targeting: 'passive',
    desc: 'Pasif: saldırıların %20 şansla ×2,6 kritik vurur ve vurduğun hasarın %12’si kadar can çalarsın. Gölge Adımı ve Ölüm Dansı da faydalanır.',
    levels: [{ chance: 0.2, mul: 2.6, lifesteal: 0.12 }],
    stats(g, st, c) { st.crit += c.L.chance; st.critMul = Math.max(st.critMul, c.L.mul); st.lifesteal = (st.lifesteal || 0) + c.L.lifesteal; },
    hud() { return { passive: true }; },
  },
  golge_dance: {
    id: 'golge_dance', hero: 'golge', slot: 'r', icon: 'dance', name: 'Ölüm Dansı', targeting: 'none', ult: true,
    desc: 'Çevredeki 5 düşmana art arda sıçrayıp her birine garanti kritik vurur. Dans sırasında dokunulmazsın.',
    levels: [{ mana: 110, cd: 26, range: 7, count: 5, gap: 0.16, extra: 40 }],
    canCast(g, c) {
      const p = g.player;
      const list = g.foes.filter((e) => !e.dead && e.spawnT <= 0 && !e.demo && inR(e, p, c.L.range + e.r));
      if (!list.length) { g.emit('noTarget', { key: c.key }); return false; }
      list.sort((a, b) => ((a.x - p.x) ** 2 + (a.z - p.z) ** 2) - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2));
      c.list = list;
      return true;
    },
    cast(g, c) {
      const n = c.L.count + (has(g, 'goDance') ? 3 : 0) + (g.stat.aghs ? 3 : 0);
      g.player.dance = { list: c.list, n, i: 0, t: 0, hit: new Set() };
      g.emit('danceStart', {});
      return true;
    },
    step(g, dt, c) {
      const p = g.player;
      const D = p.dance;
      if (!D) return;
      p.invuln = Math.max(p.invuln, 0.2);
      D.t -= dt;
      if (D.t > 0) return;
      if (D.i >= D.n || p.dead) { this.finish(g); return; }
      // sıradaki hedef: listede yaşayan ilk, yoksa menzildeki en yakın
      let e = null;
      while (D.list.length && !e) {
        const x = D.list.shift();
        if (!x.dead) e = x;
      }
      if (!e) e = g.nearestFoe(p.x, p.z, c.L.range, null);
      if (!e) { this.finish(g); return; }
      const x0 = p.x;
      const z0 = p.z;
      g.blinkNextTo(e);
      g.emit('fx', { kind: 'blink', x0, z0, x1: p.x, z1: p.z, shadow: true, dance: true });
      g.attackHit(e, { extra: c.L.extra, forceCrit: true, src: 'dance' });
      D.i += 1;
      D.t = c.L.gap;
    },
    finish(g) {
      const p = g.player;
      p.dance = null;
      p.invuln = Math.max(p.invuln, 0.25);
      if (g.stat.aghs) { p.invis = Math.max(p.invis, 2); p.smokeBonus = true; }
      g.emit('danceEnd', {});
    },
  },
};

/** Yetenek düz nesnesini (tanım + seviye verisi) döndürür. */
export function abilityCtx(g, key) {
  const id = g.H.abilities[key];
  const A = ABILITIES[id];
  if (!A) return null;
  const lvl = Math.max(1, Math.min(A.levels.length, (g.player.abilityLv && g.player.abilityLv[key]) || 1));
  return { A, L: A.levels[lvl - 1], key, p: g.player, cd: null };
}

/** Okçu için geriye dönük uyumlu sabitler (eski ABIL). */
export const ABIL = {
  q: ABILITIES.okcu_shot.levels[0],
  w: ABILITIES.okcu_windrun.levels[0],
  e: ABILITIES.okcu_tango.levels[0],
  r: ABILITIES.okcu_dog.levels[0],
};
