// Altıgen radar grafiği (SVG). Bir veya iki seri (karşılaştırma / analiz) çizer.
//   radarSvg([{ stats, color, label }], { values: true, animate: true, title })
import { STAT_LABELS } from '../../data/archetypes.js';
import { prefersReducedMotion } from '../../core/dom.js';
import { s, STAT_KEYS, GOOD_STATS } from './util.js';

const W = 440;
const H = 346;
const CX = 220;
const CY = 176;
const R = 118;
const LABEL_R = R + 16;

const angleOf = (i) => (-90 + i * 60) * (Math.PI / 180);
const pt = (i, r) => [CX + Math.cos(angleOf(i)) * r, CY + Math.sin(angleOf(i)) * r];
const fmt = (n) => Math.round(n * 10) / 10;
const ring = (frac) => STAT_KEYS.map((_, i) => pt(i, R * frac).map(fmt).join(',')).join(' ');

export function radarSvg(series, { values = true, animate = true, title = 'Radar grafiği', compact = false } = {}) {
  const anim = animate && !prefersReducedMotion();
  const desc = series
    .map((se) => `${se.label || ''}: ${STAT_KEYS.map((k) => `${STAT_LABELS[k]} ${Math.round(se.stats[k] || 0)}`).join(', ')}`)
    .join('. ');

  const svg = s('svg', {
    class: `ch-radar${compact ? ' is-compact' : ''}${series.length > 1 ? ' is-multi' : ''}`,
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': `${title}. ${desc}`,
    preserveAspectRatio: 'xMidYMid meet',
  }, s('title', null, title));

  // Izgara halkaları: 25/75 soluk, 50/100 belirgin
  const grid = s('g', { class: 'ch-radar-grid', 'aria-hidden': 'true' });
  for (const f of [0.25, 0.5, 0.75, 1]) {
    grid.appendChild(s('polygon', { class: `ch-radar-ring${f === 0.5 || f === 1 ? ' is-major' : ''}`, points: ring(f) }));
  }
  STAT_KEYS.forEach((_, i) => {
    const [x, y] = pt(i, R);
    grid.appendChild(s('line', { class: 'ch-radar-axis', x1: CX, y1: CY, x2: fmt(x), y2: fmt(y) }));
  });
  // Ölçek etiketleri (0 / 50 / 100) — üst eksenin hemen sağında
  grid.appendChild(s('text', { class: 'ch-radar-scale', x: CX + 6, y: CY + 4 }, '0'));
  grid.appendChild(s('text', { class: 'ch-radar-scale', x: CX + 6, y: fmt(CY - R * 0.5 + 4) }, '50'));
  grid.appendChild(s('text', { class: 'ch-radar-scale', x: CX + 6, y: fmt(CY - R + 12) }, '100'));
  svg.appendChild(grid);

  // Seriler
  series.forEach((se, si) => {
    const pts = STAT_KEYS.map((k, i) => pt(i, (R * Math.max(0, Math.min(100, se.stats[k] || 0))) / 100));
    const g = s('g', {
      class: `ch-radar-series ch-radar-s${si}${anim ? ' is-anim' : ''}`,
      style: { '--ch-c': se.color, 'transform-origin': `${CX}px ${CY}px`, 'animation-delay': `${si * 140}ms` },
    },
      s('polygon', { class: 'ch-radar-area', points: pts.map((p) => p.map(fmt).join(',')).join(' ') }),
      pts.map(([x, y]) => s('circle', { class: 'ch-radar-dot', cx: fmt(x), cy: fmt(y), r: compact ? 3.2 : 4 })),
    );
    svg.appendChild(g);
  });

  // Eksen etiketleri + değerler
  const labels = s('g', { class: 'ch-radar-labels' });
  STAT_KEYS.forEach((k, i) => {
    const [x, y] = pt(i, LABEL_R);
    const a = angleOf(i);
    const cos = Math.cos(a);
    const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
    const isTop = i === 0;
    const isBottom = i === 3;
    const nameY = isTop ? y - 18 : isBottom ? y + 12 : y - 3;
    const valY = nameY + 16;
    const lx = anchor === 'start' ? x + 2 : anchor === 'end' ? x - 2 : x;
    labels.appendChild(
      s('text', { class: `ch-radar-label${GOOD_STATS.has(k) ? ' is-good' : ''}`, x: fmt(lx), y: fmt(nameY), 'text-anchor': anchor }, STAT_LABELS[k]),
    );
    if (values) {
      const t = s('text', { class: 'ch-radar-val', x: fmt(lx), y: fmt(valY), 'text-anchor': anchor });
      series.forEach((se, si) => {
        if (si > 0) t.appendChild(s('tspan', { class: 'ch-radar-sep' }, ' · '));
        t.appendChild(s('tspan', { style: { fill: se.color } }, String(Math.round(se.stats[k] || 0))));
      });
      labels.appendChild(t);
    }
  });
  svg.appendChild(labels);
  return svg;
}
