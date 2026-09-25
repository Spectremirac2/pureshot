// Profil (#profil) — geçici iskelet; profil bölümü bu dosyanın yerini alır.
import { h } from '../../core/dom.js';

export default {
  mount(el) {
    const root = h('div', { class: 'wrap' }, h('div', { class: 'empty' }, 'Profil sayfası hazırlanıyor.'));
    el.appendChild(root);
    return () => root.remove();
  },
  onSub() {},
};
