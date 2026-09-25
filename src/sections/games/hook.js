// Pudge Hook — geçici iskelet; oyun modülü bu dosyanın yerini alır.

import { h, fmtNum } from '../../core/dom.js';

export const meta = {
  id: 'hook',
  name: 'Pudge Hook',
  short: 'Hook',
  icon: 'bone',
  color: 'var(--dire)',
  kind: 'Beceri · Nişan',
  blurb: 'Kancayı fırlat, düşmanı çek. Dosta çarparsan klip değil DOG olur.',
  time: '60 sn',
  diff: 2,
  unit: 'puan',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} puan`,
  rules: [],
  keys: [],
};

export function mount(el) {
  el.appendChild(h('div', { class: 'empty' }, 'Bu oyun hazırlanıyor.'));
  return () => {};
}
