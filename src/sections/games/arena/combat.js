// 1vDOQUZ Arena 3.0 — savaş çekirdeği: TEK hasar giriş noktası (dealDamage) ve durum (status) sistemi.
//
// Hasar hattı (sırasıyla, bkz. docs/oyunlar/arena.md → Savaş):
//   tür (fiziksel / büyü / saf) → büyü bağışıklığı (yalnız büyü hasarını keser) → kaçınma (yalnız saldırılar)
//   → kritik (saldırılar) → zırh çarpanı 1 − 0,06·z / (1 + 0,06·|z|) (negatif zırh hasarı artırır) ya da büyü direnci
//   → alınan hasar artışı (amp) → hasar bloğu (yalnız fiziksel saldırılar) → kalkanlar (büyü kalkanı, genel kalkan)
//   → uygulama (g.hurtHero / g.hurtFoe / g.hurtTower) → can çalma (saldırı) / büyü can çalma (yetenek) → sayı.
// Durumlar birim.st üzerinde sayısal süreler olarak tutulur (hızlı, bellek dostu). Olumsuz durumlar statü direnciyle
// kısalır; büyü bağışıklığı (BKB) çoğu kontrol etkisini ve büyü hasarını engeller; dispel olumsuzları temizler.

/** Hasar türleri. */
export const DMG = { PHYS: 'physical', MAG: 'magical', PURE: 'pure' };

/** Olumsuz durumlar (statü direnci kısaltır, dispel temizler, büyü bağışıklığı engeller). */
const NEG = new Set(['stun', 'root', 'slow', 'silence', 'fear', 'hex', 'taunt', 'disarm', 'dot', 'amp', 'shred']);
/** Güçlü dispel gerektirenler (temel dispel sersemletmeyi kaldırmaz — Dota'daki gibi). */
const STRONG_ONLY = new Set(['stun']);
/** Sert kontrol: boss'larda ccCap ile sınırlanır. */
const HARD = new Set(['stun', 'root', 'fear', 'taunt', 'hex']);
const NUM_KEYS = ['stun', 'root', 'fear', 'silence', 'hex', 'taunt', 'disarm', 'slow', 'dot', 'amp', 'shred'];

/** Durum etiketleri (arayüz/erişilebilirlik). */
export const STATUS_NAMES = {
  stun: 'Sersemletme', root: 'Kök', slow: 'Yavaşlatma', silence: 'Susturma', fear: 'Korku', hex: 'Dönüşüm',
  taunt: 'Kışkırtma', disarm: 'Silahsız', dot: 'Zamanla hasar', amp: 'Alınan hasar artışı', shred: 'Zırh kırma',
};

/** Yeni durum kaydı. */
export function newStatus() {
  return {
    stun: 0, root: 0, fear: 0, silence: 0, hex: 0, taunt: 0, disarm: 0,
    slow: 0, slowK: 0, dot: 0, dotDps: 0, dotAcc: 0, dotSrc: null, dotKey: '', dotType: 'magical', dotLs: 0,
    amp: 0, ampK: 0, shred: 0, shredK: 0, fearX: 0, fearZ: 0,
  };
}

/** Dota zırh formülü: fiziksel hasar çarpanı (negatif zırh > 1). */
export const armorFactor = (armor) => 1 - (0.06 * armor) / (1 + 0.06 * Math.abs(armor));
/** Etkin can çarpanı gösterimi için: zırhın azalttığı yüzde (negatifse artış). */
export const armorReduction = (armor) => 1 - armorFactor(armor);

// ------------------------------------------------------------------ birim savunma değerleri
const isHero = (g, u) => u === g.player;

/** Etkin zırh (taban + buff − zırh kırma). */
export function armorOf(g, u) {
  let a;
  if (isHero(g, u)) a = (g.stat.armor || 0) + (u.bonusArmor || 0);
  else a = (u.armor || 0) + (u.armorBuff || 0);
  if (u.st && u.st.shred > 0) a -= u.st.shredK;
  return a;
}
/** Büyü direnci 0..1 (kahraman tabanı %25; eşyalar çarpımsal yığılır). */
export function mrOf(g, u) {
  if (isHero(g, u)) return g.stat.magicResist || 0;
  return u.magicResist || 0;
}
export function evasionOf(g, u) {
  if (isHero(g, u)) {
    const p = u;
    let ev = g.stat.evasion || 0;
    if (p.evadeBuff > 0) ev = 1 - (1 - ev) * (1 - p.evadeBuff);
    return ev;
  }
  return u.evasion || 0;
}
export function statusResOf(g, u) {
  if (isHero(g, u)) return g.stat.statusRes || 0;
  return u.statusRes || 0;
}
/** Büyü bağışıklığı (BKB) ya da dokunulmazlık. */
export function isImmune(g, u) {
  if (isHero(g, u)) return u.bkb > 0 || u.invuln > 0;
  return u.spellImmune > 0 || u.invuln > 0;
}
function critOf(g, src) {
  if (!src || typeof src !== 'object') return null;
  if (src === g.player) return { chance: g.stat.crit || 0, mul: g.stat.critMul || 2 };
  if (src.crit) return { chance: src.crit, mul: src.critMul || 1.8 };
  return null;
}
/** Hasar bloğu (yalnız fiziksel saldırılar): { chance, amount } */
function blockOf(g, u, src) {
  if (isHero(g, u)) {
    const s = g.stat;
    let amt = 0;
    if (s.blockChance > 0 && g.rand() < s.blockChance) amt += s.block || 0;
    if (u.blockBuff > 0) amt += u.blockBuff;
    return amt;
  }
  if (u.block > 0 && g.rand() < (u.blockChance ?? 1)) return u.block;
  void src;
  return 0;
}

