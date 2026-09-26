// 1vDOQUZ Arena 3.0 — yetenek kayıt defteri: her yetenek veri + etki fonksiyonları.
//
// Şema (bkz. docs/oyunlar/arena.md → Mimari):
//   id, hero, slot ('q'|'w'|'e'|'r'), name, desc, icon (glyphs.js anahtarı), ult?
//   targeting: 'none' | 'point' | 'unit' | 'passive' | 'charge' | 'channel'
//   levels: [{ mana, cd, …değerler }]  Q W E: 4 seviye, R: 3 seviye (seviye 0 = öğrenilmedi)
//   show: [[etiket, alan, birim?]] → ipucu tablosu ("Hasar 90/140/190/240")
//   cast(g, c) → bool     c = { A, L, lv, key, p, cd } (c.cd değiştirilirse o bekleme uygulanır)
//   canCast?(g, c) → bool (hedef yoksa false; olayı kendisi yayar)
//   step?(g, dt, c)       her adım (kanal, dans, şarj…)
//   stats?(g, st, c)      pasif stat katkısı (recalc)
//   onLearn?(g, c)        seviye alındığında
//   onAttack?(g, target, hit, c) · onHurt?(g, dmg, source, c) · onKill?(g, foe, c) · onCast?(g, key, c)
//   hud?(g, c) → { cdFrac, cdLeft, noMana, active, charging, charge, full, extra, passive }
// Hasar hep dealDamage(); durumlar applyStatus(). Hasar değerleri g.dmgMul(true) (büyü güçlendirme) ile çarpılır.

import { DMG, applyStatus, dealDamage } from './combat.js';

const has = (g, id) => g.player.tal.has(id);
/** Yetenek varyantı (progression.js ustalık seçimi: runConfig.meta.variants[yetenekKimliği]). */
const V = (g, abilityId, variantId) => !!(g.variant && g.variant(abilityId) === variantId);
const inR = (a, b, r) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 <= r * r;
const live = (e) => !e.dead && e.spawnT <= 0 && !e.demo;

