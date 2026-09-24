// Çalışma ortamı algılama.
// Site iki yerde çalışır:
//  1) claude.ai Artifact önizlemesi: window.claude.use('db' | 'user') ile paylaşılan veritabanı ve kimlik.
//  2) Herhangi bir statik sunucu (Vite dev, GitHub Pages, Netlify...): window.claude yoktur;
//     veriler tarayıcıda (localStorage) veya yapılandırılmışsa server/ altındaki API'de tutulur.

const hasClaude = typeof window !== 'undefined' && !!window.claude && typeof window.claude.use === 'function';

function useCap(name) {
  if (!hasClaude) return Promise.resolve(null);
  try {
    return Promise.resolve(window.claude.use(name)).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

export const platform = {
  inArtifact: hasClaude,
  db: null,
  user: null,
  uid: null,
  isOwner: false,
  canEdit: false,
  /** true/false/null: paylaşılan veriye yazabilir mi (null = platform bir şey söylemedi) */
  canWrite: null,
  ready: null,
};

platform.ready = (async () => {
  const [db, user] = await Promise.all([useCap('db'), useCap('user')]);
  platform.db = db;
  platform.user = user;
  if (user) {
    try {
      const [id, isOwner, canEdit, canWrite] = await Promise.all([
        user.id(),
        user.isOwner(),
        user.canEdit(),
        user.can('data.write'),
      ]);
      platform.uid = id || null;
      platform.isOwner = !!isOwner;
      platform.canEdit = !!canEdit;
      platform.canWrite = canWrite;
    } catch {
      /* okuma hataları sessizce yok sayılır; user okumaları zaten reddetmez */
    }
  }
  return platform;
})();