/** Kalkanlar: önce büyü kalkanı (yalnız büyü), sonra genel kalkan. Kalan hasarı döndürür. */
function absorb(u, a, type) {
  if (type === DMG.MAG && u.magShield > 0) {
    const k = Math.min(u.magShield, a);
    u.magShield -= k;
    a -= k;
  }
  if (a > 0 && u.shield > 0) {
    const k = Math.min(u.shield, a);
    u.shield -= k;
    a -= k;
  }
  return a;
}

// ------------------------------------------------------------------ durumlar
/**
 * Hedefe durum uygula. kind: 'stun'|'root'|'slow'|'silence'|'fear'|'hex'|'taunt'|'disarm'|'dot'|'amp'|'shred'|<özel>
 * data: slow → { k: 0..1 } · dot → { dps, src, key, type } · amp → { k } · shred → { k: zırh } ·
 *       fear → { x, z } (kaçılacak nokta) · pierce: bağışıklığı deler · noResist: statü direnci uygulanmaz
 * Dönen: uygulandıysa true.
 */
export function applyStatus(g, target, kind, dur, data = {}) {
  if (!target || target.dead || !(dur > 0)) return false;
  const st = target.st || (target.st = newStatus());
  const neg = NEG.has(kind);
  if (neg && !data.pierce && isImmune(g, target) && !(kind === 'dot' && data.type === DMG.PURE)) {
    if (isHero(g, target)) g.emit('immune', { kind });
    else if (target.spellImmune > 0 || target.invuln > 0) g.emit('immuneFoe', { foe: target, kind });
    return false;
  }
  if (neg && !data.noResist) {
    const sr = statusResOf(g, target);
    if (sr > 0) dur *= 1 - Math.min(0.8, sr);
  }
  if (target.ccCap && HARD.has(kind)) dur = Math.min(dur, target.ccCap);
  if (!(dur > 0)) return false;
  switch (kind) {
    case 'slow': {
      const k = Math.min(0.9, data.k ?? 0.3);
      if (st.slow <= 0 || k >= st.slowK) st.slowK = k;
      st.slow = Math.max(st.slow, dur);
      break;
    }
    case 'dot':
      if (st.dot <= 0 || (data.dps || 0) >= st.dotDps) {
        st.dotDps = data.dps || 0;
        st.dotSrc = data.src || null;
        st.dotKey = data.key || '';
        st.dotType = data.type || DMG.MAG;
        st.dotLs = data.lifesteal || 0;
      }
      st.dot = Math.max(st.dot, dur);
      break;
    case 'amp':
      st.amp = Math.max(st.amp, dur);
      st.ampK = Math.max(st.amp > dur ? st.ampK : 0, data.k || 0.2);
      break;
    case 'shred':
      st.shred = Math.max(st.shred, dur);
      st.shredK = Math.max(st.shredK, data.k || 3);
      break;
    case 'fear':
      st.fear = Math.max(st.fear, dur);
      st.fearX = data.x ?? (data.src ? data.src.x : 0);
      st.fearZ = data.z ?? (data.src ? data.src.z : 0);
      break;
    default:
      st[kind] = Math.max(st[kind] || 0, dur);
  }
  if (neg) target.lastDebuff = g.time;
  if (kind === 'hex' || kind === 'silence' || kind === 'stun' || kind === 'fear' || kind === 'root') {
    g.emit('status', { target, kind, dur, hero: isHero(g, target) });
  }
  return true;
}

