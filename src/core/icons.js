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
  // Invoker Kombo: yörüngede üç küre
  orbs: '<circle cx="12" cy="6.5" r="3"/><circle cx="6.5" cy="16" r="3"/><circle cx="17.5" cy="16" r="3"/><path d="M14.9 7.2a6.3 6.3 0 013.4 5.9M15.4 18.1a6.3 6.3 0 01-6.8 0M5.7 13.1a6.3 6.3 0 013.4-5.9"/>',
  // Pudge Hook: halkalı et kancası
  hook: '<circle cx="14" cy="3.8" r="1.8"/><path d="M14 5.6V14a4.5 4.5 0 01-9 0v-3.5l2.4 2.2"/>',
  // Oyun Salonu / rozetler
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/><path d="M12 14.5v2.5"/>',
  medal: '<path d="M8 3l4 6 4-6"/><path d="M5.5 3H10M14 3h4.5"/><circle cx="12" cy="15" r="6"/><path d="M12 12l.9 1.9 2.1.3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.4 2.1-.3z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h3v3H8z"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  // DOGdle / Portre Avı: arama, paylaşım, ipucu
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  bulb: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 00-3.7 10.7c.8.7 1.2 1.4 1.2 2.3h5c0-.9.4-1.6 1.2-2.3A6 6 0 0012 3z"/>',
  flag: '<path d="M5.5 21V3.5"/><path d="M5.5 4h12l-2.5 4.25L17.5 12.5h-12"/>',
  // Yetenek Avı quizi: yetenek yuvası + kıvılcım
  spell: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M12 7l1.4 3.6L17 12l-3.6 1.4L12 17l-1.4-3.6L7 12l3.6-1.4z"/>',
  // Rehber: tur (pusula), yardım paneli (klavye), ad değiştirme (kalem)
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/><circle cx="12" cy="12" r=".8"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><path d="M6 9.5h1M9.5 9.5h1M13 9.5h1M16.5 9.5h1M6 12.5h1M9.5 12.5h1M13 12.5h1M16.5 12.5h1M8 15.5h8"/>',
  pen: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 013 3L8 18.5z"/><path d="M13.5 7l3 3"/><path d="M4 20h5"/>',
  // Profil / Fan Kartı: indir, yükle, görsel
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 19.5h16"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5"/><path d="M4 19.5h16"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17.5l5-4.5 3.5 3 3-2.5 4.5 4"/>',
  // Uçan Kurye: kanatlı kurye, şişe (Bottle), Tango; Techies Mayın Tarlası: mayın, kazma
  courier: '<path d="M4.5 13.2c0-1.9 1.6-3 3.6-3h6c1.5 0 2.6-.8 3.2-2.1l.5-1.1 3 1.4-.9 2.3-2.2-.1c-.4 2.5-1.9 4.3-4.4 4.3H8.1c-2 0-3.6-.9-3.6-1.7z"/><path d="M17.8 7l-.7-3.3M19.3 7.6l1-3"/><path d="M8 15.2v4.3M13.8 15.2v4.3"/><path d="M11.5 10.2C10.8 6.8 8.2 4.4 4.2 3.8c.4 3 2.2 5.4 5 6.4"/><path d="M4.5 12.5L2.8 14"/>',
  bottle: '<path d="M10 2.8h4"/><path d="M10.6 2.8v4.6a6.6 6.6 0 102.8 0V2.8"/><path d="M6.2 14.5c2.4-1 5-.9 7.6.2 1.3.5 2.7.6 4 .1"/>',
  tango: '<path d="M12 21.5v-8.2"/><path d="M12 13.3C8 13.8 5.2 11.5 4.6 7.2c4.1-.4 6.9 1.8 7.4 6.1z"/><path d="M12 13.3c4 .5 6.8-1.8 7.4-6.1-4.1-.4-6.9 1.8-7.4 6.1z"/><path d="M12 10.2c-1.8-2-2-4.8-.1-7.4 1.9 2.6 1.9 5.4.1 7.4z"/>',
  mine: '<circle cx="12" cy="13.5" r="6.5"/><circle cx="12" cy="13.5" r="2.2"/><path d="M12 7V4.5M5.5 13.5H3M21 13.5h-2.5M7.4 8.9L5.6 7.1M16.6 8.9l1.8-1.8M7.4 18.1l-1.8 1.8M16.6 18.1l1.8 1.8"/><path d="M12 4.5c.6-1.2 1.8-1.8 3-1.4"/>',
  pick: '<path d="M4 20.5L15 9.5"/><path d="M8.6 4.3c4.6.2 10.2 5.3 11 11.1"/><path d="M13.2 7.1l3.7 3.7"/>',
  // Eşya 2048 / 24 Saat Maraton: ince kılıç, geri al, ince belli çay bardağı, güneş, ay
  rapier: '<path d="M20.5 3.5L9.2 14.8"/><path d="M6.4 12.3l5.3 5.3"/><path d="M8.3 15.7l-3.6 3.6"/><circle cx="4.1" cy="19.9" r="1.2"/><path d="M20.5 3.5l-3.8 1.3M20.5 3.5l-1.3 3.8"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
  tea: '<path d="M8 8.5h8c0 2.8-1.6 3.9-1.6 5.8s1.5 3.4 1.2 6.2H8.4c-.3-2.8 1.2-4.3 1.2-6.2S8 11.3 8 8.5z"/><path d="M5.5 20.5h13"/><path d="M10.5 3.2c.8.8.8 1.8 0 2.6M13.5 3.2c.8.8.8 1.8 0 2.6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  // Rozetler (2. tur): Black King Bar — taçlı asa
  bkb: '<path d="M8 9.5L7 4l3 2.5L12 3l2 3.5L17 4l-1 5.5z"/><path d="M12 9.5V21"/><path d="M9.5 13.5h5M10 21h4"/>',
  // Galeri · Salon II (Arena eserleri): çift ağızlı balta, kar tanesi, ikiz hançer, çivili sopa,
  // küreli asa, boynuzlu canavar, Radiant kulesi, dikenli Dire kulesi, tam ekran aç/kapat
  axe: '<path d="M12 3v18M10.5 21h3"/><path d="M12 5.5C8.6 4 5.2 5.4 4 9.5c1.2 4 4.6 5.4 8 4"/><path d="M12 5.5c3.4-1.5 6.8-.1 8 4-1.2 4-4.6 5.4-8 4"/>',
  frost: '<path d="M12 2.5v19M3.8 7.3l16.4 9.5M3.8 16.8l16.4-9.6"/><path d="M10 3.8l2 2 2-2M3.9 9.6l2.7-.7-.7-2.7M5.9 17.8l.7-2.7-2.7-.7M14 20.2l-2-2-2 2M20.1 14.4l-2.7.7.7 2.7M18.1 6.2l-.7 2.7 2.7.7"/>',
  daggers: '<g transform="rotate(-14 7 12)"><path d="M7 2.5l1.6 10H5.4z"/><path d="M4.4 12.5h5.2M7 12.5v6"/><circle cx="7" cy="19.8" r="1"/></g><g transform="rotate(14 17 12)"><path d="M17 2.5l1.6 10h-3.2z"/><path d="M14.4 12.5h5.2M17 12.5v6"/><circle cx="17" cy="19.8" r="1"/></g>',
  club: '<path d="M4.5 20.5l7.3-7.3"/><path d="M11.4 13.6a4.3 4.3 0 106.1-6.1 4.3 4.3 0 00-6.1 6.1z"/><path d="M13 5.3l-.6-2.3M18.7 11l2.3.6M17.8 5.9l1.9-1.4M10.5 8.8L8.3 8.1M15.4 15.6l.6 2.2"/>',
  staff: '<path d="M6.5 21.5l7.6-12.3"/><circle cx="16.3" cy="6.2" r="2.8"/><path d="M13 7.6c-1-1.8-.6-3.9 1-5.1M19.6 4.8c1 1.8.6 3.9-1 5.1"/><path d="M4.5 18l3 1.8"/>',
  beast: '<path d="M7 10.5C7 7.5 9.2 6 12 6s5 1.5 5 4.5v3.2c0 3.3-2.3 6.3-5 6.3s-5-3-5-6.3z"/><path d="M7.4 9C4.6 8.4 3 6.2 3.2 3.5c1.3 1.2 2.9 1.8 4.9 2M16.6 9c2.8-.6 4.4-2.8 4.2-5.5-1.3 1.2-2.9 1.8-4.9 2"/><path d="M9.3 11.3l1.8.9M14.7 11.3l-1.8.9"/><path d="M10.3 16.2l.5 1.6M13.7 16.2l-.5 1.6M10 15.8h4"/>',
  tower: '<path d="M7.5 21V11h9v10"/><path d="M5.5 21h13"/><path d="M6.5 11h11l-1-3.2h-9z"/><path d="M8.5 7.8V6.4M12 7.8V6.4M15.5 7.8V6.4"/><path d="M12 1.6l1.6 2.2L12 6 10.4 3.8z"/><path d="M10.5 21v-3.2a1.5 1.5 0 013 0V21"/>',
  towerDire: '<path d="M7.5 21l1-10h7l1 10"/><path d="M5.5 21h13"/><path d="M8.5 11L5 7.2M15.5 11L19 7.2M10.5 11l-.9-4.3M13.5 11l.9-4.3"/><path d="M12 1.8l1.7 2.4L12 6.6l-1.7-2.4z"/><path d="M6.4 15.4L3.8 14M17.6 15.4l2.6-1.4"/><path d="M10.6 21v-3a1.4 1.4 0 012.8 0v3"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
};

export function icon(name, { size = 20, stroke = 1.8, cls = '' } = {}) {
  const tmp = document.createElement('div');
  tmp.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="icon ${cls}">${P[name] || P.paw}</svg>`;
  return tmp.firstChild;
}

export const ICON_NAMES = Object.keys(P);
