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