export const ABILITIES = {
  // ================================================================== OKÇU
  okcu_shot: {
    id: 'okcu_shot', hero: 'okcu', slot: 'q', icon: 'q', name: 'CureShot', targeting: 'charge',
    desc: 'Basılı tut: şarj et. Bırak: delip geçen ok. Şarj arttıkça hasar, menzil ve delme büyür; saldırı hasarın da eklenir (kritik ve can çalma işler).',
    costText: '5–24', cdText: '0,2 sn',
    levels: [
      { cd: 0.26, chargeTime: 1.2, manaMin: 5, manaMax: 18, base: 26, charge: 86 },
      { cd: 0.25, chargeTime: 1.15, manaMin: 6, manaMax: 20, base: 34, charge: 106 },
      { cd: 0.24, chargeTime: 1.1, manaMin: 7, manaMax: 22, base: 42, charge: 128 },
      { cd: 0.22, chargeTime: 1.05, manaMin: 8, manaMax: 24, base: 50, charge: 150 },
    ],
    show: [['Taban hasar', 'base'], ['Şarj hasarı', 'charge'], ['Şarj', 'chargeTime', ' sn']],
    chargeTime(g, L) {
      let t = L.chargeTime;
      if (has(g, 'okCharge')) t *= 0.7;
      if (g.hasItem('butterfly')) t *= 0.8;
      return t;
    },
    /** Yaylım Ateşi varyantı: şarj yok, dokununca üç okluk yelpaze. true: tuş basışı burada tüketildi. */
    tap(g, c) {
      if (!V(g, this.id, 'okcu_volley')) return false;
      const p = g.player;
      if (!g.canAct() || g.cds.q > 0) return true;
      if (p.st.silence > 0 || p.st.hex > 0) { g.emit('silenced', { key: 'q' }); return true; }
      const L = c.L;
      const cost = (L.manaMin + L.manaMax) / 2;
      if (p.mana < cost) { g.emit('noMana', { key: 'q' }); return true; }
      p.mana -= cost;
      let dx = p.aimX - p.x;
      let dz = p.aimZ - p.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.3) { dx = Math.sin(p.face); dz = Math.cos(p.face); } else { dx /= len; dz /= len; }
      p.face = Math.atan2(dx, dz);
      p.recoil = 1;
      const full = (L.base + L.charge + g.stat.atkDmg * 0.7) * g.dmgMul(false) * (has(g, 'okDmg') ? 1.15 : 1);
      let main = null;
      for (const sgn of [-1, 0, 1]) {
        const ang = Math.atan2(dx, dz) + sgn * 0.22;
        const a = { id: g.nextId(), x: p.x + Math.sin(ang) * 0.55, z: p.z + Math.cos(ang) * 0.55, dx: Math.sin(ang), dz: Math.cos(ang), speed: 32, range: 13, traveled: 0, dmg: full * 0.45, pierce: 0, charge: 0.55, full: false, hits: 0, kills: 0, hitSet: new Set(), alive: true, rapier: g.doubleDmg() };
        g.arrows.push(a);
        if (sgn === 0) main = a;
      }
      g.shots += 1;
      g.waveShots += 1;
      g.setCd('q', 0.5);
      g.breakInvis();
      g.emit('shoot', { arrow: main, charge: 0.55, volley: true });
      return true;
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
      if (p.st.silence > 0 || p.st.hex > 0) { g.emit('silenced', { key: 'q' }); return; }
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
      const raw = L.base + L.charge * Math.pow(ch, 1.15) + g.stat.atkDmg * (0.25 + 0.45 * ch);
      const dmg = raw * g.dmgMul(false) * (has(g, 'okDmg') ? 1.15 : 1);
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
      if (V(g, this.id, 'okcu_volley')) return { cdFrac: g.cds.q / 0.5, cdLeft: 0, noMana: p.mana < (L.manaMin + L.manaMax) / 2, extra: String(Math.round((L.manaMin + L.manaMax) / 2)) };
      return { cdFrac: g.cds.q / L.cd, cdLeft: 0, noMana: p.mana < L.manaMin, charging: p.charging, charge: p.charge, full: p.charging && p.charge >= 0.97, extra: String(Math.round(L.manaMin + (L.manaMax - L.manaMin) * (p.charging ? p.charge : 0))) };
    },
  },
  okcu_windrun: {
    id: 'okcu_windrun', hero: 'okcu', slot: 'w', icon: 'w', name: 'Rüzgâr Koşusu', targeting: 'none',
    desc: 'Kısa süre büyük hız ve %80 kaçınma. Kaçmak da bir stratejidir.',
    levels: [
      { mana: 45, cd: 14, dur: 2.5, speed: 1.5, evade: 0.8 },
      { mana: 50, cd: 13, dur: 3, speed: 1.55, evade: 0.8 },
      { mana: 55, cd: 12, dur: 3.5, speed: 1.6, evade: 0.8 },
      { mana: 60, cd: 11, dur: 4, speed: 1.65, evade: 0.8 },
    ],
    show: [['Süre', 'dur', ' sn'], ['Bekleme', 'cd', ' sn'], ['Mana', 'mana']],
    cast(g, c) {
      const p = g.player;
      const gale = V(g, this.id, 'okcu_gale');
      p.windrun = c.L.dur - (gale ? 0.5 : 0);
      p.windrunK = c.L.speed;
      p.windrunEv = gale ? 0 : c.L.evade;
      if (has(g, 'okWind')) c.cd = c.L.cd - 4;
      if (gale) {
        // Kasırga Adımı: kaçınma yok; çevreyi iter ve yavaşlatır
        for (const e of g.foes) {
          if (!live(e) || !inR(e, p, 3 + e.r)) continue;
          const dx = e.x - p.x;
          const dz = e.z - p.z;
          const len = Math.hypot(dx, dz) || 1;
          const k = e.kind === 'boss' ? 0.2 : 1;
          e.kx += (dx / len) * 7 * k;
          e.kz += (dz / len) * 7 * k;
          applyStatus(g, e, 'slow', 1, { k: 0.4 });
        }
        g.emit('fx', { kind: 'gale', x: p.x, z: p.z, r: 3 });
      }
      g.emit('windrun', {});
      return true;
    },
    hud(g) { return { active: g.player.windrun > 0 }; },
  },
  okcu_tango: {
    id: 'okcu_tango', hero: 'okcu', slot: 'e', icon: 'e', name: 'Tango', targeting: 'none', ownCost: true,
    desc: 'Şarjlı iyileşme: 6 sn boyunca can yeniler. Şarjlar zamanla dolar (Kurye Köpeği çalabilir!).',
    costText: '0', cdText: 'şarj',
    levels: [
      { mana: 0, cd: 0.8, charges: 2, heal: 110, dur: 6, regen: 26 },
      { mana: 0, cd: 0.8, charges: 3, heal: 150, dur: 6, regen: 22 },
      { mana: 0, cd: 0.8, charges: 3, heal: 190, dur: 6, regen: 18 },
      { mana: 0, cd: 0.8, charges: 4, heal: 230, dur: 6, regen: 14 },
    ],
    show: [['Şarj', 'charges'], ['İyileşme', 'heal'], ['Dolum', 'regen', ' sn']],
    onLearn(g, c) {
      const p = g.player;
      if (c.lv === 1) { p.tangoCharges = c.L.charges; p.tangoRegen = 0; } else p.tangoCharges = Math.min(c.L.charges, p.tangoCharges + 1);
    },
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
    desc: 'Çevredeki herkese büyü hasarı, kısa sersemletme ve korku. Roshan bile irkilir.',
    levels: [
      { mana: 120, cd: 34, radius: 8, dmg: 160, stun: 0.6, fear: 2 },
      { mana: 160, cd: 30, radius: 8.5, dmg: 260, stun: 0.8, fear: 2.4 },
      { mana: 200, cd: 26, radius: 9, dmg: 360, stun: 1.0, fear: 2.8 },
    ],
    show: [['Hasar', 'dmg'], ['Yarıçap', 'radius'], ['Korku', 'fear', ' sn'], ['Bekleme', 'cd', ' sn']],
    cast(g, c) {
      const p = g.player;
      const L = c.L;
      const aghs = g.stat.aghs;
      if (V(g, this.id, 'okcu_rain')) {
        // Ok Yağmuru: korku/sersemletme yok; seçilen alana 3 sn ok (toplam %140), Aghanım +1 sn
        const pt = g.aimPoint(9);
        const r = L.radius * 0.55 + (has(g, 'okUlt') ? 1.5 : 0);
        const dur = 3 + (aghs ? 1 : 0);
        const per = (L.dmg * 1.4 * g.dmgMul(true)) / 12;
        c.cd = Math.max(8, L.cd - (has(g, 'okUltCd') ? 12 : 0));
        g.addZone({ kind: 'rain', x: pt.x, z: pt.z, r, dur, every: 0.25, tick(gg, zn) {
          for (const e of gg.foes) if (live(e) && inR(e, zn, zn.r + e.r)) dealDamage(gg, gg.player, e, per, DMG.MAG, { src: 'rain', quiet: e.kind === 'creep' });
        } });
        p.face = Math.atan2(pt.x - p.x, pt.z - p.z);
        g.emit('fx', { kind: 'rainStart', x: pt.x, z: pt.z, r });
        g.emit('ultHit', { n: 1, rain: true });
        return true;
      }
      const radius = L.radius + (has(g, 'okUlt') ? 3 : 0);
      let cd = aghs ? 18 : L.cd;
      if (has(g, 'okUltCd')) cd -= 12;
      c.cd = Math.max(8, cd);
      const dmg = L.dmg * g.dmgMul(true);
      let n = 0;
      g.emit('ult', { x: p.x, z: p.z, radius });
      for (const d of g.foes) {
        if (!live(d)) continue;
        const dx = d.x - p.x;
        const dz = d.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        if (len > radius) continue;
        n += 1;
        d.windup = 0;
        if (d.type === 'afk' && d.state === 'afk') d.state = 'awake';
        if (d.type === 'smurf' && d.state !== 'go') { d.state = 'go'; d.t = 2; }
        if (d.cast && d.kind !== 'boss') d.cast = null;
        dealDamage(g, p, d, dmg * (1 - (len / radius) * 0.35), DMG.MAG, { dirX: dx / len, dirZ: dz / len, knock: 2.2, src: 'ult' });
        if (!d.dead) {
          applyStatus(g, d, 'stun', L.stun);
          applyStatus(g, d, 'fear', L.fear + (aghs ? 1 : 0), { src: p });
        }
      }
      g.emit('ultHit', { n });
      return true;
    },
  },

  // ================================================================== BALTA
  balta_call: {
    id: 'balta_call', hero: 'balta', slot: 'q', icon: 'call', name: 'Savaş Çağrısı', targeting: 'none',
    desc: 'Çevredeki düşmanları üstüne çeker ve sana kilitler (kaçanlar da döner). Kısa süre büyük zırh kazanırsın.',
    levels: [
      { mana: 55, cd: 13, radius: 3.2, taunt: 1.8, armor: 8, armorDur: 3.5 },
      { mana: 60, cd: 12, radius: 3.4, taunt: 2.1, armor: 10, armorDur: 3.5 },
      { mana: 65, cd: 11, radius: 3.6, taunt: 2.4, armor: 12, armorDur: 3.5 },
      { mana: 70, cd: 10, radius: 3.8, taunt: 2.7, armor: 14, armorDur: 3.5 },
    ],
    show: [['Yarıçap', 'radius'], ['Kilit', 'taunt', ' sn'], ['Zırh', 'armor'], ['Bekleme', 'cd', ' sn']],
    cast(g, c) {
      const p = g.player;
      const L = c.L;
      const roar = V(g, this.id, 'balta_roar');
      const R = (L.radius + (has(g, 'baCall') ? 1.2 : 0)) * (roar ? 0.7 : 1);
      let n = 0;
      for (const e of g.foes) {
        if (!live(e) || !inR(e, p, R + e.r)) continue;
        n += 1;
        if (applyStatus(g, e, 'taunt', L.taunt)) {
          e.tgt = p;
          e.aggroT = L.taunt;
        }
        const dx = p.x - e.x;
        const dz = p.z - e.z;
        const len = Math.hypot(dx, dz) || 1;
        const pull = e.kind === 'boss' ? 0.4 : 2.6;
        e.kx += (dx / len) * pull;
        e.kz += (dz / len) * pull;
      }
      p.callArmor = L.armorDur + (roar ? 1 : 0);
      p.callArmorK = L.armor * (roar ? 1.5 : 1);
      g.emit('fx', { kind: 'taunt', x: p.x, z: p.z, r: R, n });
      return true;
    },
    hud(g) { return { active: g.player.callArmor > 0 }; },
  },
  balta_helix: {
    id: 'balta_helix', hero: 'balta', slot: 'w', icon: 'helix', name: 'Helezon', targeting: 'none',
    desc: 'Aktif: baltayla dönüp çevreye saf hasar ver. Pasif: vurulunca belli bir şansla kendiliğinden döner.',
    levels: [
      { mana: 20, cd: 5, radius: 2.5, dmg: 70, proc: 0.17, icd: 0.45 },
      { mana: 25, cd: 4.5, radius: 2.5, dmg: 100, proc: 0.2, icd: 0.45 },
      { mana: 30, cd: 4, radius: 2.6, dmg: 130, proc: 0.23, icd: 0.45 },
      { mana: 35, cd: 3.5, radius: 2.7, dmg: 160, proc: 0.26, icd: 0.45 },
    ],
    show: [['Saf hasar', 'dmg'], ['Dönme şansı', 'proc', '%'], ['Bekleme', 'cd', ' sn']],
    spin(g, L, free) {
      const p = g.player;
      const dmg = (L.dmg + (has(g, 'baSpin') ? 60 : 0)) * g.dmgMul(true);
      const blood = V(g, this.id, 'balta_blood');
      p.spinT = 0.42;
      let hits = 0;
      for (const e of g.foes) {
        if (!live(e) || !inR(e, p, L.radius + e.r)) continue;
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        if (dealDamage(g, p, e, dmg, DMG.PURE, { src: 'helix', dirX: dx / len, dirZ: dz / len, knock: 0.9 }) > 0) hits += 1;
      }
      if (blood && hits) g.heal(hits * (12 + p.maxHp * 0.012));
      g.emit('fx', { kind: 'spin', x: p.x, z: p.z, r: L.radius, free, blood });
    },
    cast(g, c) {
      this.spin(g, c.L, false);
      // Kanlı Helezon: ikinci tur
      if (V(g, this.id, 'balta_blood')) g.later(0.36, () => { if (!g.player.dead) this.spin(g, c.L, true); });
      return true;
    },
    onHurt(g, dmg, source, c) {
      const p = g.player;
      if (V(g, this.id, 'balta_blood')) return;
      if (p.dead || p.helixIcd > 0 || !source || typeof source !== 'object' || source.kind === 'tower') return;
      const chance = c.L.proc + (has(g, 'baProc') ? 0.12 : 0);
      if (g.rand() < chance) { p.helixIcd = c.L.icd; this.spin(g, c.L, true); }
    },
  },
  balta_hunger: {
    id: 'balta_hunger', hero: 'balta', slot: 'e', icon: 'hunger', name: 'Savaş Açlığı', targeting: 'unit',
    desc: 'Hedefe 8 sn boyunca saniyede büyü hasarı ve yavaşlatma. Hedef ölürse açlık en yakın düşmana sıçrar.',
    levels: [
      { mana: 45, cd: 10, range: 6, dur: 8, dps: 18, slow: 0.2 },
      { mana: 50, cd: 9, range: 6, dur: 8, dps: 26, slow: 0.25 },
      { mana: 55, cd: 8, range: 6, dur: 8, dps: 34, slow: 0.3 },
      { mana: 60, cd: 7, range: 6, dur: 8, dps: 42, slow: 0.35 },
    ],
    show: [['Saniyede', 'dps'], ['Yavaşlatma', 'slow', '%'], ['Bekleme', 'cd', ' sn']],
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
    desc: 'Canı eşiğin altındaki düşmanı tek vuruşta infaz eder ve bekleme sıfırlanır. Eşik üstündekilere yalnızca büyü hasarı. Eşik kahraman seviyesiyle de büyür.',
    levels: [
      { mana: 90, cd: 24, range: 2.3, base: 220, perLevel: 14, dmg: 150 },
      { mana: 110, cd: 20, range: 2.3, base: 360, perLevel: 14, dmg: 225 },
      { mana: 130, cd: 16, range: 2.3, base: 500, perLevel: 14, dmg: 300 },
    ],
    show: [['Eşik', 'base'], ['Hasar', 'dmg'], ['Bekleme', 'cd', ' sn']],
    threshold(g, L) { return (L.base + L.perLevel * (g.player.level - 1) + (has(g, 'baCull') ? 120 : 0)) * (V(g, this.id, 'balta_mass') ? 0.75 : 1); },
    canCast(g, c) {
      if (V(g, this.id, 'balta_mass')) {
        const p = g.player;
        const R = 2.5 + (g.stat.aghs ? 1 : 0);
        c.list = g.foes.filter((e) => live(e) && e.seen !== false && inR(e, p, R + e.r));
        if (!c.list.length) g.emit('noTarget', { key: c.key });
        return c.list.length > 0;
      }
      const range = c.L.range + (g.stat.aghs ? 1.5 : 0);
      c.target = g.pickTarget(range);
      if (!c.target) g.emit('noTarget', { key: c.key });
      return !!c.target;
    },
    cast(g, c) {
      const p = g.player;
      if (c.list) {
        // Toplu Hüküm: 2,5 yarıçapta eşiğin altındakilerin hepsi; bekleme sıfırlanmaz
        const thr = this.threshold(g, c.L);
        let kills = 0;
        for (const e of c.list) {
          if (e.dead) continue;
          if (e.hp <= thr && !(e.invuln > 0)) { dealDamage(g, p, e, e.hp + (e.shield || 0) + 1, DMG.PURE, { src: 'execute' }); kills += 1; }
          else dealDamage(g, p, e, c.L.dmg * 0.6 * g.dmgMul(true), DMG.MAG, { src: 'cull' });
        }
        p.swing = 1;
        g.emit('fx', { kind: 'massCull', x: p.x, z: p.z, r: 2.5 + (g.stat.aghs ? 1 : 0), n: kills });
        if (kills) { p.cullHaste = 3; g.emit('fx', { kind: 'execute', x: p.x, z: p.z }); }
        g.emit('cull', { kill: kills > 0, mass: true, n: kills });
        return true;
      }
      const e = c.target;
      const thr = this.threshold(g, c.L);
      p.face = Math.atan2(e.x - p.x, e.z - p.z);
      p.swing = 1;
      if (e.hp <= thr && !(e.invuln > 0)) {
        g.emit('fx', { kind: 'execute', x: e.x, z: e.z, foe: e });
        dealDamage(g, p, e, e.hp + (e.shield || 0) + 1, DMG.PURE, { src: 'execute' });
        c.cd = 0.4;
        p.cullHaste = 3;
        const helix = g.H.abilities.w === 'balta_helix' && p.abilityLv.w > 0;
        if (g.stat.aghs && helix) ABILITIES.balta_helix.spin(g, ABILITIES.balta_helix.levels[p.abilityLv.w - 1], true);
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
    desc: 'Hedef noktada buz patlaması: alan büyü hasarı ve 3 sn yavaşlatma.',
    levels: [
      { mana: 70, cd: 6, range: 7.5, radius: 2.4, dmg: 100, slow: 0.3, slowDur: 3 },
      { mana: 85, cd: 5.5, range: 7.5, radius: 2.6, dmg: 150, slow: 0.35, slowDur: 3 },
      { mana: 100, cd: 5, range: 7.5, radius: 2.8, dmg: 200, slow: 0.4, slowDur: 3 },
      { mana: 115, cd: 4.5, range: 7.5, radius: 3.0, dmg: 250, slow: 0.45, slowDur: 3 },
    ],
    show: [['Hasar', 'dmg'], ['Yarıçap', 'radius'], ['Yavaşlatma', 'slow', '%'], ['Bekleme', 'cd', ' sn']],
    blast(g, pt, L, k) {
      const dmg = L.dmg * g.dmgMul(true) * k;
      for (const e of g.foes) {
        if (!live(e) || !inR(e, pt, L.radius + e.r)) continue;
        dealDamage(g, g.player, e, dmg, DMG.MAG, { src: 'nova' });
        applyStatus(g, e, 'slow', L.slowDur, { k: L.slow });
      }
      g.emit('fx', { kind: 'nova', x: pt.x, z: pt.z, r: L.radius });
    },
    shards(g, pt, L) {
      // Buz Kıymıkları: yavaşlatmaz; en yakına %160, çevredeki 4 düşmana %40
      const list = g.foes.filter((e) => live(e) && inR(e, pt, L.radius + 1 + e.r)).sort((a, b) => ((a.x - pt.x) ** 2 + (a.z - pt.z) ** 2) - ((b.x - pt.x) ** 2 + (b.z - pt.z) ** 2));
      const dmg = L.dmg * g.dmgMul(true);
      list.slice(0, 5).forEach((e, i) => dealDamage(g, g.player, e, dmg * (i === 0 ? 1.6 : 0.4), DMG.MAG, { src: 'shards' }));
      g.emit('fx', { kind: 'shards', x: pt.x, z: pt.z, r: L.radius, targets: list.slice(0, 5).map((e) => ({ x: e.x, z: e.z })) });
    },
    cast(g, c) {
      const L = c.L;
      const pt = g.aimPoint(L.range);
      if (has(g, 'buNova')) c.cd = L.cd - 2;
      if (V(g, this.id, 'buz_shards')) {
        this.shards(g, pt, L);
        if (has(g, 'buNova2')) g.later(0.6, () => this.shards(g, pt, L));
        g.player.face = Math.atan2(pt.x - g.player.x, pt.z - g.player.z);
        g.player.swing = 1;
        return true;
      }
      this.blast(g, pt, L, 1);
      if (has(g, 'buNova2')) g.later(0.6, () => this.blast(g, pt, L, 0.6));
      g.player.face = Math.atan2(pt.x - g.player.x, pt.z - g.player.z);
      g.player.swing = 1;
      return true;
    },
  },
  buz_chain: {
    id: 'buz_chain', hero: 'buz', slot: 'w', icon: 'chain', name: 'Buz Zinciri', targeting: 'unit',
    desc: 'Hedefi dondurur (yürüyemez, ısıramaz) ve saniyede büyü hasarı verir.',
    levels: [
      { mana: 55, cd: 10, range: 6.5, dur: 1.6, dps: 30 },
      { mana: 65, cd: 9, range: 6.5, dur: 2.0, dps: 40 },
      { mana: 75, cd: 8, range: 6.5, dur: 2.4, dps: 50 },
      { mana: 85, cd: 7, range: 6.5, dur: 2.8, dps: 60 },
    ],
    show: [['Süre', 'dur', ' sn'], ['Saniyede', 'dps'], ['Bekleme', 'cd', ' sn']],
    canCast(g, c) { c.target = g.pickTarget(c.L.range); if (!c.target) g.emit('noTarget', { key: c.key }); return !!c.target; },
    bind(g, e, dur, L) {
      if (applyStatus(g, e, 'root', dur)) e.rootFx = 'ice';
      applyStatus(g, e, 'dot', dur, { dps: L.dps * g.dmgMul(true), src: g.player, key: 'frost' });
      e.windup = 0;
      g.emit('fx', { kind: 'frost', foe: e, dur });
    },
    cast(g, c) {
      const e = c.target;
      const dur = c.L.dur + (has(g, 'buRoot') ? 1 : 0);
      this.bind(g, e, dur, c.L);
      if (has(g, 'buChain2')) {
        const n = g.nearestFoe(e.x, e.z, 4, e);
        if (n) this.bind(g, n, dur * 0.75, c.L);
      }
      g.player.face = Math.atan2(e.x - g.player.x, e.z - g.player.z);
      g.player.swing = 1;
      return true;
    },
  },
  buz_aura: {
    id: 'buz_aura', hero: 'buz', slot: 'e', icon: 'aura', name: 'Mana Aurası', targeting: 'none',
    desc: 'Pasif: mana yenilenmesi. Aktif: 3 sn boyunca hızlı mana ve can akışı.',
    levels: [
      { mana: 0, cd: 20, regen: 2, dur: 3, mps: 24, hps: 18 },
      { mana: 0, cd: 18, regen: 3, dur: 3, mps: 32, hps: 26 },
      { mana: 0, cd: 16, regen: 4, dur: 3, mps: 40, hps: 34 },
      { mana: 0, cd: 14, regen: 5, dur: 3, mps: 48, hps: 42 },
    ],
    show: [['Pasif mana/sn', 'regen'], ['Aktif mana/sn', 'mps'], ['Aktif can/sn', 'hps'], ['Bekleme', 'cd', ' sn']],
    stats(g, st, c) { if (!V(g, this.id, 'buz_ward')) st.manaRegen += c.L.regen; },
    cast(g, c) {
      const p = g.player;
      if (V(g, this.id, 'buz_ward')) {
        // Kış Kalkanı: 4 sn, manan kadar (%60'ı harcanır) hasar emen kalkan
        const amt = Math.round(p.mana * 0.6);
        if (amt < 20) { g.emit('noMana', { key: c.key }); return false; }
        p.mana -= amt;
        p.shield = amt;
        p.shieldT = 4;
        g.emit('fx', { kind: 'iceWard', x: p.x, z: p.z, amount: amt });
        return true;
      }
      p.auraT = c.L.dur;
      g.emit('fx', { kind: 'aura', x: p.x, z: p.z });
      return true;
    },
    step(g, dt, c) {
      const p = g.player;
      if (p.auraT > 0) {
        p.auraT -= dt;
        p.mana = Math.min(p.maxMana, p.mana + c.L.mps * dt);
        p.hp = Math.min(p.maxHp, p.hp + c.L.hps * dt);
      }
    },
    hud(g) { return { active: g.player.auraT > 0 || g.player.shieldT > 0 }; },
  },
  buz_field: {
    id: 'buz_field', hero: 'buz', slot: 'r', icon: 'field', name: 'Donduran Alan', targeting: 'channel', ult: true,
    desc: 'Kanal (4,2 sn): çevrende art arda buz patlamaları, alandaki herkes yavaşlar. Yürürsen kanal kesilir.',
    levels: [
      { mana: 180, cd: 34, dur: 4.2, radius: 4.8, rate: 14, blast: 1.35, dmg: 50, slow: 0.35 },
      { mana: 250, cd: 30, dur: 4.2, radius: 4.8, rate: 14, blast: 1.35, dmg: 80, slow: 0.35 },
      { mana: 320, cd: 26, dur: 4.2, radius: 4.8, rate: 14, blast: 1.35, dmg: 110, slow: 0.35 },
    ],
    show: [['Patlama hasarı', 'dmg'], ['Bekleme', 'cd', ' sn'], ['Mana', 'mana']],
    /** Tek buz patlaması dalgası (kanal ve Gezgin Tipi ortak). */
    blasts(g, cx, cz, R, L, n) {
      const p = g.player;
      const dmg = L.dmg * g.dmgMul(true) * (has(g, 'buField') ? 1.4 : 1);
      const center = { x: cx, z: cz };
      for (let k = 0; k < n; k++) {
        let x;
        let z;
        const near = [];
        for (const e of g.foes) if (live(e) && inR(e, center, R)) near.push(e);
        if (near.length && g.rand() < 0.55) {
          const e = near[Math.floor(g.rand() * near.length)];
          x = e.x + (g.rand() - 0.5) * 1.4;
          z = e.z + (g.rand() - 0.5) * 1.4;
        } else {
          const a = g.rand() * Math.PI * 2;
          const r = Math.sqrt(g.rand()) * R;
          x = cx + Math.sin(a) * r;
          z = cz + Math.cos(a) * r;
        }
        for (const e of near) if (inR(e, { x, z }, L.blast + e.r)) dealDamage(g, p, e, dmg, DMG.MAG, { src: 'field', quiet: e.kind === 'creep' });
        g.emit('fx', { kind: 'iceBlast', x, z, r: L.blast });
      }
      for (const e of g.foes) if (!e.dead && inR(e, center, R)) applyStatus(g, e, 'slow', 0.3, { k: L.slow });
    },
    cast(g, c) {
      if (V(g, this.id, 'buz_blizzard')) {
        // Gezgin Tipi: kanal yok, seni izleyen −%35 yarıçaplı fırtına, 6 sn
        const L = c.L;
        const R = L.radius * 0.65;
        g.addZone({ kind: 'blizzard', follow: 'hero', x: g.player.x, z: g.player.z, r: R, dur: 6, every: 1 / L.rate, frz: 0, tick: (gg, zn) => {
          this.blasts(gg, zn.x, zn.z, zn.r, L, 1);
          if (gg.stat.aghs) {
            zn.frz -= zn.every;
            if (zn.frz <= 0) { zn.frz = 1.5; for (const e of gg.foes) if (!e.dead && inR(e, zn, zn.r)) applyStatus(gg, e, 'root', 0.6); }
          }
        } });
        g.emit('fx', { kind: 'blizzardStart', x: g.player.x, z: g.player.z, r: R });
        return true;
      }
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
        for (const e of g.foes) if (live(e) && inR(e, p, L.radius)) near.push(e);
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
          for (const e of g.foes) if (!e.dead && inR(e, p, L.radius) && applyStatus(g, e, 'root', 0.6)) e.rootFx = 'ice';
        }
      }
    },
    hud(g) { return { active: !!(g.player.channel && g.player.channel.id === 'buz_field') }; },
  },

  // ================================================================== GÖLGE
  golge_step: {
    id: 'golge_step', hero: 'golge', slot: 'q', icon: 'step', name: 'Gölge Adımı', targeting: 'unit',
    desc: 'Hedefin yanına ışınlan ve anında ek hasarlı bir saldırı yap (kritik vurabilir).',
    levels: [
      { mana: 40, cd: 8, range: 7.5, extra: 40 },
      { mana: 45, cd: 7, range: 7.5, extra: 70 },
      { mana: 50, cd: 6, range: 7.5, extra: 100 },
      { mana: 55, cd: 5, range: 7.5, extra: 130 },
    ],
    show: [['Ek hasar', 'extra'], ['Bekleme', 'cd', ' sn'], ['Mana', 'mana']],
    canCast(g, c) { c.target = g.pickTarget(c.L.range * (V(g, this.id, 'golge_mark') ? 0.5 : 1)); if (!c.target) g.emit('noTarget', { key: c.key }); return !!c.target; },
    cast(g, c) {
      const p = g.player;
      const e = c.target;
      if (V(g, this.id, 'golge_mark')) {
        // Av İşareti: ışınlanmaz; 4 sn +%25 alınan hasar, bekleme −2 sn
        applyStatus(g, e, 'amp', 4, { k: 0.25, pierce: true });
        e.markT = 4;
        c.cd = c.L.cd - 2 - (has(g, 'goStep') ? 2 : 0);
        p.face = Math.atan2(e.x - p.x, e.z - p.z);
        g.emit('fx', { kind: 'mark', foe: e });
        return true;
      }
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
    desc: 'Görünmezlik ve hız. Dumandan çıkan ilk vuruş ek hasar verir ve sersemletir.',
    levels: [
      { mana: 45, cd: 16, dur: 3, haste: 0.12, bonus: 0.5, stun: 0.4 },
      { mana: 45, cd: 15, dur: 4, haste: 0.16, bonus: 0.7, stun: 0.6 },
      { mana: 45, cd: 14, dur: 5, haste: 0.2, bonus: 0.9, stun: 0.8 },
      { mana: 45, cd: 13, dur: 6, haste: 0.24, bonus: 1.1, stun: 1.0 },
    ],
    show: [['Süre', 'dur', ' sn'], ['İlk vuruş', 'bonus', '%'], ['Sersemletme', 'stun', ' sn'], ['Bekleme', 'cd', ' sn']],
    cast(g, c) {
      const p = g.player;
      if (has(g, 'goSmoke')) c.cd = c.L.cd - 6;
      if (V(g, this.id, 'golge_decoy')) {
        // Gölge İkizi: görünmezlik yerine 4 sn yem; DOG'lar ona üşüşür
        g.addZone({ kind: 'decoy', x: p.x, z: p.z, r: 7, dur: 4, every: 0.5, now: true, tick(gg, zn) {
          const left = zn.dur - zn.t;
          for (const e of gg.foes) if (live(e) && e.kind === 'dog' && inR(e, zn, zn.r)) applyStatus(gg, e, 'taunt', Math.max(0.2, left), { x: zn.x, z: zn.z });
        } });
        g.emit('fx', { kind: 'decoy', x: p.x, z: p.z });
        return true;
      }
      p.invis = Math.max(p.invis, c.L.dur);
      p.smokeT = c.L.dur;
      p.smokeK = c.L.haste;
      p.smokeBonus = { mul: 1 + c.L.bonus, stun: c.L.stun };
      g.emit('fx', { kind: 'smoke', x: p.x, z: p.z });
      g.emit('invis', { t: c.L.dur });
      return true;
    },
    hud(g) { return { active: g.player.invis > 0 }; },
  },
  golge_crit: {
    id: 'golge_crit', hero: 'golge', slot: 'e', icon: 'crit', name: 'Kan Kokusu', targeting: 'passive',
    desc: 'Pasif: saldırıların şansla kritik vurur ve vurduğun hasarın bir kısmı kadar can çalarsın. Gölge Adımı ve Ölüm Dansı da faydalanır.',
    levels: [
      { chance: 0.12, mul: 2.0, lifesteal: 0.05 },
      { chance: 0.16, mul: 2.2, lifesteal: 0.07 },
      { chance: 0.2, mul: 2.4, lifesteal: 0.09 },
      { chance: 0.24, mul: 2.6, lifesteal: 0.11 },
    ],
    show: [['Şans', 'chance', '%'], ['Kritik', 'mul', '×'], ['Can çalma', 'lifesteal', '%']],
    stats(g, st, c) {
      st.crit = 1 - (1 - st.crit) * (1 - c.L.chance);
      st.critMul = Math.max(st.critMul, c.L.mul);
      st.lifesteal = (st.lifesteal || 0) + c.L.lifesteal;
    },
    hud() { return { passive: true }; },
  },
  golge_dance: {
    id: 'golge_dance', hero: 'golge', slot: 'r', icon: 'dance', name: 'Ölüm Dansı', targeting: 'none', ult: true,
    desc: 'Çevredeki düşmanlara art arda sıçrayıp her birine garanti kritik vurur. Dans sırasında dokunulmazsın.',
    levels: [
      { mana: 110, cd: 30, range: 7, count: 4, gap: 0.16, extra: 30 },
      { mana: 140, cd: 26, range: 7, count: 6, gap: 0.15, extra: 60 },
      { mana: 170, cd: 22, range: 7, count: 8, gap: 0.14, extra: 90 },
    ],
    show: [['Sıçrama', 'count'], ['Ek hasar', 'extra'], ['Bekleme', 'cd', ' sn']],
    canCast(g, c) {
      const p = g.player;
      if (V(g, this.id, 'golge_eclipse')) {
        const any = g.foes.some((e) => live(e) && e.seen !== false && inR(e, p, 3.2 + e.r));
        if (!any) g.emit('noTarget', { key: c.key });
        return any;
      }
      const list = g.foes.filter((e) => live(e) && e.seen !== false && inR(e, p, c.L.range + e.r));
      if (!list.length) { g.emit('noTarget', { key: c.key }); return false; }
      list.sort((a, b) => ((a.x - p.x) ** 2 + (a.z - p.z) ** 2) - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2));
      c.list = list;
      return true;
    },
    cast(g, c) {
      if (V(g, this.id, 'golge_eclipse')) {
        // Tutulma: sıçrama yok, 3 sn yerinde saniyede üç kritik; dokunulmazlık yok
        g.player.eclipse = { t: 3 + (g.stat.aghs ? 1 : 0), acc: 0, L: c.L, R: 3.2 + (has(g, 'goDance') ? 0.8 : 0) };
        g.emit('fx', { kind: 'eclipse', x: g.player.x, z: g.player.z, r: g.player.eclipse.R });
        return true;
      }
      const n = c.L.count + (has(g, 'goDance') ? 3 : 0) + (g.stat.aghs ? 3 : 0);
      g.player.dance = { list: c.list, n, i: 0, t: 0, hit: new Set() };
      g.emit('danceStart', {});
      return true;
    },
    step(g, dt, c) {
      const p = g.player;
      const E = p.eclipse;
      if (E) {
        E.t -= dt;
        E.acc += dt;
        while (E.acc >= 1 / 3 && E.t > -0.01) {
          E.acc -= 1 / 3;
          const dmg = (g.stat.atkDmg + E.L.extra) * g.dmgMul(false);
          let hit = 0;
          for (const e of g.foes) {
            if (!live(e) || !inR(e, p, E.R + e.r)) continue;
            dealDamage(g, p, e, dmg, DMG.PHYS, { attack: true, forceCrit: true, src: 'eclipse', lifesteal: (g.stat.lifesteal || 0) * 0.5, trueStrike: true });
            hit += 1;
          }
          p.spinT = 0.3;
          if (hit) g.emit('fx', { kind: 'eclipseHit', x: p.x, z: p.z, r: E.R });
        }
        if (E.t <= 0 || p.dead) { p.eclipse = null; g.emit('danceEnd', {}); }
        return;
      }
      const D = p.dance;
      if (!D) return;
      p.invuln = Math.max(p.invuln, 0.2);
      D.t -= dt;
      if (D.t > 0) return;
      if (D.i >= D.n || p.dead) { this.finish(g); return; }
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
      if (g.stat.aghs) { p.invis = Math.max(p.invis, 2); p.smokeBonus = { mul: 1.5, stun: 0.5 }; }
      g.emit('danceEnd', {});
    },
  },

  // ================================================================== ŞİMŞEK RUHU
  simsek_remnant: {
    id: 'simsek_remnant', hero: 'simsek', slot: 'q', icon: 'remnant', name: 'Durgun Kalıntı', targeting: 'none',
    desc: 'Olduğun yere elektrikli bir kalıntı bırakırsın. Yarım saniye sonra kurulur; bir düşman yaklaşınca patlar ve alana büyü hasarı verir. Aynı anda en çok 3.',
    levels: [
      { mana: 60, cd: 3.5, dmg: 90, radius: 2.2, trigger: 1.4, arm: 0.5, life: 10 },
      { mana: 70, cd: 3.5, dmg: 140, radius: 2.2, trigger: 1.4, arm: 0.5, life: 10 },
      { mana: 80, cd: 3, dmg: 190, radius: 2.3, trigger: 1.5, arm: 0.5, life: 10 },
      { mana: 90, cd: 3, dmg: 240, radius: 2.4, trigger: 1.5, arm: 0.5, life: 10 },
    ],
    show: [['Hasar', 'dmg'], ['Yarıçap', 'radius'], ['Bekleme', 'cd', ' sn'], ['Mana', 'mana']],
    place(g, x, z, L, max = 3) {
      const mine = g.remnants;
      const drift = V(g, this.id, 'simsek_drift');
      if (drift) max = 1;
      while (mine.length >= max) { const old = mine.shift(); g.emit('remnantGone', { rem: old }); }
      const r = { id: g.nextId(), x, z, t: 0, life: L.life, arm: L.arm, dmg: (L.dmg + (has(g, 'siRem') ? 50 : 0)) * (drift ? 1.4 : 1), radius: L.radius, trigger: L.trigger, seek: drift };
      mine.push(r);
      g.emit('fx', { kind: 'remnant', x, z });
      return r;
    },
    cast(g, c) {
      const p = g.player;
      this.place(g, p.x, p.z, c.L);
      if (has(g, 'siRemCd')) c.cd = c.L.cd - 1.5;
      return true;
    },
  },
  simsek_vortex: {
    id: 'simsek_vortex', hero: 'simsek', slot: 'w', icon: 'vortex', name: 'Elektrik Girdabı', targeting: 'point',
    desc: 'Hedef noktada girdap açar: alandaki düşmanları merkeze çeker, köklere bağlar ve büyü hasarı verir.',
    levels: [
      { mana: 80, cd: 16, range: 6.5, radius: 2.4, root: 1.0, dmg: 40 },
      { mana: 90, cd: 14, range: 6.5, radius: 2.6, root: 1.3, dmg: 60 },
      { mana: 100, cd: 12, range: 6.5, radius: 2.8, root: 1.6, dmg: 80 },
      { mana: 110, cd: 10, range: 6.5, radius: 3.0, root: 1.9, dmg: 100 },
    ],
    show: [['Kök', 'root', ' sn'], ['Yarıçap', 'radius'], ['Hasar', 'dmg'], ['Bekleme', 'cd', ' sn']],
    cast(g, c) {
      const L = c.L;
      const p = g.player;
      const pt = g.aimPoint(L.range);
      const R = L.radius + (has(g, 'siVortexR') ? 1.5 : 0);
      const root = L.root + (has(g, 'siVortex') ? 0.6 : 0);
      const pulse = V(g, this.id, 'simsek_pulse');
      for (const e of g.foes) {
        if (!live(e) || !inR(e, pt, R + e.r)) continue;
        const dx = pt.x - e.x;
        const dz = pt.z - e.z;
        const len = Math.hypot(dx, dz) || 1;
        const k = e.kind === 'boss' ? 0.15 : 1;
        if (pulse) {
          // Girdap Darbesi: dışarı it, 1,5 sn yavaşlat; çekme ve kök yok
          e.kx -= (dx / len) * 8 * k;
          e.kz -= (dz / len) * 8 * k;
        } else {
          e.kx += (dx / len) * Math.min(len, R) * 6 * k;
          e.kz += (dz / len) * Math.min(len, R) * 6 * k;
          e.windup = 0;
        }
        dealDamage(g, p, e, L.dmg * g.dmgMul(true), DMG.MAG, { src: 'vortex' });
        if (!e.dead) {
          if (pulse) applyStatus(g, e, 'slow', 1.5, { k: 0.4 });
          else if (applyStatus(g, e, 'root', root)) e.rootFx = 'shock';
        }
      }
      p.face = Math.atan2(pt.x - p.x, pt.z - p.z);
      p.swing = 1;
      g.emit('fx', { kind: pulse ? 'pulse' : 'vortex', x: pt.x, z: pt.z, r: R });
      return true;
    },
  },
  simsek_overload: {
    id: 'simsek_overload', hero: 'simsek', slot: 'e', icon: 'overload', name: 'Aşırı Yük', targeting: 'passive',
    desc: 'Pasif: her büyünden sonra bir sonraki saldırın şarjlı olur; hedefin çevresine büyü hasarı verir ve yavaşlatır.',
    levels: [
      { dmg: 40, radius: 1.8, slow: 0.3, slowDur: 0.9 },
      { dmg: 65, radius: 1.8, slow: 0.3, slowDur: 0.9 },
      { dmg: 90, radius: 1.9, slow: 0.35, slowDur: 1.0 },
      { dmg: 115, radius: 2.0, slow: 0.4, slowDur: 1.0 },
    ],
    show: [['Hasar', 'dmg'], ['Yarıçap', 'radius'], ['Yavaşlatma', 'slow', '%']],
    onCast(g, key) { if (key !== 'e') g.player.overload = true; },
    onAttack(g, target, hit, c) {
      const p = g.player;
      if (!p.overload || !target || target.kind === 'tower') return;
      p.overload = false;
      const L = c.L;
      const R = L.radius + (has(g, 'siOver') ? 1 : 0);
      const slow = Math.min(0.8, L.slow * (has(g, 'siOver') ? 1.5 : 1));
      for (const e of g.foes) {
        if (!live(e) || !inR(e, target, R + e.r)) continue;
        dealDamage(g, p, e, L.dmg * g.dmgMul(true), DMG.MAG, { src: 'overload' });
        if (!e.dead) applyStatus(g, e, 'slow', L.slowDur, { k: slow });
      }
      g.emit('fx', { kind: 'overload', x: target.x, z: target.z, r: R });
    },
    hud(g) { return { passive: true, active: !!g.player.overload }; },
  },
  simsek_ball: {
    id: 'simsek_ball', hero: 'simsek', slot: 'r', icon: 'ball', name: 'Yıldırım Topu', targeting: 'point', ult: true, ownCost: true,
    desc: 'Yıldırım topuna dönüşüp nişan noktasına uçarsın: yol boyunca dokunulmazsın ve değdiğin düşmanlara yol uzadıkça artan büyü hasarı verirsin. Mana maliyeti mesafeyle artar.',
    costText: '40 + mesafe', cdText: '4–2,5 sn',
    levels: [
      { mana: 40, cd: 4, perUnit: 7, speed: 16, dmgBase: 30, dmgPerUnit: 8, range: 12 },
      { mana: 40, cd: 3, perUnit: 6, speed: 18, dmgBase: 40, dmgPerUnit: 12, range: 13 },
      { mana: 40, cd: 2.5, perUnit: 5, speed: 20, dmgBase: 50, dmgPerUnit: 16, range: 14 },
    ],
    show: [['Birim başı hasar', 'dmgPerUnit'], ['Birim başı mana', 'perUnit'], ['Hız', 'speed']],
    unitCost(g, L) { return L.perUnit * (has(g, 'siBall') ? 0.6 : 1); },
    canCast(g, c) {
      const p = g.player;
      const L = c.L;
      const short = V(g, this.id, 'simsek_short');
      const per = this.unitCost(g, L);
      const fixed = Math.round((L.mana + 3 * per) * (has(g, 'siBall') ? 0.8 : 1));
      if (short && p.mana < fixed) { g.emit('noMana', { key: c.key }); return false; }
      const maxD = short ? 5 : Math.max(0, (p.mana - L.mana) / per);
      if (maxD < 1.2) { g.emit('noMana', { key: c.key }); return false; }
      const pt = g.aimPoint(Math.min(L.range, maxD));
      let dx = pt.x - p.x;
      let dz = pt.z - p.z;
      let d = Math.hypot(dx, dz);
      if (d < 1.2) { dx = Math.sin(p.face) * 4; dz = Math.cos(p.face) * 4; d = 4; if (d > maxD) { dx *= maxD / d; dz *= maxD / d; d = maxD; } }
      let tx = p.x + dx;
      let tz = p.z + dz;
      const r = Math.hypot(tx, tz);
      const lim = g.PLAY_R - 0.5;
      if (r > lim) { tx *= lim / r; tz *= lim / r; d = Math.hypot(tx - p.x, tz - p.z); }
      c.tx = tx;
      c.tz = tz;
      c.dist = d;
      c.cost = short ? fixed : L.mana + per * d;
      c.short = short;
      return true;
    },
    cast(g, c) {
      const p = g.player;
      const L = c.L;
      p.mana -= c.cost;
      p.ball = { x0: p.x, z0: p.z, tx: c.tx, tz: c.tz, dist: c.dist, t: 0, traveled: 0, hit: new Set(), L, remAcc: 0, short: !!c.short };
      p.invuln = Math.max(p.invuln, c.dist / L.speed + 0.1);
      if (p.charging) g.chargeCancel();
      g.emit('fx', { kind: 'ballStart', x: p.x, z: p.z });
      return true;
    },
    step(g, dt, c) {
      const p = g.player;
      const B = p.ball;
      if (!B) return;
      const L = B.L;
      const step = Math.min(L.speed * dt, B.dist - B.traveled);
      const ux = (B.tx - B.x0) / (B.dist || 1);
      const uz = (B.tz - B.z0) / (B.dist || 1);
      p.x += ux * step;
      p.z += uz * step;
      p.vx = 0;
      p.vz = 0;
      p.face = Math.atan2(ux, uz);
      B.traveled += step;
      p.invuln = Math.max(p.invuln, 0.08);
      for (const e of g.foes) {
        if (!live(e) || B.hit.has(e.id) || !inR(e, p, 1.1 + e.r)) continue;
        B.hit.add(e.id);
        const dmg = (L.dmgBase + L.dmgPerUnit * B.traveled) * g.dmgMul(true);
        dealDamage(g, p, e, dmg, DMG.MAG, { src: 'ball' });
      }
      if (g.stat.aghs) {
        B.remAcc += step;
        if (B.remAcc >= 3 && p.abilityLv.q > 0) {
          B.remAcc = 0;
          const Q = ABILITIES.simsek_remnant;
          Q.place(g, p.x, p.z, Q.levels[p.abilityLv.q - 1], 6);
        }
      }
      if (B.traveled >= B.dist - 1e-3 || p.dead) {
        if (B.short) p.overload = true; // Kısa Devre: varışta Aşırı Yük hazır
        p.ball = null;
        p.invuln = Math.min(p.invuln, 0.15);
        g.emit('fx', { kind: 'ballEnd', x: p.x, z: p.z });
      }
      void c;
    },
    hud(g) { return { active: !!g.player.ball, extra: '' }; },
  },

  // ================================================================== AĞAÇ BEKÇİSİ
  agac_guise: {
    id: 'agac_guise', hero: 'agac', slot: 'q', icon: 'guise', name: 'Doğanın Örtüsü', targeting: 'none', keepInvis: true,
    desc: 'Yapraklara bürünürsün: görünmezlik, hız ve saniyede iyileşme. Örtüden çıkan ilk vuruş ek hasar verir ve hedefi köklere bağlar.',
    levels: [
      { mana: 60, cd: 16, dur: 4, heal: 10, haste: 0.1, root: 0.8, bonus: 40 },
      { mana: 60, cd: 15, dur: 5, heal: 16, haste: 0.15, root: 1.1, bonus: 60 },
      { mana: 60, cd: 14, dur: 6, heal: 22, haste: 0.2, root: 1.4, bonus: 80 },
      { mana: 60, cd: 13, dur: 7, heal: 28, haste: 0.25, root: 1.7, bonus: 100 },
    ],
    show: [['Süre', 'dur', ' sn'], ['Can/sn', 'heal'], ['Kök', 'root', ' sn'], ['Bekleme', 'cd', ' sn']],
    cast(g, c) {
      const p = g.player;
      const L = c.L;
      if (V(g, this.id, 'agac_bloom')) {
        // Çiçek Açan Örtü: görünmezlik yok; 5 sn seni izleyen %30 yavaşlatan alan, iyileşme ×2
        const heal = L.heal * 2;
        g.addZone({ kind: 'bloom', follow: 'hero', x: p.x, z: p.z, r: 3.5, dur: 5, every: 0.25, tick(gg, zn) {
          gg.heal(heal * zn.every, { quiet: true });
          for (const e of gg.foes) if (live(e) && inR(e, zn, zn.r + e.r)) applyStatus(gg, e, 'slow', 0.4, { k: 0.3 });
        } });
        g.emit('fx', { kind: 'bloom', x: p.x, z: p.z, r: 3.5 });
        return true;
      }
      p.invis = Math.max(p.invis, L.dur);
      p.guiseT = L.dur;
      p.guiseK = L.haste + (has(g, 'agGuise') ? 0.2 : 0);
      p.guiseHeal = L.heal;
      p.guiseBonus = { dmg: L.bonus, root: L.root };
      p.guiseAg = 0.6;
      g.emit('fx', { kind: 'guise', x: p.x, z: p.z });
      g.emit('invis', { t: L.dur });
      return true;
    },
    step(g, dt) {
      const p = g.player;
      if (!(p.guiseT > 0)) return;
      p.guiseT -= dt;
      if (p.invis <= 0) { p.guiseT = 0; return; }
      p.hp = Math.min(p.maxHp, p.hp + p.guiseHeal * dt);
      if (g.stat.aghs && p.abilityLv.w > 0) {
        p.guiseAg -= dt;
        if (p.guiseAg <= 0) {
          p.guiseAg = 2.5;
          const e = g.nearestFoe(p.x, p.z, 5, null);
          const W = ABILITIES.agac_leech;
          if (e) W.bind(g, e, W.levels[p.abilityLv.w - 1]);
        }
      }
    },
    hud(g) { return { active: g.player.guiseT > 0 && g.player.invis > 0 }; },
  },
  agac_leech: {
    id: 'agac_leech', hero: 'agac', slot: 'w', icon: 'leech', name: 'Sömürücü Kökler', targeting: 'unit',
    desc: 'Hedefi köklere bağlar ve saniyede büyü hasarı verir; verilen hasarın tamamı sana can olarak döner.',
    levels: [
      { mana: 90, cd: 12, range: 5.5, root: 1.4, dps: 30 },
      { mana: 100, cd: 11, range: 5.5, root: 1.7, dps: 45 },
      { mana: 110, cd: 10, range: 5.5, root: 2.0, dps: 60 },
      { mana: 120, cd: 9, range: 5.5, root: 2.3, dps: 75 },
    ],
    show: [['Kök', 'root', ' sn'], ['Saniyede', 'dps'], ['Bekleme', 'cd', ' sn'], ['Mana', 'mana']],
    canCast(g, c) { c.target = g.pickTarget(c.L.range); if (!c.target) g.emit('noTarget', { key: c.key }); return !!c.target; },
    bind(g, e, L, thorns = false) {
      const dur = L.root + (has(g, 'agLeech') ? 1 : 0);
      if (applyStatus(g, e, 'root', dur)) e.rootFx = 'vine';
      applyStatus(g, e, 'dot', dur, { dps: L.dps * g.dmgMul(true) * (thorns ? 0.7 : 1), src: g.player, key: 'leech', lifesteal: thorns ? 0 : 1 });
      e.windup = 0;
      g.emit('fx', { kind: 'leech', foe: e, dur, thorns });
    },
    cast(g, c) {
      const p = g.player;
      if (V(g, this.id, 'agac_thorns')) {
        // Dikenli Kökler: can emmez; hedefin 2 birim çevresi de köklenir, hasar −%30
        const t = c.target;
        for (const e of g.foes) if (live(e) && (e === t || inR(e, t, 2 + e.r))) this.bind(g, e, c.L, true);
        p.face = Math.atan2(t.x - p.x, t.z - p.z);
        p.swing = 1;
        return true;
      }
      this.bind(g, c.target, c.L);
      p.face = Math.atan2(c.target.x - p.x, c.target.z - p.z);
      p.swing = 1;
      return true;
    },
  },
  agac_armor: {
    id: 'agac_armor', hero: 'agac', slot: 'e', icon: 'bark', name: 'Canlı Zırh', targeting: 'none',
    desc: 'Kabuğunu zırha çevirirsin: zırh, can yenilenmesi ve saldırılara karşı hasar bloğu. Yakındaki Radiant kulesi de faydalanır.',
    levels: [
      { mana: 50, cd: 16, dur: 12, armor: 4, regen: 6, block: 15 },
      { mana: 50, cd: 14, dur: 12, armor: 6, regen: 10, block: 20 },
      { mana: 50, cd: 12, dur: 12, armor: 8, regen: 14, block: 25 },
      { mana: 50, cd: 10, dur: 12, armor: 10, regen: 18, block: 30 },
    ],
    show: [['Zırh', 'armor'], ['Can/sn', 'regen'], ['Blok', 'block'], ['Bekleme', 'cd', ' sn']],
    cast(g, c) {
      const p = g.player;
      const L = c.L;
      const armor = L.armor + (has(g, 'agArmor') ? 6 : 0);
      p.barkT = L.dur;
      p.barkArmor = armor;
      p.barkRegen = L.regen;
      p.barkBlock = L.block;
      for (const t of g.towers) {
        if (t.dead || t.side !== 'radiant' || !inR(t, p, 7)) continue;
        t.barkT = L.dur;
        t.armorBuff = armor;
        t.barkRegen = L.regen * 3;
        g.emit('fx', { kind: 'bark', x: t.x, z: t.z, tower: true });
      }
      g.emit('fx', { kind: 'bark', x: p.x, z: p.z });
      return true;
    },
    hud(g) { return { active: g.player.barkT > 0 }; },
  },
  agac_growth: {
    id: 'agac_growth', hero: 'agac', slot: 'r', icon: 'growth', name: 'Aşırı Büyüme', targeting: 'none', ult: true,
    desc: 'Ormanı çağırırsın: çevredeki tüm düşmanlar köklere dolanır ve kök süresince büyü hasarı alır.',
    levels: [
      { mana: 150, cd: 40, radius: 6, root: 2.2, dps: 25 },
      { mana: 175, cd: 34, radius: 7, root: 2.8, dps: 40 },
      { mana: 200, cd: 28, radius: 8, root: 3.4, dps: 55 },
    ],
    show: [['Yarıçap', 'radius'], ['Kök', 'root', ' sn'], ['Saniyede', 'dps'], ['Bekleme', 'cd', ' sn']],
    cast(g, c) {
      const p = g.player;
      const L = c.L;
      const R = L.radius + (has(g, 'agGrowthR') ? 2 : 0);
      if (V(g, this.id, 'agac_grove')) {
        // Kutsal Koru: kök yok; 6 sn içinde durana %3/sn can, düşmanlara %40 yavaşlatma
        const r = R * 0.7;
        g.addZone({ kind: 'grove', x: p.x, z: p.z, r, dur: 6 + (g.stat.aghs ? 2 : 0), every: 0.25, tick(gg, zn) {
          const hp = gg.player;
          if (inR(hp, zn, zn.r)) gg.heal(hp.maxHp * 0.03 * zn.every, { quiet: true });
          for (const e of gg.foes) if (live(e) && inR(e, zn, zn.r + e.r)) applyStatus(gg, e, 'slow', 0.4, { k: 0.4 });
        } });
        g.emit('fx', { kind: 'grove', x: p.x, z: p.z, r });
        g.emit('ultHit', { n: 1, grove: true });
        return true;
      }
      const dps = L.dps * (has(g, 'agGrowthDmg') ? 2 : 1) * g.dmgMul(true);
      let n = 0;
      for (const e of g.foes) {
        if (!live(e) || !inR(e, p, R + e.r)) continue;
        if (applyStatus(g, e, 'root', L.root)) {
          e.rootFx = 'vine';
          applyStatus(g, e, 'dot', L.root, { dps, src: p, key: 'growth' });
          e.windup = 0;
          n += 1;
        }
      }
      g.emit('fx', { kind: 'growth', x: p.x, z: p.z, r: R, n });
      g.emit('ultHit', { n, growth: true });
      return true;
    },
  },
};

