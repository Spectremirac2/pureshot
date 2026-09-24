// Wrangler olmadan yerel tam yığın önizleme: worker.js + Node SQLite (D1 taklidi) + dist/ statik dosyaları.
//
//   npm run build                         # dist/ oluşturur (isteğe bağlı; yoksa yalnızca API çalışır)
//   node server/local/dev.mjs             # http://localhost:8787  (site + /api)
//   node server/local/dev.mjs --persist   # veriyi server/.wrangler/dev-api.sqlite dosyasında tut
//
// Seçenekler: --port 8787  --dist <klasör>  --db <sqlite dosyası>  --persist
// Ortam: ADMIN_TOKEN, ALLOWED_ORIGIN, WRITE_LIMIT_PER_MIN, POST_LIMIT_PER_MIN, ID_SALT
//
// Vite geliştirme sunucusunu bu API ile kullanmak için:
//   VITE_API_BASE=http://localhost:8787/api npm run dev

import http from 'node:http';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../worker.js';
import { openD1 } from './d1-sqlite.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}
const port = Number(arg('--port', process.env.PORT || 8787));
const distDir = resolve(arg('--dist', join(repo, 'dist')));
let dbPath = arg('--db', ':memory:');
if (process.argv.includes('--persist') && dbPath === ':memory:') {
  mkdirSync(join(repo, 'server', '.wrangler'), { recursive: true });
  dbPath = join(repo, 'server', '.wrangler', 'dev-api.sqlite');
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};

// Cloudflare [assets] bağlamasının basit karşılığı
const hasDist = existsSync(join(distDir, 'index.html'));
const ASSETS = hasDist
  ? {
      async fetch(request) {
        let p = decodeURIComponent(new URL(request.url).pathname);
        if (p.endsWith('/')) p += 'index.html';
        const file = resolve(distDir, '.' + p);
        if (!(file === distDir || file.startsWith(distDir + sep)) || !existsSync(file) || !statSync(file).isFile()) {
          return new Response('Bulunamadı', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
        }
        const body = await readFile(file);
        return new Response(body, { headers: { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' } });
      },
    }
  : undefined;

const env = {
  DB: openD1(dbPath),
  ASSETS,
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
  ID_SALT: process.env.ID_SALT || '',
  WRITE_LIMIT_PER_MIN: process.env.WRITE_LIMIT_PER_MIN || '60',
  POST_LIMIT_PER_MIN: process.env.POST_LIMIT_PER_MIN || '10',
};
const ctx = { waitUntil: (p) => Promise.resolve(p).catch(() => {}), passThroughOnException() {} };

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v != null && k !== 'cf-connecting-ip') headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    }
    headers.set('cf-connecting-ip', req.socket.remoteAddress || 'local');
    const method = req.method || 'GET';
    const request = new Request(`http://${req.headers.host || 'localhost:' + port}${req.url}`, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const response = await worker.fetch(request, env, ctx);
    const out = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(method === 'HEAD' ? undefined : out);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Sunucu hatası');
  }
});

server.listen(port, () => {
  console.log(`DOG API yerel sunucu: http://localhost:${port}`);
  console.log(`  API:  http://localhost:${port}/api/health`);
  console.log(`  Site: ${hasDist ? distDir : '(dist/ yok — önce `npm run build`; şimdilik yalnızca API)'}`);
  console.log(`  Veri: ${dbPath === ':memory:' ? 'bellekte (kapatınca silinir; kalıcı için --persist)' : dbPath}`);
});
