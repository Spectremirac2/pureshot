// 1vDOQUZ Arena 2.0 — mini Dota savaş alanı yerleşimi (simülasyon, 3D, 2D ve mini harita ortak kullanır).
//
// Dünya ekseni: x sağ, z aşağı (kamera oyun sırasında -z yönüne bakar; ekranda yukarı = -z).
// Nehir sol üstten (-x,-z) sağ alta (+x,+z) akar; x - z < 0 yarısı Radiant (sol alt), x - z > 0 Dire (sağ üst).

import { seeded } from '../../../core/dom.js';

export const ARENA_R = 13.2; // duvarın iç yarıçapı
export const PLAY_R = 12.3; // oynanabilir yarıçap
const Q = Math.PI / 4;
/** Kapılar (açı a → (sin a, cos a)): sağ alt nehir çıkışı, sağ üst Dire, sol üst nehir kaynağı, sol alt Radiant. */
export const GATES = { br: Q, tr: 3 * Q, tl: 5 * Q, bl: 7 * Q };
export const GATE_ANGLES = [GATES.br, GATES.tr, GATES.tl, GATES.bl];
/** DOG'lar Radiant kapısı dışındaki kapılardan girer. */
export const DOG_GATES = [GATES.br, GATES.tr, GATES.tl];

// ------------------------------------------------------------------ nehir
const S2 = Math.SQRT1_2;
export const RIVER_HALF = 1.25;
export const ISLAND_R = 2.55; // ortadaki mühür adası (nehir çevresinden akar)
/** Nehrin kıvrımı: akış ekseni boyunca s konumunda dik sapma. */
export const riverOffset = (s) => 0.55 * Math.sin(s * 0.42 + 0.6);
/** (x,z) → { s: akış boyunca, d: nehrin orta çizgisine dik uzaklık (işaretli) } */
export function riverCoords(x, z) {
  const s = (x + z) * S2;
  const d = (x - z) * S2 - riverOffset(s);
  return { s, d };
}
/** Nehrin orta çizgisinde s konumundaki nokta. */
export function riverPoint(s) {
  const o = riverOffset(s);
  // s ekseni (1,1)/√2, dik eksen (1,-1)/√2
  return { x: (s + o) * S2, z: (s - o) * S2 };
}
export function inRiver(x, z) {
  if (x * x + z * z < ISLAND_R * ISLAND_R) return false;
  const { d } = riverCoords(x, z);
  return Math.abs(d) < RIVER_HALF;
}
/** Dire yarısında mı (sağ üst)? */
export const direSide = (x, z) => x - z > 0;

// ------------------------------------------------------------------ yapılar
export const FOUNTAIN = { x: -7.25, z: 7.25, r: 2.0 };
export const ROSHAN_PIT = { x: -6.05, z: -6.05, r: 2.15, leash: 5.6 };
const rs = riverPoint(-4.9);
const rb = riverPoint(4.9);
export const RUNE_SPOTS = [
  { id: 'ust', x: rs.x, z: rs.z },
  { id: 'alt', x: rb.x, z: rb.z },
];
export const TOWER_SPOTS = [
  { id: 'r1', side: 'radiant', x: -7.55, z: 2.05 },
  { id: 'r2', side: 'radiant', x: -2.05, z: 7.55 },
  { id: 'd1', side: 'dire', x: 7.55, z: -2.05 },
  { id: 'd2', side: 'dire', x: 2.05, z: -7.55 },
];
export const TOWER_R = 0.78; // çarpışma yarıçapı
/**
 * Orman kampları (Arena 3.0): dalgalar arasında farm fırsatı. Her dakika boşsa yeniden dolar.
 * x,z: kamp merkezi · leash: birimler bu yarıçaptan uzağa çekilirse evine döner ve iyileşir.
 */
export const CAMPS = [
  { id: 'kurt', name: 'Kurt İni', x: 2.4, z: 7.6, leash: 5.2, side: 'radiant' },
  { id: 'harpi', name: 'Harpi Yuvası', x: -9.2, z: -2.2, leash: 5.2, side: 'radiant' },
  { id: 'koru', name: 'Yaşlı Koru', x: 7.9, z: 2.9, leash: 5.2, side: 'dire' },
];
export const DIRE_GATE = { x: Math.sin(GATES.tr) * (PLAY_R - 0.4), z: Math.cos(GATES.tr) * (PLAY_R - 0.4) };
export const RADIANT_GATE = { x: Math.sin(GATES.bl) * (PLAY_R - 0.4), z: Math.cos(GATES.bl) * (PLAY_R - 0.4) };

