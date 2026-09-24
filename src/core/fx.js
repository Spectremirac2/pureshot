// Görsel efektler ve sayfa içi diyaloglar.
// alert/confirm/prompt Artifact görüntüleyicide çalışmaz; onların yerine fx.confirm / fx.modal kullanın.

import { h, clear, prefersReducedMotion, rand } from './dom.js';
import { sound } from './sound.js';

let toastHost = null;
let fxCanvas = null;
let fxCtx = null;
let particles = [];
let raf = 0;

function host() {
  if (!toastHost) {
    toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastHost);
  }
  return toastHost;
}

function canvas() {
  if (!fxCanvas) {
    fxCanvas = h('canvas', { class: 'fx-canvas', 'aria-hidden': 'true' });
    Object.assign(fxCanvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '80' });
    document.body.appendChild(fxCanvas);
    fxCtx = fxCanvas.getContext('2d');
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      fxCanvas.width = innerWidth * dpr;
      fxCanvas.height = innerHeight * dpr;
      fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
  }
  return fxCanvas;
}

function runParticles() {
  if (raf) return;
  let last = performance.now();
  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fxCtx.clearRect(0, 0, innerWidth, innerHeight);
    particles = particles.filter((p) => (p.life -= dt) > 0);
    for (const p of particles) {
      p.vy += p.g * dt;
      p.vx *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const a = Math.min(1, p.life / p.maxLife * 1.5);
      fxCtx.save();
      fxCtx.globalAlpha = a;
      fxCtx.translate(p.x, p.y);
      fxCtx.rotate(p.rot);
      fxCtx.fillStyle = p.color;
      if (p.text) {
        fxCtx.font = `900 ${p.size}px Unbounded, Arial Black, sans-serif`;
        fxCtx.textAlign = 'center';
        fxCtx.fillText(p.text, 0, 0);
      } else if (p.shape === 'circle') {
        fxCtx.beginPath();
        fxCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        fxCtx.fill();
      } else {
        fxCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      fxCtx.restore();
    }
    if (particles.length) raf = requestAnimationFrame(step);
    else { raf = 0; fxCtx.clearRect(0, 0, innerWidth, innerHeight); }
  };
  raf = requestAnimationFrame(step);
}

const COLORS = ['#ff6a2b', '#ff9a3d', '#e9b949', '#f6d98a', '#43d6a0', '#f3eadb', '#e0354b'];

export const fx = {
  /** Bildirim. kind: 'ember' | 'jade' | 'blood' | undefined */
  toast(message, kind, ms = 2600) {
    const el = h('div', { class: `toast ${kind || ''}` }, message);
    host().appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 220);
    }, ms);
  },

  /** Elemanı salla. */
  shake(el = document.body) {
    if (prefersReducedMotion() || !el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
  },

  /** Konfeti patlaması (ekran koordinatları). */
  confetti(x = innerWidth / 2, y = innerHeight / 2, count = 90) {
    if (prefersReducedMotion()) return;
    canvas();
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2);
      const sp = rand(180, 620);
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 260,
        g: 900,
        size: rand(6, 12),
        color: COLORS[i % COLORS.length],
        rot: rand(0, 6), vr: rand(-10, 10),
        life: rand(1.2, 2.2), maxLife: 2.2,
        shape: Math.random() < 0.3 ? 'circle' : 'rect',
      });
    }
    runParticles();
  },

  /** Uçuşan metin parçacıkları ("DOG!", "+25"). */
  floatText(text, x, y, { color = '#ff9a3d', size = 22, count = 1 } = {}) {
    if (prefersReducedMotion()) return;
    canvas();
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + rand(-20, 20), y,
        vx: rand(-60, 60), vy: rand(-320, -200),
        g: 380, size, color, text,
        rot: rand(-0.3, 0.3), vr: rand(-0.5, 0.5),
        life: 1.1, maxLife: 1.1,
      });
    }
    runParticles();
  },

  /** Ekran ortasında büyük meme damgası: "DOG DOG DOG" */
  stamp(text = 'DOG DOG DOG', { variant = '', ms = 1100 } = {}) {
    const el = h('div', { class: 'stamp-overlay', 'aria-hidden': 'true' }, h('span', { class: `stamp ${variant}` }, text));
    document.body.appendChild(el);
    sound.stamp();
    setTimeout(() => el.remove(), ms);
  },

  /**
   * Sayfa içi modal. content: Node. Döndürülen close() ile kapatılır.
   * Esc ve arka plana tıklama kapatır.
   */
  modal(content, { label = 'Pencere', onClose } = {}) {
    const prev = document.activeElement;
    const box = h('div', { class: 'modal panel raised frame', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, content);
    const back = h('div', { class: 'modal-backdrop' }, box);
    const close = () => {
      back.remove();
      document.removeEventListener('keydown', onKey, true);
      if (prev && prev.focus) prev.focus();
      if (onClose) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    };
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    const focusable = box.querySelector('button, [href], input, textarea, select');
    (focusable || box).focus?.();
    return close;
  },

  /** Sayfa içi onay; Promise<boolean>. */
  confirm(message, { ok = 'Evet', cancel = 'Vazgeç', danger = false } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; close(); resolve(v); } };
      const body = h('div', { class: 'stack' },
        h('p', { class: 'h3' }, message),
        h('div', { class: 'row', style: 'justify-content:flex-end' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => finish(false) }, cancel),
          h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onclick: () => finish(true) }, ok),
        ),
      );
      const close = fx.modal(body, { label: 'Onay', onClose: () => { if (!done) { done = true; resolve(false); } } });
    });
  },

  /** Kısa ekran flaşı. */
  flash(color = 'rgba(255,106,43,0.25)') {
    if (prefersReducedMotion()) return;
    const el = h('div', { 'aria-hidden': 'true', style: `position:fixed;inset:0;z-index:79;pointer-events:none;background:${color};animation:flash-out .5s ease-out forwards` });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 520);
  },

  clear,
};
