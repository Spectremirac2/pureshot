// 1vDOQUZ Arena 2.0 — arayüz glifleri (satır içi SVG, 24×24, currentColor çizgi).
// Yetenekler için özgün çizimler (Valve yetenek ikonları kullanılmaz); eşyalar src/assets/items ikonlarını kullanır.

const S = (d, extra = '') => `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;

export const GLYPH = {
  // Okçu (eski)
  q: S('<path d="M4 20L18.5 5.5"/><path d="M12.5 5h6.5v6.5"/><path d="M4 20v-4.2M4 20h4.2"/><path d="M7.5 5.5l1.2 2.4M5.2 8.6l2.5.9M15.2 18.8l-.9-2.5M18.4 16.6l-2.4-1.2" opacity=".7"/>'),
  w: S('<path d="M3 8.5h10.5a2.8 2.8 0 1 0-2.8-2.8"/><path d="M3 12.5h15a3 3 0 1 1-3 3"/><path d="M3 16.5h6.5"/><path d="M16 8.5h3" opacity=".7"/>'),
  e: S('<path d="M6 20.5C7.5 13 12 7.5 19.5 4"/><path d="M10.4 13.6c-3.2.3-5.4-1.4-5.8-4.6 3.2-.3 5.4 1.4 5.8 4.6z"/><path d="M14 9c-.4-3.2 1.2-5.5 4.4-6 .4 3.2-1.2 5.5-4.4 6z"/><path d="M12.3 16.8c.5-3.1 2.8-4.8 6-4.4-.5 3.1-2.8 4.8-6 4.4z"/>'),
  r: S('<circle cx="8" cy="9.5" r="1.6"/><circle cx="11" cy="7" r="1.6"/><circle cx="14.2" cy="7" r="1.6"/><circle cx="17" cy="9.5" r="1.6"/><path d="M8.8 15.6c0-2.4 1.6-4.3 3.7-4.3s3.7 1.9 3.7 4.3c0 1.3-1 2-2 2-.8 0-1.1-.5-1.7-.5s-.9.5-1.7.5c-1 0-2-.7-2-2z"/><path d="M3 5.5a11 11 0 0 0 0 13M21.9 5.5a11 11 0 0 1 0 13" opacity=".75"/>'),
  // Balta
  call: S('<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><path d="M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.2"/><path d="M10.6 11.2l2.8 1.6" opacity=".7"/>'),
  helix: S('<path d="M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0"/><path d="M12 4a8 8 0 0 1 8 8"/><path d="M20 12a8 8 0 0 1-8 8"/><path d="M12 20a8 8 0 0 1-8-8"/><path d="M4 12a8 8 0 0 1 8-8"/><path d="M18.5 4.5l1.5 3.5-3.6.4M5.5 19.5L4 16l3.6-.4"/>'),
  hunger: S('<path d="M7 4c-2 3-2 6 0 9M12 3c-2 4-2 8 0 12M17 4c2 3 2 6 0 9"/><path d="M9.5 16.5c.8 2 1.7 3.2 2.5 4.5.8-1.3 1.7-2.5 2.5-4.5"/><circle cx="12" cy="20" r=".6" fill="currentColor"/>'),
  cull: S('<path d="M13 3.5l7.5 7.5-2.2 2.2-7.5-7.5z"/><path d="M11 5.5c-3.5.6-6 3.3-6.5 7l4.5-.5 4.2-4.2z"/><path d="M14.3 13.7L4.5 21"/><path d="M17 6l2-2" opacity=".7"/>'),
  // Buz Cadısı
  nova: S('<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M12 5.5l-2-2M12 5.5l2-2M12 18.5l-2 2M12 18.5l2 2"/><circle cx="12" cy="12" r="2.6"/>'),
  chain: S('<rect x="3.5" y="9" width="8" height="6" rx="3"/><rect x="12.5" y="9" width="8" height="6" rx="3"/><path d="M12 3.5v3M12 17.5v3M7.5 4.5l1.3 2.4M16.5 19.5l-1.3-2.4" opacity=".75"/>'),
  aura: S('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5" opacity=".7"/><circle cx="12" cy="12" r="9.5" opacity=".4"/><path d="M12 2v2M12 20v2" opacity=".6"/>'),
  field: S('<path d="M12 3l1.6 3.3L17 5l-1.3 3.4L19 10l-3.3 1.6L17 15l-3.4-1.3L12 17l-1.6-3.3L7 15l1.3-3.4L5 10l3.3-1.6L7 5l3.4 1.3z"/><path d="M4 20.5h16M6.5 18.5h11" opacity=".7"/>'),
  // Gölge
  step: S('<path d="M5 19l6-6"/><path d="M11 13l1.2-4.8L17 3.5l-1.8 5.3z"/><path d="M14 20h6M16 17h4" opacity=".7"/><circle cx="6" cy="7" r="2" opacity=".6"/>'),
  smoke: S('<path d="M6.5 17.5a3.5 3.5 0 0 1 .4-7 5 5 0 0 1 9.6-1.2 3.6 3.6 0 0 1 .5 7.2"/><path d="M6.5 17.5h11"/><path d="M9 20.5h6" opacity=".6"/>'),
  crit: S('<path d="M12 3c2.5 3.3 4 5.9 4 8.3a4 4 0 0 1-8 0C8 8.9 9.5 6.3 12 3z"/><path d="M4 21l5-5M20 21l-5-5" opacity=".75"/>'),
  dance: S('<path d="M4 20L10 4l3 9 3-6 4 13"/><circle cx="10" cy="4" r="1.2"/><circle cx="16" cy="7" r="1.2"/><circle cx="20" cy="20" r="1.2"/>'),
  // Kahraman amblemleri
  okcu: S('<path d="M5 3c8 3 13 8 16 16"/><path d="M5 3l14 16"/><path d="M3 5l2-2M17 21l4-2-2 4"/><path d="M3 9l6 6"/>'),
  balta: S('<path d="M12 3v18"/><path d="M12 5c-4 0-7 2.5-8 6.5 3 .8 6-.2 8-2.5z"/><path d="M12 5c4 0 7 2.5 8 6.5-3 .8-6-.2-8-2.5z"/><path d="M10 21h4"/>'),
  buz: S('<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M12 6l-2.2-2.2M12 6l2.2-2.2M12 18l-2.2 2.2M12 18l2.2 2.2"/>'),
  golge: S('<path d="M8 3l2.5 10-2.5 2.5-2.5-2.5z"/><path d="M16 3l2.5 10-2.5 2.5-2.5-2.5z"/><path d="M8 15.5V21M16 15.5V21M6 19h4M14 19h4"/>'),

  // Şimşek Ruhu
  remnant: S('<path d="M12 3.5c-2.6 0-4.2 1.9-4.2 4.1 0 1.6.9 2.6 1.6 3.3-.9.6-2.9 2-2.9 5.1V20h11v-4c0-3.1-2-4.5-2.9-5.1.7-.7 1.6-1.7 1.6-3.3 0-2.2-1.6-4.1-4.2-4.1z" stroke-dasharray="2.4 1.6"/><path d="M12.6 8.5l-2 3.4h2.8l-2 3.6"/>'),
  vortex: S('<path d="M12 12c0-1.4 1.1-2 2.2-1.6 1.6.6 1.9 3 .6 4.3-1.9 1.9-5.2 1.2-6.1-1.3-1.2-3.2 1.2-6.4 4.5-6.6 4.3-.2 7.4 3.6 6.5 7.8-1 4.6-6.3 7-10.6 4.9"/><path d="M4.5 6.5l1.5 2.2M19.5 17.5l-1.5-2.2" opacity=".7"/>'),
  overload: S('<circle cx="12" cy="12" r="7.5" opacity=".55"/><path d="M13.2 5.5L8.6 12.6h3.2l-1.1 5.9 4.9-7.3h-3.3z"/><path d="M3.5 12h1.6M18.9 12h1.6M12 3.5v1.2M12 19.3v1.2" opacity=".7"/>'),
  ball: S('<circle cx="14.5" cy="9.5" r="5"/><path d="M15.4 6.8l-2.2 3.2h2.4l-1.8 3.1"/><path d="M3 20l5.5-5.5M4.5 15.5l3-3M8.5 20.5l3-3" opacity=".75"/>'),
  // Ağaç Bekçisi
  guise: S('<path d="M12 3c3.8 2.2 6 5.4 6 9.2 0 3.7-2.7 6.6-6 6.6s-6-2.9-6-6.6C6 8.4 8.2 5.2 12 3z" stroke-dasharray="3 1.8"/><path d="M12 7v14M12 11.5l2.8-2.2M12 15l-3-2.4"/>'),
  leech: S('<path d="M5 21c1-4 3.4-5.3 3.4-8.4 0-2-1-3.3-2.4-4.6M19 21c-1-4-3.4-5.3-3.4-8.4 0-2 1-3.3 2.4-4.6"/><path d="M8.4 12.6c1.2.8 2.3 1.2 3.6 1.2s2.4-.4 3.6-1.2"/><path d="M12 3.5v6M10 6.5l2 2.2 2-2.2"/>'),
  bark: S('<path d="M12 3l7 2.6v5.6c0 4.3-3 7.9-7 8.8-4-.9-7-4.5-7-8.8V5.6z"/><path d="M9 8.5c1 1.5 1 3 0 4.5M12 7.5c1 2 1 4.5 0 7M15 8.5c1 1.5 1 3 0 4.5" opacity=".75"/>'),
  growth: S('<path d="M12 21v-7M12 14c-3.5 0-6-2.2-6.5-5.5 3.3.2 5.6 2 6.5 5.5zM12 14c3.5 0 6-2.2 6.5-5.5-3.3.2-5.6 2-6.5 5.5z"/><path d="M3 21c2.2-2.4 4.4-3.2 6-3M21 21c-2.2-2.4-4.4-3.2-6-3M12 10V3.5" opacity=".75"/>'),
  simsek: S('<path d="M13.5 2.5L6 13h5l-1.5 8.5L18 10h-5.2z"/><path d="M4 6.5l2 1M20 16.5l-2-1M3.5 15.5l2.2-.6" opacity=".7"/>'),
  agac: S('<path d="M12 21v-6.5"/><path d="M12 14.5c-4.4 0-7-2.6-7-6.2C5 5.2 8 3 12 3s7 2.2 7 5.3c0 3.6-2.6 6.2-7 6.2z"/><path d="M9 21h6M9.5 9.5c.8.6 1.6.9 2.5.9s1.7-.3 2.5-.9" opacity=".75"/>'),
  // özellikler
  str: S('<path d="M7 20h10M9 20V9.5M15 20V9.5M6.5 9.5h11l-1-4h-9z"/><circle cx="12" cy="3.6" r="1.3" fill="currentColor"/>'),
  agi: S('<path d="M4 16c3.5 0 5-6 8.5-6 2.5 0 3 2.5 5.5 2.5M5 20c4.5 0 7-8 11.5-8"/><path d="M15.5 5l3.5 3.5-3.5 3.5" opacity=".8"/>'),
  int: S('<circle cx="12" cy="9.5" r="5.5"/><path d="M9.5 17.5h5M10.5 20.5h3M10 9.5c0-1.2.9-2 2-2"/>'),
  // HUD
  sun: S('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"/>'),
  moon: S('<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.4 6.4 0 0 0 10 10z"/><path d="M16.5 4.5v2M15.5 5.5h2M20 8.5v1.4M19.3 9.2h1.4" opacity=".75"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  lock: S('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14v2.4"/>'),
  paw: S('<ellipse cx="12" cy="15.5" rx="4.2" ry="3.6"/><circle cx="6.5" cy="10.5" r="1.8"/><circle cx="9.5" cy="6.8" r="1.8"/><circle cx="14.5" cy="6.8" r="1.8"/><circle cx="17.5" cy="10.5" r="1.8"/>'),
  greatsword: S('<path d="M12 2.5l2.2 3v10H9.8v-10z"/><path d="M6.5 15.5h11M12 15.5v6M10.5 21.5h3"/>'),
  ancient: S('<path d="M12 2.5l7.5 4.3v8.6L12 19.7l-7.5-4.3V6.8z"/><path d="M12 8.5l3 1.7v3.6L12 15.5l-3-1.7v-3.6z"/><path d="M12 19.7v2" opacity=".7"/>'),
  wolf: S('<path d="M4 9l3-5 2.5 3.5h5L17 4l3 5-1.2 5.5L12 20l-6.8-5.5z"/><circle cx="9.3" cy="11.2" r=".9" fill="currentColor"/><circle cx="14.7" cy="11.2" r=".9" fill="currentColor"/><path d="M10.5 15h3"/>'),
  harpy: S('<path d="M12 7.5c-1.4 0-2.4 1-2.4 2.3 0 1 .5 1.7 1.2 2.1L9.5 20h5l-1.3-8.1c.7-.4 1.2-1.1 1.2-2.1 0-1.3-1-2.3-2.4-2.3z"/><path d="M9.6 10.5C7 9.5 4.5 7 3 3.5c3 1 5.5 2.5 7 4.8M14.4 10.5C17 9.5 19.5 7 21 3.5c-3 1-5.5 2.5-7 4.8"/>'),
  // durumlar
  hex: S('<ellipse cx="12" cy="14" rx="6.5" ry="5"/><circle cx="7.5" cy="8.5" r="2.5"/><path d="M9 19v2M15 19v2M17.5 12.5c1.5-.3 2.5.5 2.5 1.5" opacity=".75"/>'),
  silence: S('<path d="M4 5h16v11H9l-5 4z"/><path d="M4 20L20 4"/>'),
  root: S('<path d="M12 3v9M12 12c-3 0-5 2.5-6 6M12 12c3 0 5 2.5 6 6M12 12v9M8 21h8"/>'),
  fear: S('<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/><ellipse cx="12" cy="15.5" rx="2" ry="2.4"/>'),
  cyclone: S('<path d="M4 6h14M6 10h12M8 14h9M10 18h6M12 21.5h2"/>'),
  // eşyalar (ikonu olmayanlar)
  belt: S('<rect x="3" y="9" width="18" height="6" rx="2"/><rect x="9.5" y="8" width="5" height="8" rx="1.2"/><path d="M12 10.5v3"/>'),
  band: S('<path d="M4 8c3 2.5 5 2.5 8 0s5-2.5 8 0M4 13c3 2.5 5 2.5 8 0s5-2.5 8 0"/><path d="M18 16l2.5 4M15.5 17l1.5 4" opacity=".75"/>'),
  robe: S('<path d="M9 3.5h6l1.5 4-1.5 1.5 3 11.5H6L9 9 7.5 7.5z"/><path d="M12 9v11.5" opacity=".7"/>'),
  blade: S('<path d="M18.5 3.5l2 2L9 17l-2-2z"/><path d="M5 13.5l5.5 5.5M4 20l3-3"/>'),
  mail: S('<path d="M7 4l5 2 5-2 3 4-2.5 1.5V20h-11V9.5L4 8z"/><path d="M9 11h6M9 14h6M9 17h6" opacity=".75"/>'),
  gloves: S('<path d="M7 21v-6.5L5 9.5c-.4-1 1-1.8 1.7-.9L9 11V4.5a1.2 1.2 0 0 1 2.4 0V10V3.5a1.2 1.2 0 0 1 2.4 0V10V4.5a1.2 1.2 0 0 1 2.4 0V14l-1.2 7z"/><path d="M19.5 6l-2 2M21 10h-2.5" opacity=".7"/>'),
  vital: S('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M5.5 12.5h3l1.5-3 2 6 1.5-3h5" opacity=".85"/>'),
  energy: S('<circle cx="12" cy="12" r="7.5"/><path d="M12 7c2 1.5 2 8.5 0 10M8 9.5c2.5.5 5.5.5 8 0M8 14.5c2.5-.5 5.5-.5 8 0" opacity=".75"/>'),
  ring: S('<circle cx="12" cy="14" r="6"/><path d="M9.5 5.5l2.5-2.5 2.5 2.5-2.5 2.5z"/><path d="M12 8v0" opacity=".7"/>'),
  cloak: S('<path d="M12 3c-2 0-3 1.3-3 2.8L4.5 20.5h15L15 5.8C15 4.3 14 3 12 3z"/><path d="M9 5.8c1 1 2 1.4 3 1.4s2-.4 3-1.4M12 10v10" opacity=".7"/>'),
  mask: S('<path d="M4 7c3-1.5 5.5-1.5 8 0 2.5-1.5 5-1.5 8 0 0 6-3.5 11-8 12.5C7.5 18 4 13 4 7z"/><path d="M7.5 10.5l2.5 1M16.5 10.5l-2.5 1M10 16h4" /><path d="M11 18.5l1 2 1-2" opacity=".75"/>'),
  phase: S('<path d="M7 4h4v9l7 3v4H7z"/><path d="M3 9h3M2 13h4M4 17h3" opacity=".75"/>'),
  treads: S('<path d="M6 4h4v9l7 3v4H6z"/><path d="M6 20h11M8 17h1M11 17h1M14 17h1" opacity=".75"/><path d="M19 3.5l1.5 2.5-1.5 2.5" opacity=".7"/>'),
  vanguard: S('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" opacity=".7"/>'),
  maelstrom: S('<path d="M4 19.5L13 4c3.5 2 5 5.5 4 9.5"/><path d="M13.5 10.5l-2.5 4h2.6l-2 4" /><path d="M17 13.5c1.5 0 3-1 3.5-2.5" opacity=".7"/>'),
  deso: S('<path d="M17.5 3l3.5 3.5-10.5 10.5-3.5-3.5z"/><path d="M6.5 14l3.5 3.5M3 21l4-4"/><path d="M14 9.5l-2 2M16 11.5l-2 2" opacity=".8"/>'),
  hood: S('<path d="M12 3c-4.5 0-7.5 3.5-7.5 8.5 0 3.5 1.5 6.5 3.5 9h8c2-2.5 3.5-5.5 3.5-9C19.5 6.5 16.5 3 12 3z"/><path d="M8.5 14c1-1.8 2.2-2.6 3.5-2.6s2.5.8 3.5 2.6" opacity=".75"/>'),
  satanic: S('<path d="M12 21c-3.9 0-6.5-2.7-6.5-6.2C5.5 10 12 3 12 3s6.5 7 6.5 11.8c0 3.5-2.6 6.2-6.5 6.2z"/><path d="M9.5 14.5l2 2 3.5-4" opacity=".8"/><path d="M4.5 4.5l2 2M19.5 4.5l-2 2" opacity=".7"/>'),
  mek: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M7.5 12h9"/><circle cx="12" cy="12" r="3" opacity=".6"/>'),
  fang: S('<path d="M5 5c3 3 11 3 14 0"/><path d="M8.5 6.5L10 15l1.5-8M13.5 6.8L14.8 13l1.4-6.6"/><circle cx="12" cy="18.5" r="1.5"/>'),
  feather: S('<path d="M19 4c-7 0-12 5-12 12l-2.5 4.5"/><path d="M19 4c0 7-5 11.5-11 12M11 12l4-1M9.5 15.5l3.5-.5" opacity=".8"/>'),
  charm: S('<path d="M12 3.5l2.2 4.5 4.9.7-3.6 3.4.9 4.9L12 14.6 7.6 17l.9-4.9L4.9 8.7l4.9-.7z"/><path d="M12 17v4" opacity=".7"/>'),
  lantern: S('<path d="M9 5h6M10 3h4M8 5l-.5 12.5h9L16 5"/><path d="M7 17.5h10v2.5H7z"/><path d="M12 9c1.2 1.4 1.2 3.2 0 4.6-1.2-1.4-1.2-3.2 0-4.6z" fill="currentColor" opacity=".7"/>'),
  chainlink: S('<rect x="3.5" y="9" width="8" height="6" rx="3"/><rect x="12.5" y="9" width="8" height="6" rx="3"/><path d="M9.5 6l1.5-2M13 20l1.5-2" opacity=".75"/>'),
  fury: S('<path d="M12 3c1.4 3 4.5 4.3 4.5 8.4 0 3.5-2 5.6-4.5 5.6s-4.5-2.1-4.5-5.6c0-2.3 1.2-3.5 2.3-4.8.3 1.5 1 2.4 2.2 2.8C12 7.5 11.8 5 12 3z"/><path d="M8 21h8" opacity=".7"/>'),
  scale: S('<path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7z"/><path d="M8.5 9.5c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5M8.5 13.5c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5" opacity=".75"/>'),
  shard: S('<path d="M12 2.5l4 6.5-4 12.5L8 9z"/><path d="M8 9h8M12 2.5V21.5" opacity=".6"/>'),
  seal: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 5.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L12 13.7l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"/><path d="M8 19.5l-1 2.5M16 19.5l1 2.5" opacity=".7"/>'),
  // HUD
  coin: S('<ellipse cx="12" cy="12" rx="8.5" ry="8.5"/><path d="M12 7.5v9M9.5 9.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 1.7-2.5 2-2.5.8-2.5 2 1.1 2 2.5 2 2.5-.8 2.5-2"/>'),
  shop: S('<path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9 12h6" opacity=".7"/>'),
  tree: S('<circle cx="12" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/><path d="M11 6.8L7.2 10.5M13 6.8l3.8 3.7M6.9 13.8l1.3 3.4M17.1 13.8l-1.3 3.4"/>'),
  courier: S('<path d="M7 14c0-2.5 2-4.5 5-4.5s5 2 5 4.5-2 3.5-5 3.5-5-1-5-3.5z"/><path d="M12 9.5C9.5 5 5.5 4 3 5.5c1.5 2.5 4.5 4 8 4"/><path d="M12 9.5c2.5-4.5 6.5-5.5 9-4-1.5 2.5-4.5 4-8 4"/><path d="M9 17.5l-.5 2.5M15 17.5l.5 2.5"/>'),
  skull: S('<path d="M12 3.5c-4.4 0-7.5 3-7.5 7 0 2.4 1.1 4 2.8 5v3h9.4v-3c1.7-1 2.8-2.6 2.8-5 0-4-3.1-7-7.5-7z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10.5 18.5v-2M13.5 18.5v-2"/>'),
  tower: S('<path d="M8 21V9l4-5 4 5v12"/><path d="M6 21h12M10 13h4M10 17h4"/><path d="M12 4V2" opacity=".7"/>'),
  rune: S('<path d="M12 2.5l6.5 9.5L12 21.5 5.5 12z"/><path d="M12 7l3 5-3 5-3-5z" opacity=".7"/>'),
  aegis: S('<path d="M12 3l7 2.6v5.6c0 4.3-3 7.9-7 8.8-4-.9-7-4.5-7-8.8V5.6z"/><path d="M12 7v9M8.5 10.5h7"/>'),
  sword: S('<path d="M14.5 3H21v6.5L10 20.5 3.5 14z"/><path d="M5 16l3 3M3 21l3-3"/>'),
  slow: S('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  eye: S('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20L20 4"/>'),
  heart: S('<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/><path d="M12 9v5M9.5 11.5h5"/>'),
  bolt: S('<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>'),
  shield: S('<path d="M12 3l7 2.6v5.6c0 4.3-3 7.9-7 8.8-4-.9-7-4.5-7-8.8V5.6z"/>'),
  star: S('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
};

export const glyph = (k) => GLYPH[k] || GLYPH.rune;
