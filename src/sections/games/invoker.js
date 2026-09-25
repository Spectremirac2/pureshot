// Invoker Kombo — geçici iskelet; oyun modülü bu dosyanın yerini alır.

import { h, fmtNum } from '../../core/dom.js';

export const meta = {
  id: 'invoker',
  name: 'Invoker Kombo',
  short: 'Invoker',
  icon: 'sparkle',
  color: 'var(--arcane)',
  kind: 'Refleks · Parmak',
  blurb: 'Q W E kürelerini diz, R ile çağır. Altmış saniyede kaç büyü?',
  time: '60 sn',
  diff: 3,
  unit: 'büyü',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} büyü`,
  rules: [],
  keys: [],
};

export function mount(el) {
  el.appendChild(h('div', { class: 'empty' }, 'Bu oyun hazırlanıyor.'));
  return () => {};
}
