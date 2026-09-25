// Profil kataloğu: rekor kartlarında gösterilecek oyunlar/quizler, birimleri ve skor yönü.
//
// Neden ayrı tablo? games.js tüm oyun modüllerini (ve CSS'lerini) statik olarak içe aktarır; profil sayfası
// yalnızca ad/simge/birim için bunları indirmesin. Oyunların adı, simgesi, rengi, birimi, skor yönü ve
// biçimleyicisi badges.js'teki hafif SALON_GAMES kataloğundan gelir (oyunların meta değerlerinin kopyası).
// Yedek: SALON_GAMES'te birimi olmayan bir oyun düz sayı ve “yüksek iyi” sayılır; hiçbir katalogda olmayan
// bir skor kimliği “Diğer” altında düz sayı olarak gösterilir.

import { fmtNum } from '../../core/dom.js';
import { SALON_GAMES, THRESHOLDS } from '../../core/badges.js';

// Quizler (src/data/quizzes.js QUIZZES ile aynı kimlik/ad; soru bankalarını indirmemek için kopya)
const QUIZ_LIST = [
  { id: 'hangidog', name: 'Hangi DOG’sun?', short: 'Hangi DOG', icon: 'paw', color: 'var(--ember)', special: 'hangidog' },
  { id: 'bilgi', name: 'Dota 2 Bilgi Yarışması', short: 'Bilgi', icon: 'brain', color: 'var(--arcane)', unit: 'puan', up: true },
  { id: 'dogmu', name: 'DOG mu Değil mi?', short: 'DOG mu?', icon: 'target', color: 'var(--dire)', up: true, fmt: (n) => `%${fmtNum(n)}`, unitLabel: 'DOG radarı' },
  { id: 'hayran', name: 'Gerçek Hayran Testi', short: 'Hayran', icon: 'crown', color: 'var(--aegis)', up: true, fmt: (n) => `${fmtNum(n)}/12`, unitLabel: 'doğru' },
  { id: 'yetenek', name: 'Yetenek Avı', short: 'Yetenek', icon: 'spell', color: 'var(--radiant)', unit: 'puan', up: true },
];

const OTHER_LIST = [
  { id: 'daha', name: 'Daha DOG mu?', short: 'Daha DOG?', icon: 'dice', color: 'var(--dire)', unit: 'doğru', up: true, href: '#kahramanlar--daha', where: 'Kahramanlar' },
];

// Rozet eşikleri → “güç” sıralaması (paylaşım kartındaki en iyi 3 rekor için)
const GOALS = {
  arena: THRESHOLDS.arena, dogavi: THRESHOLDS.dogavi, lasthit: THRESHOLDS.lasthit, hafiza: THRESHOLDS.hafiza,
  rune: THRESHOLDS.rune, dogdle: THRESHOLDS.dogdleSharp, portre: THRESHOLDS.portre, invoker: THRESHOLDS.invoker,
  hook: THRESHOLDS.hook, bingo: 3, hayran: THRESHOLDS.hayran, bilgi: THRESHOLDS.bilgi, daha: THRESHOLDS.daha,
  dogmu: 100,
  kurye: THRESHOLDS.kurye, mayin: THRESHOLDS.mayinSentry, esya: THRESHOLDS.esya,
  maraton: 3000, // ≈ 24:00'e varan yayın (Maraton Tamam rozeti skor değil bayrakla açılır)
};

function mk(base, kind) {
  const unit = base.unit || '';
  const up = base.higherIsBetter != null ? base.higherIsBetter !== false : base.up != null ? base.up : true;
  const fmt = typeof base.format === 'function' ? base.format : base.fmt || ((n) => (unit ? `${fmtNum(n)} ${unit}` : fmtNum(n)));
  const href = base.href || (kind === 'quiz' ? `#quizler--${base.id}` : `#oyunlar--${base.id}`);
  return {
    id: base.id,
    kind,
    name: base.name || base.id,
    short: base.short || base.name || base.id,
    icon: base.icon || 'gamepad',
    color: base.color || 'var(--ember)',
    unit,
    up,
    special: base.special || null,
    where: base.where || null,
    href,
    format: (n) => { try { return fmt(n); } catch { return fmtNum(n); } },
  };
}

/** Oyun kataloğu: SALON_GAMES sırası (14 oyun). */
export function gameCatalog() {
  return SALON_GAMES.map((g) => mk(g, 'game'));
}

export function quizCatalog() {
  return QUIZ_LIST.map((q) => mk(q, 'quiz'));
}

export function otherCatalog(extraIds = []) {
  const list = OTHER_LIST.map((o) => mk(o, 'other'));
  const known = new Set([...gameCatalog(), ...quizCatalog(), ...list].map((x) => x.id));
  for (const id of extraIds) {
    if (known.has(id)) continue;
    known.add(id);
    list.push(mk({ id, name: id, icon: 'star', href: '#oyunlar' }, 'other'));
  }
  return list;
}

/** Kimliğe göre katalog girdisi (bilinmeyen kimlik için düz sayı biçimli girdi). */
export function entryFor(id) {
  return [...gameCatalog(), ...quizCatalog(), ...otherCatalog()].find((x) => x.id === id) || mk({ id, name: id, icon: 'star' }, 'other');
}

/** Rekorun rozet eşiğine göre gücü (0–∞); paylaşım kartında en iyi 3 rekoru seçmek için. */
export function strength(entry, score) {
  const goal = GOALS[entry.id];
  if (typeof score !== 'number' || !Number.isFinite(score)) return -1;
  if (!goal) return 0.5;
  if (entry.up) return score / goal;
  return score > 0 ? goal / score : 0;
}
