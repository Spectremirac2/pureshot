// dist/index.html → dist/artifact.html
// claude.ai Artifact yayını, sayfayı kendi <!doctype><html><head><body> iskeletine sarar;
// bu yüzden yalnızca içerik (title, style/link, script, gövde) içeren bir sürüm üretilir.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const head = (html.match(/<head>([\s\S]*?)<\/head>/i) || [, ''])[1];
const body = (html.match(/<body>([\s\S]*?)<\/body>/i) || [, ''])[1];

const keep = [];
const title = head.match(/<title>[\s\S]*?<\/title>/i);
if (title) keep.push(title[0]);
for (const m of head.matchAll(/<meta\s+name="(description|theme-color)"[^>]*>/gi)) keep.push(m[0]);
for (const m of head.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/gi)) keep.push(m[0]);
const scripts = [...head.matchAll(/<script[\s\S]*?<\/script>/gi)].map((m) => m[0]);

const out = [...keep, body.trim(), ...scripts].join('\n');
writeFileSync('dist/artifact.html', out + '\n');
console.log('dist/artifact.html yazıldı (' + out.length + ' bayt)');

// Artifact .glb sunmadığı için her GLB'nin yanına base64 JSON kopyası yazılır (core/models.js bunu okur)
for (const f of readdirSync('dist/assets')) {
  if (!f.endsWith('.glb')) continue;
  const b64 = readFileSync('dist/assets/' + f).toString('base64');
  writeFileSync('dist/assets/' + f + '.json', JSON.stringify({ b64 }));
  console.log('dist/assets/' + f + '.json yazıldı (' + (b64.length / 1024).toFixed(0) + ' KB)');
}
