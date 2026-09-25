// 1vDOQUZ Arena 2.0 — tek hasar giriş noktası ve küçük durum (status) sistemi.
//
// Genişletme: zırh, büyü direnci, kaçınma, kritik, can çalma gibi katmanlar yalnızca dealDamage içine eklenir;
// yetenekler/eşyalar/birimler hasarı hep bu fonksiyondan geçirir. Durumlar birim.st üzerinde sayısal süreler
// olarak tutulur (hızlı, bellek dostu); applyStatus kuralları (en uzun süre, en güçlü yavaşlatma) tek yerde.

/** Hasar türleri: fiziksel (zırh + kaçınma), büyü (büyü direnci; BKB azaltır), saf (hiçbir şey azaltmaz). */
export const DMG = { PHYS: 'physical', MAG: 'magical', PURE: 'pure' };

/** Kahramanın büyü bağışıklığı (BKB) sırasında engellenen durumlar. */
const DEBUFFS = new Set(['stun', 'root', 'slow', 'silence', 'fear', 'taunt']);

/** Yeni durum kaydı. Bilinmeyen türler de süre olarak saklanır (genişletilebilir). */
export function newStatus() {
  return { stun: 0, root: 0, fear: 0, silence: 0, taunt: 0, slow: 0, slowK: 0, dot: 0, dotDps: 0, dotAcc: 0, dotSrc: null, dotKey: '', amp: 0, ampK: 0 };
}

/**
 * Hedefe durum uygula. kind: 'stun'|'root'|'slow'|'silence'|'fear'|'taunt'|'dot'|'amp'|<özel>
 * data: slow → { k: 0..1 } · dot → { dps, src, key } · amp → { k } (alınan hasar çarpanı artışı)
 * Kahraman büyü bağışıklığındaysa (bkb) kontrol etkileri işlemez. true: uygulandı.
 */
export function applyStatus(g, target, kind, dur, data = {}) {
  if (!target || target.dead || !(dur > 0)) return false;
  const st = target.st || (target.st = newStatus());
  if (target === g.player && g.player.bkb > 0 && DEBUFFS.has(kind) && !data.pure) {
    g.emit('immune', { kind });
    return false;
  }
  if (target.bossImmune && (kind === 'stun' || kind === 'root' || kind === 'fear' || kind === 'taunt')) {
    // Roshan kontrol etkilerini çok kısa yaşar
    dur = Math.min(dur, 0.35);
  }
  switch (kind) {
    case 'slow': {
      const k = data.k ?? 0.3;
      if (st.slow <= 0 || k >= st.slowK) st.slowK = k;
      st.slow = Math.max(st.slow, dur);
      break;
    }
    case 'dot':
      st.dot = Math.max(st.dot, dur);
      st.dotDps = Math.max(st.dot > dur ? st.dotDps : 0, data.dps || 0);
      st.dotSrc = data.src || null;
      st.dotKey = data.key || '';
      break;
    case 'amp':
      st.amp = Math.max(st.amp, dur);
      st.ampK = Math.max(st.ampK, data.k || 0.2);
      break;
    default:
      st[kind] = Math.max(st[kind] || 0, dur);
  }
  return true;
}

export const hasStatus = (u, kind) => !!(u && u.st && u.st[kind] > 0);

/** Durum sürelerini ilerletir; DoT hasarını dealDamage üzerinden verir. */
export function tickStatus(g, u, dt) {
  const st = u.st;
  if (!st) return;
  for (const k in st) {
    const v = st[k];
    if (typeof v === 'number' && v > 0 && k !== 'slowK' && k !== 'dotDps' && k !== 'dotAcc' && k !== 'ampK') st[k] = Math.max(0, v - dt);
  }
  if (st.slow <= 0) st.slowK = 0;
  if (st.amp <= 0) st.ampK = 0;
  if (st.dotDps > 0) {
    if (st.dot <= 0) { st.dotDps = 0; st.dotAcc = 0; return; }
    st.dotAcc += st.dotDps * dt;
    if (st.dotAcc >= 8 || (st.dot <= dt && st.dotAcc >= 1)) {
      const n = Math.floor(st.dotAcc);
      st.dotAcc -= n;
      dealDamage(g, st.dotSrc || 'dot', u, n, DMG.MAG, { src: st.dotKey || 'dot', quiet: true });
    }
  }
}

/** Yavaşlatma çarpanı (1 = normal). */
export const slowMul = (u) => (u.st && u.st.slow > 0 ? 1 - u.st.slowK : 1);

/**
 * TEK hasar giriş noktası.
 * source: g.player | düşman birim | kule | 'fountain' | 'dot' …   target: düşman birim | g.player | kule
 * type: DMG.PHYS | DMG.MAG | DMG.PURE
 * opts: { src (etiket: 'attack','arrow','ult',…), attack (temel saldırı: kaçınılabilir), crit, knock, dirX, dirZ,
 *         quiet (yüzen sayı yok), lifesteal (0..1), structure (binaya işler) }
 * Dönen: verilen gerçek hasar (kaçınma/bağışıklıkta 0).
 */
export function dealDamage(g, source, target, amount, type = DMG.PHYS, opts = {}) {
  if (!target || target.dead || !(amount > 0)) return 0;
  for (const fn of g.hooks.beforeDamage) {
    const r = fn(g, source, target, amount, type, opts);
    if (typeof r === 'number') amount = r;
  }
  let dealt = 0;
  if (target === g.player) dealt = g.damageHero(amount, type, source, opts);
  else if (target.kind === 'tower') dealt = g.damageTower(target, amount, type, source, opts);
  else dealt = g.damageFoe(target, amount, type, source, opts);
  if (dealt > 0 && opts.lifesteal && source === g.player) g.heal(dealt * opts.lifesteal, { quiet: true });
  if (dealt > 0) for (const fn of g.hooks.afterDamage) fn(g, source, target, dealt, type, opts);
  return dealt;
}

/** Zırh/direnç sonrası kalan oran (birim tanımındaki armor & magicResist: 0..1 azaltma). */
export function mitigation(target, type) {
  if (type === DMG.PURE) return 1;
  if (type === DMG.MAG) return 1 - (target.magicResist || 0);
  return 1 - (target.armor || 0);
}
