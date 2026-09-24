// Fare/dokunma ile 3D eğilme efekti. attachTilt(el, { max: 10 }) → detach()
import { prefersReducedMotion } from '../core/dom.js';

export function attachTilt(el, { max = 10, scale = 1.02 } = {}) {
  if (prefersReducedMotion() || !window.matchMedia('(hover: hover)').matches) return () => {};
  el.classList.add('tilt');
  let shine = el.querySelector(':scope > .tilt-shine');
  if (!shine) {
    shine = document.createElement('span');
    shine.className = 'tilt-shine';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(shine);
  }
  const move = (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) scale(${scale})`;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
  };
  const leave = () => { el.style.transform = ''; };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', leave);
  return () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerleave', leave);
    leave();
  };
}
