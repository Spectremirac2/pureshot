// Bölüm tablosu. Kısayol tuşları Dota yetenek çubuğunu taklit eder (Q W E R D F T).
// Hash biçimi: #bolum veya #bolum--alt (Artifact yalnızca [A-Za-z0-9._~-] karakterlerini iletir).

export const ROUTES = [
  { id: 'ana', label: 'Üs', short: 'Üs', key: 'H', icon: 'home', load: () => import('../sections/home/home.js') },
  { id: 'espriler', label: 'Espri Duvarı', short: 'Espri', key: 'Q', icon: 'laugh', load: () => import('../sections/jokes/jokes.js') },
  { id: 'oyunlar', label: 'Mini Oyunlar', short: 'Oyun', key: 'W', icon: 'gamepad', load: () => import('../sections/games/games.js') },
  { id: 'quizler', label: 'Quizler', short: 'Quiz', key: 'E', icon: 'quiz', load: () => import('../sections/quizzes/quizzes.js') },
  { id: 'arena', label: '1vDOQUZ Arena', short: 'Arena', key: 'R', icon: 'bow', ultimate: true, alias: ['oyunlar', 'arena'] },
  { id: 'karakterler', label: 'Karakter Analizleri', short: 'Analiz', key: 'D', icon: 'mask', load: () => import('../sections/characters/characters.js') },
  { id: 'soru-cevap', label: 'Soru-Cevap', short: 'S&C', key: 'F', icon: 'chat', load: () => import('../sections/qa/qa.js') },
  { id: 'galeri', label: 'Galeri & 3D Müze', short: 'Galeri', key: 'T', icon: 'cube', load: () => import('../sections/gallery/gallery.js') },
  { id: 'kahramanlar', label: 'Kahraman DOG Endeksi', short: 'Hero', key: 'Z', icon: 'swords', item: true, load: () => import('../sections/heroes/heroes.js') },
  // Gizli rotalar: yetenek çubuğunda slotu yok, kısayolu yok (HUD'daki ad çipinden açılır)
  { id: 'profil', label: 'Profilim', short: 'Profil', icon: 'user', hidden: true, load: () => import('../sections/profile/profile.js') },
];

export const DEFAULT_ROUTE = 'ana';

export function parseHash(hash = location.hash) {
  const raw = (hash || '').replace(/^#/, '');
  if (!raw) return { section: DEFAULT_ROUTE, sub: null };
  const [section, sub] = raw.split('--');
  const route = ROUTES.find((r) => r.id === section);
  if (!route) return { section: DEFAULT_ROUTE, sub: null };
  if (route.alias) return { section: route.alias[0], sub: route.alias[1] };
  return { section, sub: sub || null };
}

export function hashFor(section, sub) {
  return '#' + section + (sub ? '--' + sub : '');
}
