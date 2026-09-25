// 24 Saat Maraton — geçici iskelet; oyun modülü bu dosyanın yerini alır.

import { h, fmtNum } from '../../core/dom.js';

export const meta = {
  id: 'maraton',
  name: '24 Saat Maraton',
  short: 'Maraton',
  icon: 'hourglass',
  color: 'var(--ember)',
  kind: 'Yayın · Strateji',
  blurb: 'Yirmi dört saatlik yayını ayakta tut: enerji, chat ve MMR dengede kalsın.',
  time: '~5 dk',
  diff: 2,
  unit: 'izleyici',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} izleyici`,
  rules: [],
  keys: [],
};

export function mount(el) {
  el.appendChild(h('div', { class: 'empty' }, 'Bu oyun hazırlanıyor.'));
  return () => {};
}