export const hasStatus = (u, kind) => !!(u && u.st && u.st[kind] > 0);
/** Hareket edemez (sersem, kök). */
export const cantMove = (u) => !!(u.st && (u.st.stun > 0 || u.st.root > 0));
/** Saldıramaz (sersem, dönüşüm, silahsız, korku). */
export const cantAttack = (u) => !!(u.st && (u.st.stun > 0 || u.st.hex > 0 || u.st.disarm > 0 || u.st.fear > 0));
/** Yetenek kullanamaz (sersem, dönüşüm, susturma). */
export const cantCast = (u) => !!(u.st && (u.st.stun > 0 || u.st.hex > 0 || u.st.silence > 0));

/**
 * Dispel. negative: olumsuzları temizle (temel dispel sersemletmeyi kaldırmaz; strong: true kaldırır).
 * positive: olumlu buff alanlarını temizle (düşman buff'ları: armorBuff, warCry, shield, spellImmune).
 */
export function dispel(g, target, { strong = false, negative = true, positive = false } = {}) {
  if (!target || !target.st) return 0;
  const st = target.st;
  let n = 0;
  if (negative) {
    for (const k of NUM_KEYS) {
      if (!(st[k] > 0)) continue;
      if (STRONG_ONLY.has(k) && !strong) continue;
      st[k] = 0;
      n += 1;
    }
    st.slowK = 0;
    st.dotDps = 0;
    st.dotAcc = 0;
    st.ampK = 0;
    st.shredK = 0;
  }
  if (positive) {
    if (target.warCry > 0) { target.warCry = 0; n += 1; }
    if (target.armorBuff) { target.armorBuff = 0; n += 1; }
    if (target.spellImmune > 0) { target.spellImmune = 0; n += 1; }
    if (target.shield > 0 && !target.shieldLocked) { target.shield = 0; n += 1; }
  }
  if (n) g.emit('dispel', { target, n, hero: isHero(g, target), positive });
  return n;
}

/** Durum sürelerini ilerletir; DoT hasarını dealDamage üzerinden verir. */
export function tickStatus(g, u, dt) {
  const st = u.st;
  if (!st) return;
  for (let i = 0; i < NUM_KEYS.length; i++) {
    const k = NUM_KEYS[i];
    if (st[k] > 0) st[k] = Math.max(0, st[k] - dt);
  }
  if (st.slow <= 0) st.slowK = 0;
  if (st.amp <= 0) st.ampK = 0;
  if (st.shred <= 0) st.shredK = 0;
  if (st.dotDps > 0) {
    if (st.dot <= 0) { st.dotDps = 0; st.dotAcc = 0; return; }
    st.dotAcc += st.dotDps * dt;
    if (st.dotAcc >= 8 || (st.dot <= dt && st.dotAcc >= 1)) {
      const n = Math.floor(st.dotAcc);
      st.dotAcc -= n;
      const o = { src: st.dotKey || 'dot', quiet: true, dot: true };
      if (st.dotLs > 0) o.spellLifesteal = st.dotLs;
      dealDamage(g, st.dotSrc || 'dot', u, n, st.dotType || DMG.MAG, o);
    }
  }
}

/** Hareket hızı çarpanı (yavaşlatma, dönüşüm). 1 = normal. */
export function slowMul(u) {
  if (!u.st) return 1;
  let k = u.st.slow > 0 ? 1 - u.st.slowK : 1;
  if (u.st.hex > 0) k = Math.min(k, 0.55);
  return k;
}

// ------------------------------------------------------------------ hasar
/** Kim kime vurabilir (kule kuralları, dokunulmazlık). */
function canHit(g, source, target, type, opts) {
  if (target.invuln > 0 && !opts.pierceInvuln) return false;
  if (target.kind === 'tower') {
    const fromHero = source === g.player;
    if (target.side === 'radiant') {
      // Radiant kulesi: yalnız Dire birimleri — ya da kahraman "deny" için (can %12 altı, saldırı)
      if (fromHero) return !!(opts.attack && target.hp <= target.maxHp * 0.12);
      if (!source || source.kind === 'tower') return false;
      return true;
    }
    if (source && source !== g.player && source.kind !== 'tower') return false;
    if (type === DMG.MAG && !opts.structure) return false; // büyüler binalara işlemez
  }
  return true;
}

function numEvent(g, target, n, type, extra) {
  const hero = target === g.player;
  g.emit('dmgNum', {
    x: target.x, z: target.z, y: hero ? 1.9 : target.kind === 'boss' ? (target.numY || 3) : target.kind === 'tower' ? 3.4 : 1.25,
    n: Math.round(n), type, hero, ...extra,
  });
}

