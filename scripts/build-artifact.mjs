// dist/index.html → dist/artifact.html
// claude.ai Artifact yayını, sayfayı kendi <!doctype><html><head><body> iskeletine sarar;
// bu yüzden yalnızca içerik (title, style/link, script, gövde) içeren bir sürüm üretilir.
import { readFileSync, writeFileSync } from 'node:fs';

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