/**
 * Yetenek varyantları (Aghanım Kütüphanesi / ustalık, progression.js VARIANTS ile aynı kimlikler).
 * targeting: varyant yeteneğin hedefleme biçimini değiştiriyorsa.
 */
export const VARIANT_INFO = {
  okcu_volley: { name: 'Yaylım Ateşi', desc: 'Şarj yok: dokununca üç okluk yelpaze. Ok başına %45 hasar, delip geçmez.' },
  okcu_gale: { name: 'Kasırga Adımı', desc: 'Kaçınma vermez; başlarken 3 birimdeki düşmanları iter ve 1 sn yavaşlatır. Süre −0,5 sn.' },
  okcu_rain: { name: 'Ok Yağmuru', desc: 'Korkutmaz, sersemletmez: seçtiğin alana 3 sn ok yağdırır (toplam %140). Aghanım +1 sn.', targeting: 'point' },
  balta_roar: { name: 'Meydan Okuma', desc: 'Yarıçap %30 küçük; zırh bonusu ×1,5 ve süre +1 sn.' },
  balta_blood: { name: 'Kanlı Helezon', desc: 'Vurulunca dönmez; aktif iki tur döner ve isabet başına can yeniler.' },
  balta_mass: { name: 'Toplu Hüküm', desc: '2,5 yarıçapta eşiğin altındaki herkesi infaz eder; eşik %25 düşük, bekleme sıfırlanmaz.', targeting: 'none' },
  buz_shards: { name: 'Buz Kıymıkları', desc: 'Yavaşlatmaz; en yakın hedefe %160, çevredeki dört düşmana %40.' },
  buz_ward: { name: 'Kış Kalkanı', desc: 'Pasif mana yok; aktif: 4 sn manan kadar (%60’ı harcanır) hasar emen kalkan.' },
  buz_blizzard: { name: 'Gezgin Tipi', desc: 'Kanal yok: seni izleyen −%35 yarıçaplı fırtına, 6 sn.', targeting: 'none' },
  golge_mark: { name: 'Av İşareti', desc: 'Işınlanmaz; hedefi 4 sn işaretler (+%25 alınan hasar). Menzil ½, bekleme −2 sn.' },
  golge_decoy: { name: 'Gölge İkizi', desc: 'Görünmezlik yerine 4 sn yem ikiz; DOG’lar ona üşüşür. İlk vuruş bonusu yok.' },
  golge_eclipse: { name: 'Tutulma', desc: 'Sıçramaz: 3 sn yerinde döner, çevredeki herkese saniyede üç kritik. Dokunulmaz değilsin.' },
  simsek_drift: { name: 'Gezgin Kalıntı', desc: 'Kalıntı en yakın düşmana süzülüp çarpar. Tek kalıntı ama hasar +%40.' },
  simsek_pulse: { name: 'Girdap Darbesi', desc: 'Çekmez, köklemez: düşmanları dışarı iter ve 1,5 sn yavaşlatır.' },
  simsek_short: { name: 'Kısa Devre', desc: 'En çok 5 birim, sabit mana; varınca Aşırı Yük hazır.' },
  agac_bloom: { name: 'Çiçek Açan Örtü', desc: 'Görünmezlik yok: 5 sn çevrendekileri %30 yavaşlatan çiçek alanı, iyileşme ×2.' },
  agac_thorns: { name: 'Dikenli Kökler', desc: 'Can emmez; hedefin 2 birim çevresi de köklenir. Hasar −%30.' },
  agac_grove: { name: 'Kutsal Koru', desc: 'Köklemez: 6 sn içinde durana %3/sn can, düşmanlara %40 yavaşlatma.', targeting: 'none' },
};
/** Arayüz: tuşun görünen adı/açıklaması (varyant etkinse onunki). */
export function abilityDisplay(g, key) {
  const A = ABILITIES[g.H.abilities[key]];
  if (!A) return null;
  const vid = g.variant ? g.variant(A.id) : null;
  const VI = vid && VARIANT_INFO[vid];
  return { A, name: VI ? VI.name : A.name, desc: VI ? VI.desc : A.desc, variant: VI ? vid : null };
}
/** Etkin hedefleme biçimi (varyant değiştirebilir). */
export function targetingOf(g, key) {
  const A = ABILITIES[g.H.abilities[key]];
  if (!A) return 'none';
  const vid = g.variant ? g.variant(A.id) : null;
  return (vid && VARIANT_INFO[vid] && VARIANT_INFO[vid].targeting) || A.targeting;
}

