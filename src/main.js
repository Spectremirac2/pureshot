// Giriş noktası: fontlar, stiller, kabuk.
// Fontlar: sitenin glif kümesine indirgenmiş tek dosya/kalınlık (scripts/subset-fonts.mjs üretir)
import './styles/fonts.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/components.css';

import { mountShell } from './core/shell.js';

const root = document.getElementById('app') || (() => {
  const el = document.createElement('div');
  el.id = 'app';
  document.body.appendChild(el);
  return el;
})();

mountShell(root);