// ------------------------------------------------------------------ ağaçlar
function angDist(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

/** Duvar boyunca ve birkaç orman kümesinde ağaçlar: { x, z, r, s (ölçek), dire, rot } */
export const TREES = (() => {
  const rnd = seeded(2024);
  const out = [];
  const blocked = (x, z, pad) => {
    for (const t of TOWER_SPOTS) if (Math.hypot(x - t.x, z - t.z) < 2.3 + pad) return true;
    if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < FOUNTAIN.r + 1.2 + pad) return true;
    if (Math.hypot(x - ROSHAN_PIT.x, z - ROSHAN_PIT.z) < ROSHAN_PIT.r + 1.0 + pad) return true;
    for (const r of RUNE_SPOTS) if (Math.hypot(x - r.x, z - r.z) < 1.6 + pad) return true;
    if (Math.abs(riverCoords(x, z).d) < RIVER_HALF + 0.7) return true;
    for (const o of out) if (Math.hypot(x - o.x, z - o.z) < 1.05) return true;
    return false;
  };
  // duvar boyu: iki sıra
  for (let i = 0; i < 64; i++) {
    const a = rnd() * Math.PI * 2;
    if (GATE_ANGLES.some((g) => angDist(a, g) < 0.3)) continue;
    const r = 10.9 + rnd() * 1.25;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (blocked(x, z, 0)) continue;
    out.push({ x, z, r: 0.42, s: 0.85 + rnd() * 0.45, dire: direSide(x, z), rot: rnd() * Math.PI * 2 });
  }
  // orman kümeleri
  const clumps = [[-5.3, -1.0], [1.0, 5.3], [5.3, 1.0], [-1.0, -5.1], [-9.2, -3.6], [3.6, 9.2], [9.2, 3.6], [-3.6, -9.2]];
  for (const [cx, cz] of clumps) {
    for (let k = 0; k < 3; k++) {
      const a = rnd() * Math.PI * 2;
      const d = k === 0 ? 0 : 0.8 + rnd() * 0.35;
      const x = cx + Math.sin(a) * d;
      const z = cz + Math.cos(a) * d;
      if (Math.hypot(x, z) > PLAY_R - 0.6 || blocked(x, z, 0)) continue;
      out.push({ x, z, r: 0.42, s: 0.8 + rnd() * 0.4, dire: direSide(x, z), rot: rnd() * Math.PI * 2 });
    }
  }
  return out;
})();

/** Duvar dışındaki süs ağaçları (çarpışmasız). */
export const OUTER_TREES = (() => {
  const rnd = seeded(77);
  const out = [];
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    if (GATE_ANGLES.some((g) => angDist(a, g) < 0.14)) continue;
    const r = 15 + rnd() * 16;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (Math.abs(riverCoords(x, z).d) < 2.4) continue;
    out.push({ x, z, s: 1 + rnd() * 1.1, dire: direSide(x, z), rot: rnd() * Math.PI * 2 });
  }
  return out;
})();

/** Katı engeller (ağaçlar + kuleler): birimleri dışarı iter. alive(t) kule için. */
export function pushOut(u, rad, towers) {
  for (const t of TREES) {
    const dx = u.x - t.x;
    const dz = u.z - t.z;
    const min = rad + t.r;
    const q = dx * dx + dz * dz;
    if (q < min * min && q > 1e-8) {
      const L = Math.sqrt(q);
      u.x = t.x + (dx / L) * min;
      u.z = t.z + (dz / L) * min;
    }
  }
  if (towers) {
    for (const t of towers) {
      if (t.dead) continue;
      const dx = u.x - t.x;
      const dz = u.z - t.z;
      const min = rad + TOWER_R;
      const q = dx * dx + dz * dz;
      if (q < min * min && q > 1e-8) {
        const L = Math.sqrt(q);
        u.x = t.x + (dx / L) * min;
        u.z = t.z + (dz / L) * min;
      }
    }
  }
}

/**
 * Yerel engelden kaçınma (yol bulma yok, ucuz): hareket yönünün önündeki ağaç/kuleye çarpacaksa teğet yönde
 * kaydırır. Birimlerin kule ya da ağaç arkasında takılı kalmasını önler. Dönen: [mx, mz] (aynı büyüklük).
 */
export function steerAround(u, mx, mz, rad, towers, look = 1.7) {
  const L = Math.hypot(mx, mz);
  if (L < 1e-4) return [mx, mz];
  const dx = mx / L;
  const dz = mz / L;
  let bt = look;
  let bx = 0;
  let bz = 0;
  let hit = false;
  const check = (ox, oz, or) => {
    const rx = ox - u.x;
    const rz = oz - u.z;
    const t = rx * dx + rz * dz;
    if (t < -0.2 || t > bt) return;
    const px = rx - dx * t;
    const pz = rz - dz * t;
    if (px * px + pz * pz < (or + rad + 0.08) ** 2) { bt = Math.max(0, t); bx = rx; bz = rz; hit = true; }
  };
  for (const t of TREES) {
    if (Math.abs(t.x - u.x) > look + 1 || Math.abs(t.z - u.z) > look + 1) continue;
    check(t.x, t.z, t.r);
  }
  if (towers) for (const t of towers) if (!t.dead) check(t.x, t.z, TOWER_R);
  if (!hit) return [mx, mz];
  const s = bx * dz - bz * dx;
  const sg = s >= 0 ? 1 : -1;
  const tx = -sg * dz;
  const tz = sg * dx;
  const nx = dx * 0.25 + tx;
  const nz = dz * 0.25 + tz;
  const nl = Math.hypot(nx, nz) || 1;
  return [(nx / nl) * L, (nz / nl) * L];
}