/** Özellik bonusu (Dota'daki gibi): yetenekler dolunca kalan puanlar +2 güç/çeviklik/zekâ verir. */
export const STATS_BONUS = { id: 'stats', name: 'Özellik Bonusu', desc: 'Her seviyede +2 güç, +2 çeviklik, +2 zekâ.', per: 2 };

/** Yetenek düz nesnesini (tanım + seviye verisi) döndürür; öğrenilmemişse null. */
export function abilityCtx(g, key) {
  const id = g.H.abilities[key];
  const A = ABILITIES[id];
  if (!A) return null;
  const lv = Math.min(A.levels.length, (g.player.abilityLv && g.player.abilityLv[key]) || 0);
  if (lv <= 0) return null;
  return { A, L: A.levels[lv - 1], lv, key, p: g.player, cd: null };
}

/** Arayüz için: öğrenilmemiş olsa da tanım + görünen seviye (en az 1. seviye verisi). */
export function abilityInfo(g, key) {
  const A = ABILITIES[g.H.abilities[key]];
  if (!A) return null;
  const lv = Math.min(A.levels.length, (g.player.abilityLv && g.player.abilityLv[key]) || 0);
  return { A, lv, L: A.levels[Math.max(0, lv - 1)], max: A.levels.length };
}

/** "90/140/190/240" gibi seviye dizisi metni. */
export function levelValues(A, field, unit = '') {
  const fmt = (v) => {
    if (unit === '%') return `%${Math.round(v * 100)}`;
    const s = Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace('.', ',');
    return unit === '×' ? `×${s}` : s + (unit || '');
  };
  const vals = A.levels.map((L) => L[field]);
  if (vals.every((v) => v === vals[0])) return fmt(vals[0]);
  return vals.map(fmt).join('/');
}

/** Okçu için geriye dönük uyumlu sabitler (eski ABIL). */
export const ABIL = {
  q: ABILITIES.okcu_shot.levels[0],
  w: ABILITIES.okcu_windrun.levels[0],
  e: ABILITIES.okcu_tango.levels[0],
  r: ABILITIES.okcu_dog.levels[0],
};
