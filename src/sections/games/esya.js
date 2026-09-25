// Eşya 2048 — geçici iskelet; oyun modülü bu dosyanın yerini alır.

import { h, fmtNum } from '../../core/dom.js';

export const meta = {
  id: 'esya',
  name: 'Eşya 2048',
  short: '2048',
  icon: 'coin',
  color: 'var(--aegis)',
  kind: 'Zihin · Birleştir',
  blurb: 'Dalları birleştir, Rapier’e ulaş. Kaydır, birleştir, sakın envanteri doldurma.',
  time: '~5 dk',
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
