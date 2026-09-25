import { defineConfig } from 'vite';

// İki derleme kipi:
//
// • statik (varsayılan: `vite build`, `npm run build:static`) — Netlify / GitHub Pages.
//   Bölümler dinamik import() ile ayrı parçalara bölünür, three.js kendi "three" parçasındadır,
//   JS/CSS/font adları hash'lidir (netlify.toml: /assets/* bir yıl "immutable" önbellekte kalır).
//   CSS de bölümlere bölünür (ortak stiller + bölümün kendi CSS'i, parça yüklenirken birlikte gelir).
//   Fontlar ayrı woff2 dosyaları olarak iner ve yalnızca kullanıldıklarında istenir.
//
// • artifact (`vite build --mode artifact`, `npm run build`) — claude.ai Artifact yayını.
//   Artifact ortamı ayrı font dosyalarını ve kod parçalarını güvenilir biçimde sunamadığı için
//   tek JS + tek CSS paketi (assets/app.js, assets/app.css) üretilir, fontlar CSS içine gömülür.
//   scripts/build-artifact.mjs bu sabit adlara göre dist/artifact.html'i yazar.

// Kahraman ve yetenek görselleri asla JS/CSS'e gömülmez: yalnızca görüntülendiklerinde indirilsinler
const neverInline = (file) => file.includes('/assets/heroes/') || file.includes('/assets/abilities/');

// `vite preview` ile yerel ölçümde Netlify'deki önbellek başlıklarını taklit eder (bkz. netlify.toml)
const previewCacheHeaders = {
  name: 'onizleme-onbellek-basliklari',
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if ((req.url || '').startsWith('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      next();
    });
  },
};

// Statik yayında en sık kullanılan iki yazı tipi önceden yüklenir: metin JS kabuğu çizdikten sonra
// oluştuğu için tarayıcı fontları aksi hâlde ancak JS çalıştıktan sonra isterdi.
const PRELOAD_FONTS = ['barlow-400', 'unbounded-800'];
const fontPreload = {
  name: 'font-onyukleme',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      if (!ctx.bundle) return html;
      return Object.values(ctx.bundle)
        .filter((f) => f.type === 'asset' && f.fileName.endsWith('.woff2'))
        .filter((f) => PRELOAD_FONTS.includes((f.names?.[0] || f.name || '').replace(/\.woff2$/, '')))
        .map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: './' + f.fileName, crossorigin: '' },
          injectTo: 'head',
        }));
    },
  },
};

export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  return {
    base: './',
    plugins: artifact ? [] : [fontPreload, previewCacheHeaders],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      target: 'es2020',
      cssCodeSplit: !artifact,
      assetsInlineLimit: artifact
        ? (file) => (file.endsWith('.woff2') ? true : neverInline(file) ? false : undefined)
        : (file) => (file.endsWith('.woff2') || neverInline(file) ? false : undefined),
      chunkSizeWarningLimit: artifact ? 2000 : 700,
      rollupOptions: {
        output: artifact
          ? {
              inlineDynamicImports: true,
              entryFileNames: 'assets/app.js',
              assetFileNames: (info) => {
                const name = info.names?.[0] || info.name || '';
                return name.endsWith('.css') ? 'assets/app.css' : 'assets/[name]-[hash][extname]';
              },
            }
          : {
              entryFileNames: 'assets/[name]-[hash].js',
              chunkFileNames: 'assets/[name]-[hash].js',
              assetFileNames: 'assets/[name]-[hash][extname]',
              // three.js tek ortak parça: ana sayfa, galeri, arena ve kahraman halkası paylaşır;
              // bölüm kodu değiştiğinde tarayıcı önbelleğindeki three parçası geçerli kalır.
              manualChunks(id) {
                if (id.includes('/node_modules/three/')) return 'three';
              },
            },
      },
    },
    server: { host: true, port: 5173 },
  };
});
