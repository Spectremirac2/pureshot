// Giriş noktası: fontlar, stiller, kabuk.
import '@fontsource/unbounded/latin-800.css';
import '@fontsource/unbounded/latin-ext-800.css';
import '@fontsource/unbounded/latin-900.css';
import '@fontsource/unbounded/latin-ext-900.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cinzel/latin-ext-700.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-ext-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-ext-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-ext-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow/latin-ext-700.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-ext-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-ext-700.css';

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
