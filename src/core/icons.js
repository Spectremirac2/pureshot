// Satır içi SVG ikon seti (24x24, currentColor çizgi). icon('paw') → <svg> elemanı.

const P = {
  paw: '<circle cx="6.5" cy="9" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="14" cy="5.5" r="2"/><circle cx="17.5" cy="9" r="2"/><path d="M7.5 17c0-3 2-5.5 4.5-5.5s4.5 2.5 4.5 5.5c0 1.7-1.3 2.5-2.6 2.5-1 0-1.3-.6-1.9-.6s-.9.6-1.9.6c-1.3 0-2.6-.8-2.6-2.5z"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  laugh: '<circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 2.4 3 4 3s3-1 4-3z"/><path d="M8 9.5l1.5-1 1.5 1M13 9.5l1.5-1 1.5 1"/>',
  gamepad: '<path d="M6 8h12a4 4 0 014 4v2a3 3 0 01-5.2 2L15 14H9l-1.8 2A3 3 0 012 14v-2a4 4 0 014-4z"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r=".8"/><circle cx="18" cy="13.5" r=".8"/>',
  quiz: '<path d="M9 9a3 3 0 115 2.2c-1 .7-2 1.3-2 2.8"/><circle cx="12" cy="17.5" r=".9"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
  bow: '<path d="M5 3c8 3 13 8 16 16"/><path d="M5 3l14 16"/><path d="M3 5l2-2M17 21l4-2-2 4"/><path d="M3 9l6 6"/>',
  mask: '<path d="M4 5c5 2 11 2 16 0v6c0 5-4 9-8 9s-8-4-8-9z"/><path d="M8 10.5h2.5M13.5 10.5H16"/><path d="M9.5 15c1.5 1 3.5 1 5 0"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  gallery: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="9.5" r="1.8"/><path d="M3 17l5-5 4 4 3-3 6 6"/>',
  cube: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4"/><path d="M10 14h4l1 4H9z"/><path d="M8 20h8"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
  flame: '<path d="M12 21c-4 0-7-2.8-7-6.5 0-3.4 2.6-5.3 3.6-8.5 2.4 1.4 3.4 3.6 3.4 5.5 1-1 1.6-2.3 1.8-3.8C16.6 9.8 19 12.3 19 15c0 3.5-3 6-7 6z"/>',
  sword: '<path d="M14.5 3H21v6.5L10 20.5 3.5 14z"/><path d="M5 16l3 3M3 21l3-3"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  ward: '<path d="M12 3v14"/><path d="M8 21h8"/><circle cx="12" cy="7" r="3.5"/><circle cx="12" cy="7" r="1"/>',
  skull: '<path d="M5 11a7 7 0 1114 0c0 2-1 3.2-2 4v3H7v-3c-1-.8-2-2-2-4z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10 18v2M14 18v2"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.8 2.5 1.8-1 1.5-2.5 1.8-2.5.8-2.5 2 1 1.8 2.5 1.8 2.5-.8 2.5-1.8"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/><circle cx="12" cy="12" r="1"/>',
  brain: '<path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 003 3h1V4z"/><path d="M15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-3 3h-1V4z"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V4h12"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  kick: '<path d="M5 3h5v5h2V5h2V3h5v6h-2v2h-2v2h2v2h2v6h-5v-2h-2v-3h-2v5H5z"/>',
  bone: '<path d="M7 14l7-7a2.5 2.5 0 114 3 2.5 2.5 0 11-3 4l-7 7a2.5 2.5 0 11-4-3 2.5 2.5 0 113-4z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".9"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.5"/><circle cx="12" cy="17" r=".9"/>',
  thumbUp: '<path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5a2 2 0 012 2.3l-1.2 7A2 2 0 0117.3 20H7"/>',
  swords: '<path d="M4 4l9 9M20 4l-9 9"/><path d="M14 17l3 3M10 17l-3 3M16 15l4 4M8 15l-4 4"/><path d="M4 4h4M4 4v4M20 4h-4M20 4v4"/>',
};

export function icon(name, { size = 20, stroke = 1.8, cls = '' } = {}) {
  const tmp = document.createElement('div');
  tmp.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon ${cls}">${P[name] || P.paw}</svg>`;
  return tmp.firstChild;
}

export const ICON_NAMES = Object.keys(P);
