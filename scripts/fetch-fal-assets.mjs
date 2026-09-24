#!/usr/bin/env node
// fal.ai ile üretilmiş görselleri ve 3D modelleri ham hâlleriyle assets-src/raw/ altına indirir,
// ardından scripts/optimize-assets.mjs ile src/assets/fal/ altına optimize edilmiş sürümleri üretir.
//
//   npm run fetch:fal                     # eksikleri indir + optimize et
//   npm run fetch:fal -- --force          # hepsini yeniden indir
//   npm run fetch:fal -- --only hero-keyart,model-dog --dry-run
//
// Hat: fal üretimi → assets-src/fal-jobs.json → (bu betik) assets-src/raw/<anahtar>.<jpg|png|webp|glb>
//      → scripts/optimize-assets.mjs (sharp + @gltf-transform/cli) → src/assets/fal/<anahtar>.<webp|glb>
//
// Kaynak: assets-src/fal-jobs.json  →  { "<anahtar>": { "endpoint", "request_id", "url"? } }
//   - `url` doluysa doğrudan indirilir. Uzantı dosya imzasından belirlenir (jpg/png/webp, model-* → glb).
//   - `url` yoksa ve FAL_KEY ortam değişkeni varsa sonuç fal kuyruğundan çözülür
//     (https://queue.fal.run/<endpoint>/requests/<request_id>, Authorization: Key $FAL_KEY)
//     ve bulunan URL jobs dosyasına geri yazılır. Yoksa girdi "URL eksik" olarak raporlanır.
//   - src3d-* girdileri (Trellis 2'ye verilen 3D referans görselleri) indirilmez.
//   - Ham klasörde zaten olan dosyalar atlanır (--force ile yeniden indirilir).
//
// Seçenekler: --force  --dry-run  --no-optimize  --only a,b  --jobs <dosya>  --raw <klasör>
//
// Vekil sunucu: Node'un yerleşik fetch'i HTTPS_PROXY'yi ancak NODE_USE_ENV_PROXY=1 ile kullanır
// (Node ≥ 22.21 / 24). HTTPS_PROXY tanımlıysa betik kendini bu değişkenle yeniden başlatır;
// elle: NODE_USE_ENV_PROXY=1 npm run fetch:fal

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ vekil sunucu
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy && !process.env.NODE_USE_ENV_PROXY && !process.env.__FAL_FETCH_CHILD) {
  const r = spawnSync(
    process.execPath,
    ['--disable-warning=UNDICI-EHPA', '--disable-warning=ExperimentalWarning', ...process.execArgv, ...process.argv.slice(1)],
    { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', __FAL_FETCH_CHILD: '1' } },
  );
  process.exit(r.status ?? 1);
}

// ------------------------------------------------------------------ ayarlar
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
function opt(n, fallback) {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
}

if (flag('--help') || flag('-h')) {
  const lines = (await readFile(fileURLToPath(import.meta.url), 'utf8')).split('\n').slice(1);
  const end = lines.findIndex((l) => !l.startsWith('//'));
  console.log(lines.slice(0, end).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}

const FORCE = flag('--force');
const DRY = flag('--dry-run');
const OPTIMIZE = !flag('--no-optimize');
const ONLY = opt('--only', '') ? new Set(opt('--only', '').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const JOBS = resolve(ROOT, opt('--jobs', 'assets-src/fal-jobs.json'));
const RAW = resolve(ROOT, opt('--raw', 'assets-src/raw'));
const OPTIMIZER = join(ROOT, 'scripts', 'optimize-assets.mjs');
const FAL_KEY = process.env.FAL_KEY || '';
const QUEUE = (process.env.FAL_QUEUE_BASE || 'https://queue.fal.run').replace(/\/$/, '');
const EXTS = ['jpg', 'jpeg', 'png', 'webp', 'glb'];

const rel = (p) => relative(ROOT, p) || p;
const kb = (n) => (n == null ? '-' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

function kindOf(key, job) {
  if (key.startsWith('src3d-')) return 'source';
  if (key.startsWith('model-') || /\.glb(\?|$)/i.test(job.url || '')) return 'model';
  return 'image';
}
const KIND_LABEL = { image: 'görsel', model: 'model', source: '3D ref.' };

// ------------------------------------------------------------------ yardımcılar
function errText(e) {
  const c = e && e.cause;
  return (c && (c.code || c.message)) || (e && e.message) || String(e);
}

/** Dosya imzasından uzantı (içerik türü başlığına güvenilmez: hata sayfaları da 200 dönebilir). */
function sniff(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'glTF') return 'glb';
  return null;
}

async function download(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!r.ok) {
    const t = (await r.text().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 140);
    throw new Error(`HTTP ${r.status}${t ? ' — ' + t : ''}`);
  }
  const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length) throw new Error('boş dosya');
  return { buf, type };
}

/** fal sonucundan dosya nesnesi ({ url, content_type }) seçer. */
function pickFile(data, kind) {
  const found = [];
  (function walk(v, depth) {
    if (!v || typeof v !== 'object' || depth > 6) return;
    if (typeof v.url === 'string' && /^https?:/.test(v.url)) found.push(v);
    for (const x of Array.isArray(v) ? v : Object.values(v)) walk(x, depth + 1);
  })(data, 0);
  const root = data && data.response ? data.response : data;
  if (kind === 'model') {
    const direct = root && (root.model_glb || root.model_mesh || root.glb);
    if (direct && direct.url) return direct;
    return found.find((f) => /\.glb(\?|$)/i.test(f.url) || /gltf/i.test(f.content_type || '')) || null;
  }
  const direct = root && ((Array.isArray(root.images) && root.images[0]) || root.image);
  if (direct && direct.url) return direct;
  return found.find((f) => /^image\//i.test(f.content_type || '') || /\.(png|jpe?g|webp)(\?|$)/i.test(f.url)) || null;
}

async function resolveFromQueue(job, kind) {
  if (!job.endpoint || !job.request_id) throw new Error('endpoint/request_id eksik');
  const app = job.endpoint.split('/').slice(0, 2).join('/'); // kuyruk, alt yol içeren uç noktalarda uygulama kimliğini ister
  const headers = { authorization: `Key ${FAL_KEY}`, accept: 'application/json' };
  const base = `${QUEUE}/${app}/requests/${encodeURIComponent(job.request_id)}`;
  const r = await fetch(base, { headers, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) {
    let status = '';
    try {
      const s = await fetch(`${base}/status`, { headers, signal: AbortSignal.timeout(15_000) });
      if (s.ok) status = (await s.json()).status || '';
    } catch { /* durum alınamadı */ }
    throw new Error(`fal sonucu alınamadı (HTTP ${r.status}${status ? ', durum: ' + status : ''})`);
  }
  const file = pickFile(await r.json(), kind);
  if (!file) throw new Error('fal sonucunda dosya URL’si yok');
  return file.url;
}

const existingRaw = (key) => EXTS.map((e) => join(RAW, `${key}.${e}`)).find((p) => existsSync(p)) || null;

// ------------------------------------------------------------------ iş akışı
async function processEntry(key, job, resolved) {
  const kind = kindOf(key, job);
  const row = { key, kind: KIND_LABEL[kind], status: '', size: null, file: '' };

  if (kind === 'source') {
    row.status = 'atlandı';
    row.file = '(3D referans görseli; sitede kullanılmaz)';
    return row;
  }

  const current = existingRaw(key);
  if (current && !FORCE) {
    row.status = 'var, atlandı';
    row.size = (await stat(current)).size;
    row.file = rel(current);
    return row;
  }

  let url = job.url || null;
  if (!url) {
    if (!FAL_KEY) {
      row.status = 'URL eksik';
      row.file = job.request_id ? '(request_id var; FAL_KEY gerekli)' : '(request_id da yok)';
      row.missing = true;
      return row;
    }
    if (DRY) {
      row.status = 'fal’dan çözülecek';
      return row;
    }
    url = await resolveFromQueue(job, kind);
    resolved[key] = url;
  }
  if (DRY) {
    row.status = 'indirilecek';
    row.file = rel(RAW);
    return row;
  }

  const { buf, type } = await download(url);
  const ext = sniff(buf);
  if (kind === 'model' && ext !== 'glb') throw new Error(`GLB değil (içerik türü: ${type || '?'})`);
  if (kind === 'image' && (!ext || ext === 'glb')) throw new Error(`görsel değil (içerik türü: ${type || '?'})`);

  const out = join(RAW, `${key}.${ext}`);
  await mkdir(RAW, { recursive: true });
  await writeFile(out + '.part', buf);
  await rename(out + '.part', out);
  for (const e of EXTS) {
    const p = join(RAW, `${key}.${e}`);
    if (p !== out && existsSync(p)) await rm(p); // eski uzantılı kopyayı kaldır
  }
  row.status = 'indirildi';
  row.size = buf.length;
  row.file = rel(out);
  row.downloaded = true;
  return row;
}

function runOptimizer() {
  if (!existsSync(OPTIMIZER)) {
    console.log(`Uyarı: ${rel(OPTIMIZER)} bulunamadı; optimizasyon atlandı.`);
    return false;
  }
  console.log(`\nOptimize ediliyor: node ${rel(OPTIMIZER)}  (${rel(RAW)} → src/assets/fal)`);
  // Optimizasyon ağ kullanmaz: vekil ayarını alt süreçlere taşıma (npx/undici uyarı gürültüsü)
  const env = { ...process.env };
  delete env.NODE_USE_ENV_PROXY;
  delete env.__FAL_FETCH_CHILD;
  const r = spawnSync(process.execPath, [OPTIMIZER], { cwd: ROOT, stdio: 'inherit', env });
  if (r.status !== 0) {
    console.log('Optimizasyon başarısız. sharp ve @gltf-transform/cli kurulu mu? (npm install) Sonra: node scripts/optimize-assets.mjs');
    return false;
  }
  return true;
}

async function main() {
  let jobs;
  try {
    jobs = JSON.parse(await readFile(JOBS, 'utf8'));
  } catch (e) {
    console.error(`İş listesi okunamadı: ${rel(JOBS)} (${errText(e)})`);
    process.exit(1);
  }
  const entries = Object.entries(jobs).filter(([k]) => !ONLY || ONLY.has(k));
  if (!entries.length) {
    console.log('İndirilecek girdi yok.');
    return;
  }

  console.log(`fal varlıkları → ${rel(RAW)}${DRY ? '  (deneme: hiçbir şey yazılmaz)' : ''}`);
  if (proxy) console.log(`Vekil sunucu: ${process.env.NODE_USE_ENV_PROXY ? 'NODE_USE_ENV_PROXY=1 ile etkin' : 'kapalı'}`);

  const resolved = {};
  const rows = new Array(entries.length);
  let next = 0;
  async function worker() {
    while (next < entries.length) {
      const i = next++;
      const [key, job] = entries[i];
      try {
        rows[i] = await processEntry(key, job || {}, resolved);
      } catch (e) {
        rows[i] = { key, kind: KIND_LABEL[kindOf(key, job || {})], status: 'HATA', size: null, file: '', note: errText(e), error: true };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, entries.length) }, worker));

  // Çözülen URL'leri jobs dosyasına geri yaz (bir dahaki sefere FAL_KEY gerekmesin)
  if (!DRY && Object.keys(resolved).length) {
    const fresh = JSON.parse(await readFile(JOBS, 'utf8'));
    for (const [k, u] of Object.entries(resolved)) if (fresh[k]) fresh[k].url = u;
    await writeFile(JOBS, JSON.stringify(fresh, null, 2) + '\n');
    console.log(`${Object.keys(resolved).length} URL ${rel(JOBS)} dosyasına yazıldı.`);
  }

  // ---- özet tablo
  const head = ['Anahtar', 'Tür', 'Durum', 'Boyut', 'Dosya / not'];
  const data = rows.map((r) => [r.key, r.kind, r.status, kb(r.size), [r.file, r.note].filter(Boolean).join('  ')]);
  const w = head.map((h, c) => Math.min(c === 4 ? 200 : 40, Math.max(h.length, ...data.map((d) => String(d[c]).length))));
  const line = (cells) => cells.map((v, c) => String(v).padEnd(w[c])).join('  ').trimEnd();
  console.log('\n' + line(head));
  console.log(w.map((n) => '─'.repeat(n)).join('  '));
  for (const d of data) console.log(line(d));

  const count = (f) => rows.filter(f).length;
  const errors = count((r) => r.error);
  const missing = count((r) => r.missing);
  const downloaded = count((r) => r.downloaded);
  const skipped = count((r) => /atlandı/.test(r.status));
  console.log(`\n${downloaded} indirildi · ${skipped} atlandı · ${missing} URL eksik · ${errors} hata`);
  if (missing) console.log('İpucu: FAL_KEY=<anahtar> npm run fetch:fal  → request_id’lerden sonuç URL’leri çözülür.');
  if (rows.some((r) => /allowlist|HTTP 403/i.test(r.note || ''))) {
    console.log('İpucu: 403 / "Host not in allowlist" → ağ çıkış izinlerine fal.media ve queue.fal.run eklenmeli.');
  }

  if (downloaded && !DRY) {
    if (OPTIMIZE) runOptimizer();
    else console.log('Sonraki adım: node scripts/optimize-assets.mjs  (assets-src/raw → src/assets/fal)');
  }
  if (errors) process.exitCode = 1;
}

await main();
