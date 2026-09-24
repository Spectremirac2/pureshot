import { defineConfig } from 'vite';

// Tek JS + tek CSS paketi üretir; fontlar (woff2) CSS içine gömülür.
// Böylece site hem statik bir sunucuda hem de claude.ai Artifact önizlemesinde
// dış kaynağa ihtiyaç duymadan çalışır.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? true : undefined),
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        assetFileNames: (info) => {
          const name = info.names?.[0] || info.name || '';
          return name.endsWith('.css') ? 'assets/app.css' : 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  server: { host: true, port: 5173 },
});