/**
 * TEK hasar giriş noktası.
 * source: g.player | düşman birim | kule | 'dot' …   target: düşman birim | g.player | kule
 * type: DMG.PHYS | DMG.MAG | DMG.PURE
 * opts: {
 *   src (etiket: 'attack','arrow','ult',…), attack (temel saldırı: kaçınılabilir, kritik, blok, can çalma),
 *   trueStrike (kaçınılamaz), forceCrit, canCrit:false, pierce (bağışıklığı deler), structure (binaya işler),
 *   knock, dirX, dirZ, quiet (sayı yok), lifesteal (0..1, varsayılan kahraman statı), spellLifesteal,
 *   noLifesteal, dot }
 * Dönen: verilen gerçek hasar (kaçınma/bağışıklık/blokta 0).
 */
export function dealDamage(g, source, target, amount, type = DMG.PHYS, opts = {}) {
  if (!target || target.dead || !(amount > 0)) return 0;
  for (const fn of g.hooks.beforeDamage) {
    const r = fn(g, source, target, amount, type, opts);
    if (typeof r === 'number') amount = r;
  }
  if (!(amount > 0)) return 0;
  if (!canHit(g, source, target, type, opts)) return 0;
  const P = g.player;
  const toHero = target === P;
  const fromHero = source === P;
  const show = (fromHero || toHero) && !opts.quiet;
  // 1) büyü bağışıklığı
  if (type === DMG.MAG && !opts.pierce && isImmune(g, target)) {
    if (show) numEvent(g, target, 0, type, { immune: true });
    return 0;
  }
  // 2) kaçınma (yalnız saldırılar)
  if (opts.attack && type === DMG.PHYS && !opts.trueStrike) {
    const ev = evasionOf(g, target);
    if (ev > 0 && g.rand() < ev) {
      g.emit('evade', { src: source, target, hero: toHero });
      if (fromHero || toHero) numEvent(g, target, 0, type, { miss: true });
      return 0;
    }
  }
  // 3) kritik
  let crit = false;
  if (opts.forceCrit) {
    crit = true;
    const c = critOf(g, source);
    amount *= Math.max(1.5, c ? c.mul : 2);
  } else if (opts.attack && opts.canCrit !== false) {
    const c = critOf(g, source);
    if (c && c.chance > 0 && g.rand() < c.chance) { crit = true; amount *= c.mul; }
  }
  // 4) zırh / büyü direnci
  let a = amount;
  if (type === DMG.PHYS) a *= armorFactor(armorOf(g, target));
  else if (type === DMG.MAG) a *= 1 - mrOf(g, target);
  if (target.st && target.st.amp > 0) a *= 1 + target.st.ampK;
  // 5) hasar bloğu
  let blocked = 0;
  if (opts.attack && type === DMG.PHYS) {
    const b = blockOf(g, target, source);
    if (b > 0) { blocked = Math.min(a, b); a -= blocked; }
  }
  // 6) kalkanlar
  let absorbed = 0;
  if (a > 0 && (target.shield > 0 || target.magShield > 0)) {
    const before = a;
    a = absorb(target, a, type);
    absorbed = before - a;
    if (absorbed > 0) g.emit('shieldHit', { target, n: absorbed, hero: toHero });
  }
  if (a <= 0) {
    if (show) numEvent(g, target, 0, type, { block: blocked > 0, absorb: absorbed > 0 });
    return 0;
  }
  a = Math.max(1, Math.round(a));
  // 7) uygula
  let dealt;
  if (toHero) dealt = g.hurtHero(a, type, source, opts);
  else if (target.kind === 'tower') dealt = g.hurtTower(target, a, type, source, opts);
  else dealt = g.hurtFoe(target, a, type, source, opts, crit);
  if (!(dealt > 0)) return 0;
  // 8) can çalma / büyü can çalma
  if (fromHero && target.kind !== 'tower' && !opts.noLifesteal) {
    let k = 0;
    if (opts.attack && type === DMG.PHYS) k = opts.lifesteal ?? g.stat.lifesteal ?? 0;
    else if (!opts.attack) k = opts.spellLifesteal ?? g.stat.spellLifesteal ?? 0;
    if (opts.dot && opts.spellLifesteal == null) k *= 0.5;
    if (k > 0) g.heal(dealt * k, { quiet: true });
  } else if (toHero && source && typeof source === 'object' && source.lifesteal > 0 && !source.dead) {
    source.hp = Math.min(source.maxHp, source.hp + dealt * source.lifesteal);
  }
  for (const fn of g.hooks.afterDamage) fn(g, source, target, dealt, type, opts);
  // 9) sayı
  if (show || (fromHero && dealt >= 60)) numEvent(g, target, dealt, type, { crit, src: opts.src, block: blocked > 0 });
  return dealt;
}

/** Geriye dönük uyum: zırh/direnç sonrası kalan oran (yalnız düşman birimleri için). */
export function mitigation(target, type) {
  if (type === DMG.PURE) return 1;
  if (type === DMG.MAG) return 1 - (target.magicResist || 0);
  return armorFactor(target.armor || 0);
}
